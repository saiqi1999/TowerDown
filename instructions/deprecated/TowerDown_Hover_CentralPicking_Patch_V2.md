# TowerDown Hover System Central Picking 技术方案 V2

> Repo: `saiqi1999/TowerDown`  
> Engine: Cocos Creator 3.8.8  
> 背景：V1 使用 `MOUSE_ENTER / MOUSE_LEAVE` + Controller 全局 `MOUSE_MOVE` + 手动 `hitTest()` 的混合模式。实测出现“初始目标能显示、附近目标偶尔能显示、移动距离大后不再 Hover”的状态不同步问题。  
> V2 目标：把 Hover 判定权收敛到一个中央 Picking 系统。所有 Hoverable 对象只注册“对象本身 + 信息 Provider”，不注册坐标、不注册 Rect，也不依赖 Node 的 enter/leave 事件。Controller 每帧根据最新鼠标屏幕坐标和目标节点的当前 `UITransform` 做 hit test，因此天然覆盖对象移动、Camera Pan、MapRoot Zoom、节点缩放与父级 Transform 变化。

---

# 0. 最终结论

彻底移除：

```text
Node.EventType.MOUSE_ENTER
Node.EventType.MOUSE_LEAVE
```

Hover 的唯一真相改为：

```text
Global Mouse Position
        ↓
HoverInfoController
        ↓
Registered Hover Targets
        ↓
Per-frame Picking
        ↓
hovered target
        ↓
current tooltip target
        ↓
HoverInfoPanelView
```

核心原则：

> **注册的是“这个 Node 是一个可 Hover 对象”，不是它当前的屏幕位置。**

---

# 1. 为什么要改架构

当前问题来自多个状态拥有者：

```text
Cocos Node Hover State
+
HoverInfoTarget MOUSE_ENTER / LEAVE
+
HoverInfoController global MOUSE_MOVE
+
HoverInfoController manual hitTest
```

这几套机制都在尝试回答：

```text
“鼠标现在到底在哪个对象上？”
```

一旦事件顺序、Camera 变化、节点运动或引擎内部 Hover 状态不同步，就可能出现：

```text
Controller 认为已经离开
但 Node 没有正确进入新目标

或

Node 已经进入新目标
Controller 下一帧又立即 hide
```

V2 规定：

```text
谁被 Hover
```

只能由：

```text
HoverInfoController.pickTarget()
```

决定。

---

# 2. 注册的到底是什么

```ts
export interface HoverInfoSource {
    readonly anchor: Node;
    readonly kind: HoverTargetKind;
    readonly scope: HoverTargetScope;
    readonly preferredPlacement: HoverPlacement;
    readonly getInfo: () => HoverInfoModel;
}
```

最重要的是：

```ts
anchor: Node
```

注册时不保存：

```text
screen position
world position
Rect
当前 scale
当前 HP
当前内容快照
```

注册的是：

```text
“Resource_wood_01 这个 Node 是 Hover Target”
```

而不是：

```text
“Resource 当前在屏幕 (320, 200)”
```

---

# 3. 为什么对象移动 / Camera / Zoom 都能 Cover

每一帧重新读取：

```ts
const transform = source.anchor.getComponent(UITransform);

transform.hitTest(
    currentPointerScreenPoint,
    windowId,
);
```

`hitTest()` 使用 Node 当前完整 Transform，因此：

```text
Monster 自己移动
✓

Building parent 移动
✓

MapRoot Pan
✓

MapRoot Zoom
✓

父节点 Scale 改变
✓

Canvas / Camera Transform 变化
✓
```

都不需要重新注册。

例如：

```text
Canvas
└ MapRoot
   └ WorldObjectRoot
      └ ResourceRoot
         └ ResourceNode
```

Resource 的最终位置会随 MapRoot 的平移和缩放自动变化；下一帧 `ResourceNode.UITransform.hitTest(pointer)` 看到的就是更新后的结果。

---

# 4. HoverInfoTarget V2

文件：

```text
assets/scripts/ui/hover/HoverInfoTarget.ts
```

职责从：

```text
监听 Enter / Leave
```

改成：

```text
注册 / 注销 Hover Source
```

推荐：

