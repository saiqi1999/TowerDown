# TowerDown Building UI / Build Mode UX Patch 技术方案（V2.1）

> 适用工程：`saiqi1999/TowerDown`  
> 目标版本：在当前 Building System Phase 1 V2 已经可正常落地建筑的基础上，解决 **底部 BuildBar 尺寸/信息密度问题** 与 **Build Mode 无法主动退出导致软锁** 两个可用性问题。  
> 本方案不改 Placement / Occupancy / Resource Transaction / Runtime Registry 的核心架构，只收敛 UI 与 BuildTool 生命周期。

---

## 0. 本轮必须解决的问题

当前实际表现：

1. `BuildBarController` 仍按原始素材尺寸 `300 × 58` 显示，而世界地图的 pixel art 实际按 2× 渲染，因此底栏视觉上明显偏小。
2. `BuildBarItemView` 当前每个 item 只有约 `68 × 52`，icon / 名称挤在同一空间里，并且 **完全没有显示 BuildingDefinition.cost**。
3. Build Mode 目前只有“建造成功后自动 cancel”这一条退出路径。
4. 放置位置非法时 `handlePointerDown()` 返回 false，`BuildToolController` 保持 active。
5. `WorldCommandController` 在 `BuildToolController.isActive() === true` 时会阻止 Squad 指令，因此如果玩家找不到合法落点，就会出现“无法放置、无法取消、无法下命令”的软锁。

本轮完成后必须达到：

```text
底栏 source pixel art 300×58
        ↓ 2× UI pixel scale
屏幕显示 600×116

BuildBar Item
├─ 建筑图标
├─ 建筑名称
└─ 资源成本

Build Mode
├─ 左键合法位置 → 建造成功 → 自动退出
├─ 左键非法位置 → 保持 Build Mode，可继续找位置
├─ 再点当前建筑 → 退出
├─ 右键 → 退出
└─ ESC → 退出
```

---

# 1. 范围边界

## 1.1 本轮做

- BuildBar 统一改为 2× pixel UI。
- 左侧正式保留 Era Badge 区域。
- 右侧建筑 item 重新布局。
- 每个建筑明确展示名称与资源成本。
- 当前选择建筑有明显 selected 状态。
- Build Mode 支持：
  - ESC 取消。
  - 鼠标右键取消。
  - 再次点击当前建筑取消。
  - 点击另一建筑直接切换当前 blueprint。
- `cancel()` 后：
  - Ghost 立即隐藏。
  - BuildTool inactive。
  - WorldCommand 自动恢复。
- UI 像素素材使用 Point / Nearest filtering。
- 保持成功放置后自动退出的现有行为。

## 1.2 本轮不做

- 不改 BuildingPlacementValidator 核心规则。
- 不改 BuildingPlacementService 事务逻辑。
- 不改 WorldCellGrid 占格结构。
- 不改 NavigationGrid 动态阻挡。
- 不实现时代系统。
- 不实现 Era Badge 实际逻辑，只保留槽位。
- 不实现建筑 tooltip / 详情面板。
- 不实现 ScrollView；当前 4 个测试建筑继续横向展示。
- 不实现拆除 / 连续批量建造。
- 不实现建筑效果。

---

# 2. 设计原则

## 2.1 世界缩放和 UI 缩放概念分离

当前世界：

```ts
GRID_SOURCE_SIZE = 16
GRID_RENDER_SCALE = 2
GRID_RENDER_SIZE = 32
```

UI 也应按 2× pixel art 显示，但不能让 `HUDRoot` 继承 `MapRoot` 的 scale。

明确两个不同的概念：

```ts
GRID_RENDER_SCALE = 2; // 世界 tile 的显示倍率
BUILD_UI_PIXEL_SCALE = 2; // pixel UI 素材的显示倍率
```

当前数值都等于 2，但职责不同。

禁止：

```ts
hudRoot.setScale(2, 2, 1);
buildBarRoot.setScale(2, 2, 1);
```

正确做法：

