/**
 * Why this file exists:
 * 单个建筑蓝图需要在有限 UI 空间中明确表达建筑图标、名称、成本、
 * selected 和 affordable 状态。
 *
 * Ownership boundary:
 * 本文件只拥有单张 Blueprint Card 的视觉与点击回调。
 *
 * This file deliberately does NOT:
 * 不修改资源、不解锁蓝图、不决定是否能落地，也不拥有 Build Mode 状态。
 */
import { Button, Color, Component, Graphics, Label, Material, Node, Sprite, SpriteFrame, UIOpacity, UITransform, _decorator } from 'cc';
import { ResourceType } from '../world/WorldObjectTypes';
import { type BuildingDefinition } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import {
    BLUEPRINT_CARD_COST_FONT_SIZE,
    BLUEPRINT_CARD_HEIGHT,
    BLUEPRINT_CARD_ICON_SIZE,
    BLUEPRINT_CARD_NAME_FONT_SIZE,
    BLUEPRINT_CARD_WIDTH,
} from './BuildCardUiConfig';
import { HoverInfoTarget } from '../ui/hover/HoverInfoTarget';
import {
    HoverPlacement,
    HoverTargetKind,
    HoverTargetScope,
} from '../ui/hover/HoverInfoTypes';
import { type HoverInfoController } from '../ui/hover/HoverInfoController';
import { BuildingCategory } from './BuildingTypes';
import { InteractionFeedbackView } from '../feedback/interaction/InteractionFeedbackView';
import { InteractionFeedbackPresetId } from '../feedback/interaction/InteractionFeedbackConfig';

const { ccclass } = _decorator;

@ccclass('BuildingBlueprintCardView')
export class BuildingBlueprintCardView extends Component {
    private button: Button | null = null;
    private nameLabel: Label | null = null;
    private opacity: UIOpacity | null = null;
    private visualRoot: Node | null = null;
    private feedback: InteractionFeedbackView | null = null;

