export enum WarriorVisualId {
    SwordWarrior = 0,
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface SquadSpawnData {
    id: string;
    warriorVisualId: WarriorVisualId;
    memberCount: number;
    homeObjectId: string;
}
