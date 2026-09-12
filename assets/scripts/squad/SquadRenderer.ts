import {
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import {
    GRID_RENDER_SCALE,
} from '../grid/GridConfig';
import { type NavigationGrid } from '../navigation/NavigationGrid';
import { type WorldNavigator } from '../navigation/WorldNavigator';
import { STATIC_WORLD_OBJECTS } from '../world/StaticWorldObjects';
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
import { WarriorMotor } from './WarriorMotor';
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
    ) {}

    public clear(): void {
        this.squadRoot.removeAllChildren();
    }

    public render(
        squads: SquadSpawnData[],
        mapWidth: number,
        mapHeight: number,
    ): Map<string, SquadRuntimeHandle> {
        this.clear();

        const walkFrameSet = this.getOrCreateWalkFrameSet();
        const attackFrameSet = this.getOrCreateAttackFrameSet();
        const worldObjectById = new Map<string, WorldObjectData>(
            STATIC_WORLD_OBJECTS.map((objectData) => [objectData.id, objectData]),
        );
        const handles = new Map<string, SquadRuntimeHandle>();

        for (const squad of squads) {
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
            for (let i = 0; i < squad.memberCount; i += 1) {
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

                const warriorMotor = warriorNode.addComponent(WarriorMotor);
                warriorMotor.setup({
                    animator,
                    formationOffset: SQUAD_FORMATION_OFFSETS[i]!,
                });
                warriorMotors.push(warriorMotor);
            }

            const motor = squadNode.addComponent(SquadMotor);
            motor.setup({
                spawnPoint,
                mapWidth,
                mapHeight,
                warriors,
            });

            const engagement = squadNode.addComponent(SquadEngagementController);
            engagement.setup({
                squadId: squad.id,
                squadMotor: motor,
                warriorMotors,
                warriorAnimators: warriors,
                slotResolver: new InteractionSlotResolver(this.navigationGrid),
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
                worldObjectById,
                warriors,
                homeRestCell,
                homeBounds,
            });

            handles.set(squad.id, {
                id: squad.id,
                node: squadNode,
                motor,
                engagement,
                brain,
            });
        }

        console.log(`[SquadRenderer] rendered ${squads.length} squads.`);
        return handles;
    }

    private getHomeObject(homeObjectId: string): WorldObjectData {
        const homeObject = STATIC_WORLD_OBJECTS.find((objectData) => objectData.id === homeObjectId);
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