```text
原图 300×58
→ UITransform 直接使用最终显示尺寸 600×116
→ Node scale 始终保持 1
```

这样：
- Button 点击区域正确。
- Layout / ScrollView 以后可以直接用真实 UI 尺寸。
- 不会把 HUD 坐标系和 MapRoot 坐标系混在一起。

---

# 3. 最终 UI 尺寸规范

建议新增统一配置文件：

```text
assets/scripts/building/BuildUiConfig.ts
```

基础参数：

```ts
export const BUILD_UI_PIXEL_SCALE = 2;

export const BUILD_BAR_SOURCE_WIDTH = 300;
export const BUILD_BAR_SOURCE_HEIGHT = 58;

export const BUILD_BAR_WIDTH =
    BUILD_BAR_SOURCE_WIDTH * BUILD_UI_PIXEL_SCALE; // 600

export const BUILD_BAR_HEIGHT =
    BUILD_BAR_SOURCE_HEIGHT * BUILD_UI_PIXEL_SCALE; // 116

export const BUILD_BAR_BOTTOM_MARGIN = 16;

// 左边原图里是一个独立方形槽，正式留给时代徽章。
export const ERA_SLOT_WIDTH = 92;

// 建筑区域
export const BUILD_ITEM_WIDTH = 112;
export const BUILD_ITEM_HEIGHT = 100;
export const BUILD_ITEM_GAP = 8;

// pixel art 建筑 icon 最好保持整数倍率。
// Building atlas 单格为 16×16，本轮 UI 先按 2× = 32×32。
export const BUILD_ICON_SIZE = 32;

export const BUILD_NAME_FONT_SIZE = 14;
export const BUILD_COST_FONT_SIZE = 12;
```

### 为什么 icon 不建议用 40×40

建筑 atlas 的单格是 16×16。

```text
16 → 32 = 2×
16 → 48 = 3×
```

都是整数 pixel scale。

`40 = 2.5×` 会造成像素列宽不均匀，即使 Nearest 也不如整数倍率稳定。

本轮优先 `32×32`。如果实际观感仍偏小，可以统一切到 `48×48`，不要使用 40。

---

# 4. BuildBar 最终布局

HUD 设计坐标仍然是：

```text
1280 × 720
```

BuildBar：

```text
600 × 116
```

底部留 16px：

```text
BuildBarCenterY
= -720 / 2
+ 16
+ 116 / 2
= -286
```

所以最终：

```ts
root.setPosition(0, -286, 0);
```

更推荐不要硬编码 720，而是从 HUDRoot 的 `UITransform.contentSize.height` 读取：

```ts
const hudHeight =
    this.root.parent?.getComponent(UITransform)?.contentSize.height
    ?? 720;

const y =
    -hudHeight / 2
    + BUILD_BAR_BOTTOM_MARGIN
    + BUILD_BAR_HEIGHT / 2;

this.root.setPosition(0, y, 0);
```

---

# 5. BuildBar 内部结构

建议运行时节点结构：

```text
BuildBar
├─ EraBadgeSlot
└─ BuildItemRoot
    ├─ BuildBarItem_storage_pot_01
    │   ├─ Icon
    │   ├─ NameLabel
    │   ├─ CostRoot
    │   │   ├─ Cost_Wood
    │   │   ├─ Cost_Stone
    │   │   ├─ Cost_Food
    │   │   └─ Cost_Gold
    │   └─ SelectionOutline
    │
    ├─ BuildBarItem_supply_sack_01
    ├─ BuildBarItem_ritual_tent_01
    └─ BuildBarItem_kiln_01
```

EraBadgeSlot：

```text
宽约 92
高约 92
```

当前：
- 只创建槽位。
- 不实现时代数据。
- 不显示复杂逻辑。
- 可以暂时保持空白，或者显示 placeholder。

---

# 6. Build item 布局

每个 item：

```text
112 × 100
```

推荐视觉：

```text
┌──────────────────────┐
│        Icon          │
│       32×32          │
│                      │
│       Storage        │
│     木 2   石 1       │
└──────────────────────┘
```

