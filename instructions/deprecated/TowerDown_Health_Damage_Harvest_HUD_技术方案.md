# TowerDown：生命、伤害、资源采集、血条与伤害飘字技术方案
## Health / Damage / Harvest / Resource HUD / HealthBar / Damage Popup

> 适用仓库：`saiqi1999/TowerDown`  
> Cocos Creator：3.8.8  
> 前置能力：Interaction Slot、AttackImpact、CombatEventHub、HitFlash 已完成  
>
> 本轮目标：
>
> ```text
> Warrior Attack Pose
> ↓
> AttackImpact(damage)
> ↓
> Resource 扣血
> ↓
> 产生实际伤害
> ├── 更新血条
> ├── 闪白
> ├── 伤害飘字
> └── 按实际伤害获得资源
>       ↓
> ResourceInventory
>       ↓
> 屏幕顶部：
> 木材 X    石材 X    食物 X
> ```
>
> 同时给当前 Warrior 装配：
>
> ```text
> HealthComponent
> CombatStats
> HealthBar
> AttackReceiver
> ```
>
> Warrior 当前暂时不会被怪物攻击，但这套能力应直接成为后续 Warrior vs Monster 战斗基础。

---

# 1. 本轮最终效果

## 1.1 Resource

点击资源并开始攻击后：

```text
Warrior 挥刀
↓
Attack Pose 出现
↓
Resource 闪白
↓
Resource HP 减少
↓
Resource 上方血条缩短
↓
出现 -1 / -N 伤害飘字
↓
木材 / 石材 / 食物立即增加
```

资源 HP 降到 0：

```text
逻辑上立即 Depleted
↓
不再获得资源
↓
不再继续承受有效伤害
↓
禁用点击并从 Runtime Registry 移除
↓
当前 Squad 停止攻击
↓
Reform
↓
ReturnHome
↓
短暂保留最后一次受击反馈
↓
删除 Resource Node
+
释放该 Resource 的 Navigation footprint
```

本轮把 **Resource Node 删除 + Navigation 占地释放** 作为同一个生命周期事务完成，避免“画面已经没资源但格子仍不可走”或“格子已经可走但资源仍存在”的状态不一致。

---

## 1.2 Warrior

每个 Warrior 头顶显示友方血条。

当前：

```text
Warrior HP = Max HP
```

因为还没有 Monster 攻击。

但 Warrior 已经具备：

```text
HealthComponent
CombatStats
WarriorAttackReceiver
HitFlashView
HealthBarView
DamagePopup
```

后续 Monster AttackImpact 可以直接命中 Warrior，无需重新搭生命/反馈系统。

---

## 1.3 Resource HUD

屏幕顶部固定显示一行：

```text
木材 0    石材 0    食物 0
```

例如砍树产生 3 木材：

```text
木材 3    石材 0    食物 0
```

HUD 是 Inventory 的 View，不允许自己保存资源数据。

---

# 2. 本轮架构总览

```text
ATTACKER
WarriorAnimator
↓
Attack Pose Entered
↓
SquadEngagementController
↓
CombatStats.attackDamage
↓
AttackImpactSignal
{
    attackerId,
    targetId,
    damage
}
↓
CombatEventHub
↓
TARGET RECEIVER
WorldObjectAttackReceiver
↓
HealthComponent.takeDamage()
↓
DamageResult
├── HitFlashView
├── DamagePopupSpawner
├── HealthBarView（监听 Health）
└── ResourceHarvestComponent
        ↓
    ResourceInventory
        ↓
    ResourceHudView
```

未来 Monster：

```text
Monster attack
↓
AttackImpactSignal
↓
CombatEventHub
↓
WarriorAttackReceiver
↓
HealthComponent
├── HealthBar
├── HitFlash
└── DamagePopup
```

---

# 3. 核心职责边界

必须保持：

```text
HealthComponent
= 只管理生命值

CombatStats
= 攻击者战斗数值

AttackImpact
= 一次攻击命中的输入

AttackReceiver
= 把 AttackImpact 应用到目标

ResourceHarvestComponent
= 实际伤害 → 资源收益

ResourceInventory
= 全局资源真实数据

ResourceHudView
= 只显示 Inventory

HealthBarView
= 只显示 Health

DamagePopup
= 只显示一次 DamageResult

HitFlashView
= 只显示闪白
```

禁止把这些职责重新揉进：

```text
WarriorAnimator
SquadBrain
CombatEventHub
MainMapController
```

---

# 4. 本轮默认数值

为了让 Agent 可以直接实现，第一版统一使用测试值：

```text
Sword Warrior:
Max HP       = 20
Attack Damage = 1

Wood Resource:
Max HP        = 20
Yield/Damage  = 1

Stone Resource:
Max HP        = 20
Yield/Damage  = 1

Food Resource:
Max HP        = 20
Yield/Damage  = 1
```

即：

```text
造成 1 点实际伤害
=
获得 1 点对应资源
```

这些只是 Prototype 数值，必须集中在 Config 中，禁止散落硬编码。

---

# 5. 用户需要做的事情

本轮用户只负责 **素材导入、Inspector 绑定和运行验收**。

所有代码、运行时 Node、组件装配由 Agent 完成。

---

## 5.1 保存两张血条素材

用户提供的素材均为：

```text
18 × 4 px
RGBA
```

其中：

```text
红色：
RGB ≈ (224, 57, 76)

灰绿色：
RGB ≈ (95, 113, 96)

边框：
RGB ≈ (20, 27, 27)
```

建议保存到：

```text
assets/art/ui/health/
├── health_bar_hostile.png
└── health_bar_friendly.png
```

对应：

```text
红色     → health_bar_hostile.png
灰绿色   → health_bar_friendly.png
```

当前语义：

```text
Resource / Enemy
→ 红色

Warrior / Friendly
→ 灰绿色
```

---

## 5.2 Cocos Texture 导入设置

两张图都使用像素风配置：

```text
Filter:
Nearest / Point

Wrap:
Clamp

Mipmaps:
关闭（如当前导入面板提供该项）
```

目标是：

```text
18×4 原始像素
× GRID_RENDER_SCALE 2
=
36×8 屏幕像素
```

不要使用 Bilinear。

---

## 5.3 Inspector 绑定

Agent 会在：

```text
MapRoot
└── MainMapController
```

新增两个字段：

```text
Friendly Health Bar Texture
Resource Health Bar Texture
```

用户拖入：

```text
health_bar_friendly.png
→ Friendly Health Bar Texture

health_bar_hostile.png
→ Resource Health Bar Texture
```

已有：

```text
Hit Flash Material
```

保持原绑定不变。

---

## 5.4 保存 Scene

保存：

```text
assets/Main.scene
```

---

## 5.5 用户最终验收

依次测试：

```text
wood_01
stone_01
food_01
```

再测试：

```text
4 Warrior 同时攻击
Resource HP = 0
切换目标
取消返家
```

验收现象见本文末尾测试清单。

---

# 6. Agent 需要完成的事情

