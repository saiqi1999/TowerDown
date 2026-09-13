import { type GridPoint } from '../navigation/NavigationTypes';
import { type CombatEncounter } from './CombatEncounter';

export type CombatantTeam = 'squad' | 'monster';

export interface CombatantAdapter {
    readonly id: string;
    readonly team: CombatantTeam;
    isAlive(): boolean;
    getPosition(): GridPoint;
    getAttackRangeCells(): number;
    getPreferredCombatDistanceCells(): number;
    getAttackDamage(): number;
    setCombatTarget(targetId: string | null): void;
    getCombatTarget?(): string | null;
    setCombatPosition(position: GridPoint | null): void;
    updateCombat(dt: number, encounter: CombatEncounterLike): void;
}

export interface CombatEncounterLike {
    getCombatant(id: string): CombatantAdapter | null;
    emitDamage(attackerId: string, targetId: string, damage: number): ReturnType<CombatEncounter['emitDamage']>;
}
