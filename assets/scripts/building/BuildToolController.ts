/**
 * Why this file exists:
 * Build Mode 需要统一拥有输入状态，并把高频 Pointer Event 转换为每帧一次的
 * authoritative pointer sample，避免 Ghost 直接被事件频率驱动。
 *
 * Ownership boundary:
 * 本文件拥有 Build Mode 生命周期、latest pointer screen position、
 * 输入监听和每帧 Ghost refresh 调度。
 *
 * This file deliberately does NOT:
 * 不做 Grid 投影、不判断 placement 合法性、不扣资源，也不直接设置 Ghost 位置。
 */
import { _decorator, Component, Event, EventKeyboard, EventMouse, input, Input, KeyCode, Node, UITransform, Vec2 } from 'cc';
import { BuildingPlacementTool } from './BuildingPlacementTool';
const { ccclass } = _decorator;

export interface BuildToolState { active: boolean; definitionId: string | null; }
export type BuildToolStateListener = (state: BuildToolState) => void;

@ccclass('BuildToolController')
export class BuildToolController extends Component {
    private tool: BuildingPlacementTool | null = null;
    private active = false;
    private definitionId: string | null = null;
    private readonly stateListeners = new Set<BuildToolStateListener>();
    private inputExcludedNodes: readonly Node[] = [];
    private latestPointerScreenPosition: Vec2 | null = null;
    private inputBlockedPredicate: (() => boolean) | null = null;
    public setup(tool: BuildingPlacementTool): void { this.tool = tool; }
    public setInputBlockedPredicate(predicate: (() => boolean) | null): void { this.inputBlockedPredicate = predicate; }
    public setInputExcludedNode(node: Node | null): void { this.inputExcludedNodes = node ? [node] : []; }
    public setInputExcludedNodes(nodes: readonly Node[]): void { this.inputExcludedNodes = nodes; }
    public isActive(): boolean { return this.active; }
    public getState(): BuildToolState { return { active: this.active, definitionId: this.definitionId }; }
    public subscribeState(listener: BuildToolStateListener): () => void {
        const listeners = this.stateListeners;
        listeners.add(listener);
        listener(this.getState());
        return () => listeners.delete(listener);
    }
    public select(definitionId: string): void {
        if (this.inputBlockedPredicate?.()) return;
        if (this.active && this.definitionId === definitionId) {
            this.cancel();
            return;
        }
        this.definitionId = definitionId;
        this.active = true;
        this.tool?.setDefinition(definitionId);
        if (this.latestPointerScreenPosition) {
            this.tool?.refreshPointer(this.latestPointerScreenPosition);
        }
        this.notifyState();
    }
    public cancel(): void {
        if (!this.active && !this.definitionId) return;
        this.active = false;
        this.definitionId = null;
        this.tool?.setDefinition(null);
        this.notifyState();
    }
    lateUpdate(): void {
        if (!this.active || !this.latestPointerScreenPosition) return;
        if (this.isScreenPointOverExcludedUi(this.latestPointerScreenPosition)) {
            this.tool?.hideGhost();
            return;
        }
        this.tool?.refreshPointer(this.latestPointerScreenPosition);
    }
    onEnable(): void {
        input.on(Input.EventType.MOUSE_MOVE, this.onPointerMove, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onPointerDown, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onPointerMove, this);
        input.on(Input.EventType.TOUCH_START, this.onPointerDown, this);
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    onDisable(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onPointerMove, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onPointerDown, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onPointerMove, this);
        input.off(Input.EventType.TOUCH_START, this.onPointerDown, this);
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    private onPointerMove(event: Event): void { this.samplePointer(event); }
    private onPointerDown(event: Event): void {
        if (this.inputBlockedPredicate?.()) return;
        if (!this.active) return;
        if (event instanceof EventMouse && event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.cancel();
            return;
        }
        if (this.isPointerOverExcludedUi(event)) return;
        const screenPoint = this.samplePointer(event);
        if (!screenPoint) return;
        this.tool?.refreshPointer(screenPoint);
        if (this.tool?.confirmCurrentPlacement()) this.cancel();
    }
    private onKeyDown(event: EventKeyboard): void {
        if (this.inputBlockedPredicate?.()) return;
        if (this.active && event.keyCode === KeyCode.ESCAPE) this.cancel();
    }
    private isPointerOverExcludedUi(event: Event): boolean {
        const location = (event as Event & { getLocation?: () => { x: number; y: number } }).getLocation?.();
        if (!location) return false;
        return this.isScreenPointOverExcludedUi(new Vec2(location.x, location.y));
    }
    private isScreenPointOverExcludedUi(point: Vec2): boolean {
        return this.inputExcludedNodes.some((node) =>
            node.isValid && node.activeInHierarchy
            && !!node.getComponent(UITransform)?.getBoundingBoxToWorld().contains(point));
    }
    private samplePointer(event: Event): Vec2 | null {
        const location = (event as Event & { getLocation?: () => { x: number; y: number } }).getLocation?.();
        if (!location) return null;
        this.latestPointerScreenPosition = new Vec2(location.x, location.y);
        return this.latestPointerScreenPosition;
    }
    private notifyState(): void {
        const state = this.getState();
        for (const listener of this.stateListeners) listener(state);
    }
}
