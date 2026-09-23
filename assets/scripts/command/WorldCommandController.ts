/**
 * Why this file exists:
 * 世界对象点击与框选都需要汇聚到同一个队伍指令入口，避免不同输入方式产生两套命令语义。
 *
 * Ownership boundary:
 * 本文件拥有世界目标命令提交、框选目标筛选和目标标记显示。
 *
 * This file deliberately does NOT:
 * 不决定队伍战斗/采集状态、不计算寻路、不拥有队伍选择状态。
 */
import { _decorator, Camera, Component, EventMouse, input, Input, Node, type SpriteFrame, Texture2D, UITransform, Vec2, Vec3 } from 'cc';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { WorldObjectKind, type WorldObjectData } from '../world/WorldObjectTypes';
import { WorldObjectView } from '../world/WorldObjectView';
import { createTargetFlagFrames } from './TargetFlagSpriteConfig';
import { TargetFlagView } from './TargetFlagView';
import { type SquadRuntimeHandle } from '../squad/SquadTypes';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { SquadSelectionController } from '../squad/SquadSelectionController';
import { type SquadPresentation } from '../ui/squad/SquadPresentationConfig';
import { WorldSelectionBox } from './WorldSelectionBox';

const { ccclass } = _decorator;

export interface WorldCommandControllerConfig {
    worldObjectRoot: Node;
    commandRoot: Node;
    selectionRoot: Node;
    camera: Camera;
    worldObjectRegistry: WorldObjectRuntimeRegistry;
    squadHandles: ReadonlyMap<string, SquadRuntimeHandle>;
    selection: SquadSelectionController;
    squadPresentationById: ReadonlyMap<string, SquadPresentation>;
    targetFlagTexture: Texture2D;
    mapWidth: number;
    mapHeight: number;
    onBaseClicked?: () => void;
    onBaseFeedbackClick?: (objectId: string) => void;
}

@ccclass('WorldCommandController')
export class WorldCommandController extends Component {
    private worldObjectRoot: Node | null = null;
    private commandRoot: Node | null = null;
    private selectionRoot: Node | null = null;
    private camera: Camera | null = null;
    private mapWidth = 0;
    private mapHeight = 0;
    private worldObjectRegistry: WorldObjectRuntimeRegistry | null = null;
    private squadHandles: ReadonlyMap<string, SquadRuntimeHandle> = new Map();
    private selection: SquadSelectionController | null = null;
    private squadPresentationById: ReadonlyMap<string, SquadPresentation> = new Map();
    private flagFrames: SpriteFrame[] = [];
    private readonly targetBySquad = new Map<string, string>();
    private readonly flagBySquad = new Map<string, TargetFlagView>();
    private readonly queueFlagsBySquad = new Map<string, Map<string, TargetFlagView>>();
    private inputBlockedPredicate: (() => boolean) | null = null;
    private onBaseClicked: (() => void) | null = null;
    private onBaseFeedbackClick: ((objectId: string) => void) | null = null;
    private selectionBox: WorldSelectionBox | null = null;
    private selectionViews: WorldObjectView[] = [];
    private selecting = false;
    private selectionStart = new Vec2();
    private selectionPointer = new Vec2();
    private selectionStartScreen = new Vec2();
    private selectionPointerScreen = new Vec2();
    private windowId = 0;

    public setInputBlockedPredicate(predicate: (() => boolean) | null): void {
        this.inputBlockedPredicate = predicate;
    }

