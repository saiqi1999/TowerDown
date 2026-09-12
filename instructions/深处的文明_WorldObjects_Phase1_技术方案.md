# 《深处的文明》World Objects Phase 1 技术方案

> **目标**：在当前已经能运行并根据 `STATIC_MAP` 绘制地面的 Cocos Creator 3.8.x 项目中，加入一个主基地和三种基础自然资源（木材、石材、食物）。  
> 本轮只做**静态生成与显示**，不做点击、采集、旗帜、寻路、碰撞、战斗或资源数值。  
> **关键约束**：物体的视觉占地与逻辑占地完全一致，且全部按 16×16 地图格对齐。

---

# 1. 本轮完成后应看到什么

游戏运行后：

```text
Main.scene
└── Canvas
    └── MapRoot
        ├── TileRoot
        │   ├── Tile_0_0
        │   ├── Tile_1_0
        │   └── ...
        │
        └── WorldObjectRoot
            ├── StructureRoot
            │   └── Base_base_main
            └── ResourceRoot
                ├── Resource_wood_01
                ├── Resource_wood_02
                ├── Resource_stone_01
                └── Resource_food_01
```

编辑状态下只需要存在：

```text
MapRoot
├── TileRoot
└── WorldObjectRoot
    ├── StructureRoot
    └── ResourceRoot
```

`Base_*` 和 `Resource_*` 节点全部在运行时由代码生成，停止 Preview 后不写回 `Main.scene`。

---

# 2. 本轮使用的 Atlas

新增两张原始 Atlas，保持整张图片，不裁成独立 PNG。

建议文件名：

```text
assets/art/world/atlas_buildings.png
assets/art/world/atlas_nature.png
```

## 2.1 Building Atlas

原图：

```text
528 × 368 px
```

刚好：

```text
33 × 23 个 16×16 Cell
```

本轮基地使用：

```text
BaseOrange

col = 0
row = 0
w = 4 cells
h = 3 cells

pixel rect:
x = 0
y = 0
width = 64
height = 48
```

逻辑占地：

```text
4 × 3 Grid Cells
```

视觉占地：

```text
4 × 3 Grid Cells
```

两者完全一致。

---

## 2.2 Nature Atlas

原图：

```text
384 × 336 px
```

刚好：

```text
24 × 21 个 16×16 Cell
```

本轮选择以下三个基础资源。

### Wood：圆冠绿树

```text
TreeGreen

col = 0
row = 0
w = 2
h = 2

pixel rect:
x = 0
y = 0
width = 32
height = 32
```

占地：

```text
2 × 2
```

### Stone：灰色独立岩石

```text
StoneGray

col = 16
row = 8
w = 2
h = 2

pixel rect:
x = 256
y = 128
width = 32
height = 32
```

占地：

```text
2 × 2
```

### Food：红色果实植物

```text
FoodPlantRed

col = 3
row = 11
w = 1
h = 1

pixel rect:
x = 48
y = 176
width = 16
height = 16
```

占地：

```text
1 × 1
```

---

# 3. 统一占地规则

这一版正式规定：

> **Atlas Sprite Rect 是几格，逻辑上就占几格。**

因此：

```text
BaseOrange   4×3 visual → 4×3 logical
TreeGreen    2×2 visual → 2×2 logical
StoneGray    2×2 visual → 2×2 logical
FoodPlantRed 1×1 visual → 1×1 logical
```

禁止出现：

```text
32×32 树
但逻辑只占 1×1
```

也禁止在数据层重复维护：

```text
sprite width/height
+
footprint width/height
```

**逻辑占地直接由 Atlas Definition 的 `w/h` 推导。**

这样资源替换以后不会出现视觉尺寸和逻辑尺寸不同步。

---

# 4. Grid 坐标规则

地图继续使用：

```text
map[y][x]
```

左上角为：

```text
(0, 0)
```

`WorldObjectData.gridX/gridY` 表示：

> **该物体逻辑占地区域的左上角 Cell。**

例如：

```text
Base:
gridX = 4
gridY = 2
w = 4
h = 3
```

代表占用：

```text
x = 4,5,6,7
y = 2,3,4
```

即：

```text
(4,2) (5,2) (6,2) (7,2)
(4,3) (5,3) (6,3) (7,3)
(4,4) (5,4) (6,4) (7,4)
```

---

# 5. 多格物体的世界坐标

禁止把多格物体按照某一个 Cell 的中心摆放。

统一使用：

> **占地矩形中心 = Sprite Node 世界位置。**

如果：

```text
gridX
gridY
gridW
gridH
```

