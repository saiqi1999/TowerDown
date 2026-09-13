# TowerDown / 《深处的文明》原型

这是《深处的文明》的当前 Cocos Creator 原型工程。当前仓库重点不是完整玩法，而是在搭建后续可以持续扩展的基础架构：**地图、世界对象、小队指挥、寻路、单兵局部行动、攻击命中事件和受击反馈**。

当前使用 **Cocos Creator 3.8.8 + TypeScript**。

> 当前核心设计原则：玩家操作的是 **Squad（小队）**，Warrior（士兵）只负责小队内部的局部执行；跨地图移动与局部战斗/交互分层；攻击者与被攻击者通过事件解耦，而不是互相直接引用。

---

## 1. 当前已经实现的运行链路

当前原型已经可以完成：

```text
静态地图数据
↓
地图 Tile 渲染
↓
Base / Resource 世界对象渲染
↓
生成 Squad + 4 Warrior
↓
点击 Resource
↓
WorldCommandController 下达目标
↓
WorldNavigator + A* 找到资源附近 Approach Cell
↓
SquadMotor 整队移动
↓
SquadEngagementController 开始局部交互
↓
InteractionSlotResolver 在资源轮廓周围生成 Slot
↓
WarriorMotor 分别移动士兵到各自 Slot
↓
WarriorAnimator 播放四方向攻击动画
↓
攻击 Pose 出现时产生 AttackImpact
↓
CombatEventHub 根据 targetId 路由事件
↓
WorldObjectAttackReceiver 收到命中
↓
HitFlashView 让资源闪白
```

这条链路以后可以自然扩展成：

```text
Warrior → Monster
Monster → Warrior
Tower → Monster
Skill → MonsterGroup
```

而不需要重新设计命中事件系统。

---

## 2. Scene 层级

当前主场景是：

```text
Main
└── Canvas
    ├── Camera
    └── MapRoot
        ├── TileRoot
        ├── WorldObjectRoot
        │   ├── StructureRoot
        │   └── ResourceRoot
        ├── ActorRoot
        │   └── SquadRoot
        └── CommandRoot
```

### 为什么要这样分层

- `TileRoot`：只放地图地块，避免和动态实体混在一起。
- `WorldObjectRoot`：承载基地、资源、以后建筑等世界对象。
- `StructureRoot`：基地/建筑类对象。
- `ResourceRoot`：资源对象。
- `ActorRoot`：可行动单位。
- `SquadRoot`：当前小队实例。
- `CommandRoot`：旗帜等命令反馈，保持在独立视觉层。

这样做的目的不是为了 Scene Tree 看起来整齐，而是为了让 **渲染层、逻辑层、命令层以后可以独立扩展和清理**。

---

## 3. 最重要的架构边界

### 3.1 Squad 与 Warrior 分层

```text
Squad
├── SquadBrain
├── SquadMotor
├── SquadEngagementController
│
├── Warrior_0
│   ├── WarriorMotor
│   └── WarriorAnimator
├── Warrior_1
├── Warrior_2
└── Warrior_3
```

- `SquadBrain` 决定小队现在要做什么。
- `SquadMotor` 负责整队跨地图移动。
- `SquadEngagementController` 负责到达目标附近之后，小队成员如何展开和交互。
- `WarriorMotor` 只负责单个 Warrior 的局部移动。
- `WarriorAnimator` 只负责动画。

因此不要让 `WarriorAnimator` 直接寻找目标，也不要让单个 Warrior 自己跑全地图 A*。

### 3.2 世界对象仍然是整体实体

资源、基地、以后建筑仍然是一个 `WorldObject`，不会因为资源占 2×2 格就拆成四个实体。

当前原则：

```text
视觉 footprint
=
逻辑 footprint
=
导航阻挡 footprint
```

### 3.3 AttackImpact 是通用战斗信号

```text
动画命中时刻
↓
AttackImpactSignal
↓
CombatEventHub
↓
目标 Receiver
```

