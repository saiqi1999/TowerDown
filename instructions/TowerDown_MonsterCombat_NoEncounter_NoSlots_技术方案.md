# TowerDown 怪物战斗系统技术方案 v2
## 去 Encounter 化 + 取消预约站位系统

> 仓库：`saiqi1999/TowerDown`  
> Cocos Creator：3.8.8  
> 适用阶段：当前 `main` 的 Monster Combat 重构  
>
> 本版在上一版“去 Encounter 化”基础上进一步简化：
>
> ```text
> 删除 CombatEncounter
> 删除 CombatEncounterManager
> 删除 CombatPositionResolver
> 删除 CombatPositionReservation
> 不再存在 MeleeSlotRegistry
> 不再预约 Top / Bottom / Left / Right
> ```
>
> 战斗最终采用：
>
> ```text
> SquadBrain
>     ↓
> MonsterGroupController
>     ↓
> 每个 Warrior / Slime 自己选择目标
>     ↓
> 直接朝目标靠近
>     ↓
> 进入攻击距离后停止
>     ↓
> 播放攻击动画
>     ↓
> 命中帧造成伤害
> ```
>
> 设计依据：
>
> - Squad 自身 4 人阵型本来就是散开的
> - 3 只 Slime 的 Guard Position 也是散开的
> - 地图空间不是严格格斗棋盘
> - 本项目不把单位碰撞、堵路、精确围位作为核心机制
> - 当前阶段更重要的是“稳定、可重复进入退出、不会卡死”
>
> 因此不再维护额外的近战预约位置系统。

---

# 1. 本轮核心目标

最终完整流程：

```text
玩家点击 Gold
↓
Squad 正常 A* 靠近
↓
距离 Gold <= 3 格
↓
Guard 激活
↓
SquadRoot 停止战略移动
↓
WarriorCombatController 激活
↓
MonsterCombatController 激活
↓
双方独立选择 Target
↓
直接向 Target 靠近
↓
进入 AttackRange
↓
停止移动并攻击
↓
Animator Hit Frame
↓
CombatEventHub
↓
Health / Flash / Popup / Bar
```

撤退：

```text
玩家点击其他目标 / Base
↓
Warrior 停止战斗
↓
回 Formation
↓
Squad 执行新 Command
↓
Slime 在 Guard Leash 内继续追
↓
Squad 离 Gold > 6 格
↓
Slime 放弃 Target
↓
ReturnToGuard
↓
Idle
```

重新进入：

```text
再次点击 Gold
↓
再次进入 3 格
↓
同一个 MonsterGroupController
重新激活
↓
重新 Target
↓
继续战斗
```

胜利：

```text
3 Slime 全死
↓
Guard Defeated
↓
Warrior Reform
↓
原 Gold Command 保留
↓
重新靠近 Gold
↓
Resource Interaction
↓
Harvest Gold
```

---

# 2. 本轮明确删除的概念

以下概念全部从战斗执行链删除：

```text
CombatEncounter
CombatEncounterManager

CombatPosition
CombatPositionResolver
CombatPositionReservation

MeleeSlot
MeleeSlotRegistry

Top / Bottom / Left / Right
Combat Slot
Attack Position Reservation
```

不保留：

```text
“W0 占 Slime0.Top”
```

这种状态。

---

# 3. 最终战斗架构

```text
                    WorldCommandController
                             │
                             ▼
                         SquadBrain
                             │
                 Guard target reached?
                             │
                             ▼
                  MonsterGroupController
                     │               │
                     ▼               ▼
          SquadCombatController   Monster Group
                     │               │
          ┌──────────┴───────┐       │
          ▼                  ▼       ▼
 WarriorCombatController ...   MonsterCombatController
          │                          │
          └────────────┬─────────────┘
                       ▼
                  Motor / Animator
                       │
                  Hit Frame Event
                       │
                       ▼
                 CombatEventHub
                       │
                       ▼
          Health / HitFlash / Popup / Bar
```

---

# 4. 三层职责

## 4.1 SquadBrain

只负责：

```text
当前 Command
战略移动
Guard 是否阻挡资源目标
何时进入 GuardCombat
何时退出 Combat
何时继续原资源命令
何时 ReturnHome
```

