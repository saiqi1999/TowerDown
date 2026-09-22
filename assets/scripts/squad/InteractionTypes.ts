import { type GridPoint } from '../navigation/NavigationTypes';
import { type WarriorAnimator } from './WarriorAnimator';
import { type WarriorDirection } from './WarriorSpriteConfig';
import { type WarriorMotor } from './WarriorMotor';

export const INTERACTION_CONTACT_GAP_CELLS = 0.42;

export enum InteractionSide {
    Top = 0,
    Bottom = 1,
    Left = 2,
    Right = 3,
}

export interface InteractionSlot {
    id: string;
    gridPoint: GridPoint;
    facing: WarriorDirection;
    side: InteractionSide;
}

export interface WarriorSlotAssignment {
    warriorIndex: number;
    motor: WarriorMotor;
    animator: WarriorAnimator;
    slot: InteractionSlot;
    state: 'moving' | 'attacking' | 'waiting' | 'cancelled';
}