```ts
/**
 * Why this file exists:
 * Hoverable Node 需要一个轻量 adapter，把自身作为活的 Node 引用注册给统一
 * HoverInfoController，而不是依赖 MOUSE_ENTER / MOUSE_LEAVE 的事件状态。
 *
 * Ownership boundary:
 * 本文件只负责一个 Node 的 Hover source 生命周期注册与注销。
 *
 * This file deliberately does NOT:
 * 不判断鼠标是否位于节点上，不拥有 Tooltip 状态，不缓存节点坐标或业务数据。
 */
import { _decorator, Component } from 'cc';
import { type HoverInfoTargetConfig } from './HoverInfoTypes';

const { ccclass } = _decorator;

@ccclass('HoverInfoTarget')
export class HoverInfoTarget extends Component {
    private config: HoverInfoTargetConfig | null = null;
    private registered = false;

    public setup(config: HoverInfoTargetConfig): void {
        if (
            this.registered
            && this.config?.controller !== config.controller
        ) {
            this.unregister();
        }

        this.config = config;
        this.registerIfReady();
    }

    protected onEnable(): void {
        this.registerIfReady();
    }

    protected onDisable(): void {
        this.unregister();
    }

    protected onDestroy(): void {
        this.unregister();
    }

    private registerIfReady(): void {
        const config = this.config;

        if (
            !config
            || this.registered
            || !this.node.isValid
            || !this.node.activeInHierarchy
        ) {
            return;
        }

        config.controller.register({
            anchor: this.node,
            kind: config.kind,
            scope: config.scope,
            preferredPlacement: config.preferredPlacement,
            getInfo: config.getInfo,
        });

        this.registered = true;
    }

    private unregister(): void {
        if (!this.registered || !this.config) return;

        this.config.controller.unregister(this.node);
        this.registered = false;
    }
}
```

---

# 5. HoverInfoTarget 禁止监听鼠标事件

删除：

```ts
this.node.on(Node.EventType.MOUSE_ENTER, ...);
this.node.on(Node.EventType.MOUSE_LEAVE, ...);
```

删除：

```text
onMouseEnter()
onMouseLeave()
```

V2 中 `HoverInfoTarget` 不知道鼠标存在。

---

# 6. HoverInfoController 新状态

新增：

```ts
private readonly targets =
    new Map<Node, HoverInfoSource>();

private hovered:
    HoverInfoSource | null = null;

private current:
    HoverInfoSource | null = null;
```

语义：

```text
hovered
= 当前鼠标真正位于哪个 Target

current
= Tooltip 当前正在展示哪个 Target
```

必须分开，因为存在 Hide Delay。

例如：

```text
鼠标刚离开 A

hovered = null
current = A
hideTimer = 0.03
```

这是正确状态。

---

# 7. Register / Unregister

```ts
public register(
    source: HoverInfoSource,
): void {
    this.targets.set(
        source.anchor,
        source,
    );
}
```

```ts
public unregister(
    anchor: Node,
): void {
    this.targets.delete(anchor);

    if (
        this.hovered?.anchor === anchor
    ) {
        this.hovered = null;
    }

    if (
        this.current?.anchor === anchor
    ) {
        this.hideImmediately();
    }
}
```

用于：

```text
Resource depletion
Monster death
Building remove
Blueprint Card rebuild
Node disable
Scene teardown
```

---

# 8. Pointer State

Controller 继续全局监听：

```text
Input.EventType.MOUSE_MOVE
```

但是只记录屏幕坐标：

```ts
private readonly pointer = new Vec2();
private hasPointer = false;
private windowId = 0;

private onMouseMove(
    event: EventMouse,
): void {
    event.getLocation(this.pointer);
    this.windowId = event.windowId ?? 0;
    this.hasPointer = true;
}
```

Mouse Move 中禁止：

```text
pick
show
hide
layout
```

只做采样。

---

# 9. 每帧 Central Picking

在：

```ts
lateUpdate()
```

执行：

```ts
lateUpdate(): void {
    this.resolveHoveredTarget();
    this.updatePanelPosition();
}
```

这样鼠标即使不移动，只要对象、Camera 或 MapRoot 在动，Hover 状态仍然会变化。

---

# 10. pickTarget()

