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
import { ResourceInventory } from '../economy/ResourceInventory';
import { WorldCellFlag, WorldCellGrid } from '../world/WorldCellGrid';
import { BuildingRuntimeRegistry } from './BuildingRuntimeRegistry';
import { BuildingRenderer } from './BuildingRenderer';
import { getBuildingDefinition } from './BuildingCatalog';
import {
    BuildingPlacementValidator,
    type BuildingCostResolver,
} from './BuildingPlacementValidator';
import { type BuildingPlacementResult, type BuildingInstanceData } from './BuildingTypes';

export class BuildingPlacementService {
    private counter = 0;
    constructor(
        private readonly validator: BuildingPlacementValidator,
        private readonly inventory: ResourceInventory,
        private readonly worldCellGrid: WorldCellGrid,
        private readonly navigationGrid: NavigationGrid,
        private readonly renderer: BuildingRenderer,
        private readonly registry: BuildingRuntimeRegistry,
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
        let spent = false; let claimed = false; let blocked = false; let node = null as ReturnType<BuildingRenderer['create']> | null; let registered = false;
        try {
            if (!this.inventory.trySpendCost(paidCost)) return { success: false, snapshot: this.validator.validate(definitionId, gridX, gridY) };
            spent = true;
            this.worldCellGrid.claim(instance.id, WorldCellFlag.Building, snapshot.footprint); claimed = true;
            if (definition.blocksNavigation) { for (const cell of snapshot.footprint) this.navigationGrid.setBlocked(cell.x, cell.y); blocked = true; }
            node = this.renderer.create(instance, definition);
            registered = true;
            this.registry.add(instance, node);
            this.onPlacementCommitted?.(instance);
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
            if (blocked) for (const cell of snapshot.footprint) this.navigationGrid.setWalkable(cell.x, cell.y);
            if (claimed) this.worldCellGrid.releaseOwner(instance.id);
            if (spent) this.inventory.addCost(paidCost);
            throw error;
        }
    }
}
