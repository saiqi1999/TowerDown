import { NavigationGrid } from './NavigationGrid';
import { type NavCell } from './NavigationTypes';

const CARDINAL_COST = 10;
const DIAGONAL_COST = 14;

const NEIGHBOR_OFFSETS = [
    { nx: 0, ny: -1, cost: CARDINAL_COST },
    { nx: 0, ny: 1, cost: CARDINAL_COST },
    { nx: -1, ny: 0, cost: CARDINAL_COST },
    { nx: 1, ny: 0, cost: CARDINAL_COST },
    { nx: -1, ny: -1, cost: DIAGONAL_COST },
    { nx: 1, ny: -1, cost: DIAGONAL_COST },
    { nx: -1, ny: 1, cost: DIAGONAL_COST },
    { nx: 1, ny: 1, cost: DIAGONAL_COST },
] as const;

export class AStarPathfinder {
    public findPath(
        grid: NavigationGrid,
        start: NavCell,
        goal: NavCell,
    ): NavCell[] | null {
        if (!grid.isWalkable(start.nx, start.ny) || !grid.isWalkable(goal.nx, goal.ny)) {
            return null;
        }

        if (start.nx === goal.nx && start.ny === goal.ny) {
            return [];
        }

        const total = grid.width * grid.height;
        const gScore = new Array<number>(total).fill(Number.POSITIVE_INFINITY);
        const fScore = new Array<number>(total).fill(Number.POSITIVE_INFINITY);
        const cameFrom = new Array<number>(total).fill(-1);
        const openSet = new Set<number>();
        const closedSet = new Set<number>();

        const startIndex = this.toIndex(grid, start.nx, start.ny);
        const goalIndex = this.toIndex(grid, goal.nx, goal.ny);
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
                const neighborX = currentCell.nx + neighborOffset.nx;
                const neighborY = currentCell.ny + neighborOffset.ny;

                if (!grid.isWalkable(neighborX, neighborY)) {
                    continue;
                }

                if (
                    neighborOffset.nx !== 0 &&
                    neighborOffset.ny !== 0 &&
                    (!grid.isWalkable(currentCell.nx + neighborOffset.nx, currentCell.ny) ||
                        !grid.isWalkable(currentCell.nx, currentCell.ny + neighborOffset.ny))
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
                    { nx: neighborX, ny: neighborY },
                    goal,
                );
                openSet.add(neighborIndex);
            }
        }

        return null;
    }

    public getPathCost(path: readonly NavCell[]): number {
        if (path.length === 0) {
            return 0;
        }

        let cost = 0;
        let previous = path[0];
        for (let i = 1; i < path.length; i += 1) {
            const current = path[i];
            cost += previous.nx !== current.nx && previous.ny !== current.ny
                ? DIAGONAL_COST
                : CARDINAL_COST;
            previous = current;
        }

        return cost;
    }

    private heuristic(a: NavCell, b: NavCell): number {
        const dx = Math.abs(a.nx - b.nx);
        const dy = Math.abs(a.ny - b.ny);
        return CARDINAL_COST * (dx + dy) + (DIAGONAL_COST - 2 * CARDINAL_COST) * Math.min(dx, dy);
    }

    private reconstructPath(
        grid: NavigationGrid,
        cameFrom: number[],
        current: number,
        startIndex: number,
    ): NavCell[] {
        const path: NavCell[] = [this.fromIndex(grid, current)];
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

    private fromIndex(grid: NavigationGrid, index: number): NavCell {
        return {
            nx: index % grid.width,
            ny: Math.floor(index / grid.width),
        };
    }
}