Agent 完成全部代码实现。

建议新增目录：

```text
assets/scripts/economy/
assets/scripts/ui/
```

新增文件：

```text
assets/scripts/combat/
├── HealthComponent.ts
├── CombatStats.ts
└── （修改）CombatTypes.ts

assets/scripts/economy/
└── ResourceInventory.ts

assets/scripts/world/
├── ResourceRuntimeConfig.ts
├── ResourceHarvestComponent.ts
├── WorldObjectRuntimeRegistry.ts
├── WorldObjectLifecycleController.ts
└── （修改）WorldObjectAttackReceiver.ts

assets/scripts/squad/
└── WarriorAttackReceiver.ts

assets/scripts/feedback/
├── HealthBarSpriteConfig.ts
├── HealthBarView.ts
├── DamagePopupView.ts
└── DamagePopupSpawner.ts

assets/scripts/ui/
└── ResourceHudView.ts
```

需要修改：

```text
assets/scripts/combat/
└── CombatEventHub.ts

assets/scripts/map/
└── MainMapController.ts

assets/scripts/navigation/
└── NavigationGrid.ts

assets/scripts/world/
├── WorldObjectRenderer.ts
└── WorldObjectView.ts

assets/scripts/command/
└── WorldCommandController.ts

assets/scripts/squad/
├── SquadRenderer.ts
├── SquadBrain.ts
└── SquadEngagementController.ts
```

必要时修改：

```text
assets/scripts/squad/SquadTypes.ts
```

---

# 7. CombatTypes 扩展

当前：

```ts
export interface AttackImpactSignal {
    attackerId: string;
    targetId: string;
}
```

改为：

```ts
export interface AttackImpactSignal {
    attackerId: string;
    targetId: string;
    damage: number;
}
```

---

# 8. DamageResult

新增：

```ts
export interface DamageResult {
    requestedDamage: number;
    actualDamage: number;

    healthBefore: number;
    healthAfter: number;

    becameDepleted: boolean;
}
```

语义：

```text
requestedDamage
= 攻击者请求造成多少伤害

actualDamage
= 目标真正损失多少 HP
```

例如：

```text
HP = 2
requestedDamage = 10

actualDamage = 2
healthAfter = 0
becameDepleted = true
```

资源收益必须使用：

```text
actualDamage
```

禁止使用：

```text
requestedDamage
```

---

# 9. AttackImpactResult

Receiver 应把应用结果返回给攻击侧。

定义：

```ts
export interface AttackImpactResult {
    targetId: string;

    damageResult: DamageResult;

    targetDepleted: boolean;
}
```

---

# 10. AttackImpactReceiver 修改

当前：

```ts
onAttackImpact(
    signal: AttackImpactSignal
): void;
```

改为：

```ts
onAttackImpact(
    signal: AttackImpactSignal
): AttackImpactResult;
```

这样：

```text
Engagement
→ emitAttackImpact
→ Receiver
→ Health
→ Result
→ Engagement
```

形成闭环。

---

# 11. CombatEventHub 修改

当前：

```ts
emitAttackImpact(signal): void
```

改为：

```ts
public emitAttackImpact(
    signal: AttackImpactSignal,
): AttackImpactResult | null
```

路由规则保持：

```text
targetId
→ Receiver
```

如果 Receiver 不存在：

```text
console.warn
return null
```

不要 throw。

---

# 12. HealthComponent

新增：

```text
assets/scripts/combat/HealthComponent.ts
```

定义为通用 Cocos Component。

---

# 13. HealthComponent 数据

内部：

```ts
private maxHealth = 1;
private currentHealth = 1;
```

API：

```ts
setup(maxHealth: number): void

getMaxHealth(): number

getCurrentHealth(): number

getHealthRatio(): number

isDepleted(): boolean

takeDamage(amount: number): DamageResult

heal(amount: number): number
```

---

# 14. HealthComponent 约束

`setup()`：

```text
maxHealth 必须 > 0
currentHealth = maxHealth
```

`takeDamage()`：

```text
damage <= 0
→ actualDamage = 0

already depleted
→ actualDamage = 0

否则：
healthBefore
↓
max(0, healthBefore - damage)
↓
actualDamage = before - after
```

Health 不知道：

```text
ResourceType
attackerId
damage popup
hit flash
inventory
```

---

# 15. Health Listener

HealthBar 和 ResourceHarvest 都需要监听变化。

推荐 HealthComponent 内部维护：

```ts
type HealthChangedListener =
    (
        current: number,
        max: number,
        result: DamageResult | null,
    ) => void;
```

API：

```ts
subscribe(
    listener: HealthChangedListener
): () => void
```

返回 unsubscribe 函数。

例如：

```ts
const unsubscribe =
    health.subscribe(...);
```

组件销毁时调用 unsubscribe。

不要只设计一个：

```text
bindHealthChangedHandler()
```

因为：

```text
HealthBar
ResourceHarvest
未来 DeathView
未来 Audio
```

都可能同时订阅。

---

# 16. CombatStats

新增：

```text
assets/scripts/combat/CombatStats.ts
```

第一版只保存：

```ts
export interface CombatStatsConfig {
    attackDamage: number;
}
```

Component：

```ts
@ccclass('CombatStats')
export class CombatStats extends Component {
    private attackDamage = 1;

    setup(config): void

    getAttackDamage(): number
}
```

以后可以扩展：

```text
attackRange
armor
attackSpeed
crit
element
```

当前不要提前实现。

---

# 17. Warrior 默认 Combat Stats

集中常量：

```ts
export const SWORD_WARRIOR_MAX_HEALTH = 20;
export const SWORD_WARRIOR_ATTACK_DAMAGE = 1;
```

建议放：

```text
WarriorCombatConfig.ts
```

或现有 Squad Config 域。

禁止写在：

```text
WarriorAnimator
SquadEngagementController
```

内部魔法数字。

---

# 18. SquadEngagementController 攻击信号修改

当前：

```ts
emitAttackImpact({
    attackerId,
    targetId,
});
```

改为：

```ts
emitAttackImpact({
    attackerId,
    targetId,
    damage:
        warriorCombatStats[index]
            .getAttackDamage(),
});
```

因此 setup 增加：

```ts
warriorCombatStats:
    CombatStats[];
```

---

# 19. target depleted 处理

`onWarriorAttackImpact()`：

```text
emit
↓
AttackImpactResult
```

如果：

```text
result.targetDepleted === true
```

则：

```text
1. currentTarget = null
2. 设置 targetDepletedPending = true
```

立刻清 `currentTarget` 的原因：

```text
防止同一帧其他 Warrior 的攻击 Pose
继续产生有效命中
```

目标 Health 已经是 0，本来也不会产生 actualDamage，但这里仍应主动阻断旧攻击链。

---

# 20. Engagement 新 API

增加：

```ts
public consumeTargetDepleted(): boolean
```

内部：

```text
true
↓
消费一次
↓
false
```

不要让 Engagement 直接调用 SquadBrain。

