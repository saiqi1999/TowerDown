# TowerDown 统一 Hover Info UI 技术方案 V1

> Repo: `saiqi1999/TowerDown`
> Base: `main @ 0d0a06988f6c42ec3c380ef77d0b760cea895eb4` (`hover prep`)
> Engine: Cocos Creator 3.8.8
>
> 目标：为底部建筑蓝图 UI、左侧 Squad UI、地图建筑、地图资源、地图怪物提供统一 Hover 信息层。所有目标共享一个 Tooltip Panel，内容由目标数据动态生成，位置以目标节点为 Anchor 自动计算，并在屏幕边缘自动 Flip / Shift。
>
> 最新素材：`assets/art/ui/hover_background.png`，316×60。背景必须使用程序化 9-slice 拉伸，不允许直接 Simple Stretch。

---

# 1. 最终 UX 规则

## 1.1 Hover 来源与默认方向

```text
底部 Blueprint Card
→ 默认向上

左侧 Squad Card
→ 默认向右

地图 Building / Resource / Monster
→ 默认向右
→ 如果右侧空间不足，翻到左侧
```

所有 Tooltip 最后都必须：

```text
保持在 1280×720 HUD Safe Rect 内
```

如果在首选方向放置后只有横向/纵向轻微越界：

```text
Shift 回屏幕
```

如果主方向明显放不下：

```text
Flip 到相反方向
```

---

# 2. 成熟定位模型

采用成熟 Floating UI / Popper 类 Tooltip 的三阶段思路：

```text
Offset
→ Flip
→ Shift
```

TowerDown 自己实现轻量版本，不引入 Web 库。

```text
Offset
目标与 Tooltip 保持固定间距

Flip
首选方向放不下时换到相反方向

Shift
保持方向不变的前提下沿副轴挪回屏幕
```

例如地图物品：

```text
preferred = Right

Right 能放
→ Right

Right 越出右边界
→ Left

Left 仍有一点纵向越界
→ 保持 Left，但上下 Shift
```

---

# 3. 不让 Tooltip 跟随鼠标

Tooltip 应该 Anchor 到目标节点的 Bounding Box：

```text
Blueprint Card
→ Card bounds

Squad Card
→ Card bounds

Building
→ Building visual bounds

Resource
→ Resource visual bounds

Monster
→ Monster visual bounds
```

禁止：

```text
Tooltip 跟 cursor position 跑
```

理由：

```text
1. 更稳定
2. 不遮挡鼠标正在看的对象
3. Camera Pan / Zoom 后仍然可以基于 anchor 重算
4. UI Card 与 World Object 使用同一算法
```

---

# 4. Scene / Runtime Tree

在 `HUDRoot` 下新增：

```text
HUDRoot
├ ResourceHud
├ BlueprintCardStrip
├ SquadRosterRoot
└ HoverInfoLayer
   └ HoverInfoPanel
      ├ Background
      ├ Title
      ├ Subtitle
      ├ RowsRoot
      └ Footer
```

`HoverInfoLayer`：

```text
size = 1280×720
position = (0,0)
```

必须在 HUD 的 sibling order 最上层。

但它不能：

```text
BlockInputEvents
Button
```

Tooltip 只负责显示，不接管输入。

---

# 5. 只创建一个 Panel

禁止给：

```text
每张 Card
每栋建筑
每个 Resource
每个 Monster
```

分别创建一套 Tooltip Node。

整个场景只存在：

```text
1 × HoverInfoController
1 × HoverInfoPanelView
```

所有目标只是注册：

```text
Anchor
Placement Preference
Info Provider
```

这样：

```text
UI 风格统一
状态唯一
避免大量 Node
以后调整字体/背景只改一处
```

---

# 6. 新增文件

```text
assets/scripts/ui/hover/
├ HoverInfoTypes.ts
├ HoverInfoController.ts
├ HoverInfoPanelView.ts
├ HoverInfoTarget.ts
├ HoverPlacementResolver.ts
├ HoverInfoUiConfig.ts
└ HoverInfoAssetLoader.ts
```

---

# 7. HoverInfoTypes

