/**
 * Why this file exists:
 * 建筑、世界对象和城市边界需要把各自规则统一转换为可原子提交的占用记录。
 *
 * Ownership boundary:
 * 本文件拥有建造格 footprint 到 16px 导航障碍 mask 的纯转换规则。
 *
 * This file deliberately does NOT:
 * 不保存运行时占用、不修改导航状态，也不创建或渲染 Cocos 节点。
 */
import {
    type BuildingDefinition,
    type BuildingInstanceData,
    getBuildingFootprint,
} from '../building/BuildingTypes';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import {
    WorldCellFlag,
    type WorldOccupant,
} from '../world/WorldCellGrid';
import { type WorldObjectData, WorldObjectKind } from '../world/WorldObjectTypes';
import { type GridCell, type NavCell } from './NavigationTypes';

export interface BoundaryOccupantInput {
    ownerId: string;
    placementCells: readonly GridCell[];
    passable: boolean;
}

export class NavigationObstacleResolver {
    public forBuilding(
        instance: BuildingInstanceData,
        definition: BuildingDefinition,
    ): WorldOccupant {
        const placementCells = getBuildingFootprint(
            definition,
            instance.gridX,
            instance.gridY,
        );
        const navBlockedCells = !definition.blocksNavigation
            ? []
            : definition.navigationShape === 'centralCore'
                ? buildCentralCoreMask(
                    instance.gridX,
                    instance.gridY,
                    definition.footprintW,
                    definition.footprintH,
                )
                : buildRectNavMask(
                    instance.gridX,
                    instance.gridY,
                    definition.footprintW,
                    definition.footprintH,
                );
        return {
            ownerId: instance.id,
            flag: WorldCellFlag.Building,
            placementCells,
            navBlockedCells,
        };
    }

    public forWorldObject(data: WorldObjectData): WorldOccupant {
        const visual = getWorldVisualDefinition(data.visualId);
        return {
            ownerId: data.id,
            flag: data.kind === WorldObjectKind.Base
                ? WorldCellFlag.Base
                : WorldCellFlag.Resource,
            placementCells: buildRectCells(
                data.gridX,
                data.gridY,
                visual.w,
                visual.h,
            ),
            navBlockedCells: buildRectNavMask(
                data.gridX,
                data.gridY,
                visual.w,
                visual.h,
            ),
        };
    }

    public forBoundary(input: BoundaryOccupantInput): WorldOccupant {
        const navBlockedCells = input.passable
            ? []
            : input.placementCells.flatMap((cell) =>
                buildRectNavMask(cell.x, cell.y, 1, 1));
        return {
            ownerId: input.ownerId,
            flag: WorldCellFlag.Reserved,
            placementCells: input.placementCells.map((cell) => ({ ...cell })),
            navBlockedCells,
        };
    }
}

export function buildRectCells(
    x: number,
    y: number,
    width: number,
    height: number,
): GridCell[] {
    const cells: GridCell[] = [];
    for (let cy = y; cy < y + height; cy += 1) {
        for (let cx = x; cx < x + width; cx += 1) {
            cells.push({ x: cx, y: cy });
        }
    }
    return cells;
}

export function buildRectNavMask(
    x: number,
    y: number,
    width: number,
    height: number,
): NavCell[] {
    const cells: NavCell[] = [];
    for (let ny = y * 2; ny < (y + height) * 2; ny += 1) {
        for (let nx = x * 2; nx < (x + width) * 2; nx += 1) {
            cells.push({ nx, ny });
        }
    }
    return cells;
}

export function buildCentralCoreMask(
    x: number,
    y: number,
    width: number,
    height: number,
): NavCell[] {
    if (width < 2 || height < 2) {
        return buildRectNavMask(x, y, width, height);
    }
    const cells: NavCell[] = [];
    for (let ny = y * 2 + 1; ny < (y + height) * 2 - 1; ny += 1) {
        for (let nx = x * 2 + 1; nx < (x + width) * 2 - 1; nx += 1) {
            cells.push({ nx, ny });
        }
    }
    return cells;
}
