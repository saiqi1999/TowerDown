# 《深处的文明 / TowerDown》Squad Phase 2 技术方案
## 点击目标 → 每队旗帜 → 空间占用 → A* 寻路 → 小队移动 → 资源攻击动画

> **适用仓库**：`saiqi1999/TowerDown`  
> **基线分支**：`main`  
> **编写时基线 HEAD**：`91c5a203971428dabe6430be4adf74ce95ec4347`  
> **Cocos Creator**：3.8.8  
> **当前地图**：40 × 23 Grid  
> **Grid Source Size**：16 px  
> **Grid Render Scale**：2  
> **Grid Render Size**：32 px  
> **当前 Squad Phase 1**：1 支 `initial_01` 小队、4 名 Warrior、基地附近 Idle/Wander 已完成并运行正常。  
> **本轮目标**：建立第一条完整的玩家军事指令链路：
>
> ```text
> 点击世界物体
> ↓
> 为当前小队设置 / 切换 / 取消目标
> ↓
> 目标上显示动态旗帜
> ↓
> 根据世界物体逻辑占地生成 Navigation Grid
> ↓
> A* 寻找到目标周边可交互位置
> ↓
> Squad 沿路径连续移动
> ↓
> 到达资源邻接位置
> ↓
> 停止移动并循环播放攻击动画
> ```
>
> **本轮不做**：资源掉血、资源数量减少、资源销毁、产出结算、敌人、战斗伤害、单位碰撞、多小队选择 UI、Y-Sort、动态重规划、建筑放置。

---

# 0. 这份文档如何执行

本轮刻意把工作分成两部分：

```text
A. 用户需要在 Cocos Editor / 本地文件系统中手动完成的操作
B. 下级开发 Agent 负责的代码与工程修改
```

原因：

- 图片导入参数最好通过 Cocos Editor 明确设置；
- Scene 中的 `CommandRoot` 与 Component 挂载关系需要用户可视化确认；
- Texture Inspector 引用由用户绑定，比继续增加硬编码 UUID 更稳定；
- 业务逻辑、寻路、输入分发、Runtime Node 创建由 Agent 实现。

---

# Part A：用户需要手动完成的操作

# A1. 保存两个新 Sprite Sheet

将本轮用户提供的两张图片分别保存到：

```text
assets/art/command/target_flag.png
assets/art/units/warrior_sword_attack.png
```

如果目录不存在：

```text
assets/art/command/
```

先创建。

---

# A2. 图片尺寸必须确认

## target_flag.png

原图应为：

```text
64 × 16 px
```

含：

```text
4 frames
```

每帧：

```text
16 × 16 px
```

排列：

```text
frame0 | frame1 | frame2 | frame3
```

## warrior_sword_attack.png

原图应为：

```text
64 × 16 px
```

含：

```text
4 frames
```

每帧：

```text
16 × 16 px
```

排列：

```text
attack0 | attack1 | attack2 | attack3
```

如果导入后原图尺寸不是 `64×16`，暂停开发并确认素材，不要让 Agent 自行猜测裁法。

---

# A3. Cocos Texture Import 设置

在 Cocos Creator Asset 面板中分别选择：

```text
target_flag.png
warrior_sword_attack.png
```

Texture 设置统一：

```text
Min Filter = Nearest / Point
Mag Filter = Nearest / Point
Mip Filter = None
Mipmap = Off（若面板有此选项）
Wrap S = Clamp To Edge
Wrap T = Clamp To Edge
```

目的：

> 保持 Pixel Art 整数倍缩放，不允许 Linear Filtering。

完成后 Apply / 保存。

---

# A4. 在 Main.scene 创建 CommandRoot

打开：

```text
assets/Main.scene
```

当前：

```text
Canvas
└── MapRoot
    ├── TileRoot
    ├── WorldObjectRoot
    │   ├── StructureRoot
    │   └── ResourceRoot
    └── ActorRoot
        └── SquadRoot
```

增加：

```text
Canvas
└── MapRoot
    ├── TileRoot
    ├── WorldObjectRoot
    │   ├── StructureRoot
    │   └── ResourceRoot
    ├── ActorRoot
    │   └── SquadRoot
    └── CommandRoot
```

`CommandRoot`：

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

不要手工创建旗帜 Node。

Runtime 旗帜由代码生成。

---

# A5. Agent 首次编译后，在 MapRoot 挂 WorldCommandController

这一步需要等 Agent 创建：

```text
WorldCommandController.ts
```

且 Cocos 编译成功以后操作。

选择：

```text
Canvas/MapRoot
```

当前它已经挂：

```text
MainMapController
```

再添加：

```text
WorldCommandController
```

最终：

```text
MapRoot
├── MainMapController
└── WorldCommandController
```

**不要把 WorldCommandController 挂在 CommandRoot。**

原因：

```text
WorldCommandController
```

是地图级玩家命令协调器，需要同时协调：

```text
WorldObjectRoot
ActorRoot
CommandRoot
Navigation
```

`CommandRoot` 只是命令视觉层。

---

# A6. Inspector 绑定两个新 Texture

本技术方案要求：

> 新资源不继续新增硬编码 UUID。

Agent 将在 `MainMapController` 增加：

```ts
@property(Texture2D)
public targetFlagTexture: Texture2D | null = null;

@property(Texture2D)
public warriorAttackTexture: Texture2D | null = null;
```