```ts
export enum HoverPlacement {
    Top = 'top',
    Right = 'right',
    Left = 'left',
    Bottom = 'bottom',
}

export enum HoverTargetKind {
    Blueprint = 'blueprint',
    Squad = 'squad',
    Building = 'building',
    Resource = 'resource',
    Monster = 'monster',
    Base = 'base',
}

export interface HoverInfoRow {
    readonly label?: string;
    readonly value: string;
}

export interface HoverInfoModel {
    readonly title: string;
    readonly subtitle?: string;
    readonly rows?: readonly HoverInfoRow[];
    readonly footer?: string;
}

export interface HoverInfoTargetConfig {
    readonly kind: HoverTargetKind;
    readonly preferredPlacement: HoverPlacement;
    readonly controller: HoverInfoController;
    readonly getInfo: () => HoverInfoModel;
}
```

第一版内容全部 text-based。

不要在 V1 同时做：

```text
图标排版
RichText markup
复杂颜色标签
可点击 Tooltip
```

后续可以扩展。

---

# 8. HoverInfoTarget

这是挂到任何 Hoverable Node 上的通用组件。

职责：

```text
MOUSE_ENTER
→ controller.enter(...)

MOUSE_LEAVE
→ controller.leave(...)

onDestroy
→ controller.release(...)
```

接口：

```ts
@ccclass('HoverInfoTarget')
export class HoverInfoTarget extends Component {
    public setup(
        config: HoverInfoTargetConfig,
    ): void;
}
```

监听：

```ts
this.node.on(
    Node.EventType.MOUSE_ENTER,
    this.onMouseEnter,
    this,
);

this.node.on(
    Node.EventType.MOUSE_LEAVE,
    this.onMouseLeave,
    this,
);
```

所有目标节点必须有：

```text
UITransform
```

当前以下对象已经满足：

```text
BuildingBlueprintCardView
SquadRosterItemView
WorldObjectRenderer-created Resource/Base
BuildingRenderer-created Building
MonsterGroupRenderer-created Monster
```

---

# 9. HoverInfoController

唯一拥有：

```text
当前 Hover Source
当前 Anchor Node
当前 Placement Preference
当前 Info Provider
Panel 可见状态
Show/Hide delay
```

核心状态：

```ts
private currentAnchor: Node | null = null;
private currentProvider: (() => HoverInfoModel) | null = null;
private currentPlacement = HoverPlacement.Right;
private currentToken = 0;
```

使用 token 防止快速跨目标时：

```text
A leave
B enter
A 的延迟 hide 又把 B tooltip 隐藏
```

---

# 10. Hover Delay

第一版建议：

```text
show delay = 0.08s
hide delay = 0.03s
```

目的：

```text
鼠标快速掠过大量建筑时
不要疯狂闪 Tooltip
```

这些值放：

```text
HoverInfoUiConfig.ts
```

以后直接调参。

---

# 11. Panel Anchor Auto Update

Tooltip 可见时：

```ts
lateUpdate()
```

每帧重新计算：

```text
Anchor Bounding Box
↓
Panel Placement
↓
Panel Position
```

这样：

```text
Monster 移动
MapRoot Pan
MapRoot Zoom
Squad/UI 状态移动
```

Tooltip 都继续贴着 Anchor。

内容不需要每帧重建。

---

# 12. Dynamic Content Refresh

地图怪物 / Resource / Squad 的信息可能变化：

```text
HP
成员数量
Attack
Target
```

因此 Panel 显示期间每：

```text
0.10s
```

重新调用：

```ts
getInfo()
```

如果 Model 内容没变化：

```text
不重新 Layout
```

可以使用简单 string signature：

```text
JSON/string concat
```

避免 60fps 重排文字。

---

# 13. Anchor 失效保护

Tooltip 显示时：

```text
Resource 被采完
Monster 死亡
Building 被移除
```

Controller 每帧检查：

```ts
if (
    !anchor.isValid
    || !anchor.activeInHierarchy
) {
    hideImmediately();
}
```

不能留下悬空 Tooltip。

---

# 14. Positioning Resolver

新增：

```text
HoverPlacementResolver.ts
```

输入：

```ts
anchorWorldRect
panelWidth
panelHeight
preferredPlacement
hudWorldRect
gap
safeMargin
```

输出：

```ts
{
    placement: HoverPlacement;
    worldX: number;
    worldY: number;
}
```

