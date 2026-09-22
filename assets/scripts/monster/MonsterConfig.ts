import { MonsterType } from './MonsterTypes';

export interface MonsterRuntimeDefinition {
    maxHealth: number;
    attackDamage: number;
    attackRangeCells: number;
    preferredCombatDistanceCells: number;
    attackIntervalSeconds?: number;
    moveSpeedCellsPerSecond: number;
    moveFrameDuration: number;
    attackFrameDuration: number;
    attackHitFrame: number;
}

const DEFINITIONS: Record<MonsterType, MonsterRuntimeDefinition> = {
    [MonsterType.BlueSlime]: {
        maxHealth: 80,
        attackDamage: 4,
        attackRangeCells: 0.85,
        preferredCombatDistanceCells: 0.75,
        attackIntervalSeconds: 0.24,
        moveSpeedCellsPerSecond: 3.2,
        moveFrameDuration: 0.14,
        attackFrameDuration: 0.12,
        attackHitFrame: 2,
    },
};

export function getMonsterRuntimeDefinition(type: MonsterType): MonsterRuntimeDefinition {
    return DEFINITIONS[type];
}