用户在 Inspector 中：

```text
target_flag.png 的 Texture2D
→ targetFlagTexture

warrior_sword_attack.png 的 Texture2D
→ warriorAttackTexture
```

注意拖：

```text
Texture2D
```

而不是整图默认 SpriteFrame。

---

# A7. 本轮用户不需要手工做的内容

不要在 Scene 中手工创建：

```text
TargetFlag_initial_01
Path Node
NavigationGrid Node
SquadBrain Node
SquadMotor Node
Attack Animation Node
```

这些全部由代码负责。

---

# A8. 开发完成后的用户手工验收

至少做以下测试：

### Case 1：点击 Wood

```text
点击 Wood
↓
Wood 上出现旗帜
↓
小队停止闲逛
↓
绕过基地 / 其他资源
↓
到达 Wood 周围
↓
播放 Attack
```

### Case 2：移动途中换目标

```text
小队去 Wood
↓
点击 Stone
↓
Wood 旗帜立即消失
↓
Stone 出现旗帜
↓
小队从当前位置重新寻路
↓
去 Stone
```

### Case 3：再次点击当前目标

```text
点击 Wood
↓
去 Wood

再次点击 Wood
↓
旗帜消失
↓
当前指令取消
↓
小队返回基地休息区
↓
恢复 Idle/Wander
```

### Case 4：攻击中换目标

```text
Wood Attack
↓
点击 Food
↓
攻击动画立即结束
↓
进入 Walk
↓
去 Food
↓
到达后 Attack
```

### Case 5：障碍验证

观察路线必须：

```text
不穿过 Base
不穿过 Tree
不穿过 Stone
不穿过 Food
```

Squad 之间本轮没有碰撞限制。

---

# Part B：下级开发 Agent 技术方案

# B1. 本轮架构目标

本轮结束后核心关系必须为：

```text
WorldObjectView
      │
      │ click(objectId)
      ↓
WorldCommandController
      │
      │ 玩家意图
      ↓
   SquadBrain
      │
      ├──────────→ WorldNavigator
      │               │
      │               ├→ NavigationGrid
      │               ├→ TargetApproachResolver
      │               └→ AStarPathfinder
      │
      ↓
   SquadMotor
      │
      ↓
连续 Grid Position
      │
      ↓
  Squad Node
      │
      ↓
WarriorAnimator
```

命令视觉：

```text
WorldCommandController
      ↓
TargetFlagView
      ↓
CommandRoot
```

---

# B2. 最重要的职责约束

## WorldObjectView

只负责：

```text
“我被点击了”
```

禁止负责：

```text
寻路
移动 Squad
创建旗帜
切攻击动画
```

## WorldCommandController

只负责：

```text
哪个 Squad
当前 Target 是谁
同目标点击 = 取消
不同目标点击 = 切换
旗帜显示
向 SquadBrain 发布命令
```

禁止：

```text
直接 setPosition Squad
直接运行 A* 细节
直接修改 Warrior SpriteFrame
```

## SquadBrain

负责：

```text
小队当前行为状态
Idle / Wander / Move / Attack / ReturnHome
收到命令后决定行为
```

禁止：

```text
直接 node.setPosition()
SpriteFrame 裁切
输入检测
```

## SquadMotor

是：

> **唯一允许改变 Squad Node 世界位置的组件。**

负责：

```text
沿 waypoints 连续移动
Grid → World
移动方向
Walk / Idle 动画切换
到达事件
```

## WorldNavigator / AStar

只负责：

```text
走哪条路
```

不控制 Node。

## WarriorAnimator

只负责：

```text
Idle
Walk
Attack
```

的视觉播放。

---

# B3. 新增文件总览

建议新增：

```text
assets/scripts/command/
├── WorldCommandController.ts
├── TargetFlagView.ts
└── TargetFlagSpriteConfig.ts
```

新增：

```text
assets/scripts/navigation/
├── NavigationTypes.ts
├── NavigationGrid.ts
├── NavigationGridBuilder.ts
├── AStarPathfinder.ts
├── TargetApproachResolver.ts
└── WorldNavigator.ts
```

新增：

```text
assets/scripts/squad/
├── SquadMotor.ts
└── SquadBrain.ts
```

修改：

```text
assets/scripts/squad/SquadRenderer.ts
assets/scripts/squad/WarriorAnimator.ts
assets/scripts/squad/WarriorSpriteConfig.ts
assets/scripts/squad/SquadTypes.ts
assets/scripts/world/WorldObjectView.ts
assets/scripts/map/MainMapController.ts
assets/Main.scene
```

旧：

```text
SquadIdleAI.ts
```

本轮建议：

> 功能正式迁移到 `SquadBrain.ts` 后删除。

不要同时保留两个可以控制 Squad 行为的 AI。

---

# B4. NavigationTypes.ts

新增：

```ts
export interface GridCell {
    x: number;
    y: number;
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface NavigationPathResult {
    approachCell: GridCell;
    path: GridCell[];
}
```

如果 `GridPoint` 已存在于 `SquadTypes.ts`：

本轮建议迁到：

```text
navigation/NavigationTypes.ts
```

避免 Squad Layer 反过来定义通用 Navigation 类型。

---

# B5. NavigationGrid.ts

职责：

> 表示当前层的静态可走 / 不可走 Grid。

建议：

