import { _decorator, Component, Sprite } from 'cc';
import { MonsterDirection } from './MonsterSpriteConfig';

const { ccclass } = _decorator;
export enum MonsterAnimationState { Idle = 0, Move = 1, Dead = 2 }

import { type SpriteFrame } from 'cc';
export type MonsterFrameSet = Record<MonsterDirection, SpriteFrame[]>;

@ccclass('MonsterAnimator')
export class MonsterAnimator extends Component {
    private sprite: Sprite | null = null;
    private frames: MonsterFrameSet | null = null;
    private state = MonsterAnimationState.Idle;
    private direction = MonsterDirection.Down;
    private frame = 0;
    private timer = 0;
    private duration = 0.14;

    public setup(sprite: Sprite, frames: MonsterFrameSet, duration: number, direction: MonsterDirection): void {
        this.sprite = sprite;
        this.frames = frames;
        this.duration = duration;
        this.direction = direction;
        this.state = MonsterAnimationState.Idle;
        this.apply();
    }
    public playIdle(direction = this.direction): void { this.state = MonsterAnimationState.Idle; this.direction = direction; this.frame = 0; this.timer = 0; this.apply(); }
    public playMove(direction: MonsterDirection): void { this.state = MonsterAnimationState.Move; this.direction = direction; this.apply(); }
    public playDead(): void { this.state = MonsterAnimationState.Dead; this.apply(); }
    update(dt: number): void {
        if (this.state !== MonsterAnimationState.Move || !this.frames) return;
        this.timer += dt;
        while (this.timer >= this.duration) { this.timer -= this.duration; this.frame = (this.frame + 1) % 4; this.apply(); }
    }
    private apply(): void {
        const frames = this.frames?.[this.direction];
        if (frames) this.sprite!.spriteFrame = frames[this.state === MonsterAnimationState.Dead ? 0 : this.frame] ?? null;
    }
}
