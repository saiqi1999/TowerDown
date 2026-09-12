import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { NavigationGrid } from './NavigationGrid';
import { type GridCell } from './NavigationTypes';

export class TargetApproachResolver {
    public getApproachCells(
        target: WorldObjectData,
        grid: NavigationGrid,
    ): GridCell[] {
        const visual = getWorldVisualDefinition(target.visualId);
        const candidates: GridCell[] = [];
        const seen = new Set<string>();

        const pushIfWalkable = (x: number, y: number): void => {
            if (!grid.isWalkable(x, y)) {
                return;
            }

            const key = `${x},${y}`;
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            candidates.push({ x, y });
        };

        const topY = target.gridY - 1;
        const bottomY = target.gridY + visual.h;
        for (let x = target.gridX; x < target.gridX + visual.w; x += 1) {
            pushIfWalkable(x, topY);
            pushIfWalkable(x, bottomY);
        }

        const leftX = target.gridX - 1;
        const rightX = target.gridX + visual.w;
        for (let y = target.gridY; y < target.gridY + visual.h; y += 1) {
            pushIfWalkable(leftX, y);
            pushIfWalkable(rightX, y);
        }

        return candidates;
    }
}
