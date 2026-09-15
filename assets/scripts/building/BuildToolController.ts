/**
 * Why this file exists:
 * 建造模式需要单一状态拥有者，统一绑定输入并让世界指令知道何时暂停。
 *
 * Ownership boundary:
 * 本文件拥有 active 状态、当前蓝图和建造输入监听。
 *
 * This file deliberately does NOT:
 * 不判断放置合法性、不直接扣资源、不渲染 BuildBar。
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
    public setup(tool: BuildingPlacementTool): void { this.tool = tool; }
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
        if (this.active && this.definitionId === definitionId) {
            this.cancel();
            return;
        }
        this.definitionId = definitionId;
        this.active = true;
        this.tool?.setDefinition(definitionId);
        this.notifyState();
    }
    public cancel(): void {
        if (!this.active && !this.definitionId) return;
        this.active = false;
        this.definitionId = null;
        this.tool?.setDefinition(null);
        this.notifyState();
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
    private onPointerMove(event: Event): void { if (this.active) this.tool?.handlePointerMove(event); }
    private onPointerDown(event: Event): void {
        if (!this.active) return;
        if (event instanceof EventMouse && event.getButton() === EventMouse.BUTTON_RIGHT) {
            this.cancel();
            return;
        }
        if (this.isPointerOverExcludedUi(event)) return;
        if (this.tool?.handlePointerDown(event)) this.cancel();
    }
    private onKeyDown(event: EventKeyboard): void {
        if (this.active && event.keyCode === KeyCode.ESCAPE) this.cancel();
    }
    private isPointerOverExcludedUi(event: Event): boolean {
        const location = (event as Event & { getLocation?: () => { x: number; y: number } }).getLocation?.();
        if (!location) return false;
        const point = new Vec2(location.x, location.y);
        return this.inputExcludedNodes.some((node) =>
            node.isValid && node.activeInHierarchy
            && !!node.getComponent(UITransform)?.getBoundingBoxToWorld().contains(point));
    }
    private notifyState(): void {
        const state = this.getState();
        for (const listener of this.stateListeners) listener(state);
    }
}