禁止负责：

```text
某个 Warrior 打谁
某个 Slime 打谁
单兵移动
攻击动画
伤害
```

---

## 4.2 MonsterGroupController

只负责：

```text
Guard Center
Engage Radius = 3
Leash Radius = 6

Guarding
Engaged
Returning
Defeated

当前有哪些 Squad 在攻击
哪些 Squad 正在撤退
哪些 Warrior 是合法 Monster Target
哪些 Monster 还活着
什么时候 ReturnToGuard
什么时候 GuardDefeated
```

不负责：

```text
具体 Unit moveTo
具体 Attack
具体 Position
```

---

## 4.3 Unit Combat Controller

每个单位各自一个。

Warrior：

```text
WarriorCombatController
```

Slime：

```text
MonsterCombatController
```

负责：

```text
AcquireTarget
StickyTarget
Approach
Attack
Reacquire
ExitCombat
```

---

# 5. 文件删除

删除：

```text
assets/scripts/combat/CombatEncounter.ts
assets/scripts/combat/CombatEncounter.ts.meta

assets/scripts/combat/CombatEncounterManager.ts
assets/scripts/combat/CombatEncounterManager.ts.meta

assets/scripts/combat/CombatPositionResolver.ts
assets/scripts/combat/CombatPositionResolver.ts.meta

assets/scripts/combat/CombatPositionReservation.ts
assets/scripts/combat/CombatPositionReservation.ts.meta

assets/scripts/combat/CombatantTypes.ts
assets/scripts/combat/CombatantTypes.ts.meta

assets/scripts/squad/WarriorCombatantAdapter.ts
assets/scripts/squad/WarriorCombatantAdapter.ts.meta

assets/scripts/monster/MonsterCombatantAdapter.ts
assets/scripts/monster/MonsterCombatantAdapter.ts.meta
```

---

# 6. 不再新增 Slot 系统

上一版方案中的：

```text
MeleeSlotRegistry.ts
MeleeSlotSide
MeleeSlotReservation
```

全部取消。

本轮不新增任何：

```text
Position Reservation
Target Slot
Side Assignment
```

类。

---

# 7. 新增文件

```text
assets/scripts/combat/
├── CombatUnitTypes.ts
└── CombatMath.ts

assets/scripts/squad/
└── WarriorCombatController.ts

assets/scripts/monster/
└── MonsterCombatController.ts
```

重写：

```text
assets/scripts/squad/
└── SquadCombatController.ts

assets/scripts/monster/
├── MonsterGroupController.ts
└── MonsterRuntimeRegistry.ts
```

修改：

```text
assets/scripts/map/
└── MainMapController.ts

assets/scripts/squad/
├── SquadBrain.ts
├── SquadRenderer.ts
├── SquadTypes.ts
├── SquadEngagementController.ts
├── WarriorAnimator.ts
└── WarriorMotor.ts

assets/scripts/monster/
├── MonsterGroupRenderer.ts
├── MonsterAnimator.ts
└── MonsterMotor.ts
```

---

# 8. CombatUnitTypes.ts

```ts
export type CombatTeam =
    'squad'
    | 'monster';

export interface CombatUnitRef {
    readonly id: string;
    readonly team: CombatTeam;

    isAlive(): boolean;

    getWorldGridPosition():
        GridPoint;
}
```

只提供：

```text
查询
```

不提供：

```text
moveTo
attack
setTarget
```

---

# 9. CombatMath.ts

提供：

```ts
distanceSquared(a, b)
distance(a, b)
normalize(dx, dy)
resolveFacing(from, to)
```

增加：

```ts
moveTargetAtDistance(
    from: GridPoint,
    target: GridPoint,
    desiredDistance: number,
): GridPoint;
```

用途：

> 让单位朝 Target 靠近，但最终目标不是 Target 中心，而是 Target 前方 `preferredDistance`。

---

# 10. Direct Approach 算法

假设：

```text
self = W0
target = Slime0
preferredDistance = 0.75
```

计算：

