/**
 * Why this file exists:
 * Any node with a UITransform needs the same small adapter from mouse hover to the shared controller.
 *
 * Ownership boundary:
 * This file owns mouse enter, mouse leave, and release forwarding for one anchor node.
 *
 * This file deliberately does NOT:
 * It does not create a tooltip panel, cache dynamic content, or read gameplay state itself.
 */
import { _decorator, Component, Node } from 'cc';
import { type HoverInfoTargetConfig } from './HoverInfoTypes';

const { ccclass } = _decorator;

@ccclass('HoverInfoTarget')
export class HoverInfoTarget extends Component {
    private config: HoverInfoTargetConfig | null = null;

    public setup(config: HoverInfoTargetConfig): void {
        this.config = config;
    }

    protected onEnable(): void {
        this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    protected onDisable(): void {
        this.node.off(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    protected onDestroy(): void {
        this.config?.controller.release(this.node);
    }

    private onMouseEnter(): void {
        const config = this.config;
        if (!config) return;
        config.controller.enter({
            anchor: this.node,
            kind: config.kind,
            scope: config.scope,
            preferredPlacement: config.preferredPlacement,
            getInfo: config.getInfo,
        });
    }

    private onMouseLeave(): void {
        this.config?.controller.leave(this.node);
    }
}
