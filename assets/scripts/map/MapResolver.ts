/**
 * Why this file exists:
 * 每个地形格需要根据自身类型和四邻接地形选择正确的视觉瓦片。
 *
 * Ownership boundary:
 * 本文件拥有 TerrainMap 到 TileVisual 的纯解析规则，并处理地图外边界。
 *
 * This file deliberately does NOT:
 * 不加载图集、不创建 Sprite、不修改 TerrainMap，也不做对角线拼接。
 */
import { TerrainType, TileVisual, type TerrainMap } from './MapTypes';

export class MapResolver {
    public resolve(map: TerrainMap, x: number, y: number): TileVisual {
        const terrain = map[y]?.[x];
        if (terrain !== TerrainType.Grass) {
            return TileVisual.DirtCenter;
        }

        const missingTop = !this.isGrass(map, x, y - 1);
        const missingRight = !this.isGrass(map, x + 1, y);
        const missingBottom = !this.isGrass(map, x, y + 1);
        const missingLeft = !this.isGrass(map, x - 1, y);

        if (missingTop && missingLeft) {
            return TileVisual.GrassTopLeft;
        }
        if (missingTop && missingRight) {
            return TileVisual.GrassTopRight;
        }
        if (missingBottom && missingLeft) {
            return TileVisual.GrassBottomLeft;
        }
        if (missingBottom && missingRight) {
            return TileVisual.GrassBottomRight;
        }
        if (missingTop) {
            return TileVisual.GrassTop;
        }
        if (missingBottom) {
            return TileVisual.GrassBottom;
        }
        if (missingLeft) {
            return TileVisual.GrassLeft;
        }
        if (missingRight) {
            return TileVisual.GrassRight;
        }

        return TileVisual.GrassCenter;
    }

    private isGrass(map: TerrainMap, x: number, y: number): boolean {
        return map[y]?.[x] === TerrainType.Grass;
    }
}
