# TowerDown 建筑蓝图卡片化 + 地图视口移动/Zoom 技术方案 V3

> 工程：`saiqi1999/TowerDown`  
> Cocos Creator：3.8.8  
> 本方案基于当前 `main` 分支代码重新设计，不修改已跑通的建筑放置事务、WorldCellGrid、NavigationGrid、Combat、Resource Harvest 核心逻辑。  
> 目标：移除大块 BuildBar 背景，改成底部独立蓝图卡片；同时加入适合模拟经营/RTS 的地图 Pan + Zoom，使任何地图区域都能移出 UI 遮挡区并正常交互。

---

# 0. 最终决策摘要

本轮采用：

```text
建筑 UI：
大 BuildBar 背景
      ↓ 删除
底部居中独立 Blueprint Cards
      ↓
每张卡显示：
背景框 + 建筑图标 + 建筑名 + 正确资源成本
```

用户提供的卡片源图：

```text
34 × 56 px
```

按项目当前 pixel-art 习惯：

```text
34 × 56 source
× 2
=
68 × 112 screen
```

4 张卡：

```text
68 × 4 + 8 × 3
= 296 px
```

因此底部遮挡面积从之前的大横条缩小为约：

```text
296 × 112
```

只遮挡屏幕底部中央的小区域。

地图移动/Zoom 本轮**不直接移动当前 cc.Camera**。

采用：

```text
WorldViewportController
        ↓
移动 / 缩放 MapRoot
```

它在玩家感知上就是完整的 Camera Pan / Zoom，但在当前 TowerDown 架构里更安全。

原因：

```text
当前 Canvas
├ Camera
├ MapRoot
└ HUDRoot（运行时）
```

当前唯一 Camera 同时承担世界与 UI 渲染。

如果直接移动/缩放这个 Camera：

```text
World 会动
HUD 也会受到 Camera 影响
```

要真正移动 cc.Camera，就必须进一步拆：

```text
WorldCamera
UICamera
World Layer
UI Layer
```

并重新验证现有所有基于 UITransform / Node Event 的资源点击。

当前世界本身就是 Canvas 下的 2D Node，因此最稳的实现是：

```text
Camera 保持固定
HUDRoot 保持固定
MapRoot 做 camera rig
```

这也是 Cocos 3.x 模拟经营大地图拖动/缩放的常见实现方式。

---

# 1. 当前代码状态确认

## 1.1 世界尺寸

当前：

```ts
GRID_SOURCE_SIZE = 16;
GRID_RENDER_SCALE = 2;
GRID_RENDER_SIZE = 32;
```

StaticMap：

```text
40 × 23 cells
```

所以实际世界尺寸是：

```text
width  = 40 × 32 = 1280
height = 23 × 32 = 736
```

注意当前 `StaticMap.ts` 注释写：

```text
40 x 23 cells at 32px per tile fills a 1280 x 720 design view.
```

这里数学上并不准确：

```text
23 × 32 = 736
```

因此 Camera/Viewport 边界实现必须从：

```ts
STATIC_MAP[0].length
STATIC_MAP.length
GRID_RENDER_SIZE
```

动态计算，禁止使用硬编码 `1280 × 720` 作为地图尺寸。

HUD 设计空间当前仍然是：

```text
1280 × 720
```

---

## 1.2 当前 Building Catalog 已经包含卡片需要的数据

当前每个 `BuildingDefinition` 已包含：

```ts
id
displayName
visual
cost
footprint
allowedTerrain
...
```

当前 4 个测试建筑为：

```text
Storage
cost: Wood 2

Supply
cost: Wood 2 + Food 1

Ritual
cost: Wood 2 + Gold 1

Kiln
cost: Wood 2 + Stone 2
```

因此卡片禁止硬编码费用。

必须始终：

```text
BuildingCatalog
↓
BuildingDefinition.cost
↓
Blueprint Card View
```

Ghost / Placement / Card UI 使用同一份 definition。

---

## 1.3 当前 ResourceInventory 已经有 affordability API

当前已有：

```ts
canAfford(cost)
trySpendCost(cost)
subscribe(listener)
```

所以蓝图卡可以直接表现：

```text
Affordable
Unaffordable
```

而不新增一套资源判断逻辑。

---

## 1.4 当前 Build Mode 状态已经足够

当前 `BuildToolController` 已有：

```ts
active
definitionId

select()
cancel()
subscribeState()
```

并且已经支持：

```text
再次点当前建筑 → cancel
ESC → cancel
右键 → cancel
```

这部分继续沿用。

---

## 1.5 当前 GridPointerProjector 与 MapRoot Camera Rig 天然兼容

当前流程：

```text
screen pointer
↓
固定 Camera.screenToWorld()
↓
mapNode.inverseTransformPoint()
↓
grid cell
```

当：

```text
MapRoot.position 改变
MapRoot.scale 改变
```

`inverseTransformPoint()` 会把这些变换一起计算进去。

所以采用：

```text
Pan / Zoom MapRoot
```

以后，Building Ghost 和鼠标格子映射理论上不需要改算法。

仍然必须做回归测试，但这是本方案选择 MapRoot camera rig 的重要原因。

---

# 2. 调研后的技术选型

参考的成熟实现模式分为三类。

