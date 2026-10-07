/**
 * Why this file exists:
 * Moving a building must preserve its identity while updating occupancy and paths together.
 *
 * Ownership boundary:
 * This file owns relocation validation and synchronous commit.
 *
 * This file deliberately does NOT:
 * It does not charge resources, create units, or process pointer events.
 */
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { NavigationGrid } from '../navigation/NavigationGrid';
import { NavigationObstacleResolver } from '../navigation/NavigationObstacleResolver';
import { WorldCellGrid } from '../world/WorldCellGrid';
import { BuildingRuntimeRegistry } from './BuildingRuntimeRegistry';
import { BuildingPlacementValidator } from './BuildingPlacementValidator';
import { getBuildingDefinition } from './BuildingCatalog';
import { PlacementInvalidReason, type BuildingPlacementSnapshot } from './BuildingTypes';

export class BuildingRelocationService {
    constructor(
        private readonly registry: BuildingRuntimeRegistry,
        private readonly validator: BuildingPlacementValidator,
        private readonly cells: WorldCellGrid,
        private readonly navigation: NavigationGrid,
        private readonly obstacleResolver: NavigationObstacleResolver,
        // null means a unit is covered or an active route would become unreachable.
        private readonly prepareRoutes: (grid: NavigationGrid) => (() => void) | null,
    ) {}

    public preview(id: string, x: number, y: number): BuildingPlacementSnapshot | null {
        return this.prepare(id, x, y)?.snapshot ?? null;
    }

    public tryMove(id: string, x: number, y: number): boolean {
        const entry = this.registry.get(id);
        if (!entry) return false;
        if (entry.data.gridX === x && entry.data.gridY === y) return true;
        const prepared = this.prepare(id, x, y);
        if (!prepared?.snapshot.canPlace || !prepared.candidate || !prepared.applyRoutes) return false;
        const definition = getBuildingDefinition(entry.data.definitionId)!;
        const oldPosition = entry.node.position.clone();
        try {
            // No observer callbacks until the complete authoritative state is installed.
            entry.node.setPosition(gridRectToWorldCenter(x, y, definition.footprintW, definition.footprintH,
                this.navigation.mapWidth, this.navigation.mapHeight));
            this.cells.replaceFrom(prepared.candidate);
        } catch (error) {
            entry.node.setPosition(oldPosition);
            console.error('[BuildingRelocation] commit cancelled', error);
            return false;
        }
        entry.data.gridX = x;
        entry.data.gridY = y;
        prepared.applyRoutes();
        this.registry.notifyRelocated();
        return true;
    }

    private prepare(id: string, x: number, y: number): {
        snapshot: BuildingPlacementSnapshot;
        candidate?: WorldCellGrid;
        applyRoutes?: () => void;
    } | null {
        const entry = this.registry.get(id);
        if (!entry?.node.isValid || !entry.node.activeInHierarchy) return null;
        const snapshot = this.validator.validateRelocation(entry.data, x, y);
        if (!snapshot.canPlace) return { snapshot };
        const definition = getBuildingDefinition(entry.data.definitionId)!;
        const candidate = this.cells.clone();
        candidate.releaseOwner(id);
        candidate.claimOccupant(this.obstacleResolver.forBuilding({
            ...entry.data,
            gridX: x,
            gridY: y,
        }, definition));
        const grid = new NavigationGrid(candidate);
        const applyRoutes = this.prepareRoutes(grid);
        if (!applyRoutes) return { snapshot: { ...snapshot, canPlace: false, reason: PlacementInvalidReason.RelocationBlocked } };
        return { snapshot, candidate, applyRoutes };
    }
}
