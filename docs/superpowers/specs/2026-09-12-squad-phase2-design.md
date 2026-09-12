# TowerDown Squad Phase 2 Design

## Scope

本设计实现 Phase 2 的第一条完整玩家军事指令链路：

```text
点击世界物体
-> 设置 / 切换 / 取消当前小队目标
-> 目标显示动态旗帜
-> 基于 World Object footprint 构建 Navigation Grid
-> A* 寻找到目标周边可交互位置
-> Squad 沿路径连续移动
-> 到达资源邻接位置
-> 循环播放攻击动画
```

本轮明确不做：

- 资源掉血
- 资源数量减少
- 资源销毁
- 产出结算
- 敌人
- 战斗伤害
- 单位碰撞
- 多小队选择 UI
- Y-Sort
- 动态重规划
- 建筑放置
- Path 可视化

## Preconditions

- `target_flag.png` 已存在于 `assets/art/command/target_flag.png`
- `warrior_sword_attack.png` 已存在于 `assets/art/units/warrior_sword_attack.png`
- 两张图均为 `64x16`
- 两张图的导入设置均为 `nearest + mipfilter none`
- 用户将严格按技术方案手工完成：
  - `WorldCommandController` 挂载到 `MapRoot`
  - `targetFlagTexture` / `warriorAttackTexture` Inspector 绑定
- `Base` 点击本轮需要顺手支持

## Goals

- 建立 `Touch -> Command -> Navigation -> Motor -> Animation` 的完整链路
- 将 `SquadIdleAI` 的行为职责正式迁移为 `SquadBrain + SquadMotor`
- 让 `SquadMotor` 成为唯一 Squad 世界位置写入者
- 保持 Phase 1 的 Home Idle / Wander 体验不退化
- 结构上从本轮开始遵守 `1 Squad = 1 Flag`

## System Layers

### Input Layer

- `WorldObjectView`
  - 只负责“我被点击了”
  - 通过 callback 向外抛 `objectId`
  - 不 import `WorldCommandController`
  - 不负责寻路、移动、旗帜、攻击动画

### Command Layer

- `WorldCommandController`
  - 只解释玩家意图
  - 维护 `activeSquadId`
  - 维护 `targetBySquad`
  - 维护 `flagBySquad`
  - 向 `SquadBrain` 发布命令
  - 不直接 `setPosition`
  - 不直接执行 A* 细节

### Navigation Layer

- `NavigationGrid`
- `NavigationGridBuilder`
- `AStarPathfinder`
- `TargetApproachResolver`
- `WorldNavigator`

这一层只负责：

- 哪些格可走
- 哪些格不可走
- 目标周边哪些格可接近
- 从哪里走到哪里

### Behavior Layer

- `SquadBrain`
  - 管理 `HomeIdle / Wander / MoveToTarget / AttackResource / ReturnHome`
  - 收到命令后决定状态迁移
  - 不直接写 node position

### Motion Layer

- `SquadMotor`
  - 唯一允许写 Squad Node 世界位置的组件
  - 管理连续 Grid Point、waypoints、方向、到达事件

### Visual Layer

- `WarriorAnimator`
  - 只管理 `Idle / Walk / Attack` 的视觉播放
- `TargetFlagView`
  - 只负责旗帜显示、位置、动画

## Runtime Chain

主命令链：

```text
Touch
-> WorldObjectView
-> WorldCommandController
-> SquadBrain
-> WorldNavigator
-> AStarPathfinder
-> SquadMotor
-> WarriorAnimator
```

旗帜链：

```text
WorldCommandController
-> TargetFlagView
-> CommandRoot
```

## Navigation Model

### Shared Types

`GridPoint` 与 `GridCell` 应迁移到 `navigation/NavigationTypes.ts`，避免由 Squad Layer 反向定义通用导航类型。

建议包含：

- `GridCell`
- `GridPoint`
- `NavigationPathResult`

### Grid Size

- 当前地图为 `40x23`
- `NavigationGrid` 内部可用 `Uint8Array`
- `0 = walkable`
- `1 = blocked`

### Terrain Rule

- `Grass` 可走
- `Dirt` 可走

不要因为 Dirt 是道路视觉就把 Grass 设成不可走。

### World Object Occupancy

所有 `WorldObjectData` 按 `WorldVisualDefinition.w/h` 全 footprint 占用对应格子。

继续坚持：

```text
Visual Footprint
= Logical Footprint
= Navigation Occupancy
```

禁止额外引入：

- `collisionW`
- `collisionH`
- `navW`
- `navH`

### Unit Occupancy

Squad 本轮不写入 `NavigationGrid`。

语义上允许：

- 多支 Squad 互相穿过
- 未来单位不作为静态 blocked map 的来源

## Target Approach Rule

