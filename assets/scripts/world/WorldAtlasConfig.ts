import { GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { WorldVisualId } from './WorldObjectTypes';

export enum WorldAtlasKey {
    Buildings = 0,
    Nature = 1,
}

export interface WorldVisualDefinition {
    atlas: WorldAtlasKey;
    col: number;
    row: number;
    w: number;
    h: number;
}

export interface WorldVisualRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export const BUILDING_ATLAS_TEXTURE_UUID = 'd430ea1f-06ce-4077-9394-3656eda6e2a6@6c48a';
export const NATURE_ATLAS_TEXTURE_UUID = '668178c6-b592-4a44-a872-385baafff94c@6c48a';

export const WORLD_VISUALS: Record<WorldVisualId, WorldVisualDefinition> = {
    [WorldVisualId.BaseOrange]: {
        atlas: WorldAtlasKey.Buildings,
        col: 0,
        row: 0,
        w: 4,
        h: 3,
    },
    [WorldVisualId.TreeGreen]: {
        atlas: WorldAtlasKey.Nature,
        col: 0,
        row: 0,
        w: 2,
        h: 2,
    },
    [WorldVisualId.StoneGray]: {
        atlas: WorldAtlasKey.Nature,
        col: 16,
        row: 8,
        w: 2,
        h: 2,
    },
    [WorldVisualId.FoodPlantRed]: {
        atlas: WorldAtlasKey.Nature,
        col: 3,
        row: 11,
        w: 1,
        h: 1,
    },
    [WorldVisualId.GoldOreSmall]: {
        atlas: WorldAtlasKey.Nature,
        col: 4,
        row: 14,
        w: 1,
        h: 1,
    },
};

export function getWorldVisualDefinition(visualId: WorldVisualId): WorldVisualDefinition {
    const definition = WORLD_VISUALS[visualId];
    if (!definition) {
        throw new Error(`[WorldAtlasConfig] missing visual definition for ${visualId}`);
    }

    return definition;
}

export function getWorldVisualRect(visualId: WorldVisualId): WorldVisualRect {
    const definition = getWorldVisualDefinition(visualId);

    return {
        x: definition.col * GRID_SOURCE_SIZE,
        y: definition.row * GRID_SOURCE_SIZE,
        width: definition.w * GRID_SOURCE_SIZE,
        height: definition.h * GRID_SOURCE_SIZE,
    };
}
