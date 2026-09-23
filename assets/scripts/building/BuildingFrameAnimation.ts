/**
 * Why this file exists:
 * 建筑状态需要在保持同一 Sprite、材质和交互反馈的前提下切换帧并循环播放。
 *
 * Ownership boundary:
 * 本文件只拥有一个 Sprite 实例的动画状态、计时器和当前帧写入。
 *
 * This file deliberately does NOT:
 * 不决定建筑业务状态、不加载资源、不修改节点变换或材质。
 */
import { _decorator, Component, Sprite, SpriteFrame } from 'cc';

const { ccclass } = _decorator;

export interface BuildingFrameClip {
    readonly frames: readonly SpriteFrame[];
    readonly frameSeconds: number;
}

export interface BuildingAnimationSet {
    readonly defaultState: string;
    readonly clips: Readonly<Record<string, BuildingFrameClip>>;
}

@ccclass('BuildingFrameAnimation')
export class BuildingFrameAnimation extends Component {
    private target: Sprite | null = null;
    private animations: BuildingAnimationSet | null = null;
    private currentState = '';
    private currentClip: BuildingFrameClip | null = null;
    private elapsed = 0;
    private frameIndex = 0;
    private readonly warnedStates = new Set<string>();

    public setup(target: Sprite, animations: BuildingAnimationSet): void {
        this.target = null;
        this.animations = null;
        this.currentClip = null;
        this.elapsed = 0;
        this.frameIndex = 0;
        if (!animations.clips[animations.defaultState]) {
            throw new Error(`[BuildingFrameAnimation] default state missing: ${animations.defaultState}`);
        }
        for (const [state, clip] of Object.entries(animations.clips)) {
            if (clip.frames.length === 0 || !Number.isFinite(clip.frameSeconds) || clip.frameSeconds <= 0) {
                throw new Error(`[BuildingFrameAnimation] invalid clip: ${state}`);
            }
        }
        this.target = target;
        this.animations = animations;
        this.setState(animations.defaultState, true);
    }

    public setState(state: string, restart = false): void {
        if (!this.animations) return;
        const resolved = this.animations.clips[state]
            ? state
            : this.animations.defaultState;
        if (!this.animations.clips[state] && !this.warnedStates.has(state)) {
            this.warnedStates.add(state);
            console.warn(`[BuildingFrameAnimation] unknown state "${state}", using "${resolved}".`);
        }
        if (resolved === this.currentState && !restart) return;
        this.currentState = resolved;
        this.currentClip = this.animations.clips[resolved] ?? null;
        this.elapsed = 0;
        this.frameIndex = 0;
        this.applyFrame(0);
    }

    protected update(dt: number): void {
        const clip = this.currentClip;
        if (!clip || !this.target || clip.frames.length <= 1 || !Number.isFinite(dt) || dt <= 0) return;
        const duration = clip.frameSeconds * clip.frames.length;
        this.elapsed = (this.elapsed + dt) % duration;
        const next = Math.floor(this.elapsed / clip.frameSeconds);
        if (next !== this.frameIndex) {
            this.frameIndex = next;
            this.applyFrame(next);
        }
    }

    protected onDestroy(): void {
        this.target = null;
        this.animations = null;
        this.currentClip = null;
        this.warnedStates.clear();
    }

    private applyFrame(index: number): void {
        const frame = this.currentClip?.frames[index];
        if (frame && this.target) this.target.spriteFrame = frame;
    }
}
