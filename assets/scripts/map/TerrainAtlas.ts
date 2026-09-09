import { TileVisual } from './MapTypes';

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

export const ATLAS_TILE_SIZE = 16;
export const TILE_RENDER_SIZE = 32;
export const TERRAIN_SPRITE_FRAME_UUID = 'd7fe297d-ca47-49aa-93d4-0c947fdf5ebc@f9941';
export const TERRAIN_SPRITE_FRAME_FALLBACK_UUID = '165f2715-1733-4ccf-94bc-6cc30740bac2@f9941';

const ATLAS_CELLS: Record<TileVisual, AtlasCell> = {
    [TileVisual.Grass]: { column: 3, row: 11 },
    [TileVisual.DirtTopLeft]: { column: 0, row: 7 },
    [TileVisual.DirtTop]: { column: 1, row: 7 },
    [TileVisual.DirtTopRight]: { column: 2, row: 7 },
    [TileVisual.DirtLeft]: { column: 0, row: 8 },
    [TileVisual.DirtCenter]: { column: 1, row: 8 },
    [TileVisual.DirtRight]: { column: 2, row: 8 },
    [TileVisual.DirtBottomLeft]: { column: 0, row: 9 },
    [TileVisual.DirtBottom]: { column: 1, row: 9 },
    [TileVisual.DirtBottomRight]: { column: 2, row: 9 },
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
