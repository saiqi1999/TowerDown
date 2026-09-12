# TowerDown：Warrior Interaction Slot 技术方案
## 资源贴边、单体局部移动、独立攻击触发

> 适用仓库：`saiqi1999/TowerDown`  
> 适用阶段：Squad Phase 2 之后  
> 目标：解决“Squad 已经到达资源附近，但部分 Warrior 实际没有接触资源，却已经播放攻击动画”的问题。
>
> 核心原则：
>
> ```text
> Squad 负责跨地图移动
> Warrior 负责目标附近的局部移动
> Warrior 只有真正到达自己的接触位置后才允许攻击
> ```

---

# 1. 本轮最终效果

当前：

```text
Squad 到资源附近
↓
4 个 Warrior 同时 Attack
```

改成：

```text
Squad 到资源附近
↓
Squad Root 停止
↓
生成资源 Interaction Slots
↓
给每个 Warrior 分配 Slot
↓
Warrior 各自移动
↓
谁先到 Slot，谁先 Attack
↓
未到 Slot 的 Warrior 继续 Walk
```

示意：

```text
        W0
        ↓

W1  →  TREE  ← W2

        ↑
        W3
```

4 个 Warrior 可以从不同方向贴住资源轮廓。

---

# 2. 架构边界

本轮不把整个世界拆成单体 Actor。

保持：

```text
WorldObject
├── Base
├── Resource
├── Building
└── Camp
```

资源仍然是一个 WorldObject。

Squad 仍然是玩家直接指挥单位：

```text
Squad
├── SquadBrain
├── SquadMotor
├── SquadEngagementController
│
├── Warrior_0
│   ├── WarriorAnimator
│   └── WarriorMotor
├── Warrior_1
├── Warrior_2
└── Warrior_3
```

Warrior 仍然是 Squad Node 的子节点。

---

# 3. 本轮职责划分

```text
SquadBrain
= 决定当前行为状态

SquadMotor
= Squad Root 跨地图移动

SquadEngagementController
= 资源附近的单体接触流程

InteractionSlotResolver
= 根据资源 footprint 生成接触位置

WarriorMotor
= Warrior 本地局部移动

WarriorAnimator
= Idle / Walk / Attack 动画
```

---

# 4. 用户需要做的事情

本轮尽量做到 **无需手工 Scene 接线**。

Agent 应通过代码在 `SquadRenderer` 创建：

```text
WarriorMotor
SquadEngagementController
```

因此用户不需要：

```text
手工创建 Slot Node
手工创建 Warrior Node
手工挂 WarriorMotor
手工绑定新 Texture
修改资源图片
修改 Atlas
```

用户只需要：

## 4.1 Agent 提交后

```text
1. 拉取 / 获取最新代码
2. 打开 Cocos Creator
3. 等待 TypeScript 编译完成
4. 确认 Console 无编译错误
```

## 4.2 运行测试

至少测试：

```text
A. 点击 wood_01
B. 点击 stone_01
C. 点击 food_01
D. Warrior 正在攻击时点击另一个资源
E. Warrior 正在攻击时点击 Base / 取消命令
```

## 4.3 观察结果

应确认：

```text
Warrior 会分别走向资源边缘
未接触资源的人不会提前攻击
到达的人可以先攻击
4 人不再强制使用同一个攻击方向
切换目标时会先恢复 Formation
然后整队重新出发
```

## 4.4 提供问题信息

如果出现异常，用户只需要提供：

```text
浏览器 Console 日志
+
运行截图 / 录屏
```

不需要自己修改代码。

---

# 5. Agent 需要完成的事情

Agent 负责全部代码实现。

建议新增：

```text
assets/scripts/squad/
├── InteractionTypes.ts
├── InteractionSlotResolver.ts
├── WarriorMotor.ts
└── SquadEngagementController.ts
```

需要修改：

```text
assets/scripts/squad/
├── SquadRenderer.ts
├── SquadBrain.ts
├── SquadMotor.ts
└── SquadTypes.ts
```

必要时可小幅修改：

```text
GridTransform.ts
```

用于统一 Grid Offset → Local Position 转换。

---

# 6. Interaction Slot 数据结构

Slot 不是 Node。

定义：

```ts
export enum InteractionSide {
    Top = 0,
    Bottom = 1,
    Left = 2,
    Right = 3,
}

export interface InteractionSlot {
    id: string;

    gridPoint: GridPoint;

    facing: WarriorDirection;

    side: InteractionSide;
}
```

Slot 只存在于运行时数据中。

禁止：

