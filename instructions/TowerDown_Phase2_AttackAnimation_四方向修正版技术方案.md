# 《深处的文明 / TowerDown》Phase 2 攻击动画修正版技术方案
## 四方向攻击 Pose + 两帧循环攻击

> 适用仓库：`saiqi1999/TowerDown`  
> 适用阶段：Squad Phase 2  
> 目标：修正当前对 `warrior_sword_attack.png` 的错误理解。该图片不是“同一方向的 4 帧攻击动画”，而是“4 个方向各 1 个攻击 Pose”。最终每个方向使用：
>
> ```text
> Walk Sheet 对应方向的第 0 帧
> ↕
> Attack Sheet 对应方向的攻击 Pose
> ```
>
> 组成一个 **2 帧循环攻击动画**。
>
> 本轮不修改寻路、旗帜、目标选择、资源 HP、攻击伤害或采集结算。

---

# 1. 当前问题

当前代码把：

```text
warrior_sword_attack.png
64 × 16
```

解释为：

```text
Attack Frame 0
Attack Frame 1
Attack Frame 2
Attack Frame 3
```

并按时间循环播放。

这是错误语义。

正确语义是：

```text
col 0 = Down Attack Pose
col 1 = Up Attack Pose
col 2 = Left Attack Pose
col 3 = Right Attack Pose
```

每列：

```text
16 × 16
```

所以该图实际上是：

```text
Down | Up | Left | Right
```

而不是：

```text
Frame0 | Frame1 | Frame2 | Frame3
```

---

# 2. 最终攻击动画定义

Walk Sheet 已有：

```text
4 columns × 4 rows
```

并且：

```text
column = direction
row = animation frame
```

因此每个方向的：

```text
walkFrameSet[direction][0]
```

可以直接作为攻击中的“收招 / 站姿帧”。

最终：

```text
Down:
walk(Down, row0)
↔
attack(Down)

Up:
walk(Up, row0)
↔
attack(Up)

Left:
walk(Left, row0)
↔
attack(Left)

Right:
walk(Right, row0)
↔
attack(Right)
```

也就是：

> **每个方向只有 2 帧攻击循环。**

---

# 3. 本轮修改文件

建议修改：

```text
assets/scripts/squad/
├── WarriorSpriteConfig.ts
├── WarriorAnimator.ts
├── SquadBrain.ts
├── SquadMotor.ts
└── SquadRenderer.ts
```

建议新增：

```text
assets/scripts/squad/
└── WarriorDirectionUtils.ts
```

不需要新增：

```text
Texture
Sprite Sheet
Scene Node
Inspector Property
```

现有：

```text
warrior_sword_attack.png
```

继续使用即可。

---

# 4. 用户需要操作的内容

本轮原则上不需要额外手工配置。

只确认：

```text
warrior_sword_attack.png
```

在 Cocos Import Settings 中仍然是：

```text
Min Filter = Nearest
Mag Filter = Nearest
Mip Filter = None
```

如果当前已经如此，不需要再操作。

---

# 5. 下级 Agent 开发目标

本轮必须实现四件事：

```text
1. Attack Sheet 按“方向”切片，而不是按“时间帧”切片

2. WarriorAnimator Attack 状态变为两帧循环：
   Idle Pose ↔ Attack Pose

3. Squad 到达资源后，根据资源相对 Squad 的方向选择攻击方向

4. Walk 和 Attack 共用同一套方向判定函数
```

---

# 6. WarriorSpriteConfig.ts 修改

当前类似：

```ts
export const WARRIOR_ATTACK_FRAME_COUNT = 4;
```

以及：

```ts
createWarriorAttackFrame(
    texture,
    frameIndex
)
```

都需要修改。

## 6.1 删除旧语义

删除：

```ts
export const WARRIOR_ATTACK_FRAME_COUNT = 4;
```

不要再认为 Attack 有四个时间帧。

## 6.2 新增 Attack FrameSet 类型

建议：

```ts
export type WarriorAttackFrameSet =
    Record<WarriorDirection, SpriteFrame>;
```

Walk 仍然保持：

```ts
export type WarriorFrameSet =
    Record<WarriorDirection, SpriteFrame[]>;
```

## 6.3 Attack 切片函数

修改为：

```ts
export function createWarriorAttackFrame(
    texture: Texture2D,
    direction: WarriorDirection,
): SpriteFrame
```

内部：

```ts
const column = DIRECTION_COLUMN[direction];

const rect = new Rect(
    column * WARRIOR_FRAME_SIZE,
    0,
    WARRIOR_FRAME_SIZE,
    WARRIOR_FRAME_SIZE,
);
```

也就是：

```text
Down  → x = 0
Up    → x = 16
Left  → x = 32
Right → x = 48
```

统一：

```text
y = 0
w = 16
h = 16
```

