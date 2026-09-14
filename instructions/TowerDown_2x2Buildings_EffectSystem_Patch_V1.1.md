# TowerDown 2×2 Buildings + Stackable Effect System Patch V1.1

> Repo: `saiqi1999/TowerDown`  
> Engine: Cocos Creator 3.8.8  
> Base: `main @ 679485a3870098b700775519d39323b2a3b785cc`  
> This revision supersedes V1.

---

# 1. Final decisions for this patch

本版不再保留上一版的两个待确认项，直接按以下规则实施：

```text
1. Blacksmith 是加算效果，允许多栋叠加。
2. 每栋 Blacksmith = 所有玩家 Warrior Attack Damage +1。
3. 不拆 Combat Attack / Harvest Power。
4. Warrior 对 Monster 与对 Resource 都读取同一个 getAttackDamage()。
5. 所有现有 Warrior / Monster 的 HP 与 Attack 基础值 ×4。
6. 所有 Resource 的 HP ×4。
7. Resource 当前没有 attack stat，因此不存在“Resource attack ×4”。
8. yieldPerDamage 保持 1。
9. 建筑成本继续保持约 20，不因资源节点 HP ×4 自动放大。
```

因此 Blacksmith 的最终伤害关系是：

```text
Warrior Base Attack = 4

0 Blacksmith → 4
1 Blacksmith → 5
2 Blacksmith → 6
3 Blacksmith → 7
...
```

Blacksmith 不是乘算区，而是 Flat Add 区。

未来其它研究 / 技能 / 文明效果可以进入乘算区：

```text
FinalAttack
=
(BaseAttack + Σ FlatAdd)
× Π Multipliers
```

当前 Patch 可以把 Multiply operation 的数据结构预留/实现好，
但本轮没有任何实际 Multiply Effect。

---

# 2. 全局基础数值 ×4

## 2.1 Warrior

修改：

```text
assets/scripts/squad/WarriorCombatConfig.ts
```

从：

```ts
export const SWORD_WARRIOR_MAX_HEALTH = 20;
export const SWORD_WARRIOR_ATTACK_DAMAGE = 1;
```

改为：

```ts
export const SWORD_WARRIOR_MAX_HEALTH = 80;
export const SWORD_WARRIOR_ATTACK_DAMAGE = 4;
```

攻击距离、preferred distance、移动、攻击动画速度不变。

---

## 2.2 Blue Slime

修改：

```text
assets/scripts/monster/MonsterConfig.ts
```

从：

```ts
maxHealth: 20,
attackDamage: 1,
```

改为：

```ts
maxHealth: 80,
attackDamage: 4,
```

其它参数全部不变：

```text
attackRangeCells
preferredCombatDistanceCells
moveSpeedCellsPerSecond
moveFrameDuration
attackFrameDuration
attackHitFrame
```

---

## 2.3 Resource

修改：

```text
assets/scripts/world/ResourceRuntimeConfig.ts
```

全部：

```ts
maxHealth: 20
```

改成：

```ts
maxHealth: 80
```

保留：

```ts
yieldPerDamage: 1
```

所以一个资源点现在总资源量：

```text
80 HP × 1 yield/damage = 80 resource
```

基础 Warrior：

```text
Attack 4
80 HP / 4 = 20 次命中
```

这与旧版：

```text
Attack 1
20 HP / 1 = 20 次命中
```

保持相同的基础采集攻击次数。

但 Blacksmith 同样会提升采集速度：

```text
1 Smith → damage 5 → ceil(80 / 5) = 16 hits
2 Smith → damage 6 → ceil(80 / 6) = 14 hits
```

这是本版明确接受的玩法结果。

`ResourceHarvestComponent` 继续按：

```ts
actualDamage * yieldPerDamage
```

结算，所以无论 Attack 多高，一个 80 HP 节点最终总产量仍为 80；
最后一击只按 `actualDamage` 结算，不会 over-yield。

---

# 3. Building costs

继续使用 V1 的 prototype costs：

| Building | Cost | Sum |
|---|---|---:|
| Storage | Wood 10 + Stone 10 | 20 |
| Lumberjack | Wood 15 + Food 5 | 20 |
| Barracks | Wood 10 + Food 10 | 20 |
| Blacksmith | Wood 5 + Stone 10 + Gold 5 | 20 |

注意本次数值放大后，地图资源总量变为：

