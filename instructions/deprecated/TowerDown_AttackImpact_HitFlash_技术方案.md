# TowerDown：Attack Impact 信号与受击闪白反馈技术方案
## 可复用攻击命中事件链，当前用于资源采集，后续复用于怪物战斗

> 适用仓库：`saiqi1999/TowerDown`  
> 当前阶段：Warrior Interaction Slot 已接入之后  
> 本轮目标：
>
> ```text
> Warrior 攻击动画真正进入攻击 Pose
> ↓
> 产生一次 AttackImpact 信号
> ↓
> 信号发送给当前 Target
> ↓
> Resource 接收信号
> ↓
> Sprite 瞬间闪白
> ↓
> 恢复正常
> ```
>
> 本轮只做攻击命中信号和视觉反馈。
>
> 不做：
>
> ```text
> 资源 HP
> 资源数量扣减
> Damage 数值
> 怪物 HP
> 暴击
> 护甲
> 元素
> 音效
> 飘字
> 击退
> ```

---

# 1. 核心设计原则

本轮不能把逻辑写成：

```text
Warrior
→ 找 Resource Node
→ resource.flashWhite()
```

必须建立可复用链路：

```text
WarriorAnimator
↓
Attack Pose Entered
↓
SquadEngagementController
↓
AttackImpactSignal
↓
CombatEventHub
↓
Target Receiver
↓
Hit Feedback
```

这样未来攻击怪物时，攻击端不需要重写。

---

# 2. 最终职责边界

```text
WarriorAnimator
= 只知道“攻击动作命中帧发生了”

SquadEngagementController
= 知道是哪一个 Warrior、当前攻击哪个 Target

CombatEventHub
= 根据 targetId 路由攻击命中信号

WorldObjectAttackReceiver
= Resource 对 AttackImpact 的业务入口

HitFlashView
= 只负责闪白表现
```

未来：

```text
MonsterAttackReceiver
├── Health
├── HitFlashView
├── HitSfx
└── DamageNumber
```

仍然复用同一个：

```text
AttackImpactSignal
CombatEventHub
WarriorAnimator impact callback
```

---

# 3. 当前代码基线

当前 Warrior 到达 Interaction Slot 后：

```text
SquadEngagementController
↓
assignment.animator.playAttack(
    assignment.slot.facing
)
```

当前 Attack 动画是：

```text
Idle Pose
↔
Attack Pose
```

两帧循环。

因此真正的 AttackImpact 触发点定义为：

> **Attack Pose 首次显示的瞬间。**

不能定义为：

```text
playAttack() 被调用
```

因为以后攻击前摇、不同武器攻击节奏都会变化。

---

# 4. 用户需要做的事情

本轮用户只负责 **一个 Material 的 Editor 配置 + 运行验收**。

Agent 完成代码和 `.effect` 文件后：

## 4.1 创建 Material

在 Cocos Creator 中：

```text
assets/materials/
```

创建一个 Material：

```text
hit-flash.mtl
```

选择 Agent 新增的 Effect：

```text
hit-flash
```

默认：

```text
flashAmount = 0
```

---

## 4.2 绑定 Material

选择：

```text
MapRoot
```

找到：

```text
MainMapController
```

Agent 会新增 Inspector 字段：

```text
Hit Flash Material
```

把：

```text
hit-flash.mtl
```

拖进去。

---

## 4.3 保存 Scene

保存：

```text
Main.scene
```

---

## 4.4 运行验收

至少测试：

```text
wood_01
stone_01
food_01
```

观察：

```text
Warrior 到 Slot
↓
攻击 Pose 出现
↓
资源同步闪白
↓
恢复
↓
下一次攻击 Pose
↓
再次闪白
```

四人围同一资源时：

```text
每个 Warrior 的命中都可以触发反馈
```

---

# 5. Agent 需要完成的事情

Agent 完成全部代码和 Effect。

建议新增：

```text
assets/scripts/combat/
├── CombatTypes.ts
└── CombatEventHub.ts
```

