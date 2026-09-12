# World Objects Phase 1 Design

## Goal

在现有可根据 `STATIC_MAP` 渲染地面的项目上，加入一层静态世界物体系统：

- `Base x1`
- `Wood x2`
- `Stone x1`
- `Food x1`

本轮只做：

- 静态数据
- atlas rect 映射
- 运行时节点生成
- 结构化 root 分层

本轮不做：

- 点击
- 采集
- 旗帜
- 寻路
- 碰撞
- 战斗
- 数值
- 随机生成

## Agreed Constraints

- 场景路径使用当前工程实际路径：`assets/Main.scene`
- `WorldObjectRoot / StructureRoot / ResourceRoot` 已在 Cocos 编辑器中创建
- 公共格子尺寸统一为：
  - `GRID_SOURCE_SIZE = 16`
  - `GRID_RENDER_SCALE = 2`
  - `GRID_RENDER_SIZE = 32`
- `@property` 保留，但缺失时需要代码兜底
- 地面与世界物体必须共用同一套 grid 配置与坐标换算

## Architecture

### Existing Terrain Chain

保持现有链路：

`STATIC_MAP -> MapRenderer -> TileRoot`

### New World Object Chain

新增链路：

`STATIC_WORLD_OBJECTS -> WorldObjectRenderer -> WorldAtlasConfig -> StructureRoot / ResourceRoot`

### Shared Grid Layer

新增公共层：

- `assets/scripts/grid/GridConfig.ts`
- `assets/scripts/grid/GridTransform.ts`

地面与世界物体都依赖这一层，避免维护两套坐标系统。

## File Plan

### New Files

- `assets/scripts/grid/GridConfig.ts`
- `assets/scripts/grid/GridTransform.ts`
- `assets/scripts/world/WorldObjectTypes.ts`
- `assets/scripts/world/WorldAtlasConfig.ts`
- `assets/scripts/world/StaticWorldObjects.ts`
- `assets/scripts/world/WorldObjectView.ts`
- `assets/scripts/world/WorldObjectRenderer.ts`

### Modified Files

- `assets/scripts/map/TerrainAtlas.ts`
- `assets/scripts/map/MapRenderer.ts`
- `assets/scripts/map/MainMapController.ts`
- `assets/Main.scene`

## Data Model

### WorldObjectTypes

`WorldObjectData` 只保存：

- `id`
- `kind`
- `visualId`
- `resourceType?`
- `gridX`
- `gridY`

不保存 `gridW / gridH`。

### WorldAtlasConfig

`WorldVisualId -> atlas / col / row / w / h`

本轮固定 atlas 定义：

- `BaseOrange -> Buildings (0, 0, 4, 3)`
- `TreeGreen -> Nature (0, 0, 2, 2)`
- `StoneGray -> Nature (16, 8, 2, 2)`
- `FoodPlantRed -> Nature (3, 11, 1, 1)`

逻辑占地直接由 `w / h` 推导。

## Grid Rules

- 地图坐标使用 `map[y][x]`
- 左上角是 `(0, 0)`
- `gridX / gridY` 表示对象逻辑占地左上角 cell
- 单格地面位置使用 `gridCellToWorldCenter(...)`
- 多格物体位置使用 `gridRectToWorldCenter(...)`

矩形中心计算规则：

```ts
const x =
    -totalWidth / 2
    + (gridX + gridW / 2) * GRID_RENDER_SIZE;

const y =
    totalHeight / 2
    - (gridY + gridH / 2) * GRID_RENDER_SIZE;
```

## Rendering Rules

### Terrain

- `MapRenderer` 保留现有主体逻辑
- 只把坐标换算替换为 `GridTransform`

### World Objects

`WorldObjectRenderer` 负责：

- 读取 `StaticWorldObjects`
- 查询 `WorldAtlasConfig`
- 校验越界
- 校验世界物体之间不重叠
- 创建运行时 node
- 挂载 `WorldObjectView`
- 放入 `StructureRoot` 或 `ResourceRoot`

### SpriteFrame

atlas 使用整图，不切独立 PNG。

切图规则：

```ts
const leftX = definition.col * GRID_SOURCE_SIZE;
const topY = definition.row * GRID_SOURCE_SIZE;
const width = definition.w * GRID_SOURCE_SIZE;
const height = definition.h * GRID_SOURCE_SIZE;
const cocosY = texture.height - topY - height;
```

### Size and Scale

- `UITransform` 使用 source 尺寸
- `Node.scale` 统一使用 `GRID_RENDER_SCALE = 2`
- 不允许为单个对象单独调整 scale

这保证：

- `2x2` 树显示尺寸 = `2x2` 逻辑占地
- `4x3` 基地显示尺寸 = `4x3` 逻辑占地

## Scene and Runtime Hierarchy

编辑态期望：

```text
Canvas
└── MapRoot
    ├── TileRoot
    └── WorldObjectRoot
        ├── StructureRoot
        └── ResourceRoot
```

运行态期望：

```text
Canvas
└── MapRoot
    ├── TileRoot
    └── WorldObjectRoot
        ├── StructureRoot
        │   └── Base_base_main
        └── ResourceRoot
            ├── Resource_wood_01
            ├── Resource_wood_02
            ├── Resource_stone_01
            └── Resource_food_01
```

命名规则：

- Base: `Base_<id>`
- Resource: `Resource_<id>`

## Inspector Fallback Strategy

`MainMapController` 保留：

- `structureRoot`
- `resourceRoot`
- `buildingAtlasTexture`
- `natureAtlasTexture`

查找顺序：

1. 优先使用 Inspector 已绑定引用
2. 若为空，按节点名或资源兜底查找
3. 若仍缺失，抛出明确错误

## Initial Static Placement

基于当前 `40 x 23` 地图，第一版静态摆放为：

- `base_main -> (18, 10)` 占 `4x3`
- `wood_01 -> (6, 5)` 占 `2x2`
- `wood_02 -> (30, 5)` 占 `2x2`
- `stone_01 -> (7, 16)` 占 `2x2`
- `food_01 -> (31, 17)` 占 `1x1`

约束：

- 不越界
- 不彼此重叠
- Base 尽量位于地图中央

## Logging and Errors

至少输出：

```text
[WorldObjectRenderer] rendered 5 world objects.
```

以下情况必须明确报错：

- atlas definition 缺失
- root 节点缺失
- atlas texture 缺失
- world object 越界
- world object 相互重叠

## Test Focus

本轮完成后应验证：

1. Terrain 仍正常显示
2. Base 显示在 `StructureRoot`
3. 两棵树、一块石头、一个食物显示在 `ResourceRoot`
4. `WorldObjectView` 正确挂载到运行时节点
5. 只改 `StaticWorldObjects.ts` 的 `gridX / gridY`，对象可正确移动
6. 不需要修改 Renderer、Main.scene 或重新裁图

## Out of Scope

明确不做：

- 点击 / 触摸
- 资源数量 / 采集
- 旗帜 / Squad
- 寻路 / 碰撞 / 物理
- 建筑放置
- Y-Sort
- 对象池 / Chunk / Mesh / Prefab

## Notes

- 本轮不移动 `MainMapController.ts` 的现有路径
- 本轮不提交 git commit，除非用户单独要求
