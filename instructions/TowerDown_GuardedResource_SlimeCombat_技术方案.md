# TowerDown：守护资源怪物战斗系统技术方案
## 3 Slime Guard × Gold Resource × Combat Encounter × Guard Leash

> 适用仓库：`saiqi1999/TowerDown`  
> Cocos Creator：3.8.8  
> 前置能力：Grid / A* / Squad Command / Warrior Slot / AttackImpact / Health / Damage Popup / HitFlash / Resource Runtime Registry 已完成  
>
> 本轮目标：
>
> ```text
> 生成 1×1 Gold Resource
> +
> 3 只 Slime 初始 Idle 守卫
> ↓
> 玩家点击 Gold
> ↓
> Squad 正常向 Gold 行进
> ↓
> Squad 距 Gold 约 3 格时
> Guard 激活
> ↓
> 创建 / 加入 CombatEncounter
> ↓
> Warrior 与 Slime 选择 Target
> ↓
> 动态选择 Combat Position
> ↓
> 双方局部移动并自动战斗
> ↓
> 玩家可以中途撤退
> ↓
> Slime 最远只追到 Guard Leash
> ↓
> 超出 Leash 后 Slime 返回 Guard Position
> ↓
> Slime 保留已经损失的 HP
> ↓
> 再次接近可继续战斗
> ↓
> 3 只 Slime 全灭
> ↓
> Gold 解锁
> ↓
> 原 Squad Command 自动继续
> ↓
> 围住 Gold 并采集
> ```
>
> 本轮重点不是做复杂 Monster AI，而是建立今后所有：
>
> ```text
> Resource Guard
> Monster Camp
> Multi-Squad Combat
> Monster vs Warrior
> Combat Position
> Retreat / Re-engage
> ```
>
> 都能继续复用的第一套战斗架构。

---

# 1. 已确认的设计规则

以下规则已经确定，本方案不再留待讨论。

```text
1. Slime 初始状态 = Idle Guard

2. 玩家点击的是被守护的 Resource，
   不是逐个点击 Slime

3. 下达命令时 Guard 不立即激活

4. Squad 距 guarded resource 中心 <= 3 Grid Cells
   才激活 Guard 并进入 Combat

5. Slime 只守自己的 Resource，
   不主动攻击普通路过单位

6. Guard Leash Radius = 6 Grid Cells

7. 玩家撤退后：
   Slime 最多追到 Leash
   然后停止追击并 ReturnToGuard

8. ReturnToGuard 后：
   Slime HP 不恢复
   保留当前损血

9. 如果部分 Slime 已死亡：
   死亡状态保留
   下次只剩存活 Slime 参战

10. 所有 Slime 死亡：
    Guard 永久 Defeated
    Resource 解锁

11. 如果玩家原命令仍然是该 Resource：
    Victory 后自动继续采集
    不要求玩家再点一次

12. 支持后续多个 Squad 加入同一场 Encounter

13. 不使用单位物理碰撞 / 推挤 / 卡位

14. Combat Position 是逻辑位置预约，
    不是 Collider

15. Slime Move Sheet：
    64×64
    4 cols × 4 rows
    col = direction
    row = animation frame

16. Slime Attack Sheet：
    独立 64×64
    4 cols × 4 rows
    col = direction
    row = animation frame
```

方向：

```text
col0 = Down
col1 = Up
col2 = Left
col3 = Right
```

---

# 2. 本轮最终游戏表现

地图初始：

```text
        Slime_2
          ●

Slime_0 ● GOLD ● Slime_1
```

三个 Slime：

```text
Idle
原地守卫
有红色血条
```

玩家点击：

```text
GOLD
```

旗帜仍然插在 Gold 上。

此时：

```text
Slime 不动
```

Squad：

```text
正常 A*
↓
向 Gold 靠近
```

距离达到：

```text
<= 3 cells
```

才发生：

```text
Slime Guard Activate
↓
Squad Stop Strategic Movement
↓
双方进入 Encounter
↓
局部自动战斗
```

---

# 3. 玩家撤退表现

例如玩家正在战斗时：

```text
点击 Base
```

或：

```text
点击另一个 Resource
```

Warrior：

```text
停止主动攻击
↓
释放 Combat Position
↓
回 Formation
↓
Squad 开始执行新 Command
```

Slime：

```text
仍然可以追击正在撤退的 Squad
↓
但只在 guarded resource 半径 6 格以内
```

Squad 离开：

```text
6 cells
```

之后：

```text
Slime 停止追击
↓
释放 Target
↓
ReturnToGuard
↓
回到各自 Guard Offset
↓
Idle
```

HP：

```text
不会回复
```

---

# 4. 玩家需要做的事情

本轮用户只负责：

```text
Slime 素材导入
Inspector Texture 绑定
运行验收
```

代码、Runtime Node、AI、Encounter、Gold、Combat Position 全部由 Agent 完成。

---

# 5. 用户：Slime 素材目录

将两张图保存：

```text
assets/art/monsters/slime/
├── slime_move.png
└── slime_attack.png
```

要求：

```text
64×64 px

4 columns
4 rows

single frame:
16×16 px
```

---

# 6. 用户：Texture 导入配置

两张 Slime Sheet：

```text
Filter:
Nearest / Point

Wrap:
Clamp

Mipmaps:
关闭
```

禁止：

```text
Bilinear
```

最终与 Warrior 一样：

```text
source 16×16
× GRID_RENDER_SCALE 2
=
32×32 world pixel
```

---

# 7. 用户：Inspector 绑定

Agent 会在：

```text
MapRoot
└── MainMapController
```

新增：

```text
Slime Move Texture
Slime Attack Texture
```

用户绑定：

```text
slime_move.png
→ Slime Move Texture

slime_attack.png
→ Slime Attack Texture
```

已有：

```text
Resource Health Bar Texture
Hit Flash Material
```

Slime 直接复用，不需要新建。

---

# 8. 用户：Scene 手工操作

本轮：

```text
不需要手工创建 MonsterRoot
不需要手工创建 EncounterRoot
不需要手工创建 Slime Node
不需要手工创建 Gold Node
```

全部运行时生成。

用户只需要：

```text
绑定 2 张 Slime Texture
保存 Main.scene
运行
```

---

# 9. Agent 总体文件结构

新增：

```text
assets/scripts/monster/
├── MonsterTypes.ts
├── MonsterConfig.ts
├── MonsterSpriteConfig.ts
├── StaticMonsterGroups.ts
├── MonsterRuntimeRegistry.ts
├── MonsterGroupRenderer.ts
├── MonsterGroupController.ts
├── MonsterMotor.ts
├── MonsterAnimator.ts
├── MonsterAttackReceiver.ts
└── MonsterCombatantAdapter.ts
```