新增：

```text
assets/scripts/feedback/
└── HitFlashView.ts
```

新增：

```text
assets/scripts/world/
└── WorldObjectAttackReceiver.ts
```

新增：

```text
assets/effects/
└── hit-flash.effect
```

修改：

```text
assets/scripts/squad/
├── WarriorAnimator.ts
├── SquadEngagementController.ts
└── SquadRenderer.ts
```

修改：

```text
assets/scripts/world/
└── WorldObjectRenderer.ts
```

修改：

```text
assets/scripts/map/
└── MainMapController.ts
```

---

# 6. CombatTypes.ts

新增通用 Attack Impact 类型。

第一版：

```ts
export interface AttackImpactSignal {
    attackerId: string;
    targetId: string;
}
```

不要加入资源专用字段：

```text
woodAmount
resourceType
harvestPower
```

也不要提前加入尚未使用的：

```text
damage
critical
element
armorPenetration
```

以后需要时再扩展接口。

---

# 7. Receiver 接口

同时定义：

```ts
export interface AttackImpactReceiver {
    onAttackImpact(
        signal: AttackImpactSignal
    ): void;
}
```

任何可被攻击对象都可以实现该接口。

当前：

```text
WorldObjectAttackReceiver
```

未来：

```text
MonsterAttackReceiver
BossAttackReceiver
BuildingAttackReceiver
```

---

# 8. CombatEventHub.ts

`CombatEventHub` 使用普通 TypeScript Class。

不要做：

```text
全局静态 Singleton
Node Component
director 全局事件
```

由：

```text
MainMapController
```

作为 Composition Root 创建和注入。

推荐：

```ts
export class CombatEventHub {
    private readonly receivers =
        new Map<string, AttackImpactReceiver>();

    public registerReceiver(
        targetId: string,
        receiver: AttackImpactReceiver,
    ): void {
        ...
    }

    public unregisterReceiver(
        targetId: string,
        receiver: AttackImpactReceiver,
    ): void {
        ...
    }

    public emitAttackImpact(
        signal: AttackImpactSignal,
    ): void {
        ...
    }
}
```

---

# 9. Receiver 注册规则

一个：

```text
targetId
```

当前对应一个 Target Receiver。

注册时：

```ts
if (
    existing
    && existing !== receiver
) {
    throw new Error(
        `[CombatEventHub] duplicate receiver: ${targetId}`
    );
}
```

避免隐藏 ID 冲突。

---

# 10. emitAttackImpact()

逻辑：

```text
targetId
↓
Map 查 Receiver
↓
receiver.onAttackImpact(signal)
```

如果 Target 不存在：

第一版：

```text
console.warn
```

不要 throw。

原因：

未来可能发生：

```text
攻击动画命中帧出现前
Target 已经死亡 / 消失
```

这属于合法竞态。

例如：

```ts
console.warn(
    `[CombatEventHub] no receiver for target=${signal.targetId}`
);
```

---

# 11. MainMapController 成为 Combat Composition Root

新增：

```ts
private combatEventHub:
    CombatEventHub | null = null;
```

Bootstrap 中：

```ts
const combatEventHub =
    new CombatEventHub();

this.combatEventHub =
    combatEventHub;
```

然后同时注入：

```text
WorldObjectRenderer
SquadRenderer
```

形成：

```text
MainMapController
      │
      ├──────── CombatEventHub ────────┐
      │                                │
WorldObjectRenderer              SquadRenderer
      │                                │
Receivers                    Attack Producers
```

---

# 12. MainMapController 新增 Material Inspector

新增：

```ts
@property(Material)
public hitFlashMaterial:
    Material | null = null;
```

Bootstrap：

```ts
const hitFlashMaterial =
    this.requireInspectorMaterial(
        this.hitFlashMaterial,
        'hitFlashMaterial',
    );
```

建议新增 helper：