目标物本体是 blocked，因此寻路终点不是目标自身格，而是目标 footprint 周边的合法 approach cell。

### Candidate Rule

第一版只生成：

- Top edge
- Bottom edge
- Left edge
- Right edge

不主动生成四个纯对角 corner。

### Filter Rule

候选格必须满足：

- 在地图内
- 当前 walkable

### Contact Rule

正式接触语义：

```text
到达合法 Approach Cell
= 已接触目标
```

不引入：

- collider
- pixel distance threshold
- 额外接触系统

## A* Rule

- 支持 8 方向移动
- 直行 cost = `10`
- 斜线 cost = `14`
- heuristic 使用 Octile Distance
- 明确禁止 corner cutting

API 约定：

- `findPath(grid, start, goal): GridCell[] | null`
- 返回路径不含 start，包含 goal

## WorldNavigator Rule

### Start Cell

起点来自：

```text
motor.getGridPosition()
```

连续 Grid Point 通过 `Math.floor()` 转为起点格。

如果起点格意外落在 blocked：

- 先按半径 `1`
- 再按半径 `2`

寻找最近 walkable cell；仍失败则返回不可达。

### Path To Object

`findPathToObject(start, target)` 的流程：

1. 解析 target footprint
2. 生成 approach candidates
3. 对每个 candidate 跑 A*
4. 过滤 unreachable
5. 选择总代价最低的路径

### Path To Home

`findPathToCell(start, targetCell)` 用于：

- 点击当前目标取消后返家
- 点击 `Base` 触发返家

## Home Rest Cell

禁止写死基地数字。

通过 `base_main` 动态计算：

- `baseCenterX`
- `baseBottom`

首选休息点语义：

- 位于基地正下方第一行
- 且最靠近基地中心的 walkable cell

该点通过 `NavigationGrid` 验证。

## SquadMotor

### Ownership

从 Phase 2 开始：

> `SquadMotor` 是唯一允许执行 `Squad Node.setPosition(...)` 的组件。

禁止：

- `SquadBrain` 直接写位置
- `WorldCommandController` 直接写位置

### Responsibilities

- 管理 `currentGridPoint`
- 管理 `waypoints`
- 连续推进移动
- `Grid -> World` 坐标转换
- 移动方向判定
- 到达事件

### Public API

至少包含：

- `getGridPosition()`
- `setWaypoints()`
- `setPath()`
- `stop()`
- `isMoving()`
- `consumeArrived()`

### Wander Input

Home Wander 本身目标就是连续 `GridPoint`，因此：

```text
SquadBrain
-> motor.setWaypoints([randomPoint])
```

无需 A*。

### Path Input

`setPath(cells)` 负责把 `GridCell[]` 转成 cell center waypoints：

- `x = cell.x + 0.5`
- `y = cell.y + 0.5`

### Direction

沿用 Phase 1：

- `abs(dx) > abs(dy)` -> Left / Right
- 否则 -> Up / Down

由 Motor 调 `WarriorAnimator.playWalk(direction)`。

### Arrive

当最后 waypoint 到达：

- `moving = false`
- `arrivedPending = true`
- `WarriorAnimator.playIdle(lastDirection)`

`SquadBrain` 通过 `consumeArrived()` 读取到达事件。

## SquadBrain

### State

建议状态：

- `HomeIdle`
- `Wander`
- `MoveToTarget`
- `AttackResource`
- `ReturnHome`

### Managed Data

建议持有：

- `squadId`
- `homeObjectId`
- `currentTargetId`
- `idleTimer`
- `motor`
- `navigator`
- `worldObjectById`
- `warriors`
- `homeRestCell`

### Home Loop

保持 Phase 1 原体验：

- `HomeIdle` 等待 `0.8 ~ 2.5s`
- 然后生成基地前方 wander point
- `motor.setWaypoints([randomPoint])`
- 到达后回 `HomeIdle`

### issueTarget()

#### Resource

流程：

1. 用当前实时位置 `motor.getGridPosition()`
2. `navigator.findPathToObject(...)`
3. 只有成功时才替换旧目标
4. 设置 `currentTargetId`
5. 状态切到 `MoveToTarget`
6. `motor.setPath(path)`

如果新目标不可达：

- 返回 reject
- 旧目标保持
- 旧 flag 保持

#### Base

本轮顺手支持。

点击 `Base` 的语义是：

- 显示该目标 Flag
- 计算回 `Home Rest Cell` 的路径
- 成功则进入 `ReturnHome`
- 到达后自动切回 `HomeIdle`

### MoveToTarget

当 `motor.consumeArrived() === true`：

- Resource -> `AttackResource`
- Base/Home Rest -> `HomeIdle`

### AttackResource

- 无限循环 Attack 动画
- 不修改资源数据
- 不引入伤害或采集结算

