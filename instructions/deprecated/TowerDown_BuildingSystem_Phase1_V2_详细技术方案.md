# TowerDown Building System Phase 1 V2 详细技术方案

> 目标：在当前 Cocos Creator 3.8.8 / TypeScript 工程中，实现“蓝图驱动的底边栏 → 单一建造工具 → Ghost 预览 → 泥土地块合法性判断 → 原子资源扣费 → 建筑落地 → 动态阻挡导航 → 未来建筑效果接口”的完整闭环。
>
> V2 的核心不是增加更多类，而是把**状态归属、合法性判断和提交事务都变成单一真相源**，避免 Combat 阶段已经出现过的“多个 Controller 同时拥有同一状态”“表现层和逻辑层各算一遍”“退出路径不完整”等问题。

---

## 0. V2 相比 V1 的关键改动

V1 中的总体方向保留，但下面几项正式改写：

1. **取消独立 `BuildingOccupancyService`，改为通用 `WorldCellGrid`**。
   - `TerrainMap` 只回答“这个格子是什么地形”。
   - `WorldCellGrid` 只回答“这个格子被什么静态世界对象占用”。
   - `NavigationGrid` 只回答“单位是否可以走”。
   - 三者禁止互相替代。

2. **Build Mode 不再是一个散落的 boolean，而是单一 Active Tool**。
   - `BuildToolController` 是唯一的建造模式拥有者。
   - `BuildBarController` 只能请求进入/退出工具，不能自己保存另一套 `isBuilding`。
   - `WorldCommandController` 只查询“世界输入是否被 BuildTool 占用”，不能自行修改 BuildTool 状态。

3. **Ghost 与真正落地共用一个 `PlacementSnapshot`**。
   - 鼠标移动时只计算一次合法性。
   - Ghost 只读 Snapshot。
   - 点击提交时必须重新 validate 一次，防止 Snapshot 过期。
   - 禁止 Ghost 和 PlacementService 各写一套规则。

4. **建筑落地由 `BuildingPlacementService` 作为事务边界统一提交**。
   - 原子检查资源。
   - 原子扣费。
   - 占格。
   - 更新 NavigationGrid。
   - 注册 BuildingRuntime。
   - 创建 Node。
   - 任意一步失败必须回滚已完成步骤。

5. **底边栏完全数据驱动**。
   - 显示内容 = `BuildingBlueprintInventory` 已解锁蓝图 ∩ `BuildingCatalog`。
   - 时代未来只影响蓝图池和 Catalog 过滤，不进入 BuildBar 业务逻辑。

6. **建筑效果不写进 Building Node**。
   - 建筑仅持有 `effectIds`。
   - 未来由 `BuildingEffectSystem` 在 `OnFloorDescended` 等事件统一调度。

---

# 1. 当前工程基础与本方案约束

当前工程已经具备以下可直接复用的能力：

- `MainMapController` 已经是 composition root，负责创建 Registry、Renderer、Combat Hub、Navigation 等运行时依赖。
- `BUILDING_ATLAS_TEXTURE_UUID` 已经存在，Building Atlas 已经被工程加载。
- `TerrainType` 当前有 `Grass / Dirt`。
- `STATIC_MAP` 是地图地形真相源。
- `NavigationGrid` 已支持 `isWalkable / setBlocked / setWalkable`。
- `ResourceInventory` 已支持单资源 `add / canSpend / trySpend / subscribe`。
- `WorldObjectRuntimeRegistry` 已维护 Base / Resource 的静态运行时对象。
- `WorldAtlasConfig` 已经按照 16px 网格切 Building / Nature atlas。
- `GridTransform` 已有 grid → world 的正向换算。
- `WorldCommandController` 当前负责普通世界对象点击和 Squad 指令。

因此 V2 **不引入 TileMap 作为第二套地图坐标系统**，也不把建筑塞进 `WorldObjectRuntimeRegistry`。建筑有自己的生命周期、蓝图、成本和未来效果，应该有独立的 `BuildingRuntimeRegistry`，但与 Base / Resource 一起进入 `WorldCellGrid` 做统一占格。

---

# 2. Phase 1 明确范围

## 2.1 本轮必须实现

- 底部 300×58 建筑栏 UI。
- 左侧时代徽章占位。
- 右侧动态显示已获得蓝图。
- 建筑按钮显示 Building Atlas 中对应 1×1 图标。
- 资源不足时按钮 Disabled。
- 点击建筑进入 Placement Tool。
- 再点同建筑或取消操作退出 Placement Tool。
- Ghost 跟随网格。
- 仅 Dirt 可放置。
- 不允许越界。
- 不允许与 Base / Resource / 已有 Building 重叠。
- 提交前检查多资源成本。
- 多资源成本原子扣费。
- 落地后注册建筑实例并创建 Sprite Node。
- 落地格写入 `WorldCellGrid`。
- 落地格同步 `NavigationGrid.setBlocked()`。
- 成功建造一个建筑后自动退出建造模式。
- 建筑定义预留 `eraRequired`。
- 建筑定义预留 `effectIds`。
- 创建 `BuildingEffectSystem` 接口，但 Phase 1 不执行真实建筑效果。

## 2.2 本轮不实现

- 时代推进。
- 蓝图随机掉落。
- 建筑升级。
- 建筑拆除。
- 建筑搬迁。
- 建筑动画。
- 建筑血量。
- 建筑被攻击。
- 防御塔攻击。
- 每层建筑效果的真实结算。
- 存档与读档。
- 多层建筑 / 非矩形建筑。
- 建筑旋转。

---

# 3. 架构总览

```text
BuildingCatalog -------------------------┐
                                        │
BuildingBlueprintInventory -------------┤
                                        ▼
                                BuildBarController
                                        │ select(definitionId)
                                        ▼
                                BuildToolController
                                        │ owns active tool
                                        ▼
                              BuildingPlacementTool
                                 │             │
                         pointer update        │ confirm
                                 ▼             ▼
                         PlacementValidator   PlacementService
                                 │             │
                                 ▼             │
                        PlacementSnapshot      │ revalidate
                                 │             │
                                 ▼             │
                         BuildingGhostView     │
                                               ▼
                                   ResourceInventory
                                   WorldCellGrid
                                   NavigationGrid
                                   BuildingRuntimeRegistry
                                   BuildingRenderer
                                               │
                                               ▼
                                         BuildingRoot
```

核心约束：

```text
谁拥有状态？        BuildToolController / BuildingPlacementTool
谁判断能不能放？    BuildingPlacementValidator
谁告诉 Ghost 颜色？ PlacementSnapshot
谁真正提交？        BuildingPlacementService
谁维护已落地建筑？  BuildingRuntimeRegistry
谁维护格子占用？    WorldCellGrid
谁维护钱？          ResourceInventory
谁维护地形？        TerrainMap / STATIC_MAP
谁维护寻路阻挡？    NavigationGrid
```

任何其他类不得重复承担以上职责。

---

# 4. Runtime Node 结构

V2 尽量不要求用户手动创建 Scene Node，由 Agent 在 `MainMapController` 中动态补齐。

```text
Canvas
└── HUDRoot
    ├── ResourceHud
    └── BottomBuildBarRoot              <- runtime create
        ├── Background                  <- 300×58 UI 图
        ├── EraBadgeContent             <- 左侧徽章内容，不是背景框
        └── BuildViewport               <- 右侧区域
            └── BuildContent
                ├── BuildItem_xxx
                ├── BuildItem_xxx
                └── ...

MapRoot
├── TileRoot
├── WorldObjectRoot
│   ├── StructureRoot
│   ├── ResourceRoot
│   └── BuildingRoot                   <- runtime create
├── ActorRoot
├── CommandRoot
├── BuildPreviewRoot                   <- runtime create
│   └── BuildingGhost                  <- 只在建造模式显示
└── WorldFeedbackRoot
```

