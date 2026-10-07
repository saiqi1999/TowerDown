import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { NavigationGrid } from './NavigationGrid';
import { type NavCell } from './NavigationTypes';

export class TargetApproachResolver {
    public getApproachCells(
        target: WorldObjectData,
        grid: NavigationGrid,
    ): NavCell[] {
        const visual = getWorldVisualDefinition(target.visualId);
        const candidates: NavCell[] = [];
        const seen = new Set<string>();

        const pushIfWalkable = (nx: number, ny: number): void => {
            if (!grid.isWalkable(nx, ny)) {
                return;
            }

            const key = `${nx},${ny}`;
            if (seen.has(key)) {
                return;
            }

            seen.add(key);
            candidates.push({ nx, ny });
        };

        const left = target.gridX * 2;
        const right = (target.gridX + visual.w) * 2 - 1;
        const top = target.gridY * 2;
        const bottom = (target.gridY + visual.h) * 2 - 1;
        for (let nx = left; nx <= right; nx += 1) {
            pushIfWalkable(nx, top - 1);
            pushIfWalkable(nx, bottom + 1);
        }

        for (let ny = top; ny <= bottom; ny += 1) {
            pushIfWalkable(left - 1, ny);
            pushIfWalkable(right + 1, ny);
        }

        return candidates;
    }
}