```ts
dx = target.x - self.x;
dy = target.y - self.y;

len = sqrt(dx*dx + dy*dy);

desired = {
    x: target.x - dx / len * preferredDistance,
    y: target.y - dy / len * preferredDistance,
};
```

结果：

```text
W0
向 Slime0 接近
但目标点停在 Slime0 前方约 0.75 格
```

禁止：

```ts
moveTo(target.position)
```

因为那会直接重叠。

---

# 11. 双方都使用 Direct Approach

本版最终规则：

```text
Warrior:
Direct Approach

Slime:
Direct Approach
```

双方完全对称。

不再：

```text
Warrior SlotApproach
Slime DirectChase
```

---

# 12. 为什么双方都可以 Direct Approach

因为：

```text
W0
Slime0
```

互相接近时：

```text
双方每帧都会先检查实际 distance
```

一旦：

```text
distance <= attackRange
```

立即：

```text
stop
attack
```

而不是继续走到 desired point。

因此不会要求双方真的都走到：

```text
0.75
```

目标点。

实际效果：

```text
双方移动接近
↓
先进入 0.85 AttackRange
↓
双方停止
↓
开打
```

---

# 13. Attack Range Hysteresis

配置保持：

```text
attackRange = 0.85
preferredDistance = 0.75
```

进入 Attack：

```text
distance <= 0.85
```

离开 Attack：

```text
distance > 0.95
```

使用：

```text
0.10
```

hysteresis。

目的：

防止：

```text
0.84 → Attack
0.86 → Walk
0.84 → Attack
```

每帧抖动。

---

# 14. 不做单位碰撞

仍然明确：

```text
无 Collider
无 Push
无 Separation Force
无单位 Occupancy
```

即使偶尔：

```text
Sprite 有少量视觉重叠
```

可以接受。

只要：

```text
Grid Center
不会长期完全重合
```

即可。

---

# 15. Target 分配仍需要轻量均衡

虽然取消 Position Slot，但仍然建议保留：

```text
Target Claim Count
```

这不是站位预约。

它只解决：

```text
4 Warrior
不要永远全部锁同一个 Slime
```

---

# 16. Target Claim 数据

MonsterGroupController 内维护：

```ts
Map<
    warriorId,
    monsterId
>
```

和：

```ts
Map<
    monsterId,
    warriorId
>
```

分别记录当前 Sticky Target。

注意：

```text
只是“谁在打谁”
```

不是：

```text
谁站哪里
```

---

# 17. Warrior Target Selection

Warrior Acquire：

候选：

```text
当前 Guard Group
所有 Alive Monster
```

排序：

```text
第一优先：
当前被 Warrior 锁定数量最少

第二优先：
离自己最近
```

例如：

```text
Slime0 claims = 2
Slime1 = 1
Slime2 = 1
```

新 Warrior 优先：

```text
Slime1 / Slime2
```

---

# 18. Slime Target Selection

Slime Acquire：

候选：

```text
当前 Group 所有合法 participant
中的 Alive Warrior
```

排序：

```text
第一优先：
被 Slime 锁定数量最少

第二优先：
最近
```

---

# 19. Sticky Target

一旦 Target 选定：

```text
只要 Target alive
并且仍合法
```

就保持。

禁止：

```text
每帧 nearest
```

---

# 20. WarriorCombatController

挂：

```text
Warrior_i
```

---

# 21. WarriorCombatState

```ts
enum WarriorCombatState {
    Inactive = 0,
    AcquiringTarget = 1,
    Approaching = 2,
    Attacking = 3,
    Dead = 4,
}
```

取消：

```text
WaitingForSlot
```

---

# 22. WarriorCombatController 依赖

```ts
interface WarriorCombatControllerConfig {
    unitId: string;

    squadMotor: SquadMotor;

    motor: WarriorMotor;

    animator: WarriorAnimator;

    health: HealthComponent;

    stats: CombatStats;

    combatEventHub: CombatEventHub;
}
```

---

# 23. enterGuardCombat()

```ts
enterGuardCombat(
    group: MonsterGroupController
): void
```

执行：

```text
clear previous target
group = target group
state = AcquiringTarget
```

---

# 24. Warrior Acquire