```ts
private pickTarget():
    HoverInfoSource | null {

    if (!this.hasPointer) {
        return null;
    }

    let best:
        HoverInfoSource | null = null;

    let bestPriority =
        Number.NEGATIVE_INFINITY;

    for (
        const source
        of this.targets.values()
    ) {
        const anchor = source.anchor;

        if (
            !anchor.isValid
            || !anchor.activeInHierarchy
        ) {
            continue;
        }

        if (
            source.scope === HoverTargetScope.World
            && !this.worldHoverEnabled()
        ) {
            continue;
        }

        const transform =
            anchor.getComponent(UITransform);

        if (!transform) {
            continue;
        }

        if (
            !transform.hitTest(
                this.pointer,
                this.windowId,
            )
        ) {
            continue;
        }

        const priority =
            this.getPriority(source);

        if (priority > bestPriority) {
            best = source;
            bestPriority = priority;
        }
    }

    return best;
}
```

核心思想：

```text
每帧只问：
“现在鼠标下面是谁？”
```

不再关心：

```text
鼠标刚刚从谁进入谁
```

---

# 11. Priority

第一版：

```text
UI
>
Monster
>
Building
>
Resource
>
Base
```

建议：

```ts
private getPriority(
    source: HoverInfoSource,
): number {
    if (
        source.scope === HoverTargetScope.UI
    ) {
        return 1000;
    }

    switch (source.kind) {
    case HoverTargetKind.Monster:
        return 300;

    case HoverTargetKind.Building:
        return 200;

    case HoverTargetKind.Resource:
        return 100;

    case HoverTargetKind.Base:
        return 90;

    default:
        return 0;
    }
}
```

如果 Monster 站在 Resource 上：

```text
Monster Tooltip
```

稳定优先。

---

# 12. resolveHoveredTarget()

```ts
private resolveHoveredTarget(): void {
    const next = this.pickTarget();

    if (
        next?.anchor
        === this.hovered?.anchor
    ) {
        return;
    }

    const previous = this.hovered;
    this.hovered = next;

    if (next) {
        this.onHoverChanged(
            previous,
            next,
        );
    } else {
        this.beginHide();
    }
}
```

---

# 13. Hover 切换体验

推荐成熟策略游戏手感：

```text
No Tooltip
→ Hover A
→ 等 0.08s
→ Show A
```

但：

```text
Tooltip A 已经显示
→ Hover B
→ 立即切 B
```

不要 A → B 每次重新等 80ms。

这样快速扫：

```text
建筑
资源
怪物
Blueprint
Squad
```

时会更自然。

---

# 14. beginShow()

```ts
private beginShow(
    source: HoverInfoSource,
): void {
    const alreadyVisible =
        this.panel?.isVisible() ?? false;

    this.current = source;
    this.signature = '';
    this.refreshTimer = 0;
    this.hideTimer = -1;

    if (alreadyVisible) {
        this.showTimer = 0;
        this.refreshContent();
        this.panel?.setVisible(true);
        return;
    }

    this.showTimer =
        HOVER_SHOW_DELAY_SECONDS;
}
```

---

# 15. beginHide()

```ts
private beginHide(): void {
    if (!this.current) {
        return;
    }

    this.hideTimer =
        HOVER_HIDE_DELAY_SECONDS;
}
```

如果 hide delay 中重新 Hover 新目标：

```text
取消 hide
→ 切新目标
```

---

# 16. update(dt) 只管理时序与内容

```ts
update(dt: number): void {
    if (
        this.current?.scope
            === HoverTargetScope.World
        && !this.worldHoverEnabled()
    ) {
        this.hideImmediately();
        return;
    }

    if (this.hideTimer >= 0) {
        this.hideTimer -= dt;

        if (
            this.hideTimer <= 0
            && !this.hovered
        ) {
            this.hideImmediately();
        }
    }

    if (
        this.current
        && !this.panel?.isVisible()
    ) {
        this.showTimer -= dt;

        if (this.showTimer <= 0) {
            this.refreshContent();
            this.panel?.setVisible(true);
        }
    }

    if (
        this.current
        && this.panel?.isVisible()
    ) {
        this.refreshTimer -= dt;

        if (this.refreshTimer <= 0) {
            this.refreshContent();
        }
    }
}
```

---

# 17. 删除旧 containment 判定

删除 V1 中：

```ts
if (
    this.hasPointer
    && !anchorTransform.hitTest(
        this.pointer,
        this.windowId,
    )
) {
    this.hideImmediately();
}
```

原因：

```text
pickTarget()
```

已经统一负责“鼠标是否在目标上”。

不能再保留第二套判断。

---

# 18. Panel Position 仍锚定 current

位置使用：

```text
current.anchor
```

而不是：

```text
hovered.anchor
```