则世界中心为：

```text
left + (gridX + gridW / 2) * CELL_RENDER_SIZE

top  - (gridY + gridH / 2) * CELL_RENDER_SIZE
```

其中 `left/top` 和当前 TileMap 使用完全相同的地图居中规则。

因此：

```text
4×3 Base Sprite
```

会与：

```text
4×3 Grid Rect
```

像素级对齐。

Node / UITransform 使用：

```text
Anchor = Center (0.5, 0.5)
```

本轮不要使用 bottom-center Anchor。

---

# 6. 本轮文件变更总览

## 6.1 新增美术文件

```text
assets/art/world/
├── atlas_buildings.png
└── atlas_nature.png
```

## 6.2 新增公共 Grid 文件

```text
assets/scripts/grid/
├── GridConfig.ts
└── GridTransform.ts
```

## 6.3 新增 World Object 文件

```text
assets/scripts/world/
├── WorldObjectTypes.ts
├── WorldAtlasConfig.ts
├── StaticWorldObjects.ts
├── WorldObjectView.ts
└── WorldObjectRenderer.ts
```

## 6.4 修改已有文件

```text
assets/scripts/map/TerrainAtlas.ts
assets/scripts/map/MapRenderer.ts
assets/scripts/main/MainMapController.ts
assets/scenes/Main.scene
```

如果当前 `MainMapController.ts` 仍在：

```text
assets/scripts/map/
```

不要为了本轮强制移动文件，只修改原位置即可。

---

# 7. GridConfig.ts

新增：

```text
assets/scripts/grid/GridConfig.ts
```

职责：

> 地面和 World Object 共用同一份 Grid 尺寸定义。

建议：

```ts
export const GRID_SOURCE_SIZE = 16;
export const GRID_RENDER_SCALE = 3;

export const GRID_RENDER_SIZE =
    GRID_SOURCE_SIZE * GRID_RENDER_SCALE;
```

然后把之前：

```text
TerrainAtlas.ts
```

中的：

```ts
TILE_SOURCE_SIZE
TILE_RENDER_SCALE
TILE_RENDER_SIZE
```

迁移到这里。

## 要求

`MapRenderer` 和 `WorldObjectRenderer` 都必须 import 这一份配置。

禁止两边分别写：

```ts
const TILE_SIZE = 16;
```

否则后续很容易错位。

---

# 8. GridTransform.ts

新增：

```text
assets/scripts/grid/GridTransform.ts
```

职责：

> 统一处理 Grid → Cocos World Position。

至少提供两个方法。

## 8.1 单格中心

```ts
gridCellToWorldCenter(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3
```

供地面 Tile 使用。

## 8.2 多格矩形中心

```ts
gridRectToWorldCenter(
    gridX: number,
    gridY: number,
    gridW: number,
    gridH: number,
    mapWidth: number,
    mapHeight: number,
): Vec3
```

供基地、资源、未来建筑使用。

实现原则：

```text
Map 在 MapRoot 中整体居中

地图宽：
mapWidth * GRID_RENDER_SIZE

地图高：
mapHeight * GRID_RENDER_SIZE
```

多格 Rect Center：

```ts
const totalWidth =
    mapWidth * GRID_RENDER_SIZE;

const totalHeight =
    mapHeight * GRID_RENDER_SIZE;

const x =
    -totalWidth / 2
    + (gridX + gridW / 2)
    * GRID_RENDER_SIZE;

const y =
    totalHeight / 2
    - (gridY + gridH / 2)
    * GRID_RENDER_SIZE;
```

返回：

```ts
new Vec3(x, y, 0)
```

---

# 9. 修改 MapRenderer.ts

当前 `MapRenderer` 如果仍然自己计算：

```ts
posX
posY
```

将这部分替换为：

```ts
gridCellToWorldCenter(...)
```

目标：

> 地面和 World Object 绝对不能各自维护一套坐标换算。

除了坐标换算，本轮不要重写现有 MapRenderer。

---

# 10. WorldObjectTypes.ts

新增：

```text
assets/scripts/world/WorldObjectTypes.ts
```

建议结构：

```ts
export enum WorldObjectKind {
    Base = 0,
    Resource = 1,
}

export enum ResourceType {
    Wood = 0,
    Stone = 1,
    Food = 2,
}

export enum WorldVisualId {
    BaseOrange = 0,
    TreeGreen = 1,
    StoneGray = 2,
    FoodPlantRed = 3,
}

export interface WorldObjectData {
    id: string;

    kind: WorldObjectKind;

    visualId: WorldVisualId;

    resourceType?: ResourceType;

    gridX: number;
    gridY: number;
}
```