```text
Wood 160
Stone 80
Food 80
Gold 80
```

所以当前成本会明显更便宜。

这是 Prototype 阶段可接受的有意结果：
本轮优先验证 Building placement / Effect / Build 组合，不同步做经济平衡。

后续真正做经济曲线时再统一调：

```text
resource node amount
building costs
floor resource density
risk / guarded resource premium
```

不要为了这次 ×4 临时把每栋成本也 ×4。

---

# 4. Blacksmith stacking rule

Blacksmith Effect：

```ts
id: 'blacksmith_all_player_attack_plus_1'
stat: CombatStatId.AttackDamage
operation: StatModifierOperation.AddFlat
value: 1
stacking: BuildingEffectStacking.PerBuilding
```

每个 Building Instance 产生一个独立 modifier source：

```text
building:building_blacksmith_house_01_1:blacksmith_all_player_attack_plus_1
building:building_blacksmith_house_01_2:blacksmith_all_player_attack_plus_1
building:building_blacksmith_house_01_3:blacksmith_all_player_attack_plus_1
```

因此：

```text
每多一栋 → Σ FlatAdd +1
```

不要把所有 Blacksmith 压成一个 Boolean presence。

---

# 5. CombatStatModifierRegistry

新增：

```text
assets/scripts/combat/CombatStatModifierRegistry.ts
```

建议：

```ts
export enum CombatStatId {
    AttackDamage = 'attackDamage',
}

export enum StatModifierOperation {
    AddFlat = 'addFlat',
    Multiply = 'multiply',
}

export interface CombatStatModifier {
    readonly sourceId: string;
    readonly stat: CombatStatId;
    readonly operation: StatModifierOperation;
    readonly value: number;
}
```

API：

```ts
export class CombatStatModifierRegistry {
    public set(modifier: CombatStatModifier): void;
    public removeSource(sourceId: string): void;
    public resolve(stat: CombatStatId, baseValue: number): number;
}
```

resolve：

```ts
const flatAdd = ...;
const multipliers = ...;

return (baseValue + flatAdd) * multipliers;
```

其中：

```text
AddFlat:
Σ value

Multiply:
Π value
```

例如未来：

```text
Base = 4
3 Blacksmith = +3
Research multiplier = ×1.5

Final = (4 + 3) × 1.5 = 10.5
```

当前本轮没有 Multiply source，所以不会出现小数取整问题。

第一次真正加入乘算效果时，再统一决定 Damage rounding policy，
不要本轮提前用 floor/round 锁死规则。

---

# 6. CombatStats 只保存 Base，不缓存 Final

当前 `CombatStats`：

```text
attackDamage
attackRange
preferredDistance
```

改成语义明确的：

```text
baseAttackDamage
attackRange
preferredDistance
modifierRegistry reference
```

为了减少调用方改动，setup 参数仍可保持：

```ts
attackDamage: number;
```

内部将它保存为：

```ts
private baseAttackDamage = 1;
```

新增可选依赖：

```ts
modifierRegistry?: CombatStatModifierRegistry;
```

核心 getter：

```ts
public getAttackDamage(): number {
    if (!this.modifierRegistry) {
        return this.baseAttackDamage;
    }

    return this.modifierRegistry.resolve(
        CombatStatId.AttackDamage,
        this.baseAttackDamage,
    );
}
```

关键规则：

```text
getAttackDamage() 每次 impact 时计算 Effective Stat。
```

不要在 Blacksmith 落地时：

```text
warrior.attackDamage += 1
```

也不要在 Warrior spawn 时把当前 modifier 烘焙到 base stat。

---

# 7. Player-only modifier scope

在 `MainMapController` composition root 创建：

```ts
const playerCombatModifiers =
    new CombatStatModifierRegistry();
```

只注入：

```text
SquadRenderer
→ Warrior CombatStats
```

不注入：

```text
MonsterGroupRenderer
→ Monster CombatStats
```

因此：

```text
Warrior:
base 4 + Blacksmith modifiers

Monster:
base 4 only
```

以后敌人如果也需要 modifier，创建独立：

```text
enemyCombatModifiers
```

不要让 player / monster 共用一个全局 Registry。

---

# 8. BuildingEffectSystem

保留 V1 架构，但 Blacksmith 改为 PerBuilding。

```text
BuildingRuntimeRegistry
        ↓ lifecycle
BuildingEffectSystem
        ↓
CombatStatModifierRegistry
```

