/**
 * Why this file exists:
 * Building 系统需要一组不依赖 Cocos Node 的纯数据契约，供 Catalog、Placement、
 * Runtime Registry、UI 和未来 Effect System 共同使用。
 *
 * Ownership boundary:
 * 本文件只定义 Building 数据、放置结果和 footprint 纯函数。
 *
 * This file deliberately does NOT:
 * 不负责渲染、资源扣费、占格、输入、蓝图解锁或建筑效果执行。
 */
import { type GridCell } from '../navigation/NavigationTypes';
import { type TerrainType } from '../map/MapTypes';
import { type ResourceType } from '../world/WorldObjectTypes';

export type ResourceCost = Partial<Record<ResourceType, number>>;
export enum BuildingCategory { Economy = 0, Research = 1, Defense = 2 }
export enum BuildingSettlementRole {
    None = 'none',
    LumberjackSource = 'lumberjackSource',
    SwordBarracks = 'swordBarracks',
    MeleeBlacksmith = 'meleeBlacksmith',
}
export enum BuildingVisualId {
    StorageHouse = 'storage_house_01',
    LumberjackHouse = 'lumberjack_house_01',
    Barracks = 'barracks_01',
    BlacksmithHouse = 'blacksmith_house_01',
}
export interface BuildingVisualDefinition { col: number; row: number; w: number; h: number; }
export interface BuildingDefinition {
    id: string; displayName: string; category: BuildingCategory;
    visualId: BuildingVisualId; visual: BuildingVisualDefinition; visualWidthPixels: number; visualHeightPixels: number; visualScale: number; footprintW: number; footprintH: number;
    cost: ResourceCost; allowedTerrain: readonly TerrainType[];
    blocksNavigation: boolean; eraRequired: number; effectIds: readonly string[]; shortEffectText?: string;
    settlementRole?: BuildingSettlementRole;
    settlementText?: string;
}
export interface BuildingInstanceData {
    id: string;
    definitionId: string;
    gridX: number;
    gridY: number;
    enabled: boolean;
    createdSequence: number;
    paidCost: ResourceCost;
    boundSquadId?: string | null;
}
export enum PlacementInvalidReason {
    None = 0, PointerOutsideMap = 1, OutOfBounds = 2, TerrainNotAllowed = 3,
    Occupied = 4, InsufficientResources = 5, DefinitionMissing = 6, SquadCapacity = 7,
}
export interface BuildingPlacementSnapshot {
    definitionId: string; gridX: number; gridY: number; footprint: readonly GridCell[];
    insideMap: boolean; terrainValid: boolean; occupancyValid: boolean; affordable: boolean;
    canPlace: boolean; reason: PlacementInvalidReason;
}
export interface BuildingPlacementResult { success: boolean; instance?: BuildingInstanceData; snapshot: BuildingPlacementSnapshot; reason?: string; }
export function getBuildingFootprint(definition: BuildingDefinition, gridX: number, gridY: number): GridCell[] {
    const cells: GridCell[] = [];
    for (let y = gridY; y < gridY + definition.footprintH; y += 1) {
        for (let x = gridX; x < gridX + definition.footprintW; x += 1) cells.push({ x, y });
    }
    return cells;
}