## 2.1 Cocos Creator 3.8 官方 Input

官方全局 Input 支持：

```ts
Input.EventType.MOUSE_MOVE
Input.EventType.MOUSE_WHEEL

Input.EventType.KEY_DOWN
Input.EventType.KEY_PRESSING
Input.EventType.KEY_UP

Input.EventType.TOUCH_START
Input.EventType.TOUCH_MOVE
Input.EventType.TOUCH_END
```

所以：

```text
WASD
鼠标贴边
滚轮
触控
```

不需要引入第三方输入库。

---

## 2.2 Cocos 官方 Camera Demo 的成熟模式

Cocos 官方旧 Camera Demo 已经验证了几个非常成熟的设计模式：

```text
Pointer Pan
Zoom
Camera Boundaries
```

它是旧 Creator 示例，因此**不直接复制 API 代码**。

只采用设计模式：

```text
输入层
→ target viewport transform
→ boundary clamp
```

---

## 2.3 Cocos Creator 3.x 模拟经营大地图实践

Cocos 社区已有 Creator 3.x 的模拟经营大地图实现，核心思路是：

```text
Node / UITransform
+
鼠标拖动
+
滚轮缩放
+
双指缩放
+
scale boundary
+
screen boundary
```

这与 TowerDown 当前：

```text
Canvas
└ MapRoot
```

的结构高度匹配。

因此本轮采用：

> **Transform-based World Viewport**

而不是为了“名字叫 Camera”强行重构双 Camera 系统。

---

# 3. 建筑蓝图卡片最终 UI

用户提供图片：

```text
34 × 56
```

推荐导入路径：

```text
assets/resources/ui/building/building_blueprint_card.png
```

Import Settings：

```text
Type:
SpriteFrame

Min Filter:
Nearest / Point

Mag Filter:
Nearest / Point

Mip Filter:
None

Wrap:
Clamp
```

代码加载路径：

```ts
resources.load(
    'ui/building/building_blueprint_card/spriteFrame',
    SpriteFrame,
    ...
);
```

这样：

- 不需要 MainMapController Inspector 挂 `buildBarTexture`
- 不需要 MainMapController 知道 UI 背景图
- 不硬编码 UUID
- UI 资源属于自己的 UI module

---

# 4. 删除旧 BuildBar 背景

当前 `BuildBarController` 仍然拥有：

```ts
backgroundTexture
Sprite
BUILD_BAR_WIDTH
BUILD_BAR_HEIGHT
EraBadgeSlot
```

本轮全部移除。

新的底部 UI：

```text
HUDRoot
└ BlueprintCardStrip
   ├ BlueprintCard_storage_pot_01
   ├ BlueprintCard_supply_sack_01
   ├ BlueprintCard_ritual_tent_01
   └ BlueprintCard_kiln_01
```

没有：

```text
BuildBar Background
EraBadgeSlot
600/1200 px 大横板
```

Era UI 以后放：

```text
Top HUD
或
Civilization Panel
```

不要再强行占建筑快捷栏空间。

---

# 5. 卡片尺寸

新增统一配置：

```ts
export const BLUEPRINT_CARD_SOURCE_WIDTH = 34;
export const BLUEPRINT_CARD_SOURCE_HEIGHT = 56;

export const BUILD_UI_PIXEL_SCALE = 2;

export const BLUEPRINT_CARD_WIDTH =
    BLUEPRINT_CARD_SOURCE_WIDTH * BUILD_UI_PIXEL_SCALE;
// 68

export const BLUEPRINT_CARD_HEIGHT =
    BLUEPRINT_CARD_SOURCE_HEIGHT * BUILD_UI_PIXEL_SCALE;
// 112

export const BLUEPRINT_CARD_GAP = 8;
export const BLUEPRINT_CARD_BOTTOM_MARGIN = 8;

export const BLUEPRINT_ICON_SIZE = 32;
```

4 卡 strip：

```ts
stripWidth =
    count * BLUEPRINT_CARD_WIDTH
    + (count - 1) * BLUEPRINT_CARD_GAP;
```

4 张：

```text
296 px
```

Strip UITransform 必须使用实际 union：

```text
296 × 112
```

这样 `BuildToolController` 的 UI exclusion 只屏蔽这 296×112。

不能再屏蔽整个屏幕底部。

---

# 6. 卡片显示哪些信息

每张卡：

```text
┌────────────┐
│            │
│   Icon     │
│   32×32    │
│            │
│  Storage   │
│    木 2     │
│            │
└────────────┘
```

如果 2 个 cost：

```text
Supply
木 2
食 1
```

当前 4 个建筑最多两个 resource cost，所以不需要复杂多列布局。

未来超过两个资源：

```text
木2 石1
食1 金1
```

可使用两列。

---

# 7. 卡片布局

以 68×112 为基准：

```text
Icon:
y = +24
size = 32×32

Name:
y = -4
fontSize ≈ 10~11

Cost:
y = -28 / -41
fontSize ≈ 10
```

由于背景是非常窄的 pixel card：

- 不使用 `Storage Building` 这种长名
- 当前 `Storage / Supply / Ritual / Kiln` 正好合适
- 未来长名称用 Tooltip

---

# 8. 卡片状态

必须有 4 个状态：

