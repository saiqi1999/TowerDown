/**
 * Why this file exists:
 * 过层结算需要一份与渲染、节点遍历和 UI 无关的建筑配方目录。
 *
 * Ownership boundary:
 * 本文件拥有伐木屋产出、兵营扩编和铁匠永久成长的静态结算规则。
 *
 * This file deliberately does NOT:
 * 不读取库存、不修改建筑实例、不创建队伍，也不执行结算。
 */
import { ResourceType } from '../world/WorldObjectTypes';
import { BuildingSettlementRole, type ResourceCost } from './BuildingTypes';

export interface BuildingSettlementRecipe {
    readonly role: BuildingSettlementRole;
    readonly sourceOutput?: ResourceCost;
    readonly squadFoodCost?: number;
    readonly squadMemberDelta?: number;
    readonly squadMemberCap?: number;
    readonly statCost?: ResourceCost;
    readonly statKey?: string;
    readonly statDelta?: number;
}

const RECIPES: Readonly<Record<BuildingSettlementRole, BuildingSettlementRecipe>> = {
    [BuildingSettlementRole.None]: {
        role: BuildingSettlementRole.None,
    },
    [BuildingSettlementRole.LumberjackSource]: {
        role: BuildingSettlementRole.LumberjackSource,
        sourceOutput: { [ResourceType.Wood]: 20 },
    },
    [BuildingSettlementRole.SwordBarracks]: {
        role: BuildingSettlementRole.SwordBarracks,
        squadFoodCost: 20,
        squadMemberDelta: 1,
        squadMemberCap: 16,
    },
    [BuildingSettlementRole.MeleeBlacksmith]: {
        role: BuildingSettlementRole.MeleeBlacksmith,
        statCost: {
            [ResourceType.Wood]: 10,
            [ResourceType.Gold]: 5,
        },
        statKey: 'melee_infantry',
        statDelta: 1,
    },
};

export function getBuildingSettlementRecipe(
    role: BuildingSettlementRole | undefined,
): BuildingSettlementRecipe {
    return RECIPES[role ?? BuildingSettlementRole.None];
}