`WarriorAnimator` 不知道目标是树还是怪物；`CombatEventHub` 也不处理伤害，它只负责路由。

---

# 4. 项目目录说明

下面说明当前重要目录和文件为什么存在。

> Cocos Creator 会为几乎所有资源生成对应 `.meta` 文件。`.meta` 保存 UUID、导入参数和资源引用信息，**不是游戏逻辑文件，但必须和对应资源一起提交**。因此下文不逐个重复解释每一个 `.meta`。

---

## 4.1 根目录

| 文件 / 目录 | 为什么存在 |
|---|---|
| `README.md` | 当前工程结构、职责边界和扩展规则的总入口。 |
| `package.json` | Cocos 项目标识和 Creator 版本信息；当前版本为 3.8.8。 |
| `tsconfig.json` | TypeScript 编译配置。 |
| `.gitignore` | 排除不应进入 Git 的构建缓存、临时文件等。 |
| `.creator/` | Cocos Creator 编辑器级项目辅助配置和脚本模板，不属于游戏运行逻辑。 |
| `settings/` | Cocos Creator 项目设置，例如项目、构建、编辑器相关配置。 |
| `assets/` | 真正会被 Cocos Asset Database 管理的场景、代码、美术、Effect、Material。 |
| `instructions/` | 各阶段技术方案和实现说明，供开发/Agent 执行与回溯。 |
| `docs/` | 辅助开发文档，目前主要用于工具/工作流文档，不属于运行时。 |
| `deprecated/` | 已废弃但保留做历史参考的设计文件。 |
| `test/` | 美术/Tile 等实验性内容，不属于当前正式运行链路。 |
| `深处的文明_GDD_v0.3.md` | 当前游戏设计文档，描述游戏目标与玩法方向。 |
| `.DS_Store` | macOS Finder 自动产生的文件，对项目没有作用；理想情况下应从仓库删除并加入 `.gitignore`。 |

`deprecated/深处的文明_GDD_v0.2.md` 是旧版 GDD，只用于设计演变回溯，不应作为当前实现依据。

`instructions/` 中目前保存了地图、WorldObject、Squad Phase 1/2、四方向攻击、Interaction Slot、节点树日志和 AttackImpact/HitFlash 等阶段技术方案。这些文件解释“某个系统当时为什么这样做”，而 `README.md` 负责描述“现在系统最终是什么样”。

---

# 5. `assets/` 运行资源

## `assets/Main.scene`

当前唯一主场景。

为什么存在：它只保存**稳定的场景骨架和 Inspector 引用**，大量 Tile、资源、Squad、Warrior 等内容由代码运行时生成，而不是手工把所有节点摆进 Scene。

这样可以避免：

```text
数据变化
→ 手工改 Scene
→ Scene 与逻辑数据不同步
```

---

# 6. 美术资源 `assets/art/`

## `assets/art/terrain/terrain.png`

当前地图 Tile 使用的地形图集。

为什么单独放：地图渲染系统只需要知道地形 SpriteFrame，不应该依赖原始完整素材目录。

## `assets/art/world/atlas_buildings.png`

建筑/基地 Sprite Atlas。

当前 `BaseOrange` 从这里裁切。

## `assets/art/world/atlas_nature.png`

自然资源 Sprite Atlas。

当前 Tree、Stone、Food 等 WorldObject 从这里裁切。

## `assets/art/units/warrior_sword.png`

剑士行走 Sprite Sheet。

当前语义：

```text
4 columns = Down / Up / Left / Right
4 rows    = Walk Frames
```

## `assets/art/units/warrior_sword_attack.png`

剑士攻击方向 Pose。

当前语义：

```text
4 columns = Down / Up / Left / Right
```

它不是四帧时间动画。攻击动画由“站姿 Pose ↔ Attack Pose”循环组成。

## `assets/art/command/target_flag.png`

Squad 当前命令目标的旗帜视觉。

它属于命令反馈，而不是 WorldObject 或 Warrior 本身，所以单独放在 `command/`。

## `assets/art/source/`

目前保存原始 Tileset：

