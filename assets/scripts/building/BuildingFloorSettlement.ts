/**
 * Why this file exists:
 * 离开一层时需要按固定阶段结算所有启用建筑，并保证结果可预览、可提交且可幂等。
 *
 * Ownership boundary:
 * 本文件拥有纯函数式的 Source -> Squad -> Sink 结算算法和逐建筑结果。
 *
 * This file deliberately does NOT:
 * 不直接修改 ResourceInventory、BuildingRuntimeRegistry、Cocos Node 或 HUD。
 */
import {
    BuildingSettlementRole,
    type BuildingInstanceData,
    type ResourceCost,
} from './BuildingTypes';
import { getBuildingSettlementRecipe } from './BuildingSettlementRecipe';
import { getBuildingDefinition } from './BuildingCatalog';
import { type ResourceInventorySnapshot } from '../economy/ResourceInventory';
import { ResourceType } from '../world/WorldObjectTypes';
import { type SquadSpawnData } from '../squad/SquadTypes';

export enum BuildingSettlementStatus {
    Produced = 'produced',
    Expanded = 'expanded',
    Upgraded = 'upgraded',
    Disabled = 'disabled',
    AlreadySettled = 'alreadySettled',
    InsufficientResources = 'insufficientResources',
    FullCapacity = 'fullCapacity',
    NoMatchingSquad = 'noMatchingSquad',
    NoSettlementRule = 'noSettlementRule',
}

export interface BuildingSettlementBuildingResult {
    readonly buildingId: string;
    readonly definitionId: string;
    readonly status: BuildingSettlementStatus;
    readonly resourceDelta?: ResourceCost;
    readonly message: string;
}

export interface BuildingFloorSettlementInput {
    readonly floorInstanceId: string;
    readonly buildings: readonly BuildingInstanceData[];
    readonly squads: readonly SquadSpawnData[];
    readonly inventory: ResourceInventorySnapshot;
    readonly meleeAttackGrowth: number;
    readonly alreadySettled: boolean;
}

export interface BuildingFloorSettlementPlan {
    readonly floorInstanceId: string;
    readonly alreadySettled: boolean;
    readonly nextInventory: ResourceInventorySnapshot;
    readonly nextSquads: readonly SquadSpawnData[];
    readonly nextMeleeAttackGrowth: number;
    readonly buildingResults: readonly BuildingSettlementBuildingResult[];
}

interface MutableInventory {
    wood: number;
    stone: number;
    food: number;
    gold: number;
}

