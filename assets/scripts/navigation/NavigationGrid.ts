import { type GridPoint, type NavCell } from './NavigationTypes';
import { WorldCellGrid } from '../world/WorldCellGrid';

export const NAV_SUBDIVISIONS = 2;

export class NavigationGrid {
    public readonly width: number;
    public readonly height: number;
    public readonly mapWidth: number;
    public readonly mapHeight: number;

    constructor(private readonly occupancy: WorldCellGrid) {
        this.mapWidth = occupancy.width;
        this.mapHeight = occupancy.height;
        this.width = occupancy.navWidth;
        this.height = occupancy.navHeight;
    }

    public isInside(nx: number, ny: number): boolean {
        return this.occupancy.isNavInside(nx, ny);
    }

    public isWalkable(nx: number, ny: number): boolean {
        return this.isInside(nx, ny) && !this.occupancy.isNavBlocked(nx, ny);
    }

    public isPointWalkable(point: GridPoint): boolean {
        const cell = this.worldToNavCell(point);
        return this.isWalkable(cell.nx, cell.ny);
    }

    public worldToNavCell(point: GridPoint): NavCell {
        return {
            nx: Math.floor(point.x * NAV_SUBDIVISIONS),
            ny: Math.floor(point.y * NAV_SUBDIVISIONS),
        };
    }

    public navCellToWorldPoint(cell: NavCell): GridPoint {
        return {
            x: (cell.nx + 0.5) / NAV_SUBDIVISIONS,
            y: (cell.ny + 0.5) / NAV_SUBDIVISIONS,
        };
    }

    public canTraverseSegment(start: GridPoint, end: GridPoint): boolean {
        const startX = start.x * NAV_SUBDIVISIONS;
        const startY = start.y * NAV_SUBDIVISIONS;
        const endX = end.x * NAV_SUBDIVISIONS;
        const endY = end.y * NAV_SUBDIVISIONS;
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        let nx = Math.floor(startX);
        let ny = Math.floor(startY);
        const endNx = Math.floor(endX);
        const endNy = Math.floor(endY);
        if (!this.isWalkable(nx, ny)) return false;

        const stepX = Math.sign(deltaX);
        const stepY = Math.sign(deltaY);
        const tDeltaX = stepX === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaX);
        const tDeltaY = stepY === 0 ? Number.POSITIVE_INFINITY : 1 / Math.abs(deltaY);
        let tMaxX = stepX === 0
            ? Number.POSITIVE_INFINITY
            : ((stepX > 0 ? nx + 1 : nx) - startX) / deltaX;
        let tMaxY = stepY === 0
            ? Number.POSITIVE_INFINITY
            : ((stepY > 0 ? ny + 1 : ny) - startY) / deltaY;

        while (nx !== endNx || ny !== endNy) {
            if (tMaxX < tMaxY) {
                nx += stepX;
                tMaxX += tDeltaX;
            } else if (tMaxY < tMaxX) {
                ny += stepY;
                tMaxY += tDeltaY;
            } else {
                // Corner crossings touch both side cells; both must be open to prevent diagonal clipping.
                const nextNx = nx + stepX;
                const nextNy = ny + stepY;
                if (!this.isWalkable(nextNx, ny) || !this.isWalkable(nx, nextNy)) return false;
                nx = nextNx;
                ny = nextNy;
                tMaxX += tDeltaX;
                tMaxY += tDeltaY;
            }
            if (!this.isWalkable(nx, ny)) return false;
        }
        return true;
    }

    public countBlocked(): number {
        let blocked = 0;
        for (let ny = 0; ny < this.height; ny += 1) {
            for (let nx = 0; nx < this.width; nx += 1) {
                if (!this.isWalkable(nx, ny)) blocked += 1;
            }
        }
        return blocked;
    }
}
