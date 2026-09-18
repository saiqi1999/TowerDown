# TowerDown Hover Scope HitTest Patch V2.1

> 目标：修复 Central Picking 已经能正确 Hover 地图对象，但底部 Blueprint UI 与左侧 Squad UI 无法 Hover 的问题。  
> 原因：地图对象位于 `MapRoot` 分支，而 HUD UI 位于 `HUDRoot` 分支。两类对象不应强行共用同一套坐标转换。  
> 本 Patch 不改变 Central Picking 架构，只根据 `HoverTargetScope` 选择正确的命中方式。

---

# 1. 当前场景关系

```text
Canvas
├ Camera
├ MapRoot
│ ├ WorldObjectRoot
│ ├ ActorRoot
│ └ ...
│
└ HUDRoot
   ├ BlueprintCardStrip
   ├ SquadRosterRoot
   └ HoverInfoLayer
```

因此：

```text
World Target
→ 受 MapRoot Pan / Zoom / Scale 影响

UI Target
→ 固定在 HUDRoot
→ 不受 MapRoot Transform 影响
```

不能把 HUD UI 移进 `MapRoot` 来解决 Hover。

---

# 2. Patch 原则

仍然只有一个：

```text
HoverInfoController
```

仍然只有一个：

```text
pickTarget()
hovered
current
Tooltip Panel
```

只把底层：

```text
isPointerInside(source)
```

改成按 `scope` 分流。

---

# 3. 最终 HitTest 路径

```text
                         Mouse Screen Position
                                  │
                                  ▼
                         HoverInfoController
                                  │
                                  ▼
                              pickTarget()
                           ┌───────┴───────┐
                           ▼               ▼
                    scope = UI        scope = World
                           │               │
                           ▼               ▼
                 UITransform.hitTest   Camera.screenToWorld
                   (screen point)            │
                                             ▼
                                   Target.convertToNodeSpaceAR
                                             │
                                             ▼
                                      local rect test
```

---

# 4. UI Target

用于：

```text
Blueprint Card
Squad Card
未来其它 HUD UI
```

UI Target 直接使用：

```ts
UITransform.hitTest(
    pointerScreen,
    windowId,
)
```

不要：

```text
screenToWorld
MapRoot local
world rect conversion
```

推荐：

```ts
private hitTestUi(
    source: HoverInfoSource,
): boolean {
    const transform =
        source.anchor.getComponent(UITransform);

    if (!transform) {
        return false;
    }

    return transform.hitTest(
        this.pointerScreen,
        this.windowId,
    );
}
```

---

# 5. World Target

用于：

```text
Building
Resource
Monster
Base
```

World Target 不依赖 `UITransform.hitTest()` 自动寻找 Camera。

使用当前 MainMapController 已经解析出的唯一游戏 Camera：

```text
Screen
↓
Camera.screenToWorld
↓
Target Local Space
↓
Local Rect Contains
```

推荐：

```ts
private hitTestWorld(
    source: HoverInfoSource,
): boolean {
    const transform =
        source.anchor.getComponent(UITransform);

    if (!transform || !this.camera) {
        return false;
    }

    this.pointerWorld.set(
        this.pointerScreen.x,
        this.pointerScreen.y,
        0,
    );

    this.camera.screenToWorld(
        this.pointerWorld,
        this.pointerWorld,
    );

    transform.convertToNodeSpaceAR(
        this.pointerWorld,
        this.pointerLocal,
    );

    const size = transform.contentSize;
    const anchor = transform.anchorPoint;

    const minX = -anchor.x * size.width;
    const maxX = (1 - anchor.x) * size.width;
    const minY = -anchor.y * size.height;
    const maxY = (1 - anchor.y) * size.height;

    return (
        this.pointerLocal.x >= minX
        && this.pointerLocal.x <= maxX
        && this.pointerLocal.y >= minY
        && this.pointerLocal.y <= maxY
    );
}
```

---

# 6. Controller 增加 Camera 依赖

`HoverInfoController.setup()` 改成：

```ts
public setup(
    panel: HoverInfoPanelView,
    hudTransform: UITransform,
    camera: Camera,
): void {
    this.panel = panel;
    this.hudTransform = hudTransform;
    this.camera = camera;

    input.on(
        Input.EventType.MOUSE_MOVE,
        this.onMouseMove,
        this,
    );
}
```

新增字段：

```ts
private camera: Camera | null = null;

private readonly pointerScreen = new Vec2();
private readonly pointerWorld = new Vec3();
private readonly pointerLocal = new Vec3();

private windowId = 0;
private hasPointer = false;
```

---

# 7. Pointer Sampling

MouseMove 只采样：

