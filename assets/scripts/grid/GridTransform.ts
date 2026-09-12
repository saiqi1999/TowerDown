import { Vec3 } from 'cc';
import { GRID_RENDER_SIZE } from './GridConfig';

export function gridCellToWorldCenter(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    return gridRectToWorldCenter(gridX, gridY, 1, 1, mapWidth, mapHeight);
}

export function gridRectToWorldCenter(
    gridX: number,
    gridY: number,
    gridW: number,
    gridH: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    const totalWidth = mapWidth * GRID_RENDER_SIZE;
    const totalHeight = mapHeight * GRID_RENDER_SIZE;

    const x = -totalWidth / 2 + (gridX + gridW / 2) * GRID_RENDER_SIZE;
    const y = totalHeight / 2 - (gridY + gridH / 2) * GRID_RENDER_SIZE;

    return new Vec3(x, y, 0);
}
