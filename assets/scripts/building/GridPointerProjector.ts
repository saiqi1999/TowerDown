/**
 * Why this file exists:
 * 建筑输入必须把屏幕 pointer 通过明确的 World Camera 和 MapRoot transform
 * 稳定投影到逻辑 Grid；Viewport Pan/Zoom 后所有 placement 仍必须使用同一转换。
 *
 * Ownership boundary:
 * 本文件只负责 pointer -> world -> MapRoot local -> grid 的几何投影。
 *
 * This file deliberately does NOT:
 * 不监听输入、不控制 Camera/Viewport、不判断 placement 合法性。
 */
import { Camera, Event, Node, Vec3 } from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { type GridCell } from '../navigation/NavigationTypes';

export class GridPointerProjector {
    constructor(
        private readonly mapNode: Node,
        private readonly camera: Camera,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
    ) {}

    public project(event: Event): GridCell | null {
        const location = (event as Event & { getLocation?: () => Vec3 }).getLocation?.();
        if (!location) return null;
        const world = new Vec3(location.x, location.y, 0);
        this.camera.screenToWorld(world, world);
        const local = this.mapNode.inverseTransformPoint(new Vec3(), world);
        const x = Math.floor((local.x + this.mapWidth * GRID_RENDER_SIZE / 2) / GRID_RENDER_SIZE);
        const y = Math.floor((this.mapHeight * GRID_RENDER_SIZE / 2 - local.y) / GRID_RENDER_SIZE);
        return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight ? { x, y } : null;
    }
}
