/**
 * Why this file exists:
 * A tooltip must offset, flip, and shift around anchors without escaping the HUD safe rect.
 *
 * Ownership boundary:
 * This file owns the pure placement calculation.
 *
 * This file deliberately does NOT:
 * It does not access nodes, mutate panel state, or choose target content.
 */
import { Rect } from 'cc';
import { HoverPlacement } from './HoverInfoTypes';

export interface HoverPlacementResult {
    readonly placement: HoverPlacement;
    readonly worldX: number;
    readonly worldY: number;
}

export function resolveHoverPlacement(
    anchor: Rect,
    panelWidth: number,
    panelHeight: number,
    preferred: HoverPlacement,
    hud: Rect,
    gap: number,
    safeMargin: number,
): HoverPlacementResult {
    const safeLeft = hud.xMin + safeMargin;
    const safeRight = hud.xMax - safeMargin;
    const safeBottom = hud.yMin + safeMargin;
    const safeTop = hud.yMax - safeMargin;
    let placement = preferred;

    if (preferred === HoverPlacement.Right && anchor.xMax + gap + panelWidth > safeRight) {
        placement = HoverPlacement.Left;
    } else if (preferred === HoverPlacement.Left && anchor.xMin - gap - panelWidth < safeLeft) {
        placement = HoverPlacement.Right;
    } else if (preferred === HoverPlacement.Top && anchor.yMax + gap + panelHeight > safeTop) {
        placement = HoverPlacement.Bottom;
    } else if (preferred === HoverPlacement.Bottom && anchor.yMin - gap - panelHeight < safeBottom) {
        placement = HoverPlacement.Top;
    }

    let x = anchor.center.x;
    let y = anchor.center.y;
    if (placement === HoverPlacement.Right) x = anchor.xMax + gap + panelWidth / 2;
    if (placement === HoverPlacement.Left) x = anchor.xMin - gap - panelWidth / 2;
    if (placement === HoverPlacement.Top) y = anchor.yMax + gap + panelHeight / 2;
    if (placement === HoverPlacement.Bottom) y = anchor.yMin - gap - panelHeight / 2;

    x = Math.max(safeLeft + panelWidth / 2, Math.min(safeRight - panelWidth / 2, x));
    y = Math.max(safeBottom + panelHeight / 2, Math.min(safeTop - panelHeight / 2, y));
    return { placement, worldX: x, worldY: y };
}