---

# 15. Placement Algorithm

## Top

```text
x = anchor.centerX
y = anchor.top + gap + panelHeight/2
```

如果上方放不下：

```text
fallback = Bottom
```

然后横向 Shift。

---

## Right

```text
x = anchor.right + gap + panelWidth/2
y = anchor.centerY
```

如果：

```text
panelRight > safeRight
```

则：

```text
Flip Left
```

最后纵向 Shift。

---

## Left

Right 的镜像。

---

# 16. Safe Rect

基于当前设计分辨率：

```text
1280×720
```

建议：

```text
HOVER_SAFE_MARGIN = 12
HOVER_ANCHOR_GAP = 8
```

所以：

```text
safe left   = -640 + 12
safe right  =  640 - 12
safe bottom = -360 + 12
safe top    =  360 - 12
```

不要让 Tooltip 紧贴屏幕边缘。

---

# 17. hover_background.png 程序拉伸

当前资源：

```text
316 × 60
```

当前 SpriteFrame meta：

```text
borderLeft   = 0
borderRight  = 0
borderTop    = 0
borderBottom = 0
```

所以直接：

```text
Sprite.Type.SLICED
```

还不够。

必须程序设置 9-slice inset。

---

# 18. 9-Slice 方案

`HoverInfoAssetLoader` load：

```text
hover_background SpriteFrame
```

专用于 Hover Panel。

初始化时：

```ts
frame.insetLeft = HOVER_BG_INSET_LEFT;
frame.insetRight = HOVER_BG_INSET_RIGHT;
frame.insetTop = HOVER_BG_INSET_TOP;
frame.insetBottom = HOVER_BG_INSET_BOTTOM;
frame.calculateSlicedUV();
```

Panel Sprite：

```ts
sprite.spriteFrame = frame;
sprite.type = Sprite.Type.SLICED;
sprite.sizeMode = Sprite.SizeMode.CUSTOM;
```

不要：

```text
Simple Sprite 直接整体拉长
```

否则边框 / 角落都会变形。

---

# 19. 初始 Insets

第一版放在 config：

```ts
export const HOVER_BG_INSET_LEFT = 8;
export const HOVER_BG_INSET_RIGHT = 8;
export const HOVER_BG_INSET_TOP = 8;
export const HOVER_BG_INSET_BOTTOM = 8;
```

这是纯美术调参。

如果实机发现：

```text
装饰边框厚度 > 8px
```

只改四个常量，例如：

```text
10 / 10 / 10 / 10
```

或：

```text
12 / 12 / 8 / 8
```

不要修改 Panel 架构。

---

# 20. Panel Size

由于原图本身已经：

```text
316px wide
```

第一版建议保留固定宽度：

```text
HOVER_PANEL_WIDTH = 316
```

动态高度：

```text
height =
max(
    60,
    paddingTop
    + titleHeight
    + subtitleHeight
    + rowsHeight
    + footerHeight
    + paddingBottom
)
```

所以背景主要做：

```text
Vertical 9-slice Stretch
```

这比每个 Tooltip 宽度乱跳更稳定。

---

# 21. Panel Typography

建议第一版：

```text
Panel Width = 316
Horizontal Padding = 16
Vertical Padding = 10

Title:
font 18
lineHeight 22

Subtitle:
font 13
lineHeight 18

Rows:
font 13
lineHeight 18

Footer:
font 12
lineHeight 16
```

内容最大高度不做 Scroll。

如果某个对象信息多到需要 Scroll：

```text
它已经不是 Tooltip
应该打开 Detail Panel
```

---

# 22. Blueprint Card Hover

当前入口：

```text
BuildingBlueprintCardView
```

setup 时创建：

```text
HoverInfoTarget
```

配置：

```text
kind = Blueprint
preferred = Top
```

内容：

```text
Blacksmith
Economy / 后续可改 Sink

成本
木 5 / 石 10 / 金 5

占地
2×2

效果
+1 ATK
```

即使：

```text
Card 不可购买
```

Hover 仍必须可用。

不要因为：

```ts
button.interactable = false
```

就让玩家无法查看为什么买不起。

因此 HoverTarget 必须独立于 Button interactable。

---

# 23. Squad Card Hover

入口：

