/**
 * Why this file exists:
 * Building effect ids referenced by the Catalog must resolve to one authoritative static effect definition.
 *
 * Ownership boundary:
 * This file owns effect id -> BuildingEffectDefinition lookup and bootstrap validation.
 *
 * This file deliberately does NOT:
 * It does not create modifier source ids, scan runtime buildings, or apply combat math.
 */
import { getAllBuildingDefinitions } from '../BuildingCatalog';
import { type BuildingEffectDefinition } from './BuildingEffectTypes';

const EFFECTS: readonly BuildingEffectDefinition[] = [];

export function getBuildingEffectDefinition(id: string): BuildingEffectDefinition | null {
    return EFFECTS.find((effect) => effect.id === id) ?? null;
}

export function validateBuildingEffectReferences(): void {
    for (const building of getAllBuildingDefinitions()) {
        for (const effectId of building.effectIds) {
            if (!getBuildingEffectDefinition(effectId)) {
                throw new Error(`[BuildingEffectCatalog] unknown effectId=${effectId} on building=${building.id}`);
            }
        }
    }
}
