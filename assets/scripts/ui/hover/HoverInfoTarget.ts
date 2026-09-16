/**
 * Why this file exists:
 * Hoverable nodes need a small adapter that registers the live Node with the shared controller.
 *
 * Ownership boundary:
 * This file owns one node's hover source registration and unregistration lifecycle.
 *
 * This file deliberately does NOT:
 * It does not decide whether the pointer is inside the node, own tooltip state, or cache coordinates.
 */
import { _decorator, Component } from 'cc';
import { type HoverInfoTargetConfig } from './HoverInfoTypes';

const { ccclass } = _decorator;

@ccclass('HoverInfoTarget')
export class HoverInfoTarget extends Component {
    private config: HoverInfoTargetConfig | null = null;
    private registered = false;

    public setup(config: HoverInfoTargetConfig): void {
        if (this.registered && this.config?.controller !== config.controller) {
            this.unregister();
        }
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
        });
        this.registered = true;
    }

    private unregister(): void {
        if (!this.registered || !this.config) {
            return;
        }

        this.config.controller.unregister(this.node);
        this.registered = false;
    }
}
