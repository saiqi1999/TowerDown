import { type WorldObjectData } from '../world/WorldObjectTypes';
import { AStarPathfinder } from './AStarPathfinder';
import { NavigationGrid } from './NavigationGrid';
import { type GridCell, type GridPoint, type NavigationPathResult } from './NavigationTypes';
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
            const path = this.pathfinder.findPath(this.grid, startCell, candidate);
            if (!path) {
                continue;
            }

            const cost = this.calculatePathCost(startCell, path);
            if (cost < bestCost) {
                bestCost = cost;
                bestResult = {
                    approachCell: candidate,
                    path,
                };
            }
        }

        return bestResult;
    }

    public findPathToCell(
        start: GridPoint,
        target: GridCell,
    ): GridCell[] | null {
        const startCell = this.resolveStartCell(start);
        if (!startCell) {
            return null;
        }

        return this.pathfinder.findPath(this.grid, startCell, target);
    }

    public findNearestWalkableCellInRow(
        preferredX: number,
        y: number,
    ): GridCell | null {
        if (y < 0 || y >= this.grid.height) {
            return null;
        }

        const candidates: number[] = [];
        const startX = Math.round(preferredX);
        for (let offset = 0; offset < this.grid.width; offset += 1) {
            if (offset === 0) {
                candidates.push(startX);
                continue;
            }

            candidates.push(startX - offset, startX + offset);
        }

        for (const x of candidates) {
            if (this.grid.isWalkable(x, y)) {
                return { x, y };
            }
        }

        return null;
    }

    private resolveStartCell(start: GridPoint): GridCell | null {
        const baseCell = {
            x: Math.floor(start.x),
            y: Math.floor(start.y),
        };

        if (this.grid.isWalkable(baseCell.x, baseCell.y)) {
            return baseCell;
        }

        for (let radius = 1; radius <= 2; radius += 1) {
            let best: GridCell | null = null;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (let y = baseCell.y - radius; y <= baseCell.y + radius; y += 1) {
                for (let x = baseCell.x - radius; x <= baseCell.x + radius; x += 1) {
                    if (!this.grid.isWalkable(x, y)) {
                        continue;
                    }

                    const dx = x - start.x;
                    const dy = y - start.y;
                    const distance = dx * dx + dy * dy;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        best = { x, y };
                    }
                }
            }

            if (best) {
                return best;
            }
        }

        return null;
    }

    private calculatePathCost(startCell: GridCell, path: readonly GridCell[]): number {
        if (path.length === 0) {
            return 0;
        }

        let cost = 0;
        let previous = startCell;
        for (const cell of path) {
            cost += previous.x !== cell.x && previous.y !== cell.y ? 14 : 10;
            previous = cell;
        }

        return cost;
    }
}