```ts
private requireInspectorMaterial(
    material: Material | null,
    propertyName: string,
): Material {
    if (!material) {
        throw new Error(
            `[MainMapController] ${propertyName} must be assigned in Inspector.`
        );
    }

    return material;
}
```

不要通过 UUID 硬编码 Material。

---

# 13. WorldObjectRenderer 构造函数扩展

当前：

```ts
new WorldObjectRenderer(
    structureRoot,
    resourceRoot,
    buildingTexture,
    natureTexture,
);
```

改为：

```ts
new WorldObjectRenderer(
    structureRoot,
    resourceRoot,
    buildingTexture,
    natureTexture,
    combatEventHub,
    hitFlashMaterial,
);
```

保存：

```text
CombatEventHub
Base Hit Flash Material
```

---

# 14. Resource Runtime Node

Resource 创建后从：

```text
Resource_food_01
├── Sprite
└── WorldObjectView
```

升级为：

```text
Resource_food_01
├── Sprite
├── WorldObjectView
├── WorldObjectAttackReceiver
└── HitFlashView
```

不新增额外视觉 Node。

---

# 15. Base 当前不接 Attack Receiver

当前只对：

```text
WorldObjectKind.Resource
```

添加：

```text
WorldObjectAttackReceiver
HitFlashView
```

Base 不接。

以后建筑战斗需要时再扩展。

---

# 16. WorldObjectAttackReceiver.ts

职责只做：

```text
AttackImpactSignal
↓
Resource 业务入口
↓
当前触发 HitFlash
```

第一版接口：

```ts
export interface WorldObjectAttackReceiverConfig {
    objectId: string;
    combatEventHub: CombatEventHub;
    hitFlashView: HitFlashView;
}
```

---

# 17. setup()

```ts
public setup(
    config: WorldObjectAttackReceiverConfig
): void {
    this.objectId = config.objectId;
    this.combatEventHub =
        config.combatEventHub;
    this.hitFlashView =
        config.hitFlashView;

    this.combatEventHub.registerReceiver(
        this.objectId,
        this,
    );
}
```

---

# 18. onAttackImpact()

当前：

```ts
public onAttackImpact(
    signal: AttackImpactSignal
): void {
    this.hitFlashView?.flash();

    console.log(
        `[AttackImpact] attacker=${signal.attackerId} target=${signal.targetId}`
    );
}
```

日志后续可以降级或移除。

---

# 19. 生命周期清理

Receiver 必须支持：

```ts
public dispose(): void
```

或在销毁时：

```ts
onDestroy()
```

执行：

```ts
combatEventHub.unregisterReceiver(
    objectId,
    this,
);
```

不要留下旧 receiver。

如果 `WorldObjectRenderer.clear()` 会重新渲染节点，必须确保旧 Receiver 被注销。

---

# 20. WorldObjectRenderer.clear()

Review 当前清理方式。

如果当前只是：

```ts
root.removeAllChildren()
```

而 Node 没有 destroy，则 Receiver 有可能继续留在 Hub。

本轮必须保证：

```text
旧 WorldObject Node
→ destroy / dispose
→ unregister receiver
```

推荐 Renderer 清理时：

```text
显式 destroy 旧动态 WorldObject Node
```

或：

```text
先 receiver.dispose()
再 remove
```

不能只依赖 Map 覆盖。

---

# 21. HitFlashView.ts

职责：

```text
只控制视觉闪白
```

不允许知道：

```text
attackerId
targetId
damage
resourceType
HP
```

Setup：

```ts
export interface HitFlashViewConfig {
    sprite: Sprite;
    baseMaterial: Material;
}
```

---

# 22. 每个 Target 必须拥有独立 Material Instance

这是本轮的重要约束。

禁止：

```text
所有 Resource 共用同一个可写 Material Instance
```

否则：

```text
砍 food_01
↓
wood / stone / food 全部同时闪白
```

`HitFlashView.setup()` 必须基于：

```text
baseMaterial
```

为该 Sprite 创建：

```text
独立 Material Instance
```

