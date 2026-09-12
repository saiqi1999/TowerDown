import { _decorator, Component, Sprite } from 'cc';
import {
    WarriorDirection,
    type WarriorFrameSet,
    WARRIOR_WALK_FRAME_COUNT,
} from './WarriorSpriteConfig';

const { ccclass } = _decorator;

@ccclass('WarriorAnimator')
export class WarriorAnimator extends Component {
    private sprite: Sprite | null = null;
    private frameSet: WarriorFrameSet | null = null;
    private direction = WarriorDirection.Down;
    private moving = false;
    private frameIndex = 0;
    private frameTimer = 0;
    private frameDuration = 0.15;
    private phaseOffset = 0;

    public setup(
        sprite: Sprite,
        frameSet: WarriorFrameSet,
        phaseOffset: number,
    ): void {
        this.sprite = sprite;
        this.frameSet = frameSet;
        this.phaseOffset = ((Math.floor(phaseOffset) % WARRIOR_WALK_FRAME_COUNT) + WARRIOR_WALK_FRAME_COUNT)
            % WARRIOR_WALK_FRAME_COUNT;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
    }

    public setDirection(direction: WarriorDirection): void {
        if (this.direction === direction) {
            return;
        }

        this.direction = direction;
        this.applyFrame();
    }

    public setMoving(moving: boolean): void {
        if (this.moving === moving) {
            return;
        }

        this.moving = moving;
        this.frameTimer = 0;
        if (!moving) {
            this.frameIndex = 0;
        }
        this.applyFrame();
    }

    update(dt: number): void {
        if (!this.moving || !this.sprite || !this.frameSet) {
            return;
        }

        this.frameTimer += dt;
        while (this.frameTimer >= this.frameDuration) {
            this.frameTimer -= this.frameDuration;
            this.frameIndex = (this.frameIndex + 1) % WARRIOR_WALK_FRAME_COUNT;
            this.applyFrame();
        }
    }

    private applyFrame(): void {
        if (!this.sprite || !this.frameSet) {
            return;
        }

        const frames = this.frameSet[this.direction];
        const displayIndex = this.moving
            ? (this.frameIndex + this.phaseOffset) % WARRIOR_WALK_FRAME_COUNT
            : 0;
        this.sprite.spriteFrame = frames[displayIndex] ?? null;
    }
}