```text
Normal

Selected
→ 黄色 / 高亮 outline

Unaffordable
→ 图标和文字降低 alpha
→ Button 仍可以点击还是禁止？
```

本轮决定：

```text
Unaffordable 不允许进入 Build Mode
```

原因：

当前玩家点击后不可能完成放置，只会产生无意义 Ghost。

所以：

```text
ResourceInventory.canAfford(definition.cost) === false

→ Card dim
→ Button.interactable = false
```

第四个：

```text
Selected + 当前资源后来变不足
```

如果进入 Build Mode 后资源变化导致不足：

```text
不强制退出 Build Mode
```

PlacementValidator 最终仍会拒绝。

卡片变成 unaffordable 视觉即可。

---

# 9. Blueprint Card 的数据来源

禁止复制数据。

完整链：

```text
BuildingBlueprintInventory
        ↓
unlocked definitionId[]
        ↓
BuildingCatalog
        ↓
BuildingDefinition
   ├ visual
   ├ displayName
   └ cost
        ↓
BuildingBlueprintCardView
```

同时：

```text
ResourceInventory.subscribe()
↓
setAffordable()
```

同时：

```text
BuildToolController.subscribeState()
↓
setSelected()
```

所以每张卡的视觉完全由三个已有真相源驱动：

```text
是否拥有：
BlueprintInventory

是什么 / 花什么：
BuildingCatalog

是否够钱：
ResourceInventory

是否选中：
BuildToolController
```

---

# 10. UI 资源加载设计

新增：

```text
BuildingUiAssetLoader.ts
```

只负责：

```text
load blueprint card SpriteFrame
```

不要：

```text
MainMapController.@property(Texture2D)
```

不要：

```text
硬编码 SpriteFrame UUID
```

推荐：

```ts
public loadBlueprintCardFrame(): Promise<SpriteFrame>
```

内部：

```ts
resources.load(
    'ui/building/building_blueprint_card/spriteFrame',
    SpriteFrame,
    ...
);
```

后续还有：

```text
resource icons
upgrade card
research card
```

可以继续进入这个 UI Asset module。

---

# 11. 卡片 selected 效果

由于 source 是 pixel art，禁止：

```ts
cardNode.setScale(1.07);
```

因为会产生非整数 pixel scale。

使用：

```text
Graphics outline
或
Sprite.color
或
额外 SelectedOverlay
```

本轮：

```text
2px 金黄色 outline
```

即可。

---

# 12. 卡片点击与地图输入

当前 `BuildToolController` 已有：

```ts
setInputExcludedNode(node)
```

以后传入：

```text
BlueprintCardStrip
```

而不是旧 BuildBar。

效果：

```text
鼠标点击卡片
→ UI Button

不会：
→ 同时触发地图 placement
```

Strip 的 UITransform 必须精确等于卡片 union。

禁止：

```text
width = 1280
height = 112
```

否则还是会造成整条底部地图无法交互。

---

# 13. World Viewport Controller

新增核心组件：

```text
assets/scripts/camera/WorldViewportController.ts
```

它提供玩家感知上的：

```text
Camera Pan
Camera Zoom
Camera Clamp
```

但内部修改：

```text
MapRoot.position
MapRoot.scale
```

---

# 14. 为什么当前不直接移动 Camera Component

当前 scene：

```text
Canvas
├ Camera
└ MapRoot
```

运行时：

```text
Canvas
├ Camera
├ MapRoot
└ HUDRoot
```

当前 Camera visibility 同时包含世界和 UI 使用的 layer。

如果 Camera 开始：

```text
position += ...
orthoHeight = ...
```

必须同时解决：

```text
HUD 固定
UI click camera
World click camera
GridPointerProjector 到底选哪个 camera
Camera ClearFlags
Camera Layer Visibility
```

而当前 `GridPointerProjector` 还是：

```ts
director.getScene()?.getComponentInChildren(Camera)
```

如果引入第二 Camera，这里立刻变成不确定行为。

因此本轮不做高风险 Camera Layer refactor。

未来如果世界从 UI Canvas 中独立出去，再切换：

```text
WorldCamera
UICamera
```

更合理。

---

# 15. Viewport 输入要求

最终支持：

```text
W / A / S / D
→ 平移视图

Mouse Edge
→ 鼠标靠近屏幕边缘持续移动

Mouse Wheel
→ Zoom

Mac / Laptop Trackpad
→ Wheel/Scroll Event 驱动 Zoom

Touchscreen 双指
→ Pinch Zoom

Middle Mouse Drag
→ Pan

Space + Left Drag
→ Pan（可选但建议实现）
```

普通 Left Click：

```text
仍属于资源点击 / Building Placement
```

绝不直接拿左键做 camera drag。

---

# 16. WASD

监听：

```ts
Input.EventType.KEY_DOWN
Input.EventType.KEY_UP
```

维护：

```ts
pressedKeys: Set<KeyCode>
```

Update：

```ts
W = camera up
S = camera down
A = camera left
D = camera right
```

由于实际移动的是 MapRoot：

```text
Camera Left
=
MapRoot Right
```

为了避免所有代码里反复思考反方向：

Viewport Controller API 用 camera semantics：

```ts
private panCamera(screenDelta: Vec2)
```

内部再转：

