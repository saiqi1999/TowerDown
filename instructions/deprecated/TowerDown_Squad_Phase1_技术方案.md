# 《深处的文明 / TowerDown》Squad Phase 1 技术方案
## 初始战士小队 + 基地附近 Idle/Wander AI

> **适用仓库**：`saiqi1999/TowerDown`  
> **目标分支基线**：`main`  
> **Cocos Creator**：3.8.8  
> **当前地图**：40 × 23 Grid  
> **Grid Source Size**：16 px  
> **Grid Render Scale**：2  
> **Grid Render Size**：32 px  
> **本轮目标**：加入 1 支初始小队（4 名剑士视觉成员），小队出生于 `base_main` 前方，并在基地附近进行“闲逛 → 停顿 → 闲逛”的循环。  
> **本轮明确不做**：点击、旗帜、寻路、碰撞、战斗、敌人、资源采集、Y-Sort、动画状态机扩展、存档。

---

# 1. 开发前必须确认的当前工程状态

当前工程关键目录：

```text
assets/
├── Main.scene
├── art/
│   ├── terrain/
│   │   └── terrain.png
│   ├── world/
│   │   ├── atlas_buildings.png
│   │   └── atlas_nature.png
│   └── source/
│
└── scripts/
    ├── grid/
    │   ├── GridConfig.ts
    │   └── GridTransform.ts
    │
    ├── map/
    │   ├── MainMapController.ts
    │   ├── MapRenderer.ts
    │   ├── MapResolver.ts
    │   ├── MapTypes.ts
    │   ├── StaticMap.ts
    │   └── TerrainAtlas.ts
    │
    └── world/
        ├── StaticWorldObjects.ts
        ├── WorldAtlasConfig.ts
        ├── WorldObjectRenderer.ts
        ├── WorldObjectTypes.ts
        └── WorldObjectView.ts
```

当前 Scene 目标结构应为：

```text
Canvas
├── Camera
└── MapRoot
    ├── TileRoot
    └── WorldObjectRoot
        ├── StructureRoot
        └── ResourceRoot
```

当前 `base_main`：

```text
gridX = 18
gridY = 10
visual = BaseOrange
visual size = 4 × 3 Grid
```

所以基地逻辑占地：

```text
x = 18..21
y = 10..12
```

基地中心：

```text
(20, 11.5)
```

基地底边：

```text
y = 13
```

---

# 2. 开发前先修复两个已有问题

这两项是 Squad 开发的前置条件，必须先处理。

---

## 2.1 修复 MainMapController 二次创建 MapRoot

当前 `MainMapController` 已经挂在 `MapRoot` 节点上。

因此：

```ts
const mapRoot = this.getOrCreateChild(this.node, 'MapRoot');
```

是错误逻辑，会导致运行时出现：

```text
MapRoot
└── MapRoot
```

### 修改原则

在：

```text
assets/scripts/map/MainMapController.ts
```

中：

```ts
const mapRoot = this.node;
```

直接把当前组件所在节点视为 `MapRoot`。

之后从该节点查：

```text
TileRoot
WorldObjectRoot
```

再从 `WorldObjectRoot` 查：

```text
StructureRoot
ResourceRoot
```

### 本轮建议

Scene Root 属于工程结构，不应该在运行时默默补齐。

新增一个严格 helper：

```ts
private requireChild(parent: Node, name: string): Node {
    const child = parent.getChildByName(name);
    if (!child) {
        throw new Error(
            `[MainMapController] required node missing: ${parent.name}/${name}`
        );
    }
    return child;
}
```

替换关键 Scene Root 的 `getOrCreateChild`。

**运行时只创建真正的数据节点，不创建结构 Root。**

---

## 2.2 修复 WorldObjectRenderer Atlas Y Flip

当前：

```text
assets/scripts/world/WorldObjectRenderer.ts
```

如果仍存在：

```ts
const cocosY = texture.height - rect.y - rect.height;
```

必须删除。

统一改为：

```ts
frame.rect = new Rect(
    rect.x,
    rect.y,
    rect.width,
    rect.height,
);
```

本工程当前 Atlas 坐标语义统一为：

```text
col / row
↓
左上角网格坐标
↓
pixelX = col * 16
pixelY = row * 16
```

Renderer 不再做 Y 轴翻转。

---

# 3. 本轮新增资源

新增：