### 为什么 `BuildingRoot` 不放进 `StructureRoot`

当前 `StructureRoot` 属于静态 `WorldObjectRenderer` 的 Base 等对象；玩家建筑需要独立 Registry、独立动态创建和未来拆除。混在一起会让生命周期边界再次模糊。

### 为什么 Ghost 单独放 `BuildPreviewRoot`

Ghost 不是正式 BuildingRuntime，也不应该进入占格、导航、效果或 Registry。单独 Root 可以保证取消模式时一次隐藏/清理，不污染正式世界对象。

---

# 5. 单一 Active Tool 设计

## 5.1 `BuildToolController` 是唯一模式拥有者

状态：

```ts
export enum BuildToolState {
    Idle = 0,
    Placement = 1,
}
```

只允许：

```text
Idle
  └─ select blueprint ──> Placement

Placement
  ├─ select another blueprint ──> Placement(new definition)
  ├─ click same blueprint ───────> Idle
  ├─ cancel ─────────────────────> Idle
  └─ placement success ──────────> Idle
```

禁止其他类维护：

```ts
isBuilding
isPlacementMode
selectedBuildingId // BuildBar 可展示 selection，但真相必须来自 BuildToolController
```

## 5.2 `BuildingPlacementTool` 生命周期

```ts
export interface ActiveBuildTool {
    enter(definitionId: string): void;
    updatePointer(uiX: number, uiY: number): void;
    confirm(): BuildingPlacementResult;
    cancel(): void;
    exit(): void;
}
```

`BuildToolController` 负责工具生命周期；`BuildingPlacementTool` 负责当前建筑的 placement 行为。

---

# 6. PlacementSnapshot：预览与提交的共同真相

```ts
export enum PlacementInvalidReason {
    None = 0,
    PointerOutsideMap = 1,
    OutOfBounds = 2,
    TerrainNotAllowed = 3,
    Occupied = 4,
    InsufficientResources = 5,
    DefinitionMissing = 6,
}

export interface BuildingPlacementSnapshot {
    definitionId: string;
    gridX: number;
    gridY: number;
    footprint: readonly GridCell[];

    insideMap: boolean;
    terrainValid: boolean;
    occupancyValid: boolean;
    affordable: boolean;

    canPlace: boolean;
    reason: PlacementInvalidReason;
}
```

### 规则

Ghost 不允许自己判断：

```ts
if (terrain === Dirt) ...
```

Ghost 只能：

```ts
snapshot.canPlace
snapshot.gridX
snapshot.gridY
```

真正点击提交时，`BuildingPlacementService.tryPlace()` 必须针对相同 cell **重新调用 Validator**，而不是直接信任上一帧 Snapshot。

原因：

```text
Frame N:   Ghost 绿色，资源刚好够
Frame N+1: 其他系统消耗了资源
Click:     如果直接信 Snapshot，会产生负资源/非法提交
```

---

# 7. Terrain / Occupancy / Navigation 三层必须分开

## 7.1 TerrainMap

回答：

```text
(x,y) 是 Grass 还是 Dirt？
```

Phase 1 放置规则：

```ts
terrainMap[y][x] === TerrainType.Dirt
```

## 7.2 WorldCellGrid

回答：

```text
(x,y) 是否已经被 Base / Resource / Building 占用？
是谁占用？
```

推荐 Flag：

```ts
export enum WorldCellFlag {
    None = 0,
    Base = 1 << 0,
    Resource = 1 << 1,
    Building = 1 << 2,
    Reserved = 1 << 3,
}

export const BUILD_PLACEMENT_BLOCK_MASK =
    WorldCellFlag.Base
    | WorldCellFlag.Resource
    | WorldCellFlag.Building
    | WorldCellFlag.Reserved;
```

数据结构建议：

```ts
private readonly flags: Uint16Array;
private readonly occupiedCellsByOwner = new Map<string, GridCell[]>();
```

Phase 1 不允许同一格多个静态 Owner，所以不需要复杂实体集合。

## 7.3 NavigationGrid

回答：

```text
单位是否允许走过？
```

建筑成功落地后：

```ts
for (const cell of footprint) {
    navigationGrid.setBlocked(cell.x, cell.y);
}
```

不要用 `NavigationGrid.isWalkable()` 判断“这里能不能建”。

原因：某个格子未来可能因为临时寻路规则不可走，但仍然可能是合法建筑地；反过来，一个资源对象的格子也可能因为生命周期更新失误暂时 walkable，但仍不能建。

---

# 8. WorldCellGrid 初始化

`MainMapController.bootstrap()` 创建 `WorldCellGrid(width, height)` 后，将当前 `WorldObjectRuntimeRegistry.getAll()` 全部注册进去。

伪代码：

```ts
for (const object of worldObjectRegistry.getAll()) {
    const visual = getWorldVisualDefinition(object.visualId);
    const flag = object.kind === WorldObjectKind.Base
        ? WorldCellFlag.Base
        : WorldCellFlag.Resource;

    worldCellGrid.claimRect(
        object.id,
        flag,
        object.gridX,
        object.gridY,
        visual.w,
        visual.h,
    );
}
```

资源被采完时，当前 `WorldObjectLifecycleController` 已经负责 Registry / Renderer / Navigation；V2 后续应追加：

```ts
worldCellGrid.releaseOwner(resourceId);
```

这一步 **必须同步接入**，否则采空资源虽然视觉消失，但格子仍会被建筑系统判断为 Occupied。

因此 V2 需要轻量修改 `WorldObjectLifecycleController.ts`，让它可选注入 `WorldCellGrid`。

---

# 9. 建筑静态定义

```ts
export type ResourceCost = Partial<Record<ResourceType, number>>;

export enum BuildingCategory {
    Economy = 0,
    Research = 1,
    Defense = 2,
}

export interface BuildingVisualDefinition {
    col: number;
    row: number;
    w: number;
    h: number;
}

export interface BuildingDefinition {
    id: string;
    displayName: string;
    category: BuildingCategory;

    visual: BuildingVisualDefinition;
    footprintW: number;
    footprintH: number;

    cost: ResourceCost;

    allowedTerrain: readonly TerrainType[];
    blocksNavigation: boolean;

    // Phase 1 只存，不做时代逻辑。
    eraRequired: number;

    // Phase 1 只存，不执行具体效果。
    effectIds: readonly string[];
}
```

约束：

```text
visual.w/h = atlas 裁图大小
footprintW/H = 逻辑占地
```

Phase 1 四个测试建筑全部：

```text
visual 1×1
footprint 1×1
```

未来允许建筑画面 2×2、占地 2×2，也允许特殊建筑视觉比逻辑占地大，但 Phase 1 不使用这种差异。

---

# 10. 初始 BuildingCatalog 建议

根据当前 Building Atlas 右下区域的完整 1×1 单元，Phase 1 可先使用：

| ID | Atlas cell | 临时语义 | Category | 示例成本 |
| --- | --- | --- | --- | --- |
| `storage_pot_01` | `(29,15)` | 储物容器 | Economy | Wood 2 |
| `supply_sack_01` | `(30,15)` | 补给袋 | Economy | Wood 2 + Food 1 |
| `ritual_tent_01` | `(29,17)` | 研究/祭坛 | Research | Wood 2 + Gold 1 |
| `kiln_01` | `(30,17)` | 炉窑 | Economy | Wood 2 + Stone 2 |

这些名字只是 Phase 1 临时语义；代码 ID 一旦开始存档后不应随意改名。目前还没有存档，因此仍可调整。