BuildingEffectSystem 内维护：

```ts
private readonly activeSourceIds = new Set<string>();
```

每次 Registry 变化：

```text
1. remove 本系统上次写入的所有 activeSourceIds
2. activeSourceIds.clear()
3. scan registry.getAll()
4. resolve definition.effectIds
5. 每个 Building Instance 建立自己的 sourceId
6. modifierRegistry.set(...)
7. activeSourceIds.add(...)
```

不要：

```text
modifierRegistry.clear()
```

因为未来 Research / Skill 也会写同一个 Registry。

---

# 9. Registry observer 与 placement transaction safety

当前 PlacementService 是：

```text
renderer.create
registry.add
registered = true
return success
```

一旦 `registry.add()` 开始触发 subscriber，
如果 subscriber 抛异常而 `registered` 还没变 true，
rollback 会漏掉已经进入 Registry 的 entry。

因此本 Patch 必须同时修：

```ts
registered = true;
this.registry.add(instance, node);
```

即 flag 在调用前设为 true。

如果 `add()` 在真正插入前因为 duplicate 抛错：

```text
catch → registry.remove(instance.id)
```

只是安全 no-op。

此外：

```text
BuildingEffectCatalog references
```

在 bootstrap 阶段预验证，保证 runtime effect listener 不因为未知 effectId 抛异常。

这条不要省略。

---

# 10. Attack event chain — Warrior → Monster

这是本 Patch 最重要的运行时数据链。

假设：

```text
Warrior Base Attack = 4
场上 Blacksmith = 2
因此 Effective Attack = 6
Monster HP = 80
```

完整链路：

```text
MainMapController
│
├ creates playerCombatModifiers
│
├ BuildingEffectSystem
│     └ Blacksmith A → AddFlat +1
│     └ Blacksmith B → AddFlat +1
│
└ SquadRenderer
      └ Warrior Node
           ├ CombatStats(baseAttack=4, playerCombatModifiers)
           ├ WarriorAnimator
           ├ WarriorCombatController
           └ WarriorAttackReceiver
```

## Step A — Warrior 进入 Attack 状态

文件：

```text
WarriorCombatController.ts
```

其 update：

```text
target alive?
↓
distance <= attackRange?
↓
motor.stop()
↓
state = Attacking
↓
animator.playAttack(direction)
```

这里不计算 damage。

原因：
进入攻击状态 ≠ 真正的命中时刻。

---

## Step B — Animator 产生“命中边沿”

文件：

```text
WarriorAnimator.ts
```

Attack 动画在：

```text
normal pose
→ attack pose
```

边沿时：

```ts
for (const listener of this.attackImpactListeners) {
    listener();
}
```

Animator 只负责告诉外界：

```text
“现在到了命中帧”
```

它不知道：

```text
attackerId
targetId
damage
CombatStats
Blacksmith
```

这是正确的职责分离。

---

## Step C — WarriorCombatController.onImpact()

在 setup 时：

```ts
this.animator.subscribeAttackImpact(
    () => this.onImpact(),
);
```

所以动画命中边沿进入：

```text
WarriorCombatController.onImpact()
```

它先重新确认：

```text
state === Attacking
target exists
target still in range
```

然后才读取：

```ts
const damage = this.stats.getAttackDamage();
```

---

# 11. CombatStats 如何拿到正确 Modifier

这是最关键的一层。

Warrior 的 `CombatStats` 不保存：

```text
finalAttack = 6
```

它只保存：

```text
baseAttack = 4
modifierRegistry reference
```

此刻：

```ts
getAttackDamage()
```

进入：

```text
CombatStatModifierRegistry.resolve(
    AttackDamage,
    4,
)
```

Registry 当前已有：

```text
Blacksmith A → AddFlat +1
Blacksmith B → AddFlat +1
```

因此：

```text
flatAdd = 1 + 1 = 2
multiplier = 1

effective = (4 + 2) × 1
          = 6
```

于是 `getAttackDamage()` 返回：

```text
6
```

注意计算发生在：

```text
真正攻击命中时
```

而不是：

```text
单位生成时
建筑建造时
进入战斗时
```

所以如果 Warrior 正在连续攻击：

```text
第 1 刀：4
↓
玩家造 Blacksmith
↓
第 2 刀：5
↓
玩家再造 Blacksmith
↓
第 3 刀：6
```