```text
assets/art/units/
└── warrior_sword.png
```

使用用户提供的 64×64 Sprite Sheet。

不要切成 16 张独立 PNG。

---

# 4. 战士 Sprite Sheet 规则

原图：

```text
64 × 64 px
```

单帧：

```text
16 × 16 px
```

因此：

```text
4 columns × 4 rows
```

本轮按以下规则读取：

```text
column 0 = Down
column 1 = Up
column 2 = Left
column 3 = Right

row 0 = frame 0
row 1 = frame 1
row 2 = frame 2
row 3 = frame 3
```

即：

> **方向在列，动画帧在行。**

SpriteFrame Rect：

```ts
x = directionColumn * 16;
y = animationFrame * 16;
width = 16;
height = 16;
```

禁止做 Y Flip。

---

# 5. Cocos 导入设置

在 Cocos Creator 中导入：

```text
assets/art/units/warrior_sword.png
```

Texture 设置：

```text
Filter Mode = Nearest / Point
MipMap = Off
```

SpriteFrame 不需要手工切片。

本轮运行时动态创建 16 个 `SpriteFrame` 并 Cache。

---

# 6. 本轮 Scene 结构调整

手工修改：

```text
assets/Main.scene
```

由：

```text
MapRoot
├── TileRoot
└── WorldObjectRoot
    ├── StructureRoot
    └── ResourceRoot
```

改为：

```text
MapRoot
├── TileRoot
├── WorldObjectRoot
│   ├── StructureRoot
│   └── ResourceRoot
│
└── ActorRoot
    └── SquadRoot
```

## 新节点属性

### ActorRoot

```text
Node Type = Empty Node
Position = (0,0,0)
Scale = (1,1,1)
Rotation = 0
Layer = UI_2D
```

添加：

```text
UITransform
```

### SquadRoot

```text
Parent = ActorRoot
Position = (0,0,0)
Scale = (1,1,1)
Rotation = 0
Layer = UI_2D
```

添加：

```text
UITransform
```

**不要手工创建具体 Squad 或 Warrior。**

---

# 7. 本轮新增代码文件总览

新增：

```text
assets/scripts/squad/
├── SquadTypes.ts
├── StaticSquads.ts
├── WarriorSpriteConfig.ts
├── WarriorAnimator.ts
├── SquadIdleAI.ts
└── SquadRenderer.ts
```

修改：

```text
assets/scripts/grid/GridTransform.ts
assets/scripts/map/MainMapController.ts
assets/scripts/world/WorldObjectRenderer.ts
assets/Main.scene
```

新增美术：

```text
assets/art/units/warrior_sword.png
```

不要增加：

```text
CombatSystem
FlagSystem
PathFinder
NavGrid
CollisionSystem
EnemySystem
SquadTargetSystem
SaveSystem
```

---

# 8. GridTransform.ts 升级

当前已有：

```ts
gridCellToWorldCenter(...)
gridRectToWorldCenter(...)
```

本轮增加连续坐标接口：

```ts
export function gridPointToWorld(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3
```

## 坐标定义

这里的 `gridX/gridY` 是连续 Grid Line 坐标：

```text
(0,0)
= 地图左上角

(0.5,0.5)
= 第一个 Tile 中心

(1.5,0.5)
= 第二个 Tile 中心
```

实现：

```ts
export function gridPointToWorld(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    const totalWidth = mapWidth * GRID_RENDER_SIZE;
    const totalHeight = mapHeight * GRID_RENDER_SIZE;

    return new Vec3(
        -totalWidth / 2 + gridX * GRID_RENDER_SIZE,
        totalHeight / 2 - gridY * GRID_RENDER_SIZE,
        0,
    );
}
```

然后把原两个函数改成复用：

```ts
export function gridCellToWorldCenter(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    return gridPointToWorld(
        gridX + 0.5,
        gridY + 0.5,
        mapWidth,
        mapHeight,
    );
}
```

```ts
export function gridRectToWorldCenter(
    gridX: number,
    gridY: number,
    gridW: number,
    gridH: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    return gridPointToWorld(
        gridX + gridW / 2,
        gridY + gridH / 2,
        mapWidth,
        mapHeight,
    );
}
```

目的：

> 静态地图和动态 Squad 继续共用同一个 Grid 坐标体系。

---

# 9. SquadTypes.ts

新增：

```text
assets/scripts/squad/SquadTypes.ts
```