```text
state = AcquiringTarget
↓
group.acquireMonsterTarget(
    selfId,
    currentPosition
)
```

成功：

```text
targetId = target.id
group.claimWarriorTarget(...)
state = Approaching
```

没有：

```text
Position reservation
```

---

# 25. Warrior Approaching

每帧：

```text
target = current target
targetPosition = target current world position
selfPosition = current world position
distance = actual distance
```

如果：

```text
distance <= attackRange
```

：

```text
motor.stop()
face target
animator.playAttack()
state = Attacking
```

否则：

```text
desiredPoint =
moveTargetAtDistance(
    selfPosition,
    targetPosition,
    preferredDistance
)
```

转换：

```text
world desired
-
SquadRoot position
=
local offset
```

调用：

```ts
WarriorMotor.moveToLocalGridOffset(...)
```

---

# 26. Warrior Attacking

每帧：

```text
target validity
actual distance
```

如果：

```text
distance > attackRange + 0.10
```

：

```text
animator.playIdle()
state = Approaching
```

否则：

```text
保持 Attack
```

---

# 27. Warrior Attack Impact

Animator 命中帧：

```text
WarriorCombatController
```

检查：

```text
state == Attacking
target alive
target still in same group
distance <= attackRange + smallImpactTolerance
```

建议：

```text
smallImpactTolerance = 0.08
```

通过：

```ts
combatEventHub.emitAttackImpact({
    attackerId: selfId,
    targetId,
    damage: stats.getAttackDamage(),
});
```

---

# 28. Warrior Target 死亡

```text
release target claim
target = null
state = AcquiringTarget
```

下一帧重新选。

---

# 29. Warrior exitCombat()

执行：

```text
release target claim
target = null
motor.stop()
animator.playIdle()
state = Inactive
```

回 Formation：

```text
不在这里做
```

由 SquadCombatController 统一处理。

---

# 30. Warrior Death

Health=0：

```text
release target claim
target=null
motor.stop
state=Dead
禁止 damage
```

Node 暂不销毁。

---

# 31. MonsterCombatController

挂：

```text
Slime_x
```

---

# 32. MonsterCombatState

```ts
enum MonsterCombatState {
    GuardIdle = 0,
    AcquiringTarget = 1,
    Approaching = 2,
    Attacking = 3,
    Returning = 4,
    Dead = 5,
}
```

---

# 33. Monster setup

依赖：

```text
unitId
guardCenter
guardOffset
motor
animator
health
stats
CombatEventHub
```

保存：

```text
guardWorldPosition
```

---

# 34. Monster Activate

```text
GuardIdle / Returning
↓
activateGuardCombat(group)
↓
AcquiringTarget
```

Returning 可以被直接打断。

---

# 35. Monster Acquire

```text
group.acquireWarriorTarget(
    selfId,
    currentPosition
)
```

成功：

```text
claim
target
Approaching
```

---

# 36. Monster Approaching

与 Warrior 完全一致：

```text
distance <= attackRange
→ stop + Attack

否则：
desiredPoint =
targetPosition
-
normalized(target-self)
* preferredDistance

motor.moveTo(desiredPoint)
```

---

# 37. Monster Leash

Slime desiredPoint 必须 clamp：

```text
guardCenter
leashRadius=6
```

如果 Target 已经在 leash 外：

```text
不继续追
```

Group 会很快使 Target invalid。

---

# 38. Monster Attacking

如果：

```text
distance <= attackRange+0.10
```

保持 Attack。

否则：

```text
Approaching
```

---

# 39. Monster Attack Impact

直接由：

```text
MonsterCombatController
```

订阅：

```text
MonsterAnimator.subscribeAttackImpact()
```

命中检查：

```text
Attacking
Target valid
distance in tolerance
```

然后：

```text
CombatEventHub
```

---

# 40. Monster Return

Group：

```text
no targetable participant
```

后：

```text
Returning
```

Monster：

```text
clear Target
release claim
motor.moveTo(guardWorldPosition)
```

---

# 41. Return 完成

到达：

```text
guardWorldPosition
```

后：

```text
GuardIdle
Idle animation
HP unchanged
```

---

