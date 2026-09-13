import { type GridPoint } from '../navigation/NavigationTypes';

export type CombatTeam = 'squad' | 'monster';

export interface CombatUnitRef {
    readonly id: string;
    readonly team: CombatTeam;
    isAlive(): boolean;
    getWorldGridPosition(): GridPoint;
}