---

# 21. SquadBrain 对 depleted 的处理

在：

```text
AttackResource
```

状态增加：

```ts
if (
    this.engagement.consumeTargetDepleted()
) {
    this.clearCommandAndReturnHome();
}
```

最终：

```text
Resource depleted
↓
Brain clear command
↓
Flag 消失
↓
Reform
↓
ReturnHome
```

保持：

```text
Brain
=
高层状态决策者
```

---

# 22. ResourceRuntimeConfig

新增：

```text
assets/scripts/world/ResourceRuntimeConfig.ts
```

定义：

```ts
export interface ResourceRuntimeDefinition {
    maxHealth: number;
    yieldPerDamage: number;
}
```

按：

```text
ResourceType
```

映射。

第一版：

```ts
Wood:
maxHealth = 20
yieldPerDamage = 1

Stone:
maxHealth = 20
yieldPerDamage = 1

Food:
maxHealth = 20
yieldPerDamage = 1
```

API：

```ts
getResourceRuntimeDefinition(
    resourceType: ResourceType
)
```

---

# 23. ResourceInventory

新增：

```text
assets/scripts/economy/ResourceInventory.ts
```

这是游戏资源的真实数据源。

不要做 Cocos Component。

普通 TypeScript Class：

```ts
export class ResourceInventory {
    private readonly amounts =
        new Map<ResourceType, number>();
}
```

初始化：

```text
Wood = 0
Stone = 0
Food = 0
```

---

# 24. ResourceInventory API

```ts
get(
    type: ResourceType
): number

add(
    type: ResourceType,
    amount: number
): void

canSpend(
    type: ResourceType,
    amount: number
): boolean

trySpend(
    type: ResourceType,
    amount: number
): boolean

subscribe(
    listener: ResourceInventoryListener
): () => void
```

`trySpend()` 当前不会使用，但属于 Inventory 的核心职责，可以直接建立。

---

# 25. Inventory Changed Event

每次成功 add/spend：

```text
更新 amounts
↓
通知 listener
```

推荐 Snapshot：

```ts
export interface ResourceInventorySnapshot {
    wood: number;
    stone: number;
    food: number;
}
```

`subscribe()` 初次订阅后：

```text
立即推一次当前 snapshot
```

这样 HUD 不需要自己主动 query 初始化。

---

# 26. ResourceHarvestComponent

新增：

```text
assets/scripts/world/ResourceHarvestComponent.ts
```

职责：

```text
Resource Health 的 actualDamage
↓
换算资源数量
↓
ResourceInventory.add()
```

它知道：

```text
resourceType
yieldPerDamage
inventory
```

但不知道：

```text
Animator
AttackImpact
HitFlash
HUD
```

---

# 27. ResourceHarvestComponent setup

```ts
setup({
    resourceType,
    health,
    inventory,
    yieldPerDamage,
})
```

订阅：

```text
HealthComponent
```

当：

```text
DamageResult.actualDamage > 0
```

计算：

```ts
yieldAmount =
    actualDamage
    * yieldPerDamage;
```

然后：

```ts
inventory.add(
    resourceType,
    yieldAmount,
);
```

第一版所有数值都是整数。

---

# 28. 为什么 Harvest 监听 Health，而不是直接监听 AttackImpact

因为：

```text
AttackImpact = 攻击尝试
DamageResult = 真正损失的生命
```

资源收益应该对应：

```text
真正被采掉的资源量
```

例如：

```text
Resource 剩 1 HP
↓
最后一刀 damage 10
↓
actualDamage = 1
↓
只能获得 1 Resource
```

---

# 29. WorldObjectAttackReceiver 修改

当前 Receiver：

```text
AttackImpact
↓
HitFlash
```

改为：

```text
AttackImpact
↓
Health.takeDamage(signal.damage)
↓
DamageResult
```

如果：

```text
actualDamage > 0
```

执行：

```text
HitFlashView.flash()
DamagePopupSpawner.spawnDamage(...)
```

HealthBar 与 Inventory 由 Health listener 自动更新。

---

# 30. WorldObjectAttackReceiver Config

扩展：

```ts
export interface WorldObjectAttackReceiverConfig {
    objectId: string;

    combatEventHub:
        CombatEventHub;

    health:
        HealthComponent;

    hitFlashView:
        HitFlashView;

    damagePopupSpawner:
        DamagePopupSpawner;
}
```

ResourceHarvest 不需要注入 Receiver。

---

# 31. Receiver 返回结果

```ts
return {
    targetId:
        this.objectId,

    damageResult,

    targetDepleted:
        this.health.isDepleted(),
};
```

---

# 32. Depleted 后重复攻击

如果 HP 已经：

```text
0
```

再次收到：

```text
damage = 1
```

返回：

```text
actualDamage = 0
targetDepleted = true
```

不要：

```text
闪白
飘 -1
加资源
```

---

# 33. Resource Depleted 必须进入完整生命周期

Resource HP 从：

```text
> 0
```

变为：

```text
0
```

时，不再只把资源标记为不可交互。

本轮必须完成：

```text
逻辑失效
↓
目标失效
↓
Runtime Registry 移除
↓
停止继续命中 / 采集
↓
短延迟保留最终受击反馈
↓
Resource Node 删除
+
Navigation footprint 释放
```

最终要求：

> **Node 删除和 Navigation 释放必须由同一个生命周期控制器执行。**

禁止出现两个独立系统各自决定什么时候删除/释放。

---

# 34. 为什么 Node 删除与 Navigation 释放必须绑定

资源本身当前同时承担：

```text
World Visual
Logical WorldObject
Navigation Blocker
Combat Target
```

如果只删 Node：

```text
视觉上资源没了
但 NavigationGrid 仍 blocked
→ Squad 会绕空气走
```

如果只释放 Navigation：

```text
资源仍显示
但 Squad 可以穿过资源
```

所以必须视为一个原子生命周期动作：

```text
removeWorldObject(resourceId)
=
remove runtime object
+
remove visual node
+
unregister combat receiver
+
release navigation footprint
```

---

# 35. WorldObjectRuntimeRegistry

新增：

```text
assets/scripts/world/
└── WorldObjectRuntimeRegistry.ts
```

这是当前运行局中“哪些 WorldObject 仍然存在”的权威数据源。

初始化：

```ts
new WorldObjectRuntimeRegistry(
    STATIC_WORLD_OBJECTS
);
```

内部：

```ts
Map<string, WorldObjectData>
```

API：

```ts
get(
    objectId: string
): WorldObjectData | null

has(
    objectId: string
): boolean

getAll(): readonly WorldObjectData[]

remove(
    objectId: string
): WorldObjectData | null
```

---

# 35.1 为什么不能继续让 STATIC_WORLD_OBJECTS 当 Runtime Truth

`STATIC_WORLD_OBJECTS` 的语义是：

```text
关卡初始生成数据
```

一旦 Resource 可以被采完并消失：

```text
初始数据
≠
当前运行世界状态
```

