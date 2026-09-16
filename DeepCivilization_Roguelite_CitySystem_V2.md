# 《深处的文明》文明建造 × Roguelite 系统方案 V2

> 目标：把“随机蓝图建筑、模拟经营、资源产业链、多小队战争、Floor 随机事件、文明时代演进”整合成一套统一玩法系统。  
> 核心体验：玩家不是在单纯抽建筑，而是在随机蓝图条件下建立一套不断演化的文明经济网络，并用它去解决越来越复杂的地下环境、灾害与战争问题。
游戏最核心的爽感来自玩家通过战士、技能、建筑、研究、被动、文明等级和资源效率之间的组合，找到多个数值乘区，使整个文明从“勉强运转”逐渐进入“体系成型”。
强化部队时，对于地图上的问号事件，选一支部队与其交互，提供多选资源（风暴之城模式），获得对这个部队的强化。

---

# 1. 核心设计目标

整局体验分为四个阶段：

```text
前期：生存
↓
中期：成型
↓
后期：工业化
↓
终局：文明力量兑现
```

玩家的成长不应只表现为：

```text
攻击 +20%
生命 +30%
```

而应该表现为：

```text
资源种类增加
↓
产业链复杂化
↓
军队规模扩大
↓
城市功能分化
↓
对地下世界的认知增强
↓
开始利用环境，而不只是被动承受环境
```

最终希望玩家产生这样的感觉：

> “这一局，我真的建立起了一套属于自己的文明。”

---

# 2. 整局核心循环

```text
进入 Floor
    ↓
探索 / 战斗 / 获取基础资源
    ↓
Source 建筑扩大资源获取与转化
    ↓
形成更高级资源
    ↓
Sink 建筑把资源转化成永久 / 临时实力
    ↓
Defense 建筑增强基地与环境应对能力
    ↓
随机 Floor / Hazard / Infection 检验当前文明
    ↓
玩家调整建设方向
    ↓
进入下一时代
    ↓
新的资源、新的建筑、新的挑战
```

三个核心建筑角色：

```text
Source
“资源从哪里来？”

Sink
“资源拿来干什么？”

Defense
“文明如何活下来并利用环境？”
```

---

# 3. 建筑角色体系

## 3.1 Source —— 经济来源与资源转化

Source 的任务是：

```text
增加资源获取
+
提升资源转化效率
+
把低阶资源升级成高阶资源
```

典型例子：

```text
Lumber Camp
→ 每过一层获得 Wood

Quarry
→ 每过一层获得 Stone

Refinery
→ Wood + Stone
→ Processed Material

Foundry
→ Ore + Fuel
→ Steel

Arcane Converter
→ Gold + Knowledge
→ Arcane Component
```

Source 不直接成为最终 Win Condition。

Source 的价值在于：

> 提高整个文明的经济吞吐量。

---

## 3.2 Sink —— 把经济转成实力

Sink 是整套系统里最重要的“价值落点”。

它负责：

```text
消耗资源
→ 获得永久成长
或
→ 获得当前 Floor / 若干层的强力效果
```

典型例子：

```text
Barracks
每过一层：
消耗 Food
→ 当前 Squad 永久 +1 Warrior
```

```text
Blacksmith
建造时 / 每层：
消耗基础资源
→ 全军永久 +1 Attack
```

```text
Military Academy
消耗高级资源
→ Squad Attack Speed / Formation / Skill Upgrade
```

```text
Research Institute
消耗 Knowledge
→ 获得一次研究选择
```

原则：

```text
Source 创造资源
Sink 才真正把资源变成“赢游戏的能力”
```

---

## 3.3 Defense —— 基地防御与环境操控

Defense 不只是“减少伤害”。

更理想的定义是：

> **改变玩家与 Floor Hazard 的交互规则。**

典型：

```text
Wall
→ 拖延怪物
→ 给 Squad 调度争取时间

Tower
→ 自动削弱漏怪
→ 负责兜底，不取代 Squad

Lightning Rod
→ 雷暴层吸收雷击
→ 保护其它建筑
→ 雷击时产生 Electricity

Radar
→ 提前探测 Infection / 敌人方向 / 大致规模

Monster Processor
→ Infection 中杀死怪物后产生 Biomass
```

优秀 Defense 的目标：

```text
没有：
能扛，但比较难受

有：
明显舒服

Build 成型：
甚至可以把 Hazard 变成收益
```

---

# 4. 四时代资源结构

资源数量随时代增加：