注意：

**这里不保存 `gridW/gridH`。**

`gridW/gridH` 必须根据：

```text
WorldVisualId
↓
WorldAtlasConfig
↓
w / h
```

得到。

这样视觉和逻辑占地不会出现双份配置。

---

# 11. WorldAtlasConfig.ts

新增：

```text
assets/scripts/world/WorldAtlasConfig.ts
```

定义：

```ts
export enum WorldAtlasKey {
    Buildings = 0,
    Nature = 1,
}

export interface WorldVisualDefinition {
    atlas: WorldAtlasKey;

    col: number;
    row: number;

    w: number;
    h: number;
}
```

配置：

```ts
export const WORLD_VISUALS:
Record<WorldVisualId, WorldVisualDefinition> = {

    [WorldVisualId.BaseOrange]: {
        atlas: WorldAtlasKey.Buildings,
        col: 0,
        row: 0,
        w: 4,
        h: 3,
    },

    [WorldVisualId.TreeGreen]: {
        atlas: WorldAtlasKey.Nature,
        col: 0,
        row: 0,
        w: 2,
        h: 2,
    },

    [WorldVisualId.StoneGray]: {
        atlas: WorldAtlasKey.Nature,
        col: 16,
        row: 8,
        w: 2,
        h: 2,
    },

    [WorldVisualId.FoodPlantRed]: {
        atlas: WorldAtlasKey.Nature,
        col: 3,
        row: 11,
        w: 1,
        h: 1,
    },
};
```

Pixel Rect 统一通过：

```ts
x = col * GRID_SOURCE_SIZE;
topY = row * GRID_SOURCE_SIZE;

width =
    w * GRID_SOURCE_SIZE;

height =
    h * GRID_SOURCE_SIZE;
```

得到。

禁止在其他文件重新写这些 Atlas 坐标。

---

# 12. StaticWorldObjects.ts

新增：

```text
assets/scripts/world/StaticWorldObjects.ts
```

本轮只生成：

```text
Base ×1
Wood ×2
Stone ×1
Food ×1
```

如果当前地图还是上一阶段的 `12×8`，建议：

```ts
export const STATIC_WORLD_OBJECTS:
WorldObjectData[] = [

    {
        id: 'base_main',
        kind: WorldObjectKind.Base,
        visualId: WorldVisualId.BaseOrange,
        gridX: 4,
        gridY: 2,
    },

    {
        id: 'wood_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Wood,
        visualId: WorldVisualId.TreeGreen,
        gridX: 1,
        gridY: 1,
    },

    {
        id: 'wood_02',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Wood,
        visualId: WorldVisualId.TreeGreen,
        gridX: 9,
        gridY: 1,
    },

    {
        id: 'stone_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Stone,
        visualId: WorldVisualId.StoneGray,
        gridX: 1,
        gridY: 5,
    },

    {
        id: 'food_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Food,
        visualId: WorldVisualId.FoodPlantRed,
        gridX: 10,
        gridY: 6,
    },
];
```

如果实际 `STATIC_MAP` 已经不是 `12×8`：

1. 不修改 Terrain Map；
2. 先读取实际 mapWidth/mapHeight；
3. 保证所有对象在边界内；
4. 保证占地不重叠；
5. 基地尽量仍放中央；
6. 回报最终实际坐标。

不要为了迁就示例坐标修改现有地图。

---

# 13. WorldObjectView.ts

新增：

```text
assets/scripts/world/WorldObjectView.ts
```

这是一个**纯元数据 Component**，本轮不处理任何输入。

目的：

> 为下一轮从 Node 找回 World Object ID 留出稳定入口。

建议：

```ts
@ccclass('WorldObjectView')
export class WorldObjectView extends Component {

    public objectId = '';

    public kind = WorldObjectKind.Resource;

    public gridX = 0;
    public gridY = 0;

    public gridW = 1;
    public gridH = 1;

    public resourceType:
        ResourceType | null = null;
}
```

生成节点时由 Renderer 填入。

本轮禁止：

```text
onClick
onTouch
Flag
Gather
Collision
```

---

# 14. WorldObjectRenderer.ts

新增：

```text
assets/scripts/world/WorldObjectRenderer.ts
```

职责：

```text
WorldObjectData[]
↓
查 WorldVisualDefinition
↓
确定 Atlas Texture
↓
生成 SpriteFrame Rect
↓
生成 Node
↓
放进 StructureRoot / ResourceRoot
```

Constructor 建议接受：