```text
SquadRosterItemView
```

preferred：

```text
Right
```

Info Provider 不应该只拿静态 SquadSpawnData。

`SquadRosterController` 创建 item 时同时传：

```text
SquadSpawnData
SquadRuntimeHandle
```

动态展示：

```text
Squad 1

成员
4 / 4

攻击
5

当前任务
采集 Wood / Combat / Return Home / Idle
```

第一版如果 Brain 没有公开可读 state：

```text
增加最小 query API
```

例如：

```ts
public getState(): SquadBrainState;
```

不要让 UI 读 private 字段。

---

# 24. Placed Building Hover

当前 `BuildingRenderer.create()` 只是：

```text
Node
UITransform
Sprite
```

创建 Node 后追加：

```text
HoverInfoTarget
```

preferred：

```text
Right
```

Provider capture：

```text
BuildingInstanceData
BuildingDefinition
```

展示：

```text
Blacksmith

效果
+1 ATK

占地
2×2
```

未来 Source/Sink/Defense、生产状态等加入 Definition 后自然扩展。

不要创建新的：

```text
BuildingHoverComponent per building type
```

---

# 25. Resource Hover

当前 `WorldObjectRenderer` 已经掌握：

```text
WorldObjectData
ResourceType
HealthComponent
ResourceRuntimeDefinition
```

因此在 Resource Node 创建完 Health 后追加 HoverTarget。

preferred：

```text
Right
```

显示：

```text
Wood

剩余资源
56 / 80

采集效率
1 resource / damage
```

对于玩家：

```text
不要显示 “HP 56/80”
```

Resource 的 Health 本质是可采集量。

UI 应翻译为：

```text
剩余资源
```

---

# 26. Base Hover

虽然当前 Base 不是 Resource，仍建议统一支持：

```text
Base

文明核心
基地被摧毁则 Run 失败（未来）
```

当前如果没有 Base Health：

```text
不要伪造 HP
```

以后 Infection 系统接入 Health 后 Provider 自然增加。

---

# 27. Monster Hover

`MonsterGroupRenderer` 创建每个 Monster 时已经拥有：

```text
member.type
HealthComponent
CombatStats
```

所以追加：

```text
HoverInfoTarget
```

preferred：

```text
Right
```

例如：

```text
Blue Slime

HP
64 / 80

ATK
4
```

Provider 每 0.1s 重读：

```text
Health
CombatStats
```

所以 Blacksmith 不会影响 Monster，而其它未来 monster modifier 可以正常显示。

---

# 28. World Object Hover 与 Build Mode

最终规则：

```text
Build Mode active
→ World Hover Tooltip suppressed

底部 Blueprint UI Hover
→ 仍可用

左侧 Squad UI Hover
→ 仍可用
```

理由：

Building Ghost 已经是 World Preview。

如果此时地图同时不断弹：

```text
Resource Tooltip
Monster Tooltip
Building Tooltip
```

会产生严重视觉竞争。

所以 HoverInfoTarget 增加：

```text
scope = UI / World
```

Controller 或 MainMap 注入：

```text
worldHoverEnabledPredicate
```

例如：

```ts
() => !buildToolController.isActive()
```

不要让每个 Target import BuildToolController。

---

# 29. Camera / Moving Anchor

地图 Tooltip 不能在 Show 时只算一次位置。

因为：

```text
Monster 会移动
MapRoot 会 Pan
MapRoot 会 Zoom
```

所以：

```text
lateUpdate
→ getBoundingBoxToWorld()
→ Resolve Placement
→ Panel setPosition()
```

每帧只做位置计算。

Content refresh 单独 10Hz。

---

# 30. Mouse Enter / Leave 与 Camera Movement

Node Hover Event 负责：

```text
正常 mouse enter / leave
```

Controller 额外记录最近的 Pointer Screen Position。

Tooltip 可见期间，如果 Anchor 因：

```text
Camera Pan
Monster Movement
```

移动到鼠标之外，而引擎没有产生 `MOUSE_LEAVE`，

Controller 可以用：

```text
latest pointer
+
anchor current bounds
```

做一次 containment check。

如果已经不再 hover：

```text
hide
```

第一版至少实现：

```text
避免“Camera 把对象移走，但 Tooltip 还一直跟对象跑”的错误。
```