```ts
export class NavigationGrid {
    constructor(
        public readonly width: number,
        public readonly height: number,
    ) {}

    public isInside(x: number, y: number): boolean

    public isWalkable(x: number, y: number): boolean

    public setBlocked(x: number, y: number): void

    public setWalkable(x: number, y: number): void
}
```

底层可用：

```text
Uint8Array(width * height)
```

约定：

```text
0 = walkable
1 = blocked
```

当前地图：

```text
40 × 23 = 920 cells
```

规模极小，不需要优化。

---

# B6. NavigationGridBuilder.ts

输入：

```text
TerrainMap
WorldObjectData[]
```

输出：

```text
NavigationGrid
```

---

## B6.1 Terrain 规则

当前：

```text
Grass
Dirt
```

全部：

```text
walkable
```

不要因为 Dirt 是道路视觉就把 Grass 设成不可走。

Terrain Walkability 后续再扩。

---

## B6.2 World Object Occupancy

当前所有：

```text
Base
Resource
```

按照：

```text
WorldVisualDefinition.w/h
```

完全占用对应格子。

例如：

```text
Tree 2×2
```

则：

```text
XX
XX
```

四格全部：

```text
blocked
```

基地：

```text
4×3
```

则：

```text
XXXX
XXXX
XXXX
```

12 格全部 blocked。

---

## B6.3 继续坚持已有原则

```text
Visual Footprint
=
Logical Footprint
=
Navigation Occupancy
```

禁止额外定义：

```text
collisionW
collisionH
navW
navH
```

---

# B7. Squad 不写入 NavigationGrid

本游戏当前设计明确：

> Unit 之间没有碰撞。

因此：

```text
Squad
Enemy（未来）
```

不因为当前位置把 Cell 设为 blocked。

未来多支 Squad 可以相互穿过。

这不是 Bug，是设计规则。

---

# B8. AStarPathfinder.ts

A* 支持：

```text
8 directional movement
```

邻居：

```text
N
S
E
W
NE
NW
SE
SW
```

---

## B8.1 Cost

推荐整数 cost：

```text
横 / 竖 = 10
斜线 = 14
```

避免无意义浮点误差。

---

## B8.2 Heuristic

使用 Octile Distance：

```ts
const dx = Math.abs(a.x - b.x);
const dy = Math.abs(a.y - b.y);

return 10 * (dx + dy)
    + (14 - 20) * Math.min(dx, dy);
```

---

## B8.3 禁止 Corner Cutting

斜向移动：

```text
(x,y)
→
(x+1,y+1)
```

只有当：

```text
(x+1,y)
和
(x,y+1)
```

都可走时允许。

例如：

```text
X .
. S
```

不能让 Squad 从障碍角缝直接穿过去。

---

## B8.4 API

```ts
public findPath(
    grid: NavigationGrid,
    start: GridCell,
    goal: GridCell,
): GridCell[] | null
```

建议返回：

```text
不包含 start
包含 goal
```

例如：

```text
start = (1,1)

return:
[
  (2,1),
  (3,2),
  (4,3)
]
```

---

# B9. TargetApproachResolver.ts

Target Object 自身是 blocked。

所以目标不能是：

```text
Resource Cell
```

而是：

> Target footprint 周边的合法 Approach Cell。

---

## B9.1 Cardinal perimeter

第一版 Approach 候选只生成：

```text
Top Edge
Bottom Edge
Left Edge
Right Edge
```

不主动生成四个纯对角 Corner。

示意：

```text
   O O
 O X X O
 O X X O
   O O
```

`X`：

```text
target footprint
```

`O`：

```text
candidate approach cells
```

---

## B9.2 过滤条件

候选必须：

```text
inside map
walkable
```

去重后返回。

API：

```ts
public getApproachCells(
    target: WorldObjectData,
    grid: NavigationGrid,
): GridCell[]
```

---

# B10. WorldNavigator.ts

新增这一层避免：

```text
SquadBrain
```

自己知道 A* 的所有内部细节。

职责：

```text
current point
+
target world object
↓
best reachable approach cell
+
path
```

---

## B10.1 Constructor

建议：

```ts
constructor(
    private readonly grid: NavigationGrid,
    private readonly pathfinder: AStarPathfinder,
    private readonly approachResolver: TargetApproachResolver,
)
```

---

## B10.2 Start Cell

Squad 当前是连续 Grid Point：

```text
(20.36, 14.72)
```

转：

```ts
startCell = {
    x: Math.floor(current.x),
    y: Math.floor(current.y),
}
```

如果 startCell 因历史状态变成 blocked：

从半径：

```text
1
→
2
```

寻找最近 walkable cell。

仍不存在则返回失败。

---

## B10.3 Target Path

```ts
public findPathToObject(
    start: GridPoint,
    target: WorldObjectData,
): NavigationPathResult | null
```

流程：

```text
target
↓
approachResolver
↓
N candidate cells
↓
每个 candidate 执行 A*
↓
过滤 unreachable
↓
选择总 cost 最低路径
```

地图只有 920 格，候选很少。

Phase 2 不需要进一步优化。

---

## B10.4 Path to Home Rest

额外提供：

```ts
public findPathToCell(
    start: GridPoint,
    target: GridCell,
): GridCell[] | null
```

用于：

```text
取消命令
↓
返回基地休息位置
```

---

# B11. Home Rest Cell

当前基地：

```text
gridX = 18
gridY = 10
w = 4
h = 3
```