- `TilesetFloor.png`
- `TilesetHouse.png`
- `TilesetNature.png`
- `TilesetTowers.png`

为什么保留：这是源素材/参考素材，便于以后重新裁切或扩充 Atlas。当前运行逻辑优先读取整理后的 `terrain/`、`world/`、`units/` 等目录，而不是直接耦合这些源文件。

---

# 7. Effect 与 Material

## `assets/effects/hit-flash.effect`

2D Sprite 受击闪白 Shader。

为什么单独做 Effect：`Sprite.color = WHITE` 不能可靠地产生纯白受击效果，所以通过 Shader 的 `flashAmount` 在原纹理和白色之间插值。

核心语义：

```text
flashAmount = 0 → 原图
flashAmount = 1 → 白色
```

## `assets/material/hit-flash.mtl`

`hit-flash.effect` 的可配置 Material 资产。

为什么 Effect 和 Material 要分开：

- Effect 定义“怎么画”。
- Material 定义“使用哪个 Effect、参数默认值是多少”。
- Runtime 再为每个目标创建独立 Material Instance，防止一个资源闪白导致所有资源一起闪白。

---

# 8. 脚本总览 `assets/scripts/`

脚本按“职责”而不是按“场景节点”分类：

```text
scripts/
├── combat/      # 战斗事件协议与路由
├── command/     # 玩家命令与旗帜反馈
├── debug/       # Debug-only 工具
├── feedback/    # 纯视觉反馈
├── grid/        # Grid ↔ World 坐标基础设施
├── map/         # 地图数据、解析、渲染、Bootstrap
├── navigation/  # 可行走网格与寻路
├── squad/       # Squad / Warrior 行为
└── world/       # 世界对象数据、渲染、交互
```

---

# 9. `scripts/grid/`

## `GridConfig.ts`

保存全项目共享的 Grid 尺寸常量，例如：

```text
GRID_SOURCE_SIZE = 16
GRID_RENDER_SCALE = 2
GRID_RENDER_SIZE = 32
```

为什么必须集中：如果 Tile、WorldObject、Warrior 分别维护自己的格子尺寸，坐标系统迟早会漂移。

## `GridTransform.ts`

统一负责 Grid 坐标和 Cocos 世界/局部坐标之间的转换。

为什么存在：项目逻辑使用 `GridPoint`，Cocos 渲染使用像素坐标，并且 Grid Y 与 Cocos Local Y 的方向不同。所有转换必须集中，禁止业务文件自己到处写 `* GRID_RENDER_SIZE` 和 Y 轴取反。

---

# 10. `scripts/map/`

## `MainMapController.ts`

当前整个运行时的 **Composition Root / Bootstrap**。

它负责：

- 找到 Scene 中稳定的 Root 节点；
- 加载/校验纹理和 Material；
- 创建 `CombatEventHub`；
- 创建 Map、WorldObject、Navigation、Squad 系统；
- 把依赖注入到各系统；
- 最后初始化 `WorldCommandController`。

为什么必须有一个 Composition Root：避免 `CombatEventHub`、Navigator 等系统退化成全局 Singleton，也让依赖来源始终清楚。

## `MapTypes.ts`

地图层共享类型定义。

为什么独立：数据结构不应该定义在 Renderer 或 Resolver 内部，否则地图数据生产方会反向依赖表现层。

## `StaticMap.ts`

当前 Prototype 的静态地图数据。

为什么存在：地图内容与地图渲染算法分离。以后可以把数据来源替换成随机生成、关卡文件或服务器数据，而 `MapRenderer` 不需要重写。

## `MapResolver.ts`

根据周围 Tile 邻接关系，把逻辑 Terrain 转换成正确的地形 Tile 变体。

为什么独立：Terrain 规则属于“数据解析”，不属于 Node 创建。

## `MapRenderer.ts`

把解析后的地图数据生成 Tile Node / Sprite。

为什么独立：只负责“把地图画出来”，不参与寻路、不处理世界对象、不处理玩家命令。

## `TerrainAtlas.ts`

