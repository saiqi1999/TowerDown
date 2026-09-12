import { Vec3 } from 'cc';
import { GRID_RENDER_SIZE } from './GridConfig';

export function gridPointToWorld(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    const totalWidth = mapWidth * GRID_RENDER_SIZE;
    const totalHeight = mapHeight * GRID_RENDER_SIZE;

    return new Vec3(
        -totalWidth / 2 + gridX * GRID_RENDER_SIZE,
        totalHeight / 2 - gridY * GRID_RENDER_SIZE,
        0,
    );
}

export function gridCellToWorldCenter(
    gridX: number,
    gridY: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    return gridPointToWorld(
        gridX + 0.5,
        gridY + 0.5,
        mapWidth,
        mapHeight,
    );
}

export function gridRectToWorldCenter(
    gridX: number,
    gridY: number,
    gridW: number,
    gridH: number,
    mapWidth: number,
    mapHeight: number,
): Vec3 {
    return gridPointToWorld(
        gridX + gridW / 2,
        gridY + gridH / 2,
        mapWidth,
        mapHeight,
    );
}
