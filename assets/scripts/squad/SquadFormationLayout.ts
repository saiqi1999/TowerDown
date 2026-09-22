/**
 * Why this file exists:
 * Squad members need one deterministic formation layout for spawning, expansion,
 * reforming, and floor recovery.
 *
 * Ownership boundary:
 * This file owns pure grid-space formation geometry and stable member-to-slot
 * assignment.
 *
 * This file deliberately does NOT:
 * It does not move Nodes, inspect navigation, or decide whether a formation fits.
 */
import { type GridPoint } from '../navigation/NavigationTypes';

export const DEFAULT_SQUAD_FORMATION_SPACING = 1.1;
export const MAX_SQUAD_FORMATION_MEMBERS = 16;

export function generateFormationOffsets(
    count: number,
    spacing = DEFAULT_SQUAD_FORMATION_SPACING,
): GridPoint[] {
    if (!Number.isInteger(count) || count < 0 || count > MAX_SQUAD_FORMATION_MEMBERS) {
        throw new Error(`[SquadFormationLayout] invalid member count: ${count}`);
    }
    if (!Number.isFinite(spacing) || spacing <= 0) {
        throw new Error(`[SquadFormationLayout] invalid spacing: ${spacing}`);
    }
    if (count === 0) return [];

    const columns = Math.min(4, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const offsets: GridPoint[] = [];
    for (let row = 0; row < rows; row += 1) {
        const membersInRow = Math.min(columns, count - row * columns);
        for (let column = 0; column < membersInRow; column += 1) {
            offsets.push({
                x: (column - (membersInRow - 1) / 2) * spacing,
                y: (row - (rows - 1) / 2) * spacing,
            });
        }
    }
    return offsets;
}

export function assignFormation(
    memberIds: readonly string[],
    spacing = DEFAULT_SQUAD_FORMATION_SPACING,
): ReadonlyMap<string, GridPoint> {
    const uniqueIds = new Set(memberIds);
    if (uniqueIds.size !== memberIds.length) {
        throw new Error('[SquadFormationLayout] member ids must be unique.');
    }
    const offsets = generateFormationOffsets(memberIds.length, spacing);
    return new Map(memberIds.map((id, index) => [id, offsets[index]!]));
}

export function getFormationBounds(offsets: readonly GridPoint[]): {
    minX: number; maxX: number; minY: number; maxY: number;
} {
    if (offsets.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    return offsets.reduce((bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        maxX: Math.max(bounds.maxX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxY: Math.max(bounds.maxY, point.y),
    }), {
        minX: offsets[0]!.x,
        maxX: offsets[0]!.x,
        minY: offsets[0]!.y,
        maxY: offsets[0]!.y,
    });
}