集中维护地形 Atlas / SpriteFrame 的裁切或资源引用规则。

为什么存在：素材坐标和 UUID 属于 Asset Mapping，不应该散落在地图逻辑中。

---

# 11. `scripts/world/`

## `WorldObjectTypes.ts`

定义 WorldObject 的基础数据类型、Kind、VisualId、ResourceType 等。

为什么存在：WorldObject 的“身份和数据协议”必须独立于 Renderer 和 View。

## `StaticWorldObjects.ts`

当前静态世界对象实例数据：Base、Wood、Stone、Food 等的位置和 visualId。

为什么存在：对象数据与场景节点分离，后续可以换成程序生成的数据源。

## `WorldAtlasConfig.ts`

定义 `WorldVisualId → Atlas Rect + footprint` 的映射。

例如：

```text
TreeGreen  → Nature Atlas + 2×2
StoneGray  → Nature Atlas + 2×2
FoodPlant  → Nature Atlas + 1×1
BaseOrange → Building Atlas + 4×3
```

为什么重要：WorldObjectData 只保存“我是什么”，而素材裁切和尺寸由 Visual Definition 统一决定，避免同一个尺寸在多处重复维护。

## `WorldObjectRenderer.ts`

根据 `WorldObjectData` 动态创建 Base / Resource Node、Sprite、View、AttackReceiver、HitFlashView。

为什么存在：世界对象的 Node 创建集中在一个地方，数据层不直接操作 Cocos Node。

## `WorldObjectView.ts`

WorldObject 的输入/展示组件，当前负责把点击行为转换成 objectId 回调。

为什么不让它直接寻路：View 只应该说“这个对象被点了”，而不应该知道 Squad、A* 或 Command 状态。

## `WorldObjectAttackReceiver.ts`

WorldObject 对通用 `AttackImpactSignal` 的接收端。

当前收到事件后触发 `HitFlashView`，以后可以继续接资源采集、耐久、破坏等逻辑。

为什么单独存在：CombatEventHub 只负责路由，视觉反馈也不应该直接写进 Hub。

---

# 12. `scripts/navigation/`

## `NavigationTypes.ts`

导航系统共享的 `GridCell`、`GridPoint` 等类型。

## `NavigationGrid.ts`

保存地图中哪些格子可以走、哪些格子被阻挡。

为什么独立：A* 应该依赖抽象的可行走网格，而不是直接读取 Scene Node。

## `NavigationGridBuilder.ts`

根据静态地图和 WorldObject footprint 构建 `NavigationGrid`。

为什么存在：把“数据如何变成阻挡网格”的规则和“网格如何被寻路”拆开。

## `AStarPathfinder.ts`

纯 A* 路径算法。

当前使用 8 方向移动、10/14 代价、禁止斜向穿角。

为什么独立：寻路算法不应该知道 Resource、Squad 或 Cocos Node。

## `TargetApproachResolver.ts`

资源自身格子是 blocked，因此 Squad 不能直接寻路到资源中心。这个文件负责求资源 footprint 周围可接近的 Approach Cell。

为什么和 Interaction Slot 不是一个东西：

```text
Approach Cell = Squad 跨地图路径的终点
Interaction Slot = Warrior 到目标附近后的最终站位
```

## `WorldNavigator.ts`

导航层 Facade。

负责把：

```text
当前 GridPoint
+ Target WorldObject
+ NavigationGrid
+ TargetApproachResolver
+ AStar
```

组合成业务层可以直接使用的路径请求。

为什么存在：`SquadBrain` 不需要了解 A* 的内部实现。

---

# 13. `scripts/command/`

## `WorldCommandController.ts`

把玩家对世界对象的点击翻译成 Squad Command。

当前职责包括：

- 当前 active Squad；
- 同目标点击/取消；
- 切换目标；
- 调用 SquadBrain；
- 管理目标旗帜。

为什么独立：玩家输入不应该写进 SquadBrain。

## `TargetFlagView.ts`

负责动态生成/移动/隐藏目标旗帜视觉。