然后只修改自己的：

```text
flashAmount
```

---

# 23. Material Instance 应用原则

使用 Cocos Creator 3.8.8 当前支持的：

```text
MaterialInstance / renderer material instance
```

接口实现。

要求：

```text
Base Material 共享
Material Instance 每 Sprite 独立
```

不要：

```ts
baseMaterial.setProperty(
    'flashAmount',
    ...
);
```

直接改共享 Material。

---

# 24. Hit Flash 参数

固定：

```ts
FLASH_HOLD_SECONDS = 0.06;
FLASH_FADE_SECONDS = 0.08;
```

总反馈：

```text
约 0.14 sec
```

---

# 25. HitFlashView.flash()

收到命中：

```text
flashAmount = 1
elapsed = 0
active = true
```

如果当前已经在闪：

```text
重新从 1 开始
```

不要：

```text
排队
叠加 Tween
生成多个 Timer
```

连续多人命中：

```text
Hit
↓
restart
↓
Hit
↓
restart
```

---

# 26. HitFlashView update

建议不用 Tween。

使用内部时间状态：

```text
0 ~ 0.06
flashAmount = 1

0.06 ~ 0.14
flashAmount:
1 → 0

> 0.14
flashAmount = 0
active = false
```

伪代码：

```ts
update(dt: number): void {
    if (!this.flashing) {
        return;
    }

    this.elapsed += dt;

    if (
        this.elapsed
        <= FLASH_HOLD_SECONDS
    ) {
        this.setFlashAmount(1);
        return;
    }

    const fadeElapsed =
        this.elapsed
        - FLASH_HOLD_SECONDS;

    const t = Math.min(
        fadeElapsed
        / FLASH_FADE_SECONDS,
        1,
    );

    this.setFlashAmount(
        1 - t
    );

    if (t >= 1) {
        this.flashing = false;
    }
}
```

---

# 27. onDisable / onDestroy

必须恢复：

```text
flashAmount = 0
```

避免 Node 重用 / 状态残留。

---

# 28. hit-flash.effect

Agent 创建：

```text
assets/effects/hit-flash.effect
```

不要从零重写一套不兼容的 Sprite Shader。

应基于 Cocos Creator 3.8.8 的普通 2D Sprite Effect 结构：

```text
保留：
Sprite Texture Sampling
Alpha
Vertex Color
Blend State
UI Rendering 兼容

只新增：
flashAmount property
最终 RGB 混白逻辑
```

核心 fragment 语义：

```glsl
finalColor.rgb = mix(
    finalColor.rgb,
    vec3(1.0),
    flashAmount
);
```

Alpha：

```text
保持原 Sprite Alpha
```

---

# 29. Effect Property

暴露：

```text
flashAmount
```

范围语义：

```text
0 = 原图
1 = 完全白
```

Material 默认：

```text
0
```

---

# 30. 不使用 Sprite.color 实现白闪

禁止仅使用：

```ts
sprite.color = Color.WHITE;
```

原因：

```text
Sprite 默认 Tint 是乘法颜色
White × 原 Texture
≈ 原颜色
```

无法得到可靠的“全白受击”效果。

---

# 31. WarriorAnimator 增加 Impact Callback

当前 Animator 负责：

```text
Idle
Walk
Attack
```

新增：

```ts
private attackImpactHandler:
    (() => void) | null = null;
```

接口：

```ts
public bindAttackImpactHandler(
    handler: (() => void) | null,
): void {
    this.attackImpactHandler =
        handler;
}
```

Animator 不接：

```text
targetId
attackerId
CombatEventHub
```

---

# 32. Attack Impact 精确触发规则

Attack 两帧：

```text
displayPhase = 0
→ Idle Pose

displayPhase = 1
→ Attack Pose
```

只有从：

```text
非 Attack Pose
→
Attack Pose
```

时触发一次：

```ts
attackImpactHandler?.();
```

---

# 33. 禁止逐帧触发

错误：

