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
import { Material, Node, Sprite, UITransform } from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { type BuildingDefinition, type BuildingInstanceData } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import { HoverInfoTarget } from '../ui/hover/HoverInfoTarget';
import { HoverPlacement, HoverTargetKind, HoverTargetScope } from '../ui/hover/HoverInfoTypes';
import { type HoverInfoController } from '../ui/hover/HoverInfoController';
import { InteractionFeedbackView } from '../feedback/interaction/InteractionFeedbackView';
import { InteractionFeedbackPresetId } from '../feedback/interaction/InteractionFeedbackConfig';
import { FeedbackClickTarget } from '../feedback/interaction/FeedbackClickTarget';
import { BuildingFrameAnimation } from './BuildingFrameAnimation';

export class BuildingRenderer {
    constructor(
        private readonly root: Node,
        private readonly factory: BuildingSpriteFrameFactory,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
        private readonly hover: HoverInfoController,
        private readonly brightnessMaterial: Material | null,
    ) {}

    public create(instance: BuildingInstanceData, definition: BuildingDefinition): Node {
        const node = new Node(`Building_${instance.id}`); node.setParent(this.root); node.layer = this.root.layer;
        node.addComponent(UITransform).setContentSize(
            definition.footprintW * GRID_RENDER_SIZE,
            definition.footprintH * GRID_RENDER_SIZE,
        );
        const feedbackRoot = new Node('FeedbackRoot');
        feedbackRoot.setParent(node);
        feedbackRoot.layer = node.layer;
        feedbackRoot.setPosition(0, -definition.visualHeightPixels / 2, 0);
        const spriteNode = new Node('SpriteVisual');
        spriteNode.setParent(feedbackRoot);
        spriteNode.layer = node.layer;
        spriteNode.setPosition(0, definition.visualHeightPixels / 2, 0);
        spriteNode.addComponent(UITransform).setContentSize(definition.visualWidthPixels, definition.visualHeightPixels);
        const sprite = spriteNode.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.factory.getFrame(definition);
        const animations = this.factory.getAnimationSet(definition.id);
        if (animations) spriteNode.addComponent(BuildingFrameAnimation).setup(sprite, animations);
        node.setScale(definition.visualScale, definition.visualScale, 1);
        node.setPosition(gridRectToWorldCenter(instance.gridX, instance.gridY, definition.footprintW, definition.footprintH, this.mapWidth, this.mapHeight));
        const feedback = node.addComponent(InteractionFeedbackView);
        feedback.setup({
            visualRoot: feedbackRoot,
            presetId: InteractionFeedbackPresetId.WorldBuilding,
            brightnessTargets: [sprite],
            brightnessMaterial: this.brightnessMaterial,
        });
        node.addComponent(FeedbackClickTarget).setup(feedback);
        node.addComponent(HoverInfoTarget).setup({
            kind: HoverTargetKind.Building,
            scope: HoverTargetScope.World,
            preferredPlacement: HoverPlacement.Right,
            controller: this.hover,
            getInfo: () => ({
                title: definition.displayName,
                rows: [
                    ...(definition.shortEffectText
                        ? [{ label: '效果', value: definition.shortEffectText }]
                        : []),
                    ...(definition.settlementText
                        ? [{ label: '过层', value: definition.settlementText }]
                        : []),
                    { label: '占地', value: `${definition.footprintW}×${definition.footprintH}` },
                ],
            }),
            onHoverChanged: (hovered) => feedback.setHovered(hovered),
        });
        return node;
    }
}