因为 Hide Delay 期间：

```text
hovered = null
current = A
```

Tooltip 可以短暂留在 A。

```ts
private updatePanelPosition(): void {
    const source = this.current;
    const panel = this.panel;

    if (
        !source
        || !panel?.isVisible()
    ) {
        return;
    }

    if (
        !source.anchor.isValid
        || !source.anchor.activeInHierarchy
    ) {
        this.hideImmediately();
        return;
    }

    const anchorTransform =
        source.anchor.getComponent(UITransform);

    if (
        !anchorTransform
        || !this.hudTransform
    ) {
        this.hideImmediately();
        return;
    }

    const anchorRect =
        anchorTransform.getBoundingBoxToWorld();

    const hudRect =
        this.hudTransform
            .getBoundingBoxToWorld();

    const size = panel.getSize();

    const result =
        resolveHoverPlacement(
            anchorRect,
            size.width,
            size.height,
            source.preferredPlacement,
            hudRect,
            HOVER_ANCHOR_GAP,
            HOVER_SAFE_MARGIN,
        );

    panel.setWorldPosition(
        result.worldX,
        result.worldY,
    );
}
```

---

# 19. Dynamic Info 是 Live Provider

注册：

```ts
getInfo: () => ({
    title: 'Blue Slime',
    rows: [
        {
            label: 'HP',
            value:
                `${health.getCurrentHealth()}/${health.getMaxHealth()}`,
        },
        {
            label: 'ATK',
            value:
                String(stats.getAttackDamage()),
        },
    ],
})
```

不是：

```text
注册时复制 HP=80
```

所以：

```text
HP 变化
Attack Modifier 变化
Squad 人数变化
Resource 剩余变化
```

都不需要重新注册。

---

# 20. Content Refresh

继续：

```text
HOVER_CONTENT_REFRESH_SECONDS = 0.1
```

即：

```text
10Hz
```

适合动态状态。

不要 60fps 重建 Label / Layout。

---

# 21. Build Mode

继续保留：

```ts
hoverInfo.setWorldHoverEnabledPredicate(
    () => !buildToolController.isActive(),
);
```

`pickTarget()` 中：

```text
World scope
+
predicate false
→ skip
```

UI scope 仍正常。

---

# 22. 对象移动 Regression

鼠标完全不动。

Monster：

```text
Frame 1
在鼠标左边
→ no hover

Frame 20
走到鼠标下
→ hover

Frame 40
走开
→ hide
```

整个过程中没有：

```text
MOUSE_MOVE
```

也必须正确。

---

# 23. Camera Pan Regression

鼠标固定。

```text
按 D
→ MapRoot 平移
```

目标依次经过鼠标：

```text
Resource
→ none
→ Monster
→ Building
```

Central Picking 每帧重新 hit test，Tooltip 必须跟着正确切换。

---

# 24. Zoom Regression

鼠标固定。

```text
Zoom In
→ Building 屏幕范围扩大覆盖 pointer
→ Hover 出现
```

```text
Zoom Out
→ Building 缩离 pointer
→ Hover 消失
```

不需要任何重新注册。

---

# 25. 生命周期

`HoverInfoTarget.onDisable/onDestroy`：

```text
unregister(node)
```

Controller：

```text
targets.delete(node)
```

如果删除的是：

```text
hovered
current
```

同步清理。

所以：

```text
Monster death
Resource depletion
Blueprint card rebuild
Building removal
```

不会留下悬空 Tooltip。

---

# 26. UI / World 全部统一

以下全部继续通过：

```ts
HoverInfoTarget.setup(...)
```

注册：

```text
BuildingBlueprintCardView
SquadRosterItemView
BuildingRenderer
WorldObjectRenderer
MonsterGroupRenderer
```

不要：

```text
UI 用 MOUSE_ENTER
World 用 Central Picking
```

否则以后还是两套逻辑。

---

# 27. 性能边界

当前预计 Target：

```text
4~10 Blueprint
2~6 Squad
几十 Resource
几十 Building
几十 Monster
```

每帧遍历约：

```text
50~150
```

个 `UITransform.hitTest()` 完全可以接受。

先不要做：

```text
Spatial Hash
QuadTree
Screen Grid
Broad Phase
```

只有未来 Hover Target 达到：

```text
500~1000+
```

且 profile 证明有瓶颈时再优化。

---

# 28. Debug Instrumentation

