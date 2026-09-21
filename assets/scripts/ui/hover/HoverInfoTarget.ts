/**
 * Why this file exists:
 * Hoverable nodes need a small adapter that registers the live Node with the shared controller.
 *
 * Ownership boundary:
 * This file owns one node's hover source registration and unregistration lifecycle.
 *
 * This file deliberately does NOT:
 * It does not own tooltip state, rank hover targets, or issue gameplay commands.
 */
import { _decorator, Component, EventMouse, Node } from 'cc';
import { HoverTargetScope, type HoverInfoTargetConfig } from './HoverInfoTypes';

const { ccclass } = _decorator;

@ccclass('HoverInfoTarget')
export class HoverInfoTarget extends Component {
    private config: HoverInfoTargetConfig | null = null;
    private registered = false;

    public setup(config: HoverInfoTargetConfig): void {
        this.unregister();
        this.config = config;
        this.registerIfReady();
    }

    protected onEnable(): void {
        this.registerIfReady();
    }

    protected onDisable(): void {
        this.unregister();
    }

    protected onDestroy(): void {
        this.unregister();
    }

    private registerIfReady(): void {
        const config = this.config;
        if (!config || this.registered || !this.node.isValid || !this.node.activeInHierarchy) {
            return;
        }

        config.controller.register({
            anchor: this.node,
            kind: config.kind,
            scope: config.scope,
            preferredPlacement: config.preferredPlacement,
            getInfo: config.getInfo,
            onHoverChanged: config.onHoverChanged,
        });
        if (config.scope === HoverTargetScope.UI) {
            this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
            this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
        }
        this.registered = true;
    }

    private unregister(): void {
        if (!this.registered || !this.config) {
            return;
        }

        this.node.off(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
        this.config.controller.unregister(this.node);
        this.registered = false;
    }

    private onMouseEnter(event: EventMouse): void {
        this.config?.controller.notifyUiEnter(this.node, event);
    }

    private onMouseLeave(): void {
        this.config?.controller.notifyUiLeave(this.node);
    }
}