建议坐标：

```ts
Icon:
    y = +26

NameLabel:
    y = -4

CostRoot:
    y = -30
```

### 文本不能再直接挂在 item root 上

当前 `BuildBarItemView` 直接：

```ts
const label = this.node.getComponent(Label)
    ?? this.node.addComponent(Label);
```

这会导致 Label 使用整个 item root 的 UITransform，并与 icon 发生布局冲突。

必须改成独立 child：

```text
BuildBarItem
├ Icon
├ NameLabel
└ CostRoot
```

---

# 7. 资源成本展示规范

`BuildingDefinition` 已经有：

```ts
cost: ResourceCost;
```

其中：

```ts
type ResourceCost =
    Partial<Record<ResourceType, number>>;
```

因此不新增新的建筑成本数据。

本轮 UI 只负责读取 Catalog 的 cost。

资源名称：

```ts
ResourceType.Wood  -> 木
ResourceType.Stone -> 石
ResourceType.Food  -> 食
ResourceType.Gold  -> 金
```

仅显示 `> 0` 的成本。

例如：

```text
Storage
木 2  石 1
```

如果一个建筑有 3~4 种资源：

```text
木 2  石 1
食 1  金 1
```

`CostRoot` 最多允许两行。

第一版可以用 Label 实现，不要求资源 icon。

以后替换成：

```text
[木icon] 2
```

时不修改 `BuildingDefinition` 和 Placement 系统。

---

# 8. BuildBar item selected 状态

玩家必须能明显看出来：

```text
当前是否正在 Build Mode
当前 Build Mode 选择的是哪个建筑
```

因此 `BuildBarItemView` 增加：

```ts
public setSelected(selected: boolean): void
```

建议表现：

```text
Normal
→ 无边框 / 暗边框

Selected
→ 明显高亮边框
→ NameLabel 提亮
```

当前没有专用 selected sprite 时，可以临时用 `Graphics` 画 2px 外框。

注意：

> Selected 只是一种 View 状态，不能成为 Build Mode 真相来源。

唯一真相仍然是：

```text
BuildToolController.active
BuildToolController.definitionId
```

---

# 9. BuildToolController 状态模型

当前：

```ts
private active = false;
private definitionId: string | null = null;
```

保留。

但需要增加标准状态发布能力。

建议：

```ts
export interface BuildToolState {
    active: boolean;
    definitionId: string | null;
}

export type BuildToolStateListener =
    (state: BuildToolState) => void;
```

Controller：

```ts
private readonly stateListeners =
    new Set<BuildToolStateListener>();

public subscribeState(
    listener: BuildToolStateListener,
): () => void {
    const listeners = this.stateListeners;

    listeners.add(listener);
    listener(this.getState());

    return () => {
        listeners.delete(listener);
    };
}

public getState(): BuildToolState {
    return {
        active: this.active,
        definitionId: this.definitionId,
    };
}

private notifyState(): void {
    const state = this.getState();

    for (const listener of this.stateListeners) {
        listener(state);
    }
}
```

BuildBar 只通过这一条观察 selected 状态。

禁止 BuildBar 自己维护：

```ts
private selectedId = ...
```

作为真相。

---

# 10. BuildToolController.select() 改为 Toggle + Switch

当前行为：

```text
点击建筑 A
→ A active

再次点击 A
→ 仍然 A active
```

必须改为：

```text
点击 A
→ Build A

再次点击 A
→ Cancel

Build A 时点击 B
→ 直接切换到 Build B
```

实现：

```ts
public select(definitionId: string): void {
    if (
        this.active
        && this.definitionId === definitionId
    ) {
        this.cancel();
        return;
    }

    this.definitionId = definitionId;
    this.active = true;

    this.tool?.setDefinition(definitionId);

    this.notifyState();
}
```

---

# 11. cancel() 是 Build Mode 唯一退出函数

所有退出入口必须汇聚到：

```ts
public cancel(): void
```