收到新目标时：

- 先计算新路径
- 成功后立即 `Attack -> Walk`
- 状态切到 `MoveToTarget`

### clearCommandAndReturnHome()

再次点击当前目标时：

1. 停止攻击
2. 清空 `currentTargetId`
3. 从 `motor.getGridPosition()` 重新算返家路径
4. 成功则 `ReturnHome`
5. 失败则 `motor.stop()`，warning，然后退回 `HomeIdle`

## Warrior Animation

### State

`WarriorAnimator` 从 Phase 1 的 `moving` 布尔量升级为：

- `Idle`
- `Walk`
- `Attack`

### Public API

建议至少公开：

- `playIdle(direction?)`
- `playWalk(direction)`
- `playAttack()`

### Walk Frames

- 继续使用 `warrior_sword.png`
- 保持 `4 directions x 4 frames`
- 继续保留 `phaseOffset`

### Attack Frames

- 使用 `warrior_sword_attack.png`
- `64x16`
- 横向 4 帧
- `Rect(frameIndex * 16, 0, 16, 16)`
- 不做 Y flip

### Attack Direction

Phase 2 的 Attack sheet 是单方向，因此本轮明确：

> Attack 动画 direction-agnostic。

不做：

- 旋转 Sprite
- 伪造上下左右攻击帧

### Shared Cache

Walk frames 与 Attack frames 都必须由 `SquadRenderer` 统一创建并共享。

禁止：

- 每名 Warrior 单独切一套 walk frames
- 每名 Warrior 单独切一套 attack frames

### Attack Phase Offset

Attack 也继续使用错相位：

- Warrior 0 -> phase 0
- Warrior 1 -> phase 2
- Warrior 2 -> phase 1
- Warrior 3 -> phase 3

## Target Flag

### TargetFlagSpriteConfig

旗帜配置：

- `FLAG_FRAME_SIZE = 16`
- `FLAG_FRAME_COUNT = 4`
- `FLAG_FRAME_DURATION = 0.15`

由 `target_flag.png` 横向切出 4 帧。

### TargetFlagView

职责：

- 管理旗帜 4 帧循环
- 管理显示位置
- 管理 show / hide

不管理：

- 当前 target 状态
- active squad
- 命令逻辑

### Position

旗帜位置取 target footprint 的 `top-center`：

- `x = target.gridX + visual.w / 2`
- `y = target.gridY`

再追加少量视觉像素上偏移。

该偏移只属于 `TargetFlagView`，不进入逻辑 Grid。

### Runtime Hierarchy

当前单队运行时：

```text
CommandRoot
└── TargetFlag_initial_01
```

不要创建全局唯一的：

- `TheFlag`
- `GlobalFlag`

数据结构从本轮开始按“每队一旗”设计。

## WorldObjectView Click Support

### Interaction

`WorldObjectView` 增加：

- `bindClickHandler(handler)`

在：

- `onEnable()` -> `node.on(Node.EventType.TOUCH_END, ...)`
- `onDisable()` -> `node.off(...)`

点击后只做：

- `this.clickHandler?.(this.objectId)`

### Hit Area

继续使用当前 `UITransform` 作为点击区域。

例如：

- `Tree 2x2` 的点击范围就是完整 `2x2` 视觉 footprint

不增加 Collider。

## SquadRenderer Refactor

`SquadRenderer` 继续负责：

- 创建 Squad Node
- 创建 Warrior Node
- 设置 Formation
- 创建共享 Frame Cache
- 创建并装配 `SquadMotor`
- 创建并装配 `SquadBrain`
- 初始化所有 `WarriorAnimator`

### Runtime Handle

建议 `render()` 返回：

- `Map<string, SquadRuntimeHandle>`

其中 `SquadRuntimeHandle` 包含：

- `id`
- `node`
- `motor`
- `brain`

这样 `WorldCommandController` 不需要通过 Node 名称反查小队。

## WorldCommandController

### Placement

- 挂在 `MapRoot`
- 不挂在 `CommandRoot`

### Setup

通过 `setup()` 注入：

- `worldObjectRoot`
- `commandRoot`
- `worldObjects`
- `squadHandles`
- `targetFlagTexture`
- `mapWidth`
- `mapHeight`

### Internal State

- `activeSquadId = 'initial_01'`
- `targetBySquad = new Map<string, string>()`
- `flagBySquad = new Map<string, TargetFlagView>()`

虽然当前只有一支队，但不要把 Controller 写成完全全局唯一。

### Click Binding

必须在 `WorldObjectRenderer.render()` 之后完成。

`setup()` 内部遍历 `worldObjectRoot` 下所有 `WorldObjectView` 并绑定点击 callback。

### Same Target Click

如果再次点击当前目标：

