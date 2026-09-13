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
import {
    GRID_RENDER_SCALE,
} from '../grid/GridConfig';
import { type NavigationGrid } from '../navigation/NavigationGrid';
import { type WorldNavigator } from '../navigation/WorldNavigator';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { SquadBrain, type SquadHomeBounds } from './SquadBrain';
import { InteractionSlotResolver } from './InteractionSlotResolver';
import { SquadEngagementController } from './SquadEngagementController';
import { SquadMotor } from './SquadMotor';
import {
    SQUAD_FORMATION_OFFSETS,
    type SquadRuntimeHandle,
    type SquadSpawnData,
} from './SquadTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { type MonsterRuntimeRegistry } from '../monster/MonsterRuntimeRegistry';
import { WarriorCombatController } from './WarriorCombatController';
import { SquadCombatController } from './SquadCombatController';
import { WarriorMotor } from './WarriorMotor';
import { WarriorAttackReceiver } from './WarriorAttackReceiver';
import {
    SWORD_WARRIOR_ATTACK_DAMAGE,
    SWORD_WARRIOR_MAX_HEALTH,
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

const PHASE_OFFSETS = [0, 2, 1, 3] as const;
const ATTACK_PHASE_OFFSETS = [0, 1, 1, 0] as const;

export class SquadRenderer {
    private readonly frameCache = new Map<string, SpriteFrame>();

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
        private readonly monsterRegistry?: MonsterRuntimeRegistry,
    ) {}

    public clear(): void {
        this.squadRoot.removeAllChildren();
    }

    public render(
        squads: SquadSpawnData[],
        mapWidth: number,
        mapHeight: number,
    ): Map<string, SquadRuntimeHandle> {
        // Renderer 现在除了创建可见节点，还负责把 warrior 动画端和 engagement/combat 端在运行时装配起来。
        this.clear();

        const walkFrameSet = this.getOrCreateWalkFrameSet();
        const attackFrameSet = this.getOrCreateAttackFrameSet();
        const handles = new Map<string, SquadRuntimeHandle>();
         

        for (const squad of squads) {
            const warriorIds: string[] = [];
            const warriorCombatControllers: WarriorCombatController[] = []; 
            if (squad.memberCount !== 4) {
                throw new Error(`[SquadRenderer] ${squad.id} requires exactly 4 members in Phase 2.`);
            }
            
            const homeObject = this.getHomeObject(squad.homeObjectId);
            const homeVisual = getWorldVisualDefinition(homeObject.visualId);
            const homeLeft = homeObject.gridX;
            const homeRight = homeObject.gridX + homeVisual.w;
            const homeBottom = homeObject.gridY + homeVisual.h;
            const spawnPoint = squad.spawnPoint ?? {
                x: (homeLeft + homeRight) / 2,
                y: homeBottom + 1,
            };
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

            const warriors: WarriorAnimator[] = [];
            const warriorMotors: WarriorMotor[] = [];
            const warriorCombatStats: CombatStats[] = [];
            const warriorHealth: HealthComponent[] = [];
            for (let i = 0; i < squad.memberCount; i += 1) {
                const warriorId = `${squad.id}/warrior_${i}`;
                warriorIds.push(warriorId);
                const warriorNode = new Node(`Warrior_${i}`);
                warriorNode.setParent(squadNode);
                warriorNode.layer = squadNode.layer;
                warriorNode.setScale(
                    GRID_RENDER_SCALE,
                    GRID_RENDER_SCALE,
                    1,
                );

                const transform = warriorNode.addComponent(UITransform);
                transform.setContentSize(WARRIOR_FRAME_SIZE, WARRIOR_FRAME_SIZE);

                const sprite = warriorNode.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;

                const animator = warriorNode.addComponent(WarriorAnimator);
                animator.setup(
                    sprite,
                    walkFrameSet,
                    attackFrameSet,
                    PHASE_OFFSETS[i],
                    ATTACK_PHASE_OFFSETS[i],
                );
                warriors.push(animator);

                const stats = warriorNode.addComponent(CombatStats);
                stats.setup({
                    attackDamage: SWORD_WARRIOR_ATTACK_DAMAGE,
                    attackRangeCells: 0.85,
                    preferredCombatDistanceCells: 0.75,
                });
                warriorCombatStats.push(stats);
                const health = warriorNode.addComponent(HealthComponent);
                health.setup(SWORD_WARRIOR_MAX_HEALTH);
                warriorHealth.push(health);
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
                    formationOffset: SQUAD_FORMATION_OFFSETS[i]!,
                });
                warriorMotors.push(warriorMotor);
                const warriorCombat =
                warriorNode.addComponent(WarriorCombatController);

                warriorCombatControllers.push(warriorCombat);
            }

            const motor = squadNode.addComponent(SquadMotor);
            motor.setup({
                spawnPoint,
                mapWidth,
                mapHeight,
                warriors,
            });
            // for (const warriorCombat of warriorCombatControllers) {
            //     warriorCombat.setup({
            //         unitId: warriorCombat.id,
            //         squadMotor: motor,
            //         motor: warriorCombat.getComponent(WarriorMotor)!,
            //         animator: warriorCombat.getComponent(WarriorAnimator)!,
            //         health: warriorCombat.getComponent(HealthComponent)!,
            //         stats: warriorCombat.getComponent(CombatStats)!,
            //         hub: this.combatEventHub,
            //     });
            // }
            for (let i = 0; i < warriorCombatControllers.length; i += 1) {
            warriorCombatControllers[i]!.setup({
                unitId: warriorIds[i]!,
                squadMotor: motor,
                motor: warriorMotors[i]!,
                animator: warriors[i]!,
                health: warriorHealth[i]!,
                stats: warriorCombatStats[i]!,
                hub: this.combatEventHub,
            });
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
                slotResolver: new InteractionSlotResolver(this.navigationGrid),
                // 同一个 combat hub 必须注入 squad 和 world object 两侧，命中事件才能真正闭环。
                combatEventHub: this.combatEventHub,
            });

            const brain = squadNode.addComponent(SquadBrain);
            const homeBounds: SquadHomeBounds = {
                left: homeLeft,
                right: homeRight,
                bottom: homeBottom,
                mapWidth,
                mapHeight,
            };
                brain.setup({
                squadId: squad.id,
                homeObjectId: squad.homeObjectId,
                motor,
                engagement,
                navigator: this.navigator,
                worldObjectRegistry: this.worldObjectRegistry,
                warriors,
                homeRestCell,
                    homeBounds,
                    monsterRegistry: this.monsterRegistry,
                    combat,
                });

            handles.set(squad.id, {
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
            });
        }

        console.log(`[SquadRenderer] rendered ${squads.length} squads.`);
        return handles;
    }

    private getHomeObject(homeObjectId: string): WorldObjectData {
        const homeObject = this.worldObjectRegistry.get(homeObjectId);
        if (!homeObject) {
            throw new Error(`[SquadRenderer] home object not found: ${homeObjectId}`);
        }

        return homeObject;
    }

    private getOrCreateWalkFrameSet(): WarriorFrameSet {
        return {
            [WarriorDirection.Down]: this.getWalkFramesForDirection(WarriorDirection.Down),
            [WarriorDirection.Up]: this.getWalkFramesForDirection(WarriorDirection.Up),
            [WarriorDirection.Left]: this.getWalkFramesForDirection(WarriorDirection.Left),
            [WarriorDirection.Right]: this.getWalkFramesForDirection(WarriorDirection.Right),
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

    // Attack 图的列语义已经改成“方向 Pose”，这里缓存时也按方向命名，避免重新误读。
    private getOrCreateAttackFrameSet(): WarriorAttackFrameSet {
        return {
            [WarriorDirection.Down]: this.getAttackFrame(WarriorDirection.Down),
            [WarriorDirection.Up]: this.getAttackFrame(WarriorDirection.Up),
            [WarriorDirection.Left]: this.getAttackFrame(WarriorDirection.Left),
            [WarriorDirection.Right]: this.getAttackFrame(WarriorDirection.Right),
        };
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