禁止：

```text
ESC 一套清理
右键一套清理
BuildBar 再点一次又一套清理
```

统一：

```ts
public cancel(): void {
    if (!this.active && !this.definitionId) {
        return;
    }

    this.active = false;
    this.definitionId = null;

    this.tool?.setDefinition(null);

    this.notifyState();
}
```

`BuildingPlacementTool.setDefinition(null)` 继续负责：

```text
Ghost.hide()
```

所以完整退出链：

```text
cancel()
↓
BuildTool.active = false
↓
definitionId = null
↓
PlacementTool.setDefinition(null)
↓
Ghost.hide()
↓
notifyState()
↓
BuildBar selected 清除
↓
WorldCommand predicate 重新返回 false
↓
Squad 指令恢复
```

---

# 12. 三条主动退出 Build Mode 的输入

## 12.1 ESC

`BuildToolController` 监听：

```ts
Input.EventType.KEY_DOWN
```

仅 active 时处理：

```ts
private onKeyDown(event: EventKeyboard): void {
    if (!this.active) {
        return;
    }

    if (event.keyCode === KeyCode.ESCAPE) {
        this.cancel();
    }
}
```

---

## 12.2 鼠标右键

在 `MOUSE_DOWN` 中优先处理右键：

```ts
private onPointerDown(event: Event): void {
    if (!this.active) {
        return;
    }

    if (
        event instanceof EventMouse
        && event.getButton() === EventMouse.BUTTON_RIGHT
    ) {
        this.cancel();
        return;
    }

    if (this.tool?.handlePointerDown(event)) {
        this.cancel();
    }
}
```

右键：

```text
不尝试 placement
不要求当前 cell 合法
无条件 cancel
```

---

## 12.3 再次点击当前 Building Item

由：

```ts
BuildToolController.select(definitionId)
```

内部 toggle 负责。

这一条也是 Touch 设备最重要的退出方式。

---

# 13. 非法放置后的正确行为

非法位置左键点击：

```text
BuildTool active
↓
PlacementTool.handlePointerDown()
↓
PlacementService.tryPlace()
↓
result.success = false
↓
BuildToolController 不 cancel
↓
Ghost 继续存在
↓
玩家继续移动鼠标找合法位置
```

这是正确行为。

不能修改成：

```text
左键放置失败
→ 自动退出
```

否则玩家每点错一次都要重新选择建筑，体验很差。

所以规则是：

```text
左键非法 = 保持模式
右键/ESC/再次点击当前 item = 主动退出
```

---

# 14. 成功放置后的行为保持不变

当前：

```ts
if (this.tool?.handlePointerDown(event)) {
    this.cancel();
}
```

保留。

所以：

```text
左键合法位置
↓
建筑成功落地
↓
自动 cancel
```

本轮不实现“连续放置同一种建筑”。

以后如果需要批量建设，只需要把这里改为：

```text
成功后保持 active
```

而不是改 PlacementService。

---

# 15. WorldCommandController 不需要重构

当前已经有：

```ts
commandController.setInputBlockedPredicate(
    () => buildToolController.isActive(),
);
```

这个结构是正确的。

Build Mode：

```text
active = true
→ 世界资源点击不下 Squad 指令
```

Cancel：

```text
active = false
→ predicate 自动返回 false
→ 下一次点击立即恢复 Squad Command
```

因此本轮不需要额外：

```text
commandController.resume()
commandController.enable()
```

不要引入第二套输入状态。

---

# 16. 输入优先级约束

本轮明确输入优先级：

```text
1. BuildBar UI Button
2. Build Mode Cancel Input
   ├ ESC
   ├ Right Click
   └ Toggle Current Item
3. Build Placement Left Click
4. World Command
```

必须保证：

```text
Build Mode active
→ WorldCommand 永远不抢输入

Build Mode cancel
→ WorldCommand 下一次输入立刻恢复
```

### 注意 BuildBar 点击穿透

`BuildToolController` 使用全局 `input.on(MOUSE_DOWN)`。