所有定义：

```ts
allowedTerrain: [TerrainType.Dirt]
blocksNavigation: true
eraRequired: 0
effectIds: []
```

---

# 11. BlueprintInventory

它只负责：

```text
玩家本次 Run 已经获得哪些 BuildingDefinition ID
```

不负责：

```text
时代是否合法
建筑能不能买
建筑成本
UI
```

API：

```ts
export type BuildingBlueprintListener = (
    unlockedIds: readonly string[],
) => void;

export class BuildingBlueprintInventory {
    unlock(definitionId: string): boolean;
    has(definitionId: string): boolean;
    getAll(): readonly string[];
    subscribe(listener: BuildingBlueprintListener): () => void;
}
```

Phase 1 开局直接 unlock 四个测试建筑。

未来蓝图掉落：

```text
Era / Reward System
    ↓
从 BuildingCatalog 过滤 eraRequired
    ↓
随机选 Definition
    ↓
blueprintInventory.unlock(id)
    ↓
BuildBar 自动 refresh
```

因此时代系统未来加入时，不需要修改 BuildBar。

---

# 12. ResourceInventory 原子多资源升级

当前 `trySpend(type, amount)` 只支持单资源。建筑成本不能顺序调用多个 `trySpend()`。

错误示例：

```ts
trySpend(Wood, 5);   // 成功
trySpend(Stone, 2);  // 失败
// Wood 已被扣除，事务破坏
```

新增：

```ts
export type ResourceCost = Partial<Record<ResourceType, number>>;

public canAfford(cost: ResourceCost): boolean;
public trySpendCost(cost: ResourceCost): boolean;
public addCost(cost: ResourceCost): void;
```

### `canAfford`

```ts
for each resource:
    required >= 0
    inventory >= required
```

### `trySpendCost`

必须：

```text
先检查全部
→ 任意不足：返回 false，零修改
→ 全部足够：统一写 amounts
→ notify 仅一次
→ return true
```

### `addCost`

用于：

- 未来建筑效果批量加资源。
- PlacementService 异常回滚。

也必须只 `notify()` 一次。

现有单资源 API 保留，避免破坏资源采集代码。

---

# 13. BuildingRuntimeRegistry

```ts
export interface BuildingInstanceData {
    id: string;
    definitionId: string;
    gridX: number;
    gridY: number;
}

export interface BuildingRuntimeEntry {
    data: BuildingInstanceData;
    node: Node;
}
```

API：

```ts
add(data: BuildingInstanceData, node: Node): void;
get(id: string): BuildingRuntimeEntry | null;
getAll(): readonly BuildingRuntimeEntry[];
remove(id: string): BuildingRuntimeEntry | null;
```

Registry 是未来：

- Floor Effect 遍历。
- 拆除。
- 保存。
- 防御塔系统。

的统一入口。

禁止通过：

```ts
buildingRoot.children
```

反向猜游戏状态。

---

# 14. BuildingSpriteFrameFactory

UI 按钮与世界建筑必须使用同一个裁图源。

```ts
getFrame(definition: BuildingDefinition): SpriteFrame
```

内部缓存：

```ts
Map<string, SpriteFrame>
```

切图公式：

```ts
Rect(
    col * GRID_SOURCE_SIZE,
    row * GRID_SOURCE_SIZE,
    w * GRID_SOURCE_SIZE,
    h * GRID_SOURCE_SIZE,
)
```

使用同一个 Factory 可以避免：

```text
BuildBar 显示的是 A 图
落地却因为另一套坐标算法变成 B 图
```

---

# 15. BuildingRenderer

职责只有：

```text
BuildingInstanceData + BuildingDefinition
→ Node / Sprite / UITransform / world position
```

不做：

- 扣钱。
- 占格。
- 验证。
- Blueprint。
- Build Mode。
- Effect。

创建流程：

```ts
const node = new Node(`Building_${instance.id}`);
node.setParent(buildingRoot);
node.layer = buildingRoot.layer;

const transform = node.addComponent(UITransform);
transform.setContentSize(
    definition.visual.w * GRID_SOURCE_SIZE,
    definition.visual.h * GRID_SOURCE_SIZE,
);

const sprite = node.addComponent(Sprite);
sprite.spriteFrame = spriteFrameFactory.getFrame(definition);
sprite.sizeMode = Sprite.SizeMode.CUSTOM;

node.setScale(GRID_RENDER_SCALE, GRID_RENDER_SCALE, 1);
node.setPosition(
    gridRectToWorldCenter(
        instance.gridX,
        instance.gridY,
        definition.footprintW,
        definition.footprintH,
        mapWidth,
        mapHeight,
    ),
);
```

注意：当前 atlas sprite 的 anchor / grid placement 必须和现有 `WorldObjectRenderer` 的表现约定一致。Agent 实现时优先复用现有 WorldObject 的 SpriteFrame 习惯，不允许为了建筑另建坐标体系。

---

# 16. BuildingPlacementValidator

唯一合法性判断类。

输入：

```ts
validate(definitionId: string, gridX: number, gridY: number)
    => BuildingPlacementSnapshot
```

检查顺序固定：

```text
1. Definition 存在
2. footprint 每格在地图内
3. footprint 每格 Terrain ∈ allowedTerrain
4. footprint 每格没有 BUILD_PLACEMENT_BLOCK_MASK
5. ResourceInventory.canAfford(cost)
```

为什么 affordability 放在最后：

```text
Ghost 在草地上时，用户更应该看到“地形不合法”，而不是“资源不足”。
```

`reason` 返回第一项 hard failure。

### footprint 生成

```ts
for y in [gridY, gridY + h)
    for x in [gridX, gridX + w)
```

不得在多个系统重复写 footprint 算法。建议在 `BuildingTypes.ts` 提供纯函数：

```ts
getBuildingFootprint(definition, gridX, gridY): GridCell[]
```

Validator、PlacementService、WorldCellGrid 初始化都复用。

---

# 17. GridPointerProjector

职责：

```text
UI pointer location
→ MapRoot local position
→ integer grid cell
```

当前地图坐标以 MapRoot 中心为原点，和 `GridTransform` 正向公式对应。

反算：

```ts
const totalWidth = mapWidth * GRID_RENDER_SIZE;
const totalHeight = mapHeight * GRID_RENDER_SIZE;

const gx = Math.floor(
    (localX + totalWidth / 2) / GRID_RENDER_SIZE,
);

const gy = Math.floor(
    (totalHeight / 2 - localY) / GRID_RENDER_SIZE,
);
```

返回：

```ts
export interface GridPointerResult {
    insideMap: boolean;
    gridX: number;
    gridY: number;
}
```

这个文件只负责坐标转换，不判断 Dirt / Occupancy / Cost。

---

# 18. BuildingGhostView

Ghost 只接收：

```ts
show(
    definition: BuildingDefinition,
    snapshot: BuildingPlacementSnapshot,
): void;

hide(): void;
```

表现：

```text
canPlace = true  → 正常 Sprite + 半透明
canPlace = false → 红/灰 tint + 半透明
```

建议：

```ts
sprite.color = snapshot.canPlace
    ? VALID_COLOR
    : INVALID_COLOR;
```

不要改 Atlas 资源本身。

Ghost 的世界位置必须按：

```ts
gridRectToWorldCenter(...)
```

和正式 BuildingRenderer 使用同一 placement 公式。

---

# 19. BuildingPlacementService：提交事务

API：

```ts
export interface BuildingPlacementResult {
    success: boolean;
    buildingId?: string;
    reason?: PlacementInvalidReason;
}

tryPlace(
    definitionId: string,
    gridX: number,
    gridY: number,
): BuildingPlacementResult;
```

