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
import { HoverTargetKind, HoverTargetScope, type HoverInfoSource } from './HoverInfoTypes';
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
    private readonly targets = new Map<Node, HoverInfoSource>();
    private panel: HoverInfoPanelView | null = null;
    private hudTransform: UITransform | null = null;
    private hovered: HoverInfoSource | null = null;
    private current: HoverInfoSource | null = null;
    private showTimer = 0;
    private hideTimer = -1;
    private refreshTimer = 0;
    private signature = '';
    private pointer = new Vec2();
    private hasPointer = false;
    private windowId = 0;
    private worldHoverEnabled: () => boolean = () => true;

    public setup(panel: HoverInfoPanelView, hudTransform: UITransform): void {
        this.panel = panel;
        this.hudTransform = hudTransform;
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    }

    public setWorldHoverEnabledPredicate(predicate: () => boolean): void {
        this.worldHoverEnabled = predicate;
    }

    public setSuspended(suspended: boolean): void {
        if (!suspended) return;
        this.hideImmediately();
        this.hasPointer = false;
    }

    public register(source: HoverInfoSource): void {
        this.targets.set(source.anchor, source);
    }

    public unregister(anchor: Node): void {
        this.targets.delete(anchor);
        if (this.hovered?.anchor === anchor) {
            this.hovered = null;
        }

        if (this.current?.anchor === anchor) {
            this.hideImmediately();
        }
    }

    update(dt: number): void {
        if (this.current?.scope === HoverTargetScope.World && !this.worldHoverEnabled()) {
            this.hideImmediately();
            return;
        }

        if (this.hideTimer >= 0) {
            this.hideTimer -= dt;
            if (this.hideTimer <= 0 && !this.hovered) {
                this.hideImmediately();
            }
        }

        if (this.current && !this.panel?.isVisible()) {
            this.showTimer -= dt;
            if (this.showTimer <= 0) {
                this.refreshContent();
                this.panel?.setVisible(true);
            }
        }

        if (this.current && this.panel?.isVisible()) {
            this.refreshTimer -= dt;
            if (this.refreshTimer <= 0) {
                this.refreshContent();
            }
        }
    }

    lateUpdate(): void {
        this.resolveHoveredTarget();
        this.updatePanelPosition();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.targets.clear();
        this.hovered = null;
        this.current = null;
    }

    private resolveHoveredTarget(): void {
        const next = this.pickTarget();
        if (next?.anchor === this.hovered?.anchor) {
            return;
        }

        const previous = this.hovered;
        this.hovered = next;

        if (next) {
            this.onHoverChanged(previous, next);
            return;
        }

        this.beginHide();
    }

    private pickTarget(): HoverInfoSource | null {
        if (!this.hasPointer) {
            return null;
        }

        let best: HoverInfoSource | null = null;
        let bestPriority = Number.NEGATIVE_INFINITY;

        for (const source of this.targets.values()) {
            const anchor = source.anchor;
            if (!anchor.isValid || !anchor.activeInHierarchy) {
                continue;
            }

            if (source.scope === HoverTargetScope.World && !this.worldHoverEnabled()) {
                continue;
            }

            const transform = anchor.getComponent(UITransform);
            if (!transform || !transform.hitTest(this.pointer, this.windowId)) {
                continue;
            }

            const priority = this.getPriority(source);
            if (priority > bestPriority) {
                best = source;
                bestPriority = priority;
            }
        }

        return best;
    }

    private getPriority(source: HoverInfoSource): number {
        if (source.scope === HoverTargetScope.UI) {
            return 1000;
        }

        switch (source.kind) {
        case HoverTargetKind.Monster:
            return 300;
        case HoverTargetKind.Building:
            return 200;
        case HoverTargetKind.Resource:
            return 100;
        case HoverTargetKind.Base:
            return 90;
        default:
            return 0;
        }
    }

    private onHoverChanged(_previous: HoverInfoSource | null, next: HoverInfoSource): void {
        this.beginShow(next);
    }

    private beginShow(source: HoverInfoSource): void {
        const alreadyVisible = this.panel?.isVisible() ?? false;
        this.current = source;
        this.signature = '';
        this.refreshTimer = 0;
        this.hideTimer = -1;

        if (alreadyVisible) {
            this.showTimer = 0;
            this.refreshContent();
            this.panel?.setVisible(true);
            return;
        }

        this.showTimer = HOVER_SHOW_DELAY_SECONDS;
    }

    private beginHide(): void {
        if (!this.current) {
            return;
        }

        this.hideTimer = HOVER_HIDE_DELAY_SECONDS;
    }

    private updatePanelPosition(): void {
        const source = this.current;
        const panel = this.panel;
        if (!source || !panel?.isVisible()) {
            return;
        }

        if (!source.anchor.isValid || !source.anchor.activeInHierarchy) {
            this.hideImmediately();
            return;
        }

        const anchorTransform = source.anchor.getComponent(UITransform);
        if (!anchorTransform || !this.hudTransform) {
            this.hideImmediately();
            return;
        }

        const anchorRect = anchorTransform.getBoundingBoxToWorld();
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
        this.hovered = null;
        this.hideTimer = -1;
        this.panel?.setVisible(false);
    }

    private onMouseMove(event: EventMouse): void {
        event.getLocation(this.pointer);
        this.windowId = event.windowId ?? 0;
        this.hasPointer = true;
    }
}
