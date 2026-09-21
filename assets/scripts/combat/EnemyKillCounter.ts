/**
 * Why this file exists:
 * 当前场景需要按敌人成员的真实死亡边沿累计击杀，并在达到阈值后提供稳定的基地就绪状态。
 *
 * Ownership boundary:
 * 本文件只拥有有效敌人 ID 去重、击杀计数和订阅通知。
 *
 * This file deliberately does NOT:
 * 不监听 CombatEventHub、不销毁单位、不控制基地视觉或面板。
 */
export interface EnemyKillSnapshot {
    readonly count: number;
    readonly requiredKills: number;
    readonly ready: boolean;
}

export type EnemyKillListener = (snapshot: EnemyKillSnapshot) => void;

export class EnemyKillCounter {
    private readonly validEnemyIds: ReadonlySet<string>;
    private readonly defeatedIds = new Set<string>();
    private readonly listeners = new Set<EnemyKillListener>();
    private readonly requiredKills: number;

    constructor(validEnemyIds: readonly string[], requiredKills = 3) {
        if (requiredKills <= 0) {
            throw new Error(`[EnemyKillCounter] requiredKills must be > 0, got ${requiredKills}`);
        }
        this.validEnemyIds = new Set(validEnemyIds);
        this.requiredKills = requiredKills;
    }

    public recordDefeat(enemyId: string): boolean {
        if (!this.validEnemyIds.has(enemyId) || this.defeatedIds.has(enemyId)) {
            return false;
        }
        this.defeatedIds.add(enemyId);
        this.notify();
        return true;
    }

    public getCount(): number {
        return this.defeatedIds.size;
    }

    public isReady(): boolean {
        return this.getCount() >= this.requiredKills;
    }

    public getSnapshot(): EnemyKillSnapshot {
        return {
            count: this.getCount(),
            requiredKills: this.requiredKills,
            ready: this.isReady(),
        };
    }

    public subscribe(listener: EnemyKillListener): () => void {
        this.listeners.add(listener);
        listener(this.getSnapshot());
        const listeners = this.listeners;
        return () => listeners.delete(listener);
    }

    private notify(): void {
        const snapshot = this.getSnapshot();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}