因此 Agent 实现时必须验证：

> 点击 BuildBar item 本身不会同时在它后面的地图 cell 上触发 placement。

如果当前 Cocos UI 事件已经阻止了该行为，只需要写回归测试。

如果存在点击穿透，则必须加 UI 输入屏蔽：

```text
Pointer 位于 BuildBar 屏幕矩形内
→ BuildToolController 不调用 PlacementTool.handlePointerDown()
```

不要在 `BuildingPlacementValidator` 里处理 UI 点击。

UI 输入排除属于 Input / Tool 层，不属于地图合法性。

---

# 17. BuildBarController 修改方案

## 当前问题

目前写死：

```ts
transform.setContentSize(300, 58);
this.root.setPosition(0, -315, 0);
```

以及：

```ts
node.setPosition(-102 + index * 68, 0, 0);
```

全部属于 1× UI magic number。

## 修改后职责

BuildBarController：

```text
负责：
- BuildBar 最终尺寸
- EraBadgeSlot
- BuildItemRoot
- item 创建
- item 横向位置
- 订阅 BlueprintInventory
- 订阅 BuildToolState
- selected 状态同步

不负责：
- placement
- resource spend
- ghost
- build validity
```

### Item X 计算

假设：

```text
BuildBar width = 600
Era area = 92
Item width = 112
Gap = 8
```

内容起点：

```ts
const contentLeft =
    -BUILD_BAR_WIDTH / 2
    + ERA_SLOT_WIDTH;
```

每个 item：

```ts
const x =
    contentLeft
    + BUILD_ITEM_WIDTH / 2
    + index * (BUILD_ITEM_WIDTH + BUILD_ITEM_GAP);
```

不再出现：

```ts
-102 + index * 68
```

---

# 18. BuildBarItemView 修改方案

`BuildBarItemView` 要从“一个 sprite + 根 Label”变成真正的 item view。

建议字段：

```ts
private definition: BuildingDefinition | null = null;

private iconSprite: Sprite | null = null;
private nameLabel: Label | null = null;

private costRoot: Node | null = null;

private selectionOutline: Graphics | null = null;

private onSelect: (() => void) | null = null;
```

公开 API：

```ts
public setup(
    definition: BuildingDefinition,
    factory: BuildingSpriteFrameFactory,
    onSelect: () => void,
): void

public setSelected(selected: boolean): void
```

内部：

```text
setup
├ create Icon
├ create NameLabel
├ create CostRoot
├ renderCost()
├ create SelectionOutline
└ bind Button

setSelected
└ 只修改视觉
```

---

# 19. CostRoot 实现细节

推荐不新增 `CostItemView.ts`。

原因：

- 本轮资源类型只有 4 种。
- 成本 item 非复杂业务对象。
- 单独拆文件收益不高。

直接由 `BuildBarItemView` 创建子 Label：

```ts
private renderCost(
    cost: ResourceCost,
): void
```

伪代码：

```ts
const entries = [
    [ResourceType.Wood, '木'],
    [ResourceType.Stone, '石'],
    [ResourceType.Food, '食'],
    [ResourceType.Gold, '金'],
] as const;

const visible =
    entries.filter(([type]) => (cost[type] ?? 0) > 0);
```

布局：

```text
1~2 种资源
→ 单行居中

3~4 种资源
→ 两行，每行最多 2 种
```

不要输出：

```text
木0 石0 食0 金0
```

---

# 20. Pixel Art 纹理设置

当前 build bar 原图尺寸：

```text
300 × 58
```

必须在 Cocos Import Settings 中设置：

```text
Min Filter: nearest / point
Mag Filter: nearest / point
Mip Filter: none
```

当前如果仍是：

```text
linear
```

2× 放大后会出现模糊边缘。

同样确认 Building Atlas：

```text
Nearest / Point
```

---

# 21. 文件改动清单

## 新增

### `assets/scripts/building/BuildUiConfig.ts`

建议文件头：