但禁止写死这些数字。

从 `base_main` 动态计算：

```ts
const baseCenterX =
    base.gridX + baseW / 2;

const baseBottom =
    base.gridY + baseH;
```

首选休息 Cell：

```text
位于 baseBottom 下方第一行
且最靠近 baseCenterX 的 walkable cell
```

即语义大约：

```text
     BASE
    █████
    █████
    █████
      ↓
  Home Rest
```

通过 NavigationGrid 验证。

---

# B12. SquadMotor.ts

新增 Component：

```text
assets/scripts/squad/SquadMotor.ts
```

这是本轮最重要的底层重构。

---

## B12.1 唯一位置所有者

从本轮开始：

> `SquadMotor` 是唯一允许执行 `this.node.setPosition(...)` 的 Squad 组件。

`SquadBrain`：

禁止直接：

```ts
node.setPosition(...)
```

`WorldCommandController`：

禁止直接：

```ts
node.setPosition(...)
```

---

## B12.2 Motor 字段

建议：

```ts
private currentGridPoint: GridPoint;

private waypoints: GridPoint[] = [];

private waypointIndex = 0;

private moveSpeedCellsPerSecond = 1.25;

private mapWidth = 0;
private mapHeight = 0;

private warriors: WarriorAnimator[] = [];

private arrivedPending = false;
```

---

## B12.3 Setup

```ts
public setup(config: {
    spawnPoint: GridPoint;
    mapWidth: number;
    mapHeight: number;
    warriors: WarriorAnimator[];
}): void
```

初始化后同步 Node World Position。

---

# B13. Motor API

至少：

```ts
public getGridPosition(): GridPoint

public setWaypoints(
    waypoints: GridPoint[],
): void

public setPath(
    cells: GridCell[],
): void

public stop(): void

public isMoving(): boolean

public consumeArrived(): boolean
```

---

## B13.1 setPath

Cell Path：

```text
GridCell
```

转成 Cell Center：

```ts
{
    x: cell.x + 0.5,
    y: cell.y + 0.5,
}
```

成为连续 Waypoints。

---

## B13.2 Idle Wander

旧 Idle AI 的随机目标本身是连续 Grid Point。

因此：

```text
SquadBrain
↓
motor.setWaypoints([randomPoint])
```

无需 A*。

因为目前 Home Wander Zone 已被设计为基地前方空旷区域。

---

# B14. Motor Update

每帧：

```text
current
↓
current waypoint
↓
speed × dt
↓
更新 currentGridPoint
↓
gridPointToWorld
↓
Squad Node
```

沿用 Phase 1 速度：

```text
1.25 cell / second
```

---

## B14.1 Motor Direction

根据当前移动向量：

```text
dx
dy
```

复用 Phase 1：

```text
abs(dx) > abs(dy)
→ Left / Right

else
→ Up / Down
```

然后通知：

```text
WarriorAnimator.playWalk(direction)
```

---

## B14.2 Arrive

当最后 waypoint 到达：

```text
moving = false
arrivedPending = true
```

并：

```text
WarriorAnimator.playIdle(lastDirection)
```

`SquadBrain` 下一帧通过：

```ts
motor.consumeArrived()
```

获知到达。

---

# B15. SquadBrain.ts

取代旧：

```text
SquadIdleAI
```

行为状态：

```ts
export enum SquadBrainState {
    HomeIdle,
    Wander,
    MoveToTarget,
    AttackResource,
    ReturnHome,
}
```

---

# B16. SquadBrain 维护的数据

建议：

```ts
private squadId = '';

private homeObjectId = '';

private state =
    SquadBrainState.HomeIdle;

private currentTargetId:
    string | null = null;

private idleTimer = 0;

private motor!: SquadMotor;

private navigator!: WorldNavigator;

private worldObjectById:
    ReadonlyMap<string, WorldObjectData>;

private warriors:
    WarriorAnimator[] = [];

private homeRestCell!: GridCell;
```

---

# B17. SquadBrain Setup

`SquadRenderer` 创建后传：

```ts
brain.setup({
    squadId,
    homeObjectId,
    motor,
    navigator,
    worldObjectById,
    warriors,
    homeRestCell,
    homeBounds,
});
```

---

# B18. HomeIdle / Wander

保持 Phase 1 原体验。

### HomeIdle

```text
0.8 ~ 2.5 sec
```

后随机选基地前方 Wander Point。

### Wander

```text
motor.setWaypoints([target])
```

到达：

```text
motor.consumeArrived()
↓
HomeIdle
```

---

# B19. issueTarget()

公开：

```ts
public issueTarget(
    targetId: string,
): boolean
```

或者更明确：

```ts
public issueTarget(
    targetId: string,
): CommandResult
```

推荐：

```ts
export interface CommandResult {
    accepted: boolean;
    reason?: string;
}
```

---

# B20. Resource Target

如果：

```text
target.kind = Resource
```

执行：

```text
当前 Motor Position
↓
navigator.findPathToObject(...)
↓
成功
↓
currentTargetId = target.id
state = MoveToTarget
motor.setPath(path)
```

注意：

> 必须先成功算出 Path，再中断旧目标。

如果新目标不可达：

```text
accepted = false
```

旧目标与旧旗帜保持不变。

---

# B21. 到达 Resource

当：

```text
state == MoveToTarget
```

且：

```text
motor.consumeArrived() == true
```