```ts
mapRoot.position -= cameraDelta
```

---

# 17. WASD 移动速度

建议：

```ts
PAN_SPEED_SCREEN_PX_PER_SECOND = 520;
```

使用：

```ts
dt
```

因此与 FPS 无关。

斜向：

```text
W + D
```

要 normalize。

不能让斜向速度：

```text
√2 ×
```

---

# 18. 鼠标贴边移动

记录最后 mouse UI location：

```ts
private pointerUiPosition: Vec2
```

每帧检查：

```text
left <= edgeThreshold
→ left

right >= viewportWidth - threshold
→ right

bottom <= threshold
→ down

top >= viewportHeight - threshold
→ up
```

建议：

```ts
EDGE_SCROLL_THRESHOLD = 24;
EDGE_SCROLL_SPEED = 420;
```

比 WASD 略慢。

---

# 19. Edge Scroll 的 UI 排除

如果鼠标正在：

```text
BlueprintCardStrip
Tooltip
Future Right Drawer
```

上面，则 edge scroll 不触发。

否则：

```text
鼠标为了点最底部蓝图
→ 地图突然往下跑
```

会非常烦。

WorldViewportController 预留：

```ts
public setInputExcludedNodes(
    nodes: readonly Node[],
): void
```

当前先传：

```text
BlueprintCardStrip
```

以后：

```text
RightDrawer
ResearchPanel
UpgradePanel
```

都可以加入。

---

# 20. Mouse Wheel / Trackpad Zoom

监听：

```ts
Input.EventType.MOUSE_WHEEL
```

读取：

```ts
event.getScrollY()
```

这个事件同时覆盖：

```text
传统鼠标滚轮
多数笔记本 Touchpad 的滚动输入
```

不要假设 scrollY 一定是 ±1。

高精度 touchpad 可能产生很多较小或较连续的 delta。

所以禁止：

```ts
if (scrollY > 0) scale += 0.2;
```

推荐：

```text
先 clamp delta
再累计
再转换成固定 zoom step
```

例如：

```ts
ZOOM_STEP = 0.05;
```

这样最终 scale 始终：

```text
0.85
0.90
0.95
1.00
1.05
...
```

对 pixel art 比完全连续的小数 scale 更稳定。

---

# 21. Zoom 范围

建议初版：

```ts
MIN_WORLD_SCALE = 0.85;
MAX_WORLD_SCALE = 1.50;
DEFAULT_WORLD_SCALE = 1.00;
```

为什么允许 `< 1`：

玩家需要：

```text
快速总览
看怪物分布
看资源分布
```

为什么不低于 0.85：

当前地图本身只有约 1280×736。

过度 zoom out：

```text
地图会明显小于 viewport
出现大量 map 外区域
```

后面如果地图扩大，可以降到：

```text
0.65~0.75
```

---

# 22. Zoom 以鼠标位置为中心

不要简单：

```ts
mapRoot.setScale(newScale);
```

否则玩家滚轮时视野总是朝屏幕中心收缩，很难追踪目标。

正确体验：

```text
鼠标指着 Gold
↓
滚轮放大
↓
Gold 基本仍留在鼠标下面
```

实现原理：

```text
oldScale
oldRootPos
pointerPosInParent
↓
ratio = newScale / oldScale

newRootPos =
pointer
-
(pointer - oldRootPos) * ratio
```

然后：

```text
applyScale
applyPosition
clamp
```

---

# 23. 双指 Pinch

Cocos `EventTouch` 支持：

```ts
getAllTouches()
```

当：

```text
touches.length === 2
```

记录：

```text
previousDistance
currentDistance
```

得到：

```ts
ratio =
currentDistance / previousDistance;
```

然后：

```text
newScale =
clamp(oldScale * ratio);
```

Pinch 中心：

```text
(touchA + touchB) / 2
```

同样使用：

```text
zoom around pointer center
```

这部分可以支持未来 mobile / touch screen。

---

# 24. Touchpad Pinch 说明

桌面 Touchpad 在不同 OS / Browser / Native backend 下事件映射可能不同。

本轮定义：

```text
第一层保证：
Touchpad two-finger scroll / pinch 被映射到 MOUSE_WHEEL 时正常 Zoom

第二层保证：
真正 Touch Event 双指输入时正常 Pinch
```

不要写平台专属 DOM hack。

原因：

```text
TowerDown 目前 Cocos runtime 应保持 Web / Native 可移植。
```

---

# 25. Camera Drag

为了避免普通 Left Click 与世界交互冲突：

PC：

```text
Middle Mouse Hold + Move
→ Pan

Space + Left Mouse Hold + Move
→ Pan
```

普通：

```text
Left Mouse
→ Resource / Build / Command
```

触摸设备：

```text
One Finger Drag
→ Pan
```

但 Touch 单击必须有：

```text
drag threshold
```

例如：

```text
移动 < 8px
→ tap

移动 >= 8px
→ pan
```

当前若不做移动端，One Finger 可以延后。

---

# 26. Camera / Viewport Boundary

世界尺寸动态计算：

```ts
const mapPixelWidth =
    mapWidth * GRID_RENDER_SIZE;

const mapPixelHeight =
    mapHeight * GRID_RENDER_SIZE;
```

当前：

