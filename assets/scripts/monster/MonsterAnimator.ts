import { _decorator, Component, Sprite } from 'cc';
import {
    MonsterDirection,
    MONSTER_FRAME_COUNT,
    type MonsterFrameSet,
} from './MonsterSpriteConfig';

const { ccclass } = _decorator;
export enum MonsterAnimationState { Idle = 0, Move = 1, Attack = 2, Dead = 3 }
export type MonsterAttackImpactListener = () => void;

@ccclass('MonsterAnimator')
export class MonsterAnimator extends Component {
    private sprite: Sprite | null = null;
    private moveFrames: MonsterFrameSet | null = null;
    private attackFrames: MonsterFrameSet | null = null;
    private state = MonsterAnimationState.Idle;
    private direction = MonsterDirection.Down;
    private frame = 0;
    private timer = 0;
    private moveFrameDuration = 0.14;
    private attackFrameDuration = 0.12;
    private attackHitFrame = 2;
    private attackHitSent = false;
    private readonly impactListeners = new Set<MonsterAttackImpactListener>();

    public setup(
        sprite: Sprite,
        moveFrames: MonsterFrameSet,
        attackFrames: MonsterFrameSet,
        moveFrameDuration: number,
        attackFrameDuration: number,
        attackHitFrame: number,
        direction: MonsterDirection,
    ): void {
        this.sprite = sprite;
        this.moveFrames = moveFrames;
        this.attackFrames = attackFrames;
        this.moveFrameDuration = moveFrameDuration;
        this.attackFrameDuration = attackFrameDuration;
        this.attackHitFrame = Math.max(0, Math.min(MONSTER_FRAME_COUNT - 1, attackHitFrame));
        this.direction = direction;
        this.state = MonsterAnimationState.Idle;
        this.frame = 0;
        this.timer = 0;
        this.attackHitSent = false;
        this.apply();
    }
    public subscribeAttackImpact(listener: MonsterAttackImpactListener): () => void {
        const listeners = this.impactListeners;
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }
    public playIdle(direction = this.direction): void { this.setState(MonsterAnimationState.Idle, direction); }
    public playMove(direction: MonsterDirection): void {
        if (this.state !== MonsterAnimationState.Move || this.direction !== direction) {
            this.setState(MonsterAnimationState.Move, direction);
        }
    }
    public playAttack(direction: MonsterDirection): void {
        if (this.state === MonsterAnimationState.Attack) {
            this.direction = direction;
            return;
        }
        this.setState(MonsterAnimationState.Attack, direction);
    }
    public playDead(): void { this.state = MonsterAnimationState.Dead; this.frame = 0; this.timer = 0; this.apply(); }
    update(dt: number): void {
        if (this.state === MonsterAnimationState.Idle || this.state === MonsterAnimationState.Dead) return;
        const duration = this.state === MonsterAnimationState.Attack ? this.attackFrameDuration : this.moveFrameDuration;
        this.timer += dt;
        while (this.timer >= duration) {
            this.timer -= duration;
            this.frame += 1;
            if (this.state === MonsterAnimationState.Attack
                && this.frame >= MONSTER_FRAME_COUNT) {
                this.state = MonsterAnimationState.Idle;
                this.frame = 0;
                this.attackHitSent = false;
            } else {
                this.frame %= MONSTER_FRAME_COUNT;
            }
            this.apply();
        }
    }
    private apply(): void {
        const frames = this.state === MonsterAnimationState.Attack
            ? this.attackFrames?.[this.direction]
            : this.moveFrames?.[this.direction];
        if (!frames || !this.sprite) return;
        this.sprite.spriteFrame = frames[this.frame] ?? null;
        if (this.state === MonsterAnimationState.Attack && this.frame === this.attackHitFrame && !this.attackHitSent) {
            this.attackHitSent = true;
            for (const listener of this.impactListeners) listener();
        }
    }
    private setState(state: MonsterAnimationState, direction: MonsterDirection): void {
        this.state = state;
        this.direction = direction;
        this.frame = 0;
        this.timer = 0;
        this.attackHitSent = false;
        this.apply();
    }
}