则：

```text
state = AttackResource
```

然后：

```text
for warrior:
    warrior.playAttack()
```

本轮不做伤害。

无限循环 Attack。

---

# B22. clearCommandAndReturnHome()

当玩家再次点击当前 Target：

```text
WorldCommandController
↓
brain.clearCommandAndReturnHome()
```

Brain：

```text
停止 Attack
↓
currentTargetId = null
↓
当前位置
↓
Navigator → HomeRestCell
↓
state = ReturnHome
↓
motor.setPath(path)
```

到达：

```text
ReturnHome
↓
HomeIdle
```

如果 Home path 计算失败：

```text
motor.stop()
state = HomeIdle
```

同时输出 warning。

不要 Crash。

---

# B23. 点击新 Target 时如何打断攻击

当前：

```text
AttackResource
```

收到新 Target：

先计算新 Path。

成功后：

```text
Attack → Walk
currentTarget = newTarget
state = MoveToTarget
motor.setPath(...)
```

因为 Motor 设置新 Path 时会：

```text
playWalk()
```

所以攻击动画自然结束。

---

# B24. WarriorAnimator.ts 扩展

当前 Phase 1：

```text
moving true/false
direction
```

本轮改成明确 Animation State：

```ts
export enum WarriorAnimationState {
    Idle,
    Walk,
    Attack,
}
```

---

## B24.1 推荐 API

```ts
public playIdle(
    direction?: WarriorDirection
): void

public playWalk(
    direction: WarriorDirection
): void

public playAttack(): void
```

内部仍然自己 `update(dt)`。

---

# B25. Walk Frame 保持不变

当前：

```text
4 directions × 4 frames
```

保持。

现有：

```text
phaseOffset
```

继续使用。

---

# B26. Attack Sprite Sheet

本轮攻击：

```text
64×16
4 frames
```

横向：

```ts
x = frameIndex * 16;
y = 0;
width = 16;
height = 16;
```

不做 Y Flip。

---

# B27. Attack Direction 限制

当前 Attack Sheet 只有：

```text
单方向 4 帧
```

没有：

```text
Up
Down
Left
Right
```

所以 Phase 2 明确：

> Attack 动画暂时 direction-agnostic。

不要：

```text
旋转 Sprite
假造上下攻击帧
```

如果素材天然朝右，可以允许未来做：

```text
target 在左侧 → horizontal flip
```

但本轮不是必须项。

---

# B28. Attack Frame Cache

Walk Frame 与 Attack Frame 都必须共享。

不要每 Warrior 创建新的 SpriteFrame。

建议：

```text
SquadRenderer
```

持有：

```text
walkFrameSet
attackFrames
```

创建一次。

再传给所有 Animator。

---

# B29. Phase Offset 用于 Attack

攻击仍可错相位：

```text
Warrior 0: phase 0
Warrior 1: phase 2
Warrior 2: phase 1
Warrior 3: phase 3
```

避免四人机械同步挥剑。

---

# B30. WarriorSpriteConfig.ts

扩展：

```text
Walk Sprite Config
Attack Sprite Config
```

Walk Texture：

```text
warrior_sword.png
```

Attack Texture：

```text
warrior_sword_attack.png
```

不要把 Attack UUID 硬编码进这里。

Texture 由 `MainMapController` Inspector 注入 `SquadRenderer`。

---

# B31. SquadRenderer.ts 重构

现有 Renderer 继续负责：

```text
创建 Squad Node
创建 Warrior Node
Formation
SpriteFrame Cache
组件 Setup
```

本轮改为：

```text
SquadNode
├── SquadMotor
└── SquadBrain
```

Warrior：

```text
Warrior_0
├── Sprite
└── WarriorAnimator
```

---

# B32. SquadRuntimeHandle

建议 `SquadRenderer.render()` 返回：

```ts
export interface SquadRuntimeHandle {
    id: string;
    node: Node;
    motor: SquadMotor;
    brain: SquadBrain;
}
```

最终：

```ts
Map<string, SquadRuntimeHandle>
```

这样 `WorldCommandController` 不需要：

```text
按 Node Name 搜 Squad
```

也不用：

```text
getComponentsInChildren 然后猜 ID
```

---

# B33. WorldObjectView.ts 点击支持

当前 View 已有：

```text
objectId
kind
gridX/Y
gridW/H
resourceType
```

本轮增加：

```ts
private clickHandler:
    ((objectId: string) => void) | null = null;
```

公开：

```ts
public bindClickHandler(
    handler: (objectId: string) => void,
): void
```

---

## B33.1 Touch Event

Component：

```text
onEnable
↓
node.on(Node.EventType.TOUCH_END, ...)
```

`onDisable`：

```text
node.off(...)
```

点击后：

```ts
this.clickHandler?.(this.objectId);
```

禁止直接 import：

```text
WorldCommandController
```

避免 View 与业务 Controller 强耦合。

---

# B34. Hit Area

当前 World Object Node 已经有：

```text
UITransform
```

且尺寸为 Visual Footprint。

继续使用它作为 Touch Hit Area。

因此：

```text
2×2 Tree
```

点击区域就是其完整 `2×2` 视觉范围。

不要添加 Collider。

---

# B35. TargetFlagSpriteConfig.ts

旗帜：

```text
64×16
```

常量：

