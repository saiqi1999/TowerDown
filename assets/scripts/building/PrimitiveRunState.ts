/**
 * Why this file exists:
 * 本局的免费首营权益、动态剑士编制、过层结算记录和永久近战成长必须共享一个权威状态。
 *
 * Ownership boundary:
 * 本文件拥有本局建筑/队伍结算状态，并把已提交的攻击成长发布到 Modifier Registry。
 *
 * This file deliberately does NOT:
 * 不创建 Cocos Node、不渲染队伍、不显示面板，也不直接决定地图路径。
 */
import {
    CombatStatId,
    CombatStatModifierRegistry,
    StatModifierOperation,
} from '../combat/CombatStatModifierRegistry';
import {
    type ResourceInventory,
    type ResourceInventorySnapshot,
} from '../economy/ResourceInventory';
import {
    calculateBuildingFloorSettlement,
    type BuildingFloorSettlementPlan,
} from './BuildingFloorSettlement';
import {
    type BuildingDefinition,
    type BuildingInstanceData,
    type ResourceCost,
} from './BuildingTypes';
import {
    SquadCommandColor,
    WarriorVisualId,
    type SquadSpawnData,
} from '../squad/SquadTypes';

const BARRACKS_DEFINITION_ID = 'barracks_01';
const MELEE_GROWTH_SOURCE_ID = 'run:melee_infantry:attack-growth';

export class PrimitiveRunState {
    private freeBarracksPlacementAvailable = true;
    private nextSquadSequence = 1;
    private readonly squads: SquadSpawnData[] = [];
    private readonly barracksPlacements = new Map<string, {
        squadId: string;
        usedFreePlacement: boolean;
    }>();
    private readonly settledFloorIds = new Set<string>();
    private readonly settlementResults = new Map<string, BuildingFloorSettlementPlan>();
    private meleeAttackGrowth = 0;

    constructor(private readonly modifierRegistry: CombatStatModifierRegistry) {
        this.publishMeleeAttackGrowth();
    }

    public getEffectiveCost(definition: BuildingDefinition): ResourceCost {
        if (definition.id === BARRACKS_DEFINITION_ID && this.freeBarracksPlacementAvailable) {
            return {};
        }
        return { ...definition.cost };
    }

    public canPlaceDefinition(definition: BuildingDefinition): { allowed: boolean; reason?: string } {
        if (definition.id === BARRACKS_DEFINITION_ID && this.squads.length >= 2) {
            return {
                allowed: false,
                reason: '原型阶段最多支持两个剑士队伍。',
            };
        }
        return { allowed: true };
    }

    public registerBarracksPlacement(instance: BuildingInstanceData): SquadSpawnData | null {
        if (instance.definitionId !== BARRACKS_DEFINITION_ID) {
            return null;
        }
        if (this.squads.length >= 2) {
            throw new Error('[PrimitiveRunState] no squad slot remains for barracks.');
        }

        const usedFreePlacement = this.freeBarracksPlacementAvailable;
        const squad: SquadSpawnData = {
            id: `squad_${this.nextSquadSequence < 10 ? `0${this.nextSquadSequence}` : this.nextSquadSequence}`,
            warriorVisualId: WarriorVisualId.SwordWarrior,
            memberCount: 4,
            maxMemberCount: 16,
            homeObjectId: 'base_main',
            commandSlot: this.nextSquadSequence,
            commandColor: this.nextSquadSequence === 1
                ? SquadCommandColor.Cyan
                : SquadCommandColor.Amber,
            spawnPoint: this.nextSquadSequence === 1
                ? { x: 19, y: 14 }
                : { x: 21, y: 14 },
            boundBarracksId: instance.id,
        };
        this.nextSquadSequence += 1;
        this.squads.push(squad);
        this.barracksPlacements.set(instance.id, {
            squadId: squad.id,
            usedFreePlacement,
        });
        instance.boundSquadId = squad.id;
        this.freeBarracksPlacementAvailable = false;
        return squad;
    }

    public rollbackBarracksPlacement(instance: BuildingInstanceData): void {
        const placement = this.barracksPlacements.get(instance.id);
        if (!placement) {
            return;
        }

        this.barracksPlacements.delete(instance.id);
        const squadIndex = this.squads.findIndex((squad) => squad.id === placement.squadId);
        if (squadIndex >= 0) {
            this.squads.splice(squadIndex, 1);
        }
        if (placement.usedFreePlacement) {
            this.freeBarracksPlacementAvailable = true;
        }
        instance.boundSquadId = null;
    }

    public getSquads(): readonly SquadSpawnData[] {
        return this.squads;
    }

    public getMeleeAttackGrowth(): number {
        return this.meleeAttackGrowth;
    }

    public prepareSettlement(
        floorInstanceId: string,
        buildings: readonly BuildingInstanceData[],
        inventory: ResourceInventory | ResourceInventorySnapshot,
    ): BuildingFloorSettlementPlan {
        const snapshot = isInventorySnapshot(inventory)
            ? inventory
            : inventory.getSnapshot();
        return calculateBuildingFloorSettlement({
            floorInstanceId,
            buildings,
            squads: this.squads,
            inventory: snapshot,
            meleeAttackGrowth: this.meleeAttackGrowth,
            alreadySettled: this.settledFloorIds.has(floorInstanceId),
        });
    }

    public commitSettlement(
        plan: BuildingFloorSettlementPlan,
        inventory: ResourceInventory,
    ): boolean {
        if (this.settledFloorIds.has(plan.floorInstanceId)) {
            return false;
        }
        inventory.replaceSnapshot(plan.nextInventory);
        for (const nextSquad of plan.nextSquads) {
            const current = this.squads.find((squad) => squad.id === nextSquad.id);
            if (current) {
                current.memberCount = nextSquad.memberCount;
            }
        }
        this.meleeAttackGrowth = plan.nextMeleeAttackGrowth;
        this.settledFloorIds.add(plan.floorInstanceId);
        this.settlementResults.set(plan.floorInstanceId, plan);
        this.publishMeleeAttackGrowth();
        return true;
    }

    public hasSettledFloor(floorInstanceId: string): boolean {
        return this.settledFloorIds.has(floorInstanceId);
    }

    public getSettlementResult(floorInstanceId: string): BuildingFloorSettlementPlan | null {
        return this.settlementResults.get(floorInstanceId) ?? null;
    }

    private publishMeleeAttackGrowth(): void {
        this.modifierRegistry.set({
            sourceId: MELEE_GROWTH_SOURCE_ID,
            stat: CombatStatId.AttackDamage,
            operation: StatModifierOperation.AddFlat,
            value: this.meleeAttackGrowth,
            targetTags: ['melee_infantry'],
        });
    }
}

function isInventorySnapshot(
    value: ResourceInventory | ResourceInventorySnapshot,
): value is ResourceInventorySnapshot {
    return 'wood' in value && 'stone' in value && 'food' in value && 'gold' in value;
}
