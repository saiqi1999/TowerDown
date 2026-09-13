/**
 * Why this file exists:
 * 建筑运行时效果需要独立于 PlacementService，便于后续按 effectId 扩展。
 *
 * Ownership boundary:
 * 本文件拥有 effectId 到执行器的注册和触发。
 *
 * This file deliberately does NOT:
 * 不拥有建筑实例、不处理建造输入。
 */
import { type BuildingInstanceData } from './BuildingTypes';
import { type BuildingEffectExecutor } from './BuildingEffectTypes';
export class BuildingEffectSystem {
    private readonly executors = new Map<string, BuildingEffectExecutor>();
    public register(effectId: string, executor: BuildingEffectExecutor): void { this.executors.set(effectId, executor); }
    public apply(instance: BuildingInstanceData, effectIds: readonly string[]): void {
        for (const id of effectIds) this.executors.get(id)?.({ instance });
    }
}