- 清 `targetBySquad`
- `flag.hide()`
- `brain.clearCommandAndReturnHome()`

### Different Target Click

先：

- `brain.issueTarget(clickedObjectId)`

如果 reject：

- 旧 target 保持
- 旧 flag 保持
- 输出 warning

只有 accepted：

- 更新 `targetBySquad`
- `flag.showAtObject(...)`

## MainMapController As Composition Root

### Required Properties

本轮新增：

- `targetFlagTexture`
- `warriorAttackTexture`

严格按技术方案：

- 没有 UUID fallback
- Inspector 未绑定就直接报错

### Bootstrap Order

建议顺序：

1. `require` Scene roots
2. 校验必需 Texture 已绑定
3. render terrain
4. render world objects
5. build navigation grid
6. create navigator
7. render squads
8. 取得 `WorldCommandController`
9. `commandController.setup(...)`

### WorldCommandController Requirement

`MainMapController` 需要显式要求：

- `WorldCommandController` 已挂在 `MapRoot`

如果不存在：

- 直接 throw

不要运行时 `addComponent`。

## Main Scene Contract

运行时依赖以下根结构：

```text
MapRoot
├── TileRoot
├── WorldObjectRoot
│   ├── StructureRoot
│   └── ResourceRoot
├── ActorRoot
│   └── SquadRoot
└── CommandRoot
```

## Error Handling

以下情况必须显式处理：

- `WorldCommandController` 不在 `MapRoot`
- `targetFlagTexture` 未绑定
- `warriorAttackTexture` 未绑定
- target id 不存在
- active squad id 不存在
- target 没有可用 approach cells
- A* 无可达路径
- home rest 不可达
- navigation size 非法

不可达目标的规则：

- warning
- 不替换旧目标
- 不移动旧旗帜

## Logging

建议保留高价值日志：

- `[NavigationGridBuilder] built 40x23 grid, blocked=N`
- `[SquadRenderer] rendered 1 squads.`
- `[WorldCommandController] bound 5 world objects.`
- `[Command] squad=initial_01 target=wood_01 accepted pathLength=...`
- `[Command] squad=initial_01 target=wood_01 cancelled`
- `[Command] target=... rejected: unreachable`

禁止每帧打印：

- position
- animation frame
- A* node expansion

## Runtime Hierarchy

完成后目标运行时结构：

```text
Canvas
└── MapRoot
    ├── TileRoot
    ├── WorldObjectRoot
    │   ├── StructureRoot
    │   └── ResourceRoot
    ├── ActorRoot
    │   └── SquadRoot
    │       └── Squad_initial_01
    │           ├── Warrior_0
    │           ├── Warrior_1
    │           ├── Warrior_2
    │           └── Warrior_3
    └── CommandRoot
        └── TargetFlag_initial_01
```

## Testing

### Functional Cases

- Click Wood -> Flag -> Move -> Attack
- Move途中点击 Stone -> 从实时位置重新寻路
- 再次点击当前目标 -> 取消 -> 返家
- Attack 中点击 Food -> 立即停止攻击并转向新目标
- 点击 Base -> 显示 Flag -> ReturnHome -> 到达后回 `HomeIdle`

### Navigation Checks

- 不穿过 Base
- 不穿过 Tree
- 不穿过 Stone
- 不穿过 Food
- 8 方向寻路有效
- corner cutting 被禁止

### Architecture Checks

- `SquadIdleAI` 不再承担行为控制
- `SquadMotor` 是唯一 Squad Position Writer
- `WorldCommandController` 不直接写位置
- `WorldObjectView` 不直接 import Controller

## Disallowed Patterns

以下实现不允许出现：

- `WorldObjectView` 直接寻找 Squad Node
- `WorldObjectView` 直接调用 A*
- `WorldCommandController` 直接 `node.setPosition`
- `SquadBrain` 直接 `node.setPosition`
- 使用 `tween()` 移动 Squad
- A* 的 goal 直接设为资源自身 blocked cell
- 用 collider 作为资源接触判定
- 把 Squad 写入静态 Navigation blocked map
- 旗帜挂到 Resource Node 下继承其缩放
- 每次点击重新生成全部 SpriteFrame
- `SquadIdleAI` 与 `SquadBrain` 同时控制 Squad

## Future Compatibility

Phase 2 结束后，应稳定形成以下长期接口：

- 玩家意图层：`WorldCommandController`
- 小队决策层：`SquadBrain`
- 路径层：`WorldNavigator / AStar`
- 运动层：`SquadMotor`
- 视觉层：`WarriorAnimator / TargetFlagView`

后续做：

- Resource HP / Amount
- Attack Tick
- 采集结算
- Resource Exhausted
- Flag Auto Clear
- 第二支 Squad

时，不需要推翻输入、寻路和运动底层。