无需重建 Warrior，也无需把 Buff 推送到每个 Warrior。

---

# 12. AttackImpactSignal

`WarriorCombatController.onImpact()` 获得最终 damage 后：

```ts
this.hub.emitAttackImpact({
    attackerId: this.id,
    targetId: this.target.id,
    damage,
});
```

此刻创建的 signal：

```text
attackerId
targetId
damage = 已完成 attacker-side stat resolution 的最终值
```

`CombatEventHub` 不再重新算 CombatStats。

---

# 13. CombatEventHub

文件：

```text
CombatEventHub.ts
```

职责只有：

```text
targetId
→ 找到对应 AttackImpactReceiver
→ receiver.onAttackImpact(signal)
```

Hub 不知道：

```text
Blacksmith
Warrior
Monster
Health
Defense
Resource
```

不要把任何 modifier 计算放进 Hub。

原因：
Modifier 属于攻击者属性解析；
Hub 只是攻击事件路由。

---

# 14. MonsterAttackReceiver

目标 Monster 在创建时：

```text
MonsterAttackReceiver
→ hub.registerReceiver(monsterId, this)
```

收到：

```text
damage = 6
```

执行：

```ts
health.takeDamage(6);
```

它负责：

```text
Health mutation
HitFlash
Damage popup
AttackImpactResult
```

它不再次读取 attacker CombatStats。

因此一次 Attack 的伤害数值在发出 Signal 后就是确定的。

---

# 15. HealthComponent

`HealthComponent.takeDamage(6)`：

```text
before = 80
requested = 6
after = 74
actualDamage = 6
becameDepleted = false
```

然后同步通知 health subscribers。

MonsterCombatController 已经订阅自己的 Health：

```text
if becameDepleted
→ die()
```

所以：

```text
Stat resolution
→ Attack Signal
→ Receiver
→ Health mutation
→ Death reaction
```

形成完整单向链路。

---

# 16. Warrior → Monster 完整序列图

```text
BuildingRuntimeRegistry
        │
        │ building added/removed
        ▼
BuildingEffectSystem
        │
        ▼
PlayerCombatModifierRegistry
  [smith A +1]
  [smith B +1]
        │
        │ referenced by
        ▼
CombatStats
  baseAttack = 4
        ▲
        │ getAttackDamage()
        │
WarriorCombatController
        ▲
        │ onImpact()
        │
WarriorAnimator
        │ attack-pose edge
        ▼
WarriorCombatController
        │
        │ damage = (4 + 1 + 1) = 6
        ▼
CombatEventHub.emitAttackImpact
        │
        │ route by targetId
        ▼
MonsterAttackReceiver
        │
        ▼
HealthComponent.takeDamage(6)
        │
        ├─ HealthBar / flash / popup
        │
        └─ becameDepleted?
              ▼
        MonsterCombatController.die()
```

---

# 17. Monster → Warrior chain

完全对称：

```text
MonsterAnimator
→ MonsterCombatController.onImpact()
→ Monster CombatStats.getAttackDamage()
→ CombatEventHub
→ WarriorAttackReceiver
→ Warrior HealthComponent
→ Warrior death handling
```

区别只有 Modifier scope：

```text
Monster CombatStats:
base attack = 4
modifierRegistry = null

effective = 4
```

Blacksmith 不会影响 Monster。

---

# 18. Warrior → Resource chain

因为本版明确“不拆 Harvest / Attack”：

```text
WarriorAnimator
→ SquadEngagementController.onWarriorAttackImpact()
→ warriorCombatStats[index].getAttackDamage()
→ CombatEventHub
→ WorldObjectAttackReceiver
→ Resource HealthComponent.takeDamage()
```

因此 2 座 Smith 时：

```text
Warrior Attack = 6
Resource HP = 80
```

一次命中：

```text
80 → 74
actualDamage = 6
```

而：

```text
ResourceHarvestComponent
```

订阅 Resource Health，收到：

```text
actualDamage = 6
```

然后：

```ts
inventory.add(
    resourceType,
    actualDamage * yieldPerDamage,
);
```

yieldPerDamage = 1：

```text
+6 resource
```

最后一下如果只剩 2 HP：

```text
requestedDamage = 6
actualDamage = 2
yield = 2
```

所以节点总产量仍严格为 80。

这就是保持一个 Attack Stat 后的统一语义：