因此禁止继续在运行逻辑中直接：

```ts
STATIC_WORLD_OBJECTS.find(...)
```

判断目标是否仍存在。

需要把以下系统逐步切到：

```text
WorldObjectRuntimeRegistry
```

至少包括：

```text
SquadBrain
SquadRenderer 的 target/home 查询
WorldCommandController
WorldObject 生命周期
```

`STATIC_WORLD_OBJECTS` 只负责 Bootstrap 初始状态。

---

# 35.2 Registry 的移除时机

Resource Health 归零后：

```text
WorldObjectLifecycleController.requestRemove(id)
```

必须**立即**：

```text
registry.remove(id)
```

这样同一帧之后：

```text
新的 Command
新的 Target Query
新的 Path Request
```

都不能再把它当有效目标。

但 Resource Node 可以为了最后一次受击视觉保留极短时间后再真正销毁。

---

# 35.3 WorldObjectLifecycleController

新增：

```text
assets/scripts/world/
└── WorldObjectLifecycleController.ts
```

作为：

```text
MapRoot Component
```

职责只有：

```text
接收 WorldObject remove request
↓
让 Runtime Registry 立即失效
↓
等待极短 Depletion Feedback Delay
↓
统一执行：
    WorldObjectRenderer.removeObject(id)
    Navigation footprint release
```

它不是：

```text
Health 系统
Harvest 系统
Combat 系统
```

---

# 35.4 删除延迟

第一版建议：

```ts
RESOURCE_REMOVE_DELAY_SECONDS = 0.12;
```

原因：

最后一击已经产生：

```text
Hit Flash
Damage Popup
HP → 0
```

如果在 Receiver 调用栈内立刻 destroy Resource Node：

```text
最后一次闪白几乎不可见
```

因此：

```text
逻辑 Depleted
= 立即

Runtime Registry remove
= 立即

禁止点击
= 立即

Squad 停止攻击
= 立即

视觉 Node 删除 + Navigation 释放
= 约 0.12 秒后同时执行
```

Damage Popup 在 `WorldFeedbackRoot` 下，因此 Resource Node 删除后仍能继续完成自己的 0.6 秒动画。

---

# 35.5 WorldObjectRenderer 必须支持按 ID 删除

当前 Renderer 只支持：

```text
render
clear
```

新增：

```ts
public removeObject(
    objectId: string
): boolean
```

Renderer 内维护：

```ts
private readonly nodeByObjectId =
    new Map<string, Node>();
```

创建 WorldObject 时：

```ts
nodeByObjectId.set(
    objectData.id,
    node,
);
```

删除时：

```text
查 Node
↓
WorldObjectAttackReceiver.dispose()
↓
从 nodeByObjectId 删除
↓
removeFromParent()
↓
destroy()
```

不要让 LifecycleController 自己遍历 Scene Tree 找名字。

---

# 35.6 Navigation footprint 释放

当前 `NavigationGrid` 已提供：

```ts
setWalkable(x, y)
```

本轮继续使用现有 API。

LifecycleController 拿到被移除的：

```text
WorldObjectData
```

再通过：

```text
getWorldVisualDefinition(
    objectData.visualId
)
```

得到：

```text
w / h
```

然后：

```ts
for (
    let y = objectData.gridY;
    y < objectData.gridY + visual.h;
    y += 1
) {
    for (
        let x = objectData.gridX;
        x < objectData.gridX + visual.w;
        x += 1
    ) {
        navigationGrid.setWalkable(x, y);
    }
}
```

当前 WorldObjectRenderer 已禁止 footprint overlap，因此第一版可以安全地将这些 cell 直接恢复为 walkable。

---

# 35.7 释放数量

当前：

```text
Tree 2×2
→ release 4 cells

Stone 2×2
→ release 4 cells

Food 1×1
→ release 1 cell
```

建议生命周期日志：

```text
[WorldObjectLifecycle]
removed=wood_01
releasedCells=4
```

并可额外打印：

```text
blockedBefore
blockedAfter
```

用于验证。

---

# 35.8 删除事务顺序

实际删除阶段固定：

```text
1. 读取 pending removal 保存的 WorldObjectData

2. WorldObjectRenderer.removeObject(id)
   ├── dispose AttackReceiver
   ├── unregister CombatEventHub
   └── destroy Node

3. releaseNavigationFootprint(objectData)

4. pending removal 删除

5. 打印 Lifecycle 日志
```

Registry 已经在 `requestRemove()` 时提前移除，不要在这里再次依赖 Registry 查数据。

---

# 35.9 WorldObjectAttackReceiver 如何触发生命周期

Receiver 在：

```text
Health.takeDamage()
```

之后拿到：

```text
DamageResult
```

若：

```ts
damageResult.becameDepleted
```

执行顺序：

```text
1. HitFlash
2. DamagePopup
3. Harvest 已通过 Health listener 获得最后一次 actualDamage
4. WorldObjectView.setInteractable(false)
5. lifecycle.requestRemove(objectId)
6. return AttackImpactResult(targetDepleted=true)
```

这样最后一击的资源产出不会因为删除流程丢失。

---

# 35.10 ResourceHarvest 不负责删除 Node

保持：

```text
ResourceHarvestComponent
=
Health actualDamage
→ Inventory
```

它不允许：

```text
destroy Node
setWalkable
remove registry
```

生命周期统一交给：

```text
WorldObjectLifecycleController
```

---

# 35.11 WorldObjectView 仍保留 interactable

虽然 Node 很快会被删除，仍然保留：

```ts
setInteractable(false)
```

原因：

```text
Depleted
→ Node 真正 destroy
```

之间存在约 0.12 秒反馈窗口。

这期间必须拒绝新点击。

---

# 35.12 SquadBrain 改用 Runtime Registry

当前 Brain 的：

```text
worldObjectById:
ReadonlyMap
```

建议改为：

```text
worldObjectRegistry:
WorldObjectRuntimeRegistry
```

所有：

```text
issueTarget
getActiveTarget
pending target resume
```

统一：

```ts
registry.get(targetId)
```

资源一旦 Depleted：

```text
registry.get(id)
→ null
```

即使未来另一支 Squad 已经在路上，也不会继续把被删除资源当成有效交互对象。

---

# 35.13 WorldCommandController 改用 Runtime Registry

当前 Controller 自己复制：

```text
worldObjectById = new Map(...)
```

本轮改为注入：

```text
WorldObjectRuntimeRegistry
```

点击时：

```ts
const target =
    registry.get(objectId);

if (!target) {
    return;
}
```

Flag 定位也从 Registry 获取当前对象数据。

不要继续保存一份永远不会删除的静态 Map。

---

# 35.14 SquadRenderer 不再直接依赖 STATIC_WORLD_OBJECTS

当前 Renderer 内部直接：

```ts
STATIC_WORLD_OBJECTS
```

建立：

```text
worldObjectById
```

本轮应由：

```text
MainMapController
```

注入：

```text
WorldObjectRuntimeRegistry
```