# 42. Monster Death

```text
Health=0
↓
release target claim
target=null
motor.stop
animator.playDead
state=Dead
```

不复活。

---

# 43. MonsterGroupController

改成：

```ts
extends Component
```

挂在：

```text
MonsterGroup_slime_guard_gold_01
```

---

# 44. Group State

```ts
enum MonsterGroupState {
    Guarding = 0,
    Engaged = 1,
    Returning = 2,
    Defeated = 3,
}
```

---

# 45. Group Participant

```ts
enum GuardParticipantState {
    Active = 0,
    Retreating = 1,
}
```

保存：

```text
Squad participant
```

---

# 46. Group 不再持有战斗 Session

删除：

```text
encounter
encounterId
CombatEncounterState
```

---

# 47. Group Target Claim

维护两类 claim：

```text
Warrior → Monster
Monster → Warrior
```

只用于：

```text
Target load balancing
```

---

# 48. claim 不是 Position

明确注释：

```text
Target claim:
“我正在攻击谁”

NOT:
“我站在哪”
```

---

# 49. engageSquad()

```text
add/update participant
state = Engaged
activate alive monsters
```

---

# 50. markSquadRetreating()

只：

```text
state = Retreating
```

不立即删除。

---

# 51. Retreating 仍可被攻击

只要：

```text
SquadRoot
距离 Gold <= 6
```

该 Squad 的 Alive Warrior：

```text
仍然 targetable
```

---

# 52. 离开 leash

如果：

```text
distance > 6
```

：

```text
participant removed
```

所有：

```text
指向该 Squad Warrior
```

的 Monster claim：

```text
释放
```

---

# 53. Group Returning

如果：

```text
没有任何 targetable participant
```

：

```text
Engaged → Returning
```

所有 Alive Slime：

```text
returnToGuard
```

---

# 54. Returning → Guarding

全部 Alive Slime：

```text
GuardIdle
```

则：

```text
Returning → Guarding
```

---

# 55. Defeated

Alive Slime：

```text
0
```

：

```text
Defeated
```

通知所有 participant：

```text
onGuardDefeated()
```

---

# 56. MonsterRuntimeRegistry

最终只存：

```text
MonsterGroupController
```

删除 Member Adapter Map。

API：

```text
registerGroup
getById
getByGuardedObject
getAll
```

---

# 57. SquadCombatController

完全重写。

挂：

```text
Squad Node
```

---

# 58. SquadCombatState

```ts
enum SquadCombatState {
    Inactive = 0,
    Active = 1,
    Reforming = 2,
}
```

---

# 59. SquadCombatController setup

持有：

```text
squadId
SquadMotor
WarriorMotor[]
WarriorCombatController[]
```

---

# 60. beginGuardCombat()

```text
currentGroup = group
↓
group.engageSquad(participant)
↓
每个 Alive Warrior
enterGuardCombat(group)
↓
state=Active
```

---

# 61. requestRetreat()

```text
group.markSquadRetreating()
↓
所有 Warrior exitCombat()
↓
所有 Warrior returnToFormation()
↓
state=Reforming
```

---

# 62. Victory Reform

Group Defeated callback：

```text
guardDefeatedPending=true
```

SquadBrain 消费后：

```text
所有 Warrior exitCombat
↓
returnFormation
↓
Reforming
```

---

# 63. Reform 完成

所有 Alive Warrior：

```text
回 formation offset
```

：

```text
state=Inactive
currentGroup=null
```

---

# 64. SquadBrain State

最终：

```ts
enum SquadBrainState {
    HomeIdle = 0,
    Wander = 1,
    MoveToTarget = 2,

    GuardCombat = 3,

    ResourceEngage = 4,
    AttackResource = 5,

    Reform = 6,
    ReturnHome = 7,
}
```

---

# 65. 进入 Guard

MoveToTarget：

```text
tryActivateGuard()
```

条件：

```text
command target
=
guarded resource

distance <= 3
```

---

# 66. GuardCombat update

只等待：

```text
combat.consumeGuardDefeated()
```

玩家如果不发新命令：

```text
保持 GuardCombat
```

---

# 67. 玩家 Combat 中发新 Command