推荐：

```ts
export enum WarriorVisualId {
    SwordWarrior = 0,
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface SquadSpawnData {
    id: string;

    warriorVisualId: WarriorVisualId;

    memberCount: number;

    homeObjectId: string;
}
```

本轮不增加：

```text
hp
attack
speed stat
camp
target id
combat state
```

只保存当前需要的 Spawn 信息。

---

# 10. StaticSquads.ts

新增：

```text
assets/scripts/squad/StaticSquads.ts
```

内容：

```ts
import {
    type SquadSpawnData,
    WarriorVisualId,
} from './SquadTypes';

export const STATIC_SQUADS: SquadSpawnData[] = [
    {
        id: 'initial_01',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
    },
];
```

关键规则：

> Squad 不保存固定出生 `(x,y)`。

它只保存：

```text
homeObjectId = base_main
```

出生位置从基地对象动态计算。

---

# 11. WarriorSpriteConfig.ts

新增：

```text
assets/scripts/squad/WarriorSpriteConfig.ts
```

推荐：

```ts
import {
    Rect,
    Size,
    SpriteFrame,
    Texture2D,
    Vec2,
} from 'cc';

export enum WarriorDirection {
    Down = 0,
    Up = 1,
    Left = 2,
    Right = 3,
}

export const WARRIOR_FRAME_SIZE = 16;
export const WARRIOR_WALK_FRAME_COUNT = 4;

const DIRECTION_COLUMN: Record<WarriorDirection, number> = {
    [WarriorDirection.Down]: 0,
    [WarriorDirection.Up]: 1,
    [WarriorDirection.Left]: 2,
    [WarriorDirection.Right]: 3,
};
```

建议额外实现：

```ts
export function createWarriorFrame(
    texture: Texture2D,
    direction: WarriorDirection,
    frameIndex: number,
): SpriteFrame
```

内部：

```ts
const column = DIRECTION_COLUMN[direction];

const rect = new Rect(
    column * WARRIOR_FRAME_SIZE,
    frameIndex * WARRIOR_FRAME_SIZE,
    WARRIOR_FRAME_SIZE,
    WARRIOR_FRAME_SIZE,
);
```

然后创建 `SpriteFrame`。

不要 Y Flip。

---

# 12. WarriorAnimator.ts

新增：

```text
assets/scripts/squad/WarriorAnimator.ts
```

它是 Component。

职责：

```text
SpriteFrame 动画
```

不负责：

```text
位置
AI
目标
Squad 状态
```

---

## 12.1 状态字段

建议：

```ts
private sprite: Sprite | null = null;

private direction =
    WarriorDirection.Down;

private moving = false;

private frameIndex = 0;

private frameTimer = 0;

private frameDuration = 0.15;

private phaseOffset = 0;
```

---

## 12.2 初始化

提供：

```ts
public setup(
    sprite: Sprite,
    texture: Texture2D,
    phaseOffset: number,
): void
```

初始化：

```text
16 张 SpriteFrame Cache
```

或者更推荐：

> SpriteFrame Cache 放到 `SquadRenderer` / 独立工厂中，所有 Warrior 共用。

不要每个 Warrior 重复创建 16 份 Frame。

---

## 12.3 对外接口

至少：

```ts
public setDirection(
    direction: WarriorDirection
): void

public setMoving(
    moving: boolean
): void
```

---

## 12.4 动画规则

### Moving = true

每：

```text
0.15 sec
```

推进：

```text
0 → 1 → 2 → 3 → 0
```

### Moving = false

显示：

```text
row 0
```

保留当前 Direction。

---

## 12.5 不同步步伐

4 名 Warrior 使用不同 `phaseOffset`：

```text
0
2
1
3
```

或者：

```text
0
1
2
3
```

只要不是全部为 0。

目标：

> 四个人移动时不要完全同步迈腿。

---

# 13. SquadIdleAI.ts

新增：

```text
assets/scripts/squad/SquadIdleAI.ts
```

这是本轮核心行为组件。

---

## 13.1 状态

```ts
enum SquadIdleState {
    Idle = 0,
    Wander = 1,
}
```

---

## 13.2 主要字段

推荐：

