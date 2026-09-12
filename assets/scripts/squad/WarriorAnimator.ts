import { _decorator, Component, Sprite, type SpriteFrame } from 'cc';
import {
    WarriorDirection,
    type WarriorFrameSet,
    WARRIOR_ATTACK_FRAME_COUNT,
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
    private attackFrames: SpriteFrame[] | null = null;
    private direction = WarriorDirection.Down;
    private animationState = WarriorAnimationState.Idle;
    private frameIndex = 0;
    private frameTimer = 0;
    private walkFrameDuration = 0.15;
    private attackFrameDuration = 0.12;
    private phaseOffset = 0;

    public setup(
        sprite: Sprite,
        walkFrameSet: WarriorFrameSet,
        attackFrames: SpriteFrame[],
        phaseOffset: number,
    ): void {
        this.sprite = sprite;
        this.walkFrameSet = walkFrameSet;
        this.attackFrames = attackFrames;
        this.phaseOffset = ((Math.floor(phaseOffset) % WARRIOR_WALK_FRAME_COUNT) + WARRIOR_WALK_FRAME_COUNT)
            % WARRIOR_WALK_FRAME_COUNT;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.animationState = WarriorAnimationState.Idle;
        this.direction = WarriorDirection.Down;
        this.applyFrame();
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
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
    }

    public playWalk(direction: WarriorDirection): void {
        const directionChanged = this.direction !== direction;
        this.direction = direction;

        if (this.animationState === WarriorAnimationState.Walk && !directionChanged) {
            return;
        }

        this.animationState = WarriorAnimationState.Walk;
        this.frameTimer = 0;
        if (directionChanged) {
            this.frameIndex = 0;
        }
        this.applyFrame();
    }

    public playAttack(): void {
        if (this.animationState === WarriorAnimationState.Attack) {
            return;
        }

        this.animationState = WarriorAnimationState.Attack;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
    }

    update(dt: number): void {
        if (!this.sprite || !this.walkFrameSet || !this.attackFrames) {
            return;
        }

        if (this.animationState === WarriorAnimationState.Idle) {
            return;
        }

        const frameDuration = this.animationState === WarriorAnimationState.Attack
            ? this.attackFrameDuration
            : this.walkFrameDuration;
        const frameCount = this.animationState === WarriorAnimationState.Attack
            ? WARRIOR_ATTACK_FRAME_COUNT
            : WARRIOR_WALK_FRAME_COUNT;

        this.frameTimer += dt;
        while (this.frameTimer >= frameDuration) {
            this.frameTimer -= frameDuration;
            this.frameIndex = (this.frameIndex + 1) % frameCount;
            this.applyFrame();
        }
    }

    private applyFrame(): void {
        if (!this.sprite || !this.walkFrameSet || !this.attackFrames) {
            return;
        }

        if (this.animationState === WarriorAnimationState.Attack) {
            const displayIndex = (this.frameIndex + this.phaseOffset) % WARRIOR_ATTACK_FRAME_COUNT;
            this.sprite.spriteFrame = this.attackFrames[displayIndex] ?? null;
            return;
        }

        const walkFrames = this.walkFrameSet[this.direction];
        const displayIndex = this.animationState === WarriorAnimationState.Walk
            ? (this.frameIndex + this.phaseOffset) % WARRIOR_WALK_FRAME_COUNT
            : 0;
        this.sprite.spriteFrame = walkFrames[displayIndex] ?? null;
    }
}