新增：

```text
assets/scripts/combat/
├── CombatantTypes.ts
├── CombatPositionResolver.ts
├── CombatPositionReservation.ts
├── CombatEncounter.ts
└── CombatEncounterManager.ts
```

新增：

```text
assets/scripts/squad/
├── SquadCombatController.ts
└── WarriorCombatantAdapter.ts
```

修改：

```text
assets/scripts/map/
└── MainMapController.ts

assets/scripts/world/
├── WorldObjectTypes.ts
├── WorldAtlasConfig.ts
├── StaticWorldObjects.ts
└── ResourceRuntimeConfig.ts

assets/scripts/economy/
└── ResourceInventory.ts

assets/scripts/ui/
└── ResourceHudView.ts

assets/scripts/combat/
└── CombatStats.ts

assets/scripts/squad/
├── SquadRenderer.ts
├── SquadBrain.ts
├── SquadTypes.ts
└── WarriorAnimator.ts
```

开发完成后：

```text
README.md
```

必须同步更新 Monster / Encounter 架构。

---

# 10. Gold Resource

增加：

```ts
ResourceType.Gold
```

当前：

```text
Wood
Stone
Food
```

扩为：

```text
Wood
Stone
Food
Gold
```

---

# 11. Gold Visual

增加：

```ts
WorldVisualId.GoldOreSmall
```

使用：

```text
TilesetNature
col = 4
row = 14
w = 1
h = 1
```

即：

```text
x = 64
y = 224
width = 16
height = 16
```

配置：

```ts
[WorldVisualId.GoldOreSmall]: {
    atlas: WorldAtlasKey.Nature,
    col: 4,
    row: 14,
    w: 1,
    h: 1,
}
```

---

# 12. Gold Static Object

增加：

```ts
{
    id: 'gold_01',

    kind:
        WorldObjectKind.Resource,

    resourceType:
        ResourceType.Gold,

    visualId:
        WorldVisualId.GoldOreSmall,

    gridX:
        <Agent 选择当前空闲区域>,

    gridY:
        <Agent 选择当前空闲区域>,
}
```

要求：

```text
距离 Base 足够远
不会与现有 WorldObject overlap
周围至少留出约 6 Grid Cells 空间
方便测试 Guard Leash
```

Agent 应通过当前 map / world data 选择一个合法位置。

---

# 13. Gold Runtime Config

第一版：

```text
Gold:
Max HP = 20
Yield Per Damage = 1
```

即：

```text
1 actualDamage
→
1 Gold
```

---

# 14. Resource Inventory

增加：

```ts
gold: number;
```

初始化：

```text
Gold = 0
```

HUD：

```text
木材 X    石材 X    食物 X    黄金 X
```

Gold Harvest 继续复用：

```text
ResourceHarvestComponent
```

不新增专用 Gold Harvest 系统。

---

# 15. Gold Guard 不是 Resource Lock Component

Gold 仍然：

```text
可以被玩家点击
```

不能因为有 Guard 就：

```ts
WorldObjectView.setInteractable(false)
```

因为玩家必须通过点击 Gold：

```text
表达战略目标
```

Guard 只改变：

```text
“执行这条 Command 的过程”
```

而不是：

```text
“这个目标能不能被点击”
```

---

# 16. Monster 数据模型

`MonsterTypes.ts`：

```ts
export enum MonsterType {
    BlueSlime = 0,
}

export enum MonsterVisualId {
    BlueSlime = 0,
}
```

---

# 17. Monster Spawn Data

定义：

```ts
export interface MonsterSpawnData {
    id: string;

    type: MonsterType;

    visualId: MonsterVisualId;

    guardOffset: GridPoint;
}
```

---

# 18. Monster Group Data

定义：

```ts
export interface MonsterGroupData {
    id: string;

    guardedObjectId: string;

    members:
        readonly MonsterSpawnData[];

    engageRadiusCells: number;

    leashRadiusCells: number;
}
```

---

# 19. 第一组 Guard Preset

新增：

```text
slime_guard_gold_01
```

配置：

```ts
{
    id: 'slime_guard_gold_01',

    guardedObjectId:
        'gold_01',

    engageRadiusCells:
        3.0,

    leashRadiusCells:
        6.0,

    members: [
        {
            id: 'slime_gold_0',
            type: BlueSlime,
            visualId: BlueSlime,
            guardOffset: {
                x: -1.25,
                y: 0,
            },
        },

        {
            id: 'slime_gold_1',
            type: BlueSlime,
            visualId: BlueSlime,
            guardOffset: {
                x: 1.25,
                y: 0,
            },
        },

        {
            id: 'slime_gold_2',
            type: BlueSlime,
            visualId: BlueSlime,
            guardOffset: {
                x: 0,
                y: -1.25,
            },
        },
    ],
}
```

Grid：

```text
+Y 向下
```

所以：

```text
y = -1.25
```

表示 Gold 上方。

---

# 20. Guard Position Anchor

Monster Group Anchor：

```text
guarded resource center
```

例如：

```text
gold center
=
(gridX + 0.5,
 gridY + 0.5)
```

Monster 初始 World Grid Position：

```text
guardCenter
+
guardOffset
```

---

# 21. Monster Runtime Tree

Agent 运行时在：

```text
ActorRoot
```

下创建：

```text
MonsterRoot
```

最终：

```text
Canvas
└── MapRoot
    ├── TileRoot
    ├── WorldObjectRoot
    │   └── ResourceRoot
    │       └── Resource_gold_01
    │
    ├── ActorRoot
    │   ├── SquadRoot
    │   └── MonsterRoot
    │       └── MonsterGroup_slime_guard_gold_01
    │           ├── Slime_slime_gold_0
    │           ├── Slime_slime_gold_1
    │           └── Slime_slime_gold_2
    │
    ├── CommandRoot
    └── WorldFeedbackRoot
```

---

# 22. Monster Group Node

`MonsterGroup` Node：

```text
只负责组织成员
+
提供 Guard Anchor
```

不是：

```text
3 只 Monster 共用一个 HP
3 只 Monster 一起移动
3 只 Monster 共用 Target
```

真正战斗单位是：

```text
Monster
```

---

# 23. 单个 Slime Runtime

```text
Slime_xxx
├── Sprite
├── MonsterAnimator
├── MonsterMotor
├── CombatStats
├── HealthComponent
├── HealthBarView
├── HitFlashView
├── MonsterAttackReceiver
└── MonsterCombatantAdapter
```

---

# 24. Slime Config

`MonsterConfig.ts`：

第一版：

