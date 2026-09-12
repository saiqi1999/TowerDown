import { NavigationGrid } from './NavigationGrid';
import { type GridCell } from './NavigationTypes';

const CARDINAL_COST = 10;
const DIAGONAL_COST = 14;

const NEIGHBOR_OFFSETS = [
    { x: 0, y: -1, cost: CARDINAL_COST },
    { x: 0, y: 1, cost: CARDINAL_COST },
    { x: -1, y: 0, cost: CARDINAL_COST },
    { x: 1, y: 0, cost: CARDINAL_COST },
    { x: -1, y: -1, cost: DIAGONAL_COST },
    { x: 1, y: -1, cost: DIAGONAL_COST },
    { x: -1, y: 1, cost: DIAGONAL_COST },
    { x: 1, y: 1, cost: DIAGONAL_COST },
] as const;

export class AStarPathfinder {
    public findPath(
        grid: NavigationGrid,
        start: GridCell,
        goal: GridCell,
    ): GridCell[] | null {
        if (!grid.isWalkable(start.x, start.y) || !grid.isWalkable(goal.x, goal.y)) {
            return null;
        }

        if (start.x === goal.x && start.y === goal.y) {
            return [];
        }

        const total = grid.width * grid.height;
        const gScore = new Array<number>(total).fill(Number.POSITIVE_INFINITY);
        const fScore = new Array<number>(total).fill(Number.POSITIVE_INFINITY);
        const cameFrom = new Array<number>(total).fill(-1);
        const openSet = new Set<number>();
        const closedSet = new Set<number>();

        const startIndex = this.toIndex(grid, start.x, start.y);
        const goalIndex = this.toIndex(grid, goal.x, goal.y);
        gScore[startIndex] = 0;
        fScore[startIndex] = this.heuristic(start, goal);
        openSet.add(startIndex);

        while (openSet.size > 0) {
            const current = this.findLowestF(openSet, fScore);
            if (current === goalIndex) {
                return this.reconstructPath(grid, cameFrom, current, startIndex);
            }

            openSet.delete(current);
            closedSet.add(current);
            const currentCell = this.fromIndex(grid, current);

            for (const neighborOffset of NEIGHBOR_OFFSETS) {
                const neighborX = currentCell.x + neighborOffset.x;
                const neighborY = currentCell.y + neighborOffset.y;

                if (!grid.isWalkable(neighborX, neighborY)) {
                    continue;
                }

                if (
                    neighborOffset.x !== 0 &&
                    neighborOffset.y !== 0 &&
                    (!grid.isWalkable(currentCell.x + neighborOffset.x, currentCell.y) ||
                        !grid.isWalkable(currentCell.x, currentCell.y + neighborOffset.y))
                ) {
                    continue;
                }

                const neighborIndex = this.toIndex(grid, neighborX, neighborY);
                if (closedSet.has(neighborIndex)) {
                    continue;
                }

                const tentativeG = gScore[current] + neighborOffset.cost;
                if (tentativeG >= gScore[neighborIndex]) {
                    continue;
                }

                cameFrom[neighborIndex] = current;
                gScore[neighborIndex] = tentativeG;
                fScore[neighborIndex] = tentativeG + this.heuristic(
                    { x: neighborX, y: neighborY },
                    goal,
                );
                openSet.add(neighborIndex);
            }
        }

        return null;
    }

    public getPathCost(path: readonly GridCell[]): number {
        if (path.length === 0) {
            return 0;
        }

        let cost = 0;
        let previous = path[0];
        for (let i = 1; i < path.length; i += 1) {
            const current = path[i];
            cost += previous.x !== current.x && previous.y !== current.y
                ? DIAGONAL_COST
                : CARDINAL_COST;
            previous = current;
        }

        return cost;
    }

    private heuristic(a: GridCell, b: GridCell): number {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        return CARDINAL_COST * (dx + dy) + (DIAGONAL_COST - 2 * CARDINAL_COST) * Math.min(dx, dy);
    }

    private reconstructPath(
        grid: NavigationGrid,
        cameFrom: number[],
        current: number,
        startIndex: number,
    ): GridCell[] {
        const path: GridCell[] = [this.fromIndex(grid, current)];
        while (current !== startIndex) {
            current = cameFrom[current];
            if (current === -1) {
                break;
            }
            if (current !== startIndex) {
                path.push(this.fromIndex(grid, current));
            }
        }

        path.reverse();
        return path;
    }

    private findLowestF(openSet: Set<number>, fScore: number[]): number {
        let bestIndex = -1;
        let bestScore = Number.POSITIVE_INFINITY;

        for (const index of openSet) {
            if (fScore[index] < bestScore) {
                bestScore = fScore[index];
                bestIndex = index;
            }
        }

        return bestIndex;
    }

    private toIndex(grid: NavigationGrid, x: number, y: number): number {
        return y * grid.width + x;
    }

    private fromIndex(grid: NavigationGrid, index: number): GridCell {
        return {
            x: index % grid.width,
            y: Math.floor(index / grid.width),
        };
    }
}
