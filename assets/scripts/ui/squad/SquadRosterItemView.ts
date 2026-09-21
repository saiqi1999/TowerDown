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
import { Button, Color, Component, Graphics, Label, Material, Node, Sprite, UIOpacity, UITransform, _decorator } from 'cc';
import { type SpriteFrame } from 'cc';
import {
    SQUAD_MINI_FLAG_SIZE,
    SQUAD_PORTRAIT_SIZE,
    SQUAD_ROSTER_CARD_HEIGHT,
    SQUAD_ROSTER_CARD_WIDTH,
    SQUAD_ROSTER_SELECTED_OFFSET_X,
} from './SquadRosterUiConfig';
import { type SquadRuntimeHandle, type SquadSpawnData } from '../../squad/SquadTypes';
import { SquadBrainState } from '../../squad/SquadBrain';
import { HoverInfoTarget } from '../hover/HoverInfoTarget';
import { HoverPlacement, HoverTargetKind, HoverTargetScope } from '../hover/HoverInfoTypes';
import { type HoverInfoController } from '../hover/HoverInfoController';
import { InteractionFeedbackPresetId } from '../../feedback/interaction/InteractionFeedbackConfig';
import { InteractionFeedbackView } from '../../feedback/interaction/InteractionFeedbackView';

const { ccclass } = _decorator;

@ccclass('SquadRosterItemView')
export class SquadRosterItemView extends Component {
    private commandColor: Color = Color.WHITE;
    private opacity: UIOpacity | null = null;
    private slotLabel: Label | null = null;
    private selectionRoot: Node | null = null;
    private feedbackRoot: Node | null = null;
    private backgroundNode: Node | null = null;
    private feedback: InteractionFeedbackView | null = null;

    public setup(config: {
        commandSlot: number;
        commandColor: Color;
        portraitFrame: SpriteFrame;
        onSelect: () => void;
        squad: SquadSpawnData;
        handle: SquadRuntimeHandle;
        hover: HoverInfoController;
        brightnessMaterial: Material | null;
    }): void {
        this.commandColor = config.commandColor;
        (this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform))
            .setContentSize(SQUAD_ROSTER_CARD_WIDTH, SQUAD_ROSTER_CARD_HEIGHT);
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.selectionRoot = this.getOrCreateRoot('SelectionOffsetRoot', this.node);
        this.feedbackRoot = this.getOrCreateRoot('FeedbackRoot', this.selectionRoot);
        this.backgroundNode = this.getChild('Background');
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
        const button = this.node.getComponent(Button) ?? this.node.addComponent(Button);
        button.transition = Button.Transition.NONE;
        button.node.off(Button.EventType.CLICK);
        button.node.on(Button.EventType.CLICK, () => {
            this.feedback?.playClick();
            config.onSelect();
        });
        this.feedback = this.node.getComponent(InteractionFeedbackView)
            ?? this.node.addComponent(InteractionFeedbackView);
        this.feedback.setup({
            visualRoot: this.feedbackRoot,
            presetId: InteractionFeedbackPresetId.SquadCard,
            brightnessTargets: [portrait],
            brightnessMaterial: config.brightnessMaterial,
        });
        (this.node.getComponent(HoverInfoTarget) ?? this.node.addComponent(HoverInfoTarget)).setup({
            kind: HoverTargetKind.Squad,
            scope: HoverTargetScope.UI,
            preferredPlacement: HoverPlacement.Right,
            controller: config.hover,
            getInfo: () => {
                const living = config.handle.warriorHealth.filter((health) => !health.isDepleted()).length;
                const attack = config.handle.warriorStats[0]?.getAttackDamage() ?? 0;
                return {
                    title: `Squad ${config.commandSlot}`,
                    rows: [
                        { label: '成员', value: `${living} / ${config.squad.memberCount}` },
                        { label: '攻击', value: String(attack) },
                        { label: '当前任务', value: this.getStateLabel(config.handle.brain.getState()) },
                    ],
                };
            },
            onHoverChanged: (hovered) => this.feedback?.setHovered(hovered),
        });
        this.setSelected(false);
    }

    public setSelected(selected: boolean): void {
        this.selectionRoot?.setPosition(selected ? SQUAD_ROSTER_SELECTED_OFFSET_X : 0, 0, 0);
        if (this.opacity) this.opacity.opacity = selected ? 255 : 195;
        if (this.slotLabel) this.slotLabel.color = selected ? this.commandColor : Color.WHITE;
        this.drawBackground(selected);
    }

    private drawBackground(selected: boolean): void {
        const target = this.backgroundNode ?? this.getChild('Background');
        const graphics = target.getComponent(Graphics) ?? target.addComponent(Graphics);
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
        const parent = this.feedbackRoot ?? this.node;
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(parent);
        child.layer = parent.layer;
        return child;
    }

    private getOrCreateRoot(name: string, parent: Node): Node {
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) child.setParent(parent);
        child.layer = parent.layer;
        child.setPosition(0, 0, 0);
        return child;
    }

    private getStateLabel(state: SquadBrainState): string {
        switch (state) {
        case SquadBrainState.MoveToTarget:
        case SquadBrainState.EngageTarget:
        case SquadBrainState.AttackResource:
            return '采集';
        case SquadBrainState.GuardCombat:
            return 'Combat';
        case SquadBrainState.Reform:
        case SquadBrainState.ReturnHome:
            return 'Return Home';
        default:
            return 'Idle';
        }
    }
}
