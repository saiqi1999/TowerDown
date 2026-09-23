/**
 * Why this file exists:
 * 地图渲染、寻路和建筑放置需要共享稳定的地形语义与瓦片视觉类型。
 *
 * Ownership boundary:
 * 本文件只定义 TerrainType、TileVisual 和 TerrainMap 数据契约。
 *
 * This file deliberately does NOT:
 * 不解析邻接关系、不加载图集、不创建地图节点，也不判断建筑是否合法。
 */
export enum TerrainType {
    Grass = 0,
    Dirt = 1,
}

export enum TileVisual {
    DirtCenter = 'DirtCenter',
    GrassCenter = 'GrassCenter',
    GrassTop = 'GrassTop',
    GrassBottom = 'GrassBottom',
    GrassLeft = 'GrassLeft',
    GrassRight = 'GrassRight',
    GrassTopLeft = 'GrassTopLeft',
    GrassTopRight = 'GrassTopRight',
    GrassBottomLeft = 'GrassBottomLeft',
    GrassBottomRight = 'GrassBottomRight',
    PitNorthWallUpper = 'PitNorthWallUpper',
    PitNorthWallLower = 'PitNorthWallLower',
    PitSouthRim = 'PitSouthRim',
    PitWestRim = 'PitWestRim',
    PitEastRim = 'PitEastRim',
    PitNorthWestUpper = 'PitNorthWestUpper',
    PitNorthWestLower = 'PitNorthWestLower',
    PitNorthEastUpper = 'PitNorthEastUpper',
    PitNorthEastLower = 'PitNorthEastLower',
    PitSouthWest = 'PitSouthWest',
    PitSouthEast = 'PitSouthEast',
}

export type TerrainMap = TerrainType[][];