为什么存在：Flag 是命令表现，不应该由 Resource 或 SquadRenderer 负责。

## `TargetFlagSpriteConfig.ts`

旗帜 Sprite 的尺寸、切图和显示参数集中配置。

为什么存在：视觉参数不能散落在 Controller 业务代码中。

---

# 14. `scripts/squad/`

这是目前最大的行为域。

## `SquadTypes.ts`

Squad 的共享数据协议，包括 SpawnData、RuntimeHandle、Formation Offset 等。

为什么存在：Renderer、Command、Brain 都需要这些类型，但不应该彼此循环依赖。

## `StaticSquads.ts`

当前 Prototype 的静态 Squad 配置。

为什么存在：小队“有哪些、出生在哪里、成员数多少”与 Renderer 分开。

## `SquadRenderer.ts`

根据 Squad 数据创建：

```text
Squad Node
Warrior Nodes
WarriorAnimator
WarriorMotor
SquadMotor
SquadEngagementController
SquadBrain
```

并返回 `SquadRuntimeHandle`。

为什么它叫 Renderer 但承担组装职责：当前 Prototype 阶段，它是 Squad Runtime Object Factory；以后内容量变大时可以再拆 Spawn/Factory 层。

## `SquadBrain.ts`

Squad 高层状态机。

负责：

```text
HomeIdle
Wander
MoveToTarget
EngageTarget
AttackResource
Reform
ReturnHome
```

为什么存在：Command 只负责“玩家想做什么”，Motor 只负责“怎么移动”，真正决定小队状态切换的是 Brain。

## `SquadMotor.ts`

只负责 Squad Root 的跨地图移动。

它是 Squad 世界位置的唯一主要写入者。

为什么不能让 WarriorMotor 替代它：整队长距离移动和单兵局部展开是两个不同尺度的问题。

## `InteractionTypes.ts`

定义 Interaction Slot、Side、Assignment 等局部交互数据类型。

## `InteractionSlotResolver.ts`

根据 WorldObject footprint 在目标轮廓四边生成可用 Slot，并过滤地图边界和 blocked Cell。

为什么不是 Navigation 的一部分：它解决的是“单兵最终如何贴目标”，而不是全地图寻路。

## `SquadEngagementController.ts`

目标附近的局部行为协调器。

负责：

- Slot 候选；
- Warrior ↔ Slot 分配；
- 单兵移动到位；
- 到位后分别进入攻击；
- AttackImpact 的 attacker/target 语义；
- 取消交互；
- Reform 回阵型。

为什么不能全部塞进 SquadBrain：Brain 应保持高层状态机，不应该管理四个 Warrior 的每一个局部坐标。

## `WarriorMotor.ts`

只写单个 Warrior Node 的 `localPosition`。

用于目标附近展开、贴近资源、回 Formation。

为什么使用 Local Position：Warrior 是 Squad Node 子节点；长距离移动让 Squad Root 带着走，局部展开只改自己的 offset，职责非常清楚。

## `WarriorAnimator.ts`

负责 Idle / Walk / Attack 状态和 SpriteFrame 切换。

同时在 Attack Pose 真正出现的边沿发出 impact callback。

为什么 impact 时刻放在 Animator：真正的“命中时刻”与动画 Pose 同步；但 Animator 只报告时刻，不知道 targetId 或 damage。

## `WarriorDirectionUtils.ts`

统一 `dx/dy → Up/Down/Left/Right` 的方向判定。

为什么必须集中：Walk、Attack、局部移动如果各写一套方向判断，会出现素材方向改变后逻辑不一致。

## `WarriorSpriteConfig.ts`

剑士素材的 Frame Size、方向枚举、walk/attack SpriteFrame 裁切规则和相关资源配置。

为什么存在：素材 Sheet 语义属于 Asset Config，不应该混入 Animator 状态机。

---

# 15. `scripts/combat/`

## `CombatTypes.ts`

定义通用战斗事件协议：

```ts
AttackImpactSignal {
    attackerId
    targetId
}
```