```text
pending new command
↓
beginReform
↓
combat.requestRetreat()
↓
Reform
↓
resume new command
```

---

# 68. Resource Interaction 完全独立

Guard 死后：

```text
Victory Reform
↓
重新执行 Gold Command
↓
MoveToTarget
↓
无 Guard
↓
ResourceEngage
↓
AttackResource
```

不从 Combat 直接跳资源攻击。

---

# 69. MainMapController

删除：

```text
CombatEncounterManager
encounterManager field
beginGuardEncounter()
update(dt) battle tick
squadCombatControllers map
```

---

# 70. MainMapController 只继续负责 Bootstrap

保留：

```text
CombatEventHub
MonsterRuntimeRegistry
Renderer
Resource services
```

---

# 71. SquadRenderer

Warrior Node 增加：

```text
WarriorCombatController
```

Squad Node 增加：

```text
SquadCombatController
```

Brain 直接注入：

```text
combat
monsterRegistry
```

---

# 72. MonsterGroupRenderer

Group Node：

```text
MonsterGroupController
```

Slime Node：

```text
MonsterCombatController
```

删除：

```text
MonsterCombatantAdapter
```

---

# 73. WarriorAnimator 改为多订阅

当前单：

```text
bindAttackImpactHandler
```

改：

```ts
subscribeAttackImpact(
    listener
): () => void
```

内部：

```text
Set
```

---

# 74. 为什么

Resource：

```text
SquadEngagementController
```

和 Combat：

```text
WarriorCombatController
```

都需要监听 Warrior Hit Frame。

不能覆盖。

---

# 75. SquadEngagementController

改为：

```text
subscribe
```

并保存 unsubscribe。

onDestroy：

```text
dispose
```

---

# 76. WarriorMotor 幂等 Target

Direct Approach 每帧会重新计算 desired point。

所以：

```text
moveToLocalGridOffset(newTarget)
```

如果：

```text
与旧 target 差 < 0.02
```

直接 return。

---

# 77. MonsterMotor 同样幂等

```text
moveTo(newTarget)
```

如果新旧 target：

```text
距离 < 0.02
```

：

```text
不重新发移动命令
```

---

# 78. 避免单位穿透的关键顺序

每个 Unit Update：

```text
1. Target validity

2. Actual distance

3. 如果已经 <= attackRange：
       stop
       attack
       return

4. 才计算 desired approach point

5. move
```

禁止：

```text
先 move
再检查 attack range
```

---

# 79. Approach point 退化情况

如果：

```text
self 与 target 几乎同点
len < 0.001
```

不要 normalize。

直接：

```text
motor.stop
attack
```

如果在 range 外却理论同点不可能。

---

# 80. Target Load Balancing 的释放

以下事件必须 release claim：

```text
Target dead
Attacker dead
Attacker exit combat
Squad detach leash
Group Defeated
Monster ReturnToGuard
```

---

# 81. 不再存在 Position cleanup

因为取消 Slot 后：

```text
没有 position reservation
```

所以退出战斗只需：

```text
clear target
stop motor
return formation / guard
```

---

# 82. 第一次交战流程

```text
玩家点击 Gold
↓
Squad Move
↓
<= 3
↓
Guard Engaged
↓
4 Warrior Acquire
↓
3 Slime Acquire
↓
双方 Direct Approach
↓
进入 0.85
↓
双方 Attack
```

---

# 83. 典型 4v3 Target 分配

可能：

```text
W0 → Slime0
W1 → Slime1
W2 → Slime2
W3 → Slime0

Slime0 → W0
Slime1 → W1
Slime2 → W2
```

这完全允许。

没有：

```text
Top
Left
Right
Bottom
```

---

# 84. 战斗视觉

因为起始位置：

```text
4 Warrior formation
```

本来分散。

Slime：

```text
3 个 guard offset
```

也分散。

再加：

```text
least-claimed target
```

自然会形成：

```text
多个局部接触点
```

而不是全员一个点。

---

# 85. 玩家撤退

```text
Combat
↓
点击 Wood
↓
Warrior exit
↓
return formation
↓
Squad Move to Wood
```