```ts
if (
    displayPhase === 1
) {
    attackImpactHandler?.();
}
```

如果放在每帧 update 逻辑中会造成：

```text
一个 Attack Pose
→ 多次 Impact
```

必须使用“Pose Entered”边沿触发。

---

# 34. Animator 增加命中边沿状态

建议：

```ts
private attackPoseVisible = false;
```

应用 Attack Frame 时：

```ts
const nextAttackPoseVisible =
    displayPhase === 1;

if (
    nextAttackPoseVisible
    && !this.attackPoseVisible
) {
    this.attackImpactHandler?.();
}

this.attackPoseVisible =
    nextAttackPoseVisible;
```

离开 Attack：

```text
playIdle
playWalk
```

都重置：

```ts
this.attackPoseVisible = false;
```

---

# 35. playAttack() 重复调用

如果：

```text
当前已经处于 Attack
且方向没变
```

不要每次调用都重新制造一次命中。

推荐：

```text
保持现有循环
不重置 Impact 边沿
```

当前 EngagementController 正常情况下只在到 Slot 时调用一次，但这里必须防御未来重复调用。

---

# 36. attackPhaseOffset

当前不同 Warrior 有：

```text
attackPhaseOffset
```

所以部分 Warrior 进入 Attack 状态时可能：

```text
第一帧就是 Attack Pose
```

这是合法的。

如果首次显示就是 Attack Pose：

```text
立即产生一次 AttackImpact
```

符合视觉：

```text
刀已经落下
→ Target 立即反馈
```

---

# 37. SquadEngagementController 注入 CombatEventHub

Config 增加：

```ts
combatEventHub:
    CombatEventHub;
```

保存：

```ts
private combatEventHub:
    CombatEventHub | null = null;
```

---

# 38. SquadRenderer 注入 CombatEventHub

构造函数扩展：

```ts
constructor(
    squadRoot,
    warriorTexture,
    warriorAttackTexture,
    navigationGrid,
    navigator,
    combatEventHub,
)
```

然后创建：

```text
SquadEngagementController
```

时注入同一个 Hub。

---

# 39. Animator Callback 在哪里绑定

推荐在：

```text
SquadEngagementController.setup()
```

按照 warrior index 一次性绑定：

```ts
for (
    let i = 0;
    i < this.warriorAnimators.length;
    i += 1
) {
    const index = i;

    this.warriorAnimators[i]
        .bindAttackImpactHandler(
            () => {
                this.onWarriorAttackImpact(
                    index
                );
            }
        );
}
```

不要每次 `beginInteraction()` 反复 bind。

---

# 40. onWarriorAttackImpact()

职责：

```text
动画说：
Warrior N 当前打到命中帧

Controller 判断：
Warrior N 当前是否真的处于 attacking assignment

如果是：
生成 AttackImpactSignal
```

---

# 41. 防御条件

必须检查：

```text
currentTarget != null
assignment 存在
assignment.state === 'attacking'
```

如果不满足：

```text
直接 return
```

例如：

```text
Attack 动画最后一帧
↓
玩家已经取消目标
↓
旧 callback 晚到
```

不能继续攻击旧 Target。

---

# 42. attackerId

第一版统一：

```text
${squadId}/warrior_${warriorIndex}
```

例如：

```text
initial_01/warrior_2
```

不要使用 Node path 作为正式 ID。

---

# 43. Target ID

使用：

```ts
this.currentTarget.id
```

例如：

```text
wood_01
stone_01
food_01
```

---

# 44. emit

```ts
this.combatEventHub.emitAttackImpact({
    attackerId:
        `${this.squadId}/warrior_${warriorIndex}`,

    targetId:
        this.currentTarget.id,
});
```

---

# 45. Target 与 Attack Animation 解耦

Animator 不应该出现：

```ts
playAttack(
    direction,
    targetId
)
```

保持：

```ts
playAttack(
    direction
)
```

Target 信息继续属于：

```text
Engagement / Combat
```

而不是动画。

