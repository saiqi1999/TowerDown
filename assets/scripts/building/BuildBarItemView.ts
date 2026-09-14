/**
 * Why this file exists:
 * BuildBar item 需要独立承载图标、名称、成本和 selected 状态。
 *
 * Ownership boundary:
 * 本文件拥有单个 item 的视觉布局和点击回调。
 *
 * This file deliberately does NOT:
 * 不决定蓝图解锁、不进入建造模式、不判断资源。
 */
import { Button, Color, Component, Graphics, Label, Node, Sprite, UITransform, _decorator } from 'cc';
import { ResourceType } from '../world/WorldObjectTypes';
import { type BuildingDefinition } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import { BUILD_COST_FONT_SIZE, BUILD_ICON_SIZE, BUILD_ITEM_HEIGHT, BUILD_ITEM_WIDTH, BUILD_NAME_FONT_SIZE } from './BuildUiConfig';
const { ccclass } = _decorator;

@ccclass('BuildBarItemView')
export class BuildBarItemView extends Component {
    private onSelect: (() => void) | null = null;
    private nameLabel: Label | null = null;

    public setup(definition: BuildingDefinition, factory: BuildingSpriteFrameFactory, onSelect: () => void): void {
        this.onSelect = onSelect;
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(BUILD_ITEM_WIDTH, BUILD_ITEM_HEIGHT);
        const iconNode = this.getChild('Icon');
        iconNode.setPosition(0, 27, 0);
        (iconNode.getComponent(UITransform) ?? iconNode.addComponent(UITransform)).setContentSize(BUILD_ICON_SIZE, BUILD_ICON_SIZE);
        const icon = iconNode.getComponent(Sprite) ?? iconNode.addComponent(Sprite);
        icon.spriteFrame = factory.getFrame(definition);
        const nameNode = this.getChild('NameLabel');
        this.nameLabel = nameNode.getComponent(Label) ?? nameNode.addComponent(Label);
        this.nameLabel.string = definition.displayName;
        this.nameLabel.fontSize = BUILD_NAME_FONT_SIZE;
        this.nameLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.nameLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (nameNode.getComponent(UITransform) ?? nameNode.addComponent(UITransform)).setContentSize(104, 22);
        nameNode.setPosition(0, -8, 0);
        const costNode = this.getChild('CostRoot');
        const costLabel = costNode.getComponent(Label) ?? costNode.addComponent(Label);
        costLabel.string = this.formatCost(definition);
        costLabel.fontSize = BUILD_COST_FONT_SIZE;
        costLabel.lineHeight = 16;
        costLabel.color = Color.BLACK;
        costLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        costLabel.verticalAlign = Label.VerticalAlign.CENTER;
        (costNode.getComponent(UITransform) ?? costNode.addComponent(UITransform)).setContentSize(104, 34);
        costNode.setPosition(0, -34, 0);
        const outlineNode = this.getChild('SelectionOutline');
        outlineNode.getComponent(Graphics) ?? outlineNode.addComponent(Graphics);
        const button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, () => this.onSelect?.());
        this.setSelected(false);
    }

    public setSelected(selected: boolean): void {
        const outline = this.getChild('SelectionOutline').getComponent(Graphics);
        if (outline) {
            outline.clear();
            if (selected) {
                outline.lineWidth = 3;
                outline.strokeColor = new Color(255, 220, 80, 255);
                outline.rect(-BUILD_ITEM_WIDTH / 2 + 2, -BUILD_ITEM_HEIGHT / 2 + 2, BUILD_ITEM_WIDTH - 4, BUILD_ITEM_HEIGHT - 4);
                outline.stroke();
            }
        }
        if (this.nameLabel) this.nameLabel.color = selected ? new Color(255, 235, 120) : Color.BLACK;
    }

    private getChild(name: string): Node {
        const child = this.node.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(this.node);
        return child;
    }

    private formatCost(definition: BuildingDefinition): string {
        const names: Record<number, string> = {
            [ResourceType.Wood]: '木', [ResourceType.Stone]: '石',
            [ResourceType.Food]: '食', [ResourceType.Gold]: '金',
        };
        const parts: string[] = [];
        for (const key of Object.keys(definition.cost)) {
            const type = Number(key) as ResourceType;
            const amount = definition.cost[type] ?? 0;
            if (amount > 0) parts.push(`${names[type] ?? '?'} ${amount}`);
        }
        return parts.length > 2
            ? `${parts.slice(0, 2).join('   ')}\n${parts.slice(2).join('   ')}`
            : parts.join('   ');
    }
}