---

# 7. SquadRenderer.ts 修改

当前 `getOrCreateAttackFrames()` 返回：

```ts
SpriteFrame[]
```

应改为：

```ts
WarriorAttackFrameSet
```

## 7.1 推荐实现

```ts
private getOrCreateAttackFrameSet():
    WarriorAttackFrameSet {

    return {
        [WarriorDirection.Down]:
            this.getAttackFrame(
                WarriorDirection.Down
            ),

        [WarriorDirection.Up]:
            this.getAttackFrame(
                WarriorDirection.Up
            ),

        [WarriorDirection.Left]:
            this.getAttackFrame(
                WarriorDirection.Left
            ),

        [WarriorDirection.Right]:
            this.getAttackFrame(
                WarriorDirection.Right
            ),
    };
}
```

## 7.2 Cache Key

当前：

```text
attack_0
attack_1
attack_2
attack_3
```

可以继续使用类似结构，但语义改为：

```text
attack_dir_0
attack_dir_1
attack_dir_2
attack_dir_3
```

例如：

```ts
const key = `attack_dir_${direction}`;
```

## 7.3 Animator Setup

当前：

```ts
animator.setup(
    sprite,
    walkFrameSet,
    attackFrames,
    phaseOffset,
);
```

改为：

```ts
animator.setup(
    sprite,
    walkFrameSet,
    attackFrameSet,
    walkPhaseOffset,
    attackPhaseOffset,
);
```

---

# 8. 两帧攻击的 Phase Offset

原来 Walk 的：

```text
PHASE_OFFSETS = [0, 2, 1, 3]
```

可以继续用于 Walk。

但 Attack 只有两帧。

建议单独定义：

```ts
const ATTACK_PHASE_OFFSETS = [
    0,
    1,
    1,
    0,
] as const;
```

这样：

```text
Warrior 0 / 3
和
Warrior 1 / 2
```

不会完全同步挥剑。

不要直接把 0/2/1/3 硬套进 Attack 逻辑。

---

# 9. WarriorAnimator.ts 状态

继续保留：

```ts
export enum WarriorAnimationState {
    Idle,
    Walk,
    Attack,
}
```

但 Attack 播放逻辑需要重写。

---

# 10. WarriorAnimator 新字段

建议：

```ts
private walkFrameSet:
    WarriorFrameSet | null = null;

private attackFrameSet:
    WarriorAttackFrameSet | null = null;

private direction =
    WarriorDirection.Down;

private attackPhase = 0;

private attackPhaseOffset = 0;
```

---

# 11. setup()

推荐：

```ts
public setup(
    sprite: Sprite,
    walkFrameSet: WarriorFrameSet,
    attackFrameSet: WarriorAttackFrameSet,
    walkPhaseOffset: number,
    attackPhaseOffset: number,
): void
```

不要让一个 `phaseOffset` 同时承担：

```text
Walk 4 帧
Attack 2 帧
```

两个不同周期。

---

# 12. playAttack()

当前：

```ts
playAttack()
```

必须改为：

```ts
public playAttack(
    direction: WarriorDirection
): void
```

进入 Attack 时：

```ts
this.direction = direction;
this.animationState =
    WarriorAnimationState.Attack;

this.attackPhase = 0;
this.frameTimer = 0;
this.applyFrame();
```

---

# 13. Attack 动画播放规则

推荐：

```text
phase 0:
walkFrameSet[direction][0]

phase 1:
attackFrameSet[direction]
```

然后：

```text
0 → 1 → 0 → 1 ...
```

## 13.1 最简单实现

统一：

```text
0.15 sec / phase
```

因此完整攻击循环：

```text
0.30 sec
```

这里只有视觉含义，不代表最终战斗攻速。

未来真实攻击频率必须与动画播放逻辑解耦。

## 13.2 Animator update

Attack：

```ts
if (
    this.animationState
    === WarriorAnimationState.Attack
) {
    this.frameTimer += dt;

    if (
        this.frameTimer
        >= this.attackFrameDuration
    ) {
        this.frameTimer
            -= this.attackFrameDuration;

        this.attackPhase =
            (this.attackPhase + 1) % 2;

        this.applyFrame();
    }

    return;
}
```

---

# 14. applyFrame()

Attack：

```ts
if (
    this.animationState
    === WarriorAnimationState.Attack
) {
    const displayPhase =
        (
            this.attackPhase
            + this.attackPhaseOffset
        ) % 2;

    if (displayPhase === 0) {
        this.sprite.spriteFrame =
            this.walkFrameSet[
                this.direction
            ][0];
    } else {
        this.sprite.spriteFrame =
            this.attackFrameSet[
                this.direction
            ];
    }

    return;
}
```

---

# 15. Attack 退出

以下情况必须退出 Attack：