---

# 46. 当前 Resource 的完整运行链

```text
Warrior_2
到达 Right Slot
↓
SquadEngagementController
assignment.state = attacking
↓
WarriorAnimator.playAttack(Left)
↓
Idle Pose
↓
Attack Pose
↓
attackImpactHandler()
↓
SquadEngagementController
onWarriorAttackImpact(2)
↓
AttackImpactSignal
{
  attackerId:
  initial_01/warrior_2,

  targetId:
  wood_01
}
↓
CombatEventHub
↓
WorldObjectAttackReceiver(wood_01)
↓
HitFlashView.flash()
↓
wood_01 变白
↓
恢复
```

---

# 47. 多 Warrior 同时攻击

例如：

```text
W0 → wood
W1 → wood
W2 → wood
W3 → wood
```

每个 Animator 独立产生 Impact。

因此可能：

```text
t=0.00 W0 hit
t=0.05 W2 hit
t=0.15 W1 hit
t=0.20 W3 hit
```

Resource：

```text
每次 hit 都 restart flash
```

不要合并成：

```text
Squad 每 0.3 秒只 hit 一次
```

这对未来单体战斗非常重要。

---

# 48. 与资源采集的关系

当前 AttackImpact：

```text
只触发视觉
```

以后资源系统可以在：

```text
WorldObjectAttackReceiver
```

或独立的：

```text
ResourceHarvestReceiver
```

中消费同一个信号：

```text
AttackImpact
↓
Harvest Power
↓
Resource Amount
```

本轮不实现。

---

# 49. 与未来怪物战斗的关系

未来 Monster Node：

```text
Monster_xxx
├── MonsterCombatAgent
├── Health
├── MonsterAttackReceiver
└── HitFlashView
```

注册：

```text
targetId = monster_xxx
```

Warrior 攻击怪物时仍然：

```text
WarriorAnimator
↓
AttackImpactSignal
↓
CombatEventHub
```

攻击端不变。

---

# 50. 未来 Damage 计算推荐扩展路径

本轮：

```text
AttackImpact
↓
Feedback
```

未来：

```text
AttackImpact
↓
CombatResolver
↓
DamageResult
↓
Target Health
↓
Hit Feedback
```

因此不要把：

```text
damage = 1
```

现在硬编码到 `WarriorAnimator`。

---

# 51. Debug 日志

本轮建议保留：

```text
[AttackImpact]
```

格式：

```text
[AttackImpact] attacker=initial_01/warrior_0 target=wood_01
```

Hit Flash：

```text
默认不逐次额外打印
```

否则四 Warrior 会产生大量重复日志。

---

# 52. 推荐开发顺序

## Step 1

实现：

```text
CombatTypes
CombatEventHub
```

写最小单元式测试 / 临时日志验证：

```text
register
emit
unregister
```

---

## Step 2

改：

```text
WarriorAnimator
```

实现：

```text
Attack Pose Entered
→ callback
```

先只：

```text
console.log
```

验证一次攻击循环只有一次 Impact。

---

## Step 3

改：

```text
SquadEngagementController
```

完成：

```text
Warrior index
+
currentTarget
↓
AttackImpactSignal
```

---

## Step 4

实现：

```text
WorldObjectAttackReceiver
```

先收到事件打印：

```text
target hit
```

---

## Step 5

实现：

```text
hit-flash.effect
HitFlashView
```

确认单个 Resource 正确闪白。

---

## Step 6

改：

```text
WorldObjectRenderer
MainMapController
SquadRenderer
```

完成 Composition Root 注入。

---

# 53. 禁止实现

本轮禁止：

```text
WarriorAnimator 直接寻找 Target Node
WarriorAnimator 直接调用 Resource
CombatEventHub 做全局 static singleton
使用 director.emit 作为 Combat 总线
资源 Receiver 写进 SquadEngagementController
Sprite.color 假装白闪
所有 Resource 共享一个可写 Material Instance
Attack Pose 停留期间每帧 emit
setInterval 模拟攻击伤害
Tween 无限叠加
资源 HP
怪物系统
Damage 数值系统
```