## 19.1 正常流程

```text
重新 validate
    ↓ invalid
return failed

valid
    ↓
生成 instanceId
    ↓
trySpendCost
    ↓
WorldCellGrid.claim
    ↓
NavigationGrid.setBlocked
    ↓
BuildingRenderer.create
    ↓
BuildingRuntimeRegistry.add
    ↓
return success
```

## 19.2 回滚

虽然 Cocos 主线程中没有并发事务，但 Renderer / Registry 仍可能因为程序错误抛异常，因此 Service 必须保证不产生半成品。

推荐：

```ts
let spent = false;
let claimed = false;
let navBlocked = false;
let node: Node | null = null;

try {
    ...
} catch (error) {
    if (node?.isValid) node.destroy();
    registry.remove(instanceId);

    if (navBlocked) {
        for (const cell of footprint) {
            navigationGrid.setWalkable(cell.x, cell.y);
        }
    }

    if (claimed) {
        worldCellGrid.releaseOwner(instanceId);
    }

    if (spent) {
        resourceInventory.addCost(definition.cost);
    }

    throw error;
}
```

因为 Phase 1 只允许在 Dirt 且原本无静态占用的格子盖建筑，所以 rollback 时 `setWalkable()` 是安全的。

## 19.3 成功后退出 Build Mode

由 Tool Controller 决定：

```text
PlacementService success
→ BuildingPlacementTool returns success
→ BuildToolController.clearActiveTool()
```

PlacementService 自己不能操作 UI / Tool State。

---

# 20. BuildBar UI

用户提供的背景图尺寸：

```text
300 × 58 px
```

布局解释：

```text
左侧约 48×58：时代徽章区域
右侧约 250×58：建筑蓝图区域
```

UI 节点以 1280×720 HUD 设计坐标工作，默认放底部中央。

建议：

```ts
BottomBuildBarRoot.position = (0, -720 / 2 + 29 + 8)
```

保留 8px 下边距；实际可根据视觉调整。

## 20.1 背景

Background 直接使用完整 300×58 Texture，不重新拼九宫格。

Pixel Art 资源：

```text
Filter = Nearest / Point
Compression 不得产生模糊边缘
```

## 20.2 EraBadgeContent

背景图已经包含左侧框，因此这里只需要在框中再放未来时代图标。

Phase 1：

- 节点存在。
- 可以为空或放简单占位 Sprite。
- 不实现时代变化。

## 20.3 BuildViewport

右侧建议从第一版就做 horizontal ScrollView + Mask，避免蓝图数量稍多后再重写容器。

```text
BuildViewport
└── ScrollView(horizontal only)
    └── View
        └── Content(Layout.Horizontal)
            └── BuildBarItemView × N
```

Phase 1 即使只有四项，也按动态列表实现。

---

# 21. BuildBarController

依赖：

```ts
BuildingCatalog
BuildingBlueprintInventory
ResourceInventory
BuildToolController
BuildingSpriteFrameFactory
```

刷新规则：

```text
BlueprintInventory changed
→ rebuild items

ResourceInventory changed
→ update affordability only

BuildTool selection changed
→ update selected highlight only
```

禁止每帧 rebuild UI。

显示集合：

```ts
blueprintInventory.getAll()
    .map(id => catalog.get(id))
    .filter(not null)
```

Phase 1 不做 era filter；未来时代系统应该在 Blueprint unlock 池前过滤，而不是 BuildBar 内过滤。

---

# 22. BuildBarItemView

一个 Item 只负责视觉和点击转发。

输入：

```ts
setup({
    definition,
    spriteFrame,
    selected,
    affordable,
    onClicked,
})
```

状态：

```text
Normal
Selected
DisabledByResource
```

资源不足：

- 图标灰化。
- 可以选择两种行为：完全不可点击，或可点击但 Ghost 永远显示资源不足。

V2 决策：**仍允许点击**。

原因：玩家应该能先选择建筑、在地图上看到放置范围，只是最终由于资源不足不能提交；这也让 UI 不会因为资源不足产生“为什么不能查看这个建筑”的割裂感。

因此 Disabled 是视觉状态，不是 `Button.interactable = false`。

---

# 23. 世界输入冲突处理

当前 `WorldCommandController` 已经直接绑定 `WorldObjectView` 点击。

建造模式时，点击资源/基地不应该给 Squad 下命令。

因此给 `WorldCommandController` 增加：

```ts
private inputBlockedPredicate: (() => boolean) | null = null;

public setInputBlockedPredicate(
    predicate: () => boolean,
): void;
```

在 `onWorldObjectClicked()` 第一行：

```ts
if (this.inputBlockedPredicate?.()) {
    return;
}
```

`MainMapController` 注入：

```ts
commandController.setInputBlockedPredicate(
    () => buildToolController.isActive(),
);
```

这样：

```text
BuildToolController = 模式真相源
WorldCommandController = 只询问，不拥有模式
```

---

# 24. UI 点击不能触发地图落地

`BuildToolController` 如果监听全局 Mouse/Touch，点击 BuildBar 也会产生 global pointer event。

因此 `BuildBarController` 需要提供：

```ts
public containsUiPoint(uiX: number, uiY: number): boolean;
```

BuildToolController 在 `confirm` 前：

```ts
if (buildBarController.containsUiPoint(x, y)) {
    return;
}
```

或者通过注入通用：

```ts
uiBlocker: (uiX, uiY) => boolean
```

避免 BuildingPlacementTool 直接依赖 BuildBarController。

推荐后者：

```text
BuildToolController
→ IWorldPointerBlocker
→ HUD tells whether pointer is over build UI
```

Phase 1 不需要做通用 EventSystem，只需要这一个 blocker callback。

---

# 25. BuildingEffect 扩展口

用户当前已经明确的未来建筑行为包括：

```text
每下一层获得 X 资源
每下一层失去 X 资源
每下一层给某种部队 +1 人
未来研究/防御/特殊规则
```

不要为每种建筑建立：

```text
GranaryComponent
BarracksComponent
GoldMineComponent
...
```

Phase 1 建议：

```ts
export enum BuildingEffectEvent {
    FloorDescended = 0,
    CombatStarted = 1,
    ResourceHarvested = 2,
    BuildingPlaced = 3,
}

export interface BuildingEffectContext {
    resourceInventory: ResourceInventory;
    // 未来加入 squad roster / research / etc.
}

export interface BuildingEffectExecutor {
    id: string;
    execute(
        event: BuildingEffectEvent,
        building: BuildingInstanceData,
        context: BuildingEffectContext,
    ): void;
}
```

`BuildingDefinition`：

```ts
effectIds: ['gain_food_on_floor']
```

`BuildingEffectSystem`：

```ts
dispatch(BuildingEffectEvent.FloorDescended)
```

流程：

```text
遍历 BuildingRuntimeRegistry
→ 查 Definition.effectIds
→ 查 Executor
→ execute
```

Phase 1：

- System 和 API 建立。
- 默认 executor registry 可为空。
- 建筑落地不执行实际效果。

---

# 26. 每个 TypeScript 文件必须有“为什么存在”头注释

这是 V2 的强制代码规范。

所有**新增和本次修改的 TS 文件**首部都必须有：

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

头注释重点不是复述类名，而是解释：

1. 为什么不能把它并进另一个类。
2. 它拥有什么状态/真相。
3. 它明确不拥有什么。

下面给出本轮每个 TS 文件的**推荐头注释原文**。

---

# 27. 新增 TS 文件与头注释

## 27.1 `assets/scripts/building/BuildingTypes.ts`

