export enum WorldObjectKind {
    Base = 0,
    Resource = 1,
}

export enum ResourceType {
    Wood = 0,
    Stone = 1,
    Food = 2,
}

export enum WorldVisualId {
    BaseOrange = 0,
    TreeGreen = 1,
    StoneGray = 2,
    FoodPlantRed = 3,
}

export interface WorldObjectData {
    id: string;
    kind: WorldObjectKind;
    visualId: WorldVisualId;
    resourceType?: ResourceType;
    gridX: number;
    gridY: number;
}
