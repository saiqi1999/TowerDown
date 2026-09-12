import { _decorator, Component, Sprite } from 'cc';
import {
    WarriorDirection,
    type WarriorAttackFrameSet,
    type WarriorFrameSet,
    WARRIOR_WALK_FRAME_COUNT,
} from './WarriorSpriteConfig';

const { ccclass } = _decorator;

export enum WarriorAnimationState {
    Idle = 0,
    Walk = 1,
    Attack = 2,
}

@ccclass('WarriorAnimator')
export class WarriorAnimator extends Component {
    private sprite: Sprite | null = null;
    private walkFrameSet: WarriorFrameSet | null = null;
    private attackFrameSet: WarriorAttackFrameSet | null = null;
    private direction = WarriorDirection.Down;
    private animationState = WarriorAnimationState.Idle;
    private walkFrameIndex = 0;
    private attackPhase = 0;
    private frameTimer = 0;
    private walkFrameDuration = 0.15;
    private attackFrameDuration = 0.15;
    private walkPhaseOffset = 0;
    private attackPhaseOffset = 0;
    private attackImpactHandler: (() => void) | null = null;
    private attackPoseVisible = false;

    // Walk 是 4 帧循环，Attack 是 2 帧循环，历史上共用一个 phaseOffset 会把两种周期混在一起。
    public setup(
        sprite: Sprite,
        walkFrameSet: WarriorFrameSet,
        attackFrameSet: WarriorAttackFrameSet,
        walkPhaseOffset: number,
        attackPhaseOffset: number,
    ): void {
        this.sprite = sprite;
        this.walkFrameSet = walkFrameSet;
        this.attackFrameSet = attackFrameSet;
        this.walkPhaseOffset = ((Math.floor(walkPhaseOffset) % WARRIOR_WALK_FRAME_COUNT)
            + WARRIOR_WALK_FRAME_COUNT) % WARRIOR_WALK_FRAME_COUNT;
        this.attackPhaseOffset = ((Math.floor(attackPhaseOffset) % 2) + 2) % 2;
        this.walkFrameIndex = 0;
        this.attackPhase = 0;
        this.frameTimer = 0;
        this.animationState = WarriorAnimationState.Idle;
        this.direction = WarriorDirection.Down;
        this.attackImpactHandler = null;
        this.attackPoseVisible = false;
        this.applyFrame();
    }

    public bindAttackImpactHandler(
        handler: (() => void) | null,
    ): void {
        this.attackImpactHandler = handler;
    }

    public playIdle(direction?: WarriorDirection): void {
        if (direction !== undefined) {
            this.direction = direction;
        }

        if (this.animationState === WarriorAnimationState.Idle) {
            this.applyFrame();
            return;
        }

        this.animationState = WarriorAnimationState.Idle;
        this.walkFrameIndex = 0;
        this.attackPhase = 0;
        this.frameTimer = 0;
        this.attackPoseVisible = false;
        this.applyFrame();
    }

    public playWalk(direction: WarriorDirection): void {
        const directionChanged = this.direction !== direction;
        this.direction = direction;

        if (this.animationState === WarriorAnimationState.Walk && !directionChanged) {
            return;
        }

        this.animationState = WarriorAnimationState.Walk;
        this.walkFrameIndex = 0;
        this.attackPhase = 0;
        this.frameTimer = 0;
        this.attackPoseVisible = false;
        this.applyFrame();
    }

    // Attack 图的 4 列代表方向而不是时间，因此攻击动画要在“站姿帧”和“方向 Pose”之间切换。
    public playAttack(direction: WarriorDirection): void {
        const directionChanged = this.direction !== direction;
        this.direction = direction;

        if (this.animationState === WarriorAnimationState.Attack) {
            // 同方向重复 playAttack 不应重置相位，否则一个到位事件会平白多制造一次命中。
            if (directionChanged) {
                this.applyFrame();
            }
            return;
        }

        this.animationState = WarriorAnimationState.Attack;
        this.walkFrameIndex = 0;
        this.attackPhase = 0;
        this.frameTimer = 0;
        this.attackPoseVisible = false;
        this.applyFrame();
    }

    update(dt: number): void {
        if (!this.sprite || !this.walkFrameSet || !this.attackFrameSet) {
            return;
        }

        if (this.animationState === WarriorAnimationState.Idle) {
            return;
        }

        if (this.animationState === WarriorAnimationState.Attack) {
            this.frameTimer += dt;
            while (this.frameTimer >= this.attackFrameDuration) {
                this.frameTimer -= this.attackFrameDuration;
                this.attackPhase = (this.attackPhase + 1) % 2;
                this.applyFrame();
            }
            return;
        }

        this.frameTimer += dt;
        while (this.frameTimer >= this.walkFrameDuration) {
            this.frameTimer -= this.walkFrameDuration;
            this.walkFrameIndex = (this.walkFrameIndex + 1) % WARRIOR_WALK_FRAME_COUNT;
            this.applyFrame();
        }
    }

    private applyFrame(): void {
        if (!this.sprite || !this.walkFrameSet || !this.attackFrameSet) {
            return;
        }

        if (this.animationState === WarriorAnimationState.Attack) {
            const displayPhase = (this.attackPhase + this.attackPhaseOffset) % 2;
            const nextAttackPoseVisible = displayPhase === 1;
            if (nextAttackPoseVisible && !this.attackPoseVisible) {
                this.attackImpactHandler?.();
            }
            this.attackPoseVisible = nextAttackPoseVisible;
            this.sprite.spriteFrame = displayPhase === 0
                ? this.walkFrameSet[this.direction][0] ?? null
                : this.attackFrameSet[this.direction] ?? null;
            return;
        }

        this.attackPoseVisible = false;
        const walkFrames = this.walkFrameSet[this.direction];
        const displayIndex = this.animationState === WarriorAnimationState.Walk
            ? (this.walkFrameIndex + this.walkPhaseOffset) % WARRIOR_WALK_FRAME_COUNT
            : 0;
        this.sprite.spriteFrame = walkFrames[displayIndex] ?? null;
    }
}