Renderer 创建 Brain 时继续传同一个 Registry。

Base 也通过 Registry 查。

---

# 35.15 MainMapController Bootstrap 顺序调整

建议顺序：

```text
1. WorldObjectRuntimeRegistry(STATIC_WORLD_OBJECTS)

2. NavigationGridBuilder.build(
       STATIC_MAP,
       registry.getAll()
   )

3. CombatEventHub

4. ResourceInventory

5. WorldObjectRenderer

6. WorldObjectLifecycleController.setup(
       registry,
       renderer,
       navigationGrid
   )

7. WorldObjectRenderer.render(
       registry.getAll(),
       ...
   )

8. SquadRenderer(
       registry,
       navigationGrid,
       ...
   )

9. WorldCommandController.setup(
       registry,
       ...
   )
```

这样：

```text
Runtime World State
Navigation
Renderer
Combat
Command
```

共享的是同一份 active-world 视图。

---

# 36. HealthBar 素材结构

用户提供的 18×4 素材像素结构为：

```text
透明角
┌────────────────┐
│████████████████│
│████████████████│
└────────────────┘
透明角
```

实际内部：

```text
Outer:
18 × 4

Inner Fill:
16 × 2
```

因此不建议直接：

```text
把整个 Sprite 横向 scale
```

也不建议对整张条使用 fillRange，因为会把右侧边框一起裁掉。

---

# 37. HealthBarSpriteConfig

新增：

```text
assets/scripts/feedback/
└── HealthBarSpriteConfig.ts
```

把同一张 18×4 Texture 切成：

```text
Top Border:
x=1 y=0 w=16 h=1

Bottom Border:
x=1 y=3 w=16 h=1

Left Border:
x=0 y=1 w=1 h=2

Right Border:
x=17 y=1 w=1 h=2

Fill:
x=1 y=1 w=16 h=2
```

透明四角自然不创建。

---

# 38. 为什么这样拆血条

最终：

```text
HealthBar
├── TopBorder
├── BottomBorder
├── LeftBorder
├── RightBorder
└── Fill
```

只有：

```text
Fill
```

随 Health 变化。

四条 Border 始终完整。

这样：

```text
100%
████████████████

50%
████████

10%
██
```

但外框一直保持完整。

---

# 39. Fill Sprite

Fill 使用：

```text
Sprite.Type.FILLED
Sprite.FillType.HORIZONTAL
fillStart = 0
fillRange = healthRatio
```

因为 Fill Slice 本身只是纯色：

```text
16×2
```

所以不会出现边框被裁掉的问题。

---

# 40. HealthBarView

新增：

```text
assets/scripts/feedback/HealthBarView.ts
```

职责：

```text
HealthComponent
↓
healthRatio
↓
Fill Sprite
```

---

# 41. HealthBarView setup

推荐：

```ts
setup({
    health,
    texture,
    localOffsetY,
})
```

内部运行时创建：

```text
HealthBar Node
+ 5 Sprite
```

不要要求用户手工给每个 Resource / Warrior 创建血条节点。

---

# 42. HealthBar 尺寸

源尺寸：

```text
18 × 4 px
```

Resource 和 Warrior Node 当前都：

```text
scale = GRID_RENDER_SCALE = 2
```

所以 HealthBar 作为目标 Node 的 Child：

```text
最终显示：
36 × 8 world px
```

不再额外 scale 2。

---

# 43. Warrior HealthBar 位置

Warrior source：

```text
16 × 16
```

Warrior local top：

```text
y = +8
```

推荐 HealthBar center：

```text
local y = +11
```

即：

```text
1 source px gap
+
4px bar / 2
```

最终世界效果：

```text
Warrior 顶部
↑ 2 px world gap
↑ 8 px world health bar
```

---

# 44. Resource HealthBar 位置

WorldObject 本地尺寸：

```text
definition.w * 16
definition.h * 16
```

推荐：

```ts
localOffsetY =
    definition.h
    * GRID_SOURCE_SIZE
    / 2
    + 3;
```

例如 2×2 Tree：

```text
height = 32 source px
top = 16
bar center = 19
```

1×1 Food：

```text
top = 8
bar center = 11
```

---

# 45. HealthBar 生命周期

HealthBarView：

```text
setup
↓
subscribe Health
↓
即时刷新
```

销毁：

```text
unsubscribe Health
```

不要每帧读取：

```text
health.getCurrentHealth()
```

血条是事件驱动更新。

---

# 46. Friendly / Hostile 颜色

当前：

```text
Warrior
→ health_bar_friendly.png

Resource
→ health_bar_hostile.png
```

未来：

```text
Monster
→ health_bar_hostile.png
```

不要按具体类型写：

```text
if Tree use red
if Stone use red
```

Renderer 只选择阵营/用途 Texture。

---

# 47. DamagePopupSpawner

新增：

```text
assets/scripts/feedback/
└── DamagePopupSpawner.ts
```

普通 TypeScript Class。

由：

```text
MainMapController
```

创建。

持有：

```text
WorldFeedbackRoot
```

---

# 48. WorldFeedbackRoot

Agent 在 Bootstrap 时：

```text
MapRoot
```

下查找：

```text
WorldFeedbackRoot
```

若不存在：

```text
运行时创建
```

最终：

```text
MapRoot
├── TileRoot
├── WorldObjectRoot
├── ActorRoot
├── CommandRoot
└── WorldFeedbackRoot
```

用于：

```text
Damage Popup
未来 Heal Popup
Crit
Block
Miss
```

---

# 49. DamagePopupSpawner API

```ts
spawnDamage(
    targetNode: Node,
    amount: number,
): void
```

步骤：

```text
targetNode.worldPosition
↓
增加 world Y offset
↓
转换到 WorldFeedbackRoot local position
↓
创建 DamagePopup Node
```

---

# 50. DamagePopup 位置 Offset

推荐：

```text
Resource:
从目标中心上方开始

Warrior:
从头顶附近开始
```

Spawner 可以通过：

```text
targetNode UITransform height
× target worldScale
```

计算通用 offset。

第一版也可：

```text
目标 worldPosition
+ 20~30 world px
```

但推荐读取 UITransform。

---

# 51. DamagePopupView

新增：

```text
assets/scripts/feedback/
└── DamagePopupView.ts
```

运行时创建：

```text
Node
├── UITransform
├── Label
├── LabelOutline
├── UIOpacity
└── DamagePopupView
```

---

# 52. DamagePopup 文本

显示：

```text
-1
-5
-10
```

使用：

```text
actualDamage
```

禁止显示 requestedDamage。

---

# 53. DamagePopup 初版表现

生命周期：

```text
0.00s
显示
↓
向上移动
↓
0.60s
Alpha = 0
↓
destroy
```

推荐：

```text
LIFETIME = 0.60 sec

RISE_DISTANCE =
24 world px
```

Label：

```text
fontSize ≈ 14~16
```

带深色 Outline，保证在地图背景上可读。

---

# 54. DamagePopup 不使用 Tween 队列