```text
Blue Slime

Max Health:
8

Attack Damage:
1

Attack Range:
0.85 cells

Preferred Combat Distance:
0.75 cells

Move Speed:
3.2 cells / sec

Move Frame Duration:
0.14 sec

Attack Frame Duration:
0.12 sec

Attack Hit Frame:
row 2
```

说明：

```text
Attack Hit Frame = 2
```

只是第一版视觉命中帧配置。

必须作为：

```text
MonsterConfig
```

参数。

不要写死在 Animator 分支中。

用户后面如果看实际 Attack Sheet 发现：

```text
row3
```

更像命中帧，只改配置即可。

---

# 25. Slime Sprite Config

`MonsterSpriteConfig.ts`：

```text
FRAME_SIZE = 16

DIRECTION_COUNT = 4

FRAME_COUNT = 4
```

Move：

```text
col = direction
row = frame
```

Attack：

```text
col = direction
row = frame
```

---

# 26. Monster Direction

第一版 Monster 内部方向：

```ts
enum MonsterDirection {
    Down = 0,
    Up = 1,
    Left = 2,
    Right = 3,
}
```

数值保持：

```text
0/1/2/3
```

与素材列完全一致。

注意：

```text
Down = 0
```

任何 nullable 判断禁止：

```ts
if (!direction)
```

必须：

```ts
if (direction === null)
```

避免重现 Warrior 的 enum=0 bug。

---

# 27. MonsterAnimator

状态：

```ts
Idle
Move
Attack
Dead
```

---

# 28. Initial Idle

Monster Spawn 后：

```text
必须进入 Idle
```

不能：

```text
自动 Move
自动 Attack
自动追玩家
```

Idle Frame：

```text
Move Sheet
row 0
+
当前 facing column
```

---

# 29. Initial Guard Facing

根据：

```text
guardOffset
```

让 Slime 初始面朝 Resource 外侧。

例如：

```text
Slime 在 Gold 左边
→ face Left

Slime 在 Gold 右边
→ face Right

Slime 在 Gold 上边
→ face Up
```

这只是初始视觉朝向。

不参与 Guard 逻辑。

---

# 30. Move Animation

移动时：

```text
row0
row1
row2
row3
循环
```

当前 movement vector：

```text
dx / dy
```

解析为四方向。

---

# 31. Attack Animation

攻击时：

```text
attack row0
→ row1
→ row2
→ row3
→ loop
```

进入：

```text
hitFrameIndex
```

瞬间：

```text
emit Attack Impact Timing Event
```

和 Warrior 一样：

```text
事件必须边沿触发
```

不能 hit frame 停留期间每帧 emit。

---

# 32. WarriorAnimator Impact API 必须升级

当前 Warrior Animator 使用：

```text
单个 bindAttackImpactHandler
```

Monster Combat 加入后：

```text
Resource Interaction
+
Combat Encounter
```

都可能监听 Warrior Attack Timing。

因此本轮把 Warrior Animator 改成：

```ts
subscribeAttackImpact(
    listener: () => void
): () => void
```

内部：

```text
Set<listener>
```

---

# 33. SquadEngagementController 迁移

当前 Resource Interaction：

```text
SquadEngagementController
```

继续订阅 Warrior Impact。

但是改成：

```text
subscribeAttackImpact
```

并保存 unsubscribe。

不要再：

```text
bindAttackImpactHandler(null)
```

覆盖唯一 callback。

---

# 34. MonsterAnimator 使用同一事件语义

也提供：

```ts
subscribeAttackImpact(
    listener: () => void
): () => void
```

语义统一：

> Animator 只报告“攻击命中帧到了”。

Animator 不知道：

```text
targetId
damage
CombatEventHub
```

---

# 35. CombatStats 扩展

当前：

```text
attackDamage
```

本轮增加：

```ts
attackRangeCells
preferredCombatDistanceCells
```

例如 Sword Warrior：

```text
Attack Damage = 当前值
Attack Range = 0.85
Preferred Distance = 0.75
```

Slime：

```text
Attack Damage = 1
Attack Range = 0.85
Preferred Distance = 0.75
```

---

# 36. MonsterMotor

职责：

```text
单只 Monster 局部世界移动
```

它不是：

```text
A*
Guard AI
Target Selection
Attack Decision
```

---

# 37. MonsterMotor Position

Monster Node 在：

```text
MonsterGroup Node
```

下。

Group Anchor 对应：

```text
guarded resource center
```

Motor 保存：

```text
localGridOffset
```

Monster 世界位置：

```text
guardAnchor
+
localGridOffset
```

---

# 38. MonsterMotor API

```ts
moveToWorldGridPoint(
    target: GridPoint
): void

returnToGuardOffset(): void

stop(): void

getWorldGridPosition(): GridPoint

getGuardWorldGridPosition(): GridPoint

consumeArrived(): boolean
```

内部负责：

```text
world target
→
relative to group anchor
→
local Node position
```

---

# 39. Monster Runtime Registry

新增：

```text
MonsterRuntimeRegistry
```

职责：

```text
保存 MonsterGroup runtime
查询 guarded resource
查询 alive monsters
查询 group state
```

---

# 40. Group Runtime State

```ts
enum MonsterGroupState {
    IdleGuard = 0,
    Engaged = 1,
    Returning = 2,
    Defeated = 3,
}
```

---

# 41. Registry Query

必须支持：

```ts
getGuardForResource(
    objectId: string
): MonsterGroupRuntime | null
```

如果：

```text
group Defeated
```

返回：

```text
null
```

这样：

```text
Gold
```

就自然退化成普通 Resource。

---

# 42. Guard 资源判断

禁止在：

```text
WorldObjectData
```

里增加：

```text
isGuarded: true
```

因为：

```text
Guard 是运行时状态
```

而不是 Resource 永久属性。

判断来源：

```text
MonsterRuntimeRegistry
```

---

# 43. MonsterGroupController

职责：

```text
管理 Guard Group 状态
```

不负责每只 Monster 的：

```text
Target
Combat Position
Attack Timing
```

---

# 44. Guard State Machine

```text
IdleGuard
↓
(valid Squad command target
 + within engage radius)
↓
Engaged

Engaged
↓
all hostile participants
leave leash
↓
Returning

Returning
↓
all surviving Monsters
back to guard offsets
↓
IdleGuard

Returning
↓
valid Squad again enters engage radius
↓
Engaged

Engaged
↓
all Monsters dead
↓
Defeated
```

---

# 45. Guard Activation Radius

固定：

```ts
GUARD_ENGAGE_RADIUS_CELLS = 3.0;
```

使用：

```text
Squad Center
→
Guarded Resource Center
```

的 Euclidean distance。

计算时使用 squared distance：

```ts
distanceSquared
<=
3.0 * 3.0
```

避免 sqrt。

---

# 46. Guard 激活条件

必须同时满足：

