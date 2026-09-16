/**
 * Why this file exists:
 * Building Ghost 需要以零插值、Grid-snapped 的方式表现当前放置位置和合法性。
 *
 * Ownership boundary:
 * 本文件拥有 Ghost Sprite、Definition visual、位置、可放/不可放视觉状态。
 *
 * This file deliberately does NOT:
 * 不读取 Pointer、不做 Grid 投影、不判断 placement rule，也不执行提交。
 */
import { Color, Node, Sprite, UITransform } from 'cc';
import { GRID_RENDER_SCALE, GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { type BuildingDefinition, type BuildingPlacementSnapshot } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';

export class BuildingGhostView {
    private readonly sprite: Sprite;
    private currentDefinitionId: string | null = null;
    private lastCanPlace: boolean | null = null;
    constructor(
        private readonly node: Node,
        private readonly factory: BuildingSpriteFrameFactory,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
    ) {
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(64, 64);
        this.sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        node.setScale(1, 1, 1);
        node.active = false;
    }
    public setDefinition(definition: BuildingDefinition | null): void {
        this.currentDefinitionId = definition?.id ?? null;
        this.lastCanPlace = null;
        if (!definition) {
            this.hide();
            return;
        }
        this.sprite.spriteFrame = this.factory.getFrame(definition);
    }
    public updatePlacement(definition: BuildingDefinition, snapshot: BuildingPlacementSnapshot): void {
        this.node.active = true;
        if (this.currentDefinitionId !== definition.id) {
            this.setDefinition(definition);
        }
        if (this.lastCanPlace !== snapshot.canPlace) {
            this.sprite.color = snapshot.canPlace
                ? new Color(160, 255, 160, 180)
                : new Color(255, 100, 100, 180);
            this.lastCanPlace = snapshot.canPlace;
        }
        this.node.setPosition(gridRectToWorldCenter(
            snapshot.gridX, snapshot.gridY, definition.footprintW, definition.footprintH,
            this.mapWidth, this.mapHeight,
        ));
    }
    public hide(): void { this.node.active = false; this.lastCanPlace = null; }
}