```ts
private state =
    SquadIdleState.Idle;

private currentGridX = 0;
private currentGridY = 0;

private targetGridX = 0;
private targetGridY = 0;

private idleTimer = 0;

private moveSpeedCellsPerSecond = 1.25;

private mapWidth = 0;
private mapHeight = 0;

private homeLeft = 0;
private homeRight = 0;
private homeBottom = 0;

private warriors:
    WarriorAnimator[] = [];
```

---

# 14. Squad Spawn 与 Home Zone 计算

不要写死：

```text
base = (18,10)
```

流程：

```text
SquadSpawnData.homeObjectId
↓
STATIC_WORLD_OBJECTS.find(...)
↓
找到 base_main
↓
getWorldVisualDefinition(base.visualId)
↓
得到基地 w/h
↓
计算基地边界
```

例如当前：

```text
baseX = 18
baseY = 10
baseW = 4
baseH = 3
```

计算：

```ts
const homeLeft = base.gridX;
const homeRight = base.gridX + baseW;

const homeBottom =
    base.gridY + baseH;
```

当前：

```text
left = 18
right = 22
bottom = 13
```

---

# 15. 初始 Squad 出生点

第一版：

```text
base center X
=
(left + right) / 2

spawnY
=
bottom + 1
```

因此当前：

```text
spawn = (20,14)
```

这是连续 Grid 坐标，不是 Cell Index。

创建 Squad 后：

```ts
squadNode.setPosition(
    gridPointToWorld(
        20,
        14,
        mapWidth,
        mapHeight,
    ),
);
```

---

# 16. Wander Zone

本轮不允许 Squad 绕基地 360° 闲逛。

原因：

> 当前还没有跨 `StructureRoot / SquadRoot` 的世界 Y-Sort。

所以战士跑到基地背面时可能错误显示在屋顶前方。

第一版限定：

> **只在基地正面 / 下方休息区活动。**

---

## 16.1 推荐范围

相对基地：

```ts
wanderMinX =
    homeLeft - 1.5;

wanderMaxX =
    homeRight + 1.5;

wanderMinY =
    homeBottom + 0.5;

wanderMaxY =
    homeBottom + 3.5;
```

当前约：

```text
X = 16.5 ～ 23.5
Y = 13.5 ～ 16.5
```

生成随机点后 Clamp 到地图有效范围：

```text
0.5 <= x <= mapWidth - 0.5

0.5 <= y <= mapHeight - 0.5
```

---

# 17. Idle 状态

进入 Idle：

```text
速度 = 0
所有 Warrior moving = false
```

随机等待：

```text
0.8 ～ 2.5 秒
```

实现：

```ts
idleTimer =
    randomRange(0.8, 2.5);
```

`update(dt)`：

```text
idleTimer -= dt
```

当：

```text
idleTimer <= 0
```

则：

```text
生成 Wander Target
↓
进入 Wander
```

---

# 18. Wander 状态

每帧在 Grid 空间移动。

不要 Tween。

不要直接在 World Pixel 空间随机走。

---

## 18.1 计算向量

```ts
const dx =
    targetGridX - currentGridX;

const dy =
    targetGridY - currentGridY;

const distance =
    Math.sqrt(dx * dx + dy * dy);
```

---

## 18.2 到达阈值

例如：

```text
0.03 Grid Cell
```

如果：

```ts
distance <= 0.03
```

则：

```text
current = target
↓
进入 Idle
```

---

## 18.3 移动

```ts
const maxStep =
    moveSpeedCellsPerSecond * dt;
```

如果：

```text
distance <= maxStep
```

直接到目标。

否则：

```ts
currentGridX +=
    dx / distance * maxStep;

currentGridY +=
    dy / distance * maxStep;
```

再：

```ts
this.node.setPosition(
    gridPointToWorld(...)
);
```

---

# 19. 行走方向判定

使用移动向量：

```text
dx / dy
```

规则：

```ts
if (Math.abs(dx) > Math.abs(dy)) {
    direction =
        dx < 0
            ? WarriorDirection.Left
            : WarriorDirection.Right;
} else {
    direction =
        dy < 0
            ? WarriorDirection.Up
            : WarriorDirection.Down;
}
```

注意本工程 Grid：

```text
y 越大
=
视觉越向下
```

所以：

```text
dy > 0 → Down
dy < 0 → Up
```

每次方向改变：

```text
同步通知全队 WarriorAnimator
```

---

# 20. SquadRenderer.ts

新增：

```text
assets/scripts/squad/SquadRenderer.ts
```

职责：

