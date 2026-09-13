/**
 * Why this file exists:
 * 建造输入需要把屏幕坐标稳定转换为地图格子，避免 UI、Ghost 和提交各自计算。
 *
 * Ownership boundary:
 * 本文件只负责 pointer 到 grid 的几何投影。
 *
 * This file deliberately does NOT:
 * 不处理输入监听、合法性判断或建筑提交。
 */
import { Camera, director, Event, Node, Vec3, view } from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { type GridCell } from '../navigation/NavigationTypes';

export class GridPointerProjector {
    private readonly camera: Camera | null;
    constructor(
        private readonly mapNode: Node,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
    ) {
        this.camera = director.getScene()?.getComponentInChildren(Camera) ?? null;
    }

    public project(event: Event): GridCell | null {
        const location = (event as Event & { getLocation?: () => Vec3 }).getLocation?.();
        if (!location) return null;
        const world = new Vec3(location.x, location.y, 0);
        this.camera?.screenToWorld(world, world);
        const local = this.mapNode.inverseTransformPoint(new Vec3(), world);
        const x = Math.floor((local.x + this.mapWidth * GRID_RENDER_SIZE / 2) / GRID_RENDER_SIZE);
        const y = Math.floor((this.mapHeight * GRID_RENDER_SIZE / 2 - local.y) / GRID_RENDER_SIZE);
        return x >= 0 && y >= 0 && x < this.mapWidth && y < this.mapHeight ? { x, y } : null;
    }
}