```text
1. Group != Defeated

2. 至少 1 Monster alive

3. 当前 Squad 的 accepted command target
   == group.guardedObjectId

4. Squad 距 Resource Center <= 3
```

普通路过：

```text
不激活
```

---

# 47. 为什么不能点击时激活

玩家点击 Gold 后：

```text
Squad 可能还在地图另一端
```

Slime 应继续：

```text
Idle
```

只有威胁真正接近：

```text
才从 Guard Idle 进入 Combat
```

---

# 48. SquadBrain 集成

当前：

```text
MoveToTarget
```

状态中增加：

```text
Guard Proximity Check
```

更新顺序：

```text
if guarded target
    && within engage radius:
        activate combat
        return

else if motor.consumeArrived():
        begin normal resource interaction
```

Guard Check 必须在：

```text
consumeArrived
```

之前。

---

# 49. 新 SquadBrain State

增加：

```ts
CombatGuard
```

建议：

```text
HomeIdle
Wander
MoveToTarget
CombatGuard
EngageTarget
AttackResource
Reform
ReturnHome
```

---

# 50. 进入 CombatGuard

```text
MoveToTarget
↓
Guard proximity true
↓
SquadMotor.stop()
↓
SquadCombatController.joinEncounter(groupId)
↓
state = CombatGuard
```

---

# 51. SquadCombatController

新增：

```text
SquadCombatController
```

每个 Squad 一个。

它持有：

```text
squadId
SquadMotor
WarriorMotors
WarriorAnimators
WarriorHealth
WarriorCombatStats
CombatEventHub
CombatEncounterManager
```

---

# 52. SquadCombatController 不是 Resource Engagement

必须分开：

```text
SquadEngagementController
=
Resource Interaction

SquadCombatController
=
Monster Combat
```

不要把：

```text
Monster Targeting
Leash
Combat Position
```

塞进现有 Resource Slot Controller。

---

# 53. CombatEncounterManager

挂在：

```text
MapRoot
```

或由 `MainMapController` 创建并 update。

推荐：

```text
Component on MapRoot
```

内部：

```ts
Map<monsterGroupId, CombatEncounter>
```

规则：

> 一个 MonsterGroup 同一时刻最多对应一个 Encounter。

---

# 54. Multiple Squad

如果：

```text
Squad A
```

已经打：

```text
slime_guard_gold_01
```

然后：

```text
Squad B
```

也下令 Gold 并进入 3 格：

```text
join same CombatEncounter
```

禁止：

```text
创建第二个 Encounter
```

---

# 55. CombatEncounter

职责：

```text
双方 Participant
Target Selection
Combat Position Reservation
Move / Attack Decision
Death Removal
Retreat Tracking
Victory
```

不负责：

```text
HP 数值计算
SpriteFrame
Resource Harvest
Strategic Command
```

---

# 56. CombatantAdapter

为了让 Encounter 不直接依赖：

```text
WarriorMotor
MonsterMotor
```

新增通用接口：

```ts
export interface CombatantAdapter {
    readonly id: string;
    readonly faction: CombatFaction;

    isAlive(): boolean;

    getWorldGridPosition():
        GridPoint;

    getAttackRangeCells():
        number;

    getPreferredDistanceCells():
        number;

    moveToWorldGridPoint(
        point: GridPoint
    ): void;

    stopMove(): void;

    playAttack(
        direction: CombatFacing
    ): void;

    playIdle(
        direction: CombatFacing
    ): void;

    stopAttack(): void;

    subscribeAttackImpact(
        listener: () => void
    ): () => void;
}
```

---

# 57. Combat Faction

```ts
enum CombatFaction {
    Friendly = 0,
    Hostile = 1,
}
```

当前：

```text
Warrior = Friendly
Slime = Hostile
```

以后：

```text
Tower
Summon
Neutral
```

再扩展。

---

# 58. WarriorCombatantAdapter

把现有：

```text
WarriorMotor
WarriorAnimator
CombatStats
HealthComponent
SquadMotor
```

适配为：

```text
CombatantAdapter
```

关键：

```text
moveToWorldGridPoint
```

内部转换：

```text
worldPoint
-
SquadRoot grid position
=
Warrior local grid offset
```

然后调用：

```text
WarriorMotor.moveToLocalGridOffset()
```

---

# 59. MonsterCombatantAdapter

把：

```text
MonsterMotor
MonsterAnimator
CombatStats
HealthComponent
```

适配为相同接口。

Encounter 因此完全不关心：

```text
这是 Warrior 还是 Slime
```

---

# 60. Combat Position

资源使用：

```text
InteractionSlot
```

战斗使用：

```text
CombatPosition
```

两套系统必须继续分开。

---

# 61. Combat Position 基础形态

每个 Target 提供四个逻辑 Side：

```text
        Top

Left   Target   Right

       Bottom
```

---

# 62. Combat Position 数据

```ts
export interface CombatPosition {
    targetId: string;

    side:
        CombatPositionSide;

    worldGridPoint:
        GridPoint;
}
```

---

# 63. Position Point

```text
Target Position
+
Side Unit Vector
×
Attacker Preferred Distance
```

例如：

```text
Warrior attacking Slime
preferredDistance = 0.75
```

Left：

```text
target.x - 0.75
target.y
```

---

# 64. Combat Position Reservation

新增：

```text
CombatPositionReservation
```

维护：

```text
targetId
→
Top / Bottom / Left / Right
→
attackerId | free
```

---

# 65. Position Reservation 规则

一个 Side：

```text
同一时间只允许一个 Attacker 预约
```

例如：

```text
Slime_0.Left
→ warrior_0

Slime_0.Right
→ warrior_1
```

不使用：

```text
Collider
Push
Separation Force
```

---

# 66. 选择 Combat Position

攻击者第一次选 Target 时：

```text
获取 Target 4 sides
↓
过滤已预约
↓
选择离自己最近的 free side
↓
reserve
```

---

# 67. Target 移动

不要每帧：

```text
重新选 Side
```

保持：

```text
same target
+
same reserved side
```

只更新：

```text
该 Side 对应的 worldGridPoint
```

这样单位不会左右抖动。

---

# 68. Position Release

以下情况释放：

```text
Target 死亡
Attacker 死亡
Attacker 换 Target
Attacker Retreat
Encounter End
```

---

# 69. Target Selection

第一版：

```text
nearest alive enemy
```

Warrior：

```text
nearest alive Slime
```

Slime：

```text
nearest alive Warrior
```

---

# 70. Sticky Target

一旦选择：

```text
保持 Target
```

只有：

```text
Target Dead
Target Detached
Target Invalid
```

才重新 Acquire。

禁止：

```text
每帧 nearest
```

否则会频繁切换目标。

---

