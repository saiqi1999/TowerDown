/**
 * Why this file exists:
 * Placed buildings need mouse dragging without starting a second construction transaction.
 *
 * Ownership boundary:
 * This component owns one drag gesture, preview and cancellation lifecycle.
 *
 * This file deliberately does NOT:
 * It does not own occupancy, economics, navigation, or building identity.
 */
import { _decorator, Component, EventKeyboard, EventMouse, game, Game, input, Input, KeyCode, Node, UITransform, Vec2 } from 'cc';
import { FeedbackClickTarget } from '../feedback/interaction/FeedbackClickTarget';
import { BuildingRuntimeRegistry } from './BuildingRuntimeRegistry';
import { BuildingRelocationService } from './BuildingRelocationService';
import { GridPointerProjector } from './GridPointerProjector';
import { BuildingGhostView } from './BuildingGhostView';
import { getBuildingDefinition } from './BuildingCatalog';
import { BUILDING_RELOCATION_DRAG_PIXELS } from './BuildingRelocationConfig';
const { ccclass } = _decorator;

interface RelocationSetup {
    registry: BuildingRuntimeRegistry;
    service: BuildingRelocationService;
    projector: GridPointerProjector;
    ghost: BuildingGhostView;
    excludedUi: readonly Node[];
    isBlocked: () => boolean;
    onDraggingChanged: (active: boolean) => void;
}

@ccclass('BuildingRelocationController')
export class BuildingRelocationController extends Component {
    private config: RelocationSetup | null = null;
    private id: string | null = null;
    private dragging = false;
    private spacePressed = false;
    private pointer = new Vec2();
    private startPoint = new Vec2();
    private grabOffset = new Vec2();
    private windowId = 0;
    private destination: { x: number; y: number } | null = null;
    private readonly onBlur = () => { this.spacePressed = false; this.cancel(); };

    private readonly onWindowMouseUp = (event: MouseEvent) => {
        // Mouse release outside the canvas may never reach Cocos input.
        if (!(event.target instanceof HTMLCanvasElement)) this.cancel();
    };

    public setup(config: RelocationSetup): void { this.cancel(); this.config = config; }
    public isTracking(): boolean { return this.id !== null; }
    public isDragging(): boolean { return this.dragging; }
    public cancel(): void {
        const wasDragging = this.dragging;
        if (this.id && wasDragging) this.config?.registry.get(this.id)?.node.getComponent(FeedbackClickTarget)?.cancelPendingClick();
        this.id = null;
        this.dragging = false;
        this.destination = null;
        this.config?.ghost.hide();
        if (wasDragging) this.config?.onDraggingChanged(false);
    }
    protected onEnable(): void {
        input.on(Input.EventType.MOUSE_DOWN, this.onDown, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onUp, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        game.on(Game.EVENT_HIDE, this.onBlur, this);
        if (typeof window !== 'undefined') {
            window.addEventListener('blur', this.onBlur);
            window.addEventListener('mouseup', this.onWindowMouseUp);
        }
    }
    protected onDisable(): void {
        this.cancel();
        this.spacePressed = false;
        input.off(Input.EventType.MOUSE_DOWN, this.onDown, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onUp, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        game.off(Game.EVENT_HIDE, this.onBlur, this);
        if (typeof window !== 'undefined') {
            window.removeEventListener('blur', this.onBlur);
            window.removeEventListener('mouseup', this.onWindowMouseUp);
        }
    }
    lateUpdate(): void {
        if (this.id && this.config?.isBlocked()) { this.cancel(); return; }
        // Reproject even without mouse movement because edge scrolling changes MapRoot.
        if (this.dragging) this.refresh();
    }
    private sample(event: EventMouse): void {
        event.getLocation(this.pointer);
        this.windowId = event.windowId ?? 0;
    }
    private overUi(): boolean {
        return this.config?.excludedUi.some(n => n.isValid && n.activeInHierarchy
            && !!n.getComponent(UITransform)?.hitTest(this.pointer, this.windowId)) ?? false;
    }
    private onDown(event: EventMouse): void {
        if (event.getButton() !== EventMouse.BUTTON_LEFT) { this.cancel(); return; }
        if (!this.config || this.config.isBlocked() || this.spacePressed) return;
        this.cancel();
        this.sample(event);
        if (this.overUi()) return;
        const cell = this.config.projector.projectScreenPoint(this.pointer);
        if (!cell) return;
        const entry = [...this.config.registry.getAll()].reverse().find(e => e.node.isValid
            && e.node.activeInHierarchy && e.node.getComponent(UITransform)?.hitTest(this.pointer, this.windowId));
        if (!entry) return;
        this.id = entry.data.id;
        this.startPoint.set(this.pointer);
        this.grabOffset.set(cell.x - entry.data.gridX, cell.y - entry.data.gridY);
    }
    private onMove(event: EventMouse): void {
        if (!this.id || !this.config) return;
        this.sample(event);
        if (this.config.isBlocked()) { this.cancel(); return; }
        if (!this.dragging && Vec2.distance(this.startPoint, this.pointer) > BUILDING_RELOCATION_DRAG_PIXELS) {
            this.dragging = true;
            this.config.registry.get(this.id)?.node.getComponent(FeedbackClickTarget)?.cancelPendingClick();
            this.config.onDraggingChanged(true);
        }
        if (this.dragging) this.refresh();
    }
    private onUp(event: EventMouse): void {
        if (event.getButton() !== EventMouse.BUTTON_LEFT || !this.id || !this.config) return;
        this.onMove(event); // A fast final move must not commit a stale preview cell.
        try {
            if (this.id && this.dragging && !this.config.isBlocked()) {
                this.refresh();
                if (this.destination) this.config.service.tryMove(this.id, this.destination.x, this.destination.y);
            }
        } finally { this.cancel(); }
    }
    private refresh(): void {
        if (!this.id || !this.config) return;
        const entry = this.config.registry.get(this.id);
        const definition = entry && getBuildingDefinition(entry.data.definitionId);
        if (!entry?.node.isValid || !definition) { this.cancel(); return; }
        this.destination = null;
        const cell = this.overUi() ? null : this.config.projector.projectScreenPoint(this.pointer);
        if (!cell) { this.config.ghost.hide(); return; }
        const x = cell.x - this.grabOffset.x, y = cell.y - this.grabOffset.y;
        const snapshot = this.config.service.preview(this.id, x, y);
        if (!snapshot) { this.cancel(); return; }
        this.config.ghost.updatePlacement(definition, snapshot);
        if (snapshot.canPlace) this.destination = { x, y };
    }
    private onKeyDown(event: EventKeyboard): void {
        if (event.keyCode === KeyCode.SPACE) { this.spacePressed = true; this.cancel(); }
        if (event.keyCode === KeyCode.ESCAPE) this.cancel();
    }
    private onKeyUp(event: EventKeyboard): void {
        if (event.keyCode === KeyCode.SPACE) this.spacePressed = false;
    }
}
