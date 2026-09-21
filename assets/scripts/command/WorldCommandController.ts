import { _decorator, Component, Node, type SpriteFrame, Texture2D } from 'cc';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { WorldObjectKind, type WorldObjectData } from '../world/WorldObjectTypes';
import { WorldObjectView } from '../world/WorldObjectView';
import { createTargetFlagFrames } from './TargetFlagSpriteConfig';
import { TargetFlagView } from './TargetFlagView';
import { type SquadRuntimeHandle } from '../squad/SquadTypes';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { SquadSelectionController } from '../squad/SquadSelectionController';
import { type SquadPresentation } from '../ui/squad/SquadPresentationConfig';

const { ccclass } = _decorator;

export interface WorldCommandControllerConfig {
    worldObjectRoot: Node;
    commandRoot: Node;
    worldObjectRegistry: WorldObjectRuntimeRegistry;
    squadHandles: ReadonlyMap<string, SquadRuntimeHandle>;
    selection: SquadSelectionController;
    squadPresentationById: ReadonlyMap<string, SquadPresentation>;
    targetFlagTexture: Texture2D;
    mapWidth: number;
    mapHeight: number;
    onBaseClicked?: () => void;
}

@ccclass('WorldCommandController')
export class WorldCommandController extends Component {
    private worldObjectRoot: Node | null = null;
    private commandRoot: Node | null = null;
    private mapWidth = 0;
    private mapHeight = 0;
    private worldObjectRegistry: WorldObjectRuntimeRegistry | null = null;
    private squadHandles: ReadonlyMap<string, SquadRuntimeHandle> = new Map();
    private selection: SquadSelectionController | null = null;
    private squadPresentationById: ReadonlyMap<string, SquadPresentation> = new Map();
    private flagFrames: SpriteFrame[] = [];
    private readonly targetBySquad = new Map<string, string>();
    private readonly flagBySquad = new Map<string, TargetFlagView>();
    private inputBlockedPredicate: (() => boolean) | null = null;
    private onBaseClicked: (() => void) | null = null;

    public setInputBlockedPredicate(predicate: (() => boolean) | null): void {
        this.inputBlockedPredicate = predicate;
    }

    public setup(config: WorldCommandControllerConfig): void {
        this.worldObjectRoot = config.worldObjectRoot;
        this.commandRoot = config.commandRoot;
        this.mapWidth = config.mapWidth;
        this.mapHeight = config.mapHeight;
        this.worldObjectRegistry = config.worldObjectRegistry;
        this.squadHandles = config.squadHandles;
        this.selection = config.selection;
        this.squadPresentationById = config.squadPresentationById;
        this.flagFrames = createTargetFlagFrames(config.targetFlagTexture);
        this.onBaseClicked = config.onBaseClicked ?? null;

        this.bindWorldObjectViews(config.worldObjectRoot.getComponentsInChildren(WorldObjectView));
    }

    public bindWorldObjectViews(views: readonly WorldObjectView[]): void {
        for (const view of views) {
            view.bindClickHandler((objectId) => this.onWorldObjectClicked(objectId));
        }
        console.log(`[WorldCommandController] bound ${views.length} world objects.`);
    }

    public clearTargetsForFloorChange(): void {
        this.targetBySquad.clear();
        for (const flag of this.flagBySquad.values()) flag.hide();
        this.flagBySquad.clear();
    }

    update(): void {
        for (const [squadId, targetId] of Array.from(this.targetBySquad.entries())) {
            const handle = this.squadHandles.get(squadId);
            if (!handle || handle.brain.getCurrentTargetId() === targetId) {
                continue;
            }

            this.targetBySquad.delete(squadId);
            this.flagBySquad.get(squadId)?.hide();
        }
    }

    private onWorldObjectClicked(objectId: string): void {
        if (this.inputBlockedPredicate?.()) {
            return;
        }
        const target = this.worldObjectRegistry?.get(objectId) ?? null;
        if (target?.kind === WorldObjectKind.Base) {
            this.onBaseClicked?.();
            return;
        }
        const activeSquadId = this.selection?.getSelectedSquadId() ?? null;
        if (!activeSquadId) {
            console.warn('[WorldCommandController] no selected squad.');
            return;
        }
        const handle = this.squadHandles.get(activeSquadId);
        if (!handle) {
            console.warn(`[WorldCommandController] active squad missing: ${activeSquadId}`);
            return;
        }

        const currentTargetId = this.targetBySquad.get(activeSquadId);
        if (currentTargetId === objectId) {
            this.targetBySquad.delete(activeSquadId);
            this.flagBySquad.get(activeSquadId)?.hide();
            handle.brain.clearCommandAndReturnHome();
            return;
        }

        const result = handle.brain.issueTarget(objectId);
        if (!result.accepted) {
            console.warn(result.reason ?? `[WorldCommandController] command rejected: ${objectId}`);
            return;
        }

        if (!target) {
            console.warn(`[WorldCommandController] target missing after command accepted: ${objectId}`);
            return;
        }

        const flag = this.getOrCreateFlag(activeSquadId);
        const visual = getWorldVisualDefinition(target.visualId);
        this.targetBySquad.set(activeSquadId, objectId);
        flag.showAtObject(
            target,
            visual,
            this.mapWidth,
            this.mapHeight,
        );
    }

    private getOrCreateFlag(squadId: string): TargetFlagView {
        const existing = this.flagBySquad.get(squadId);
        if (existing) {
            return existing;
        }

        if (!this.commandRoot) {
            throw new Error('[WorldCommandController] commandRoot is not initialized.');
        }

        const node = new Node(`TargetFlag_${squadId}`);
        node.setParent(this.commandRoot);
        node.layer = this.commandRoot.layer;

        const flag = node.addComponent(TargetFlagView);
        const tint = this.squadPresentationById.get(squadId)?.commandColor;
        flag.setup(this.flagFrames, tint);
        this.flagBySquad.set(squadId, flag);
        return flag;
    }
}