```text
玩家切换目标
玩家取消目标
Squad ReturnHome
Squad 开始移动
```

只要：

```text
SquadMotor.setPath()
```

触发：

```text
playWalk(direction)
```

就应该自然从：

```text
Attack
→
Walk
```

同理：

```text
motor.stop()
```

进入：

```text
Idle
```

---

# 16. 攻击方向计算

当前 Squad 到达 Resource 后：

```text
MoveToTarget
↓
AttackResource
```

必须先确定：

```text
资源在 Squad 哪边
```

---

# 17. 不允许复制方向算法

当前：

```text
SquadMotor
```

内部已有方向判断。

不要让：

```text
SquadBrain
```

再复制一份。

本轮新增：

```text
WarriorDirectionUtils.ts
```

---

# 18. WarriorDirectionUtils.ts

新增：

```ts
import {
    WarriorDirection,
} from './WarriorSpriteConfig';

export function resolveWarriorDirection(
    dx: number,
    dy: number,
    fallback = WarriorDirection.Down,
): WarriorDirection {
    if (
        Math.abs(dx) < 0.0001
        &&
        Math.abs(dy) < 0.0001
    ) {
        return fallback;
    }

    if (
        Math.abs(dx) > Math.abs(dy)
    ) {
        return dx < 0
            ? WarriorDirection.Left
            : WarriorDirection.Right;
    }

    return dy < 0
        ? WarriorDirection.Up
        : WarriorDirection.Down;
}
```

注意本项目 Grid：

```text
+X = Right
+Y = Down
```

所以：

```text
dy < 0 → Up
dy > 0 → Down
```

---

# 19. SquadMotor.ts 修改

删除 / 替换内部：

```ts
private resolveDirection(...)
private resolveDirectionTo(...)
```

统一使用：

```ts
resolveWarriorDirection(
    dx,
    dy,
    this.lastDirection,
)
```

这样 Walk 和 Attack 的方向语义完全一致。

---

# 20. SquadBrain.ts 到达 Resource 后

当前逻辑类似：

```ts
if (this.motor.consumeArrived()) {
    this.state =
        SquadBrainState.AttackResource;

    this.playAttack();
}
```

改为：

```text
1. 获取 currentTarget
2. 获取 target visual size
3. 算 target center
4. 获取 Squad current position
5. 算 dx/dy
6. resolveWarriorDirection
7. playAttack(direction)
```

---

# 21. Target Center 计算

必须使用：

```text
WorldVisualDefinition.w/h
```

不要假设：

```text
target 是 1×1
```

例如：

```ts
const visual =
    getWorldVisualDefinition(
        target.visualId
    );

const targetCenterX =
    target.gridX + visual.w / 2;

const targetCenterY =
    target.gridY + visual.h / 2;
```

---

# 22. Squad Position

使用：

```ts
const squadPosition =
    this.motor.getGridPosition();
```

然后：

```ts
const dx =
    targetCenterX
    - squadPosition.x;

const dy =
    targetCenterY
    - squadPosition.y;
```

---

# 23. 攻击方向示例

如果小队在资源左侧：

```text
Squad → Resource
```

则：

```text
dx > 0
→ Right
```

播放：

```text
Right Idle Pose
↔
Right Attack Pose
```

如果在资源右侧：

```text
Resource ← Squad
```

则：

```text
dx < 0
→ Left
```

如果在资源下方：

```text
Resource
   ↑
 Squad
```

Grid 中：

```text
targetY < squadY
→ dy < 0
→ Up
```

如果在资源上方：

```text
 Squad
   ↓
Resource
```

则：

```text
dy > 0
→ Down
```

---

# 24. SquadBrain.playAttack()

当前：

```ts
private playAttack(): void
```

改为：

```ts
private playAttack(
    direction: WarriorDirection
): void {
    for (
        const warrior
        of this.warriors
    ) {
        warrior.playAttack(
            direction
        );
    }
}
```

---

# 25. currentTarget 校验

进入：

```text
AttackResource
```

前必须确认：

```ts
this.currentTargetId !== null
```

并从：

```text
worldObjectById
```

拿到 target。

如果 target 不存在：

```text
console.warn
↓
clear command
↓
return home / idle
```

不要直接 crash。

---

# 26. 不修改 AttackResource 状态语义

本轮仍然：

```text
AttackResource
=
无限循环视觉攻击
```

不增加：

```text
Damage
Resource HP
Resource Amount
Attack Tick
Harvest
```

---

# 27. 不修改寻路目标

仍然：

```text
Resource footprint
=
blocked

Squad
=
走到 Approach Cell
```

然后根据：

```text
Approach Cell
→ Target Center
```

确定最终攻击方向。

不要让 Squad 进入 Resource footprint。

---

# 28. 不需要新增四张攻击 Texture

当前：