```text
1280 × 736
```

缩放后：

```ts
scaledWidth =
    mapPixelWidth * scale;

scaledHeight =
    mapPixelHeight * scale;
```

Viewport：

```text
1280 × 720 design coordinate
```

标准无空白边界：

```ts
limitX =
    max(
        0,
        (scaledWidth - viewportWidth) / 2,
    );

limitY =
    max(
        0,
        (scaledHeight - viewportHeight) / 2,
    );
```

---

# 27. 但 TowerDown 不能只用标准边界

原因正是这次 UI 问题。

如果：

```text
地图尺寸 ≈ viewport
```

那么：

```text
limitX ≈ 0
limitY ≈ 8
```

地图几乎不能移动。

底部资源如果恰好被 Card Strip 遮住：

```text
仍然无法把它移出来
```

所以需要：

## Interaction Overscroll

建议：

```ts
INTERACTION_OVERSCROLL_PX = 128;
```

最终：

```ts
limitX =
    max(0, (scaledWidth - viewportWidth) / 2)
    + INTERACTION_OVERSCROLL_PX;

limitY =
    max(0, (scaledHeight - viewportHeight) / 2)
    + INTERACTION_OVERSCROLL_PX;
```

这样即使：

```text
scale = 1.0
```

玩家仍可以把地图向任意方向移动 128px。

足够把底部格子从 112px 的 Card Strip 后面拉出来。

---

# 28. Overscroll 出现地图外区域怎么办

允许。

但不能显示纯黑。

本轮最简方案：

```text
Camera clearColor
=
与 Grass 底色接近的暗绿色
```

或者：

```text
Canvas / WorldBackdrop
=
草地接近色
```

后续可以增加：

```text
非交互 decorative backdrop
```

比为了永远不露边，重新把 UI 交互锁死更合理。

---

# 29. Clamp 规则

MapRoot 的位置最终：

```ts
x ∈ [-limitX, +limitX]
y ∈ [-limitY, +limitY]
```

每次：

```text
WASD
Edge Pan
Mouse Drag
Zoom
Window Resize
```

之后都调用：

```ts
clampViewport();
```

禁止每种输入自己实现边界。

---

# 30. Zoom 后必须重新 Clamp

因为：

```text
scale
↓
scaledWorldSize
↓
limit
```

会变化。

顺序固定：

```text
计算 cursor-anchor zoom position
↓
setScale
↓
setPosition
↓
clampViewport()
```

---

# 31. 输入与 Build Mode 的关系

Build Mode active 时：

```text
WASD
Edge Scroll
Wheel Zoom
Middle Drag
```

全部继续允许。

原因：

玩家选好建筑后应该可以：

```text
移动地图
↓
找落点
↓
放置
```

Build Mode 只屏蔽：

```text
WorldCommand target clicks
```

而不能冻结 camera。

---

# 32. 输入冲突规则

优先级：

```text
UI Card
↓
Build Tool Cancel
↓
Camera Gesture
↓
Building Placement
↓
World Command
```

具体：

```text
点击 Card
→ UI

Wheel over Card
→ 不 Zoom World

Middle Drag over World
→ Camera Pan

Left Click during Build Mode
→ Placement

Left Click Normal
→ World Command
```

---

# 33. GridPointerProjector

采用 MapRoot transform 后原则上不用重构。

当前：

```text
screenToWorld
↓
MapRoot.inverseTransformPoint
```

已经包含：

```text
MapRoot translate
MapRoot scale
```

因此正确。

但是建议做一个小修正：

当前它自己：

```ts
director
    .getScene()
    ?.getComponentInChildren(Camera)
```

这是一种隐式依赖。

本轮既然正在引入 viewport，建议把 Camera 显式注入：

```ts
constructor(
    mapNode: Node,
    camera: Camera,
    mapWidth: number,
    mapHeight: number,
)
```

当前只有一台 Camera，行为不变。

好处：

以后真正拆：

```text
WorldCamera
UICamera
```

不会随机拿错 Camera。

---

# 34. MainMapController 接线

MainMapController 继续只做 composition root。

删除：

```ts
@property(Texture2D)
public buildBarTexture: Texture2D | null;
```

因为新卡背景由：

```text
BuildingUiAssetLoader
```

自己从 resources 加载。

Bootstrap：

```text
load Building UI assets
↓
create BlueprintCardStrip
↓
BuildCardStripController.setup()
↓
create WorldViewportController
↓
setup(mapRoot, map dimensions)
↓
set excluded UI:
BlueprintCardStrip
```

MainMap 不知道：

```text
卡片图片尺寸
卡片 SpriteFrame path
卡片文字布局
```

---

# 35. Runtime Node Tree

最终：

```text
Canvas
├ Camera                     # 保持固定
├ MapRoot                    # WorldViewportController 控制 transform
│ ├ TileRoot
│ ├ WorldObjectRoot
│ ├ ActorRoot
│ ├ CommandRoot
│ └ WorldFeedbackRoot
│
└ HUDRoot                    # 不跟 MapRoot 移动/缩放
  ├ ResourceHud
  └ BlueprintCardStrip
     ├ Card_storage_pot_01
     ├ Card_supply_sack_01
     ├ Card_ritual_tent_01
     └ Card_kiln_01
```

