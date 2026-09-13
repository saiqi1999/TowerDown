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
import { type BuildingDefinition } from './BuildingTypes';

const DEFINITIONS: readonly BuildingDefinition[] = [
    { id: 'storage_pot_01', displayName: 'Storage', category: 0, visual: { col: 29, row: 15, w: 1, h: 1 }, footprintW: 1, footprintH: 1, cost: { [ResourceType.Wood]: 2 }, allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [] },
    { id: 'supply_sack_01', displayName: 'Supply', category: 0, visual: { col: 30, row: 15, w: 1, h: 1 }, footprintW: 1, footprintH: 1, cost: { [ResourceType.Wood]: 2, [ResourceType.Food]: 1 }, allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [] },
    { id: 'ritual_tent_01', displayName: 'Ritual', category: 1, visual: { col: 29, row: 17, w: 1, h: 1 }, footprintW: 1, footprintH: 1, cost: { [ResourceType.Wood]: 2, [ResourceType.Gold]: 1 }, allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [] },
    { id: 'kiln_01', displayName: 'Kiln', category: 0, visual: { col: 30, row: 17, w: 1, h: 1 }, footprintW: 1, footprintH: 1, cost: { [ResourceType.Wood]: 2, [ResourceType.Stone]: 2 }, allowedTerrain: [TerrainType.Dirt], blocksNavigation: true, eraRequired: 0, effectIds: [] },
];
export function getBuildingDefinition(id: string): BuildingDefinition | null { return DEFINITIONS.find((definition) => definition.id === id) ?? null; }
export function getAllBuildingDefinitions(): readonly BuildingDefinition[] { return DEFINITIONS; }