```text
Era I   4 种
Era II  8 种
Era III 12 种
Era IV  16 种
```

但不是简单：

```text
4 → 8 → 12 → 16 个独立图标
```

而是形成层级产业链。

---

# 5. 资源演进原则

低阶资源后期不能失去意义。

其最终出口是：

> **作为高级资源的 Feedstock。**

例如：

```text
Wood
   ↓
Timber / Fuel
   ↓
Composite
```

```text
Stone
   ↓
Brick / Ore Processing
   ↓
Advanced Construction Material
```

```text
Gold
   ↓
Precision Component
   ↓
Arcane / Industrial Component
```

低阶资源后期角色发生变化：

```text
前期：
资源本身就是目标

中期：
资源开始进入生产链

后期：
资源成为高级产业的基础吞吐
```

因此玩家后期会开始思考：

> “为什么我的高级工业停了？”
>
> “因为基础原料供不上。”

---

# 6. 高级资源不能只是线性升级

避免：

```text
10 Wood → 1 Super Wood
```

这种单线升级。

中后期开始加入交叉配方：

```text
Wood + Stone
→ Reinforced Material

Ore + Fuel
→ Steel

Gold + Knowledge
→ Arcane Component

Food + Medicine
→ Military Supply
```

这样：

```text
资源网络
```

比：

```text
资源等级树
```

更有经营深度。

---

# 7. 建筑 Spam 的软性解决方案

本方案不使用：

```text
Blacksmith 最多 3 个
```

也不优先使用：

```text
每多一栋收益递减
```

而是通过：

> **时代升级 + 高阶资源 + 高阶建筑效率**

自然淘汰低阶 Spam。

例如：

```text
Era I Blacksmith
消耗：
Wood / Stone

效果：
+1 Attack
```

到了 Era III：

```text
Runic Forge
消耗：
Steel / Crystal

效果：
更高价值战力转化
```

于是：

```text
10 个低阶 Blacksmith
```

并不是禁止。

只是：

```text
占地更多
消耗更多低级资源
效率更低
```

相比：

```text
少量高级 Forge
```

自然不够划算。

玩家会主动升级城市，而不是被系统硬性限制。

---

# 8. 军队设计：扩大军队要花钱，拥有军队不收维护费

正式原则：

```text
获得更多单位
→ 有成本

已经获得单位
→ 不持续收维护费
```

原因：

> 游戏需要保留“我已经拥有一支大军”的 Power Fantasy。

因此不要设计：

```text
每层每个 Warrior 消耗 2 Food
```

这种长期税。

军队是玩家本局的永久资产。

---

# 9. 军队成长曲线

目标：

```text
Early
4~8 人
```

```text
Mid
12~24 人
```

```text
Late
30+ 人
```

最终可以出现：

```text
Squad 1 守北
Squad 2 守西
Squad 3 打 Elite
Squad 4 紧急支援

基地附近：
Wall
Tower
Artillery
```

敌方规模随之同步扩大。

目标不是抑制雪球。

而是：

> 让敌方场面规模追得上玩家的文明规模。

---

# 10. Roguelite 的正确雪球

允许：

```text
经济做得好
→ 军队更大
→ 打赢更危险目标
→ 拿到更多资源
→ 文明进一步变强
```

这是好雪球。

不需要刻意压制。

真正需要避免的是：

```text
一个低级建筑
→ 单独形成永久最优解
```

时代资源与高阶建筑体系会自然解决这个问题。

---

# 11. Blueprint 系统：保留本局永久解锁

Blueprint 仍然是：

```text
本局获得
→ 本局永久可建设
```

不改变这个核心。

但是随机方式改成：

> **Controlled Randomness**

而不是：

```text
random(allBlueprints)
```

---

# 12. Blueprint 基础标签

每个 Blueprint 至少拥有：

```text
Role
Source / Sink / Defense

Era
I / II / III / IV

Resource Domain
Food / Metal / Knowledge / Energy / Biomass ...

Tier
Early / Mid / Late

Requires
资源 / 建筑 / 时代 / 标签
```

后续可以附加：

```text
weight
rarity
floorAvailability
prerequisiteTags
```

---

# 13. Blueprint 受控随机

每次三选一，不建议完全同类。

推荐结构：

```text
A
Synergy Pick
强化当前经济链

B
Utility Pick
补当前文明短板

C
Wildcard
提供转型可能
```

例如玩家当前：

```text
Forge-heavy Build
```

三选一可能：

