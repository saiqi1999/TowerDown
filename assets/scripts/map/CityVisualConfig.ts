/**
 * Why this file exists:
 * 城市空槽、木墙和门边素材需要稳定的语义名称与 SpriteFrame UUID 映射。
 *
 * Ownership boundary:
 * 本文件拥有八张城市独立图片的资源标识和边框格到视觉变体的映射。
 *
 * This file deliberately does NOT:
 * 不加载资源、不创建 Sprite，也不决定墙门的导航占用。
 */
import { CITY_LAYOUT, type CityBoundaryCell } from './CityLayout';

export type CityVisualKey =
    | 'emptySlot'
    | 'horizontalWall'
    | 'verticalWall'
    | 'northCorner'
    | 'southCorner'
    | 'verticalGateTop'
    | 'verticalGateBottom'
    | 'horizontalGateEdge';

export const CITY_SPRITE_FRAME_UUIDS: Record<CityVisualKey, string> = {
    emptySlot: 'c6dbcda9-95cc-47c6-9186-9ee0b0c38369@f9941',
    horizontalWall: '6b12cb8a-61dc-47cc-b7e5-fe3fa662e31a@f9941',
    northCorner: 'f296672d-0a2b-44c4-b516-976e3b20ce38@f9941',
    verticalWall: '968bdc66-9e3a-449a-9bcc-1edd1c8ad3ba@f9941',
    southCorner: '243e3b12-a088-4cae-b457-656068ebf2b2@f9941',
    verticalGateTop: '48ca0e37-5ea5-4b17-85f3-2c284dc0649e@f9941',
    verticalGateBottom: 'b9f0fc4d-5758-4958-ab00-617b6bd736b1@f9941',
    horizontalGateEdge: 'd2e6918d-bb36-4e2c-81ce-68d7906889b4@f9941',
};

export interface CityBoundaryVisual {
    key: CityVisualKey;
    flipX: boolean;
}

export function getBoundaryVisual(cell: CityBoundaryCell): CityBoundaryVisual {
    if (cell.kind === 'gate') {
        if (cell.side === 'north' || cell.side === 'south') {
            return {
                key: 'horizontalGateEdge',
                flipX: cell.gatePart === 'second',
            };
        }
        return {
            key: cell.gatePart === 'first' ? 'verticalGateTop' : 'verticalGateBottom',
            flipX: cell.side === 'east',
        };
    }

    const isLeft = cell.x === CITY_LAYOUT.x;
    const isRight = cell.x === CITY_LAYOUT.x + CITY_LAYOUT.width - 1;
    const isTop = cell.y === CITY_LAYOUT.y;
    const isBottom = cell.y === CITY_LAYOUT.y + CITY_LAYOUT.height - 1;
    if (isTop && (isLeft || isRight)) {
        return { key: 'northCorner', flipX: isRight };
    }
    if (isBottom && (isLeft || isRight)) {
        return { key: 'southCorner', flipX: isRight };
    }
    if (cell.side === 'west' || cell.side === 'east') {
        return { key: 'verticalWall', flipX: cell.side === 'east' };
    }
    return { key: 'horizontalWall', flipX: false };
}