    public setup(
        definition: BuildingDefinition,
        factory: BuildingSpriteFrameFactory,
        cardFrame: SpriteFrame | null,
        onSelect: () => void,
        hover: HoverInfoController,
        brightnessMaterial: Material | null,
    ): void {
        (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform))
            .setContentSize(BLUEPRINT_CARD_WIDTH, BLUEPRINT_CARD_HEIGHT);
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.visualRoot = this.getOrCreateRoot('FeedbackRoot', this.node);
        this.visualRoot.setPosition(0, 0, 0);
        const backgroundNode = this.getChild('Background');
        (backgroundNode.getComponent(UITransform) ?? backgroundNode.addComponent(UITransform))
            .setContentSize(BLUEPRINT_CARD_WIDTH, BLUEPRINT_CARD_HEIGHT);
        const background = backgroundNode.getComponent(Sprite) ?? backgroundNode.addComponent(Sprite);
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        background.spriteFrame = cardFrame;
        background.color = cardFrame ? Color.WHITE : new Color(46, 42, 36, 230);
        const iconNode = this.getChild('Icon');
        (iconNode.getComponent(UITransform) ?? iconNode.addComponent(UITransform))
            .setContentSize(BLUEPRINT_CARD_ICON_SIZE, BLUEPRINT_CARD_ICON_SIZE);
        iconNode.setPosition(0, 28, 0);
        const icon = iconNode.getComponent(Sprite) ?? iconNode.addComponent(Sprite);
        icon.sizeMode = Sprite.SizeMode.CUSTOM;
        icon.spriteFrame = factory.getFrame(definition);
        if (definition.shortEffectText) {
            const effectNode = this.getChild('EffectLabel');
            const effectLabel = effectNode.getComponent(Label) ?? effectNode.addComponent(Label);
            effectLabel.string = definition.shortEffectText;
            effectLabel.fontSize = 10;
            effectLabel.color = new Color(40, 110, 40);
            effectNode.setPosition(0, -48, 0);
        }
        const nameNode = this.getChild('NameLabel');
        (nameNode.getComponent(UITransform) ?? nameNode.addComponent(UITransform)).setContentSize(62, 18);
        nameNode.setPosition(0, -7, 0);
        this.nameLabel = nameNode.getComponent(Label) ?? nameNode.addComponent(Label);
        this.nameLabel.string = definition.displayName;
        this.nameLabel.fontSize = BLUEPRINT_CARD_NAME_FONT_SIZE;
        this.nameLabel.lineHeight = 14;
        this.nameLabel.color = Color.BLACK;
        this.nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.nameLabel.verticalAlign = Label.VerticalAlign.CENTER;
        const costNode = this.getChild('CostRoot');
        (costNode.getComponent(UITransform) ?? costNode.addComponent(UITransform)).setContentSize(62, 28);
        costNode.setPosition(0, -32, 0);
        const costLabel = costNode.getComponent(Label) ?? costNode.addComponent(Label);
        costLabel.string = this.formatCost(definition);
        costLabel.fontSize = BLUEPRINT_CARD_COST_FONT_SIZE;
        costLabel.lineHeight = 13;
        costLabel.color = Color.BLACK;
        costLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        costLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.getChild('SelectionOutline').getComponent(Graphics)
            ?? this.getChild('SelectionOutline').addComponent(Graphics);
        this.button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
        this.button.transition = Button.Transition.NONE;
        this.button.node.off(Button.EventType.CLICK);
        this.button.node.on(Button.EventType.CLICK, () => {
            if (!this.button?.interactable) {
                return;
            }
            this.feedback?.playClick();
            onSelect();
        });
        this.feedback = this.node.getComponent(InteractionFeedbackView)
            ?? this.node.addComponent(InteractionFeedbackView);
        this.feedback.setup({
            visualRoot: this.visualRoot,
            presetId: InteractionFeedbackPresetId.BlueprintCard,
            brightnessTargets: [background, icon],
            brightnessMaterial,
        });
        (this.node.getComponent(HoverInfoTarget) ?? this.node.addComponent(HoverInfoTarget)).setup({
            kind: HoverTargetKind.Blueprint,
            scope: HoverTargetScope.UI,
            preferredPlacement: HoverPlacement.Top,
            controller: hover,
            getInfo: () => ({
                title: definition.displayName,
                subtitle: BuildingCategory[definition.category],
                rows: [
                    { label: '成本', value: this.formatCost(definition).replace('\n', '  ') || '无' },
                    { label: '占地', value: `${definition.footprintW}×${definition.footprintH}` },
                    ...(definition.shortEffectText
                        ? [{ label: '效果', value: definition.shortEffectText }]
                        : []),
                ],
            }),
            onHoverChanged: (hovered) => this.feedback?.setHovered(hovered),
        });
        this.setSelected(false);
        this.setAffordable(true);
    }

    public setSelected(selected: boolean): void {
        const outline = this.getChild('SelectionOutline').getComponent(Graphics);
        if (!outline) return;
        outline.clear();
        if (!selected) return;
        outline.lineWidth = 3;
        outline.strokeColor = new Color(255, 220, 72, 255);
        outline.rect(-BLUEPRINT_CARD_WIDTH / 2 + 2, -BLUEPRINT_CARD_HEIGHT / 2 + 2, BLUEPRINT_CARD_WIDTH - 4, BLUEPRINT_CARD_HEIGHT - 4);
        outline.stroke();
    }

    public setAffordable(affordable: boolean): void {
        if (this.button) this.button.interactable = affordable;
        if (this.opacity) this.opacity.opacity = affordable ? 255 : 115;
        this.feedback?.setInteractionEnabled(affordable);
    }

    private getChild(name: string): Node {
        const parent = this.visualRoot ?? this.node;
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(parent);
        return child;
    }

    private getOrCreateRoot(name: string, parent: Node): Node {
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(parent);
        child.layer = parent.layer;
        return child;
    }

    private formatCost(definition: BuildingDefinition): string {
        const names: Record<number, string> = {
            [ResourceType.Wood]: '木',
            [ResourceType.Stone]: '石',
            [ResourceType.Food]: '食',
            [ResourceType.Gold]: '金',
        };
        const parts: string[] = [];
        for (const key of Object.keys(definition.cost)) {
            const type = Number(key) as ResourceType;
            const amount = definition.cost[type] ?? 0;
            if (amount > 0) parts.push(`${names[type] ?? '?'} ${amount}`);
        }
        return parts.length > 2
            ? `${parts.slice(0, 2).join('  ')}\n${parts.slice(2).join('  ')}`
            : parts.join('  ');
    }
}
