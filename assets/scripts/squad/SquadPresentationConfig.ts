/**
 * Why this file exists:
 * Unit size, formation density and idle pacing need explicit tuning controls.
 *
 * Ownership boundary:
 * This file owns presentation and idle tuning values, in grid units and seconds.
 *
 * This file deliberately does NOT:
 * It does not change combat stats, choose destinations or move scene nodes.
 */
export const SQUAD_PRESENTATION = {
    // Relative to the original GRID_RENDER_SCALE; 16px sprite instead of 32px.
    warriorScaleMultiplier: 0.5,
    // 0.6 cells = 19.2px between centers on the current 32px grid.
    formationSpacingCells: 0.6,
    idleWaitMinSeconds: 0.8,
    idleWaitMaxSeconds: 2.5,
    idleMinTravelCells: 1,
} as const;
