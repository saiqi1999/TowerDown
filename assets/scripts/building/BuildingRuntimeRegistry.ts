/**
 * Why this file exists:
 * 已落地建筑是动态运行时实体，需要脱离 Scene Tree 被效果、拆除和存档系统查询。
 *
 * Ownership boundary:
 * 本文件拥有建筑实例数据与对应 Node 的索引。
 *
 * This file deliberately does NOT:
 * 不验证放置、不扣资源、不创建 Sprite，也不执行建筑效果。
 */
import { type Node } from 'cc';
import { type BuildingInstanceData } from './BuildingTypes';
export interface BuildingRuntimeEntry { data: BuildingInstanceData; node: Node; }
export type BuildingRuntimeListener = () => void;
export class BuildingRuntimeRegistry {
    private readonly entries = new Map<string, BuildingRuntimeEntry>();
    private readonly listeners = new Set<BuildingRuntimeListener>();
    public add(data: BuildingInstanceData, node: Node): void {
        if (this.entries.has(data.id)) throw new Error(`[BuildingRuntimeRegistry] duplicate id: ${data.id}`);
        this.entries.set(data.id, { data, node });
        this.notify();
    }
    public get(id: string): BuildingRuntimeEntry | null { return this.entries.get(id) ?? null; }
    public getAll(): readonly BuildingRuntimeEntry[] { return [...this.entries.values()]; }
    public remove(id: string): BuildingRuntimeEntry | null {
        const entry = this.entries.get(id) ?? null;
        if (!entry) return null;
        this.entries.delete(id);
        this.notify();
        return entry;
    }
    public subscribe(listener: BuildingRuntimeListener): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private notify(): void {
        for (const listener of this.listeners) listener();
    }
}