每个 Popup 是独立 Node：

```text
自己的 update
↓
移动 + fade
↓
destroy
```

不在目标上叠一堆 Tween。

多个 Warrior 同时攻击：

```text
允许同时出现多个 -1
```

这正是预期反馈。

---

# 55. ResourceInventory HUD

新增：

```text
assets/scripts/ui/
└── ResourceHudView.ts
```

---

# 56. HUDRoot

Agent 运行时在：

```text
Canvas
```

下查找：

```text
HUDRoot
```

不存在则创建。

最终：

```text
Canvas
├── Camera
├── MapRoot
└── HUDRoot
    └── ResourceHud
```

HUDRoot 与 MapRoot 平级。

原因：

```text
HUD 固定屏幕
不能跟地图移动
```

---

# 57. ResourceHud

Agent 创建：

```text
ResourceHud
├── UITransform
├── Label
└── ResourceHudView
```

顶部水平居中。

文本：

```text
木材 0    石材 0    食物 0
```

---

# 58. ResourceHudView

setup：

```ts
setup(
    inventory: ResourceInventory
): void
```

订阅：

```text
ResourceInventory
```

收到 Snapshot：

```ts
label.string =
    `木材 ${wood}    石材 ${stone}    食物 ${food}`;
```

---

# 59. HUD 不允许保存资源状态

错误：

```ts
this.wood += amount;
```

正确：

```text
Inventory 改
↓
HUD 收 snapshot
↓
重新 render string
```

以后：

```text
建筑花木材
商店花石材
事件奖励食物
```

全部统一经过 Inventory。

---

# 60. MainMapController 新职责

MainMapController 继续作为 Composition Root。

新增 Inspector：

```ts
@property(Texture2D)
friendlyHealthBarTexture

@property(Texture2D)
resourceHealthBarTexture
```

---

# 61. MainMapController Bootstrap 新对象

创建：

```text
ResourceInventory

WorldFeedbackRoot

DamagePopupSpawner

HUDRoot
ResourceHudView
```

然后注入：

```text
WorldObjectRenderer
SquadRenderer
```

---

# 62. MainMapController 不保存经济数值

可以持有：

```text
resourceInventory reference
```

用于生命周期。

但禁止：

```text
mainMapController.wood
mainMapController.stone
mainMapController.food
```

---

# 63. WorldObjectRenderer 新装配

Resource Node：

```text
Resource_xxx
├── Sprite
├── WorldObjectView
├── HealthComponent
├── HealthBarView
├── HitFlashView
├── ResourceHarvestComponent
└── WorldObjectAttackReceiver
```

顺序建议：

```text
1. Node/Sprite/View
2. Health
3. HealthBar
4. HitFlash
5. Harvest
6. Receiver
```

---

# 64. Resource Renderer Setup

读取：

```text
objectData.resourceType
```

然后：

```ts
const resourceDefinition =
    getResourceRuntimeDefinition(
        resourceType
    );
```

Health：

```ts
health.setup(
    resourceDefinition.maxHealth
);
```

Harvest：

```ts
harvest.setup({
    resourceType,
    health,
    inventory,
    yieldPerDamage,
    worldObjectView: view,
});
```

---

# 65. SquadRenderer 新装配

每个 Warrior：

```text
Warrior_N
├── Sprite
├── WarriorAnimator
├── WarriorMotor
├── CombatStats
├── HealthComponent
├── HealthBarView
├── HitFlashView
└── WarriorAttackReceiver
```

---

# 66. WarriorAttackReceiver

新增：

```text
assets/scripts/squad/
└── WarriorAttackReceiver.ts
```

注册 targetId：

```text
${squadId}/warrior_${index}
```

这正好与当前：

```text
attackerId
```

命名一致。

---

# 67. WarriorAttackReceiver 职责

未来 Monster 攻击时：

```text
AttackImpact
↓
Health.takeDamage
↓
actualDamage > 0
├── flash
├── popup
└── healthbar listener update
```

当前不会被调用，但必须可用。

---

# 68. Warrior Death 本轮不实现

虽然 Warrior Health 可以降到 0，但本轮没有敌方攻击。

不要顺带实现：

```text
death animation
remove warrior
formation rebuild
revive
```

后续 Monster Combat 阶段单独设计。

---

# 69. HitFlashView 复用

Resource 和 Warrior 均复用现有：

```text
HitFlashView
```

每个 Sprite：

```text
独立 Material Instance
```

不要修改当前已经验证通过的 Effect 采样规则。

---

# 70. CombatEventHub 当前变化

当前 Hub：

```text
targetId
→ receiver
→ void
```

升级：

```text
targetId
→ receiver
→ AttackImpactResult
```

Hub 本身仍然：

```text
不算伤害
不改 HP
不加资源
不做飘字
```

---

# 71. 资源收益完整链路

例如：

```text
Wood HP:
5 / 20

Warrior attackDamage:
3
```

命中：

```text
requestedDamage = 3
actualDamage = 3

HP:
5 → 2

Inventory:
wood +3

Popup:
-3
```

下一次：

```text
requestedDamage = 3

HP:
2 → 0

actualDamage = 2

Inventory:
wood +2

Popup:
-2

targetDepleted = true
```

不能：

```text
最后一次仍然 +3 wood
```

---

# 72. Depleted Resource 状态

资源最后一次有效伤害发生后：

```text
HP = 0
↓
DamageResult.becameDepleted = true
↓
最后一次 actualDamage 正常进入 Harvest
↓
最后一次 HitFlash / DamagePopup 正常产生
↓
WorldObjectView 立即不可点击
↓
Runtime Registry 立即 remove
↓
AttackImpactResult.targetDepleted = true
↓
SquadBrain 开始 Reform / ReturnHome
↓
约 0.12 秒后
WorldObjectLifecycleController
↓
同一事务执行：
├── WorldObjectRenderer.removeObject()
└── NavigationGrid footprint → walkable
```

最终：

```text
Resource Node 不存在
Combat Receiver 已注销
HealthBar 随 Resource Node 销毁
原资源 footprint 可以被后续 A* 正常穿过
Damage Popup 可继续在 WorldFeedbackRoot 播放完成
```

---

# 72.1 删除后 StaticWorldObjects 不修改

`STATIC_WORLD_OBJECTS` 是：

```text
关卡初始定义
```

运行时不要 splice / mutate 它。

当前实际存在对象由：

```text
WorldObjectRuntimeRegistry
```

管理。

这样重新开始关卡时：

```text
重新用 STATIC_WORLD_OBJECTS
创建新的 Registry
```

即可恢复初始状态。

---

# 72.2 Navigation 必须真实可穿行

删除 2×2 Tree 后，其原 footprint 四格：

```text
全部 isWalkable = true
```

删除 1×1 Food 后：

```text
该一格 isWalkable = true
```

后续：

```text
WorldNavigator / AStarPathfinder
```

无需重建整个 NavigationGrid。

它们读取的是同一个已经被更新的 Grid 对象。

---

# 73. Flag 行为

