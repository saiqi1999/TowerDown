/**
 * Why this file exists:
 * BuildBar 的单个按钮需要从 Catalog 展示统一的图标与名称，并回传选择。
 *
 * Ownership boundary:
 * 本文件拥有单个 item 的视觉和点击回调。
 *
 * This file deliberately does NOT:
 * 不决定蓝图解锁、不进入建造模式、不判断资源。
 */
import { Button, Component, Label, Node, Sprite, UITransform, _decorator } from 'cc';
import { type BuildingDefinition } from './BuildingTypes';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
const { ccclass } = _decorator;
@ccclass('BuildBarItemView')
export class BuildBarItemView extends Component {
    private onSelect: (() => void) | null = null;
    public setup(definition: BuildingDefinition, factory: BuildingSpriteFrameFactory, onSelect: () => void): void {
        this.onSelect = onSelect;
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(68, 52);
        const spriteNode = this.node.getChildByName('Icon') ?? new Node('Icon');
        if (!spriteNode.parent) spriteNode.setParent(this.node);
        spriteNode.setPosition(0, 8, 0);
        const sprite = spriteNode.getComponent(Sprite) ?? spriteNode.addComponent(Sprite);
        sprite.spriteFrame = factory.getFrame(definition);
        spriteNode.getComponent(UITransform)?.setContentSize(28, 28);
        const label = this.node.getComponent(Label) ?? this.node.addComponent(Label);
        label.string = definition.displayName;
        label.fontSize = 10;
        const button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
        button.node.on(Button.EventType.CLICK, () => this.onSelect?.());
    }
}