---

# 36. 文件方案

本轮新增：

```text
assets/scripts/building/BuildingUiAssetLoader.ts
assets/scripts/building/BuildCardStripController.ts
assets/scripts/building/BuildingBlueprintCardView.ts
assets/scripts/building/BuildCardUiConfig.ts

assets/scripts/camera/WorldViewportController.ts
assets/scripts/camera/WorldViewportConfig.ts
```

修改：

```text
MainMapController.ts
GridPointerProjector.ts
BuildToolController.ts（只调整 excluded UI 接线接口，如需要）
```

迁移完成后删除：

```text
BuildBarController.ts
BuildBarItemView.ts
BuildUiConfig.ts
```

如果 Agent 为了降低改动选择保留旧文件名也可以，但最终代码语义必须是：

```text
Card Strip
```

而不是继续保留大背景 BuildBar 逻辑。

本方案推荐直接重命名，避免以后语义继续混乱。

---

# 37. 每个 TS 文件必须有头注释

## `BuildingUiAssetLoader.ts`

```ts
/**
 * Why this file exists:
 * Building UI 需要独立加载卡片背景等 UI SpriteFrame，避免把 UI 美术资源
 * 继续堆到 MainMapController Inspector 中。
 *
 * Ownership boundary:
 * 本文件只负责 Building UI 静态资源的异步加载与返回。
 *
 * This file deliberately does NOT:
 * 不创建卡片、不读取 Blueprint、不处理 Build Mode，也不执行地图交互。
 */
```

---

## `BuildCardStripController.ts`

```ts
/**
 * Why this file exists:
 * 本次 Run 已解锁的建筑蓝图需要以底部紧凑卡片形式动态生成，
 * 并同步 affordability 与当前 BuildTool selected 状态。
 *
 * Ownership boundary:
 * 本文件拥有 Blueprint Card 列表的创建、横向布局和状态同步。
 *
 * This file deliberately does NOT:
 * 不拥有 Blueprint 解锁真相、不拥有 Build Mode 状态、不扣资源、
 * 不判断地图 placement 合法性。
 */
```

---

## `BuildingBlueprintCardView.ts`

```ts
/**
 * Why this file exists:
 * 单个建筑蓝图需要在有限 UI 空间中明确表达建筑图标、名称、成本、
 * selected 和 affordable 状态。
 *
 * Ownership boundary:
 * 本文件只拥有单张 Blueprint Card 的视觉与点击回调。
 *
 * This file deliberately does NOT:
 * 不修改资源、不解锁蓝图、不决定是否能落地，也不拥有 Build Mode 状态。
 */
```

---

## `BuildCardUiConfig.ts`

```ts
/**
 * Why this file exists:
 * Blueprint Card 使用固定 pixel-art source size，需要集中维护显示倍率、
 * 卡片尺寸、间距和文字布局，避免 UI 再次散落 magic number。
 *
 * Ownership boundary:
 * 本文件只定义 Building Card UI 常量。
 *
 * This file deliberately does NOT:
 * 不加载资源、不创建 Node、不处理输入，也不拥有运行时状态。
 */
```

---

## `WorldViewportController.ts`

```ts
/**
 * Why this file exists:
 * TowerDown 的地图已经大到不能继续依赖固定一屏视野，同时底部 UI 会覆盖部分
 * 世界交互区域，因此需要统一拥有地图 Pan、Zoom、输入与边界约束。
 *
 * Ownership boundary:
 * 本文件唯一拥有 MapRoot 的 viewport transform：平移、缩放、zoom anchor、
 * edge scroll、WASD、drag 和 boundary clamp。
 *
 * This file deliberately does NOT:
 * 不修改逻辑 Grid 坐标、不处理 Squad Command、不处理 Building Placement、
 * 不修改 NavigationGrid，也不移动 HUD。
 */
```

---

## `WorldViewportConfig.ts`

```ts
/**
 * Why this file exists:
 * World viewport 的移动速度、边缘阈值、缩放范围和 overscroll 都是同一套
 * Camera UX 参数，应集中管理而不是散落在输入回调里。
 *
 * Ownership boundary:
 * 本文件只定义 WorldViewportController 使用的配置常量。
 *
 * This file deliberately does NOT:
 * 不处理输入、不修改 MapRoot，也不保存运行时 Camera 状态。
 */
```

---

## `GridPointerProjector.ts`

更新头注释：

```ts
/**
 * Why this file exists:
 * 建筑输入必须把屏幕 pointer 通过明确的 World Camera 和 MapRoot transform
 * 稳定投影到逻辑 Grid；Viewport Pan/Zoom 后所有 placement 仍必须使用同一转换。
 *
 * Ownership boundary:
 * 本文件只负责 pointer -> world -> MapRoot local -> grid 的几何投影。
 *
 * This file deliberately does NOT:
 * 不监听输入、不控制 Camera/Viewport、不判断 placement 合法性。
 */
```

---

## `MainMapController.ts`

补充/更新：

```ts
/**
 * Why this file exists:
 * MainMapController 是主地图 composition root，负责创建系统并注入它们的依赖。
 *
 * Ownership boundary:
 * 本文件拥有 bootstrap 和系统装配关系。
 *
 * This file deliberately does NOT:
 * 不拥有 Blueprint Card 布局、不拥有 WorldViewport 输入状态、
 * 不执行 Building Placement 和 Camera UX 规则。
 */
```

