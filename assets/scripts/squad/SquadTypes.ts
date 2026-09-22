import { type Node } from 'cc';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type SquadBrain } from './SquadBrain';
import { type SquadEngagementController } from './SquadEngagementController';
import { type SquadMotor } from './SquadMotor';
import { type WarriorAnimator } from './WarriorAnimator';
import { type WarriorMotor } from './WarriorMotor';
import { type CombatStats } from '../combat/CombatStats';
import { type HealthComponent } from '../combat/HealthComponent';
import { type WarriorCombatController } from './WarriorCombatController';
import { type SquadCombatController } from './SquadCombatController';

export enum WarriorVisualId {
    SwordWarrior = 0,
}

export enum SquadCommandColor {
    Cyan = 0,
    Amber = 1,
    Green = 2,
    Violet = 3,
}

export interface CommandResult {
    accepted: boolean;
    reason?: string;
}

export interface SquadRuntimeHandle {
    id: string;
    node: Node;
    motor: SquadMotor;
    engagement: SquadEngagementController;
    brain: SquadBrain;
    warriorAnimators: WarriorAnimator[];
    warriorMotors: WarriorMotor[];
    warriorStats: CombatStats[];
    warriorHealth: HealthComponent[];
    warriorCombatControllers: WarriorCombatController[];
    combat: SquadCombatController;
}

export interface SquadSpawnData {
    id: string;
    warriorVisualId: WarriorVisualId;
    memberCount: number;
    maxMemberCount?: number;
    homeObjectId: string;
    commandSlot: number;
    commandColor: SquadCommandColor;
    spawnPoint?: GridPoint;
    boundBarracksId?: string;
}

// 阵型 offset 是 Squad 的共享逻辑数据，而不是 Renderer 的私有布局常量。
export const SQUAD_FORMATION_OFFSETS: readonly GridPoint[] = [
    { x: -0.38, y: -0.2 },
    { x: 0.38, y: -0.2 },
    { x: -0.38, y: 0.45 },
    { x: 0.38, y: 0.45 },
];