```ts
constructor(
    structureRoot: Node,
    resourceRoot: Node,

    buildingTexture: Texture2D,
    natureTexture: Texture2D,
)
```

核心 API：

```ts
render(
    objects: WorldObjectData[],
    mapWidth: number,
    mapHeight: number,
): void

clear(): void
```

---

# 15. WorldObjectRenderer 节点生成规则

对于每条 `WorldObjectData`：

## 15.1 查 Definition

```text
data.visualId
↓
WORLD_VISUALS
↓
atlas / col / row / w / h
```

## 15.2 验证占地

必须检查：

```text
gridX >= 0
gridY >= 0

gridX + w <= mapWidth
gridY + h <= mapHeight
```

否则：

```ts
throw new Error(...)
```

## 15.3 验证对象之间不能重叠

本轮因为已经正式采用逻辑占地，所以 Renderer 在生成前必须做最基础的占用检查。

例如用：

```text
Set<string>
```

记录：

```text
"x,y"
```

对于每个 Object：

```text
for y in gridY .. gridY+h-1
    for x in gridX .. gridX+w-1
```

如果 Cell 已经被其他 World Object 占用：

```ts
throw new Error(
    `[WorldObjectRenderer] overlap at (${x}, ${y})`
);
```

当前：

> **只检查 World Object 相互重叠。**

暂时不检查：

- Dirt 是否允许建基地；
- Grass 是否允许资源；
- 路径；
- 战士占位。

---

# 16. SpriteFrame 切片规则

Building / Nature Atlas 都以图片左上角为 `(0,0)` Cell。

Cocos `SpriteFrame Rect` 如果需要底部纹理坐标转换，使用：

```ts
const leftX =
    definition.col * GRID_SOURCE_SIZE;

const topY =
    definition.row * GRID_SOURCE_SIZE;

const width =
    definition.w * GRID_SOURCE_SIZE;

const height =
    definition.h * GRID_SOURCE_SIZE;

const cocosY =
    texture.height
    - topY
    - height;
```

然后创建：

```text
Rect(
    leftX,
    cocosY,
    width,
    height
)
```

不要假设 Atlas 一定高 416px。

始终使用：

```ts
texture.height
```

---

# 17. Sprite Node 尺寸与缩放

例如 Tree：

```text
source:
32×32
```

UITransform：

```text
32×32
```

Node Scale：

```text
GRID_RENDER_SCALE
```

如果 Scale = 3：

```text
display:
96×96
```

而：

```text
2×2 Cells
=
2 × 48
=
96×96
```

完全对齐。

Base：

```text
64×48 source
×3
=
192×144
```

逻辑：

```text
4×3 cells
=
192×144
```

完全一致。

**禁止为单个物体额外调整 Scale。**

---

# 18. Node 命名与 Root 规则

Base：

```text
Base_<id>
```

例如：

```text
Base_base_main
```

资源：

```text
Resource_<id>
```

例如：

```text
Resource_wood_01
```

父节点：

```text
WorldObjectKind.Base
→ StructureRoot

WorldObjectKind.Resource
→ ResourceRoot
```

以后可以继续增加：

```text
CampRoot
SquadRoot
EffectRoot
```

本轮不要提前创建。

---

# 19. 修改 Main.scene

在 Cocos Editor 中打开：

```text
assets/scenes/Main.scene
```

当前已有：

```text
Canvas
└── MapRoot
    └── TileRoot
```

手工改成：

```text
Canvas
└── MapRoot
    ├── TileRoot
    └── WorldObjectRoot
        ├── StructureRoot
        └── ResourceRoot
```

三个新节点都是普通 Empty Node。

统一：

```text
Position = 0,0,0
Scale = 1,1,1
Rotation = 0
Layer = UI_2D
```

保存 Scene。

不要手工在 Scene 中创建：

```text
Base_main
Tree
Stone
Food
```

这些必须运行时生成。

---

# 20. 修改 MainMapController.ts

新增 Inspector 字段：

```ts
@property(Node)
public structureRoot: Node | null = null;

@property(Node)
public resourceRoot: Node | null = null;

@property(Texture2D)
public buildingAtlasTexture:
    Texture2D | null = null;

@property(Texture2D)
public natureAtlasTexture:
    Texture2D | null = null;
```

在 Cocos Inspector 中绑定：

```text
StructureRoot
→ structureRoot

ResourceRoot
→ resourceRoot

atlas_buildings.png Texture2D
→ buildingAtlasTexture

atlas_nature.png Texture2D
→ natureAtlasTexture
```

---

# 21. MainMapController 启动顺序

当前：

```text
start
↓
MapRenderer.render(STATIC_MAP)
```