```ts
/**
 * Why this file exists:
 * Building HUD 使用 pixel-art 设计尺寸，如果 BuildBarController 和
 * BuildBarItemView 各自维护尺寸常量，会再次出现 1x/2x 混用和 magic number。
 *
 * Ownership boundary:
 * 本文件只定义 Building UI 的显示尺寸、间距和 pixel scale 常量。
 *
 * This file deliberately does NOT:
 * 不创建 Node、不处理输入、不读取蓝图、不执行 placement，也不拥有任何运行时状态。
 */
```

---

## 修改

### `assets/scripts/building/BuildBarController.ts`

建议更新文件头：

```ts
/**
 * Why this file exists:
 * BuildBar 负责把本次 Run 已解锁的建筑蓝图变成底部可点击入口，
 * 并将 BuildToolController 的当前选择状态同步回 UI。
 *
 * Ownership boundary:
 * 本文件拥有 BuildBar 的布局、Era 占位区、Item 创建与 selected 状态同步。
 *
 * This file deliberately does NOT:
 * 不决定建筑能否放置、不维护 Ghost、不扣资源、不拥有 Build Mode 真相。
 * Build Mode 的唯一状态拥有者仍然是 BuildToolController。
 */
```

主要改：
- 300×58 → 600×116。
- 动态 bottom position。
- 创建 EraBadgeSlot。
- 创建 BuildItemRoot。
- item 使用 112px 宽布局。
- 保存 `Map<string, BuildBarItemView>`。
- 订阅 `BuildToolController.subscribeState()`。
- state 更新时调用 `item.setSelected()`。
- destroy 时解除两个订阅。

---

### `assets/scripts/building/BuildBarItemView.ts`

建议更新文件头：

```ts
/**
 * Why this file exists:
 * 单个 Building Blueprint 需要在 BuildBar 中同时表达建筑图像、名称、
 * 建造成本和当前选中状态，否则玩家无法判断“建什么、花什么、当前选中了什么”。
 *
 * Ownership boundary:
 * 本文件只拥有单个 BuildBar item 的视觉和 Button 点击回调。
 *
 * This file deliberately does NOT:
 * 不拥有 Build Mode 状态、不判断地图合法性、不扣资源、不解锁蓝图。
 */
```

主要改：
- UITransform `112×100`。
- Icon 独立 Node。
- NameLabel 独立 Node。
- CostRoot 独立 Node。
- SelectionOutline 独立。
- 成本只显示非零项。
- 增加 `setSelected()`。

---

### `assets/scripts/building/BuildToolController.ts`

建议更新文件头：

```ts
/**
 * Why this file exists:
 * Build Mode 必须有唯一状态拥有者，否则 BuildBar、Ghost 和 WorldCommand
 * 各自维护 active 状态会产生无法退出或输入互锁。
 *
 * Ownership boundary:
 * 本文件唯一拥有当前 Build Mode 是否 active、当前 blueprintId，
 * 并统一处理进入、切换、取消以及 Build Mode 输入生命周期。
 *
 * This file deliberately does NOT:
 * 不判断 placement 合法性、不直接扣资源、不渲染 Ghost、不渲染 BuildBar。
 */
```

主要改：
- 增加 BuildToolState。
- 增加 `subscribeState()`。
- `select()` 支持 toggle / switch。
- `cancel()` 统一清理并 notify。
- 增加 ESC。
- 增加 Mouse Right。
- 保持成功 placement 后自动 cancel。
- 检查 BuildBar 点击穿透。

---

### `assets/scripts/building/BuildingPlacementTool.ts`

本轮原则上不需要逻辑修改。

保留现有语义：

```text
handlePointerDown()
→ success true / false
```

如果只增加注释，不改变职责。

文件头保持：

```ts
/**
 * Why this file exists:
 * PlacementTool 将 pointer、Ghost、Validator 与 PlacementService
 * 组合成一次具体建造操作。
 *
 * Ownership boundary:
 * 本文件拥有当前指针格子和 placement 提交入口。
 *
 * This file deliberately does NOT:
 * 不拥有 Build Mode 生命周期，不决定取消输入，不渲染 BuildBar。
 */
```