Slime：

```text
在 leash 内
仍追旧合法 Target
```

---

# 86. 离开 6 格

```text
participant detach
↓
Monster target invalid
↓
Group Returning
↓
Slime ReturnGuard
```

---

# 87. 再次攻击

没有 Encounter。

所以：

```text
再次 <= 3
↓
Group Engaged
↓
Unit Controllers 重新 Acquire
```

不会复用旧 Session。

---

# 88. Partial HP

Slime：

```text
HP 3/8
```

Return：

```text
仍 3/8
```

重新战斗：

```text
从 3/8 开始
```

---

# 89. Partial Death

Slime0 死：

```text
不复活
```

再回来：

```text
只有 Slime1/2 Acquire
```

---

# 90. Victory

最后一只死：

```text
Group Defeated
↓
Squad Victory Reform
↓
原 Gold Command
↓
重新接近
↓
Harvest
```

---

# 91. Multi Squad

Group participants：

```text
Squad A
Squad B
```

Unit Target Candidate：

```text
所有 participant 的 alive Warrior
```

不需要：

```text
Encounter Join
```

---

# 92. Motor Ownership

必须保持：

```text
Strategic:
SquadMotor owns SquadRoot

Resource:
SquadEngagementController owns WarriorMotor

GuardCombat:
WarriorCombatController owns WarriorMotor

Combat Exit:
SquadCombatController owns WarriorMotor returnFormation
```

---

# 93. Resource / Combat Mutual Exclusion

GuardCombat 开始：

```text
SquadEngagementController
必须 Inactive
```

ResourceEngage 开始：

```text
SquadCombatController
必须 Inactive
```

Prototype 中建议：

```text
违反直接 throw
```

---

# 94. 不允许同时控制 Motor

WarriorCombatController：

```text
state=Inactive
```

时：

```text
绝不发 moveTo
```

SquadEngagementController：

```text
Inactive
```

时：

```text
绝不发 moveTo
```

---

# 95. 日志

状态日志：

```text
[Guard]
Guarding -> Engaged

[WarriorCombat]
warrior_0 target=slime_gold_0

[MonsterCombat]
slime_gold_0 target=warrior_0

[WarriorCombat]
Approaching -> Attacking

[MonsterCombat]
Approaching -> Attacking
```

---

# 96. 不记录 Position

取消：

```text
[MeleeSlot]
[CombatPosition]
```

日志。

---

# 97. 开发顺序

```text
Step 1
删除 Encounter 依赖

Step 2
CombatUnitTypes / CombatMath

Step 3
WarriorAnimator 多订阅

Step 4
WarriorCombatController

Step 5
MonsterCombatController

Step 6
MonsterGroupController

Step 7
SquadCombatController

Step 8
SquadBrain 状态拆分

Step 9
Renderer wiring

Step 10
MainMap cleanup

Step 11
三次退出/重入回归测试
```

---

# 98. User Acceptance 1：接战

进入 Gold 3 格：

```text
Slime 激活
Warrior 激活
```

双方开始靠近。

---

# 99. User Acceptance 2：不会跑历史位置

Target 移动：

```text
追击者的 desired point
下一帧基于 Target 当前坐标重新计算
```

禁止：

```text
继续跑旧世界坐标
```

---

# 100. User Acceptance 3：不会持续重叠

单位实际距离：

```text
<= 0.85
```

即停止移动。

不能持续：

```text
moveTo target center
```

---

# 101. User Acceptance 4：4v3 分散

至少应看到：

```text
不同 Warrior
锁到不同 Slime
```

由：

```text
target claim load balancing
```

实现。

---

# 102. User Acceptance 5：双方攻击

Warrior：

```text
Attack Animation
→ Slime HP -
```

Slime：

```text
Attack Animation
→ Warrior HP -
```

---

# 103. User Acceptance 6：中途换目标

Combat 中点 Wood：

```text
Warrior stop combat
回 Formation
Squad 去 Wood
```

不卡住。

---

# 104. User Acceptance 7：Leash

离 Gold > 6：

```text
Slime 停止追击
Return Guard
```

---

# 105. User Acceptance 8：重新交互