```text
SquadSpawnData[]
↓
创建 Squad Node
↓
创建 Warrior Visual Nodes
↓
计算 Home / Spawn
↓
初始化 SquadIdleAI
```

它不处理 AI update。

---

# 21. SquadRenderer Constructor

推荐：

```ts
constructor(
    private readonly squadRoot: Node,
    private readonly warriorTexture: Texture2D,
)
```

主要 API：

```ts
public clear(): void

public render(
    squads: SquadSpawnData[],
    mapWidth: number,
    mapHeight: number,
): void
```

---

# 22. 创建 Squad Node

每个 Squad：

```text
Squad_<id>
```

例如：

```text
Squad_initial_01
```

Node：

```text
Parent = SquadRoot
Layer = SquadRoot.layer
Scale = (1,1,1)
```

添加：

```text
UITransform
SquadIdleAI
```

不要给 Squad Root 加 Sprite。

---

# 23. Warrior Formation

第一版 4 人使用 2×2 编队。

建议 Local Offset：

```text
Warrior_0 = (-0.38, -0.20) Cell
Warrior_1 = (+0.38, -0.20) Cell

Warrior_2 = (-0.38, +0.45) Cell
Warrior_3 = (+0.38, +0.45) Cell
```

转换到 World Local Pixel：

```ts
offsetX =
    cellOffsetX * GRID_RENDER_SIZE;

offsetY =
    -cellOffsetY * GRID_RENDER_SIZE;
```

注意 Local Y：

```text
Grid +Y 向下
Cocos +Y 向上
```

因此需要负号。

不要让四个 Warrior 完全重叠。

---

# 24. Warrior Node

每个：

```text
Warrior_0
Warrior_1
Warrior_2
Warrior_3
```

包含：

```text
Node
├── UITransform
├── Sprite
└── WarriorAnimator
```

UITransform：

```text
width = 16
height = 16
anchor = 0.5, 0.5
```

Node Scale：

```text
2,2,1
```

或者：

> 如果采用 “Node 不缩放、UITransform 直接 32×32” 的统一方案，也可以，但必须与当前像素渲染保持一致。

本轮推荐保持：

```text
Source 16×16
Node Scale ×2
```

与 World Object 当前实现一致。

---

# 25. SpriteFrame Cache

`SquadRenderer` 内建立：

```ts
private readonly frameCache =
    new Map<string, SpriteFrame>();
```

Key：

```text
direction_frame
```

例如：

```text
0_0
0_1
...
3_3
```

全队 Warrior 共享 16 张 Frame。

禁止：

```text
4 名 Warrior
×
每人 16 SpriteFrame
=
64 SpriteFrame
```

---

# 26. WarriorAnimator 初始化方式

推荐不要让 `WarriorAnimator` 自己重新切 Atlas。

由 `SquadRenderer` 创建共享 FrameSet：

```ts
type WarriorFrameSet = Record<
    WarriorDirection,
    SpriteFrame[]
>;
```

再：

```ts
animator.setup(
    sprite,
    frameSet,
    phaseOffset,
);
```

这样职责清晰：

```text
Renderer
= 资源创建与 Node 创建

Animator
= 播放
```

---

# 27. MainMapController 修改

新增：

```ts
@property(Node)
public squadRoot: Node | null = null;

@property(Texture2D)
public swordWarriorTexture: Texture2D | null = null;
```

---

## 27.1 Scene 引用

本轮优先 Inspector 绑定：

```text
SquadRoot
→ squadRoot

warrior_sword.png Texture2D
→ swordWarriorTexture
```

这次**不要新增硬编码 Warrior UUID**。

如果未绑定：

```ts
throw new Error(
    '[MainMapController] swordWarriorTexture is required.'
);
```

---

# 28. Bootstrap 正确顺序

建议最终：

```ts
private async bootstrap(): Promise<void> {
    const mapRoot = this.node;

    const tileRoot =
        this.requireChild(mapRoot, 'TileRoot');

    const worldObjectRoot =
        this.requireChild(
            mapRoot,
            'WorldObjectRoot',
        );

    const structureRoot =
        this.requireChild(
            worldObjectRoot,
            'StructureRoot',
        );

    const resourceRoot =
        this.requireChild(
            worldObjectRoot,
            'ResourceRoot',
        );

    const actorRoot =
        this.requireChild(
            mapRoot,
            'ActorRoot',
        );

    const squadRoot =
        this.squadRoot
        ?? this.requireChild(
            actorRoot,
            'SquadRoot',
        );

    // load terrain/world textures
    // validate warrior texture

    // 1. Terrain
    this.mapRenderer.render(
        STATIC_MAP
    );

    // 2. World Objects
    this.worldObjectRenderer.render(
        STATIC_WORLD_OBJECTS,
        mapWidth,
        mapHeight,
    );

    // 3. Squad
    this.squadRenderer.render(
        STATIC_SQUADS,
        mapWidth,
        mapHeight,
    );
}
```