不强求：

```text
静止鼠标时新对象被 Camera 移到鼠标下自动弹出
```

玩家轻微移动鼠标后正常进入即可。

---

# 31. Hover 优先级

发生目标重叠时：

```text
HUD UI
>
Monster
>
Placed Building
>
Resource / Base
```

不过第一版主要依赖 Cocos 当前 Node Hit Test / render order。

Controller 只允许：

```text
一个 current hover
```

后续真的出现严重 world overlap 再实现显式 priority arbitration。

不要 V1 就做复杂 raycast registry。

---

# 32. MainMapController Composition

推荐 bootstrap 顺序：

```text
HUDRoot
↓
HoverInfoLayer
↓
load HoverInfoAssets
↓
create HoverInfoController
↓
create PanelView
↓
inject Controller into:
    BuildCardStripController
    SquadRosterController
    WorldObjectRenderer
    BuildingRenderer
    MonsterGroupRenderer
```

注意：

当前 `WorldObjectRenderer` 和 `MonsterGroupRenderer`
创建时间早于 `HUDRoot`。

所以需要小幅调整 composition：

```text
提前创建 HUDRoot + HoverInfoController
```

或者：

```text
先创建 Hover Controller
后 render world nodes
```

不要使用全局 singleton 来逃避初始化顺序。

---

# 33. Constructor / Setup 改动

## BuildCardStripController

新增依赖：

```ts
hover: HoverInfoController
```

传给：

```text
BuildingBlueprintCardView.setup()
```

---

## SquadRosterController

新增：

```ts
hover: HoverInfoController
```

同时 `SquadRosterItemView.setup()` 多传：

```text
squadId
runtime handle
hover
```

---

## WorldObjectRenderer

constructor 新增：

```ts
hover: HoverInfoController
```

---

## BuildingRenderer

constructor 新增：

```ts
hover: HoverInfoController
```

---

## MonsterGroupRenderer

constructor 新增：

```ts
hover: HoverInfoController
```

---

# 34. HoverInfoAssetLoader

加载最新：

```text
assets/art/ui/hover_background.png
```

当前 SpriteFrame UUID：

```text
5e793435-2b98-4767-be23-676436ce1a81@f9941
```

Loader 返回：

```ts
export interface HoverInfoAssets {
    backgroundFrame: SpriteFrame;
}
```

MainMapController 不新增 Inspector 手拖字段。

---

# 35. Texture Filter

当前 hover_background meta 使用：

```text
linear
```

如果实际背景是 pixel-art UI：

```text
改 Nearest
```

如果背景本身是平滑绘制：

```text
保留 Linear
```

这属于美术采样策略，与 9-slice 架构无关。

---

# 36. Hover Panel 不进入 input exclusion

不要把：

```text
HoverInfoLayer
```

加入：

```text
WorldViewportController.excludedUiNodes
BuildToolController.inputExcludedNodes
```

因为 Tooltip 不是一个可交互 UI。

它只是视觉层。

否则鼠标附近 Tooltip 可能意外阻止：

```text
Camera edge pan
Build interaction
```

---

# 37. 需要修改的现有文件

```text
assets/scripts/map/MainMapController.ts

assets/scripts/building/BuildCardStripController.ts
assets/scripts/building/BuildingBlueprintCardView.ts
assets/scripts/building/BuildingRenderer.ts

assets/scripts/ui/squad/SquadRosterController.ts
assets/scripts/ui/squad/SquadRosterItemView.ts

assets/scripts/world/WorldObjectRenderer.ts

assets/scripts/monster/MonsterGroupRenderer.ts

assets/scripts/squad/SquadBrain.ts
    # only add minimal read-only state getter if needed
```

原则上不需要修改：

```text
CombatEventHub
HealthComponent
BuildingPlacementService
WorldCommandController
```

---

# 38. Mandatory TS Headers

所有新增 `.ts` 使用仓库标准：

```ts
/**
 * Why this file exists:
 * ...
 *
 * Ownership boundary:
 * ...
 *
 * This file deliberately does NOT:
 * ...
 */
```

例如 `HoverInfoController.ts`：