    public setup(config: WorldCommandControllerConfig): void {
        this.worldObjectRoot = config.worldObjectRoot;
        this.commandRoot = config.commandRoot;
        this.selectionRoot = config.selectionRoot;
        this.camera = config.camera;
        this.mapWidth = config.mapWidth;
        this.mapHeight = config.mapHeight;
        this.worldObjectRegistry = config.worldObjectRegistry;
        this.squadHandles = config.squadHandles;
        this.selection = config.selection;
        this.squadPresentationById = config.squadPresentationById;
        this.flagFrames = createTargetFlagFrames(config.targetFlagTexture);
        this.onBaseClicked = config.onBaseClicked ?? null;
        this.onBaseFeedbackClick = config.onBaseFeedbackClick ?? null;

        this.bindWorldObjectViews(config.worldObjectRoot.getComponentsInChildren(WorldObjectView));
        const selectionBoxNode = this.selectionRoot.getChildByName('WorldSelectionBox')
            ?? (() => {
                const node = new Node('WorldSelectionBox');
                node.setParent(this.selectionRoot);
                node.layer = this.selectionRoot.layer;
                return node;
            })();
        this.selectionBox = selectionBoxNode.getComponent(WorldSelectionBox)
            ?? selectionBoxNode.addComponent(WorldSelectionBox);
    }

    public bindWorldObjectViews(views: readonly WorldObjectView[]): void {
        this.selectionViews = [...views];
        for (const view of views) {
            view.bindClickHandler((objectId) => this.onWorldObjectClicked(objectId));
        }
        console.log(`[WorldCommandController] bound ${views.length} world objects.`);
    }

    protected onEnable(): void {
        input.on(Input.EventType.MOUSE_DOWN, this.onSelectionDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onSelectionMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onSelectionUp, this);
    }

    protected onDisable(): void {
        input.off(Input.EventType.MOUSE_DOWN, this.onSelectionDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onSelectionMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onSelectionUp, this);
        this.selecting = false;
        this.selectionBox?.hide();
    }

    public clearTargetsForFloorChange(): void {
        this.targetBySquad.clear();
        for (const flag of this.flagBySquad.values()) flag.hide();
        this.flagBySquad.clear();
        for (const flags of this.queueFlagsBySquad.values()) {
            for (const flag of flags.values()) flag.hide();
        }
        this.queueFlagsBySquad.clear();
    }

    update(): void {
        for (const [squadId, targetId] of Array.from(this.targetBySquad.entries())) {
            const handle = this.squadHandles.get(squadId);
            if (!handle || handle.brain.getCurrentTargetId() === targetId) {
                continue;
            }

            this.targetBySquad.delete(squadId);
            this.flagBySquad.get(squadId)?.hide();
            const queueFlags = this.queueFlagsBySquad.get(squadId);
            queueFlags?.get(targetId)?.hide();
            queueFlags?.delete(targetId);
            const nextTargetId = handle?.brain.getCurrentTargetId() ?? null;
            if (nextTargetId === null && queueFlags) {
                for (const flag of queueFlags.values()) flag.hide();
                this.queueFlagsBySquad.delete(squadId);
            } else if (nextTargetId) {
                this.targetBySquad.set(squadId, nextTargetId);
            }
        }
    }

