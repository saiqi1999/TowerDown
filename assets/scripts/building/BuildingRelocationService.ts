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
import { WorldCellFlag, WorldCellGrid } from '../world/WorldCellGrid';
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
        // null means a unit is covered or an active route would become unreachable.
        private readonly prepareRoutes: (grid: NavigationGrid) => (() => void) | null,
    ) {}

    public preview(id: string, x: number, y: number): BuildingPlacementSnapshot | null {
        return this.prepare(id, x, y)?.snapshot ?? null;
    }

    public tryMove(id: string, x: number, y: number): boolean {
        const entry = this.registry.get(id);
        const prepared = this.prepare(id, x, y);
        if (!entry || !prepared?.snapshot.canPlace || !prepared.grid || !prepared.applyRoutes) return false;
        if (entry.data.gridX === x && entry.data.gridY === y) return true;
        const definition = getBuildingDefinition(entry.data.definitionId)!;
        const oldCells = this.cells.getOwnerCells(id).map(c => ({ ...c }));
        const oldPosition = entry.node.position.clone();
        try {
            // No observer callbacks until the complete authoritative state is installed.
            entry.node.setPosition(gridRectToWorldCenter(x, y, definition.footprintW, definition.footprintH,
                this.navigation.width, this.navigation.height));
            this.cells.releaseOwner(id);
            this.cells.claim(id, WorldCellFlag.Building, prepared.snapshot.footprint);
        } catch (error) {
            this.cells.releaseOwner(id);
            this.cells.claim(id, WorldCellFlag.Building, oldCells);
            entry.node.setPosition(oldPosition);
            console.error('[BuildingRelocation] commit cancelled', error);
            return false;
        }
        this.navigation.replaceFrom(prepared.grid);
        entry.data.gridX = x;
        entry.data.gridY = y;
        prepared.applyRoutes();
        this.registry.notifyRelocated();
        return true;
    }

    private prepare(id: string, x: number, y: number): {
        snapshot: BuildingPlacementSnapshot; grid?: NavigationGrid; applyRoutes?: () => void;
    } | null {
        const entry = this.registry.get(id);
        if (!entry?.node.isValid || !entry.node.activeInHierarchy) return null;
        const snapshot = this.validator.validateRelocation(entry.data, x, y);
        if (!snapshot.canPlace) return { snapshot };
        const definition = getBuildingDefinition(entry.data.definitionId)!;
        const grid = new NavigationGrid(this.navigation.width, this.navigation.height);
        grid.replaceFrom(this.navigation);
        if (definition.blocksNavigation) {
            for (const c of this.cells.getOwnerCells(id)) grid.setWalkable(c.x, c.y);
            for (const c of snapshot.footprint) grid.setBlocked(c.x, c.y);
        }
        const applyRoutes = this.prepareRoutes(grid);
        if (!applyRoutes) return { snapshot: { ...snapshot, canPlace: false, reason: PlacementInvalidReason.RelocationBlocked } };
        return { snapshot, grid, applyRoutes };
    }
}