```ts
/**
 * Why this file exists:
 * Building 系统需要一组不依赖 Cocos Node 的纯数据契约，供 Catalog、Placement、
 * Runtime Registry、UI 和未来 Effect System 共同使用。把这些类型集中在这里可以避免
 * 每个子系统各自定义“建筑是什么”，最终产生字段和语义漂移。
 *
 * Ownership boundary:
 * 本文件只定义 Building 的数据结构、枚举和 footprint 纯函数，不保存运行时状态。
 *
 * This file deliberately does NOT:
 * 不负责渲染、资源扣费、占格、输入、蓝图解锁或建筑效果执行。
 */
```

内容：

- `BuildingCategory`
- `BuildingVisualDefinition`
- `BuildingDefinition`
- `BuildingInstanceData`
- `ResourceCost`（如果决定放 economy 层，则这里只 import）
- `PlacementInvalidReason`
- `BuildingPlacementSnapshot`
- `BuildingPlacementResult`
- `getBuildingFootprint()`

---

## 27.2 `assets/scripts/building/BuildingCatalog.ts`

```ts
/**
 * Why this file exists:
 * 所有建筑的静态规则必须来自同一个数据源，否则 BuildBar、Ghost 和实际落地很容易使用
 * 不同成本、图像或占地。本文件是 BuildingDefinition 的唯一静态 Catalog。
 *
 * Ownership boundary:
 * 本文件拥有“某个 building definition id 对应什么静态配置”的真相。
 *
 * This file deliberately does NOT:
 * 不记录玩家是否已经获得蓝图，不记录场上实例，也不判断当前能否建造。
 */
```

API：

```ts
getBuildingDefinition(id: string): BuildingDefinition | null;
getAllBuildingDefinitions(): readonly BuildingDefinition[];
```

---

## 27.3 `assets/scripts/building/BuildingBlueprintInventory.ts`

```ts
/**
 * Why this file exists:
 * “本次 Run 已经获得哪些建筑蓝图”是玩家进度状态，不属于静态 Catalog，也不属于 UI。
 * 独立 Inventory 可以让未来蓝图掉落、时代池和存档系统接入，而无需改 BuildBar。
 *
 * Ownership boundary:
 * 本文件只拥有 unlocked building definition ids，并发布解锁变化通知。
 *
 * This file deliberately does NOT:
 * 不决定蓝图掉落概率、时代合法性、建筑成本、资源是否足够或地图能否放置。
 */
```

---

## 27.4 `assets/scripts/world/WorldCellGrid.ts`

```ts
/**
 * Why this file exists:
 * 建造系统需要知道“某个格子被什么静态世界对象占用”，而 NavigationGrid 只应该回答
 * 单位能否行走，TerrainMap 只应该回答地形类型。这个独立网格避免把三个不同概念混为一谈。
 *
 * Ownership boundary:
 * 本文件拥有 Base、Resource、Building 等静态世界对象的 cell occupancy 真相，
 * 并按 ownerId 支持成组 claim / release。
 *
 * This file deliberately does NOT:
 * 不做寻路，不保存 Terrain，不跟踪移动中的 Squad/Monster，也不渲染任何对象。
 */
```

---

## 27.5 `assets/scripts/building/BuildingRuntimeRegistry.ts`

```ts
/**
 * Why this file exists:
 * 已落地建筑属于动态运行时实体，未来 Floor Effect、拆除、存档和防御系统都需要一个
 * 与 Scene Tree 解耦的查询入口。Registry 可以防止业务系统通过 node.children 反推游戏状态。
 *
 * Ownership boundary:
 * 本文件拥有已成功落地的 BuildingInstanceData 与对应 Node 的运行时索引。
 *
 * This file deliberately does NOT:
 * 不验证放置、不创建 Sprite、不扣资源，也不决定建筑效果。
 */
```

---

## 27.6 `assets/scripts/building/BuildingSpriteFrameFactory.ts`

```ts
/**
 * Why this file exists:
 * BuildBar 图标、Ghost 和正式建筑必须从同一 Building Atlas 坐标生成完全一致的 SpriteFrame。
 * 集中裁图和缓存可以避免 UI 与世界渲染各自维护一套 atlas 坐标算法。
 *
 * Ownership boundary:
 * 本文件只负责 BuildingDefinition.visual -> cached SpriteFrame。
 *
 * This file deliberately does NOT:
 * 不创建 Node、不控制 UI 状态、不做 placement 校验或资源逻辑。
 */
```

---

## 27.7 `assets/scripts/building/BuildingRenderer.ts`

```ts
/**
 * Why this file exists:
 * BuildingPlacementService 需要把已经提交成功的 BuildingInstanceData 转成场景中的可见 Node，
 * 但渲染细节不应污染事务、资源和占格逻辑，因此单独保留 Renderer。
 *
 * Ownership boundary:
 * 本文件拥有正式建筑 Node 的创建、Sprite 配置、尺寸和网格到世界坐标摆放。
 *
 * This file deliberately does NOT:
 * 不判断能不能建、不扣资源、不修改 WorldCellGrid / NavigationGrid，也不执行建筑效果。
 */
```

---

## 27.8 `assets/scripts/building/BuildingPlacementValidator.ts`

```ts
/**
 * Why this file exists:
 * Ghost 预览和最终提交必须使用同一套合法性规则。本文件集中所有 placement validation，
 * 生成不可变 PlacementSnapshot，避免表现层和提交层重复实现并逐渐产生差异。
 *
 * Ownership boundary:
 * 本文件拥有“给定 definition + grid cell 当前是否合法”的唯一判断规则。
 *
 * This file deliberately does NOT:
 * 不修改资源、不占格、不创建建筑、不改变 Build Tool 状态。
 */
```

---

## 27.9 `assets/scripts/building/BuildingPlacementService.ts`

```ts
/**
 * Why this file exists:
 * 一次建造会同时修改资源、WorldCellGrid、NavigationGrid、BuildingRegistry 和 Scene Node。
 * 这些修改必须在一个事务边界内完成并在异常时回滚，不能分散到 UI 或 Renderer 中。
 *
 * Ownership boundary:
 * 本文件拥有“最终提交一次建筑落地”的原子业务流程。
 *
 * This file deliberately does NOT:
 * 不监听鼠标、不显示 Ghost、不维护选中的建筑，也不决定蓝图是否已解锁。
 */
```

---

## 27.10 `assets/scripts/grid/GridPointerProjector.ts`

```ts
/**
 * Why this file exists:
 * Build Tool 接收到的是 UI 屏幕坐标，而 placement 规则使用整数 GridCell。
 * 将逆向坐标转换独立出来可以保证所有鼠标/触摸建造输入共享同一套映射公式。
 *
 * Ownership boundary:
 * 本文件只负责 pointer UI position -> MapRoot local -> GridCell 的坐标投影。
 *
 * This file deliberately does NOT:
 * 不判断地形、占用、成本或当前是否处于 Build Mode。
 */
```

---

## 27.11 `assets/scripts/building/BuildingGhostView.ts`

```ts
/**
 * Why this file exists:
 * 建造预览是纯表现层，它应该消费 PlacementSnapshot，而不是自己重新判断 terrain / occupancy。
 * 独立 GhostView 可以保证取消建造时只清理预览，不污染正式 BuildingRuntime。
 *
 * Ownership boundary:
 * 本文件拥有 Ghost Node 的显示、隐藏、Sprite、位置和合法/非法视觉反馈。
 *
 * This file deliberately does NOT:
 * 不计算 canPlace、不提交建筑、不扣资源，也不保存当前选中的 blueprint。
 */
```

---

## 27.12 `assets/scripts/building/BuildingPlacementTool.ts`

