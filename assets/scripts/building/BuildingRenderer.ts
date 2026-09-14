/**
 * Why this file exists:
 * PlacementService 只提交数据，正式建筑 Node 的创建和摆放属于独立渲染职责。
 *
 * Ownership boundary:
 * 本文件拥有正式建筑的 Sprite、尺寸、缩放和世界坐标。
 *
 * This file deliberately does NOT:
 * 不验证、不扣资源、不修改占格/导航，也不执行效果。
 */
import { Node, Sprite, UITransform } from 'cc';
import { GRID_RENDER_SCALE, GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { type BuildingDefinition, type BuildingInstanceData } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
export class BuildingRenderer {
    constructor(private readonly root: Node, private readonly factory: BuildingSpriteFrameFactory, private readonly mapWidth: number, private readonly mapHeight: number) {}
    public create(instance: BuildingInstanceData, definition: BuildingDefinition): Node {
        const node = new Node(`Building_${instance.id}`); node.setParent(this.root); node.layer = this.root.layer;
        node.addComponent(UITransform).setContentSize(definition.visualWidthPixels, definition.visualHeightPixels);
        const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.factory.getFrame(definition);
        node.setScale(definition.visualScale, definition.visualScale, 1);
        node.setPosition(gridRectToWorldCenter(instance.gridX, instance.gridY, definition.footprintW, definition.footprintH, this.mapWidth, this.mapHeight));
        return node;
    }
}
