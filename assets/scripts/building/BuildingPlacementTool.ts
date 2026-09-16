/**
 * Why this file exists:
 * PlacementTool 将最新 Pointer 状态、Grid 投影、Placement Validation、
 * Ghost Preview 与最终 Confirm 组合成一次建造交互。
 *
 * Ownership boundary:
 * 本文件拥有当前 pointer cell、当前 placement snapshot 和 confirm 入口。
 *
 * This file deliberately does NOT:
 * 不监听原始输入事件、不拥有 Build Mode 生命周期、不直接扣资源。
 */
import { Vec2 } from 'cc';
import { type GridCell } from '../navigation/NavigationTypes';
import { getBuildingDefinition } from './BuildingCatalog';
import { BuildingGhostView } from './BuildingGhostView';
import { GridPointerProjector } from './GridPointerProjector';
import { BuildingPlacementService } from './BuildingPlacementService';
import { BuildingPlacementValidator } from './BuildingPlacementValidator';
import { type BuildingPlacementSnapshot } from './BuildingTypes';

export class BuildingPlacementTool {
    private definitionId: string | null = null;
    private pointerCell: GridCell | null = null;
    private currentSnapshot: BuildingPlacementSnapshot | null = null;
    constructor(
        private readonly projector: GridPointerProjector,
        private readonly validator: BuildingPlacementValidator,
        private readonly service: BuildingPlacementService,
        private readonly ghost: BuildingGhostView,
    ) {}
    public setDefinition(definitionId: string | null): void {
        this.definitionId = definitionId;
        this.pointerCell = null;
        this.currentSnapshot = null;
        const definition = definitionId ? getBuildingDefinition(definitionId) : null;
        this.ghost.setDefinition(definition);
    }
    public refreshPointer(screenPoint: Vec2): void {
        if (!this.definitionId) return;
        const cell = this.projector.projectScreenPoint(screenPoint);
        if (!cell) {
            this.pointerCell = null;
            this.currentSnapshot = null;
            this.ghost.hide();
            return;
        }
        this.pointerCell = cell;
        this.refreshCurrentCell();
    }
    public confirmCurrentPlacement(): boolean {
        if (!this.definitionId || !this.pointerCell) return false;
        const result = this.service.tryPlace(this.definitionId, this.pointerCell.x, this.pointerCell.y);
        if (!result.success) this.refreshCurrentCell();
        return result.success;
    }
    public hideGhost(): void {
        this.ghost.hide();
    }
    private refreshCurrentCell(): void {
        if (!this.definitionId) return;
        const definition = getBuildingDefinition(this.definitionId);
        if (!definition) { this.ghost.hide(); return; }
        if (!this.pointerCell) { this.ghost.hide(); return; }
        const snapshot = this.validator.validate(this.definitionId, this.pointerCell.x, this.pointerCell.y);
        this.currentSnapshot = snapshot;
        this.ghost.updatePlacement(definition, snapshot);
    }
}
