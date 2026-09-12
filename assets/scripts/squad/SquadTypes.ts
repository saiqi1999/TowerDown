import { type Node } from 'cc';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type SquadBrain } from './SquadBrain';
import { type SquadMotor } from './SquadMotor';

export enum WarriorVisualId {
    SwordWarrior = 0,
}

export interface CommandResult {
    accepted: boolean;
    reason?: string;
}

export interface SquadRuntimeHandle {
    id: string;
    node: Node;
    motor: SquadMotor;
    brain: SquadBrain;
}

export interface SquadSpawnData {
    id: string;
    warriorVisualId: WarriorVisualId;
    memberCount: number;
    homeObjectId: string;
    spawnPoint?: GridPoint;
}