```text
Attack Damage
= 对敌伤害
= 对资源的采集破坏力
```

不增加第二套 HarvestPower。

---

# 19. Why modifier resolution belongs in CombatStats

不要把 Blacksmith 查询放在：

```text
WarriorCombatController
SquadEngagementController
CombatEventHub
MonsterAttackReceiver
```

唯一正确入口：

```text
CombatStats.getAttackDamage()
```

因此所有会造成“普通攻击伤害”的路径：

```text
Warrior → Monster
Warrior → Resource
```

都会自动拿到同一个 effective stat。

调用方只知道：

```text
“我要当前 Attack Damage”
```

而不知道这个数字来自：

```text
Base
Blacksmith
Research
Skill
Civilization
future multiplier
```

这就是后续扩展时最有价值的边界。

---

# 20. Building visual / 2×2 rules

沿用 V1：

```text
4 个新 Building visual：80×80
logical footprint：2×2 cells = 64×64
visual scale：1
```

不要：

```text
80×80 × GRID_RENDER_SCALE(2)
```

Card / Ghost / Placed Building 共享同一个 BuildingVisualLibrary SpriteFrame。

Ghost 附带：

```text
64×64 footprint overlay
```

来显示真实占格。

四张新图的 texture filter：

```text
Nearest
Nearest
Mip None
Clamp
```

---

# 21. Catalog definitions

替换旧：

```text
storage_pot_01
supply_sack_01
ritual_tent_01
kiln_01
```

为：

```text
storage_house_01
lumberjack_house_01
barracks_01
blacksmith_house_01
```

Blacksmith：

```ts
{
    id: 'blacksmith_house_01',
    displayName: 'Blacksmith',
    footprintW: 2,
    footprintH: 2,
    cost: {
        [ResourceType.Wood]: 5,
        [ResourceType.Stone]: 10,
        [ResourceType.Gold]: 5,
    },
    effectIds: [
        'blacksmith_all_player_attack_plus_1',
    ],
    shortEffectText: '+1 ATK',
}
```

---

# 22. Files to add

```text
assets/scripts/building/BuildingVisualLibrary.ts

assets/scripts/building/effects/BuildingEffectTypes.ts
assets/scripts/building/effects/BuildingEffectCatalog.ts
assets/scripts/building/effects/BuildingEffectSystem.ts

assets/scripts/combat/CombatStatModifierRegistry.ts
```

---

# 23. Files to modify

```text
assets/scripts/building/BuildingTypes.ts
assets/scripts/building/BuildingCatalog.ts
assets/scripts/building/BuildingRenderer.ts
assets/scripts/building/BuildingGhostView.ts
assets/scripts/building/BuildingRuntimeRegistry.ts
assets/scripts/building/BuildingPlacementService.ts
assets/scripts/building/BuildCardStripController.ts
assets/scripts/building/BuildingBlueprintCardView.ts

assets/scripts/combat/CombatStats.ts

assets/scripts/squad/WarriorCombatConfig.ts
assets/scripts/squad/SquadRenderer.ts

assets/scripts/monster/MonsterConfig.ts

assets/scripts/world/ResourceRuntimeConfig.ts

assets/scripts/map/MainMapController.ts
```

不需要为了本版修改：

```text
WarriorCombatController.ts 的事件职责
MonsterCombatController.ts 的事件职责
CombatEventHub.ts 的职责
HealthComponent.ts 的职责
ResourceHarvestComponent.ts 的公式
```

这些文件最多只做 header/comment / getter naming compatibility 的必要调整。

---

# 24. Agent must do

Agent 负责：

```text
1. 新建筑 visual / catalog / 2×2 footprint 接入。
2. 调整 texture filter 为 nearest。
3. 基础 Warrior HP 20→80，Attack 1→4。
4. BlueSlime HP 20→80，Attack 1→4。
5. 所有 Resource HP 20→80，yieldPerDamage 仍 1。
6. 实现 CombatStatModifierRegistry。
7. 实现 AddFlat + Multiply 两个 bucket。
8. CombatStats 每次 getter 动态 resolve effective Attack。
9. 创建 player-only modifier registry。
10. Blacksmith 每 instance 注册 AddFlat +1。
11. Building Effect lifecycle 随 Registry add/remove 自动 rebuild。
12. 修 PlacementService registered flag / observer transaction 边界。
13. Blacksmith 卡片显示 +1 ATK。
14. 开发 bootstrap 解锁新的 4 个 blueprint。
15. 完成下面全部 regression tests。
```