---

# 38. WorldViewportController 推荐 API

```ts
export interface WorldViewportSetup {
    mapRoot: Node;

    mapWidthCells: number;
    mapHeightCells: number;

    viewportWidth: number;
    viewportHeight: number;

    excludedUiNodes?: readonly Node[];
}

public setup(config: WorldViewportSetup): void;

public resetView(): void;

public setInputExcludedNodes(
    nodes: readonly Node[],
): void;

public getScale(): number;

public panByCameraDelta(
    dx: number,
    dy: number,
): void;

public zoomAtUiPoint(
    uiX: number,
    uiY: number,
    zoomSteps: number,
): void;
```

---

# 39. 推荐配置

```ts
export const WORLD_VIEW_DEFAULT_SCALE = 1.0;
export const WORLD_VIEW_MIN_SCALE = 0.85;
export const WORLD_VIEW_MAX_SCALE = 1.50;

export const WORLD_VIEW_ZOOM_STEP = 0.05;

export const WORLD_VIEW_WASD_SPEED = 520;
export const WORLD_VIEW_EDGE_SPEED = 420;

export const WORLD_VIEW_EDGE_THRESHOLD = 24;

export const WORLD_VIEW_INTERACTION_OVERSCROLL = 128;

export const WORLD_VIEW_DRAG_THRESHOLD = 8;
```

全部单位：

```text
Canvas design pixels
```

---

# 40. 不要把 viewport scale 和 Grid scale 混在一起

严格区分：

```text
GRID_RENDER_SCALE = 2
```

代表：

```text
16px atlas tile
→ 32px world tile
```

而：

```text
WorldViewport.scale = 0.85~1.50
```

代表：

```text
玩家看世界的 Camera Zoom
```

Grid 逻辑仍永远：

```text
1 cell = 32 world units
```

Navigation / A* / placement 不能知道 viewport scale。

---

# 41. Pixel Art 与 Zoom

Zoom 到：

```text
1.15
1.25
0.85
```

时 pixel art 不再是整数像素倍率，这是 Camera Zoom 的正常代价。

通过：

```text
Nearest / Point
```

保持不模糊。

同时采用：

```text
0.05 step
```

减少高频 subpixel scale 抖动。

不要为了像素绝对整数化，把 zoom 限成：

```text
1x
2x
```

那对模拟经营视角来说过于粗糙。

---

# 42. 资源/怪物点击回归风险

采用 MapRoot transform 的优势是：

```text
WorldObjectView
Monster visuals
Health bars
Target flag
Ghost
Damage popup
```

都在 MapRoot 下。

它们一起：

```text
translate + scale
```

Node / UITransform hit area 也跟随 transform。

因此比拆双 Camera 风险低得多。

必须测试：

```text
Zoom 0.85
Zoom 1.0
Zoom 1.5

分别点击：
Wood
Stone
Food
Gold
Base
```

命中必须与视觉完全一致。

---

# 43. Building Placement 回归测试

分别：

```text
MapRoot center
MapRoot pan to left edge
MapRoot pan to right edge
MapRoot pan to top
MapRoot pan to bottom

scale:
0.85
1.0
1.5
```

每一种状态：

```text
点击 Blueprint
↓
Ghost 必须落在鼠标所在真实格子
↓
左键合法 Dirt
↓
建筑必须落在 Ghost 原位置
```

如果出现偏移：

优先检查：

```text
GridPointerProjector
```

而不是去给 Ghost 加补偿 magic number。

---

# 44. Card Strip 的 Input Exclusion

当前卡片总宽：

```text
4 cards ≈ 296
```

只屏蔽：

```text
x: center ±148
y: screen bottom ~112
```

其余底部地图继续可以正常点。

这就是卡片化对当前交互最大的收益。

---

# 45. Resource HUD 与 Camera Edge

当前顶部 ResourceHud 只是显示信息。

如果其 UITransform 横跨很宽，不能整个加入 Camera exclusion，否则：

```text
鼠标靠近顶部
→ Edge Scroll 永远失效
```

只把：

```text
真正交互 UI
```

放入 excluded list。

当前：

```text
BlueprintCardStrip
```

即可。

---

# 46. Resize

Cocos 3.8 提供 screen/window resize event。

本轮至少要求：

```text
Browser Resize
↓
重新获取 viewport size
↓
clampViewport()
```

如果项目当前固定 1280×720 Preview，可以先保留 design size。

但 Controller API 不要把 viewport 永久写死在内部。

---

# 47. 用户需要做的事情

本轮用户只做美术导入：

1. 将用户提供的 `34×56` 卡片图片放入：

```text
assets/resources/ui/building/building_blueprint_card.png
```

2. Import：
   - Type = SpriteFrame
   - Min Filter = Nearest / Point
   - Mag Filter = Nearest / Point
   - Mip = None
   - Wrap = Clamp

3. 不再给 `MainMapController` 拖 `buildBarTexture`。

4. 当前原 BuildBar texture 可以保留文件但不再使用；确认新系统稳定后删除。

不要求用户手工创建：

```text
BlueprintCardStrip
Card nodes
WorldViewportController node
```