以及 Receiver 接口。

为什么当前不放 damage：目前先建立稳定事件边界，以后 Damage、Element、Crit 可以扩展，但不应该让动画层提前依赖未完成的数值系统。

## `CombatEventHub.ts`

维护：

```text
targetId → AttackImpactReceiver
```

收到 AttackImpact 后按 `targetId` 路由。

为什么不是全局 Singleton：`MainMapController` 创建 Hub 并显式注入，未来切换地图/战斗实例时生命周期更可控，也方便测试。

为什么 target 消失时只是 warning：目标可能在攻击命中 Pose 到达之前已经死亡或销毁，这是正常竞态，不应该让整个游戏抛异常。

---

# 16. `scripts/feedback/`

## `HitFlashView.ts`

纯视觉受击反馈。

收到 `flash()` 后：

```text
flashAmount = 1
短暂停留
↓
渐变回 0
```

每个 Sprite 使用独立 Material Instance。

为什么它不知道 attacker/HP：视觉反馈必须能被 Resource、Monster、Building 等任何目标复用。

---

# 17. `scripts/debug/`

## `RuntimeNodeTreeLogger.ts`

开发阶段定时打印运行时 Node Tree。

为什么需要：当前大量 Node 是运行时动态生成，单看 Cocos 编辑器中的静态 Hierarchy 无法确认 Squad、Warrior、Flag 等是否正确创建和挂载。

Debug 工具不能进入任何游戏业务状态机。

---

# 18. 当前主要运行时调用链

## 18.1 Bootstrap

```text
MainMapController
├── MapRenderer
├── WorldObjectRenderer
├── NavigationGridBuilder
├── WorldNavigator
├── SquadRenderer
├── CombatEventHub
└── WorldCommandController.setup
```

## 18.2 点击资源

```text
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
```

## 18.3 到达资源

```text
SquadBrain
↓
SquadEngagementController
↓
InteractionSlotResolver
↓
WarriorMotor × N
↓
WarriorAnimator × N
```

## 18.4 攻击反馈

```text
WarriorAnimator
Attack Pose Entered
↓
SquadEngagementController
↓
CombatEventHub
↓
WorldObjectAttackReceiver
↓
HitFlashView
```

---

# 19. 当前重要规则

### 不使用 Physics 作为单位移动基础

当前不做 Warrior-Warrior Collider、刚体推挤或 NavMesh。

局部视觉重叠优先通过 Slot / CombatPosition 逻辑解决。

### Slot 不是 Node

Slot 是数据：

```text
position
side
facing
```

不要为每个 Slot 创建 Scene Node。

### Squad 是玩家指挥单位

未来即使 Warrior 拥有：

```text
HP
Attack
Death
Heal
Target
```

玩家仍然应该主要操作 Squad，而不是逐兵微操。

### Animator 不做战斗判定

Animator 可以报告：

```text
攻击 Pose 出现了
```

但不能自己决定：

```text
打谁
扣多少血
目标是否死亡
```

### Renderer 不做 AI

Renderer 负责 Node/Sprite 的生成和表现组装，不负责状态决策。

---

# 20. 后续新增功能应该放哪里

| 新功能 | 推荐位置 |
|---|---|
| 新资源类型 | `WorldObjectTypes` + `WorldAtlasConfig` + 数据源 |
| 新世界对象实例 | `StaticWorldObjects`（当前阶段） |
| 新地图 | `StaticMap` 或未来 Map Generator |
| 新地形连接规则 | `MapResolver` |
| 新兵种素材 | 新 Visual Config / Registry，不要继续给 Renderer 增加成对 Texture 字段 |
| Warrior HP | Warrior Combat/Health 组件，不放 Animator |
| Monster | 新 `monster/` 域 + 复用 Navigation / CombatEventHub / HitFlashView |
| 怪物受击 | `MonsterAttackReceiver` + `HitFlashView` |
| Damage 计算 | `combat/` 下新增 CombatResolver / DamageTypes |
| 远程攻击 | Attack/Projectile 层，最终仍产生 AttackImpact |
| 采集资源数值 | Resource Receiver / Resource State，不放 HitFlashView |
| 多 Squad 选择 | `WorldCommandController` 扩展 selected/active squad，不修改 A* |
| Debug 可视化 | `debug/`，不要写入 Brain/Motor |

