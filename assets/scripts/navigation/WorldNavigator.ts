import { TerrainType, type TerrainMap } from '../map/MapTypes';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { AStarPathfinder } from './AStarPathfinder';
import { NavigationGrid } from './NavigationGrid';
import { type GridPoint, type NavCell, type NavigationPathResult } from './NavigationTypes';
import { TargetApproachResolver } from './TargetApproachResolver';

export class WorldNavigator {
    constructor(
        private readonly grid: NavigationGrid,
        private readonly pathfinder: AStarPathfinder,
        private readonly approachResolver: TargetApproachResolver,
    ) {}

    public findPathToObject(
        start: GridPoint,
        target: WorldObjectData,
    ): NavigationPathResult | null {
        const startCell = this.resolveStartCell(start);
        if (!startCell) {
            return null;
        }

        const candidates = this.approachResolver.getApproachCells(target, this.grid);
        if (candidates.length === 0) {
            return null;
        }

        let bestResult: NavigationPathResult | null = null;
        let bestCost = Number.POSITIVE_INFINITY;

        for (const candidate of candidates) {
            const navPath = this.pathfinder.findPath(this.grid, startCell, candidate);
            if (!navPath) {
                continue;
            }
            const path = this.toWorldPath(start, navPath, this.grid.navCellToWorldPoint(candidate));
            if (!path) continue;
            const cost = this.calculatePathCost(startCell, navPath);
            if (cost < bestCost) {
                bestCost = cost;
                bestResult = {
                    approachPoint: this.grid.navCellToWorldPoint(candidate),
                    path,
                };
            }
        }

        return bestResult;
    }

    public findPathToPoint(
        start: GridPoint,
        target: GridPoint,
    ): GridPoint[] | null {
        const startCell = this.resolveStartCell(start);
        const targetCell = this.grid.worldToNavCell(target);
        if (!startCell || !this.grid.isWalkable(targetCell.nx, targetCell.ny)) return null;
        const navPath = this.pathfinder.findPath(this.grid, startCell, targetCell);
        return navPath ? this.toWorldPath(start, navPath, target) : null;
    }

    /** Choose a random reachable terrain cell using the same A* as player commands. */
    public findRandomPathToTerrain(
        start: GridPoint,
        terrain: TerrainMap,
        type: TerrainType,
        minDistance: number,
        random: () => number = Math.random,
    ): GridPoint[] | null {
        const candidates: NavCell[] = [];
        const startCell = this.resolveStartCell(start);
        if (!startCell) return null;
        for (let ny = 0; ny < this.grid.height; ny += 1) {
            for (let nx = 0; nx < this.grid.width; nx += 1) {
                const terrainX = Math.floor(nx / 2);
                const terrainY = Math.floor(ny / 2);
                if (terrain[terrainY]?.[terrainX] !== type || !this.grid.isWalkable(nx, ny)) continue;
                if (startCell.nx === nx && startCell.ny === ny) continue;
                const point = this.grid.navCellToWorldPoint({ nx, ny });
                if (Math.hypot(point.x - start.x, point.y - start.y) < minDistance) continue;
                candidates.push({ nx, ny });
            }
        }
        // Shuffle once, then try each at most once: isolated dirt never stalls the brain.
        for (let i = candidates.length - 1; i > 0; i -= 1) {
            const j = Math.floor(random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
        }
        for (const candidate of candidates) {
            const path = this.findPathToPoint(start, this.grid.navCellToWorldPoint(candidate));
            if (path && path.length > 0) return path;
        }
        return null;
    }

    public findNearestWalkablePointInRow(
        preferredX: number,
        y: number,
    ): GridPoint | null {
        const ny = Math.floor(y * 2);
        if (ny < 0 || ny >= this.grid.height) {
            return null;
        }

        const candidates: number[] = [];
        const startX = Math.floor(preferredX * 2);
        for (let offset = 0; offset < this.grid.width; offset += 1) {
            if (offset === 0) {
                candidates.push(startX);
                continue;
            }

            candidates.push(startX - offset, startX + offset);
        }

        for (const nx of candidates) {
            if (this.grid.isWalkable(nx, ny)) {
                return this.grid.navCellToWorldPoint({ nx, ny });
            }
        }

        return null;
    }

    private resolveStartCell(start: GridPoint): NavCell | null {
        const cell = this.grid.worldToNavCell(start);
        return this.grid.isWalkable(cell.nx, cell.ny) ? cell : null;
    }

    private calculatePathCost(startCell: NavCell, path: readonly NavCell[]): number {
        if (path.length === 0) {
            return 0;
        }

        let cost = 0;
        let previous = startCell;
        for (const cell of path) {
            cost += previous.nx !== cell.nx && previous.ny !== cell.ny ? 14 : 10;
            previous = cell;
        }

        return cost;
    }

    private toWorldPath(
        start: GridPoint,
        navPath: readonly NavCell[],
        finalPoint: GridPoint,
    ): GridPoint[] | null {
        const points = navPath.map((cell) => this.grid.navCellToWorldPoint(cell));
        const first = points[0] ?? finalPoint;
        if (!this.grid.canTraverseSegment(start, first)) return null;
        if (points.length === 0) {
            return Math.hypot(finalPoint.x - start.x, finalPoint.y - start.y) > 0.001
                ? [{ ...finalPoint }]
                : [];
        }
        const last = points[points.length - 1]!;
        if (!this.grid.canTraverseSegment(last, finalPoint)) return null;
        points[points.length - 1] = { ...finalPoint };
        return points;
    }
}