实现期间临时加入：

```ts
private debugLastAnchorName = '';

private debugPick(
    next: HoverInfoSource | null,
): void {
    const name =
        next?.anchor.name ?? '<none>';

    if (
        name === this.debugLastAnchorName
    ) {
        return;
    }

    this.debugLastAnchorName = name;

    console.log(
        `[Hover] pick=${name}`,
    );
}
```

只在目标变化时 log。

验收后删除。

---

# 29. currentToken

如果当前 `HoverInfoController` 仍保留：

```ts
currentToken
```

但 show/hide 没有：

```text
setTimeout
scheduleOnce
Promise callback
```

则删除。

当前 timer 通过：

```text
update(dt)
```

推进，不需要 stale async token。

---

# 30. 文件修改范围

核心修改：

```text
assets/scripts/ui/hover/HoverInfoTarget.ts
assets/scripts/ui/hover/HoverInfoController.ts
```

原则上不动：

```text
HoverInfoPanelView.ts
HoverPlacementResolver.ts
HoverInfoUiConfig.ts
```

业务接入：

```text
BuildingBlueprintCardView
SquadRosterItemView
BuildingRenderer
WorldObjectRenderer
MonsterGroupRenderer
```

不需要改变调用方式，只继续 `setup()`。

---

# 31. Acceptance Checklist

## Basic

- [ ] 初始鼠标停在哪个目标上都可显示。
- [ ] A → B 跨大距离仍能显示 B。
- [ ] A → 空地 → C 正常。
- [ ] 同一对象反复 Hover 无限次正常。
- [ ] 不存在“第一次正常，之后失效”。

## UI

- [ ] Blueprint Card 正常。
- [ ] Squad Card 正常。
- [ ] 左侧 Squad 直接跨到右侧 World Object 正常。
- [ ] 底部 Blueprint 直接跨到地图目标正常。

## World

- [ ] Resource 正常。
- [ ] Building 正常。
- [ ] Monster 正常。
- [ ] 重叠时 Priority 稳定。

## Movement

- [ ] Monster 走进静止鼠标下自动 Hover。
- [ ] Monster 走开自动 Hide。
- [ ] Camera Pan 可让对象进入/离开 Hover。
- [ ] Zoom In/Out 正确改变 Hover。

## Lifecycle

- [ ] Monster death 自动 unregister。
- [ ] Resource depleted 自动 unregister。
- [ ] Blueprint Card rebuild 不留下旧 Target。
- [ ] Node disable 后不参与 picking。

## Performance

- [ ] 100 Target 无明显帧率问题。
- [ ] `getInfo()` 不以 60Hz 调用。
- [ ] Panel Layout 不以 60Hz 重建。

---

# 32. 明确禁止

```text
1. 继续使用 MOUSE_ENTER / MOUSE_LEAVE。
2. 注册 screen/world Rect 快照。
3. 对象移动后重新 register。
4. Camera Pan 后更新注册坐标。
5. pickTarget 后再做第二套 current-anchor containment。
6. UI / World 使用两套 Hover 判定。
7. 每 frame 重建 Tooltip 内容。
8. 每对象创建独立 Tooltip Panel。
9. 用鼠标事件顺序作为 Hover Truth。
10. 用 current 同时表示 hovered 和 displayed target。
```

---

# 33. 最终结构

```text
                  REGISTERED TARGETS
                         │
                         ▼
                 latest pointer
                         │
                         ▼
                    pickTarget()
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
         hovered                  priority
    鼠标实际所在目标              arbitration
             │
             ▼
      hover transition
             │
       ┌─────┴─────┐
       ▼           ▼
     show         hide
       │           │
       └─────┬─────┘
             ▼
          current
      Tooltip展示对象
             │
     ┌───────┴────────┐
     ▼                ▼
getInfo()       current anchor transform
 10Hz                60Hz
     │                │
     ▼                ▼
Content          Placement
     └───────┬────────┘
             ▼
      HoverInfoPanelView
```

---

# 34. 一句话实现原则

> **注册“对象”，每帧查询“对象现在在哪里”；永远不要注册“对象当时在哪里”。**

这保证 Hover 系统天然适配：

```text
Moving Actors
Camera Pan
MapRoot Zoom
Dynamic UI
Object Destruction
```

并且彻底摆脱 `MOUSE_ENTER / MOUSE_LEAVE` 状态不同步问题。
