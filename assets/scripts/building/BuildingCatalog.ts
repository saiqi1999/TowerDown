/**
 * Why this file exists:
 * 所有建筑静态规则必须来自同一个 Catalog，避免 BuildBar、Ghost 和落地流程使用不同成本或图像。
 *
 * Ownership boundary:
 * 本文件拥有 definitionId 到 BuildingDefinition 的静态映射。
 *
 * This file deliberately does NOT:
 * 不记录蓝图解锁、场上实例或当前放置是否合法。
 */
import { TerrainType } from '../map/MapTypes';
import { ResourceType } from '../world/WorldObjectTypes';
import { BuildingCategory, BuildingVisualId, type BuildingDefinition } from './BuildingTypes';

const BUILDING_VISUAL_PIXELS = 80;
const BUILDING_VISUAL_SCALE = 1;

const DEFINITIONS: readonly BuildingDefinition[] = [
    {
        id: 'storage_house_01', displayName: 'Storage', category: BuildingCategory.Economy,
        visualId: BuildingVisualId.StorageHouse, visual: { col: 29, row: 15, w: 2, h: 2 },
        visualWidthPixels: BUILDING_VISUAL_PIXELS, visualHeightPixels: BUILDING_VISUAL_PIXELS, visualScale: BUILDING_VISUAL_SCALE,
        footprintW: 2, footprintH: 2, cost: { [ResourceType.Wood]: 10, [ResourceType.Stone]: 10 },
        allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [],
    },
    {
        id: 'lumberjack_house_01', displayName: 'Lumberjack', category: BuildingCategory.Economy,
        visualId: BuildingVisualId.LumberjackHouse, visual: { col: 31, row: 15, w: 2, h: 2 },
        visualWidthPixels: BUILDING_VISUAL_PIXELS, visualHeightPixels: BUILDING_VISUAL_PIXELS, visualScale: BUILDING_VISUAL_SCALE,
        footprintW: 2, footprintH: 2, cost: { [ResourceType.Wood]: 15, [ResourceType.Food]: 5 },
        allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [],
    },
    {
        id: 'barracks_01', displayName: 'Barracks', category: BuildingCategory.Defense,
        visualId: BuildingVisualId.Barracks, visual: { col: 29, row: 17, w: 2, h: 2 },
        visualWidthPixels: BUILDING_VISUAL_PIXELS, visualHeightPixels: BUILDING_VISUAL_PIXELS, visualScale: BUILDING_VISUAL_SCALE,
        footprintW: 2, footprintH: 2, cost: { [ResourceType.Wood]: 10, [ResourceType.Food]: 10 },
        allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [],
    },
    {
        id: 'blacksmith_house_01', displayName: 'Blacksmith', category: BuildingCategory.Economy,
        visualId: BuildingVisualId.BlacksmithHouse, visual: { col: 31, row: 17, w: 2, h: 2 },
        visualWidthPixels: BUILDING_VISUAL_PIXELS, visualHeightPixels: BUILDING_VISUAL_PIXELS, visualScale: BUILDING_VISUAL_SCALE,
        footprintW: 2, footprintH: 2, cost: { [ResourceType.Wood]: 5, [ResourceType.Stone]: 10, [ResourceType.Gold]: 5 },
        allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: ['blacksmith_all_player_attack_plus_1'],
        shortEffectText: '+1 ATK',
    },
];
export function getBuildingDefinition(id: string): BuildingDefinition | null { return DEFINITIONS.find((definition) => definition.id === id) ?? null; }
export function getAllBuildingDefinitions(): readonly BuildingDefinition[] { return DEFINITIONS; }
