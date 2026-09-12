# TowerDown Squad Phase 1 Design

## Scope

本设计实现 1 支初始 4 人剑士小队。小队从 `base_main` 正前方出生，并仅在基地正面休息区执行 `Idle -> Wander -> Idle` 循环。

本轮不做：

- 点击选择
- 旗帜命令
- 寻路
- 碰撞
- 战斗
- 敌人
- 资源采集
- Y-Sort
- 存档

## Preconditions

- `MainMapController` 已挂在 `MapRoot`。
- Scene 中已存在 `ActorRoot/SquadRoot`。
- `assets/art/units/warrior_sword.png` 已存在。
- `warrior_sword.png` 的导入设置由用户在编辑器中改为 `Nearest / Point`，`MipMap Off`。

## Goals

- 小队出生位置由 `homeObjectId = base_main` 动态推导，不写死坐标。
- 小队在连续 Grid 坐标中移动，与现有地图 / 世界物体共用同一套 Grid 语义。
- Warrior 在 Phase 1 仅作为视觉成员跟随 Squad Root，但架构不能阻止未来为 Warrior 增加独立 Runtime / Combat 组件。

## Architecture

### Data

- `assets/scripts/squad/SquadTypes.ts`
  - `WarriorVisualId`
  - `GridPoint`
  - `SquadSpawnData`
- `assets/scripts/squad/StaticSquads.ts`
  - 定义唯一初始小队 `initial_01`
  - 只存 `homeObjectId`，不存写死出生坐标

### Rendering

- `assets/scripts/squad/WarriorSpriteConfig.ts`
  - 方向与帧切片规则
  - `16x16` 单帧
  - 方向在列，动画帧在行
  - 不做 Y Flip
- `assets/scripts/squad/SquadRenderer.ts`
  - 只负责一次性创建 Squad 节点和 4 个 Warrior 节点
  - 设置固定 formation local offset
  - 创建共享 `SpriteFrame` 缓存
  - 初始化 `WarriorAnimator`
  - 初始化 `SquadIdleAI`
  - 不负责 `update`
  - 不负责移动状态机

### Runtime

- `assets/scripts/squad/SquadIdleAI.ts`
  - 只维护 Squad 中心连续 Grid 坐标
  - 只维护 `Idle/Wander` 状态
  - 只生成随机目标和移动方向
  - 真正移动的是 Squad Root
- `assets/scripts/squad/WarriorAnimator.ts`
  - 只根据 `direction + moving + phaseOffset` 切换 SpriteFrame
  - 不决定位置
  - 不拥有 AI

### Shared Grid

- `assets/scripts/grid/GridTransform.ts`
  - 新增 `gridPointToWorld(gridX, gridY, mapWidth, mapHeight)`
  - `gridCellToWorldCenter()` 与 `gridRectToWorldCenter()` 改为复用 `gridPointToWorld()`

## Runtime Model

- `Squad` 是玩家当前的逻辑指挥单位。
- 4 个 Warrior 在 Phase 1 不是独立闲逛 Actor。
- 4 个 Warrior 通过固定 local offset 跟随 Squad Root。
- 本轮不建立大而全的 `SquadController`。
- 本轮不让 `SquadRenderer` 每帧重新排阵。
- 本轮不让 Warrior 自己追 Squad。

## Spawn And Home Zone

Squad 出生与活动范围从 `homeObjectId` 动态推导：

1. `SquadSpawnData.homeObjectId`
2. `STATIC_WORLD_OBJECTS.find(...)`
3. `getWorldVisualDefinition(base.visualId)`
4. 计算基地边界

基地边界：

- `homeLeft = base.gridX`
- `homeRight = base.gridX + baseW`
- `homeBottom = base.gridY + baseH`

当前 `base_main` 会得到：

- `homeLeft = 18`
- `homeRight = 22`
- `homeBottom = 13`

### Spawn Point

- `spawnX = (homeLeft + homeRight) / 2`
- `spawnY = homeBottom + 1`

当前出生点为连续 Grid 坐标 `(20, 14)`。

## Wander Zone

本轮只允许在基地正面活动，避免在未实现跨层 Y-Sort 的前提下跑到基地背后。

范围定义：

- `wanderMinX = homeLeft - 1.5`
- `wanderMaxX = homeRight + 1.5`
- `wanderMinY = homeBottom + 0.5`
- `wanderMaxY = homeBottom + 3.5`

当前近似范围：

- `x: 16.5 ~ 23.5`
- `y: 13.5 ~ 16.5`

随机目标生成后需要 clamp 到地图有效连续坐标：

- `0.5 <= x <= mapWidth - 0.5`
- `0.5 <= y <= mapHeight - 0.5`

## State Machine

### Idle

进入 `Idle` 时：

