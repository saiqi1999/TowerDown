import {
    ResourceType,
    WorldObjectKind,
    WorldVisualId,
    type WorldObjectData,
} from './WorldObjectTypes';

export const STATIC_WORLD_OBJECTS: WorldObjectData[] = [
    {
        id: 'base_main',
        kind: WorldObjectKind.Base,
        visualId: WorldVisualId.BaseOrange,
        gridX: 18,
        gridY: 10,
    },
    {
        id: 'wood_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Wood,
        visualId: WorldVisualId.TreeGreen,
        gridX: 6,
        gridY: 5,
    },
    {
        id: 'gold_02',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Gold,
        visualId: WorldVisualId.GoldOreSmall,
        gridX: 30,
        gridY: 5,
    },
    {
        id: 'stone_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Stone,
        visualId: WorldVisualId.StoneGray,
        gridX: 7,
        gridY: 16,
    },
    {
        id: 'food_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Food,
        visualId: WorldVisualId.FoodPlantRed,
        gridX: 31,
        gridY: 17,
    },
    {
        id: 'gold_01',
        kind: WorldObjectKind.Resource,
        resourceType: ResourceType.Gold,
        visualId: WorldVisualId.GoldOreSmall,
        gridX: 17,
        gridY: 6,
    },
];