---

# 54. 用户验收用例

### Case 1：单 Warrior 先到

```text
一个 Warrior 已经接触 Resource
其余还在移动
```

预期：

```text
只有到达者进入 Attack
只有其 Attack Pose 会触发闪白
```

---

### Case 2：4 Warrior 攻击同一资源

预期：

```text
不同相位的 Attack Pose
→ 分别触发闪白
```

---

### Case 3：切换目标

```text
wood 正在被攻击
↓
玩家点击 stone
```

预期：

```text
Reform
↓
旧 Attack Callback 不再作用到 wood
↓
到 stone 后
↓
stone 开始响应 Impact
```

---

### Case 4：取消返家

预期：

```text
取消后
Resource 不再继续收到旧 AttackImpact
```

---

### Case 5：连续命中

预期：

```text
资源闪白可以被新 hit 重启
没有永远变白
没有 Material 状态污染
```

---

# 55. Definition of Done

- [ ] 新增 `CombatTypes.ts`
- [ ] 新增 `CombatEventHub.ts`
- [ ] 新增 `WorldObjectAttackReceiver.ts`
- [ ] 新增 `HitFlashView.ts`
- [ ] 新增 `hit-flash.effect`
- [ ] MainMapController 新增 Hit Flash Material Inspector
- [ ] CombatEventHub 由 MainMapController 创建
- [ ] 同一个 Hub 注入 Squad 和 WorldObject 两侧
- [ ] WarriorAnimator 只在 Attack Pose Entered 时产生 callback
- [ ] 一个攻击循环只产生一次 AttackImpact
- [ ] Attack Pose Offset 不会重复 emit
- [ ] SquadEngagementController 生成 attackerId / targetId
- [ ] 取消后旧攻击不会继续命中 Target
- [ ] Resource 注册 Receiver
- [ ] Resource 销毁 / 清理时 unregister
- [ ] 每个 Resource 使用独立 Material Instance
- [ ] 命中时资源闪白
- [ ] 约 0.14 秒恢复正常
- [ ] 连续命中重新开始 Flash
- [ ] 不使用 Sprite.color 伪造白闪
- [ ] 不加入 Damage / HP
- [ ] Console 无 Error

---

# 56. Agent 完成后必须回报

```text
1. 新增 / 修改文件清单

2. 最终 commit SHA

3. AttackImpactSignal 定义

4. CombatEventHub 完整 API

5. WarriorAnimator Attack Pose Entered 实现

6. SquadEngagementController
   onWarriorAttackImpact 实现

7. WorldObjectAttackReceiver 注册 / 注销逻辑

8. HitFlashView Material Instance 创建方式

9. hit-flash.effect 的 flashAmount 实现

10. MainMapController 新 Inspector 字段

11. wood_01 连续攻击 Console 日志

12. food_01 闪白截图

13. stone_01 闪白截图

14. 四 Warrior 攻击同一资源的运行录屏 / 截图

15. 切换目标后旧 Target 不再收到 Impact 的日志

16. Console 无 Error
```

---

# 57. 最终长期结构

```text
                    ATTACKER
                       │
                 WarriorAnimator
                       │
              Attack Pose Entered
                       │
                       ▼
          SquadEngagementController
                       │
              AttackImpactSignal
                       │
                       ▼
                CombatEventHub
                       │
          ┌────────────┼────────────┐
          │            │            │
          ▼            ▼            ▼
      Resource      Monster       Building
      Receiver      Receiver      Receiver
          │            │            │
          ▼            ▼            ▼
      HitFlash      Health +      Future
                    Feedback
```

本轮最终原则：

> **动画只报告命中时刻。**

> **战斗层决定攻击者和目标。**

> **Event Hub 负责路由。**

> **目标自己决定收到 AttackImpact 后发生什么。**

> **视觉反馈与战斗数值分离。**