```text
TargetSlot_0
TargetSlot_1
...
```

这种 Scene Node。

---

# 7. Slot 基于逻辑 footprint

继续使用当前原则：

```text
visual footprint
=
logical footprint
=
navigation occupancy
```

例如：

```text
TreeGreen
w = 2
h = 2
```

资源矩形：

```text
left   = gridX
right  = gridX + w
top    = gridY
bottom = gridY + h
```

Slot 围绕这个矩形生成。

---

# 8. Contact Gap

统一常量：

```ts
export const INTERACTION_CONTACT_GAP_CELLS = 0.42;
```

第一版使用：

```text
0.42 cell
```

Slot 位于资源 footprint 外侧。

例如：

```text
Top:
y = top - 0.42

Bottom:
y = bottom + 0.42

Left:
x = left - 0.42

Right:
x = right + 0.42
```

禁止把该数字重复硬编码到多个文件。

---

# 9. 2×2 资源 Slot

例如：

```text
left   = 10
right  = 12
top    = 5
bottom = 7
```

生成：

```text
Top:
(10.5, 4.58)
(11.5, 4.58)

Bottom:
(10.5, 7.42)
(11.5, 7.42)

Left:
(9.58, 5.5)
(9.58, 6.5)

Right:
(12.42, 5.5)
(12.42, 6.5)
```

共：

```text
8 Slots
```

---

# 10. 1×1 资源 Slot

生成四边各一个：

```text
Top
Bottom
Left
Right
```

例如：

```text
Top    (x + 0.5, y - 0.42)
Bottom (x + 0.5, y + 1.42)
Left   (x - 0.42, y + 0.5)
Right  (x + 1.42, y + 0.5)
```

---

# 11. 不生成角落 Slot

本轮只生成：

```text
Top
Bottom
Left
Right
```

不生成：

```text
TopLeft
TopRight
BottomLeft
BottomRight
```

原因：

```text
当前 Attack 只有四方向
```

---

# 12. Slot Facing

固定规则：

```text
Top Slot
→ Down

Bottom Slot
→ Up

Left Slot
→ Right

Right Slot
→ Left
```

最终 Warrior 攻击方向直接使用：

```ts
slot.facing
```

不要继续使用：

```text
Squad Center → Resource Center
```

统一计算所有人的攻击方向。

---

# 13. Slot 可用性过滤

`InteractionSlotResolver` 生成 Slot 后必须过滤：

```text
地图边界外
→ 删除

所在 Grid Cell blocked
→ 删除
```

检查：

```ts
const cellX =
    Math.floor(slot.gridPoint.x);

const cellY =
    Math.floor(slot.gridPoint.y);
```

然后：

```ts
navigationGrid.isWalkable(
    cellX,
    cellY,
)
```

---

# 14. 接近侧

Squad 到达资源 Approach Cell 后计算：

```text
ApproachSide
```

根据 Squad Grid Position 与目标矩形关系判断：

```text
在 top 外侧
→ Top

在 bottom 外侧
→ Bottom

在 left 外侧
→ Left

在 right 外侧
→ Right
```

---

# 15. Slot 候选规则

对于 `2×2` 及以上资源：

```text
Approach Top
→ Top + Left + Right

Approach Bottom
→ Bottom + Left + Right

Approach Left
→ Left + Top + Bottom

Approach Right
→ Right + Top + Bottom
```

禁止直接分配到资源正对面。

这样第一版 WarriorMotor 不需要局部 A*，也不会直线穿过资源。

---

# 16. 1×1 资源

1×1 资源仍生成四边 Slot。

分配时优先：

```text
Approach Side
+
两个相邻 Side
```

剩余 Warrior 如果没有合法安全 Slot：

```text
保持 Formation / Idle
```

本轮不保证所有 Warrior 一定都能攻击。

---

# 17. Slot 不足

如果：

```text
Warrior = 4
Available Slot = 3
```

结果：

```text
3 个 Warrior 分配 Slot
1 个 Warrior 等待
```

等待 Warrior：

```text
保持当前位置或 Formation Offset
Idle
```

禁止：

```text
两个 Warrior 共用同一 Slot
```

---

# 18. Slot Assignment

第一版采用全局最短 Pair 贪心。

伪代码：

```text
availableWarriors
availableSlots

while 两边都非空:
    找出所有 warrior-slot pair 中距离最短的一对
    建立 assignment
    删除 warrior
    删除 slot
```

当前最多：

```text
4 Warrior × 8 Slot
```

无需复杂算法。

---

# 19. Interaction Assignment

定义：