---

### `assets/scripts/map/MainMapController.ts`

只允许最小接线修改：

- BuildBar 新 constructor 参数（如果需要）。
- BuildTool / BuildBar 订阅接线。
- 不把 ESC / Toggle 逻辑写到 MainMapController。

MainMapController 仍只是 composition root。

建议在现有文件头补充：

```ts
/**
 * Why this file exists:
 * MainMapController 是主地图 composition root，负责创建系统并完成依赖注入。
 *
 * Ownership boundary:
 * 本文件拥有 bootstrap 与系统装配关系。
 *
 * This file deliberately does NOT:
 * 不拥有 Building UI 状态、不处理 Build Mode 输入、不执行 placement 业务规则。
 */
```

---

# 22. 用户需要手动做的事情

只需要做资源/Inspector 类工作，不要求手动搭大量节点。

1. 在 Cocos Assets 中选中 `build_bar.png`。
2. Import Settings：
   - Min Filter → Point / Nearest
   - Mag Filter → Point / Nearest
   - Mip Filter → None
3. 确认 Building Atlas 同样为 Nearest。
4. 启动 1280×720 Preview，检查 600×116 BuildBar 的实际比例。
5. 如果 Era placeholder 有正式素材，再单独绑定；本轮没有则保持空。

其余节点：

```text
EraBadgeSlot
BuildItemRoot
Icon
NameLabel
CostRoot
SelectionOutline
```

全部允许 Agent 运行时创建，不要求用户在 Scene Editor 手工搭。

---

# 23. Agent 实现顺序

## Step 1：BuildUiConfig

先消灭所有 BuildBar magic number。

完成后：

```text
BuildBarController
BuildBarItemView
```

全部从配置文件取值。

---

## Step 2：2× BuildBar

仅改：
- root 尺寸。
- bottom position。
- 背景 Custom Size。

先确认：

```text
300×58 source
→ 600×116 screen
```

不改 item。

---

## Step 3：Item 重构

把当前：

```text
Sprite + Root Label
```

改成：

```text
Icon
NameLabel
CostRoot
SelectionOutline
```

确认 4 个 item 无重叠。

---

## Step 4：成本显示

从 `BuildingDefinition.cost` 直接读取。

验收：

```text
玩家只看 BuildBar
→ 可以知道每栋建筑需要哪些资源、各需要多少
```

---

## Step 5：BuildTool State Listener

增加：

```ts
subscribeState()
```

BuildBar selected 由 Controller state 驱动。

---

## Step 6：Toggle

实现：

```text
A → A active
A again → cancel
A → B → B active
```

---

## Step 7：ESC / Right Click

全部调用同一个：

```ts
cancel()
```

---

## Step 8：输入回归

重点验证：

```text
Build Mode active
→ WorldCommand blocked

cancel
→ WorldCommand resumed

点击 BuildBar item
→ 不能穿透到地图 placement
```

---

# 24. 行为状态表

| 当前状态 | 输入 | 结果 |
|---|---|---|
| Normal | 点击建筑 A | 进入 Build A |
| Build A | 点击建筑 A | Cancel → Normal |
| Build A | 点击建筑 B | 切换 Build B |
| Build A | ESC | Cancel → Normal |
| Build A | Right Click | Cancel → Normal |
| Build A | 左键合法 Dirt | 建造成功 → Cancel |
| Build A | 左键 Grass | 建造失败，保持 Build A |
| Build A | 左键被占用 Dirt | 建造失败，保持 Build A |
| Build A | 左键资源不足 | 建造失败，保持 Build A |
| Build A | 点击资源/基地 | 不下发 Squad Command |
| Cancel 后 | 点击资源/基地 | 正常下发 Squad Command |

---

# 25. 验收标准

## 25.1 UI

必须全部满足：