```ts
FLAG_FRAME_SIZE = 16;
FLAG_FRAME_COUNT = 4;
FLAG_FRAME_DURATION = 0.15;
```

函数：

```ts
createTargetFlagFrames(
    texture: Texture2D
): SpriteFrame[]
```

切片：

```ts
Rect(
    frameIndex * 16,
    0,
    16,
    16
)
```

---

# B36. TargetFlagView.ts

Component。

职责：

```text
旗帜显示
位置
4 帧循环动画
```

不管理：

```text
currentTarget
activeSquad
Squad command
```

---

## B36.1 API

```ts
public setup(
    frames: SpriteFrame[],
): void

public showAtObject(
    target: WorldObjectData,
    visual: WorldVisualDefinition,
    mapWidth: number,
    mapHeight: number,
): void

public hide(): void
```

---

# B37. Flag Position

Target footprint：

```text
gridX
gridY
w
h
```

旗帜位置建议：

```text
footprint top-center
```

Grid Point：

```ts
x = target.gridX + visual.w / 2;
y = target.gridY;
```

然后增加少量视觉 Pixel Offset：

```text
+8~12 render pixels upward
```

该偏移只属于：

```text
TargetFlagView
```

不进入逻辑 Grid。

---

# B38. 每 Squad 一面旗

当前虽然只有：

```text
initial_01
```

但结构从本轮开始遵守设计：

```text
1 Squad = 1 Flag
```

Runtime：

```text
CommandRoot
└── TargetFlag_initial_01
```

不要创建：

```text
TheFlag
GlobalFlag
```

未来：

```text
TargetFlag_squad_02
TargetFlag_squad_03
...
```

即可。

---

# B39. WorldCommandController.ts

挂：

```text
MapRoot
```

但它不是通过“父节点自动控制子节点”。

它通过：

```text
setup() 注入引用
+
WorldObjectView callback
+
SquadBrain public API
+
TargetFlagView public API
```

协调系统。

---

# B40. WorldCommandController Setup

建议：

```ts
public setup(config: {
    worldObjectRoot: Node;
    commandRoot: Node;
    worldObjects: readonly WorldObjectData[];
    squadHandles: ReadonlyMap<string, SquadRuntimeHandle>;
    targetFlagTexture: Texture2D;
    mapWidth: number;
    mapHeight: number;
}): void
```

---

# B41. activeSquadId

Phase 2 只有一支队：

```ts
private activeSquadId =
    'initial_01';
```

但不要把命令数据结构写成完全全局唯一。

建议：

```ts
private readonly targetBySquad =
    new Map<string, string>();
```

旗帜：

```ts
private readonly flagBySquad =
    new Map<string, TargetFlagView>();
```

这样 Phase 3 加第二支 Squad 不用推翻 Controller。

---

# B42. 绑定 WorldObjectView

因为 World Objects 是 Runtime 生成：

必须在：

```text
WorldObjectRenderer.render()
```

之后执行：

```text
WorldCommandController.setup()
```

setup：

```ts
const views =
    worldObjectRoot.getComponentsInChildren(
        WorldObjectView
    );

for (const view of views) {
    view.bindClickHandler(
        (objectId) =>
            this.onWorldObjectClicked(objectId),
    );
}
```

---

# B43. 点击同一目标

如果：

```text
targetBySquad.get(activeSquadId)
===
clickedObjectId
```

则：

```text
targetBySquad.delete(...)
flag.hide()
brain.clearCommandAndReturnHome()
```

完成取消。

---

# B44. 点击不同目标

流程：

```text
clicked object
↓
brain.issueTarget(clickedObjectId)
```

如果：

```text
accepted = false
```

则：

```text
旧 Target 不变
旧 Flag 不变
console.warn(reason)
```

如果：

```text
accepted = true
```

才：

```text
targetBySquad.set(...)
flag.showAtObject(...)
```

这保证：

> 不可达目标不会把已经有效的命令替换掉。

---

# B45. World Object 类型语义

## Resource

```text
移动到 Approach Cell
↓
AttackResource
```

## Base

如果本轮允许点击 Base：

```text
点击 Base
↓
可以显示旗帜
↓
SquadBrain ReturnHome
↓
到达 Home Rest
↓
旗帜自动消失
↓
HomeIdle
```

Base Command 可作为本轮 Optional。

最低验收只要求：

```text
Resource
```

完整工作。

---

# B46. MainMapController.ts 继续作为 Composition Root

本轮增加：

```ts
@property(Texture2D)
public targetFlagTexture:
    Texture2D | null = null;

@property(Texture2D)
public warriorAttackTexture:
    Texture2D | null = null;
```

没有 UUID fallback。

未绑定：

```text
throw Error
```

给出明确字段名。

---

# B47. Bootstrap 正确顺序

最终建议：

```text
1. require Scene Roots

2. validate textures

3. render Terrain

4. render World Objects

5. build NavigationGrid

6. create WorldNavigator

7. render Squads
   ├ SquadMotor
   └ SquadBrain

8. setup WorldCommandController

9. bind all WorldObjectView clicks
```

---

# B48. MainMapController 获取 WorldCommandController

因为用户已经手工挂到 MapRoot：

```ts
const commandController =
    this.node.getComponent(
        WorldCommandController
    );

if (!commandController) {
    throw new Error(
        '[MainMapController] WorldCommandController is required on MapRoot.'
    );
}
```

不要运行时 `addComponent`。