```ts
/**
 * Why this file exists:
 * 多种 UI 和 World Object 都需要统一的 Hover 信息层，并且 Tooltip 必须在
 * Anchor 移动、Camera Pan/Zoom 和屏幕边缘情况下保持稳定定位。
 *
 * Ownership boundary:
 * 本文件唯一拥有当前 Hover Target、Show/Hide 时序、动态内容刷新和 Panel 定位调度。
 *
 * This file deliberately does NOT:
 * 不知道 Building/Monster/Squad 的业务规则，不读取私有 gameplay state，
 * 也不执行任何点击、建造或战斗命令。
 */
```

---

# 39. Acceptance Tests

## Bottom Cards

- [ ] Hover Blueprint Card 后约 80ms 显示。
- [ ] Tooltip 默认出现在 Card 上方。
- [ ] 不可购买 Card 仍可 Hover 查看。
- [ ] 快速扫过多张 Card 不疯狂闪屏。
- [ ] Leave 后正确消失。

## Squad Roster

- [ ] Hover Squad Card 默认向右。
- [ ] 显示 Squad 编号、人数、攻击、当前状态。
- [ ] Squad 数据变化后 Tooltip 在 0.1s 内更新。
- [ ] Hover 不影响点击选 Squad。

## Building

- [ ] 每栋 placed building 可 Hover。
- [ ] Tooltip 默认向右。
- [ ] 靠右屏幕边缘时自动翻左。
- [ ] Map Pan / Zoom 时 Tooltip 继续锚定建筑。

## Resource

- [ ] 每个资源点可 Hover。
- [ ] 显示资源名和剩余量。
- [ ] 采集时剩余量实时更新。
- [ ] Resource 被采完销毁时 Tooltip 自动关闭。

## Monster

- [ ] 每只 Monster 可 Hover。
- [ ] 显示 HP / ATK。
- [ ] HP 变化实时更新。
- [ ] Monster 移动时 Tooltip 跟 Anchor。
- [ ] Monster 死亡时 Tooltip 自动关闭。

## Layout

- [ ] Tooltip 永远不超出 Screen Safe Rect。
- [ ] Map 默认 Right，右边不足自动 Left。
- [ ] Bottom UI 默认 Top。
- [ ] Left UI 默认 Right。
- [ ] Shift 后保持至少 12px screen margin。

## Background

- [ ] hover_background 使用 Sprite.Type.SLICED。
- [ ] Panel 高度从 60 拉到 100/140 时角落不变形。
- [ ] 中心区域正常伸展。
- [ ] 不使用 Simple Scale 拉伸整张图片。

## Build Mode

- [ ] Build Mode 开启时地图 World Tooltip 不出现。
- [ ] Bottom Blueprint Hover 仍然正常。
- [ ] Squad Hover 仍然正常。

---

# 40. 明确禁止

```text
1. 每个对象创建自己的 Tooltip Panel。
2. Tooltip 跟鼠标 cursor 移动。
3. Background 使用 Simple Sprite 整体缩放。
4. 每个 Building Type 写一个专属 Hover Component。
5. Panel 内直接 switch Building / Monster / Squad。
6. UI 读取 SquadBrain private 字段。
7. Tooltip 使用 Button / BlockInputEvents。
8. Tooltip 进入 WorldViewport excluded UI。
9. Show 时算一次位置后就不再更新。
10. Monster / Resource 动态状态只在 MouseEnter 时读取一次。
```

---

# 41. 最终结构

```text
                         HoverInfoController
                        /         |          \
                       /          |           \
              Anchor Tracking   Content      Placement
                    |            Provider      Resolver
                    |              |             |
                    └──────────────┼─────────────┘
                                   ↓
                         HoverInfoPanelView
                                   ↓
                     one shared sliced background
```

来源：

```text
Blueprint Card ── Top ─────┐
Squad Card ───── Right ────┤
Building ─────── Right/Left├──→ HoverInfoController
Resource ─────── Right/Left│
Monster ──────── Right/Left┘
```

Panel 本身永远不知道 Hover 的对象是什么。

它只知道：

```text
“这里有一个 Anchor”
“这里有一份要展示的数据”
“首选方向是什么”
```

这保证以后新增：

```text
Tower
Radar
Lightning Rod
Research
Floor Event
Era Resource
Boss
```

时，都不需要重写 Tooltip 系统。