```ts
private onMouseMove(
    event: EventMouse,
): void {
    event.getLocation(
        this.pointerScreen,
    );

    this.windowId =
        event.windowId ?? 0;

    this.hasPointer = true;
}
```

不要在 MouseMove 中：

```text
show
hide
pick
layout
```

Picking 仍然由 `lateUpdate()` 完成。

---

# 8. 统一 Scope Dispatcher

新增：

```ts
private isPointerInside(
    source: HoverInfoSource,
): boolean {
    return source.scope
        === HoverTargetScope.UI
        ? this.hitTestUi(source)
        : this.hitTestWorld(source);
}
```

然后 `pickTarget()` 中原本：

```ts
transform.hitTest(...)
```

替换为：

```ts
if (!this.isPointerInside(source)) {
    continue;
}
```

---

# 9. pickTarget() 其它逻辑不动

保留：

```text
active / valid 检查
Build Mode 下跳过 World
Priority
hovered / current 状态机
show / hide delay
content refresh
placement
```

Priority 继续：

```text
UI       1000
Monster   300
Building  200
Resource  100
Base       90
```

---

# 10. MainMapController

当前已经解析出：

```ts
const camera = ...
```

所以只改：

```ts
hoverInfo.setup(
    hoverPanel,
    hudTransform,
    camera,
);
```

不要重新：

```text
scene.getComponentInChildren(Camera)
```

不要让 HoverInfoController 自己寻找 Camera。

---

# 11. 不修改 HoverInfoTarget

`HoverInfoTarget` 继续只负责：

```text
register
unregister
```

不要重新加入：

```text
MOUSE_ENTER
MOUSE_LEAVE
```

---

# 12. 为什么这样能 Cover Camera / Zoom

World Target 注册的是：

```text
Node reference
```

每帧：

```text
Camera.screenToWorld(pointer)
↓
Node 当前 world transform
↓
convertToNodeSpaceAR()
```

所以：

```text
Monster 移动
✓

MapRoot Pan
✓

MapRoot Zoom
✓

父节点 Scale
✓
```

都自然生效。

HUD UI 则固定在：

```text
HUDRoot
```

直接使用 Screen-space `hitTest()`，不会被 MapRoot Transform 污染。

---

# 13. 文件修改范围

只需要改：

```text
assets/scripts/ui/hover/HoverInfoController.ts
assets/scripts/map/MainMapController.ts
```

原则上不改：

```text
HoverInfoTarget.ts
HoverInfoTypes.ts
HoverInfoPanelView.ts
HoverPlacementResolver.ts
BuildingBlueprintCardView.ts
SquadRosterItemView.ts
BuildingRenderer.ts
WorldObjectRenderer.ts
MonsterGroupRenderer.ts
```

---

# 14. 临时 Debug

如果 Patch 后 UI 仍失败，只加这个：

```ts
if (
    source.scope === HoverTargetScope.UI
) {
    const hit =
        this.hitTestUi(source);

    console.log(
        '[Hover UI]',
        source.anchor.name,
        'pointer=',
        this.pointerScreen,
        'hit=',
        hit,
    );
}
```

如果：

```text
hit = true
```

但 Tooltip 不显示：

```text
问题在 hovered → current → panel
```

如果：

```text
hit = false
```

则继续打印：

```text
anchor world bounds
contentSize
anchorPoint
layer
windowId
```

不要再继续猜状态机。

---

# 15. Acceptance Test

```text
Bottom Blueprint
→ Hover 正常
→ Tooltip 默认向上

Left Squad
→ Hover 正常
→ Tooltip 默认向右

Map Resource
→ Hover 正常

Map Building
→ Hover 正常

Monster
→ Hover 正常
```

跨区域：

```text
Blueprint
→ Map Object
→ Squad
→ Map Object

全部连续正常
```

Camera：

```text
鼠标静止
Map Pan
→ World Hover 正确变化

Zoom In / Out
→ World Hover 正确变化

HUD Hover
→ 不受 Map Pan / Zoom 影响
```

Build Mode：

```text
World Hover disabled
UI Hover still works
```

---

# 16. 明确禁止

```text
1. 把 HUDRoot 移到 MapRoot。
2. UI Target 先 screenToWorld 再 hitTest。
3. World Target 重新依赖 MOUSE_ENTER / LEAVE。
4. 为 UI 和 World 创建两套 HoverController。
5. 对象移动后重新 register。
6. Camera / Zoom 时手动刷新注册坐标。
```

---

# 17. 最终原则

> **同一个 Hover 状态机，不同 Transform Branch 使用各自正确的坐标转换。**

即：

```text
UI:
Screen → UITransform.hitTest

World:
Screen → Camera World → Target Local Rect
```

这是本 Patch 唯一需要解决的问题。
