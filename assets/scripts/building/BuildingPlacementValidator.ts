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
import { type TerrainMap, TerrainType } from '../map/MapTypes';
import { ResourceInventory } from '../economy/ResourceInventory';
import { WorldCellGrid } from '../world/WorldCellGrid';
import { getBuildingDefinition } from './BuildingCatalog';
import { getBuildingFootprint, PlacementInvalidReason, type BuildingPlacementSnapshot } from './BuildingTypes';
export class BuildingPlacementValidator {
    constructor(private readonly terrainMap: TerrainMap, private readonly worldCellGrid: WorldCellGrid, private readonly inventory: ResourceInventory) {}
    public validate(definitionId: string, gridX: number, gridY: number): BuildingPlacementSnapshot {
        const definition = getBuildingDefinition(definitionId);
        if (!definition) return { definitionId, gridX, gridY, footprint: [], insideMap: false, terrainValid: false, occupancyValid: false, affordable: false, canPlace: false, reason: PlacementInvalidReason.DefinitionMissing };
        const footprint = getBuildingFootprint(definition, gridX, gridY);
        const insideMap = footprint.every((cell) => this.worldCellGrid.isInside(cell.x, cell.y));
        const terrainValid = insideMap && footprint.every((cell) => this.terrainMap[cell.y]?.[cell.x] === TerrainType.Dirt);
        const occupancyValid = insideMap && footprint.every((cell) => !this.worldCellGrid.isBlocked(cell.x, cell.y));
        const affordable = this.inventory.canAfford(definition.cost);
        let reason = PlacementInvalidReason.None;
        if (!insideMap) reason = PlacementInvalidReason.OutOfBounds;
        else if (!terrainValid) reason = PlacementInvalidReason.TerrainNotAllowed;
        else if (!occupancyValid) reason = PlacementInvalidReason.Occupied;
        else if (!affordable) reason = PlacementInvalidReason.InsufficientResources;
        return { definitionId, gridX, gridY, footprint, insideMap, terrainValid, occupancyValid, affordable, canPlace: reason === PlacementInvalidReason.None, reason };
    }
}
