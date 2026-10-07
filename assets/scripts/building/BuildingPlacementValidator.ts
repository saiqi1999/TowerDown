/**
 * Why this file exists:
 * Ghost 与最终提交必须共享同一套合法性判断，因此 placement 规则只能集中在这里。
 *
 * Ownership boundary:
 * 本文件拥有给定建筑和格子是否可放置的唯一判断。
 *
 * This file deliberately does NOT:
 * 不修改资源、不占格、不创建 Node，也不改变工具状态。
 */
import { type TerrainMap } from '../map/MapTypes';
import { findSlotByAnchor } from '../map/CityLayout';
import { ResourceInventory } from '../economy/ResourceInventory';
import { WorldCellGrid } from '../world/WorldCellGrid';
import { getBuildingDefinition } from './BuildingCatalog';
import {
    getBuildingFootprint,
    PlacementInvalidReason,
    type BuildingDefinition,
    type BuildingInstanceData,
    type BuildingPlacementSnapshot,
    type ResourceCost,
} from './BuildingTypes';

export type BuildingCostResolver = (definition: BuildingDefinition) => ResourceCost;
export type BuildingPlacementGate = (definition: BuildingDefinition) => {
    allowed: boolean;
    reason?: string;
};

export class BuildingPlacementValidator {
    constructor(
        private readonly terrainMap: TerrainMap,
        private readonly worldCellGrid: WorldCellGrid,
        private readonly inventory: ResourceInventory,
        private readonly costResolver: BuildingCostResolver = (definition) => definition.cost,
        private readonly placementGate: BuildingPlacementGate = () => ({ allowed: true }),
    ) {}

    public validateRelocation(instance: BuildingInstanceData, gridX: number, gridY: number): BuildingPlacementSnapshot {
        const definition = getBuildingDefinition(instance.definitionId);
        if (!definition) return this.validate(instance.definitionId, gridX, gridY);
        const spatial = this.validateSpatial(definition, gridX, gridY, instance.id);
        // Relocation never charges resources or consumes another squad/building slot.
        return {
            ...spatial,
            definitionId: instance.definitionId,
            affordable: true,
            canPlace: spatial.reason === PlacementInvalidReason.None,
        };
    }

    public validate(definitionId: string, gridX: number, gridY: number): BuildingPlacementSnapshot {
        const definition = getBuildingDefinition(definitionId);
        if (!definition) return { definitionId, gridX, gridY, footprint: [], insideMap: false, terrainValid: false, occupancyValid: false, affordable: false, canPlace: false, reason: PlacementInvalidReason.DefinitionMissing };
        const spatial = this.validateSpatial(definition, gridX, gridY);
        const affordable = this.inventory.canAfford(this.costResolver(definition));
        const placementGate = this.placementGate(definition);
        let reason = spatial.reason;
        if (reason === PlacementInvalidReason.None && !affordable) {
            reason = PlacementInvalidReason.InsufficientResources;
        } else if (reason === PlacementInvalidReason.None && !placementGate.allowed) {
            reason = PlacementInvalidReason.SquadCapacity;
        }
        return {
            ...spatial,
            definitionId,
            affordable,
            canPlace: reason === PlacementInvalidReason.None,
            reason,
        };
    }

    public validateSpatial(
        definition: BuildingDefinition,
        gridX: number,
        gridY: number,
        ignoredOwnerId?: string,
    ): Omit<BuildingPlacementSnapshot, 'definitionId' | 'affordable' | 'canPlace'> {
        const footprint = getBuildingFootprint(definition, gridX, gridY);
        const insideMap = Number.isInteger(gridX) && Number.isInteger(gridY)
            && footprint.every((cell) => this.worldCellGrid.isInside(cell.x, cell.y));
        const supportedFootprint = definition.footprintW === 2 && definition.footprintH === 2;
        const inSlot = supportedFootprint && findSlotByAnchor(gridX, gridY) !== null;
        const terrainValid = insideMap
            && footprint.every((cell) =>
                definition.allowedTerrain.includes(this.terrainMap[cell.y]?.[cell.x]));
        const ownCells = new Set(
            ignoredOwnerId
                ? this.worldCellGrid.getOwnerCells(ignoredOwnerId).map((cell) => `${cell.x},${cell.y}`)
                : [],
        );
        const occupancyValid = insideMap && footprint.every((cell) =>
            ownCells.has(`${cell.x},${cell.y}`) || !this.worldCellGrid.isBlocked(cell.x, cell.y));
        let reason = PlacementInvalidReason.None;
        if (!insideMap) reason = PlacementInvalidReason.OutOfBounds;
        else if (!supportedFootprint) reason = PlacementInvalidReason.UnsupportedCityFootprint;
        else if (!inSlot) reason = PlacementInvalidReason.OutsideCitySlot;
        else if (!terrainValid) reason = PlacementInvalidReason.TerrainNotAllowed;
        else if (!occupancyValid) reason = PlacementInvalidReason.Occupied;
        return {
            gridX,
            gridY,
            footprint,
            insideMap,
            terrainValid,
            occupancyValid,
            reason,
        };
    }
}