```ts
export interface WarriorSlotAssignment {
    warriorIndex: number;

    motor: WarriorMotor;

    animator: WarriorAnimator;

    slot: InteractionSlot;

    state:
        | 'moving'
        | 'attacking'
        | 'waiting';
}
```

---

# 20. Formation Offset

当前 Formation Offset：

```text
(-0.38, -0.2)
(+0.38, -0.2)
(-0.38, +0.45)
(+0.38, +0.45)
```

继续使用。

但语义统一定义为：

```text
Grid Cell Offset
```

不要让 Renderer 单独拥有这份数据。

建议移动到：

```text
SquadFormationConfig.ts
```

或：

```text
SquadTypes.ts
```

---

# 21. WarriorMotor

新增：

```text
WarriorMotor.ts
```

职责：

```text
只控制单个 Warrior 的 localPosition
```

禁止：

```text
修改 Squad Node
修改 SquadBrain
跑全地图 A*
选择资源
选择 Slot
```

---

# 22. WarriorMotor API

推荐：

```ts
export interface WarriorMotorConfig {
    animator: WarriorAnimator;
    formationOffset: GridPoint;
}
```

接口：

```ts
setup(
    config: WarriorMotorConfig
): void

moveToLocalGridOffset(
    offset: GridPoint
): void

returnToFormation(): void

stop(): void

isMoving(): boolean

consumeArrived(): boolean

getCurrentLocalGridOffset(): GridPoint

getFormationOffset(): GridPoint
```

---

# 23. WarriorMotor 位置语义

WarriorMotor 内部保存：

```ts
private currentLocalGridOffset:
    GridPoint;
```

写 Node 时统一转换：

```text
Grid +X
→ Local World +X

Grid +Y
→ Local World -Y
```

推荐新增：

```ts
gridOffsetToLocalWorld(
    dxCells,
    dyCells,
)
```

禁止多个组件各自写：

```ts
new Vec3(
    dx * GRID_RENDER_SIZE,
    -dy * GRID_RENDER_SIZE,
)
```

---

# 24. WarriorMotor 移动速度

第一版：

```ts
LOCAL_MOVE_SPEED_CELLS_PER_SECOND = 5.0;
```

略高于 Squad 的跨地图移动速度。

Warrior 展开应该是短促局部动作。

---

# 25. WarriorMotor 动画

局部移动：

```text
current offset
→ target offset
```

计算：

```text
dx / dy
```

调用已有：

```ts
resolveWarriorDirection(...)
```

然后：

```ts
animator.playWalk(direction);
```

到达：

```text
snap
↓
arrivedPending = true
↓
playIdle(lastDirection)
```

真正 Attack 由 EngagementController 触发。

---

# 26. SquadEngagementController

新增：

```text
SquadEngagementController.ts
```

状态：

```ts
export enum SquadEngagementState {
    Inactive = 0,
    MovingToSlots = 1,
    Engaged = 2,
    Reforming = 3,
}
```

---

# 27. setup()

注入：

```ts
export interface SquadEngagementConfig {
    squadMotor: SquadMotor;

    warriorMotors: WarriorMotor[];

    warriorAnimators: WarriorAnimator[];

    slotResolver: InteractionSlotResolver;
}
```

Controller 不自己创建 Warrior。

---

# 28. beginInteraction()

接口：

```ts
public beginInteraction(
    target: WorldObjectData,
): boolean
```

流程：

```text
1. 读取 Squad 当前 Grid Position
2. 计算 Approach Side
3. resolveSlots(target)
4. 根据 Approach Side 过滤候选 Slot
5. 获取各 Warrior 当前 Grid Position
6. Assignment
7. Slot → Warrior local offset
8. WarriorMotor.moveToLocalGridOffset()
9. state = MovingToSlots
```

如果：

```text
0 个合法 Slot
```

返回：

```ts
false
```

---

# 29. Warrior 当前世界 Grid Position

因为 Warrior 是 Squad 子节点：

```text
warriorGrid
=
squadGrid
+
warriorLocalGridOffset
```

统一由 helper / WarriorMotor 提供。

禁止外部根据 Pixel Position 反推。

推荐：

```ts
getWorldGridPosition(
    squadGridPosition: GridPoint
): GridPoint
```

---

# 30. Slot → Local Offset

```ts
const squad =
    squadMotor.getGridPosition();

const localOffset = {
    x: slot.gridPoint.x - squad.x,
    y: slot.gridPoint.y - squad.y,
};
```

传入：

```ts
warriorMotor.moveToLocalGridOffset(
    localOffset
);
```