```ts
/**
 * Why this file exists:
 * “选择某个建筑后，鼠标移动产生 Snapshot，点击确认提交，取消时清 Ghost”是一段完整的
 * 工具生命周期。单独的 PlacementTool 可以避免把输入、预览和事务状态塞进 BuildBar。
 *
 * Ownership boundary:
 * 本文件拥有当前 selected definition 的 placement 会话和 latest PlacementSnapshot。
 *
 * This file deliberately does NOT:
 * 不拥有整个游戏当前是否处于 Build Mode；Active Tool 的唯一拥有者是 BuildToolController。
 */
```

---

## 27.13 `assets/scripts/building/BuildToolController.ts`

```ts
/**
 * Why this file exists:
 * 建造模式必须只有一个状态拥有者，否则 BuildBar、WorldCommand 和 Ghost 各自维护状态时
 * 会产生进入/退出不一致。本文件是 Active Build Tool 生命周期的唯一控制器。
 *
 * Ownership boundary:
 * 本文件拥有 Idle / Placement 状态、当前 active tool，并统一注册/注销世界建造输入。
 *
 * This file deliberately does NOT:
 * 不判断具体地块是否合法、不直接扣资源、不创建正式 Building Node。
 */
```

---

## 27.14 `assets/scripts/ui/BuildBarItemView.ts`

```ts
/**
 * Why this file exists:
 * BuildBar 中每个蓝图按钮需要统一的图标、选择态、资源不足态和点击反馈。
 * 把单 Item 表现独立出来可以让 BuildBarController 只负责列表数据同步。
 *
 * Ownership boundary:
 * 本文件只拥有一个蓝图条目的 UI Node 与视觉状态。
 *
 * This file deliberately does NOT:
 * 不读取 BlueprintInventory、不扣资源、不进入 Build Mode，也不判断 placement 合法性。
 */
```

---

## 27.15 `assets/scripts/ui/BuildBarController.ts`

```ts
/**
 * Why this file exists:
 * 底边栏需要把 BlueprintInventory、BuildingCatalog、ResourceInventory 和 BuildTool 的状态
 * 投影成动态 UI。独立 Controller 可以保持 Toolbar 数据驱动，而不是为每个建筑手写按钮。
 *
 * Ownership boundary:
 * 本文件拥有 BuildBar UI 列表的创建/刷新和 UI hit area，但不拥有建造模式本身。
 *
 * This file deliberately does NOT:
 * 不保存第二套 isBuilding、不判断地图是否可放置，也不直接创建正式建筑。
 */
```

---

## 27.16 `assets/scripts/building/BuildingEffectTypes.ts`

```ts
/**
 * Why this file exists:
 * 建筑未来会响应“下一层、战斗开始、资源采集”等游戏事件，但 Phase 1 不应把具体效果
 * 写死进 Building Node。这里先定义稳定的 effect hook 契约，给后续系统留入口。
 *
 * Ownership boundary:
 * 本文件只定义 Building Effect 的事件、上下文和 executor 接口。
 *
 * This file deliberately does NOT:
 * 不注册具体效果，不遍历建筑，也不触发任何效果。
 */
```

---

## 27.17 `assets/scripts/building/BuildingEffectSystem.ts`

```ts
/**
 * Why this file exists:
 * 未来 FloorSystem 等系统需要用统一方式把事件分发给所有已落地建筑，而不应该知道
 * 每种建筑的具体实现。这个系统通过 definition.effectIds 做数据驱动的效果调度。
 *
 * Ownership boundary:
 * 本文件拥有 effect executor registry 和对 BuildingRuntimeRegistry 的事件分发流程。
 *
 * This file deliberately does NOT:
 * 不决定什么时候下降到下一层，不保存建筑实例，也不负责 Building Node 表现。
 */
```

---

# 28. 本轮修改的现有 TS 文件与头注释

这些文件当前若没有文件头注释，本次修改时一并补齐。

## 28.1 `assets/scripts/economy/ResourceInventory.ts`

```ts
/**
 * Why this file exists:
 * 所有资源增减必须通过同一个库存对象发布一致的 snapshot，HUD、采集和建造才能共享
 * 同一份经济状态。本文件同时提供单资源接口和建筑需要的原子多资源事务接口。
 *
 * Ownership boundary:
 * 本文件拥有 Wood / Stone / Food / Gold 的当前数量以及资源变化通知。
 *
 * This file deliberately does NOT:
 * 不决定资源从哪里产生、为什么被消耗，也不包含建筑或 UI 业务规则。
 */
```

修改：

- `ResourceCost`
- `canAfford()`
- `trySpendCost()`
- `addCost()`

---

## 28.2 `assets/scripts/world/WorldObjectLifecycleController.ts`

```ts
/**
 * Why this file exists:
 * Resource 等 WorldObject 的删除会同时影响 Registry、Renderer、Navigation 和现在新增的
 * WorldCellGrid；这些清理必须由一个生命周期控制器统一完成，避免视觉消失但逻辑残留。
 *
 * Ownership boundary:
 * 本文件拥有静态 WorldObject 从“请求删除”到“最终从各运行时系统移除”的生命周期。
 *
 * This file deliberately does NOT:
 * 不处理玩家 Building 的生命周期，也不决定对象何时应该耗尽。
 */
```

修改：

```ts
setup(
    registry,
    renderer,
    navigationGrid,
    worldCellGrid?,
)
```

最终删除资源时：

```ts
worldCellGrid?.releaseOwner(objectId);
```

---

## 28.3 `assets/scripts/command/WorldCommandController.ts`

```ts
/**
 * Why this file exists:
 * 普通世界点击会转成当前 Squad 的移动/交互命令，并维护战略目标旗帜。Build Mode 加入后，
 * 它仍然只负责 Command，但必须尊重更高优先级的 Active Tool 输入占用。
 *
 * Ownership boundary:
 * 本文件拥有世界对象点击到 Squad Command 的转换和每个 Squad 的 TargetFlag。
 *
 * This file deliberately does NOT:
 * 不拥有 Build Mode，不做 Building placement，也不自行修改 BuildToolController 状态。
 */
```

修改：

- `setInputBlockedPredicate()`
- `onWorldObjectClicked()` 顶部 gate。

---

## 28.4 `assets/scripts/map/MainMapController.ts`

```ts
/**
 * Why this file exists:
 * MainMapController 是地图场景的 composition root，负责创建运行时服务并显式注入依赖，
 * 这样 Combat、World、Building 和 UI 子系统不需要退化为全局单例。
 *
 * Ownership boundary:
 * 本文件拥有启动阶段的对象装配与依赖连接，不拥有各业务系统的运行时规则。
 *
 * This file deliberately does NOT:
 * 不直接实现 placement validation、资源扣费、建筑效果或 Build Tool 状态机。
 */
```

新增 Inspector 属性：

```ts
@property(Texture2D)
public buildBarTexture: Texture2D | null = null;
```

新增 bootstrap 装配：

```text
WorldCellGrid
BuildingBlueprintInventory
BuildingRuntimeRegistry
BuildingSpriteFrameFactory
BuildingRenderer
BuildingPlacementValidator
BuildingPlacementService
BuildingGhostView
BuildingPlacementTool
BuildToolController
BuildBarController
BuildingEffectSystem
```

---

# 29. MainMapController 装配顺序

推荐严格按下面顺序：