资源被耗尽：

```text
SquadBrain
clearCommandAndReturnHome()
```

因此：

```text
commandTargetId = null
```

现有 WorldCommandController 会隐藏目标 Flag。

不额外给 Flag 写 depleted 逻辑。

---

# 74. 多 Warrior 同一帧攻击

可能：

```text
W0 hit
W1 hit
W2 hit
W3 hit
```

第一个把 HP 打到 0：

```text
targetDepleted = true
```

随后：

```text
Engagement currentTarget = null
```

其他 callback：

```text
直接 return
```

不会重复给资源。

---

# 75. ResourceInventory 并发语义

JS 主线程串行执行。

多个 hit：

```text
inventory.add()
```

按事件顺序依次更新。

不需要 Lock。

---

# 76. HealthBar 更新频率

禁止：

```text
HealthBarView.update()
每帧读 HP
```

必须：

```text
Health change event
↓
更新 fillRange
```

因为 HP 只在事件发生时变化。

---

# 77. Damage Popup 不进入 Combat Event Hub

CombatEventHub 路由的是：

```text
Gameplay Impact
```

Damage Popup 是：

```text
Presentation
```

所以 Popup 由 Receiver 根据 DamageResult 触发。

不要再建立：

```text
DamagePopupEventHub
```

本轮没必要。

---

# 78. Resource HUD 不进入 Combat Event Hub

资源数值更新：

```text
Health
↓
Harvest
↓
Inventory
↓
HUD
```

Combat Hub 到 Receiver 后就结束职责。

---

# 79. 建议 Debug 日志

Damage：

```text
[Damage]
target=wood_01
requested=1
actual=1
hp=19/20
```

Harvest：

```text
[Harvest]
type=Wood
amount=1
total=1
```

Depleted：

```text
[Health]
target=wood_01 depleted=true
```

不要逐帧打印 HealthBar / Popup。

---

# 80. Runtime Node Tree 预期

运行后：

```text
Canvas
├── Camera
├── MapRoot
│   ├── TileRoot
│   ├── WorldObjectRoot
│   │   └── ResourceRoot
│   │       └── Resource_wood_01
│   │           └── HealthBar
│   ├── ActorRoot
│   │   └── SquadRoot
│   │       └── Squad_initial_01
│   │           ├── Warrior_0
│   │           │   └── HealthBar
│   │           ├── Warrior_1
│   │           ├── Warrior_2
│   │           └── Warrior_3
│   ├── CommandRoot
│   └── WorldFeedbackRoot
│       ├── DamagePopup_...
│       └── ...
└── HUDRoot
    └── ResourceHud
```

Slot 仍然不是 Node。

---

# 81. Agent 推荐开发顺序

## Step 1：纯数据层

先实现：

```text
DamageResult
AttackImpactResult
HealthComponent
CombatStats
ResourceInventory
ResourceRuntimeConfig
```

先不做 UI。

---

## Step 2：Combat 链路

修改：

```text
AttackImpactSignal.damage
CombatEventHub return result
WorldObjectAttackReceiver
SquadEngagementController
```

先用 Console 验证：

```text
HP 20 → 19 → 18
```

---

## Step 3：Harvest

实现：

```text
ResourceHarvestComponent
```

验证：

```text
Wood HP -1
↓
Inventory Wood +1
```

---

## Step 4：Depleted

实现：

```text
targetDepleted
↓
SquadBrain
↓
Reform
↓
ReturnHome
```

并禁用 Resource 点击。

---

## Step 5：HealthBar

实现：

```text
HealthBarSpriteConfig
HealthBarView
```

先接 Resource，再接 Warrior。

---

## Step 6：Damage Popup

实现：

```text
WorldFeedbackRoot
DamagePopupSpawner
DamagePopupView
```

---

## Step 7：Resource HUD

实现：

```text
HUDRoot
ResourceHudView
```

---

## Step 8：Warrior Damageable 基础

装配：

```text
CombatStats
Health
HealthBar
HitFlash
WarriorAttackReceiver
```

验证 CombatEventHub 中存在合法 Warrior Target。

---

# 82. 禁止实现

本轮禁止：

```text
重建整张 NavigationGrid 来处理单个资源删除
在 Renderer / Harvest / SquadBrain 中各自重复释放 footprint
删除 Base
Monster AI
Monster Node
Warrior Death
Death Animation
复活
护甲
暴击
元素
Buff / Debuff
攻击速度数值重构
资源运输回基地
资源容量
库存上限
资源图标
复杂 HUD
对象池
Damage Popup Pool
Physics Collider
```

先完成闭环。

---

# 83. 用户验收 Case 1：Wood

初始：

```text
木材 0
Wood HP 20/20
```

第一次有效 hit：

```text
HP 19/20
Popup -1
Resource 闪白
木材 1
```

---

# 84. 用户验收 Case 2：Stone / Food

Stone：

```text
石材增加
木材不变
食物不变
```

Food：

```text
食物增加
木材不变
石材不变
```

ResourceType 映射必须正确。

---

# 85. 用户验收 Case 3：4 Warrior

四人同时攻击：

```text
每次各自 Attack Pose
↓
各自产生 Damage
↓
可以看到多个 -1
↓
HP 连续下降
↓
资源数量同步增加
```

不能退化成：

```text
Squad 每轮只扣一次
```

---

# 86. 用户验收 Case 4：最后一击

手工测试：

```text
Resource HP 剩 1
```

收到：

```text
damage >= 1
```

必须：

```text
actualDamage = 1
只增加 1 Resource
Popup = -1
HP = 0
```

---

# 87. 用户验收 Case 5：Depleted + 删除 + Navigation 释放

HP = 0：

```text
最后一次资源正常入账
↓
Squad 停止 Attack
↓
Reform
↓
ReturnHome
↓
Flag 消失
↓
约 0.12 秒后
Resource Node 消失
↓
原 footprint 释放为 walkable
```

必须验证：

```text
wood_01 / stone_01：
blocked cell 数减少 4

food_01：
blocked cell 数减少 1
```

并验证后续寻路：

```text
Squad 的新路径
允许经过已经被采空资源原本占据的格子
```

Resource Node 已不存在，因此不能再次点击。

---

# 88. 用户验收 Case 6：HealthBar

Resource：

```text
红色血条
```

Warrior：

```text
灰绿色血条
```

血条：

```text
Border 始终完整
Fill 随 HP 从左到右缩短
```

不能整张图被水平压扁。

---

# 89. 用户验收 Case 7：Damage Popup

命中：

```text
出现 -1
```

约：

```text
0.6 秒
```

向上飘并淡出。

多个 hit：

```text
允许多个 Popup 同时存在
```

不能覆盖成一条固定 Label。

---

# 90. 用户验收 Case 8：Resource HUD

始终固定屏幕顶部：

```text
木材 X    石材 X    食物 X
```

Map / Squad 移动时 HUD 不移动。

---

# 91. Definition of Done