Agent 运行时创建/接线。

---

# 48. Agent 实施顺序

## Phase A：卡片 UI

1. 导入/确认 card SpriteFrame resource path。
2. 新建 `BuildingUiAssetLoader.ts`。
3. 新建 `BuildCardUiConfig.ts`。
4. 新建 `BuildingBlueprintCardView.ts`。
5. 新建 `BuildCardStripController.ts`。
6. MainMap 改用 Card Strip。
7. 删除 `buildBarTexture` Inspector。
8. 确认卡片：
   - icon 正确
   - name 正确
   - cost 正确
   - selected 正确
   - unaffordable 正确
9. 删除旧 BuildBar runtime background。

## Phase B：Viewport

1. 新建 `WorldViewportConfig.ts`。
2. 新建 `WorldViewportController.ts`。
3. 接入 WASD。
4. 接入 Mouse Edge。
5. 接入 Mouse Wheel / Trackpad。
6. 接入 middle mouse drag。
7. 接入 pinch。
8. 实现 zoom-at-pointer。
9. 实现 clamp + overscroll。
10. 将 BlueprintCardStrip 注册为 excluded UI。

## Phase C：回归

重点测试：

```text
WorldObject Click
Build Placement
Target Flag
Monster Combat
Damage Popup
Resource HUD
Build Mode Cancel
```

---

# 49. 验收标准：Card

- [ ] 不再显示旧大 BuildBar 背景。
- [ ] 只显示独立 Blueprint Cards。
- [ ] 用户提供的 34×56 背景按 2× 变成约 68×112。
- [ ] 四张卡底部居中排列。
- [ ] Card Strip 总宽约 296px，而不是横跨屏幕。
- [ ] 每张卡建筑 icon 与 Catalog visual 对应。
- [ ] Storage 显示 Wood 2。
- [ ] Supply 显示 Wood 2 + Food 1。
- [ ] Ritual 显示 Wood 2 + Gold 1。
- [ ] Kiln 显示 Wood 2 + Stone 2。
- [ ] 当前 blueprint 有 selected 状态。
- [ ] 资源不足的 card 明显灰化并不可点击。
- [ ] Card 点击不穿透到地图。
- [ ] 卡片以外的底部地图可以正常点击。

---

# 50. 验收标准：Viewport

- [ ] W 向上移动视野。
- [ ] S 向下。
- [ ] A 向左。
- [ ] D 向右。
- [ ] 对角速度不增加。
- [ ] 鼠标靠左/右/上/下边缘会移动。
- [ ] 鼠标位于 Card Strip 上不会 edge scroll。
- [ ] 滚轮可 zoom。
- [ ] Touchpad wheel/pinch 映射时可 zoom。
- [ ] 双指 Touch Pinch 可 zoom。
- [ ] Middle Mouse Drag 可 pan。
- [ ] Zoom 范围限制在 0.85~1.50。
- [ ] Zoom 以鼠标/手势中心为锚点。
- [ ] 地图不能无限拖走。
- [ ] 最大 overscroll 约 128px。
- [ ] 底部被卡片遮挡的资源可以通过 pan 移出卡片区域。
- [ ] Zoom/Pan 后资源点击仍准确。
- [ ] Zoom/Pan 后 Building Ghost 不漂移。

---

# 51. 明确禁止

Agent 不允许：

```text
1. 直接给现有 Camera 加 WASD，然后发现 HUD 也移动再打补丁。
2. 同时移动 Camera 和 MapRoot。
3. 修改 GridTransform / Navigation 坐标来配合 Zoom。
4. 给 Building Ghost 加 zoom 偏移 magic number。
5. Card cost 手写 Storage='木2'。
6. Card background 再挂回 MainMapController Inspector。
7. 用整条 1280px UITransform 作为 Card Strip Input Blocker。
8. Wheel over UI 时仍缩放地图。
9. Build Mode active 时禁止 Camera Pan/Zoom。
10. 把地图移动边界写死成 1280×720。
11. 忽略真实地图高度 23×32=736。
12. 每个输入方式复制一份 clamp 逻辑。
```

---

# 52. 未来真正拆 WorldCamera / UICamera 的条件

等出现以下需求之一再拆：

```text
更大世界
复杂 camera shake
camera cinematic
独立 mini map camera
world post processing
大量非 UI world renderer
```

届时架构：

```text
WorldCamera
→ World layer

UICamera
→ UI_2D

GridPointerProjector
→ 显式 WorldCamera
```

当前阶段没有必要提前承担这项风险。

---

# 53. 最终玩家体验

```text
顶部：
资源 HUD

中间：
完整地图
可 WASD / 鼠标贴边 / 拖动移动

滚轮 / Touchpad：
Zoom

底部：
[Storage]
[Supply]
[Ritual]
[Kiln]

没有大背景板
```

玩家发现：

```text
卡片挡住一个资源
```

不再意味着：

```text
这个资源永远点不到
```

而是：

```text
WASD / Edge / Drag
↓
把地图移开
↓
正常点击
```

同时卡片自身清楚告诉玩家：

```text
是什么建筑
花什么资源
现在够不够
是否已选中
```

这就是当前阶段最适合 TowerDown 的模拟经营地图交互模型。