- 速度视为 0
- 所有 Warrior `moving = false`
- `idleTimer = randomRange(0.8, 2.5)`

更新逻辑：

- `idleTimer -= dt`
- 当 `idleTimer <= 0` 时，生成随机 Wander 目标并进入 `Wander`

### Wander

`SquadIdleAI` 在连续 Grid 空间中移动：

- `dx = targetGridX - currentGridX`
- `dy = targetGridY - currentGridY`
- `distance = sqrt(dx * dx + dy * dy)`
- `moveSpeedCellsPerSecond = 1.25`
- `maxStep = speed * dt`

到达阈值：

- `distance <= 0.03`

到达后：

- 当前点贴到目标点
- 回到 `Idle`

未到达时：

- 归一化方向
- 推进 `currentGridX/currentGridY`
- 用 `gridPointToWorld()` 驱动 Squad Node 位置

## Facing Rule

朝向由 Wander 运动向量决定：

- `|dx| > |dy|` 时为左右朝向
- 否则为上下朝向
- `dx < 0 -> Left`
- `dx > 0 -> Right`
- `dy < 0 -> Up`
- `dy > 0 -> Down`

说明：

- 本工程 Grid 中 `y` 越大，视觉上越向下。
- 朝向变化后，同步通知所有 `WarriorAnimator`。

## Formation

4 人固定 2x2 编队，不逐帧重排：

- `Warrior_0 = (-0.38, -0.20) Cell`
- `Warrior_1 = (+0.38, -0.20) Cell`
- `Warrior_2 = (-0.38, +0.45) Cell`
- `Warrior_3 = (+0.38, +0.45) Cell`

转换为 Cocos local position：

- `offsetX = cellOffsetX * GRID_RENDER_SIZE`
- `offsetY = -cellOffsetY * GRID_RENDER_SIZE`

负号用于处理 Grid `+Y` 向下、Cocos `+Y` 向上的方向差异。

## Warrior Animation

### Sprite Sheet Rule

- 原图 `64x64`
- 单帧 `16x16`
- `4 columns x 4 rows`
- 列表示方向
- 行表示动画帧

### Animator Contract

`WarriorAnimator` 仅暴露：

- `setDirection(direction)`
- `setMoving(moving)`
- `setup(sprite, frameSet, phaseOffset)`

### Playback Rule

- `moving = true` 时，每 `0.15s` 播放下一帧
- 帧序列为 `0 -> 1 -> 2 -> 3 -> 0`
- `moving = false` 时固定显示 `row 0`
- 4 名 Warrior 使用不同 `phaseOffset`

### Frame Cache

共享 16 张 SpriteFrame：

- Key 形式为 `direction_frame`
- 全队共用同一份缓存
- 不为每个 Warrior 重复创建 16 张 frame

## Scene And Bootstrap Integration

### Scene Roots

运行时依赖以下结构：

```text
MapRoot
├── TileRoot
├── WorldObjectRoot
│   ├── StructureRoot
│   └── ResourceRoot
└── ActorRoot
    └── SquadRoot
```

### MainMapController

`MainMapController` 直接把 `this.node` 视为 `MapRoot`，不再二次创建 `MapRoot`。

关键根节点用严格 `requireChild()` 获取：

- `TileRoot`
- `WorldObjectRoot`
- `StructureRoot`
- `ResourceRoot`
- `ActorRoot`
- `SquadRoot`

运行时只允许创建数据节点，不允许偷偷补齐结构 root。

### Bootstrap Order

1. 解析 `MapRoot` 及全部结构 root
2. 渲染 tile map
3. 渲染 static world objects
4. 渲染 static squads

## Error Handling

以下情况直接抛错：

- Scene 缺少任一结构 root
- `STATIC_SQUADS.homeObjectId` 找不到对应 world object
- `warrior_sword` 纹理加载失败
- 本轮 `memberCount !== 4`

## Testing

### Functional Checks

- 运行后出现 1 支 `Squad_initial_01`
- 小队出生在 `base_main` 正前 `(20, 14)` 一带
- 小队只在基地前方休息区活动
- Idle 时 Warrior 显示站立帧
- Wander 时 Warrior 播放行走帧
- 4 人步伐不同步

### Regression Checks

- 不出现 `MapRoot/MapRoot`
- `WorldObjectRenderer` 不做 atlas Y flip
- Warrior 切片不做 Y flip
- 不出现 Warrior 跑到基地背后闲逛

## Future Compatibility

- Phase 1 中 Warrior 是视觉成员，不等于未来永久只是视觉对象。
- Future Combat Phase 可以给 Warrior 增加独立 HP、攻击、死亡、治疗等 Runtime / Combat 组件。
- 即使未来 Warrior 具备更强独立性，`Squad` 仍然是玩家侧唯一指挥单位。
- 本轮代码不能引入会阻止该演进方向的假设。