---

# 31. Engagement Update

`SquadEngagementController.update()` 只检查状态变化。

例如：

```text
assignment = moving
+
warriorMotor.consumeArrived()
↓
assignment.state = attacking
↓
animator.playAttack(slot.facing)
```

因此：

```text
Warrior_0 到达
→ Warrior_0 Attack

Warrior_1 仍移动
→ Warrior_1 Walk
```

不再等待全队。

---

# 32. Engaged 判定

只要：

```text
至少一个 Warrior 已开始 Attack
```

即可：

```text
state = Engaged
```

其他 Warrior 仍然可以继续赶往自己的 Slot。

---

# 33. SquadBrain 修改

当前：

```text
MoveToTarget
→ AttackResource
```

修改为：

```text
MoveToTarget
→ EngageTarget
→ AttackResource
```

建议状态：

```ts
HomeIdle
Wander
MoveToTarget
EngageTarget
AttackResource
Reform
ReturnHome
```

---

# 34. MoveToTarget 到达

当前：

```text
SquadMotor.consumeArrived()
↓
全员 playAttack()
```

必须删除。

改为：

```text
SquadMotor.consumeArrived()
↓
engagement.beginInteraction(target)
```

成功：

```text
state = EngageTarget
```

失败：

```text
按不可交互目标处理
```

---

# 35. EngageTarget

Brain 不直接管理单兵。

只查询：

```ts
engagement.hasAnyWarriorEngaged()
```

如果：

```text
true
```

则：

```text
state = AttackResource
```

---

# 36. AttackResource

此状态表示：

```text
Squad 当前正在与资源交互
```

不表示：

```text
所有 Warrior 都在攻击
```

每个 Warrior 状态由：

```text
SquadEngagementController
```

管理。

---

# 37. 删除旧的全员攻击逻辑

必须删除 / 不再调用：

```ts
private playAttack(
    direction: WarriorDirection
): void {
    for (const warrior of this.warriors) {
        warrior.playAttack(direction);
    }
}
```

资源交互以后只能：

```text
单个 Warrior 到达
→ 单个 Warrior Attack
```

---

# 38. Reform

Warrior 已经离开 Formation 后，新命令不能让 Squad Root 直接移动。

新增：

```ts
engagement.cancelAndReform();
```

流程：

```text
停止所有 Attack
↓
清空 assignment
↓
WarriorMotor.returnToFormation()
↓
state = Reforming
```

---

# 39. Reform 完成

所有 Warrior：

```text
consumeArrived()
```

或：

```text
已经在 Formation Offset
```

后：

```text
engagement state = Inactive
```

Brain 再执行：

```text
新的 Squad Path
```

---

# 40. Pending Command

如果玩家攻击资源 A 时点击资源 B：

```text
点击 B
↓
记录 pendingTargetId = B
↓
Reform
↓
Reform Complete
↓
重新从当前 Squad Position 对 B 做 A*
↓
Squad 出发
```

不要在 Reform 前启动 `SquadMotor`。

---

# 41. Return Home

如果：

```text
AttackResource
```

时点击 Base / 取消：

```text
cancel engagement
↓
Reform
↓
重新计算 return-home path
↓
SquadMotor
↓
ReturnHome
```

---

# 42. Flag 行为

Flag 属于 Squad Command，不属于 Warrior。

以下阶段保持：

```text
MoveToTarget
EngageTarget
AttackResource
```

目标 Flag 继续存在。

只有：

```text
取消当前目标
ReturnHome
Command 被替换
```

才移动 / 隐藏。

---

# 43. InteractionSlotResolver

构造时注入：

```text
NavigationGrid
```

职责：

```text
WorldObject
↓
Visual Definition
↓
生成全部四边 Slot
↓
地图边界过滤
↓
Navigation blocked 过滤
↓
返回
```

不要负责：

```text
Warrior 分配
Warrior 移动
Attack
```

---

# 44. 与现有 A* 的边界

保持：

```text
WorldNavigator
+
TargetApproachResolver
+
AStarPathfinder
```

负责：

```text
Squad 去资源附近
```

Interaction Slot 负责：

```text
到附近以后 Warrior 具体站哪
```

不要给每个 Warrior 再运行一次完整 A*。

---

# 45. 与未来群怪战斗的边界

本轮 Slot 系统只服务：

```text
静态 WorldObject Interaction
```

未来群怪战斗使用：

```text
CombatPositionResolver
```

但复用：

```text
WarriorMotor
WarriorAnimator
单体状态
```

所以禁止 API 写成：