# 71. Combat Agent Update

对每个 Combatant：

```text
if dead:
    ignore

if no target:
    acquire

if target invalid:
    release position
    acquire

if no reserved position:
    reserve

if target within attack range:
    stop move
    face target
    attack

else:
    move toward reserved combat position
```

---

# 72. Attack 判定

Combat Position 不是：

```text
必须精确踩到
```

攻击判断使用：

```text
distance(attacker, target)
<=
attackRangeCells
```

原因：

```text
Target 也会移动
```

否则会永远追一个移动点。

---

# 73. Attack Facing

进入 Attack 时：

```text
attacker → target
```

计算：

```text
dx / dy
```

得到：

```text
Down / Up / Left / Right
```

传给对应 Animator。

---

# 74. Attack Impact

Warrior：

```text
WarriorAnimator
↓
impact timing
↓
CombatEncounter
↓
CombatEventHub.emitAttackImpact({
    attackerId,
    targetId,
    damage
})
```

Slime 同样：

```text
MonsterAnimator
↓
impact timing
↓
CombatEncounter
↓
CombatEventHub
```

---

# 75. Damage 系统完全复用

已有：

```text
HealthComponent
AttackImpactSignal
CombatEventHub
DamageResult
HitFlash
DamagePopup
HealthBar
```

Monster 不允许另写一套：

```text
MonsterDamageSystem
```

---

# 76. MonsterAttackReceiver

新增：

```text
MonsterAttackReceiver
```

与 Warrior Receiver 对称。

收到：

```text
AttackImpact
```

执行：

```text
Health.takeDamage
↓
actualDamage > 0
├── HitFlash
└── DamagePopup
```

返回：

```text
AttackImpactResult
```

---

# 77. Monster Health Bar

Slime 使用：

```text
Resource Health Bar Texture
```

即红色血条。

位置：

```text
与 Warrior HealthBar 同类规则
```

Monster 16×16：

```text
local y ≈ +11 source px
```

---

# 78. Monster 死亡

Health：

```text
0
```

之后：

```text
Encounter 立即标记 dead
↓
释放所有 Reservation
↓
从 target pool 移除
↓
停止 Move / Attack
↓
Combat Receiver unregister
↓
短延迟后隐藏 / destroy Monster Node
```

第一版：

```text
无需死亡动画
```

---

# 79. Monster Death Feedback Delay

建议：

```text
0.12 sec
```

保留：

```text
最后一次 Flash
Damage Popup
```

Damage Popup 在：

```text
WorldFeedbackRoot
```

所以 Monster Node 销毁后仍可完成动画。

---

# 80. Partial Guard Death

例如第一次：

```text
Slime_0 dead
Slime_1 HP 3/8
Slime_2 HP 5/8
```

玩家撤退。

ReturnToGuard：

```text
Slime_0 不复活
Slime_1 保持 3/8
Slime_2 保持 5/8
```

再次进入：

```text
只激活 Slime_1
Slime_2
```

---

# 81. Guard Defeated

当：

```text
aliveMonsterCount == 0
```

Group：

```text
state = Defeated
```

永久生效。

`MonsterRuntimeRegistry.getGuardForResource('gold_01')`：

```text
返回 null
```

---

# 82. Gold 自动解锁

Victory 后：

```text
Gold 不需要修改 WorldObjectData
```

因为：

```text
没有 Alive Guard
=
已经解锁
```

---

# 83. Victory 后原命令继续

当前 Squad Command：

```text
commandTargetId = gold_01
```

Victory：

```text
不要 clear command
```

流程：

```text
Combat Victory
↓
Warrior stop attack
↓
release combat positions
↓
Reform
↓
重新从当前 Squad Position
对 gold_01 求 A*
↓
MoveToTarget
↓
没有 Guard
↓
正常 InteractionSlot
↓
Harvest Gold
```

---

# 84. SquadCombatController Victory Signal

提供：

```ts
consumeEncounterVictory(): boolean
```

只消费一次。

Brain：

```text
CombatGuard
↓
Victory
↓
pendingTargetId = commandTargetId
↓
Combat Reform
↓
重新执行同一命令
```

---

# 85. Guard Leash

固定：

```text
6.0 Grid Cells
```

中心：

```text
Guarded Resource Center
```

不是：

```text
某个 Slime 初始位置
```

---

# 86. Player Retreat

玩家在 CombatGuard：

```text
点击其他 Target
或
点击 Base
```

流程：

```text
新 Command 被接受
↓
SquadCombatController.requestRetreat()
↓
Friendly Combatant：
    stop Attack
    release Combat Position
    return Formation
↓
Participant state = Retreating
↓
Brain 等 Formation Ready
↓
Squad 开始新 Strategic Movement
```

---

# 87. Retreating Participant

Squad 虽然：

```text
不再主动攻击
```

但在离开 Leash 前：

```text
仍然可以被 Slime 追击 / 攻击
```

这保证：

```text
撤退不是瞬间脱战无敌
```

---

# 88. Participant State

```ts
enum EncounterParticipantState {
    Active = 0,
    Retreating = 1,
    Detached = 2,
}
```

---

# 89. Detach 条件

Retreating Squad：

```text
distance(
    squad center,
    guarded resource center
)
>
6.0
```

则：

```text
Detached
```

Slime 不再把该 Squad Warrior 作为 Target。

---

# 90. Guard Return 条件

如果：

```text
Encounter 中没有
任何 Active / Retreating enemy
仍处于 Leash 内
```

Monster Group：

```text
Engaged
→
Returning
```

---

# 91. ReturnToGuard

进入：

```text
Returning
```

时所有存活 Slime：

```text
stopAttack
release target
release reservations
MonsterMotor.returnToGuardOffset()
```

---

# 92. ReturnToGuard 状态

返回期间：

```text
不主动攻击
不选择 Target
```

全部 surviving Slime 到位：

```text
Group State
→ IdleGuard
```

Animator：

```text
Idle
```

HP：

```text
保持
```

---

# 93. Returning 可被再次激活

如果 Slime 尚未走回去：

```text
另一支 / 原支 Squad
command target = gold_01
且进入 engage radius
```

则：

```text
Returning
→ Engaged
```

从 Slime 当前实时位置重新开始 Combat。

---

# 94. Monster 自身不能跑出 Leash

CombatPositionResolver 对 Hostile Guard Monster：

```text
生成目标位置时
必须检查：
position 到 Guard Center <= 6
```

若 Warrior 已经跑出：

```text
Leash
```

Monster：

```text
不再向外追
```

---

# 95. Guard 只守 Resource

非 Gold Command 的 Squad：

```text
即使经过 Gold 旁边 1 格
```

也：

```text
不会激活 Slime
```

激活的关键条件仍然：

