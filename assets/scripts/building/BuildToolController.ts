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
import { _decorator, Component, Event, input, Input } from 'cc';
import { BuildingPlacementTool } from './BuildingPlacementTool';
const { ccclass } = _decorator;

@ccclass('BuildToolController')
export class BuildToolController extends Component {
    private tool: BuildingPlacementTool | null = null;
    private active = false;
    private definitionId: string | null = null;
    public setup(tool: BuildingPlacementTool): void { this.tool = tool; }
    public isActive(): boolean { return this.active; }
    public select(definitionId: string): void {
        this.definitionId = definitionId;
        this.active = true;
        this.tool?.setDefinition(definitionId);
    }
    public cancel(): void {
        this.active = false;
        this.definitionId = null;
        this.tool?.setDefinition(null);
    }
    onEnable(): void {
        input.on(Input.EventType.MOUSE_MOVE, this.onPointerMove, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onPointerDown, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onPointerMove, this);
        input.on(Input.EventType.TOUCH_START, this.onPointerDown, this);
    }
    onDisable(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onPointerMove, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onPointerDown, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onPointerMove, this);
        input.off(Input.EventType.TOUCH_START, this.onPointerDown, this);
    }
    private onPointerMove(event: Event): void { if (this.active) this.tool?.handlePointerMove(event); }
    private onPointerDown(event: Event): void {
        if (!this.active) return;
        if (this.tool?.handlePointerDown(event)) this.cancel();
    }
}
