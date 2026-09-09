export enum TerrainType {
    Grass = 0,
    Dirt = 1,
}

export enum TileVisual {
    Grass = 'Grass',
    DirtCenter = 'DirtCenter',
    DirtTop = 'DirtTop',
    DirtBottom = 'DirtBottom',
    DirtLeft = 'DirtLeft',
    DirtRight = 'DirtRight',
    DirtTopLeft = 'DirtTopLeft',
    DirtTopRight = 'DirtTopRight',
    DirtBottomLeft = 'DirtBottomLeft',
    DirtBottomRight = 'DirtBottomRight',
}

export type TerrainMap = TerrainType[][];