---

# 21. 当前技术债与注意事项

1. 当前 `SquadRenderer` 同时承担 Runtime Factory 和渲染组装，Prototype 阶段可以接受；兵种和 Squad 类型增多后应拆出 Visual Registry / Factory。
2. 当前静态数据来自 `StaticMap`、`StaticWorldObjects`、`StaticSquads`；后续随机生成时应替换数据来源，而不是重写 Renderer。
3. 当前 Sword Texture 注入方式仍偏 Prototype，第二个兵种出现前应改为 `VisualId → VisualDefinition` Registry。
4. `.DS_Store` 不属于项目，应清理并加入 ignore。
5. `.meta` 文件不能随意删除或重新生成，否则 Cocos UUID 引用可能失效。

---

# 22. 开发启动

使用：

```text
Cocos Creator 3.8.8
```

打开项目后主场景：

```text
assets/Main.scene
```

`MapRoot/MainMapController` 当前需要确保 Inspector 中关键资源已正确绑定，尤其是：

```text
Target Flag Texture
Warrior Attack Texture
Hit Flash Material
```

运行浏览器预览后，Chrome DevTools Console 可以看到系统启动日志，例如：

```text
[WorldObjectRenderer] rendered ... world objects
[NavigationGridBuilder] built ... grid
[SquadRenderer] rendered ... squads
[WorldCommandController] bound ... world objects
```

---

# 23. 阅读顺序建议

第一次接手代码建议按这个顺序：

```text
README.md
↓
MainMapController.ts
↓
StaticMap.ts / StaticWorldObjects.ts / StaticSquads.ts
↓
WorldCommandController.ts
↓
SquadBrain.ts
↓
WorldNavigator.ts
↓
SquadMotor.ts
↓
SquadEngagementController.ts
↓
WarriorMotor.ts / WarriorAnimator.ts
↓
CombatEventHub.ts
↓
WorldObjectAttackReceiver.ts / HitFlashView.ts
```

这条顺序基本等于游戏真实运行链路。

---

## 总结

当前工程刻意把系统拆成几个稳定边界：

```text
Data
↓
Renderer
↓
Command
↓
Brain
↓
Navigation / Motor
↓
Engagement
↓
Animator
↓
Combat Event
↓
Receiver
↓
Feedback
```

目标不是为当前“4 个剑士砍资源”写最少代码，而是让这套基础以后可以继续承载：**多 Squad、群怪 AI、兵种差异、远程攻击、资源采集、怪物受击、建筑战斗和更完整的自动战斗系统**。
# TowerDown

当前运行时已包含：

- Grid / A* / Squad Command / Warrior Formation
- Health / Damage / Damage Popup / Hit Flash
- Wood、Stone、Food、Gold 资源与 HUD
- Gold 的 3 只 Slime Guard 数据、运行时生成与单体生命/受击组件

Slime 贴图由项目使用者绑定到 `MapRoot/MainMapController`：

- `slimeMoveTexture`
- `slimeAttackTexture`

两张贴图规格为 64x64、4x4 帧、单帧 16x16，使用 Point/Nearest 过滤并关闭 Mipmap。

当前怪物战斗采用 v2 架构：

- 不使用 `CombatEncounter`、`CombatPosition` 或战斗 Slot
- `MonsterGroupController` 只管理 Guard、参与 Squad、Leash 和 Target Claim
- `WarriorCombatController` 与 `MonsterCombatController` 各自负责选敌、Direct Approach、攻击和退出
- 战斗位置由单位基于目标实时坐标计算，不进入 `NavigationGrid` Occupancy
- `SquadEngagementController` 的 Interaction Slot 仅用于普通资源交互，不参与怪物战斗