```text
当前 Accepted Command Target
==
gold_01
```

---

# 96. Multiple Squad Exit

如果：

```text
Squad A retreat
Squad B still fighting
```

Slime：

```text
继续 Engaged
```

不会 ReturnToGuard。

只有：

```text
所有参与 Squad
都离开 / 死亡
```

才 Return。

---

# 97. Warrior Death：本轮最小实现

Monster Combat 已经能造成真实 Damage，因此 Warrior HP=0 必须有明确行为。

按照当前 GDD：

```text
死亡成员当前回合无法继续参战
```

本轮实现最小版本：

```text
Warrior HP = 0
↓
Encounter 标记 Dead
↓
释放 Target / Combat Position
↓
停止 Move / Attack
↓
从 Enemy Target Pool 移除
↓
Warrior Node 隐藏
```

---

# 98. Warrior 本轮不实现复活

GDD 的：

```text
下一个回合恢复
```

需要未来：

```text
Round / Layer Lifecycle
```

本轮不实现。

不要在：

```text
ReturnHome
```

时自动复活。

---

# 99. Squad 全灭

如果一个 Squad：

```text
aliveWarriorCount == 0
```

则：

```text
Participant = Defeated
↓
Command 清除
↓
Flag 隐藏
↓
Squad Root 可返回 Base
```

Warrior 仍保持：

```text
Dead / hidden
```

等待未来 Round System。

---

# 100. Slime 攻击目标

Slime：

```text
只选择当前 Encounter
中的 Alive Warrior
```

Retreating Warrior：

```text
只要还没离开 Leash
仍可被选中
```

---

# 101. Strategic Navigation 与 Combat Movement 分离

跨地图：

```text
SquadMotor
+
WorldNavigator
+
A*
```

Combat：

```text
WarriorMotor
MonsterMotor
CombatPosition
```

Monster Combat 不运行全地图 A*。

---

# 102. Monster 不进入 NavigationGrid Occupancy

Slime：

```text
不 setBlocked
```

Warrior：

```text
也不 setBlocked
```

符合当前：

```text
单位无物理碰撞
```

原则。

---

# 103. Gold 仍然 Blocking

Gold Resource：

```text
1×1
```

继续：

```text
NavigationGrid blocked
```

直到：

```text
Gold 自己被采空并进入
现有 WorldObject Lifecycle 删除
```

Guard Monster 是否死亡：

```text
不改变 Gold occupancy
```

---

# 104. Combat Encounter 生命周期

创建：

```text
第一支 Squad 进入 engage radius
```

保持：

```text
只要 Group 尚未 Defeated
```

可以继续复用同一 runtime Encounter。

当：

```text
Group Returning / IdleGuard
```

Encounter 可以保持 dormant runtime，
或者 Manager 回收 active combat context。

推荐第一版：

```text
Encounter Runtime 保持
但没有 Active Participant 时不 update Combat
```

减少重复创建状态恢复复杂度。

---

# 105. MainMapController 新 Bootstrap

新增：

```text
MonsterRoot

MonsterRuntimeRegistry

MonsterGroupRenderer

CombatEncounterManager
```

顺序建议：

```text
WorldObject Runtime Registry
↓
NavigationGrid
↓
CombatEventHub
↓
WorldObjectRenderer
↓
MonsterRuntimeRegistry
↓
CombatEncounterManager
↓
MonsterGroupRenderer
↓
SquadRenderer
↓
WorldCommandController
```

---

# 106. MainMapController Inspector

新增：

```ts
@property(Texture2D)
slimeMoveTexture

@property(Texture2D)
slimeAttackTexture
```

Bootstrap：

```text
require Inspector Texture
```

不使用硬编码 UUID。

---

# 107. Visual Registry

虽然目前只有一种 Monster，Renderer 内不要写：

```text
if BlueSlime use slimeMoveTexture
```

Bootstrap 构造：

```ts
Map<MonsterVisualId, MonsterVisualAssets>
```

例如：

```ts
BlueSlime
→ {
    moveTexture,
    attackTexture
}
```

`MonsterGroupRenderer` 只按：

```text
visualId
```

查询。

以后第二种怪不需要改 AI。

---

# 108. MonsterGroupRenderer

负责：

```text
Monster Node creation
Component assembly
Visual lookup
Runtime Handle creation
```

不负责：

```text
Target Selection
Guard Activate
Leash
Attack
```

---

# 109. Monster Runtime Handle

建议：

```ts
interface MonsterRuntimeHandle {
    id: string;

    node: Node;

    motor:
        MonsterMotor;

    animator:
        MonsterAnimator;

    health:
        HealthComponent;

    stats:
        CombatStats;

    receiver:
        MonsterAttackReceiver;

    combatant:
        MonsterCombatantAdapter;
}
```

---

# 110. Monster Group Runtime Handle

```ts
interface MonsterGroupRuntimeHandle {
    id: string;

    data:
        MonsterGroupData;

    node:
        Node;

    controller:
        MonsterGroupController;

    members:
        Map<string, MonsterRuntimeHandle>;
}
```

---

# 111. Command 语义保持不变

Player：

```text
点击 Gold
```

Command：

```text
target = gold_01
```

不要转换成：

```text
target = slime_guard_gold_01
```

Guard Encounter 是：

```text
执行 Resource Command 期间
遇到的前置状态
```

---

# 112. Flag 行为

整个：

```text
MoveToTarget
CombatGuard
Victory Reform
MoveToTarget
Harvest
```

期间：

```text
Flag 始终在 Gold
```

只在：

```text
玩家取消
玩家改目标
Squad 全灭
Gold depleted
```

时移动 / 消失。

---

# 113. Gold Victory Transition

重要：

```text
MonsterGroup Defeated
```

不应该：

```text
WorldCommandController
重新发一条新命令
```

应该由当前：

```text
SquadBrain
```

保留 `commandTargetId` 并自动 resume。

---

# 114. Combat Encounter 不修改 Resource HP

Slime 活着时：

```text
Gold HP 不变
```

Combat Attack：

```text
只在 Warrior / Slime 之间
```

所有 Guard 死后：

```text
Squad 才进入
SquadEngagementController
```

采 Gold。

---

# 115. 怪物受击 UI

Slime：

```text
红色 Health Bar
Hit Flash
Damage Popup
```

全部复用现有系统。

不要创建：

```text
MonsterHealthBarView
MonsterDamagePopup
MonsterHitFlash
```

---

# 116. 怪物 Idle UI

Slime 初始 Idle 时：

```text
血条保持显示
```

第一版不做：

```text
只有交战才显示血条
```

保持系统简单。

---

# 117. Debug 日志

建议：

```text
[Guard]
activate group=slime_guard_gold_01
squad=initial_01
distance=2.91
```