- [ ] AttackImpactSignal 增加 damage
- [ ] AttackImpactReceiver 返回 AttackImpactResult
- [ ] CombatEventHub 返回 Receiver 结果
- [ ] 新增通用 HealthComponent
- [ ] HealthComponent 支持 DamageResult
- [ ] HealthComponent 支持多 listener
- [ ] 新增 CombatStats
- [ ] Sword Warrior attackDamage 来自 Config
- [ ] 新增 ResourceRuntimeConfig
- [ ] 新增 ResourceInventory
- [ ] Inventory 是唯一资源真实数据源
- [ ] 新增 ResourceHarvestComponent
- [ ] Harvest 按 actualDamage 增加资源
- [ ] Resource HP 降低
- [ ] Resource HP=0 后不再产出
- [ ] Resource HP=0 后立即从 Runtime Registry 移除
- [ ] Resource HP=0 后立即不可再次点击
- [ ] Squad 在目标 depleted 后 Reform + ReturnHome
- [ ] 新增 WorldObjectRuntimeRegistry
- [ ] 新增 WorldObjectLifecycleController
- [ ] WorldObjectRenderer 支持 removeObject(objectId)
- [ ] Resource 删除前正确 dispose Combat Receiver
- [ ] Resource Node 在 depletion feedback delay 后被销毁
- [ ] Resource Node 删除与 Navigation footprint 释放由同一生命周期事务执行
- [ ] 2×2 Resource 删除释放 4 个 Navigation cells
- [ ] 1×1 Resource 删除释放 1 个 Navigation cell
- [ ] A* 可经过已删除 Resource 的原 footprint
- [ ] SquadBrain 使用 Runtime Registry 判断目标存在性
- [ ] WorldCommandController 使用 Runtime Registry
- [ ] SquadRenderer 不再直接把 STATIC_WORLD_OBJECTS 当运行时状态
- [ ] Resource 使用红色 18×4 血条
- [ ] Warrior 使用灰绿色 18×4 血条
- [ ] 血条边框始终完整
- [ ] 只有内部 Fill 缩短
- [ ] HealthBar 事件驱动更新
- [ ] 新增 WorldFeedbackRoot
- [ ] Damage Popup 使用 actualDamage
- [ ] Popup 上飘 + fade + destroy
- [ ] 多 Popup 可同时存在
- [ ] 新增 HUDRoot
- [ ] 顶部显示 木材 / 石材 / 食物
- [ ] HUD 订阅 Inventory
- [ ] Warrior 创建 HealthComponent
- [ ] Warrior 创建 CombatStats
- [ ] Warrior 创建 HealthBar
- [ ] Warrior 注册 AttackReceiver
- [ ] Resource / Warrior 复用 HitFlashView
- [ ] depleted Resource 最终从 Scene Tree 删除
- [ ] NavigationGrid 原对象 footprint 被动态恢复 walkable
- [ ] STATIC_WORLD_OBJECTS 仍保持只读初始数据
- [ ] Console 无 Error

---

# 92. Agent 完成后必须回报

```text
1. 新增 / 修改文件清单

2. 最终 commit SHA

3. CombatTypes 新接口：
   AttackImpactSignal
   DamageResult
   AttackImpactResult

4. HealthComponent API

5. CombatStats API

6. ResourceInventory API

7. ResourceRuntimeConfig 数值

8. ResourceHarvestComponent 实现

9. HealthBar 18×4 Slice 实现方式

10. Resource HealthBar 实际截图

11. Warrior HealthBar 实际截图

12. Damage Popup 实际截图

13. 顶部 Resource HUD 实际截图

14. wood_01：
    HP / Damage / Harvest Console 日志

15. stone_01：
    Harvest Console 日志

16. food_01：
    Harvest Console 日志

17. Resource depleted 后：
    Reform → ReturnHome 日志

18. WorldObjectLifecycle 日志：
    removed=<resourceId>
    releasedCells=<N>

19. 删除前后的 NavigationGrid blocked count

20. 2×2 Resource：
    确认释放 4 cells

21. 1×1 Resource：
    确认释放 1 cell

22. Resource Node 已从 Runtime Node Tree 消失

23. A* 路径可经过原 Resource footprint 的验证

24. Runtime Registry 中 depleted Resource 已不存在的验证

25. 4 Warrior 同时 Attack
    多个 Damage Popup 的验证

26. Console 无 Error
```

---

# 93. 最终长期结构

```text
                       ATTACKER
                          │
                    CombatStats
                          │
                  WarriorAnimator
                          │
                 Attack Pose Enter
                          │
                          ▼
             SquadEngagementController
                          │
               AttackImpactSignal
                          │
                          ▼
                   CombatEventHub
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
   WorldObjectAttackReceiver   WarriorAttackReceiver
              │                       │
              └───────────┬───────────┘
                          ▼
                   HealthComponent
                          │
             ┌────────────┼────────────┐
             │            │            │
             ▼            ▼            ▼
        HealthBar      DamagePopup   HitFlash
             │
      Resource only
             ▼
   ResourceHarvestComponent
             │
             ▼
     ResourceInventory
             │
             ▼
      ResourceHudView

Resource depleted
      │
      ▼
WorldObjectLifecycleController
      │
      ├── WorldObjectRuntimeRegistry.remove
      │
      ├── WorldObjectRenderer.removeObject
      │
      └── NavigationGrid.release footprint
```

---

# 94. 本轮最重要的架构结论

```text
AttackImpact
不等于 Damage
```

AttackImpact 是：

```text
“这一击到达命中时刻”
```

HealthComponent 决定：

```text
“这一击真正造成多少 HP 损失”
```

ResourceHarvest 决定：

```text
“这些实际损失转换成多少资源”
```

Inventory 决定：

```text
“玩家现在真正拥有多少资源”
```

Feedback 决定：

```text
“玩家怎么感知这次伤害”
```

把这五层分开后，后面 Monster、Tower、Skill、Armor、Crit、Healing 都可以继续建立在同一基础上，而不需要重写当前资源采集闭环。


---

# 95. Resource 生命周期补充原则

从本版开始，Resource 不再是“生成后永远存在”的静态对象。

它的生命周期明确为：

```text
STATIC_WORLD_OBJECTS
= 初始关卡定义

↓ Bootstrap

WorldObjectRuntimeRegistry
= 当前运行世界中的有效对象

↓ HP = 0

Runtime Registry 移除
= 逻辑上已经不存在

↓ 约 0.12 秒

Resource Node 删除
+
Navigation footprint 释放
= 视觉与路径状态同时完成清理
```

最重要的不变量：

> **“资源是否存在”由 Runtime Registry 判断，不由 Scene Node 是否还可见判断。**

> **Resource Node 删除与 Navigation footprint 释放必须由一个生命周期系统一次完成。**

> **STATIC_WORLD_OBJECTS 永远只是初始输入，不承担运行时状态。**

这样下一阶段继续加入怪物营地、可破坏建筑、障碍物或动态建造时，可以复用同一套“运行时世界对象生命周期”模型。
