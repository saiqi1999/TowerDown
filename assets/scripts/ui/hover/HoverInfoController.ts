/**
 * Why this file exists:
 * Multiple UI and world targets need one tooltip that remains stable while anchors and camera move.
 *
 * Ownership boundary:
 * This file uniquely owns the current hover source, delays, content refresh, and placement updates.
 *
 * This file deliberately does NOT:
 * It does not know building, monster, resource, or squad rules and issues no gameplay commands.
 */
import { _decorator, Component, EventMouse, input, Input, Node, UITransform, Vec2 } from 'cc';
import { HoverInfoPanelView } from './HoverInfoPanelView';
import { resolveHoverPlacement } from './HoverPlacementResolver';
import { HoverTargetScope, type HoverInfoSource } from './HoverInfoTypes';
import {
    HOVER_ANCHOR_GAP,
    HOVER_CONTENT_REFRESH_SECONDS,
    HOVER_HIDE_DELAY_SECONDS,
    HOVER_SAFE_MARGIN,
    HOVER_SHOW_DELAY_SECONDS,
} from './HoverInfoUiConfig';

const { ccclass } = _decorator;

@ccclass('HoverInfoController')
export class HoverInfoController extends Component {
    private panel: HoverInfoPanelView | null = null;
    private hudTransform: UITransform | null = null;
    private current: HoverInfoSource | null = null;
    private currentToken = 0;
    private showTimer = 0;
    private hideTimer = -1;
    private refreshTimer = 0;
    private signature = '';
    private pointer = new Vec2();
    private hasPointer = false;
    private worldHoverEnabled: () => boolean = () => true;

    public setup(panel: HoverInfoPanelView, hudTransform: UITransform): void {
        this.panel = panel;
        this.hudTransform = hudTransform;
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    public setWorldHoverEnabledPredicate(predicate: () => boolean): void {
        this.worldHoverEnabled = predicate;
    }

    public enter(source: HoverInfoSource): void {
        if (source.scope === HoverTargetScope.World && !this.worldHoverEnabled()) return;
        this.currentToken += 1;
        this.current = source;
        this.showTimer = HOVER_SHOW_DELAY_SECONDS;
        this.hideTimer = -1;
        this.refreshTimer = 0;
        this.signature = '';
    }

    public leave(anchor: Node): void {
        if (this.current?.anchor !== anchor) return;
        this.currentToken += 1;
        this.hideTimer = HOVER_HIDE_DELAY_SECONDS;
    }

    public release(anchor: Node): void {
        if (this.current?.anchor === anchor) this.hideImmediately();
    }

    update(dt: number): void {
        if (!this.current) return;
        if (this.current.scope === HoverTargetScope.World && !this.worldHoverEnabled()) {
            this.hideImmediately();
            return;
        }
        if (this.hideTimer >= 0) {
            this.hideTimer -= dt;
            if (this.hideTimer <= 0) this.hideImmediately();
            return;
        }
        if (!this.panel?.isVisible()) {
            this.showTimer -= dt;
            if (this.showTimer <= 0) {
                this.refreshContent();
                this.panel?.setVisible(true);
            }
            return;
        }
        this.refreshTimer -= dt;
        if (this.refreshTimer <= 0) this.refreshContent();
    }

    lateUpdate(): void {
        const source = this.current;
        const panel = this.panel;
        if (!source || !panel?.isVisible() || !source.anchor.isValid || !source.anchor.activeInHierarchy) {
            if (source && (!source.anchor.isValid || !source.anchor.activeInHierarchy)) this.hideImmediately();
            return;
        }
        const anchorTransform = source.anchor.getComponent(UITransform);
        if (!anchorTransform || !this.hudTransform) {
            this.hideImmediately();
            return;
        }
        const anchorRect = anchorTransform.getBoundingBoxToWorld();
        if (
    this.hasPointer
    && !anchorTransform.hitTest(this.pointer)
) {
    this.hideImmediately();
    return;
}
        const size = panel.getSize();
        const result = resolveHoverPlacement(
            anchorRect,
            size.width,
            size.height,
            source.preferredPlacement,
            this.hudTransform.getBoundingBoxToWorld(),
            HOVER_ANCHOR_GAP,
            HOVER_SAFE_MARGIN,
        );
        panel.setWorldPosition(result.worldX, result.worldY);
    }

    protected onDestroy(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    private refreshContent(): void {
        const model = this.current?.getInfo();
        if (!model || !this.panel) return;
        const signature = JSON.stringify(model);
        if (signature !== this.signature) {
            this.signature = signature;
            this.panel.setModel(model);
        }
        this.refreshTimer = HOVER_CONTENT_REFRESH_SECONDS;
    }

    private hideImmediately(): void {
        this.current = null;
        this.currentToken += 1;
        this.hideTimer = -1;
        this.panel?.setVisible(false);
    }

    private onMouseMove(event: EventMouse): void {
    event.getLocation(this.pointer);
    this.hasPointer = true;
}
}