```text
A:
Advanced Foundry

B:
Emergency Food Storage

C:
Arcane Laboratory
```

系统帮助玩家形成 Build，但不锁死 Build。

---

# 14. Blueprint 阶段池

Blueprint Pool 随时代 / Floor 变化：

```text
Early
基础 Source
基础 Sink
少量 Defense
```

```text
Mid
资源转化
军队成长
基础 Hazard Defense
```

```text
Late
高级产业
大型战争 Sink
Environment Manipulation
Advanced Defense
```

避免：

```text
开局就抽到需要 Steel / Electricity 的建筑
```

这种无意义选项。

---

# 15. Floor Archetype

Floor 必须考验不同能力。

否则所有 Build 最后都会收敛成：

```text
DPS
```

基础类型：

```text
Normal
普通探索

Rich
高资源

Infested
多方向怪物进攻

Hazard
自然灾害

Ruins
知识 / 遗迹 / 特殊资源

Elite
高强度战斗

Civilization
特殊事件 / 高价值目标
```

---

# 16. Infection Floor

Infection 是多 Squad 战略玩法的重要舞台。

流程：

```text
Floor 开始
↓
多个 Monster Group
↓
从不同方向出现
↓
向 Base 接近
```

玩家：

```text
Squad 1
→ 北侧

Squad 2
→ 西侧

Squad 3
→ 南侧

Squad 4
→ 拦截 Elite
```

漏掉的怪物：

```text
Wall
Tower
Defense Network
```

负责兜底。

基地被摧毁：

```text
Run End
```

---

# 17. Defense 与 Squad 的关系

正式原则：

```text
Squad
= 主动解决问题

Defense
= 延迟、削弱、兜底
```

防御塔不能强到：

```text
玩家完全不用管
```

理想效果：

```text
没有防御：
需要完美调度

有防御：
允许犯错
有时间救场

Defense Build 成型：
可以处理大量杂兵
但关键威胁仍需 Squad
```

---

# 18. Hazard：雷暴

基础行为：

```text
Thunderstorm Floor
→ 随机 Lightning Strike
→ 对建筑造成伤害 / 短暂停产
```

没有 Lightning Rod：

```text
能扛
但不舒服
```

有 Lightning Rod：

```text
优先吸收雷击
↓
保护其它建筑
↓
产生 Electricity
```

于是：

```text
普通文明：
Thunderstorm = 风险

Electric Build：
Thunderstorm = 资源机会
```

这是理想的 Roguelite 环境互动。

---

# 19. Hazard 建筑设计原则

不要只做：

```text
Hazard -50%
```

更优先做：

```text
Hazard
→ 被引导
→ 被利用
→ 被转化成收益
```

例如：

```text
Lightning
→ Electricity

Infection
→ Biomass

Heat
→ Thermal Energy

Flood
→ Water
```

这样 Defense 也能成为 Build。

---

# 20. Hazard 不应成为强制税

不能：

```text
没有避雷针
→ Thunderstorm 直接毁城
```

除非已经提前明确预警。

基础原则：

```text
没有针对性 Defense
→ 更难，但能扛

有针对性 Defense
→ 明显舒服

有完整 Build
→ 甚至能获利
```

---

# 21. 情报系统：前期靠判断，中后期靠科技

前期：

```text
玩家看不到精确 Floor 情报
```

因为前期危险本身应该足够温和。

玩家靠：

```text
当前资源
军队状态
建筑结构
风险偏好
```

做正常判断就能生存。

---

# 22. Radar / Scanner 中后期出现

Radar 不是前期必需品。

它代表：

> 文明开始拥有预测地下世界的能力。

基础 Radar：

```text
下一层：
生命信号 HIGH
气象风险 LOW
资源信号 MEDIUM
```

中级 Radar：

```text
生命信号：
North-East HIGH
South LOW

Possible Infection
```

高级 Scanner：

```text
预计：
3~5 Monster Groups
可能包含 Elite
```

---

# 23. 信息也是文明成长

文明发展不只是：

```text
资源更高级
单位更多
建筑更强
```

还包括：

```text
知道更多
预测更准确
准备更充分
```

因此时代提升也意味着：

> 从“探索未知”走向“掌控地下环境”。

---

# 24. 四时代玩法结构

## Era I —— 生存文明

```text
4 Resources

重点：
基础 Source
基础 Sink
少量军队
靠 Squad 自己处理大部分问题

Hazard：
弱
即使没针对建筑也能扛
```

## Era II —— 产业文明