---

# 29. SquadRenderer 查基地数据

为了避免复制基地数据，Renderer 可以：

```ts
private findHomeObject(
    id: string
): WorldObjectData
```

从：

```ts
STATIC_WORLD_OBJECTS
```

查找。

如果不存在：

```ts
throw new Error(
    `[SquadRenderer] home object not found: ${id}`
);
```

并验证：

```text
home.kind == Base
```

本轮不要建立 Repository / EntityStore。

等真正进入 Runtime World State 再抽。

---

# 30. Runtime Hierarchy 目标

运行后必须为：

```text
Canvas
└── MapRoot
    ├── TileRoot
    │   └── Tile_*
    │
    ├── WorldObjectRoot
    │   ├── StructureRoot
    │   │   └── Base_base_main
    │   │
    │   └── ResourceRoot
    │       ├── Resource_wood_01
    │       ├── Resource_wood_02
    │       ├── Resource_stone_01
    │       └── Resource_food_01
    │
    └── ActorRoot
        └── SquadRoot
            └── Squad_initial_01
                ├── Warrior_0
                ├── Warrior_1
                ├── Warrior_2
                └── Warrior_3
```

禁止出现：

```text
MapRoot
└── MapRoot
```

---

# 31. 本轮视觉目标

预期体验：

```text
游戏启动
↓
基地出现
↓
基地正前方出现 4 名剑士
↓
组成紧凑小队
↓
停留约 0.8~2.5 秒
↓
全队朝随机方向移动
↓
移动时正确播放方向对应 4 帧动画
↓
到达随机位置
↓
停止动画
↓
保持最后朝向
↓
再次停留
↓
继续闲逛
```

---

# 32. 本轮为什么不做 Y-Sort

当前：

```text
StructureRoot
SquadRoot
```

属于不同分支。

正式实现世界 Y-Sort 需要统一考虑：

```text
Building
Resource
Squad
Enemy
Effect
```

本轮暂不做。

所以通过限制 Squad：

> 只在基地前方活动

避免基地前后遮挡错误。

下一阶段出现：

```text
战士绕建筑
敌人经过树后
```

再单独设计世界排序系统。

---

# 33. 本轮为什么不做寻路

本轮目标区域完全位于基地附近空地。

AI 只进行：

```text
直线移动
```

当前没有：

```text
Obstacle
Collision
Navigation
```

所以不要提前建立 A*。

未来旗帜系统需要穿越地图时，再设计：

```text
Walkable Grid
+
Path Query
```

---

# 34. 本轮为什么不用 Tween

禁止：

```ts
tween(squadNode)
.to(...)
.delay(...)
```

原因：

下一阶段用户点击旗帜时，需要：

```text
Idle Wander
↓
立即中断
↓
切换到 Command Move
```

基于：

```text
update(dt)
+
State
```

可以随时切换状态。

Tween 会引入：

```text
stop
cancel
callback race
state mismatch
```

没有必要。

---

# 35. 不做“每个战士一个 AI”

本轮明确：

```text
Squad Node
= 逻辑 Actor

Warrior Nodes
= 视觉成员
```

不允许：

```text
Warrior_0 随机走
Warrior_1 随机走
```

否则未来：

```text
Flag
Target
Combat
Retreat
```

会出现 Squad 位置语义混乱。

---

# 36. 建议日志

启动后：

```text
[MapRenderer] rendered 920 tiles.
[WorldObjectRenderer] rendered 5 world objects.
[SquadRenderer] rendered 1 squads / 4 warriors.
[SquadIdleAI] initial_01 home=base_main spawn=(20.00,14.00)
```

不要每帧输出移动日志。

---

# 37. Error Handling

必须主动报错的情况：

