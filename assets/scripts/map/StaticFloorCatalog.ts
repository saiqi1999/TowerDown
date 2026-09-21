/**
 * Why this file exists:
 * 双静态地图需要共享一份可复制的资源、敌怪和预览定义，避免 UI 与运行时各写一套数据。
 *
 * Ownership boundary:
 * 本文件拥有 forest/quarry 模板数据、运行时实例化和预览统计。
 *
 * This file deliberately does NOT:
 * 不创建节点、不切换地图、不修改静态模板或玩家库存。
 */
import { ResourceType, WorldVisualId, type WorldObjectData } from '../world/WorldObjectTypes';
import { MonsterType, MonsterVisualId, type MonsterGroupData } from '../monster/MonsterTypes';
import { STATIC_MAP } from './StaticMap';
import { type TerrainMap } from './MapTypes';

export type StaticFloorId = 'forest' | 'quarry';

export interface StaticFloorDefinition {
    readonly id: StaticFloorId;
    readonly displayName: string;
    readonly terrain: TerrainMap;
    readonly resources: readonly WorldObjectData[];
    readonly monsterGroups: readonly MonsterGroupData[];
    readonly requiredKills: number;
}

export interface FloorPreview {
    readonly id: StaticFloorId;
    readonly displayName: string;
    readonly resourceCounts: ReadonlyMap<ResourceType, number>;
    readonly monsterCount: number;
}

const slimeOffsets = [
    { x: -1.25, y: 0 },
    { x: 1.25, y: 0 },
    { x: 0, y: -1.25 },
] as const;

function resource(id: string, type: ResourceType, visualId: WorldVisualId, gridX: number, gridY: number): WorldObjectData {
    return { id, kind: 1, resourceType: type, visualId, gridX, gridY };
}

function group(id: string, guardedObjectId: string, start: number): MonsterGroupData {
    return {
        id,
        guardedObjectId,
        engageRadiusCells: 3,
        leashRadiusCells: 6,
        members: slimeOffsets.map((guardOffset, index) => ({
            id: `${id.replace('guard', 'slime')}_${start + index}`,
            type: MonsterType.BlueSlime,
            visualId: MonsterVisualId.BlueSlime,
            guardOffset,
        })),
    };
}

const forestResources: readonly WorldObjectData[] = [
    resource('wood_b1', ResourceType.Wood, WorldVisualId.TreeGreen, 5, 4),
    resource('wood_b2', ResourceType.Wood, WorldVisualId.TreeGreen, 8, 7),
    resource('wood_b3', ResourceType.Wood, WorldVisualId.TreeGreen, 5, 16),
    resource('stone_b1', ResourceType.Stone, WorldVisualId.StoneGray, 31, 6),
    resource('food_b1', ResourceType.Food, WorldVisualId.FoodPlantRed, 29, 16),
    resource('food_b2', ResourceType.Food, WorldVisualId.FoodPlantRed, 33, 17),
    resource('gold_b1', ResourceType.Gold, WorldVisualId.GoldOreSmall, 10, 18),
];

const quarryResources: readonly WorldObjectData[] = [
    resource('wood_c1', ResourceType.Wood, WorldVisualId.TreeGreen, 7, 5),
    resource('stone_c1', ResourceType.Stone, WorldVisualId.StoneGray, 29, 4),
    resource('stone_c2', ResourceType.Stone, WorldVisualId.StoneGray, 32, 8),
    resource('stone_c3', ResourceType.Stone, WorldVisualId.StoneGray, 29, 17),
    resource('food_c1', ResourceType.Food, WorldVisualId.FoodPlantRed, 8, 17),
    resource('gold_c1', ResourceType.Gold, WorldVisualId.GoldOreSmall, 10, 6),
    resource('gold_c2', ResourceType.Gold, WorldVisualId.GoldOreSmall, 32, 16),
];

export const STATIC_FLOORS: Readonly<Record<StaticFloorId, StaticFloorDefinition>> = {
    forest: {
        id: 'forest',
        displayName: '林地补给区',
        terrain: STATIC_MAP.map((row) => [...row]),
        resources: forestResources,
        monsterGroups: [group('forest_guard_01', 'gold_b1', 0)],
        requiredKills: 3,
    },
    quarry: {
        id: 'quarry',
        displayName: '石矿遗址',
        terrain: STATIC_MAP.map((row) => [...row]),
        resources: quarryResources,
        monsterGroups: [
            group('quarry_guard_01', 'gold_c1', 0),
            group('quarry_guard_02', 'gold_c2', 3),
        ],
        requiredKills: 3,
    },
};

export function getStaticFloor(id: StaticFloorId): StaticFloorDefinition {
    return STATIC_FLOORS[id];
}

export function buildFloorPreview(definition: StaticFloorDefinition): FloorPreview {
    const resourceCounts = new Map<ResourceType, number>();
    for (const item of definition.resources) {
        resourceCounts.set(item.resourceType!, (resourceCounts.get(item.resourceType!) ?? 0) + 1);
    }
    let monsterCount = 0;
    for (const monsterGroup of definition.monsterGroups) monsterCount += monsterGroup.members.length;
    return { id: definition.id, displayName: definition.displayName, resourceCounts, monsterCount };
}

export function instantiateFloor(definition: StaticFloorDefinition, floorInstanceId: string): {
    resources: WorldObjectData[];
    monsterGroups: MonsterGroupData[];
} {
    const prefix = `${floorInstanceId}:${definition.id}`;
    const resources = definition.resources.map((item) => ({ ...item, id: `${prefix}:${item.id}` }));
    const ids = new Map(definition.resources.map((item) => [item.id, `${prefix}:${item.id}`]));
    const monsterGroups = definition.monsterGroups.map((source) => ({
        ...source,
        id: `${prefix}:${source.id}`,
        guardedObjectId: ids.get(source.guardedObjectId) ?? `${prefix}:${source.guardedObjectId}`,
        members: source.members.map((member) => ({ ...member, id: `${prefix}:${member.id}` })),
    }));
    return { resources, monsterGroups };
}