```text
[Encounter]
join squad=initial_01
group=slime_guard_gold_01
```

```text
[CombatTarget]
attacker=initial_01/warrior_0
target=slime_gold_1
```

```text
[CombatPosition]
attacker=slime_gold_0
target=initial_01/warrior_2
side=Left
```

```text
[Monster]
dead=slime_gold_1
remaining=2
```

```text
[Encounter]
retreat squad=initial_01
```

```text
[Guard]
return group=slime_guard_gold_01
```

```text
[Guard]
idle group=slime_guard_gold_01
```

```text
[Guard]
defeated group=slime_guard_gold_01
```

```text
[SquadBrain]
resume guarded resource target=gold_01
```

---

# 118. 不允许逐帧日志

禁止：

```text
每帧打印 distance
每帧打印 CombatPosition
每帧打印 target position
```

只打印：

```text
状态改变
Target 改变
Reservation 改变
Death
Join / Leave
```

---

# 119. 推荐开发顺序

## Step 1：Gold

实现：

```text
Gold ResourceType
Gold Visual
Gold Static Object
Gold Inventory
Gold HUD
```

先确认：

```text
Gold 可以像普通 Resource 一样被采
```

此时暂时没有 Guard。

---

## Step 2：Slime Visual

实现：

```text
MonsterTypes
MonsterConfig
MonsterSpriteConfig
MonsterAnimator
MonsterMotor
MonsterGroupRenderer
```

目标：

```text
3 Slime
在 Gold 周围 Idle
```

还不 Combat。

---

## Step 3：Slime Damageable

装配：

```text
Health
HealthBar
HitFlash
DamagePopup
MonsterAttackReceiver
```

通过临时 CombatEventHub 调用验证：

```text
Slime 可以掉血
```

---

## Step 4：Monster Group Runtime

实现：

```text
StaticMonsterGroups
MonsterRuntimeRegistry
MonsterGroupController
```

验证：

```text
IdleGuard
```

以及：

```text
手工触发 ReturnToGuard
```

---

## Step 5：Generic Combat

实现：

```text
CombatantAdapter
CombatPositionResolver
Reservation
CombatEncounter
CombatEncounterManager
```

先使用：

```text
1 Warrior vs 1 Slime
```

验证：

```text
Target
Move
Attack
Damage
Death
```

---

## Step 6：4 vs 3

加入：

```text
4 Warrior
3 Slime
```

验证：

```text
Sticky Target
Position Reservation
Target Death Reacquire
```

---

## Step 7：Guard Activation

接：

```text
SquadBrain MoveToTarget
```

实现：

```text
距离 <=3
才 activate
```

---

## Step 8：Retreat / Leash

实现：

```text
Retreating participant
6-cell leash
ReturnToGuard
HP persistence
```

---

## Step 9：Victory → Harvest

实现：

```text
all monsters dead
↓
same command resumes
↓
Gold harvest
```

---

## Step 10：Multiple Squad Ready

不需要本轮 UI 选择多个 Squad，

但 Encounter 数据结构必须验证：

```text
join second Squad
```

不会创建第二个 Encounter。

---

# 120. 禁止实现

本轮禁止：

```text
Monster 全地图巡逻
普通 Aggro Radius
Monster 主动攻击路过单位
Monster A*
单位 Collider
单位推挤
NavMesh
复杂仇恨值
Tank Threat
远程攻击
Projectile
AOE
Buff / Debuff
Armor
Crit
Monster Loot
Gold Guard Respawn
Slime 自动回血
Warrior 下回合复活
Monster Death Animation
Boss
建筑战斗
```

---

# 121. User Acceptance Case 1：Initial Idle

启动：

```text
Gold 显示
3 Slime 围着 Gold
```

预期：

```text
Slime 原地 Idle
不主动移动
不主动攻击
```

---

# 122. User Acceptance Case 2：点击远处 Gold

玩家点击：

```text
gold_01
```

Squad 距离：

```text
> 3
```

预期：

```text
Flag → Gold

Squad 正常走

Slime 仍 Idle
```

---

# 123. User Acceptance Case 3：Guard Activate

Squad 距：

```text
Gold <= 3
```

预期：

```text
Squad Strategic Movement 停止
Guard Activate
Slime 离开 Guard Position
Warrior 展开
双方开始 Combat
```

---

# 124. User Acceptance Case 4：Combat UI

攻击：

```text
Warrior → Slime
Slime → Warrior
```

都必须产生：

```text
Health decrease
HealthBar update
HitFlash
Damage Popup
```

---

# 125. User Acceptance Case 5：Target Sticky

Combat 中：

```text
距离轻微变化
```

预期：

```text
单位不会每帧换目标
不会左右抖动
```

只有 Target 死：

```text
才 Acquire 新 Target
```

---

# 126. User Acceptance Case 6：Combat Position

多个 Warrior 攻同一个 Slime：

```text
不能全部站同一个 Side
```

日志可以看到：

```text
Top
Bottom
Left
Right
```

预约。

---

# 127. User Acceptance Case 7：Retreat

Combat 中点击：

```text
Base
```

预期：

```text
Warrior stop attack
↓
Reform
↓
Squad retreat
```

Slime：

```text
继续追一小段
```

---

# 128. User Acceptance Case 8：Leash

Squad 距 Gold：

```text
> 6
```

预期：

```text
Slime 不再追
↓
ReturnToGuard
↓
回初始位置
↓
Idle
```

---

# 129. User Acceptance Case 9：HP Persistence

撤退前：

```text
Slime_0 HP = 3/8
```

ReturnToGuard 后：

```text
仍然 3/8
```

再次来：

```text
从 3/8 继续打
```

---

# 130. User Acceptance Case 10：Partial Death

第一次：

```text
杀 1 只
然后撤退
```

第二次：

```text
只能看到 / 激活剩余 2 只
```

死亡 Slime：

```text
不复活
```

---

# 131. User Acceptance Case 11：Victory

3 Slime 全死：

```text
Guard = Defeated
```

预期：

```text
Warrior Reform
↓
Squad 自动继续 gold_01
↓
围 Gold
↓
Gold HP 开始下降
↓
黄金 HUD 增加
```

不要要求：

```text
玩家再点击一次 Gold
```

---

# 132. User Acceptance Case 12：路过不触发

Squad 当前命令：

```text
wood_01
```

路径恰好经过 Gold：

```text
距离 < 3
```

预期：

```text
Slime 仍 Idle
```

因为：

```text
command target != gold_01
```

---

# 133. User Acceptance Case 13：Second Squad

如果测试环境临时生成第二 Squad：

```text
两个 Squad 都目标 gold_01
```

预期：

```text
加入同一个 Encounter
```

