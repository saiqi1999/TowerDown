import { type TerrainMap } from '../map/MapTypes';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { NavigationGrid } from './NavigationGrid';

export class NavigationGridBuilder {
    public build(
        map: TerrainMap,
        objects: readonly WorldObjectData[],
    ): NavigationGrid {
        const height = map.length;
        const width = map[0]?.length ?? 0;
        const grid = new NavigationGrid(width, height);

        for (const objectData of objects) {
            const visual = getWorldVisualDefinition(objectData.visualId);
            for (let y = objectData.gridY; y < objectData.gridY + visual.h; y += 1) {
                for (let x = objectData.gridX; x < objectData.gridX + visual.w; x += 1) {
                    grid.setBlocked(x, y);
                }
            }
        }

        console.log(
            `[NavigationGridBuilder] built ${width}x${height} grid, blocked=${grid.countBlocked()}`,
        );

        return grid;
    }
}
