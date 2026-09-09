import { TerrainType, type TerrainMap } from './MapTypes';

const G = TerrainType.Grass;
const D = TerrainType.Dirt;

export const STATIC_MAP: TerrainMap = [
    [G, G, G, G, G, G, G, G, G, G, G, G],
    [G, G, G, G, G, G, G, G, G, G, G, G],
    [G, G, D, D, D, D, D, D, G, G, G, G],
    [G, G, D, D, D, D, D, D, G, G, G, G],
    [G, G, D, D, D, D, D, D, G, G, G, G],
    [G, G, G, D, D, D, D, G, G, G, G, G],
    [G, G, G, G, G, G, G, G, G, D, D, G],
    [G, G, G, G, G, G, G, G, G, D, D, G],
];
