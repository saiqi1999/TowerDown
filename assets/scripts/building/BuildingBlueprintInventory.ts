/**
 * Why this file exists:
 * 蓝图解锁是本次 Run 的玩家进度，不属于静态 Catalog，也不属于 UI。
 *
 * Ownership boundary:
 * 本文件只拥有已解锁 definitionId，并发布变化通知。
 *
 * This file deliberately does NOT:
 * 不决定掉落、时代、成本、资源是否足够或地图能否放置。
 */
export type BuildingBlueprintListener = (unlockedIds: readonly string[]) => void;
export class BuildingBlueprintInventory {
    private readonly unlocked = new Set<string>();
    private readonly listeners = new Set<BuildingBlueprintListener>();
    public unlock(id: string): boolean { if (this.unlocked.has(id)) return false; this.unlocked.add(id); this.notify(); return true; }
    public has(id: string): boolean { return this.unlocked.has(id); }
    public getAll(): readonly string[] { return [...this.unlocked]; }
    public subscribe(listener: BuildingBlueprintListener): () => void {
        const listeners = this.listeners; this.listeners.add(listener); listener(this.getAll());
        return () => listeners.delete(listener);
    }
    private notify(): void { const ids = this.getAll(); for (const listener of this.listeners) listener(ids); }
}
