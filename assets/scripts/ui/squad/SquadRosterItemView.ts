/**
 * Why this file exists:
 * A single Squad roster card needs to show slot, portrait, color, and selected state in a compact UI.
 *
 * Ownership boundary:
 * This file owns one roster card's visual nodes and click callback.
 *
 * This file deliberately does NOT:
 * It does not own selectedSquadId, issue world commands, or control camera movement.
 */
import { Button, Color, Component, Graphics, Label, Node, Sprite, UIOpacity, UITransform, _decorator } from 'cc';
import { type SpriteFrame } from 'cc';
import {
    SQUAD_MINI_FLAG_SIZE,
    SQUAD_PORTRAIT_SIZE,
    SQUAD_ROSTER_CARD_HEIGHT,
    SQUAD_ROSTER_CARD_WIDTH,
    SQUAD_ROSTER_SELECTED_OFFSET_X,
} from './SquadRosterUiConfig';

const { ccclass } = _decorator;

@ccclass('SquadRosterItemView')
export class SquadRosterItemView extends Component {
    private baseX = 0;
    private commandColor: Color = Color.WHITE;
    private opacity: UIOpacity | null = null;
    private outline: Graphics | null = null;
    private slotLabel: Label | null = null;

    public setup(config: {
        commandSlot: number;
        commandColor: Color;
        portraitFrame: SpriteFrame;
        onSelect: () => void;
    }): void {
        this.commandColor = config.commandColor;
        this.baseX = this.node.position.x;
        (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform))
            .setContentSize(SQUAD_ROSTER_CARD_WIDTH, SQUAD_ROSTER_CARD_HEIGHT);
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.drawBackground(false);
        const portraitNode = this.getChild('Portrait');
        (portraitNode.getComponent(UITransform) ?? portraitNode.addComponent(UITransform))
            .setContentSize(SQUAD_PORTRAIT_SIZE, SQUAD_PORTRAIT_SIZE);
        portraitNode.setPosition(10, 0, 0);
        const portrait = portraitNode.getComponent(Sprite) ?? portraitNode.addComponent(Sprite);
        portrait.sizeMode = Sprite.SizeMode.CUSTOM;
        portrait.spriteFrame = config.portraitFrame;
        const strip = this.getChild('ColorStrip');
        const stripGraphics = strip.getComponent(Graphics) ?? strip.addComponent(Graphics);
        stripGraphics.clear();
        stripGraphics.fillColor = config.commandColor;
        stripGraphics.rect(SQUAD_ROSTER_CARD_WIDTH / 2 - 9, -SQUAD_ROSTER_CARD_HEIGHT / 2 + 6, 7, SQUAD_ROSTER_CARD_HEIGHT - 12);
        stripGraphics.fill();
        const flagNode = this.getChild('MiniFlag');
        (flagNode.getComponent(UITransform) ?? flagNode.addComponent(UITransform))
            .setContentSize(SQUAD_MINI_FLAG_SIZE, SQUAD_MINI_FLAG_SIZE);
        flagNode.setPosition(45, -22, 0);
        const flag = flagNode.getComponent(Graphics) ?? flagNode.addComponent(Graphics);
        flag.clear();
        flag.fillColor = config.commandColor;
        flag.rect(-12, -8, 22, 16);
        flag.fill();
        const slotNode = this.getChild('SlotBadge');
        (slotNode.getComponent(UITransform) ?? slotNode.addComponent(UITransform)).setContentSize(24, 24);
        slotNode.setPosition(-47, 24, 0);
        this.slotLabel = slotNode.getComponent(Label) ?? slotNode.addComponent(Label);
        this.slotLabel.string = String(config.commandSlot);
        this.slotLabel.fontSize = 18;
        this.slotLabel.lineHeight = 22;
        this.slotLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.slotLabel.verticalAlign = Label.VerticalAlign.CENTER;
        this.slotLabel.color = Color.WHITE;
        this.outline = this.getChild('SelectedOutline').getComponent(Graphics)
            ?? this.getChild('SelectedOutline').addComponent(Graphics);
        const button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, config.onSelect);
        this.setSelected(false);
    }

    public setSelected(selected: boolean): void {
        this.node.setPosition(this.baseX + (selected ? SQUAD_ROSTER_SELECTED_OFFSET_X : 0), this.node.position.y, this.node.position.z);
        if (this.opacity) this.opacity.opacity = selected ? 255 : 195;
        if (this.slotLabel) this.slotLabel.color = selected ? this.commandColor : Color.WHITE;
        this.drawBackground(selected);
    }

    private drawBackground(selected: boolean): void {
        const graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = new Color(26, 30, 32, selected ? 235 : 190);
        graphics.roundRect(-SQUAD_ROSTER_CARD_WIDTH / 2, -SQUAD_ROSTER_CARD_HEIGHT / 2, SQUAD_ROSTER_CARD_WIDTH, SQUAD_ROSTER_CARD_HEIGHT, 6);
        graphics.fill();
        if (selected) {
            graphics.lineWidth = 3;
            graphics.strokeColor = this.commandColor;
            graphics.roundRect(-SQUAD_ROSTER_CARD_WIDTH / 2 + 2, -SQUAD_ROSTER_CARD_HEIGHT / 2 + 2, SQUAD_ROSTER_CARD_WIDTH - 4, SQUAD_ROSTER_CARD_HEIGHT - 4, 5);
            graphics.stroke();
        }
    }

    private getChild(name: string): Node {
        const child = this.node.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(this.node);
        return child;
    }
}