```text
1. load textures / roots
2. create ResourceInventory
3. create WorldObjectRuntimeRegistry
4. render static map / world objects
5. build NavigationGrid
6. create WorldCellGrid
7. seed Base / Resource occupancy
8. setup WorldObjectLifecycleController with WorldCellGrid
9. create existing squad / monster / command systems
10. create BuildingBlueprintInventory
11. unlock Phase1 test blueprints
12. create BuildingRuntimeRegistry
13. create BuildingSpriteFrameFactory
14. create BuildingRenderer
15. create BuildingPlacementValidator
16. create BuildingPlacementService
17. create BuildPreviewRoot + BuildingGhostView
18. create GridPointerProjector
19. create BuildingPlacementTool
20. create BuildToolController
21. create BottomBuildBarRoot + BuildBarController
22. inject UI pointer blocker into BuildToolController
23. inject buildToolController.isActive into WorldCommandController
24. create BuildingEffectSystem
```

Composition root 负责连线，不要让子系统互相 `find()` Scene Node 或查全局 Singleton。

---

# 30. BuildTool 输入建议

Cocos Creator 3.8：

```ts
input.on(Input.EventType.MOUSE_MOVE, ...)
input.on(Input.EventType.MOUSE_UP, ...)
input.on(Input.EventType.TOUCH_MOVE, ...)
input.on(Input.EventType.TOUCH_END, ...)
```

只在 `BuildToolController` Active 时处理 placement。

退出时：

```ts
input.off(...)
```

或者 Controller 永久监听，但第一行：

```ts
if (!this.isActive()) return;
```

推荐永久监听 + state gate，避免频繁注册/解绑造成 callback identity 问题；`onDestroy` 再统一 off。

鼠标移动：

```text
pointer
→ UI blocker? yes: ignore/update hide optional
→ projector
→ validator
→ latest snapshot
→ ghost.show(snapshot)
```

点击：

```text
pointer over build UI? yes → return
outside map? → return
latest snapshot cell != clicked cell? → recalc snapshot
placementTool.confirm()
→ PlacementService revalidate
→ success: BuildToolController -> Idle
```

---

# 31. 建造成功后的导航行为

建筑写入 NavigationGrid 后，新的 A* 请求自然会绕开建筑。

Phase 1 不强制打断**已经计算完成、正在执行中的旧路径**。

原因：当前 SquadMotor 持有既有 path，如果玩家在其前方即时落建筑，旧路径可能仍经过该格。这个问题属于“动态导航失效重规划”，建议单独作为 Phase 1.1：

```text
NavigationGrid revision++
WorldNavigator path carries revision
SquadMotor detects stale path / blocked next cell
→ recompute
```

V2 Phase 1 的最低验收：

```text
建筑落地之后发出的新命令不会穿过建筑。
```

如果测试中旧路径穿楼非常明显，再把 revision replanning 提前加入。

---

# 32. 建筑与移动 Actor 的关系

`WorldCellGrid` **不记录 Warrior / Squad / Monster**，因为他们是移动 Actor，不应永久 claim 静态 cell。

Phase 1 默认规则：

```text
只要 Dirt + 无 Base/Resource/Building + 资源够，就允许建造。
```

如果建筑落在正在移动的 Actor 当前格，Actor 不被碰撞阻塞；后续路径会把建筑当阻挡。

如果视觉上不可接受，Phase 1.1 可以增加：

```ts
DynamicPlacementBlockerQuery
```

只做“点击瞬间是否有 Actor 占据 footprint”的临时校验，但仍不能把 Actor 写进 WorldCellGrid。

---

# 33. UI 资源接入

## 用户需要做的事情

只有以下手动步骤：

1. 把用户提供的 `300×58` Bottom Build Bar PNG 导入 Cocos 项目，例如：

```text
assets/textures/ui/build_bar.png
```

2. Texture 设置为 pixel-art 适合的 Nearest / Point 过滤。

3. 在 `MainMapController` Inspector 将其拖入：

```text
buildBarTexture
```

4. Building Atlas 当前已经接入，无需重复导入。

5. 不需要用户手动创建：

```text
BuildingRoot
BuildPreviewRoot
BottomBuildBarRoot
BuildContent
Ghost
```

这些全部由 Agent 在 runtime 创建。

---

# 34. Agent 实现任务顺序

## Stage A：底层真相源

实现：

- `BuildingTypes.ts`
- `BuildingCatalog.ts`
- `BuildingBlueprintInventory.ts`
- `WorldCellGrid.ts`
- `ResourceInventory.ts` 多资源原子 API
- `WorldObjectLifecycleController.ts` release occupancy

验收：

```text
Base / Resource 正确 claim cell
资源采空后对应 cell release
canAfford / trySpendCost 不发生半扣费
```

## Stage B：正式建筑实例

实现：

- `BuildingRuntimeRegistry.ts`
- `BuildingSpriteFrameFactory.ts`
- `BuildingRenderer.ts`
- `BuildingPlacementValidator.ts`
- `BuildingPlacementService.ts`

先不做 UI，可用临时 debug 调用：

```ts
tryPlace('kiln_01', x, y)
```

验收：

```text
Dirt 成功
Grass 失败
occupied 失败
资源不足失败
成功后 Registry 有实例
成功后 Navigation blocked
```

## Stage C：建造工具

实现：

- `GridPointerProjector.ts`
- `BuildingGhostView.ts`
- `BuildingPlacementTool.ts`
- `BuildToolController.ts`

验收：

```text
鼠标移动 Ghost 对齐格子
Ghost 合法/非法颜色正确
点击成功后退出 tool
取消后 Ghost 消失
```

## Stage D：底边栏

实现：

- `BuildBarItemView.ts`
- `BuildBarController.ts`
- runtime ScrollView / Layout
- 时代徽章占位

验收：

```text
只显示已解锁定义
unlock 后动态增加 Item
资源变化后 affordability 视觉更新
selected item 与 active tool 同步
```

## Stage E：输入整合

修改：

- `WorldCommandController.ts`
- `MainMapController.ts`

验收：

```text
Build Mode 中点击资源不下 Squad 指令
点击 BuildBar 不会在地图落建筑
退出 Build Mode 后世界点击恢复
```

## Stage F：效果接口

实现：

- `BuildingEffectTypes.ts`
- `BuildingEffectSystem.ts`

只建立 dispatch 架构，不实现具体功能。

---

# 35. 关键验收用例

## A. UI / Blueprint

### A1
开局显示四个测试 Blueprint。

### A2
手动 `unlock(newId)` 后，无需重启 Scene，BuildBar 增加 Item。

### A3
未解锁建筑绝不显示。

### A4
资源不足 Item 灰化，但仍可点击查看 Ghost。

---

## B. Build Mode

### B1
点击 `kiln_01`：

```text
Idle → Placement(kiln_01)
```

### B2
再次点击当前 kiln：

```text
Placement → Idle
Ghost hidden
```

### B3
Placement 中点击另一个 Blueprint：

```text
Placement(kiln) → Placement(storage)
Ghost sprite immediately changes
```

### B4
成功落地一个建筑：

```text
Placement → Idle
```

---

## C. Placement Validation

### C1 Dirt + Free + Affordable

```text
Ghost valid
canPlace = true
```

### C2 Grass

```text
reason = TerrainNotAllowed
Ghost invalid
```

### C3 Base footprint

```text
reason = Occupied
```

### C4 Resource footprint

```text
reason = Occupied
```

### C5 已有 Building

```text
reason = Occupied
```

### C6 Map edge 越界

```text
reason = OutOfBounds
```

### C7 Dirt + Free + 资源不足

```text
reason = InsufficientResources
```

---

## D. Transaction

### D1 多资源不足

库存：

```text
Wood 10
Stone 0
```

成本：

```text
Wood 2
Stone 2
```

提交失败后必须：

```text
Wood 仍为 10
Stone 仍为 0
WorldCellGrid unchanged
NavigationGrid unchanged
Registry unchanged
no Node
```

### D2 成功

