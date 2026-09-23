/**
 * Why this file exists:
 * Squad 的世界节点、单位组件和战斗/采集控制器必须由同一个装配点创建，
 * 同时支持过层扩编后追加真实单位。
 *
 * Ownership boundary:
 * 本文件拥有 SquadRuntimeHandle 的创建、运行时追加成员和初始组件依赖注入。
 *
 * This file deliberately does NOT:
 * 不拥有编制真相、建筑结算、队伍选择状态或蓝图解锁规则。
 */
import {
    Material,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { CombatStats } from '../combat/CombatStats';
import { HealthComponent } from '../combat/HealthComponent';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { HealthBarView } from '../feedback/HealthBarView';
import { HitFlashView } from '../feedback/HitFlashView';
import { GRID_RENDER_SCALE } from '../grid/GridConfig';
import { type NavigationGrid } from '../navigation/NavigationGrid';
import { type WorldNavigator } from '../navigation/WorldNavigator';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { SquadBrain } from './SquadBrain';
import { type TerrainMap } from '../map/MapTypes';
import { SQUAD_PRESENTATION } from './SquadPresentationConfig';
import { InteractionSlotResolver } from './InteractionSlotResolver';
import { SquadEngagementController } from './SquadEngagementController';
import { SquadMotor } from './SquadMotor';
import {
    type SquadRuntimeHandle,
    type SquadSpawnData,
} from './SquadTypes';
import { assignFormation, generateFormationOffsets, getFormationBounds } from './SquadFormationLayout';
import { WarriorAnimator } from './WarriorAnimator';
import { type MonsterRuntimeRegistry } from '../monster/MonsterRuntimeRegistry';
import { WarriorCombatController } from './WarriorCombatController';
import { SquadCombatController } from './SquadCombatController';
import { WarriorMotor } from './WarriorMotor';
import { WarriorAttackReceiver } from './WarriorAttackReceiver';
import { type CombatStatModifierRegistry } from '../combat/CombatStatModifierRegistry';
import {
    SWORD_WARRIOR_ATTACK_DAMAGE,
    SWORD_WARRIOR_ATTACK_INTERVAL_SECONDS,
    SWORD_WARRIOR_MAX_HEALTH,
    SWORD_WARRIOR_MOVE_SPEED_CELLS_PER_SECOND,
} from './WarriorCombatConfig';
import {
    createWarriorAttackFrame,
    createWarriorFrame,
    type WarriorAttackFrameSet,
    WarriorDirection,
    type WarriorFrameSet,
    WARRIOR_FRAME_SIZE,
    WARRIOR_WALK_FRAME_COUNT,
} from './WarriorSpriteConfig';

const MAX_SQUAD_MEMBERS = 16;
const PHASE_OFFSETS = [0, 2, 1, 3] as const;
const ATTACK_PHASE_OFFSETS = [0, 1, 1, 0] as const;

interface WarriorParts {
    readonly animator: WarriorAnimator;
    readonly motor: WarriorMotor;
    readonly stats: CombatStats;
    readonly health: HealthComponent;
    readonly combat: WarriorCombatController;
}

export class SquadRenderer {
    private readonly frameCache = new Map<string, SpriteFrame>();
    private walkFrameSet: WarriorFrameSet | null = null;
    private attackFrameSet: WarriorAttackFrameSet | null = null;

    constructor(
        private readonly squadRoot: Node,
        private readonly warriorTexture: Texture2D,
        private readonly warriorAttackTexture: Texture2D,
        private readonly navigationGrid: NavigationGrid,
        private readonly navigator: WorldNavigator,
        private readonly combatEventHub: CombatEventHub,
        private readonly worldObjectRegistry: WorldObjectRuntimeRegistry,
        private readonly friendlyHealthBarTexture: Texture2D,
        private readonly hitFlashMaterial: Material,
        private readonly damagePopupSpawner: DamagePopupSpawner,
        private readonly terrainMap: TerrainMap,
        private readonly monsterRegistry?: MonsterRuntimeRegistry,
        private readonly playerCombatModifiers?: CombatStatModifierRegistry,
    ) {}

    public clear(): void {
        for (const child of [...this.squadRoot.children]) {
            child.removeFromParent();
            child.destroy();
        }
    }

    public render(
        squads: readonly SquadSpawnData[],
        mapWidth: number,
        mapHeight: number,
    ): Map<string, SquadRuntimeHandle> {
        this.clear();
        this.ensureFrameSets();
        const handles = new Map<string, SquadRuntimeHandle>();
        for (const squad of squads) {
            handles.set(squad.id, this.createSquad(squad, mapWidth, mapHeight));
        }
        console.log(`[SquadRenderer] rendered ${squads.length} squads.`);
        return handles;
    }

    public addSquad(
        squad: SquadSpawnData,
        mapWidth: number,
        mapHeight: number,
    ): SquadRuntimeHandle {
        this.ensureFrameSets();
        if (squad.memberCount < 1 || squad.memberCount > MAX_SQUAD_MEMBERS) {
            throw new Error(`[SquadRenderer] invalid member count ${squad.memberCount} for ${squad.id}`);
        }
        return this.createSquad(squad, mapWidth, mapHeight);
    }

    public removeSquad(handle: SquadRuntimeHandle): void {
        if (!handle.node.isValid) {
            return;
        }
        handle.node.removeFromParent();
        handle.node.destroy();
    }

    public addMembers(
        handle: SquadRuntimeHandle,
        targetMemberCount: number,
    ): number {
        const target = Math.min(
            MAX_SQUAD_MEMBERS,
            Math.max(handle.warriorCombatControllers.length, targetMemberCount),
        );
        let added = 0;
        while (handle.warriorCombatControllers.length < target) {
            const index = handle.warriorCombatControllers.length;
            const parts = this.createWarrior(handle.id, index, handle.node, handle.motor);
            parts.combat.setup({
                unitId: `${handle.id}/warrior_${index}`,
                squadMotor: handle.motor,
                motor: parts.motor,
                animator: parts.animator,
                health: parts.health,
                stats: parts.stats,
                hub: this.combatEventHub,
            });
            handle.warriorAnimators.push(parts.animator);
            handle.warriorMotors.push(parts.motor);
            handle.warriorStats.push(parts.stats);
            handle.warriorHealth.push(parts.health);
            handle.warriorCombatControllers.push(parts.combat);
            handle.motor.addWarrior(parts.animator);
            handle.combat.addWarrior(parts.combat);
            handle.engagement.addWarrior(parts.motor, parts.animator, parts.stats, parts.health);
            handle.brain.addWarrior(parts.animator);
            added += 1;
        }
        this.reflowFormation(handle, false);
        return added;
    }

    private createSquad(
        squad: SquadSpawnData,
        mapWidth: number,
        mapHeight: number,
    ): SquadRuntimeHandle {
        const homeObject = this.getHomeObject(squad.homeObjectId);
        const homeVisual = getWorldVisualDefinition(homeObject.visualId);
        const homeLeft = homeObject.gridX;
        const homeRight = homeObject.gridX + homeVisual.w;
        const homeBottom = homeObject.gridY + homeVisual.h;
        const formationBounds = getFormationBounds(generateFormationOffsets(squad.memberCount));
        const preferredSpawn = squad.spawnPoint ?? {
            x: (homeLeft + homeRight) / 2,
            y: homeBottom + 1,
        };
        // A taller base must not cover the front rank of the legacy base-side spawn.
        const spawnPoint = { ...preferredSpawn };
        if (spawnPoint.x >= homeLeft && spawnPoint.x < homeRight) {
            spawnPoint.y = Math.max(spawnPoint.y, homeBottom + 0.5 - formationBounds.minY);
        }
        const homeRestCell = this.navigator.findNearestWalkableCellInRow(
            spawnPoint.x,
            Math.floor(spawnPoint.y),
        );
        if (!homeRestCell) {
            throw new Error(`[SquadRenderer] failed to resolve home rest cell for ${squad.id}`);
        }

        const squadNode = new Node(`Squad_${squad.id}`);
        squadNode.setParent(this.squadRoot);
        squadNode.layer = this.squadRoot.layer;
        squadNode.addComponent(UITransform);
        const motor = squadNode.addComponent(SquadMotor);
        const warriors: WarriorAnimator[] = [];
        const warriorMotors: WarriorMotor[] = [];
        const warriorCombatStats: CombatStats[] = [];
        const warriorHealth: HealthComponent[] = [];
        const warriorCombatControllers: WarriorCombatController[] = [];

        const memberCount = Math.min(
            MAX_SQUAD_MEMBERS,
            Math.max(1, squad.memberCount),
        );
        for (let index = 0; index < memberCount; index += 1) {
            const parts = this.createWarrior(squad.id, index, squadNode, motor);
            warriors.push(parts.animator);
            warriorMotors.push(parts.motor);
            warriorCombatStats.push(parts.stats);
            warriorHealth.push(parts.health);
            warriorCombatControllers.push(parts.combat);
        }

        motor.setup({
            spawnPoint,
            mapWidth,
            mapHeight,
            warriors,
            moveSpeedCellsPerSecond: SWORD_WARRIOR_MOVE_SPEED_CELLS_PER_SECOND,
        });
        for (let index = 0; index < warriorCombatControllers.length; index += 1) {
            warriorCombatControllers[index]!.setup({
                unitId: `${squad.id}/warrior_${index}`,
                squadMotor: motor,
                motor: warriorMotors[index]!,
                animator: warriors[index]!,
                health: warriorHealth[index]!,
                stats: warriorCombatStats[index]!,
                hub: this.combatEventHub,
            });
        }
        const initialHandleMembers = warriorCombatControllers.map((_, index) => `${squad.id}/warrior_${index}`);
        const initialOffsets = assignFormation(initialHandleMembers);
        for (let index = 0; index < warriorMotors.length; index += 1) {
            warriorMotors[index]!.setFormationOffset(initialOffsets.get(initialHandleMembers[index]!)!, { snap: true });
        }

        const combat = squadNode.addComponent(SquadCombatController);
        combat.setup(squad.id, motor, warriorCombatControllers);
        const engagement = squadNode.addComponent(SquadEngagementController);
        engagement.setup({
            squadId: squad.id,
            squadMotor: motor,
            warriorMotors,
            warriorAnimators: warriors,
            warriorCombatStats,
            warriorHealth,
            slotResolver: new InteractionSlotResolver(this.navigationGrid),
            combatEventHub: this.combatEventHub,
        });
        const brain = squadNode.addComponent(SquadBrain);
        brain.setup({
            squadId: squad.id,
            homeObjectId: squad.homeObjectId,
            motor,
            engagement,
            navigator: this.navigator,
            worldObjectRegistry: this.worldObjectRegistry,
            warriors,
            homeRestCell,
            terrainMap: this.terrainMap,
            hasLivingMembers: () => warriorHealth.some((health) => !health.isDepleted()),
            monsterRegistry: this.monsterRegistry,
            combat,
        });

        return {
            id: squad.id,
            node: squadNode,
            motor,
            engagement,
            brain,
            warriorAnimators: warriors,
            warriorMotors,
            warriorStats: warriorCombatStats,
            warriorHealth,
            warriorCombatControllers,
            combat,
        };
    }

    private createWarrior(
        squadId: string,
        index: number,
        parent: Node,
        squadMotor: SquadMotor,
    ): WarriorParts {
        if (!this.walkFrameSet || !this.attackFrameSet) {
            throw new Error('[SquadRenderer] frame sets are not initialized.');
        }
        const warriorId = `${squadId}/warrior_${index}`;
        const warriorNode = new Node(`Warrior_${index}`);
        warriorNode.setParent(parent);
        warriorNode.layer = parent.layer;
        const visualScale = GRID_RENDER_SCALE * SQUAD_PRESENTATION.warriorScaleMultiplier;
        warriorNode.setScale(visualScale, visualScale, 1);
        warriorNode.addComponent(UITransform).setContentSize(WARRIOR_FRAME_SIZE, WARRIOR_FRAME_SIZE);
        const sprite = warriorNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;

        const animator = warriorNode.addComponent(WarriorAnimator);
        animator.setup(
            sprite,
            this.walkFrameSet,
            this.attackFrameSet,
            PHASE_OFFSETS[index % PHASE_OFFSETS.length]!,
            ATTACK_PHASE_OFFSETS[index % ATTACK_PHASE_OFFSETS.length]!,
        );
        const stats = warriorNode.addComponent(CombatStats);
        stats.setup({
            attackDamage: SWORD_WARRIOR_ATTACK_DAMAGE,
            attackRangeCells: 1,
            preferredCombatDistanceCells: 1,
            attackIntervalSeconds: SWORD_WARRIOR_ATTACK_INTERVAL_SECONDS,
            tags: ['infantry', 'melee_infantry'],
            modifierRegistry: this.playerCombatModifiers,
        });
        const health = warriorNode.addComponent(HealthComponent);
        health.setup(SWORD_WARRIOR_MAX_HEALTH);
        const healthBar = warriorNode.addComponent(HealthBarView);
        healthBar.setup({
            health,
            texture: this.friendlyHealthBarTexture,
            localOffsetY: 11,
        });
        const hitFlashView = warriorNode.addComponent(HitFlashView);
        hitFlashView.setup({
            sprite,
            baseMaterial: this.hitFlashMaterial,
        });
        const attackReceiver = warriorNode.addComponent(WarriorAttackReceiver);
        attackReceiver.setup({
            targetId: warriorId,
            combatEventHub: this.combatEventHub,
            health,
            hitFlashView,
            damagePopupSpawner: this.damagePopupSpawner,
        });
        const warriorMotor = warriorNode.addComponent(WarriorMotor);
        warriorMotor.setup({
            animator,
            formationOffset: this.getFormationOffset(index),
            moveSpeedCellsPerSecond: SWORD_WARRIOR_MOVE_SPEED_CELLS_PER_SECOND,
        });
        const combat = warriorNode.addComponent(WarriorCombatController);
        return {
            animator,
            motor: warriorMotor,
            stats,
            health,
            combat,
        };
    }

    private getFormationOffset(index: number): { x: number; y: number } {
        return assignFormation([String(index)]).get(String(index))!;
    }

    private reflowFormation(handle: SquadRuntimeHandle, snap: boolean): void {
        const memberIds = handle.warriorMotors.map((_, index) => `${handle.id}/warrior_${index}`);
        const offsets = assignFormation(memberIds);
        for (let index = 0; index < handle.warriorMotors.length; index += 1) {
            const offset = offsets.get(memberIds[index]!);
            if (offset) handle.warriorMotors[index]!.setFormationOffset(offset, { snap });
        }
    }

    private getHomeObject(homeObjectId: string): WorldObjectData {
        const homeObject = this.worldObjectRegistry.get(homeObjectId);
        if (!homeObject) {
            throw new Error(`[SquadRenderer] home object not found: ${homeObjectId}`);
        }
        return homeObject;
    }

    private ensureFrameSets(): void {
        this.walkFrameSet ??= {
            [WarriorDirection.Down]: this.getWalkFramesForDirection(WarriorDirection.Down),
            [WarriorDirection.Up]: this.getWalkFramesForDirection(WarriorDirection.Up),
            [WarriorDirection.Left]: this.getWalkFramesForDirection(WarriorDirection.Left),
            [WarriorDirection.Right]: this.getWalkFramesForDirection(WarriorDirection.Right),
        };
        this.attackFrameSet ??= {
            [WarriorDirection.Down]: this.getAttackFrame(WarriorDirection.Down),
            [WarriorDirection.Up]: this.getAttackFrame(WarriorDirection.Up),
            [WarriorDirection.Left]: this.getAttackFrame(WarriorDirection.Left),
            [WarriorDirection.Right]: this.getAttackFrame(WarriorDirection.Right),
        };
    }

    private getWalkFramesForDirection(direction: WarriorDirection): SpriteFrame[] {
        const frames: SpriteFrame[] = [];
        for (let frameIndex = 0; frameIndex < WARRIOR_WALK_FRAME_COUNT; frameIndex += 1) {
            const key = `walk_${direction}_${frameIndex}`;
            const cached = this.frameCache.get(key);
            if (cached) {
                frames.push(cached);
                continue;
            }
            const frame = createWarriorFrame(this.warriorTexture, direction, frameIndex);
            this.frameCache.set(key, frame);
            frames.push(frame);
        }
        return frames;
    }

    private getAttackFrame(direction: WarriorDirection): SpriteFrame {
        const key = `attack_dir_${direction}`;
        const cached = this.frameCache.get(key);
        if (cached) {
            return cached;
        }
        const frame = createWarriorAttackFrame(this.warriorAttackTexture, direction);
        this.frameCache.set(key, frame);
        return frame;
    }
}