```text
warrior_sword_attack.png
```

已经包含：

```text
Down
Up
Left
Right
```

所以禁止创建：

```text
warrior_attack_down.png
warrior_attack_up.png
warrior_attack_left.png
warrior_attack_right.png
```

继续使用一个 Texture。

---

# 29. 不需要 Sprite Flip

由于左右方向都有真实 Pose：

```text
Left
Right
```

所以不要：

```text
scaleX = -1
```

做左右镜像。

同样不要旋转 Attack Sprite。

---

# 30. 最终 SpriteFrame 结构

最终一名剑士共享：

```text
Walk:
4 directions
×
4 frames
=
16 SpriteFrames

Attack:
4 directions
×
1 pose
=
4 SpriteFrames
```

总计：

```text
20 SpriteFrames
```

全 Squad 共享。

---

# 31. 最终 Animator 状态关系

```text
             ┌─────────┐
             │  Idle   │
             └────┬────┘
                  │ move
                  ↓
             ┌─────────┐
             │  Walk   │
             └────┬────┘
                  │ arrive resource
                  ↓
             ┌─────────┐
             │ Attack  │
             └────┬────┘
                  │ new command
                  ↓
                 Walk
```

Attack：

```text
direction 保持固定
```

直到：

```text
新命令
取消
返家
```

---

# 32. 与 Flag / Command 系统关系

本轮不要修改：

```text
WorldCommandController
TargetFlagView
NavigationGrid
AStarPathfinder
WorldNavigator
```

除非修复编译依赖。

流程继续：

```text
Click Resource
↓
Command
↓
Path
↓
Motor
↓
Arrive
↓
Brain calculates attack direction
↓
WarriorAnimator Attack
```

---

# 33. Definition of Done

下级 Agent 完成后必须满足：

- [ ] `warrior_sword_attack.png` 被解释为 4 个方向，而不是 4 个时间帧
- [ ] Down Attack 使用 attack col 0
- [ ] Up Attack 使用 attack col 1
- [ ] Left Attack 使用 attack col 2
- [ ] Right Attack 使用 attack col 3
- [ ] 每个方向攻击为 2 帧循环
- [ ] 第 1 帧来自 Walk Sheet 对应方向 row 0
- [ ] 第 2 帧来自 Attack Sheet 对应方向 Pose
- [ ] Squad 位于资源左侧时向右攻击
- [ ] Squad 位于资源右侧时向左攻击
- [ ] Squad 位于资源下方时向上攻击
- [ ] Squad 位于资源上方时向下攻击
- [ ] Walk 与 Attack 共用 `resolveWarriorDirection`
- [ ] 不复制两套方向判定
- [ ] 不旋转 Sprite
- [ ] 不镜像 Sprite
- [ ] 不增加新攻击 Texture
- [ ] 4 名 Warrior 攻击不同步
- [ ] 新命令可立即从 Attack 切回 Walk
- [ ] 取消后可正常 ReturnHome

---

# 34. Agent 回报要求

完成后回报：

```text
1. 修改文件清单

2. 最终 commit SHA

3. WarriorSpriteConfig 中 Attack FrameSet 定义

4. WarriorAnimator 的 Attack 两帧状态实现

5. resolveWarriorDirection 所在文件

6. SquadBrain 到达目标后的方向计算代码

7. 四个方向至少各一张运行截图：
   Down
   Up
   Left
   Right

8. 确认攻击图未被当作 4 帧时间序列

9. 确认没有新增攻击 Texture

10. Console 无 Error
```

---

# 35. Code Review 搜索项

Review 时搜索：

```text
WARRIOR_ATTACK_FRAME_COUNT
```

预期：

> 应删除旧的“4 时间帧”语义。

搜索：

```text
createWarriorAttackFrame
```

预期参数包含：

```text
direction
```

而不是：

```text
frameIndex
```

搜索：

```text
playAttack(
```

预期：

```text
playAttack(direction)
```

搜索：

```text
resolveDirection
```

预期：

> SquadMotor / SquadBrain 不应各自保留独立实现。

统一走：

```text
resolveWarriorDirection
```

---

# 36. 最终设计结果

修正后：

```text
Walk Sheet
      ↓
Direction Idle Pose
      │
      ├──────────────┐
      │              │
      ↓              ↓
Idle             Attack Loop
                  │
                  ├→ Idle Pose
                  └→ Attack Pose
```

Attack Sheet：

```text
Down | Up | Left | Right
```

Squad：

```text
到达资源周边
↓
根据 Target Center 判断方向
↓
选择对应 Attack Pose
↓
2帧循环
```

核心原则：

> **攻击方向由战场位置决定。**

> **Attack Sheet 的四列代表方向，不代表时间。**

> **攻击动画由“站姿 + 攻击姿势”组合而成，不额外伪造动画帧。**