```text
8 Resources

重点：
资源转换
第二/第三支 Squad
基础 Defense
开始出现特殊 Floor
```

## Era III —— 工业文明

```text
12 Resources

重点：
复杂产业链
大量军队
Wall / Tower 网络
Radar
高级 Source / Sink
Hazard 开始可以被利用
```

## Era IV —— 高级文明

```text
16 Resources

重点：
高阶资源网络
超大规模战争
Advanced Scanner
Environment Manipulation
高阶 Defense
文明终局 Build
```

---

# 25. 难度曲线原则

```text
Early Game
考基础决策
不考特定答案
```

```text
Mid Game
特定建筑有明显优势
但不是必须
```

```text
Late Game
要求玩家已经形成成熟文明
但允许不同 Build 用不同方式解决问题
```

例如 Thunderstorm：

```text
Floor 2
偶尔劈几下
可承受

Floor 6
Lightning Rod 很舒服
但也能靠维修硬扛

Floor 10
Superstorm
完全没准备会非常痛
```

---

# 26. 后期 Power Fantasy 是目标，不是问题

成功 Run 后期应该允许玩家：

```text
雷暴来了
→ Lightning Network 吃掉雷
→ 反而大量发电

Infection 来了
→ 40+ Warrior 四处迎战

怪物漏进来
→ Wall + Tower 轰杀

敌人死亡
→ Biomass Processor 回收资源
```

玩家应该感觉：

> “我这个文明已经变成怪物了。”

Roguelite 不应该永远把玩家压在弱势。

理想节奏：

```text
前期
求生

中期
Build 成型

后期
力量兑现
```

---

# 27. 城市最终应该记录“这局发生过什么”

优秀 Run 结束时：

```text
城市形态
```

应该能讲故事。

例如：

```text
Era I
Food + Wood

Era II
工业化

Era III
抽到军事 Sink
大量扩军

Floor 7
Infection 打穿东侧
补了大量城墙

Floor 9
Thunderstorm
建立 Lightning Network
```

最终城市不是模板。

而是：

> 本局历史的结果。

---

# 28. 核心系统关系

```text
LOW TIER RESOURCE
       ↓
SOURCE
       ↓
RESOURCE CONVERSION
       ↓
HIGH TIER RESOURCE
       ↓
    ┌──┴──────────────┐
    ↓                 ↓
   SINK             DEFENSE
    ↓                 ↓
Army / Research    Hazard Control
Permanent Power    Base Safety
    ↓                 ↓
    └──────┬──────────┘
           ↓
        FLOOR
           ↓
   Exploration / War
           ↓
      More Resources
```

---

# 29. 设计红线

避免：

```text
1. 单个 Blueprint 自己就是完整 Build。
2. 低级资源后期完全废弃。
3. 军队有持续维护费，破坏大军 Power Fantasy。
4. Defense 只是“交保险费”。
5. Hazard 没对应建筑就直接判死刑。
6. Tower 完全取代 Squad。
7. Floor 永远只考 DPS。
8. Blueprint 完全随机。
9. 16 种资源同时都要求高频微操。
10. 高时代只是“同一种资源数字更大”。
```

---

# 30. 下一阶段 Prototype 优先级

第一阶段只需要验证：

```text
Source
→ 基础资源获取

Sink
→ Food 换永久 Warrior

Defense
→ Wall / Tower

Floor
→ Normal + Infection
```

如果这个闭环好玩，再加：

```text
资源转化
Era II
雷暴
Lightning Rod
Electricity
Radar
```

不要一开始就实现完整 16-resource economy。

---

# 31. 第一轮 Prototype 的成功标准

玩家完成一局后应该能清楚说出：

```text
“这局我是靠什么发展起来的？”

“为什么我后来变强？”

“我为什么在某个 Floor 差点死？”

“如果再来一次，我会换一种城市结构。”
```

如果玩家只能说：

```text
“我抽到了一个很强的建筑。”
```

说明 Roguelite 仍然太浅。

如果玩家能说：

```text
“前期靠 Food Source 滚经济，
中期转 Steel，
然后把资源全灌进军队，
后来 Infection 打得很惨，
所以补了 Wall 和 Tower，
最后雷暴反而被我的 Lightning Network 变成能源。”
```

那就是这套系统真正成立了。

---

# 32. 一句话定位

> **玩家在不断下潜的过程中，用随机获得的蓝图建立一套不断升级的资源产业链，把经济转化成庞大的军队与城市能力，并逐渐从“承受地下世界”成长到“利用地下世界”。**