修改成：

```text
start
↓
validate Inspector references
↓
MapRenderer.render(STATIC_MAP)
↓
WorldObjectRenderer.render(
    STATIC_WORLD_OBJECTS
)
```

mapWidth：

```ts
STATIC_MAP[0].length
```

mapHeight：

```ts
STATIC_MAP.length
```

要求先画 Terrain，再生成 World Objects。

---

# 22. Atlas 导入设置

对：

```text
atlas_buildings.png
atlas_nature.png
```

在 Cocos Inspector 中设置：

```text
Filter = Nearest / Point
Mipmap = Off（若当前版本提供）
```

不要在运行时代码里写：

```ts
TextureFilter.NEAREST
```

过滤方式本轮仍由资源 Inspector 配置。

---

# 23. 本轮明确禁止的内容

不要实现：

```text
点击
触摸
资源数量
采集
旗帜
Squad
寻路
碰撞体
物理
资源耗尽
资源刷新
Camp
随机 World Object 生成
建筑放置
Y-Sort System
对象池
Chunk
Mesh
Prefab
```

这一轮只建立：

```text
Static WorldObject Data
→
Atlas Rect
→
Runtime Node
```

---

# 24. Definition of Done

全部满足才结束。

## Scene

- [ ] `Main.scene` 可以正常 Preview
- [ ] `MapRoot/TileRoot` 保持原样
- [ ] 新增 `WorldObjectRoot`
- [ ] 新增 `StructureRoot`
- [ ] 新增 `ResourceRoot`

## Atlas

- [ ] Building Atlas 使用整图
- [ ] Nature Atlas 使用整图
- [ ] 没有裁独立 PNG
- [ ] Pixel Art 为 Nearest / Point

## 数据

- [ ] Base 使用 `(col0,row0,w4,h3)`
- [ ] Wood 使用 `(col0,row0,w2,h2)`
- [ ] Stone 使用 `(col16,row8,w2,h2)`
- [ ] Food 使用 `(col3,row11,w1,h1)`
- [ ] WorldObjectData 不重复保存 `w/h`
- [ ] `w/h` 完全由 WorldVisualDefinition 得到

## Grid

- [ ] 地面和物体共用 `GridConfig.ts`
- [ ] 地面和物体共用 `GridTransform.ts`
- [ ] Visual Footprint = Logical Footprint
- [ ] Base 真正占用 4×3
- [ ] Tree 真正占用 2×2
- [ ] Stone 真正占用 2×2
- [ ] Food 真正占用 1×1

## Runtime

- [ ] 中央能看到 Base
- [ ] 至少能看到 2 棵 Wood Tree
- [ ] 能看到 1 个 Stone
- [ ] 能看到 1 个 Food
- [ ] Base 位于 `StructureRoot`
- [ ] Resources 位于 `ResourceRoot`
- [ ] Runtime Node 都带 `WorldObjectView`
- [ ] Runtime Object 不互相占用相同 Grid Cell

## 修改验证

只修改：

```text
StaticWorldObjects.ts
```

中的：

```text
gridX/gridY
```

再次 Preview：

- [ ] 对象按照 Grid 正确移动
- [ ] Sprite 和占地仍然完全对齐
- [ ] 不需要修改 Renderer
- [ ] 不需要重新裁图
- [ ] 不需要修改 Main.scene

---

# 25. Agent 完成后必须回报

必须提供：

```text
1. 实际 Cocos Creator 版本

2. 最终 Main.scene Hierarchy

3. StaticMap 的实际 width × height

4. StaticWorldObjects 的最终坐标

5. Runtime Hierarchy 截图

6. 游戏画面截图

7. 将 wood_01 改到另一个合法 Grid 后的截图

8. Console 日志

9. 如果 Atlas Rect 和本方案选择不符，
   停止自行猜测并说明实际显示结果
```

建议新增日志：

```text
[WorldObjectRenderer] rendered 5 world objects.
```

---

# 26. 本轮架构结果

完成后项目的数据链路应为：

```text
STATIC_MAP
↓
MapRenderer
↓
TileRoot


STATIC_WORLD_OBJECTS
↓
WorldObjectRenderer
↓
WorldAtlasConfig
↓
StructureRoot / ResourceRoot
```

二者共用：

```text
GridConfig
+
GridTransform
```

下一轮做交互时，可以直接从：

```text
点击 WorldObject Node
↓
WorldObjectView.objectId
↓
查 WorldObjectData
↓
成为 Squad Target
```

继续扩展，而不需要重新修改本轮的地图与对象表示方式。