这样 Scene 结构明确可见。

---

# B49. NavigationGrid 生命周期

Phase 2：

```text
地图和 World Objects 都是静态
```

所以：

```text
bootstrap 时 build 一次
```

即可。

不要：

```text
每次点击重建 Grid
每帧重建 Grid
```

以后建筑放置 / 资源销毁再加 dirty rebuild。

---

# B50. Path 可视化本轮不做

不要增加：

```text
路线箭头
Debug Line
Breadcrumb
```

如 Agent 调试 A* 需要，可以临时 Console 输出：

```text
[(20,14),(21,14),...]
```

提交前不保留大量 Debug 绘制。

---

# B51. Target 切换时 Path 行为

例如：

```text
Squad → Wood
```

途中：

```text
Click Stone
```

必须：

```text
从 Squad 当前实时 Grid Position
重新计算 A*
```

不能：

```text
从旧 Path 起点算
从基地算
```

因此：

```ts
motor.getGridPosition()
```

是唯一真实起点来源。

---

# B52. Attack 判定

本游戏不用 Collider。

正式定义：

> **到达合法 Approach Cell = 接触目标。**

所以：

```text
Path Completed
```

就是：

```text
可以 Attack
```

不要额外写：

```text
distance < 50 pixels
onCollisionEnter
```

---

# B53. Attack 状态不修改资源

Phase 2：

```text
AttackResource
=
无限循环攻击动画
```

不要增加：

```text
resource.hp
resource.amount
resource.destroy
loot
```

下一 Phase 单独做资源采集 / 攻击结算。

---

# B54. 点击资源时 Flag 生命周期

```text
Click Wood
↓
Flag show
↓
Move
↓
Attack
↓
Flag 继续显示
```

代表：

> Squad 当前命令仍然是这个资源。

只有：

```text
再次点击取消
点击另一个 Target
未来资源耗尽
```

才移除 / 转移。

---

# B55. CommandRoot Runtime Hierarchy

完成后运行时：

```text
Canvas
└── MapRoot
    ├── TileRoot
    ├── WorldObjectRoot
    │   ├── StructureRoot
    │   └── ResourceRoot
    │
    ├── ActorRoot
    │   └── SquadRoot
    │       └── Squad_initial_01
    │           ├── Warrior_0
    │           ├── Warrior_1
    │           ├── Warrior_2
    │           └── Warrior_3
    │
    └── CommandRoot
        └── TargetFlag_initial_01
```

---

# B56. 推荐开发顺序

不要一次全部写完。

---

## Step 1：输入 + Flag

实现：

```text
WorldObjectView Touch
WorldCommandController
TargetFlagView
```

验收：

```text
点 Wood → Flag
再点 Wood → Flag Hide
点 Wood → 点 Stone → Flag 转移
```

此时 Squad 暂时不需要动。

Commit 建议：

```text
feat: add world target command and flag
```

---

## Step 2：Navigation

实现：

```text
NavigationGrid
NavigationGridBuilder
AStarPathfinder
TargetApproachResolver
WorldNavigator
```

暂时 Console 验证：

```text
点击目标
↓
输出 Path
```

要求路径不进入任何 World Object Occupancy。

Commit：

```text
feat: add grid navigation and astar
```

---

## Step 3：SquadMotor + Brain

重构：

```text
SquadIdleAI
↓
SquadBrain + SquadMotor
```

先确保：

```text
没有玩家命令时
Idle/Wander 体验不退化
```

再接：

```text
Command → MoveToTarget
```

Commit：

```text
refactor: split squad brain and motor
```

---

## Step 4：Attack Animation

增加：

```text
warrior_sword_attack.png
WarriorAnimator Attack State
```

到达 Resource：

```text
Attack loop
```

Commit：

```text
feat: add resource attack animation
```

---

# B57. Error Handling

以下必须显式处理：

```text
WorldCommandController 不在 MapRoot
targetFlagTexture 未绑定
warriorAttackTexture 未绑定
Target object id 不存在
active Squad id 不存在
Target 没有可用 Approach Cell
A* 无可达路径
Navigation map size 非法
Home Rest 不可达
```

不可达资源：

```text
warning
不改变旧 Target
不移动 Flag
```

---

# B58. 日志建议

正常启动：

```text
[NavigationGridBuilder] built 40x23 grid, blocked=N
[SquadRenderer] rendered 1 squads.
[WorldCommandController] bound 5 world objects.
```

点击：

```text
[Command] squad=initial_01 target=wood_01 accepted pathLength=...
```

取消：

```text
[Command] squad=initial_01 target=wood_01 cancelled
```

不可达：

```text
[Command] target=... rejected: unreachable
```

禁止每帧打印：

```text
position
animation frame
A* node expansion
```

---

# B59. 不允许出现的实现

Code Review 发现以下任意模式，应要求修改。

```text
WorldObjectView 里直接寻找 Squad Node
```

```text
WorldObjectView 里调用 A*
```

```text
WorldCommandController 直接 node.setPosition
```

```text
SquadBrain 直接 node.setPosition
```

```text
用 Tween 移动 Squad
```

```text
A* Goal = Resource blocked Cell
```

```text
资源 Node 添加 Collider 作为接触判定
```

```text
Squad 写入 NavigationGrid blocked
```

```text
旗帜挂到 Resource Node 下继承资源 Scale
```

```text
每次点击重新生成整个 SpriteFrame Atlas
```