export function calculateBuildingFloorSettlement(
    input: BuildingFloorSettlementInput,
): BuildingFloorSettlementPlan {
    const inventory: MutableInventory = {
        wood: input.inventory.wood,
        stone: input.inventory.stone,
        food: input.inventory.food,
        gold: input.inventory.gold,
    };
    const squads = input.squads.map((squad) => ({ ...squad }));
    const results: BuildingSettlementBuildingResult[] = [];

    if (input.alreadySettled) {
        return {
            floorInstanceId: input.floorInstanceId,
            alreadySettled: true,
            nextInventory: { ...inventory },
            nextSquads: squads,
            nextMeleeAttackGrowth: input.meleeAttackGrowth,
            buildingResults: input.buildings.map((building) => ({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.AlreadySettled,
                message: '该层已经结算过。',
            })),
        };
    }

    const orderedBuildings = [...input.buildings].sort((left, right) =>
        left.createdSequence - right.createdSequence || left.id.localeCompare(right.id));
    const enabledBuildings = orderedBuildings.filter((building) => building.enabled);

    // Source 阶段先全部产出，保证本层产物可以支付本层 Sink。
    for (const building of enabledBuildings) {
        const role = resolveRole(building.definitionId);
        const recipe = getBuildingSettlementRecipe(role);
        if (!recipe.sourceOutput) {
            continue;
        }

        addCost(inventory, recipe.sourceOutput);
        results.push({
            buildingId: building.id,
            definitionId: building.definitionId,
            status: BuildingSettlementStatus.Produced,
            resourceDelta: recipe.sourceOutput,
            message: `本层产出 ${formatCost(recipe.sourceOutput)}。`,
        });
    }

    // Squad 阶段按建筑创建顺序扩编；不足资源或满编只跳过本栋。
    for (const building of enabledBuildings) {
        const role = resolveRole(building.definitionId);
        const recipe = getBuildingSettlementRecipe(role);
        if (role !== BuildingSettlementRole.SwordBarracks) {
            continue;
        }

        const squad = squads.find((candidate) => candidate.id === building.boundSquadId);
        if (!squad) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.NoMatchingSquad,
                message: '没有绑定可扩编的剑士队伍。',
            });
            continue;
        }

        const cap = recipe.squadMemberCap ?? 16;
        const delta = recipe.squadMemberDelta ?? 1;
        const foodCost = recipe.squadFoodCost ?? 20;
        if (squad.memberCount >= cap) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.FullCapacity,
                message: `队伍已满编 ${cap} 人。`,
            });
            continue;
        }
        if (inventory.food < foodCost) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.InsufficientResources,
                message: `食物不足，需要 ${foodCost}。`,
            });
            continue;
        }

        inventory.food -= foodCost;
        squad.memberCount = Math.min(cap, squad.memberCount + delta);
        results.push({
            buildingId: building.id,
            definitionId: building.definitionId,
            status: BuildingSettlementStatus.Expanded,
            resourceDelta: { [ResourceType.Food]: -foodCost },
            message: `队伍扩编 +${delta}，消耗食物 ${foodCost}。`,
        });
    }

    let meleeAttackGrowth = input.meleeAttackGrowth;
    // 属性 Sink 阶段最后执行，多个铁匠按创建顺序各自全额支付。
    for (const building of enabledBuildings) {
        const role = resolveRole(building.definitionId);
        const recipe = getBuildingSettlementRecipe(role);
        if (role !== BuildingSettlementRole.MeleeBlacksmith) {
            continue;
        }

        if (squads.length === 0) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.NoMatchingSquad,
                message: '没有匹配的近战步兵队伍，铁匠铺不结算。',
            });
            continue;
        }

        const cost = recipe.statCost ?? {};
        if (!canAfford(inventory, cost)) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.InsufficientResources,
                message: `资源不足，需要 ${formatCost(cost)}。`,
            });
            continue;
        }

        subtractCost(inventory, cost);
        meleeAttackGrowth += recipe.statDelta ?? 0;
        results.push({
            buildingId: building.id,
            definitionId: building.definitionId,
            status: BuildingSettlementStatus.Upgraded,
            resourceDelta: negateCost(cost),
            message: `近战步兵攻击永久 +${recipe.statDelta ?? 0}，消耗 ${formatCost(cost)}。`,
        });
    }

    for (const building of input.buildings) {
        if (!building.enabled) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.Disabled,
                message: '建筑已停用，本层不参与结算。',
            });
        }
    }

    const resultIds = new Set(results.map((result) => result.buildingId));
    for (const building of input.buildings) {
        if (building.enabled && !resultIds.has(building.id)) {
            results.push({
                buildingId: building.id,
                definitionId: building.definitionId,
                status: BuildingSettlementStatus.NoSettlementRule,
                message: '该建筑暂无过层结算规则。',
            });
        }
    }

    return {
        floorInstanceId: input.floorInstanceId,
        alreadySettled: false,
        nextInventory: { ...inventory },
        nextSquads: squads,
        nextMeleeAttackGrowth: meleeAttackGrowth,
        buildingResults: results,
    };
}

function resolveRole(definitionId: string): BuildingSettlementRole {
    return getBuildingDefinition(definitionId)?.settlementRole
        ?? BuildingSettlementRole.None;
}

function getAmount(inventory: MutableInventory, type: ResourceType): number {
    switch (type) {
    case ResourceType.Wood: return inventory.wood;
    case ResourceType.Stone: return inventory.stone;
    case ResourceType.Food: return inventory.food;
    case ResourceType.Gold: return inventory.gold;
    default: return 0;
    }
}

function setAmount(inventory: MutableInventory, type: ResourceType, amount: number): void {
    switch (type) {
    case ResourceType.Wood: inventory.wood = amount; break;
    case ResourceType.Stone: inventory.stone = amount; break;
    case ResourceType.Food: inventory.food = amount; break;
    case ResourceType.Gold: inventory.gold = amount; break;
    default: break;
    }
}

function addCost(inventory: MutableInventory, cost: ResourceCost): void {
    for (const key of Object.keys(cost)) {
        const type = Number(key) as ResourceType;
        setAmount(inventory, type, getAmount(inventory, type) + (cost[type] ?? 0));
    }
}

function subtractCost(inventory: MutableInventory, cost: ResourceCost): void {
    for (const key of Object.keys(cost)) {
        const type = Number(key) as ResourceType;
        setAmount(inventory, type, getAmount(inventory, type) - (cost[type] ?? 0));
    }
}

function canAfford(inventory: MutableInventory, cost: ResourceCost): boolean {
    return Object.keys(cost).every((key) => {
        const type = Number(key) as ResourceType;
        return getAmount(inventory, type) >= (cost[type] ?? 0);
    });
}

function negateCost(cost: ResourceCost): ResourceCost {
    const result: ResourceCost = {};
    for (const key of Object.keys(cost)) {
        const type = Number(key) as ResourceType;
        result[type] = -(cost[type] ?? 0);
    }
    return result;
}

function formatCost(cost: ResourceCost): string {
    const names: Record<number, string> = {
        [ResourceType.Wood]: '木材',
        [ResourceType.Stone]: '石材',
        [ResourceType.Food]: '食物',
        [ResourceType.Gold]: '黄金',
    };
    return Object.keys(cost)
        .map((key) => `${names[Number(key)] ?? '?'} ${cost[Number(key) as ResourceType] ?? 0}`)
        .join('、');
}
