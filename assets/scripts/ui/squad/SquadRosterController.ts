/**
 * Why this file exists:
 * The player needs a persistent left-side roster to select which Squad receives the next world command.
 *
 * Ownership boundary:
 * This file owns roster item creation, ordering, and selected visual synchronization.
 *
 * This file deliberately does NOT:
 * It does not own selection truth, issue target commands, or control Build Mode.
 */
import { Node, UITransform } from 'cc';
import { SquadSelectionController, type SquadSelectionState } from '../../squad/SquadSelectionController';
import { type SquadRuntimeHandle, type SquadSpawnData } from '../../squad/SquadTypes';
import { type SquadPresentation } from './SquadPresentationConfig';
import { SquadRosterItemView } from './SquadRosterItemView';
import {
    SQUAD_ROSTER_CARD_GAP,
    SQUAD_ROSTER_CARD_HEIGHT,
    SQUAD_ROSTER_CARD_WIDTH,
    SQUAD_ROSTER_LEFT_X,
    SQUAD_ROSTER_TOP_Y,
} from './SquadRosterUiConfig';

export class SquadRosterController {
    private unsubscribe: (() => void) | null = null;
    private readonly itemViews = new Map<string, SquadRosterItemView>();

    constructor(
        private readonly root: Node,
        private readonly squads: readonly SquadSpawnData[],
        private readonly handles: ReadonlyMap<string, SquadRuntimeHandle>,
        private readonly selection: SquadSelectionController,
        private readonly presentationById: ReadonlyMap<string, SquadPresentation>,
    ) {}

    public setup(): void {
        const sorted = [...this.squads].filter((squad) => this.handles.has(squad.id))
            .sort((a, b) => a.commandSlot - b.commandSlot);
        (this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform))
            .setContentSize(SQUAD_ROSTER_CARD_WIDTH, sorted.length * SQUAD_ROSTER_CARD_HEIGHT + Math.max(0, sorted.length - 1) * SQUAD_ROSTER_CARD_GAP);
        this.root.setPosition(SQUAD_ROSTER_LEFT_X, SQUAD_ROSTER_TOP_Y, 0);
        this.root.removeAllChildren();
        this.itemViews.clear();
        sorted.forEach((squad, index) => {
            const presentation = this.presentationById.get(squad.id);
            if (!presentation) return;
            const node = new Node(`SquadCard_${squad.id}`);
            node.setParent(this.root);
            node.setPosition(0, -index * (SQUAD_ROSTER_CARD_HEIGHT + SQUAD_ROSTER_CARD_GAP), 0);
            const view = node.addComponent(SquadRosterItemView);
            view.setup({
                commandSlot: squad.commandSlot,
                commandColor: presentation.commandColor,
                portraitFrame: presentation.portraitFrame,
                onSelect: () => this.selection.selectSquad(squad.id),
            });
            this.itemViews.set(squad.id, view);
        });
        this.unsubscribe = this.selection.subscribe((state) => this.syncSelected(state));
    }

    public destroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.itemViews.clear();
    }

    private syncSelected(state: SquadSelectionState): void {
        for (const [id, view] of this.itemViews) {
            view.setSelected(state.selectedSquadId === id);
        }
    }
}
