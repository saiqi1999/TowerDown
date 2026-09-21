/**
 * Why this file exists:
 * 基地达到击杀阈值后需要统一管理换图、点击打开和返回关闭。
 *
 * Ownership boundary:
 * 本文件拥有基地就绪订阅、SpriteFrame 切换、单例面板和输入阻断状态。
 *
 * This file deliberately does NOT:
 * 不处理怪物伤害、不重置场景、不暂停后台模拟，也不发回城命令。
 */
import { SpriteFrame } from 'cc';
import { EnemyKillCounter, type EnemyKillSnapshot } from '../../combat/EnemyKillCounter';
import { BasePanelView } from './BasePanelView';

export class BaseInteractionController {
    private unsubscribe: (() => void) | null = null;
    private baseSpriteFrameSetter: ((frame: SpriteFrame) => void) | null = null;
    private idleFrame: SpriteFrame | null = null;
    private readyFrame: SpriteFrame | null = null;
    private openState = false;
    private ready = false;
    private panel: BasePanelView | null = null;
    private onOpenStateChanged: ((open: boolean) => void) | null = null;

    constructor(private readonly counter: EnemyKillCounter) {}

    public setup(config: {
        setBaseSpriteFrame: (frame: SpriteFrame) => void;
        idleFrame: SpriteFrame;
        readyFrame: SpriteFrame;
        panel: BasePanelView;
        onOpenStateChanged?: (open: boolean) => void;
    }): void {
        this.baseSpriteFrameSetter = config.setBaseSpriteFrame;
        this.idleFrame = config.idleFrame;
        this.readyFrame = config.readyFrame;
        this.panel = config.panel;
        this.onOpenStateChanged = config.onOpenStateChanged ?? null;
        this.baseSpriteFrameSetter(config.idleFrame);
        this.unsubscribe = this.counter.subscribe((snapshot) => this.onCounterChanged(snapshot));
    }

    public isOpen(): boolean {
        return this.openState;
    }

    public isReady(): boolean {
        return this.ready;
    }

    public open(): void {
        if (!this.ready || this.openState || !this.panel) return;
        this.openState = true;
        this.onOpenStateChanged?.(true);
        this.panel.setVisible(true);
    }

    public close(): void {
        if (!this.openState) return;
        this.openState = false;
        this.panel?.setVisible(false);
        this.onOpenStateChanged?.(false);
    }

    public getHoverFooter(): string {
        return this.ready
            ? `击败敌人 ${Math.min(this.counter.getCount(), this.counter.getSnapshot().requiredKills)} / ${this.counter.getSnapshot().requiredKills} · 点击打开`
            : `击败敌人 ${Math.min(this.counter.getCount(), this.counter.getSnapshot().requiredKills)} / ${this.counter.getSnapshot().requiredKills}`;
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.panel?.dispose();
        this.panel = null;
        this.baseSpriteFrameSetter = null;
        this.idleFrame = null;
        this.readyFrame = null;
        this.onOpenStateChanged = null;
    }

    private onCounterChanged(snapshot: EnemyKillSnapshot): void {
        this.ready = snapshot.ready;
        if (this.baseSpriteFrameSetter) {
            this.baseSpriteFrameSetter(this.ready && this.readyFrame
                ? this.readyFrame
                : this.idleFrame);
        }
    }
}
