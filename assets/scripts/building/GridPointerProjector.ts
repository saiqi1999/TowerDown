/**
 * Why this file exists:
 * 建筑放置需要把当前 screen-space pointer 在最新 Camera/MapRoot transform 下
 * 稳定转换成逻辑 Grid Cell。
 *
 * Ownership boundary:
 * 本文件只负责 screen point -> world -> MapRoot local -> grid 的几何投影。
 *
 * This file deliberately does NOT:
 * 不监听 Event、不控制 Camera、不验证 placement，也不更新 Ghost。
 */
import { Camera, Node, Vec2, Vec3 } from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { type GridCell } from '../navigation/NavigationTypes';

export class GridPointerProjector {
    constructor(
        private readonly mapNode: Node,
        private readonly camera: Camera,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
    ) {}

    public projectScreenPoint(screenPoint: Vec2): GridCell | null {
        const world = new Vec3(screenPoint.x, screenPoint.y, 0);
        this.camera.screenToWorld(world, world);
        const local = this.mapNode.inverseTransformPoint(new Vec3(), world);
        const x = Math.floor((local.x + this.mapWidth * GRID_RENDER_SIZE / 2) / GRID_RENDER_SIZE);
        const y = Math.floor((this.mapHeight * GRID_RENDER_SIZE / 2 - local.y) / GRID_RENDER_SIZE);
        return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight ? { x, y } : null;
    }
}
