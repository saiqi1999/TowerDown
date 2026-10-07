/**
 * Why this file exists:
 * 十二个建筑槽、中央基地和四面城墙必须共享一份坐标定义，避免渲染、建造与导航各写一套布局。
 *
 * Ownership boundary:
 * 本文件拥有城市范围、槽位、边框与门的纯数据和一致性校验。
 *
 * This file deliberately does NOT:
 * 不加载图片、不创建节点、不保存建筑占用，也不直接修改导航状态。
 */
import { type BuildingInstanceData } from '../building/BuildingTypes';
import {
    NavigationObstacleResolver,
} from '../navigation/NavigationObstacleResolver';
import { type GridCell } from '../navigation/NavigationTypes';
import { type WorldOccupant } from '../world/WorldCellGrid';

export type CitySide = 'north' | 'south' | 'west' | 'east';

export interface CitySlot {
    id: string;
    x: number;
    y: number;
    width: 2;
    height: 2;
}

export interface CityBoundaryCell extends GridCell {
    side: CitySide;
    kind: 'wall' | 'gate';
    gatePart?: 'first' | 'second';
}

export const CITY_LAYOUT = {
    x: 15,
    y: 7,
    width: 10,
    height: 10,
    base: { x: 18, y: 10, width: 4, height: 4 },
} as const;

const SLOT_ANCHORS = [
    [16, 8], [18, 8], [20, 8], [22, 8],
    [16, 10], [22, 10],
    [16, 12], [22, 12],
    [16, 14], [18, 14], [20, 14], [22, 14],
] as const;

const CITY_SLOTS: readonly CitySlot[] = SLOT_ANCHORS.map(([x, y], index) => ({
    id: `S${String(index + 1).padStart(2, '0')}`,
    x,
    y,
    width: 2,
    height: 2,
}));

const GATE_KEYS = new Set([
    '19,7', '20,7',
    '19,16', '20,16',
    '15,11', '15,12',
    '24,11', '24,12',
]);

export function getCitySlots(): readonly CitySlot[] {
    return CITY_SLOTS;
}

export function findSlotContainingCell(cell: GridCell): CitySlot | null {
    return CITY_SLOTS.find((slot) =>
        cell.x >= slot.x
        && cell.x < slot.x + slot.width
        && cell.y >= slot.y
        && cell.y < slot.y + slot.height) ?? null;
}

export function findSlotByAnchor(x: number, y: number): CitySlot | null {
    return CITY_SLOTS.find((slot) => slot.x === x && slot.y === y) ?? null;
}

export function getCityBoundaryCells(): readonly CityBoundaryCell[] {
    const cells: CityBoundaryCell[] = [];
    const right = CITY_LAYOUT.x + CITY_LAYOUT.width - 1;
    const bottom = CITY_LAYOUT.y + CITY_LAYOUT.height - 1;
    for (let x = CITY_LAYOUT.x; x <= right; x += 1) {
        cells.push(makeBoundaryCell(x, CITY_LAYOUT.y, 'north'));
        cells.push(makeBoundaryCell(x, bottom, 'south'));
    }
    for (let y = CITY_LAYOUT.y + 1; y < bottom; y += 1) {
        cells.push(makeBoundaryCell(CITY_LAYOUT.x, y, 'west'));
        cells.push(makeBoundaryCell(right, y, 'east'));
    }
    return cells;
}

export function buildBoundaryOccupants(
    resolver: NavigationObstacleResolver,
): WorldOccupant[] {
    const cells = getCityBoundaryCells();
    const walls = cells
        .filter((cell) => cell.kind === 'wall')
        .map((cell) => resolver.forBoundary({
            ownerId: `city:wall:${cell.x}:${cell.y}`,
            placementCells: [cell],
            passable: false,
        }));
    const gates: Array<{ side: CitySide; cells: GridCell[] }> = [
        { side: 'north', cells: [{ x: 19, y: 7 }, { x: 20, y: 7 }] },
        { side: 'south', cells: [{ x: 19, y: 16 }, { x: 20, y: 16 }] },
        { side: 'west', cells: [{ x: 15, y: 11 }, { x: 15, y: 12 }] },
        { side: 'east', cells: [{ x: 24, y: 11 }, { x: 24, y: 12 }] },
    ];
    return [
        ...walls,
        ...gates.map((gate) => resolver.forBoundary({
            ownerId: `city:gate:${gate.side}`,
            placementCells: gate.cells,
            passable: true,
        })),
    ];
}

export function validateCityLayout(): void {
    const slots = getCitySlots();
    const boundaries = getCityBoundaryCells();
    if (slots.length !== 12 || boundaries.length !== 36) {
        throw new Error('[CityLayout] expected 12 slots and 36 boundary cells.');
    }
    const occupied = new Set<string>();
    for (const slot of slots) {
        for (let y = slot.y; y < slot.y + slot.height; y += 1) {
            for (let x = slot.x; x < slot.x + slot.width; x += 1) {
                const key = `${x},${y}`;
                if (occupied.has(key)) throw new Error(`[CityLayout] overlapping slot cell: ${key}`);
                occupied.add(key);
            }
        }
    }
    for (let y = CITY_LAYOUT.base.y; y < CITY_LAYOUT.base.y + CITY_LAYOUT.base.height; y += 1) {
        for (let x = CITY_LAYOUT.base.x; x < CITY_LAYOUT.base.x + CITY_LAYOUT.base.width; x += 1) {
            const key = `${x},${y}`;
            if (occupied.has(key)) throw new Error(`[CityLayout] slot overlaps base: ${key}`);
            occupied.add(key);
        }
    }
    const gateCount = boundaries.filter((cell) => cell.kind === 'gate').length;
    if (gateCount !== 8) throw new Error(`[CityLayout] expected 8 gate cells, got ${gateCount}.`);
}

export function assertBuildingsInCitySlots(buildings: readonly BuildingInstanceData[]): void {
    for (const building of buildings) {
        if (!findSlotByAnchor(building.gridX, building.gridY)) {
            throw new Error(
                `[CityLayout] building ${building.id} is outside a fixed city slot.`,
            );
        }
    }
}

function makeBoundaryCell(x: number, y: number, side: CitySide): CityBoundaryCell {
    const kind = GATE_KEYS.has(`${x},${y}`) ? 'gate' : 'wall';
    let gatePart: CityBoundaryCell['gatePart'];
    if (kind === 'gate') {
        gatePart = side === 'north' || side === 'south'
            ? (x === 19 ? 'first' : 'second')
            : (y === 11 ? 'first' : 'second');
    }
    return { x, y, side, kind, gatePart };
}
