/**
 * Why this file exists:
 * 一次建造会同时修改资源、占格、导航、Registry 和 Scene Node，必须由一个事务边界统一提交。
 *
 * Ownership boundary:
 * 本文件拥有最终验证、扣费、占格、阻挡、渲染和注册的提交顺序及回滚。
 *
 * This file deliberately does NOT:
 * 不监听输入、不显示 Ghost、不维护当前选中的蓝图。
 */
import { NavigationGrid } from '../navigation/NavigationGrid';
import { NavigationObstacleResolver } from '../navigation/NavigationObstacleResolver';
import { ResourceInventory } from '../economy/ResourceInventory';
import { WorldCellGrid } from '../world/WorldCellGrid';
import { BuildingRuntimeRegistry } from './BuildingRuntimeRegistry';
import { BuildingRenderer } from './BuildingRenderer';
import { getBuildingDefinition } from './BuildingCatalog';
import {
    BuildingPlacementValidator,
    type BuildingCostResolver,
} from './BuildingPlacementValidator';
import {
    PlacementInvalidReason,
    type BuildingPlacementResult,
    type BuildingInstanceData,
} from './BuildingTypes';

export class BuildingPlacementService {
    private counter = 0;
    constructor(
        private readonly validator: BuildingPlacementValidator,
        private readonly inventory: ResourceInventory,
        private readonly worldCellGrid: WorldCellGrid,
        private readonly renderer: BuildingRenderer,
        private readonly registry: BuildingRuntimeRegistry,
        private readonly obstacleResolver: NavigationObstacleResolver,
        private readonly prepareRoutes: (grid: NavigationGrid) => (() => void) | null,
        private readonly costResolver: BuildingCostResolver = (definition) => definition.cost,
        private readonly onPlacementCommitted: ((instance: BuildingInstanceData) => void) | null = null,
        private readonly onPlacementRolledBack: ((instance: BuildingInstanceData) => void) | null = null,
    ) {}
    public tryPlace(definitionId: string, gridX: number, gridY: number): BuildingPlacementResult {
        const snapshot = this.validator.validate(definitionId, gridX, gridY);
        if (!snapshot.canPlace) return { success: false, snapshot };
        const definition = getBuildingDefinition(definitionId);
        if (!definition) return { success: false, snapshot };
        const paidCost = { ...this.costResolver(definition) };
        const instance: BuildingInstanceData = {
            id: `building_${definitionId}_${++this.counter}`,
            definitionId,
            gridX,
            gridY,
            enabled: true,
            createdSequence: this.counter,
            paidCost,
            boundSquadId: null,
        };
        const candidate = this.worldCellGrid.clone();
        candidate.claimOccupant(this.obstacleResolver.forBuilding(instance, definition));
        const applyRoutes = this.prepareRoutes(new NavigationGrid(candidate));
        if (!applyRoutes) {
            return {
                success: false,
                snapshot: {
                    ...snapshot,
                    canPlace: false,
                    reason: PlacementInvalidReason.NavigationConflict,
                },
            };
        }
        let spent = false;
        let committed = false;
        let node = null as ReturnType<BuildingRenderer['create']> | null;
        let registered = false;
        try {
            if (!this.inventory.trySpendCost(paidCost)) return { success: false, snapshot: this.validator.validate(definitionId, gridX, gridY) };
            spent = true;
            node = this.renderer.create(instance, definition);
            this.worldCellGrid.replaceFrom(candidate);
            committed = true;
            this.registry.add(instance, node);
            registered = true;
            this.onPlacementCommitted?.(instance);
            applyRoutes();
            console.log(`[BuildingPlacement] success id=${instance.id} cell=(${gridX},${gridY})`);
            return { success: true, instance, snapshot };
        } catch (error) {
            try {
                this.onPlacementRolledBack?.(instance);
            } catch (rollbackError) {
                console.error('[BuildingPlacement] rollback callback failed.', rollbackError);
            }
            if (registered) this.registry.remove(instance.id);
            if (node?.isValid) node.destroy();
            if (committed) {
                const rollback = this.worldCellGrid.clone();
                rollback.releaseOwner(instance.id);
                this.worldCellGrid.replaceFrom(rollback);
            }
            if (spent) this.inventory.addCost(paidCost);
            throw error;
        }
    }
}
