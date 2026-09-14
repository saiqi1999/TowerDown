/**
 * Why this file exists:
 * Building effects need data-only contracts that can produce stat modifiers without coupling UI or placement.
 *
 * Ownership boundary:
 * This file defines building effect metadata and stacking semantics.
 *
 * This file deliberately does NOT:
 * It does not scan building instances, mutate combat stats, or decide placement validity.
 */
import { CombatStatId, StatModifierOperation } from '../../combat/CombatStatModifierRegistry';

export enum BuildingEffectStacking {
    PerBuilding = 'perBuilding',
}

export interface BuildingEffectDefinition {
    readonly id: string;
    readonly stat: CombatStatId;
    readonly operation: StatModifierOperation;
    readonly value: number;
    readonly stacking: BuildingEffectStacking;
}
