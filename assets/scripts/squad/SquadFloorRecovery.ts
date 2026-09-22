/**
 * Why this file exists:
 * 换层时必须恢复已有 Squad 的完整成员、生命和临时战斗状态，而不能按存活人数重建。
 *
 * Ownership boundary:
 * 本文件协调现有 SquadRuntimeHandle 的原位整备和集合点传送。
 *
 * This file deliberately does NOT:
 * 不创建新成员、不修改永久属性、不发资源、不重建 Squad 节点。
 */
import { type GridCell, type GridPoint } from '../navigation/NavigationTypes';
import { type SquadRuntimeHandle } from './SquadTypes';

export class SquadFloorRecovery {
    public recover(
        handles: ReadonlyMap<string, SquadRuntimeHandle>,
        homeCells: ReadonlyMap<string, GridCell>,
        squadPoints: ReadonlyMap<string, GridPoint>,
    ): void {
        for (const [id, handle] of handles) {
            const point = squadPoints.get(id);
            const homeCell = homeCells.get(id);
            if (!point || !homeCell) throw new Error(`[SquadFloorRecovery] missing recovery point for ${id}`);
            if (handle.warriorHealth.length !== handle.warriorCombatControllers.length) {
                throw new Error(`[SquadFloorRecovery] incomplete member arrays for ${id}`);
            }
            handle.brain.resetForFloor(homeCell);
            handle.motor.teleportForFloor(point);
        }
    }
}