    private onWorldObjectClicked(objectId: string): void {
        if (this.inputBlockedPredicate?.()) {
            return;
        }
        const target = this.worldObjectRegistry?.get(objectId) ?? null;
        if (target?.kind === WorldObjectKind.Base) {
            this.onBaseFeedbackClick?.(objectId);
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
            this.hideQueueFlags(activeSquadId);
            handle.brain.clearCommandAndReturnHome();
            return;
        }

        this.hideQueueFlags(activeSquadId);
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

    private onSelectionDown(event: EventMouse): void {
        if (event.getButton() !== EventMouse.BUTTON_LEFT || this.inputBlockedPredicate?.()) return;
        if (!this.selection?.getSelectedSquadId()) return;
        event.getUILocation(this.selectionStart);
        this.selectionPointer.set(this.selectionStart);
        const screen = event.getLocation();
        this.selectionStartScreen.set(screen.x, screen.y);
        this.selectionPointerScreen.set(screen.x, screen.y);
        this.windowId = event.windowId ?? 0;
        this.selecting = true;
    }

    private onSelectionMove(event: EventMouse): void {
        if (!this.selecting) return;
        event.getUILocation(this.selectionPointer);
        const screen = event.getLocation();
        this.selectionPointerScreen.set(screen.x, screen.y);
        if (Vec2.distance(this.selectionStart, this.selectionPointer) < 10) return;
        this.selectionBox?.show(this.selectionStart, this.selectionPointer, this.windowId);
    }

    private onSelectionUp(event: EventMouse): void {
        if (!this.selecting || event.getButton() !== EventMouse.BUTTON_LEFT) return;
        event.getUILocation(this.selectionPointer);
        const screen = event.getLocation();
        this.selectionPointerScreen.set(screen.x, screen.y);
        const dragged = Vec2.distance(this.selectionStartScreen, this.selectionPointerScreen) >= 10;
        this.selecting = false;
        this.selectionBox?.hide();
        if (!dragged || this.inputBlockedPredicate?.()) return;
        const ids = this.selectionViews
            .filter((view) => view.kind === WorldObjectKind.Resource && this.isViewInSelection(view))
            .sort((a, b) => a.gridY - b.gridY || a.gridX - b.gridX)
            .map((view) => view.objectId);
        const squadId = this.selection?.getSelectedSquadId();
        const handle = squadId ? this.squadHandles.get(squadId) : null;
        if (!handle || ids.length === 0) return;
        const result = handle.brain.issueTargetQueue(ids);
        if (!result.accepted) {
            console.warn(result.reason ?? '[WorldCommandController] selection queue rejected.');
        } else {
            this.targetBySquad.set(squadId!, ids[0]!);
            this.showQueueFlags(squadId!, ids);
        }
    }

    private isViewInSelection(view: WorldObjectView): boolean {
        // Floor changes destroy old resource nodes; a stale view must not abort
        // the whole selection transaction while the new view list is settling.
        const node = view?.node;
        if (!node || !node.isValid || !node.activeInHierarchy) return false;
        const bounds = node.getComponent(UITransform)?.getBoundingBoxToWorld();
        if (!bounds || !this.camera) return false;
        const startWorld = new Vec3();
        const endWorld = new Vec3();
        this.camera.screenToWorld(
            new Vec3(this.selectionStartScreen.x, this.selectionStartScreen.y, 0),
            startWorld,
        );
        this.camera.screenToWorld(
            new Vec3(this.selectionPointerScreen.x, this.selectionPointerScreen.y, 0),
            endWorld,
        );
        const left = Math.min(startWorld.x, endWorld.x);
        const right = Math.max(startWorld.x, endWorld.x);
        const bottom = Math.min(startWorld.y, endWorld.y);
        const top = Math.max(startWorld.y, endWorld.y);
        return bounds.xMin >= left
            && bounds.xMax <= right
            && bounds.yMin >= bottom
            && bounds.yMax <= top;
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

    private showQueueFlags(squadId: string, targetIds: readonly string[]): void {
        this.hideQueueFlags(squadId);
        if (!this.commandRoot) return;
        const flags = new Map<string, TargetFlagView>();
        const tint = this.squadPresentationById.get(squadId)?.commandColor;
        for (const targetId of targetIds) {
            const target = this.worldObjectRegistry?.get(targetId);
            if (!target) continue;
            const node = new Node(`QueuedTargetFlag_${squadId}_${targetId}`);
            node.setParent(this.commandRoot);
            node.layer = this.commandRoot.layer;
            const flag = node.addComponent(TargetFlagView);
            flag.setup(this.flagFrames, tint);
            flag.showAtObject(
                target,
                getWorldVisualDefinition(target.visualId),
                this.mapWidth,
                this.mapHeight,
            );
            flags.set(targetId, flag);
        }
        this.queueFlagsBySquad.set(squadId, flags);
    }

    private hideQueueFlags(squadId: string): void {
        const flags = this.queueFlagsBySquad.get(squadId);
        if (!flags) return;
        for (const flag of flags.values()) flag.hide();
        this.queueFlagsBySquad.delete(squadId);
    }
}
