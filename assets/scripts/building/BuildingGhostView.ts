/**
 * Why this file exists:
 * Ghost 必须复用正式建筑的 SpriteFrame 和放置快照，给玩家即时反馈。
 *
 * Ownership boundary:
 * 本文件拥有 Ghost Node 的显示、位置与颜色。
 *
 * This file deliberately does NOT:
 * 不做规则判断、不扣资源、不提交建筑。
 */
import { Color, Node, Sprite, UITransform } from 'cc';
import { GRID_RENDER_SCALE, GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { type BuildingDefinition, type BuildingPlacementSnapshot } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';

export class BuildingGhostView {
    private readonly sprite: Sprite;
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
    public show(definition: BuildingDefinition, snapshot: BuildingPlacementSnapshot): void {
        this.node.active = true;
        this.sprite.spriteFrame = this.factory.getFrame(definition);
        this.sprite.color = snapshot.canPlace
            ? new Color(160, 255, 160, 180)
            : new Color(255, 100, 100, 180);
        this.node.setPosition(gridRectToWorldCenter(
            snapshot.gridX, snapshot.gridY, definition.footprintW, definition.footprintH,
            this.mapWidth, this.mapHeight,
        ));
    }
    public hide(): void { this.node.active = false; }
}