```text
ActorRoot 不存在
SquadRoot 不存在
warrior texture 未绑定
STATIC_SQUADS homeObjectId 不存在
home object 不是 Base
memberCount <= 0
Sprite Sheet 尺寸不足 64×64
mapWidth/mapHeight <= 0
```

---

# 38. 本轮 Definition of Done

## Scene

- [ ] `MainMapController` 挂在现有 `MapRoot`
- [ ] 不再生成第二个 `MapRoot`
- [ ] `ActorRoot` 存在
- [ ] `SquadRoot` 存在
- [ ] 具体 Squad 不存在于 Editor Scene

## Atlas 修复

- [ ] World Object SpriteFrame 已删除 Y Flip
- [ ] 基地显示正确
- [ ] 木材 / 石材 / 食物显示正确

## Warrior Asset

- [ ] `warrior_sword.png` 位于 `assets/art/units/`
- [ ] 原图保持 64×64
- [ ] Nearest / Point
- [ ] 不拆独立 PNG

## Squad Data

- [ ] 新增 `STATIC_SQUADS`
- [ ] 只有 `initial_01`
- [ ] `memberCount = 4`
- [ ] `homeObjectId = base_main`
- [ ] 不写死 Spawn Grid

## Grid

- [ ] 新增 `gridPointToWorld`
- [ ] 原两个 Grid Transform 复用它
- [ ] Squad 使用连续 Grid Position
- [ ] 不逐格跳跃

## Runtime

- [ ] 只有 1 支 Squad
- [ ] Squad 有 4 个 Warrior
- [ ] 初始位置位于基地正面
- [ ] 位置由 `base_main` 自动推导
- [ ] Idle 时间随机
- [ ] Wander 目标随机
- [ ] Wander 区域只在基地正面
- [ ] Wander 使用 update(dt)
- [ ] 没有 Tween

## Animation

- [ ] 4 个方向正确
- [ ] 每方向 4 帧
- [ ] Moving 时循环
- [ ] Idle 时 row 0
- [ ] 四名 Warrior 不完全同步
- [ ] 没有 Y Flip

## Scope

- [ ] 没有 Collision
- [ ] 没有 Pathfinding
- [ ] 没有 Flag
- [ ] 没有 Combat
- [ ] 没有 Enemy
- [ ] 没有 Resource Gathering
- [ ] 没有 Y-Sort

---

# 39. Agent 完成后必须回报

必须提交以下内容：

```text
1. 修改文件列表

2. 最终 Main.scene Hierarchy

3. Runtime Hierarchy

4. warrior_sword.png Import 设置

5. Sprite Sheet 四方向识别截图

6. 小队 Idle 截图

7. 小队向 Left/Right/Up/Down 至少两种方向移动截图

8. Console 启动日志

9. 验证不存在嵌套 MapRoot

10. 当前 main / 工作分支 commit SHA
```

如实际 Sprite Sheet 方向与本方案定义不一致：

> **不要自行长期适配错误配置。**

先用调试输出确认四列视觉朝向，再只修改：

```text
DIRECTION_COLUMN
```

不要改 Animator 逻辑。

---

# 40. 下一阶段接口预留

这一轮结束后，下一阶段将做：

```text
点击 Squad
↓
点击合法 Target
↓
设置 Flag / Command Target
↓
SquadIdleAI 暂停
↓
Squad 进入 CommandMove
```

所以本轮代码必须保证：

```text
移动实现
动画实现
Grid Position
Squad Node
Warrior Formation
```

都与“目标从哪里来”解耦。

理想结构：

```text
现在：
IdleAI
↓
产生 targetGridPosition

以后：
PlayerCommand
↓
产生 targetGridPosition
```

底层移动和动画不需要重写。

---

# 41. 本轮最终架构

```text
StaticSquads
      ↓
SquadRenderer
      ↓
Squad Node
      ↓
SquadIdleAI
      ↓
Continuous Grid Position
      ↓
GridTransform
      ↓
World Position


Squad Node
      ↓
Warrior Nodes
      ↓
WarriorAnimator
      ↓
Shared SpriteFrame Set
      ↓
warrior_sword.png
```

核心原则：

> **Squad 是逻辑与指挥实体；Warrior 是 Squad 的视觉成员。**

> **AI 控制 Squad，不控制单个 Warrior。**

> **当前 Idle/Wander 只是第一种目标来源，未来 Flag Command 可以直接替换目标来源而不推翻移动层。**