```text
继续让 SquadIdleAI 与 SquadBrain 同时存在并控制位置
```

---

# B60. Definition of Done

## 用户输入

- [ ] Wood 可点击
- [ ] Stone 可点击
- [ ] Food 可点击
- [ ] 同目标再次点击取消
- [ ] 点击其他目标立即切换命令

## Flag

- [ ] 每 Squad 独立旗帜语义
- [ ] 当前只有 `TargetFlag_initial_01`
- [ ] 旗帜 4 帧正常循环
- [ ] 旗帜使用 Nearest
- [ ] 旗帜位于 Target footprint 上方
- [ ] Flag Node 位于 `CommandRoot`
- [ ] 不继承 Resource Scale

## Navigation

- [ ] Navigation Grid 为 40×23
- [ ] Grass 可走
- [ ] Dirt 可走
- [ ] Base footprint blocked
- [ ] Wood footprint blocked
- [ ] Stone footprint blocked
- [ ] Food footprint blocked
- [ ] Squad 不 blocked
- [ ] A* 使用 8 方向
- [ ] 禁止 corner cutting
- [ ] Goal 是 Approach Cell
- [ ] 不穿过任何 World Object

## Squad Architecture

- [ ] `SquadIdleAI` 行为已迁移到 `SquadBrain`
- [ ] `SquadMotor` 是唯一 Squad Position Writer
- [ ] Idle/Wander 原体验仍正常
- [ ] Player Command 可随时打断 Wander
- [ ] Player Command 可随时打断 Attack
- [ ] 切换目标从当前实时位置重新寻路
- [ ] 取消后返回基地休息区

## Animation

- [ ] Walk 四方向保持正常
- [ ] Attack Strip 切成 4×16px 帧
- [ ] Attack 循环播放
- [ ] 四名 Warrior Attack 相位不完全同步
- [ ] Attack 期间不播放 Walk
- [ ] 新目标后 Attack 立即切回 Walk

## Scope

- [ ] 无 Collider
- [ ] 无 NavMesh
- [ ] 无 Resource HP
- [ ] 无资源扣减
- [ ] 无敌人
- [ ] 无伤害
- [ ] 无 Path Visual
- [ ] 无多 Squad 选择 UI
- [ ] 无 Y-Sort

---

# B61. Agent 完成后必须回报

请下级 Agent 最终提供：

```text
1. 最终 commit SHA

2. 修改 / 新增文件清单

3. 最终 Main.scene Hierarchy

4. Runtime Hierarchy

5. target_flag.png Import 设置

6. warrior_sword_attack.png Import 设置

7. 点击 Wood 后 Flag 截图

8. Squad 绕开障碍前往 Wood 截图

9. Squad 到达 Wood Attack 截图

10. 从 Wood 中途改点 Stone 后重新寻路截图

11. 再次点击同目标取消并返家截图

12. 一条实际 A* path Console 示例

13. 说明 SquadMotor 是否为唯一 node.setPosition 的 Squad 组件

14. 全局搜索结果：
    SquadIdleAI 是否已完全不再承担移动

15. 运行过程中 Console 是否存在 Error / Warning
```

---

# B62. Code Review 特别检查项

上级 Review 时重点搜索：

```text
setPosition(
```

在 `assets/scripts/squad/` 中：

> Squad Node 的移动必须最终只来自 `SquadMotor`。

Warrior Local Formation：

```text
SquadRenderer
```

设置一次 Local Position 是允许的。

---

搜索：

```text
tween(
```

Squad 移动不得使用。

---

搜索：

```text
WorldCommandController
```

确认挂载：

```text
MapRoot
```

而不是：

```text
CommandRoot
```

---

搜索：

```text
NavigationGrid.setBlocked
```

只应由：

```text
World Object footprint
```

等静态障碍来源调用。

不得把 Squad 填入静态 Blocked Map。

---

# B63. 本轮结束后的长期接口

完成 Phase 2 后，我们应该具备：

```text
玩家意图层：
WorldCommandController

小队决策层：
SquadBrain

路径层：
WorldNavigator / AStar

运动层：
SquadMotor

视觉层：
WarriorAnimator
TargetFlagView
```

下一阶段做：

```text
Resource HP / Resource Amount
Attack Tick
采集结算
Resource Exhausted
Flag Auto Clear
Squad Auto Return
```

时：

> 不需要再修改输入、寻路和运动底层。

再下一阶段增加第二支 Squad：

```text
点击 Squad
↓
activeSquadId 切换
↓
同一套 WorldCommandController
↓
每队一旗
```

也不需要推翻 Phase 2。

---

# B64. 最终设计原则

本轮必须坚持四句话：

> **WorldObject 只告诉系统“我被点了”。**

> **WorldCommandController 只解释“玩家想让哪支 Squad 去哪里”。**

> **A* 只决定“走哪条路线”。**

> **SquadMotor 是唯一真正执行移动的人。**

最终调用链：

```text
Player Touch
     ↓
WorldObjectView
     ↓
WorldCommandController
     ↓
SquadBrain
     ↓
WorldNavigator
     ↓
AStarPathfinder
     ↓
SquadMotor
     ↓
WarriorAnimator
```

旗帜独立：

```text
WorldCommandController
     ↓
TargetFlagView
     ↓
CommandRoot
```

这就是 Squad Phase 2 的正式技术边界。
