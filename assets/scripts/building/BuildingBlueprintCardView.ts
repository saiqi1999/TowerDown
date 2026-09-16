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
import { Button, Color, Component, Graphics, Label, Node, Sprite, SpriteFrame, UIOpacity, UITransform, _decorator } from 'cc';
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

const { ccclass } = _decorator;

@ccclass('BuildingBlueprintCardView')
export class BuildingBlueprintCardView extends Component {
    private button: Button | null = null;
    private nameLabel: Label | null = null;
    private opacity: UIOpacity | null = null;

    public setup(
        definition: BuildingDefinition,
        factory: BuildingSpriteFrameFactory,
        cardFrame: SpriteFrame | null,
        onSelect: () => void,
        hover: HoverInfoController,
    ): void {
        (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform))
            .setContentSize(BLUEPRINT_CARD_WIDTH, BLUEPRINT_CARD_HEIGHT);
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        const background = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
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
        this.button.node.off(Button.EventType.CLICK);
        this.button.node.on(Button.EventType.CLICK, onSelect);
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
    }

    private getChild(name: string): Node {
        const child = this.node.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(this.node);
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