再次点 Gold：

```text
重新正常接战
```

不能：

```text
旧状态卡死
```

---

# 106. User Acceptance 9：连续三次重入

必须测试：

```text
Engage
Retreat
Return

Engage
Retreat
Return

Engage
Retreat
Return
```

三次全部正常。

---

# 107. User Acceptance 10：Partial HP

撤退前：

```text
Slime1 3/8
```

Return 后：

```text
3/8
```

---

# 108. User Acceptance 11：Victory

全部 Slime 死后：

```text
Guard Defeated
Warrior Reform
自动继续 Gold
Harvest Gold
```

---

# 109. User Acceptance 12：路过不触发

当前 Command：

```text
Wood
```

经过 Gold：

```text
<= 3
```

Slime：

```text
仍 GuardIdle
```

---

# 110. User Acceptance 13：Second Squad

临时第二 Squad：

```text
加入同一 MonsterGroup
```

不创建：

```text
Encounter
```

---

# 111. Definition of Done

- [ ] CombatEncounter 删除
- [ ] CombatEncounterManager 删除
- [ ] CombatPositionResolver 删除
- [ ] CombatPositionReservation 删除
- [ ] CombatantTypes 删除
- [ ] WarriorCombatantAdapter 删除
- [ ] MonsterCombatantAdapter 删除
- [ ] 不新增 MeleeSlotRegistry
- [ ] 不存在 Top/Bottom/Left/Right 预约
- [ ] CombatUnitTypes
- [ ] CombatMath
- [ ] WarriorCombatController
- [ ] MonsterCombatController
- [ ] SquadCombatController 重写
- [ ] MonsterGroupController Component 化
- [ ] MonsterRuntimeRegistry 重写
- [ ] Target Claim Load Balancing
- [ ] Sticky Target
- [ ] Warrior Direct Approach
- [ ] Slime Direct Approach
- [ ] Approach Point 使用实时 Target Position
- [ ] Attack Range Hysteresis
- [ ] WarriorAnimator 多订阅
- [ ] Resource Interaction 无回归
- [ ] Retreat
- [ ] Leash=6
- [ ] ReturnToGuard
- [ ] HP Persistence
- [ ] Partial Death Persistence
- [ ] Returning 可重新 Engage
- [ ] Guard Defeated
- [ ] Victory 自动继续 Gold
- [ ] Multi Squad
- [ ] MainMap 无 Combat update
- [ ] 连续 3 次退出 / 重入
- [ ] Console 无 Error
- [ ] README 更新

---

# 112. Agent 最终回报

Agent 必须回报：

```text
1. Commit SHA

2. 删除文件

3. 新增文件

4. 修改文件

5. SquadBrain State

6. MonsterGroup State

7. WarriorCombat State

8. MonsterCombat State

9. Target Claim 数据结构

10. Direct Approach 计算实现

11. Warrior target 日志

12. Slime target 日志

13. 双方 Damage 日志

14. Combat 中切换目标日志

15. Leave Leash 日志

16. ReturnGuard 日志

17. 第二次 Re-engage 日志

18. 连续三次 Re-engage 验证

19. Partial HP 验证

20. Victory → Gold Harvest 验证

21. Console 无 Error
```

---

# 113. 本版最终原则

> **不需要 Combat Encounter。**

> **不需要 Combat Position。**

> **不需要 Slot Reservation。**

> **单位只需要知道：我现在打谁。**

每个单位：

```text
Acquire Target
↓
Direct Approach
↓
Attack
↓
Reacquire
```

Group：

```text
决定谁属于当前 Guard Combat
```

Squad：

```text
决定玩家的战略 Command
```

战斗位置：

```text
完全由双方当前实时坐标
自然产生
```

而不是人为预约。

---

# 114. 最重要的验收标准

本轮成功标准：

```text
4 Warrior vs 3 Slime

可以自然散开接敌
可以互相靠近
进入攻击距离后停住
双方都会攻击
不会跑历史坐标
不会因为退出再进入而卡死
```

并且：

```text
接战
→ 撤退
→ Slime 回防
→ 再接战
```

连续重复至少：

```text
3 次
```

全部稳定。
