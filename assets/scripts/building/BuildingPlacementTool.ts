/**
 * Why this file exists:
 * PlacementTool 将 pointer、Ghost、Validator 与 PlacementService 组合成一次建造操作。
 *
 * Ownership boundary:
 * 本文件拥有当前指针格子和提交入口，但不拥有 Build Mode 生命周期。
 *
 * This file deliberately does NOT:
 * 不监听 BuildBar、不决定是否进入建造模式、不执行建筑效果。
 */
import { Event, Node } from 'cc';
import { type GridCell } from '../navigation/NavigationTypes';
import { getBuildingDefinition } from './BuildingCatalog';
import { BuildingGhostView } from './BuildingGhostView';
import { GridPointerProjector } from './GridPointerProjector';
import { BuildingPlacementService } from './BuildingPlacementService';
import { BuildingPlacementValidator } from './BuildingPlacementValidator';

export class BuildingPlacementTool {
    private definitionId: string | null = null;
    private pointerCell: GridCell | null = null;
    constructor(
        private readonly projector: GridPointerProjector,
        private readonly validator: BuildingPlacementValidator,
        private readonly service: BuildingPlacementService,
        private readonly ghost: BuildingGhostView,
    ) {}
    public setDefinition(definitionId: string | null): void {
        this.definitionId = definitionId;
        if (!definitionId) this.ghost.hide();
        else if (this.pointerCell) this.refresh(this.pointerCell);
    }
    public handlePointerMove(event: Event): void {
        if (!this.definitionId) return;
        const cell = this.projector.project(event);
        if (!cell) { this.pointerCell = null; this.ghost.hide(); return; }
        this.pointerCell = cell;
        this.refresh(cell);
    }
    public handlePointerDown(event: Event): boolean {
        if (!this.definitionId) return false;
        const cell = this.projector.project(event);
        if (!cell) return false;
        const result = this.service.tryPlace(this.definitionId, cell.x, cell.y);
        this.refresh(cell);
        return result.success;
    }
    private refresh(cell: GridCell): void {
        if (!this.definitionId) return;
        const definition = getBuildingDefinition(this.definitionId);
        if (!definition) { this.ghost.hide(); return; }
        this.ghost.show(definition, this.validator.validate(this.definitionId, cell.x, cell.y));
    }
}
