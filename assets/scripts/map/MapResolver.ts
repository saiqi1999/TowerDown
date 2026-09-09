import { TerrainType, TileVisual, type TerrainMap } from './MapTypes';

export class MapResolver {
    public resolve(map: TerrainMap, x: number, y: number): TileVisual {
        const terrain = map[y]?.[x];
        if (terrain !== TerrainType.Dirt) {
            return TileVisual.Grass;
        }

        const top = this.isDirt(map, x, y - 1);
        const right = this.isDirt(map, x + 1, y);
        const bottom = this.isDirt(map, x, y + 1);
        const left = this.isDirt(map, x - 1, y);

        const missingTop = !top;
        const missingRight = !right;
        const missingBottom = !bottom;
        const missingLeft = !left;

        if (missingTop && missingLeft) {
            return TileVisual.DirtTopLeft;
        }
        if (missingTop && missingRight) {
            return TileVisual.DirtTopRight;
        }
        if (missingBottom && missingLeft) {
            return TileVisual.DirtBottomLeft;
        }
        if (missingBottom && missingRight) {
            return TileVisual.DirtBottomRight;
        }
        if (missingTop) {
            return TileVisual.DirtTop;
        }
        if (missingBottom) {
            return TileVisual.DirtBottom;
        }
        if (missingLeft) {
            return TileVisual.DirtLeft;
        }
        if (missingRight) {
            return TileVisual.DirtRight;
        }

        return TileVisual.DirtCenter;
    }

    private isDirt(map: TerrainMap, x: number, y: number): boolean {
        return map[y]?.[x] === TerrainType.Dirt;
    }
}