---

# 25. User needs to do

原则上不要求额外手工 Scene wiring。

用户只需要：

```text
1. 打开 Cocos Creator，确认四张新建筑图片被正常 import。
2. 如果 Agent 修改 .meta 后 Editor 自动重写，确认 Filter 最终仍是 Nearest。
3. 运行场景进行视觉验收。
```

不要求用户手工：

```text
挂 BuildingEffectSystem Component
拖 Blacksmith 引用
给每个 Warrior 绑定 Buff
创建额外 Scene Node
```

Effect System 继续由 MainMapController composition root runtime 装配。

---

# 26. Mandatory tests

## Stat scale

```text
Warrior HP = 80
Warrior base Attack = 4

BlueSlime HP = 80
BlueSlime Attack = 4

Wood/Stone/Food/Gold HP = 80
yieldPerDamage = 1
```

## Blacksmith stacking

```text
0 Smith → Warrior Attack 4
1 Smith → 5
2 Smith → 6
3 Smith → 7
```

## Dynamic resolution

```text
Warrior 已生成
↓
造 Smith
↓
不重建 Warrior
↓
下一刀立刻 +1
```

拆 Smith：

```text
7 → 6 → 5 → 4
```

必须立即跟随当前场上实例数。

## Scope

```text
Smith 只修改 player Warrior。
Monster Attack 永远不因 Smith 改变。
```

## Resource

```text
0 Smith：
80 HP，4 damage/hit → 20 hits → total yield 80

1 Smith：
80 HP，5 damage/hit → 16 hits → total yield 80

2 Smith：
80 HP，6 damage/hit → 14 hits → total yield 80
最后 hit 只结 actualDamage。
```

## Attack chain

Debug/temporary test 可断言：

```text
baseAttack = 4
flatModifierTotal = N
resolvedDamage = 4 + N
signal.damage = resolvedDamage
receiver requestedDamage = signal.damage
healthBefore - healthAfter = actualDamage
```

最终不要保留每帧 spam log。

---

# 27. Mandatory TS headers

所有新增 TS 均写：

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

其中 `CombatStatModifierRegistry.ts`：

```ts
/**
 * Why this file exists:
 * 玩家单位的 Base Attack 需要与来自建筑、研究等来源的运行时 Modifier 分离，
 * 并在真正发生攻击时解析出当前 Effective Attack。
 *
 * Ownership boundary:
 * 本文件拥有 source-keyed stat modifiers 及 AddFlat / Multiply bucket 的聚合。
 *
 * This file deliberately does NOT:
 * 不知道 Warrior、Blacksmith、Building Instance、攻击目标或 Health。
 */
```

---

# 28. Explicitly forbidden

```text
1. Blacksmith 使用 presence bool，导致多栋不叠加。
2. 建造 Smith 时遍历当前 Warrior 做 attackDamage += 1。
3. CombatStats 缓存 final attack，导致之后建筑变化不同步。
4. Monster 使用 playerCombatModifiers。
5. CombatEventHub 计算 Blacksmith / stat modifier。
6. Receiver 再重新读取 attacker stat。
7. SquadEngagement 使用单独 HarvestPower。
8. Resource yieldPerDamage 改成 0.25 来抵消 HP ×4。
9. 用 sprite visual 80×80 当成 logical footprint。
10. EffectSystem rebuild 时 clear 整个 modifier registry。
11. subscriber 异常导致 Placement Registry rollback 漏清。
```

---

# 29. Completion definition

本 Patch 完成后，数值链必须满足：

```text
Static Base Config
      +
Runtime Modifier Sources
      ↓
CombatStats.getAttackDamage()
      ↓
Attack controller at impact frame
      ↓
AttackImpactSignal.damage
      ↓
CombatEventHub route
      ↓
Target Receiver
      ↓
HealthComponent
      ↓
death / harvest / visual feedback
```

Blacksmith 只是 Modifier 的第一个生产者：

```text
Blacksmith instance
→ AddFlat Attack +1
```

以后可以自然增加：

```text
Research
→ Multiply Attack ×1.25

Civilization trait
→ AddFlat Attack +2

Temporary skill
→ Multiply Attack ×1.5
```

而攻击链路本身完全不用修改。