- [ ] BuildBar 屏幕显示约 `600×116`。
- [ ] BuildBar 不使用 `node.scale = 2`。
- [ ] BuildBar 与地图 pixel art 清晰度一致。
- [ ] BuildBar 背景不是 Linear 模糊。
- [ ] 左边 Era 区独立保留。
- [ ] 4 个建筑 item 不重叠。
- [ ] 建筑 icon、名称、cost 不互相覆盖。
- [ ] 每个建筑 cost 中资源类型明确可读。
- [ ] `0` 成本资源不显示。
- [ ] selected item 有明显高亮。

## 25.2 Build Mode

- [ ] 点击建筑进入 Build Mode。
- [ ] Ghost 正常出现。
- [ ] 再点同一个建筑立即退出。
- [ ] 点击另一个建筑直接切换。
- [ ] ESC 无条件退出。
- [ ] 右键无条件退出。
- [ ] 非法左键不会退出。
- [ ] 合法左键建造成功后自动退出。
- [ ] 退出时 Ghost 立即隐藏。
- [ ] 退出后 selected 高亮消失。

## 25.3 World Command

- [ ] Build Mode active 时点击资源不会下 Squad 指令。
- [ ] cancel 后点击资源立即恢复下指令。
- [ ] 不需要第二个 enable/disable 状态。
- [ ] BuildBar 点击不能误触地图 placement。

---

# 26. 回归测试

必须重新验证原来已经跑通的建筑流程：

```text
点击建筑
→ Ghost
→ Dirt 合法
→ 扣资源
→ 建筑落地
→ WorldCellGrid claim
→ NavigationGrid blocked
→ BuildingRuntimeRegistry register
```

UI Patch 不允许破坏：

- Grass 禁止建筑。
- WorldObject / Resource 占格禁止建筑。
- 已有 Building 占格禁止建筑。
- 多资源原子扣费。
- 资源不足不扣任何资源。
- 成功 placement 后 Building 节点坐标不变。
- World Command / Monster Combat / Resource Harvest 不回归。

---

# 27. 明确禁止的实现方式

本轮 Agent 不允许：

```text
1. hudRoot.setScale(2)
2. buildBarRoot.setScale(2)
3. 在 BuildBar 自己维护第二份 isBuilding
4. ESC 直接 ghost.hide() 而不调用 cancel()
5. Right Click 自己清 definitionId 而不调用 cancel()
6. 非法 placement 自动退出 Build Mode
7. 把 BuildBar 尺寸继续写成 300×58
8. 把成本字符串硬编码到 UI
9. BuildBar 点击穿透后靠 Validator 拒绝
10. 为了取消 Build Mode 去 disable/enable WorldCommandController
```

---

# 28. 最终职责边界

```text
BuildingCatalog
= 建筑是什么、花什么

BuildingBlueprintInventory
= 本次 Run 解锁了什么

BuildBarController
= 底栏显示哪些 item、怎么排版

BuildBarItemView
= 单个建筑按钮长什么样

BuildToolController
= 当前是否处于 Build Mode、选的哪个、何时退出

BuildingPlacementTool
= 当前 pointer 在哪、提交一次 placement

BuildingPlacementValidator
= 这里能不能建

BuildingPlacementService
= 真正执行一次建造事务

WorldCommandController
= Build Mode inactive 时接受 Squad 命令
```

最重要的约束：

> **Build Mode 的唯一真相仍然只在 BuildToolController。**

这能避免再次出现 Combat 系统之前那种“多个组件各自拥有一部分状态，最后无法可靠退出”的问题。

---

# 29. 本轮完成定义

本轮完成后，玩家体验应该是：

```text
看到一个尺寸与地图匹配的 2× pixel BuildBar
↓
一眼看懂每栋建筑是什么、需要什么资源
↓
点击建筑进入 Build Mode
↓
合法位置正常建造
↓
非法位置可以继续找
↓
不想建了：
ESC / 右键 / 再点当前建筑
↓
立即退出
↓
继续正常给 Squad 下命令
```

做到这里，Building System Phase 1 的交互闭环才算真正可用。