```ts
warriorMotor.moveToResourceSlot(...)
```

应该保持通用：

```ts
moveToLocalGridOffset(...)
```

---

# 46. Debug 日志

增加以下日志，禁止逐帧输出。

开始：

```text
[Engagement] begin squad=initial_01 target=wood_01 slots=6 assigned=4
```

分配：

```text
[InteractionSlot] warrior=0 slot=Top_0 point=(6.50, 3.58) facing=Down
```

到达：

```text
[Engagement] warrior=0 arrived slot=Top_0 attack=Down
```

取消：

```text
[Engagement] cancel target=wood_01 reforming=true
```

恢复阵型：

```text
[Engagement] reform complete squad=initial_01
```

---

# 47. Runtime Node Tree

Slot 不创建 Node。

运行时节点仍应：

```text
Squad_initial_01
├── Warrior_0
├── Warrior_1
├── Warrior_2
└── Warrior_3
```

只是 Warrior 新增：

```text
WarriorMotor Component
```

Squad 新增：

```text
SquadEngagementController Component
```

---

# 48. 推荐开发顺序

## Step 1：WarriorMotor

先完成：

```text
独立 local movement
returnToFormation
walk direction
arrived event
```

暂不接资源。

---

## Step 2：InteractionSlotResolver

实现：

```text
Tree
Stone
Food
```

Slot 生成与过滤。

通过日志验证位置。

---

## Step 3：SquadEngagementController

实现：

```text
beginInteraction
assignment
moving
individual attack
```

---

## Step 4：SquadBrain

接入：

```text
MoveToTarget
→ EngageTarget
→ AttackResource
```

删除全员统一 Attack。

---

## Step 5：Reform

实现：

```text
retarget
cancel
return home
```

---

# 49. 禁止实现

本轮禁止：

```text
Slot Node
Physics Collider
刚体
Warrior-Warrior 碰撞
推挤算法
Sprite Alpha 轮廓
每个 Warrior 全图 A*
每帧重新分配 Slot
资源拆成多个实体
Warrior 从 Squad Node 移出
Monster Combat
伤害系统
资源 HP
采集数值
```

---

# 50. Definition of Done

- [ ] SquadMotor 仍只移动 Squad Node
- [ ] WarriorMotor 只移动 Warrior localPosition
- [ ] 资源仍然是单个 WorldObject
- [ ] Slot 只是数据
- [ ] Tree / Stone / Food 都可以生成 Slot
- [ ] blocked Slot 被过滤
- [ ] Warrior 被分配到不同 Slot
- [ ] Warrior 未到 Slot 时继续 Walk
- [ ] Warrior 到达后才 Attack
- [ ] 每个 Warrior 使用自己的 slot.facing
- [ ] 不再全队共用一个攻击方向
- [ ] Slot 不足时未分配者不攻击
- [ ] 攻击中切换目标会先 Reform
- [ ] Reform 完成后 Squad 才重新出发
- [ ] ReturnHome 同样经过 Reform
- [ ] Flag 在 Engage / Attack 阶段保持存在
- [ ] 不新增 Physics
- [ ] 不新增 Slot Node
- [ ] Console 无 Error

---

# 51. Agent 完成后必须回报

```text
1. 新增 / 修改文件清单

2. 最终 commit SHA

3. WarriorMotor 完整 API

4. InteractionSlot 数据结构

5. Tree / Stone / Food 的 Slot 生成结果

6. SquadEngagementController 状态机

7. SquadBrain 新状态切换

8. 删除旧全员 playAttack 的证据

9. wood_01 实际运行日志

10. stone_01 实际运行日志

11. food_01 实际运行日志

12. 4 Warrior 贴近 2×2 资源的运行截图

13. 至少一张：
    一个 Warrior 已 Attack，
    另一个仍 Walk
    的运行截图

14. Retarget → Reform → Move 的日志

15. ReturnHome → Reform → Move 的日志

16. Console 无 Error
```

---

# 52. 最终调用链

```text
Player Click
↓
WorldCommandController
↓
SquadBrain
↓
WorldNavigator / A*
↓
SquadMotor
↓
Squad 到达资源附近
↓
SquadEngagementController
↓
InteractionSlotResolver
↓
Slot Assignment
↓
WarriorMotor × N
↓
各自到达
↓
WarriorAnimator.playAttack(slot.facing)
```

最终原则：

> **Squad 决定去哪。**

> **Warrior 决定在目标旁边具体站哪。**

> **没有真正到达合法接触位置的 Warrior，不允许播放攻击动作。**