不是：

```text
2 个 Encounter
```

---

# 134. User Acceptance Case 14：Warrior Death

Warrior HP=0：

```text
立即停止 Combat
不再作为 Slime Target
不再输出 Damage
隐藏 Node
```

其他 Warrior：

```text
继续战斗
```

---

# 135. Definition of Done

- [ ] Gold ResourceType
- [ ] Gold VisualId
- [ ] Gold visual col=4 row=14 1×1
- [ ] Gold Runtime Config
- [ ] Inventory 增加 Gold
- [ ] HUD 显示 黄金
- [ ] Static gold_01
- [ ] MainMapController 两个 Slime Texture Inspector 字段
- [ ] MonsterRoot 运行时创建
- [ ] 3 Slime 正确生成
- [ ] Slime 初始 Idle
- [ ] Move Sheet 4 dirs × 4 frames
- [ ] Attack Sheet 4 dirs × 4 frames
- [ ] MonsterAnimator Impact 边沿触发
- [ ] MonsterMotor
- [ ] Monster CombatStats
- [ ] Monster Health
- [ ] Monster 红色 HealthBar
- [ ] Monster HitFlash
- [ ] Monster DamagePopup
- [ ] MonsterAttackReceiver
- [ ] MonsterRuntimeRegistry
- [ ] MonsterGroupController
- [ ] IdleGuard
- [ ] Engaged
- [ ] Returning
- [ ] Defeated
- [ ] Engage Radius = 3
- [ ] Leash Radius = 6
- [ ] 只有当前 Command Target=guarded resource 才激活
- [ ] 普通路过不会激活
- [ ] SquadCombatController
- [ ] CombatEncounterManager
- [ ] 每 Group 只有一个 Encounter
- [ ] CombatantAdapter
- [ ] WarriorCombatantAdapter
- [ ] MonsterCombatantAdapter
- [ ] CombatPositionResolver
- [ ] Position Reservation
- [ ] Sticky Target
- [ ] Target Death Reacquire
- [ ] Attack Range 判定
- [ ] Warrior 可以伤害 Slime
- [ ] Slime 可以伤害 Warrior
- [ ] Warrior Death 最小逻辑
- [ ] Monster Death
- [ ] Partial Death 持久
- [ ] Retreat
- [ ] Retreating 仍可被追击
- [ ] 超过 Leash 后 detach
- [ ] Slime ReturnToGuard
- [ ] Return 后 HP 不恢复
- [ ] Returning 可再次被激活
- [ ] 全灭后 Guard 永久 Defeated
- [ ] Victory 后同 Command 自动继续 Gold
- [ ] Gold 最终正常 Harvest
- [ ] Flag 在战斗期间仍指向 Gold
- [ ] Monster 不写入 NavigationGrid occupancy
- [ ] 不使用 Physics Collision
- [ ] README 更新
- [ ] Console 无 Error

---

# 136. Agent 完成后必须回报

```text
1. 新增 / 修改文件清单

2. 最终 Commit SHA

3. Gold Resource 配置
   - gridX/gridY
   - col/row
   - HP/yield

4. Slime Move / Attack Texture
   Inspector 字段名称

5. MonsterConfig 数值

6. StaticMonsterGroups 数据

7. MonsterGroup State Machine

8. CombatEncounter API

9. CombatantAdapter API

10. CombatPosition Reservation 数据结构

11. SquadBrain 新 CombatGuard 流程

12. WarriorAnimator Impact subscribe 改造

13. Initial Idle 截图

14. 点击 Gold 但距离 >3：
    Slime 仍 Idle 的截图 / 日志

15. 距离 <=3：
    Guard Activate 日志

16. 4 Warrior vs 3 Slime 战斗截图

17. Warrior → Slime Damage 日志

18. Slime → Warrior Damage 日志

19. Damage Popup / HitFlash / HealthBar 截图

20. Retreat 日志

21. Leash >6 后 ReturnToGuard 日志

22. Slime HP 在 Return 前后保持不变的日志

23. 杀 1 只后撤退，
    再进场只剩 2 只的验证

24. all Slime dead：
    Guard Defeated 日志

25. Victory 后自动继续 Gold Harvest 日志

26. Gold HUD 增加截图

27. 路过 Gold 不触发 Guard 的验证

28. 临时 2 Squad 加入同 Encounter 的验证

29. Console 无 Error
```

---

# 137. 最终长期结构

```text
                      PLAYER COMMAND
                           │
                           ▼
                    guarded resource
                         Gold
                           │
                           ▼
                      SquadBrain
                           │
                  MoveToTarget / A*
                           │
                 distance <= 3 cells
                           │
                           ▼
                MonsterGroupController
                           │
                           ▼
                CombatEncounterManager
                           │
                           ▼
                    CombatEncounter
               ┌───────────┴───────────┐
               │                       │
               ▼                       ▼
         Friendly Combatants     Hostile Combatants
          Warrior Adapter         Monster Adapter
               │                       │
               └───────────┬───────────┘
                           ▼
                 CombatPositionResolver
                           │
                           ▼
                    Target + Move
                           │
                           ▼
                       Animator
                           │
                    Impact Timing
                           │
                           ▼
                    CombatEventHub
                           │
                           ▼
                     Target Receiver
                           │
                           ▼
          Health / HitFlash / Popup / Bar
```

退出：

```text
Player changes command
↓
Friendly = Retreating
↓
Warrior Reform
↓
Squad Strategic Movement
↓
Slime chase within 6 cells
↓
Squad leaves leash
↓
Monster ReturnToGuard
↓
Idle
↓
HP preserved
```

胜利：

```text
all Monster dead
↓
Guard Defeated
↓
same Resource Command preserved
↓
Warrior Reform
↓
Squad approaches Gold again
↓
Interaction Slots
↓
Harvest Gold
```

---

# 138. 本轮最重要的架构结论

> **Resource 是玩家的战略目标，Monster Guard 是执行这条战略命令时遇到的前置战斗。**

> **Guard 不在点击时激活，而在真正接近资源时激活。**

> **Monster 只守资源，不承担普通地图 Aggro。**

> **Combat 与 Resource Interaction 是两套局部行为系统：CombatPosition vs InteractionSlot。**

> **Encounter 是双方战斗的共同上下文，而不是让 SquadBrain 或 MonsterGroupController 直接管理所有单体。**

> **撤退并不会瞬间让怪物失去目标；Leash 才是 Guard 与地图自由追击之间的边界。**

> **Guard 返回后 HP 不恢复，使玩家撤退与二次进攻成为可持续的战略行为。**

> **所有 Guard 死亡后，原本的 Resource Command 自动继续，保持“我要这个资源”这一玩家意图从头到尾不变。**
