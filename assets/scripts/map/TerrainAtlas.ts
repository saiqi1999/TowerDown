/**
 * Why this file exists:
 * terrain2 是整张像素图，地图瓦片需要通过统一的 32×32 网格坐标裁出对应 SpriteFrame。
 *
 * Ownership boundary:
 * 本文件拥有 terrain2 图集 UUID、瓦片尺寸和 TileVisual 到图集坐标的映射。
 *
 * This file deliberately does NOT:
 * 不加载资源、不创建地图节点、不解析地形邻接，也不修改全局 GridConfig。
 */
import { TileVisual } from './MapTypes';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';

export interface AtlasCell {
    column: number;
    row: number;
}

export interface AtlasRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const ATLAS_TILE_SIZE = 32;
export const TILE_RENDER_SIZE = GRID_RENDER_SIZE;
export const TERRAIN_SPRITE_FRAME_UUID = '0ca7c1ca-86e7-4aba-9a38-521cfec5c983@f9941';

const ATLAS_CELLS: Record<TileVisual, AtlasCell> = {
    [TileVisual.DirtCenter]: { column: 0, row: 31 },
    [TileVisual.GrassTopLeft]: { column: 2, row: 31 },
    [TileVisual.GrassTop]: { column: 3, row: 31 },
    [TileVisual.GrassTopRight]: { column: 4, row: 31 },
    [TileVisual.GrassLeft]: { column: 2, row: 32 },
    [TileVisual.GrassCenter]: { column: 3, row: 32 },
    [TileVisual.GrassRight]: { column: 4, row: 32 },
    [TileVisual.GrassBottomLeft]: { column: 2, row: 34 },
    [TileVisual.GrassBottom]: { column: 3, row: 34 },
    [TileVisual.GrassBottomRight]: { column: 4, row: 34 },
    [TileVisual.PitNorthWallUpper]: { column: 4, row: 2 },
    [TileVisual.PitNorthWallLower]: { column: 4, row: 3 },
    [TileVisual.PitSouthRim]: { column: 4, row: 0 },
    [TileVisual.PitWestRim]: { column: 8, row: 1 },
    [TileVisual.PitEastRim]: { column: 0, row: 1 },
    [TileVisual.PitNorthWestUpper]: { column: 3, row: 27 },
    [TileVisual.PitNorthWestLower]: { column: 3, row: 28 },
    [TileVisual.PitNorthEastUpper]: { column: 2, row: 27 },
    [TileVisual.PitNorthEastLower]: { column: 2, row: 28 },
    [TileVisual.PitSouthWest]: { column: 3, row: 26 },
    [TileVisual.PitSouthEast]: { column: 2, row: 26 },
};

export function getAtlasCell(visual: TileVisual): AtlasCell {
    return ATLAS_CELLS[visual];
}

export function getAtlasRect(visual: TileVisual): AtlasRect {
    const cell = getAtlasCell(visual);

    return {
        x: cell.column * ATLAS_TILE_SIZE,
        y: cell.row * ATLAS_TILE_SIZE,
        width: ATLAS_TILE_SIZE,
        height: ATLAS_TILE_SIZE,
    };
}
