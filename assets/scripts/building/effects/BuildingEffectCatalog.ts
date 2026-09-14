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
import { CombatStatId, StatModifierOperation } from '../../combat/CombatStatModifierRegistry';
import { BuildingEffectStacking, type BuildingEffectDefinition } from './BuildingEffectTypes';

export const BLACKSMITH_ATTACK_EFFECT_ID = 'blacksmith_all_player_attack_plus_1';

const EFFECTS: readonly BuildingEffectDefinition[] = [
    {
        id: BLACKSMITH_ATTACK_EFFECT_ID,
        stat: CombatStatId.AttackDamage,
        operation: StatModifierOperation.AddFlat,
        value: 1,
        stacking: BuildingEffectStacking.PerBuilding,
    },
];

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