成功后必须同时满足：

```text
ResourceInventory 已扣费
WorldCellGrid = Building
NavigationGrid blocked
BuildingRuntimeRegistry 有 entry
BuildingRoot 有 node
BuildTool = Idle
```

不可只满足其中一部分。

---

## E. Resource Lifecycle

### E1
建筑尝试放在尚未采集的 Resource：Occupied。

### E2
Resource HP 归零并完成 Lifecycle 删除后：

```text
WorldCellGrid.releaseOwner(resourceId)
```

再在同一 Dirt cell 放建筑：允许。

---

## F. Input Conflict

### F1
普通模式点击 Resource：Squad command 正常。

### F2
Placement 模式点击 Resource 所在格：

```text
不会给 Squad command
placement 因 Occupied 失败
```

### F3
Placement 模式点击 BuildBar Item：

```text
不会在地图同时生成建筑
```

---

# 36. 调试日志约定

开发阶段建议保留低频状态日志，不要每帧打印。

```text
[BuildTool] enter definition=kiln_01
[BuildTool] exit reason=placed
[BuildTool] exit reason=cancelled

[BuildingPlacement] reject definition=kiln_01 cell=(12,8) reason=TerrainNotAllowed
[BuildingPlacement] success id=building_kiln_01_1 cell=(12,8)

[Blueprint] unlocked=kiln_01

[WorldCellGrid] claim owner=building_kiln_01_1 flag=Building cells=1
[WorldCellGrid] release owner=food_01 cells=1
```

不要打印每次 mouse move 的 snapshot，否则 Console 会被淹没。

---

# 37. Instance ID 规则

Phase 1：

```ts
building_${definitionId}_${counter}
```

例如：

```text
building_kiln_01_1
building_kiln_01_2
```

Counter 由 `BuildingPlacementService` 或独立 ID allocator 持有。

当前没有存档，不需要 UUID。

未来引入 Save/Load 后，counter 必须从存档恢复或换持久 ID。

---

# 38. 为什么建筑不进入 WorldObjectRuntimeRegistry

当前 `WorldObjectData`：

```text
Base / Resource
```

并且会被 Squad Command、Resource Health/Lifecycle 等逻辑理解。

如果 Phase 1 直接加：

```ts
WorldObjectKind.Building
```

现有很多 switch / command 路径都会被迫理解“建筑是不是 Squad 目标”。这会扩大改动面。

因此 V2 决策：

```text
WorldObjectRuntimeRegistry = 当前地图静态 Base / Resource 业务
BuildingRuntimeRegistry    = 玩家动态建造业务
WorldCellGrid              = 二者共同的占格真相
```

未来如果游戏模型成熟后确认它们应该统一，再做 `WorldEntityRegistry` 重构，而不是在 Phase 1 强塞。

---

# 39. 为什么不把 Building 逻辑直接塞进 MainMapController

`MainMapController` 当前已经承担大量 composition root 工作。

V2 允许它写：

```ts
const validator = new BuildingPlacementValidator(...);
const placementService = new BuildingPlacementService(...);
```

但不允许它写：

```ts
if (terrain === Dirt && wood >= 2) {
    wood -= 2;
    createSprite(...);
}
```

Composition Root 负责“谁依赖谁”，业务类负责“规则是什么”。

---

# 40. 为什么 V2 不直接复制某个开源 Placement System

参考的成熟实践来自不同引擎：

- Sunny Valley：Placement State / Preview / Grid Data 分层。
- Godot Grid Base Builder：Grid Cell Flags 与 Economy 解耦。
- Burgage：Single Active Tool、统一 Placement 结果、Data-driven Toolbar。

TowerDown 已经有自己的：

```text
GridTransform
TerrainMap
NavigationGrid
ResourceInventory
WorldObjectRuntimeRegistry
Cocos UI
```

所以正确做法是吸收其架构约束，而不是把 Unity/Godot 的 GameObject/TileMap 结构硬搬进 Cocos。

---

# 41. 预期最终调用链

## 打开建造模式

```text
BuildBarItemView click
→ BuildBarController
→ BuildToolController.select(definitionId)
→ BuildingPlacementTool.enter()
→ Ghost ready
```

## 鼠标移动

```text
Input pointer
→ BuildToolController
→ UI blocker check
→ GridPointerProjector
→ BuildingPlacementTool.updatePointer
→ BuildingPlacementValidator.validate
→ PlacementSnapshot
→ BuildingGhostView.show
```

## 点击合法 Dirt

```text
Input confirm
→ BuildToolController
→ BuildingPlacementTool.confirm
→ BuildingPlacementService.tryPlace
→ Validator revalidate
→ ResourceInventory.trySpendCost
→ WorldCellGrid.claim
→ NavigationGrid.setBlocked
→ BuildingRenderer.create
→ BuildingRuntimeRegistry.add
→ success
→ BuildToolController Idle
→ Ghost hide
→ BuildBar selection clear
```

## 点击非法格

```text
confirm
→ Service revalidate
→ failed
→ Placement Tool remains active
→ Ghost remains invalid
→ zero world mutation
```

---

# 42. Phase 1 完成定义（Definition of Done）

只有同时满足以下条件才能认为本轮完成：

```text
[UI]
底栏像素图正确显示在屏幕底部；左时代框保留；右侧动态显示蓝图。

[Blueprint]
BuildBar 来源是 BlueprintInventory，不是硬编码四个 Button。

[Tool]
全工程只有 BuildToolController 拥有是否处于 Build Mode 的真相。

[Preview]
Ghost 与最终建筑使用同一 atlas frame source 和同一 grid placement 公式。

[Validation]
Ghost 与 Service 使用同一 BuildingPlacementValidator。

[Terrain]
只有 Dirt 可放。

[Occupancy]
Base / Resource / Building 都能阻止 placement；资源删除后 occupancy 同步释放。

[Economy]
多资源成本原子扣除，不允许部分扣费。

[Runtime]
成功建筑进入 BuildingRuntimeRegistry，并生成在 BuildingRoot。

[Navigation]
成功建筑占地写入 NavigationGrid，之后的新路径绕开建筑。

[Input]
Build Mode 时 WorldCommandController 不响应资源/基地指令；点击 BuildBar 不误放建筑。

[Effects]
Building Definition 已有 effectIds；BuildingEffectSystem 可被未来 FloorSystem 调用，但当前不执行玩法效果。

[Code ownership]
所有本轮新增/修改 TS 文件都有 Why / Ownership / Does NOT 头注释。
```

---

# 43. 推荐后续 Phase 1.1 / Phase 2

V2 Phase 1 稳定以后，再按优先级扩展：

```text
Phase 1.1
- 动态导航 revision / 旧路径重规划
- Actor 当前格建造拦截
- placement invalid reason UI 提示
- 连续建造模式（Shift / toggle）

Phase 2
- 蓝图掉落与时代池
- FloorDescended Event
- BuildingEffect Executors
- +资源 / -资源 / +兵员
- 建筑拆除
- 建筑升级

Phase 3
- Defense Tower targeting / attack
- Build crafting
- 研究建筑 3 选 1
- 存档/读档
```

---

# 44. 最终实施原则

本方案实现时优先守住下面五条：

```text
1. Build Mode 只能有一个 owner。
2. Placement 合法性只能有一个 validator。
3. Ghost 与最终落地必须消费同一规则。
4. 一次建造的所有世界修改必须在一个事务服务里完成。
5. Building 数据 / UI / 世界实例 / 效果必须解耦。
```

如果这五条不被破坏，后续加时代、蓝图池、建筑效果、防御塔和拆除时都可以在现有边界上扩展，而不需要再重写 Phase 1。
