import { type GridPoint } from '../navigation/NavigationTypes';

export enum MonsterType { BlueSlime = 0 }
export enum MonsterVisualId { BlueSlime = 0 }

export interface MonsterSpawnData {
    id: string;
    type: MonsterType;
    visualId: MonsterVisualId;
    guardOffset: GridPoint;
}

export interface MonsterGroupData {
    id: string;
    guardedObjectId: string;
    members: readonly MonsterSpawnData[];
    engageRadiusCells: number;
    leashRadiusCells: number;
}
