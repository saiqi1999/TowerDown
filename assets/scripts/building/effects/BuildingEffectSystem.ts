/**
 * Why this file exists:
 * Building instances need to translate active effectIds into player combat modifiers and keep them in sync.
 *
 * Ownership boundary:
 * This file owns rebuilding building-sourced modifier sources from BuildingRuntimeRegistry.
 *
 * This file deliberately does NOT:
 * It does not clear non-building modifiers, mutate units directly, or handle placement transactions.
 */
import { CombatStatModifierRegistry } from '../../combat/CombatStatModifierRegistry';
import { BuildingRuntimeRegistry } from '../BuildingRuntimeRegistry';
import { getBuildingDefinition } from '../BuildingCatalog';
import { getBuildingEffectDefinition } from './BuildingEffectCatalog';
import { BuildingEffectStacking } from './BuildingEffectTypes';

export class BuildingEffectSystem {
    private readonly activeSourceIds = new Set<string>();
    private unsubscribe: (() => void) | null = null;

    constructor(
        private readonly registry: BuildingRuntimeRegistry,
        private readonly modifierRegistry: CombatStatModifierRegistry,
    ) {}

    public setup(): void {
        this.unsubscribe?.();
        this.unsubscribe = this.registry.subscribe(() => this.rebuild());
        this.rebuild();
    }

    public dispose(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.removeActiveSources();
    }

    private rebuild(): void {
        this.removeActiveSources();
        for (const entry of this.registry.getAll()) {
            const definition = getBuildingDefinition(entry.data.definitionId);
            if (!definition) continue;
            for (const effectId of definition.effectIds) {
                const effect = getBuildingEffectDefinition(effectId);
                if (!effect || effect.stacking !== BuildingEffectStacking.PerBuilding) continue;
                const sourceId = `building:${entry.data.id}:${effect.id}`;
                this.modifierRegistry.set({
                    sourceId,
                    stat: effect.stat,
                    operation: effect.operation,
                    value: effect.value,
                });
                this.activeSourceIds.add(sourceId);
            }
        }
    }

    private removeActiveSources(): void {
        for (const sourceId of this.activeSourceIds) {
            this.modifierRegistry.removeSource(sourceId);
        }
        this.activeSourceIds.clear();
    }
}
