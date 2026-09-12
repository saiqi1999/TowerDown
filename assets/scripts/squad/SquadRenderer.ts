import {
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { STATIC_WORLD_OBJECTS } from '../world/StaticWorldObjects';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { SquadIdleAI } from './SquadIdleAI';
import { type SquadSpawnData } from './SquadTypes';
import { WarriorAnimator } from './WarriorAnimator';
import {
    createWarriorFrame,
    WarriorDirection,
    type WarriorFrameSet,
    WARRIOR_FRAME_SIZE,
    WARRIOR_WALK_FRAME_COUNT,
} from './WarriorSpriteConfig';

const FORMATION_OFFSETS = [
    { x: -0.38, y: -0.2 },
    { x: 0.38, y: -0.2 },
    { x: -0.38, y: 0.45 },
    { x: 0.38, y: 0.45 },
] as const;

const PHASE_OFFSETS = [0, 2, 1, 3] as const;

export class SquadRenderer {
    private readonly frameCache = new Map<string, SpriteFrame>();

    constructor(
        private readonly squadRoot: Node,
        private readonly warriorTexture: Texture2D,
    ) {}

    public clear(): void {
        this.squadRoot.removeAllChildren();
    }

    public render(
        squads: SquadSpawnData[],
        mapWidth: number,
        mapHeight: number,
    ): void {
        this.clear();
        const frameSet = this.getOrCreateFrameSet();

        for (const squad of squads) {
            if (squad.memberCount !== 4) {
                throw new Error(`[SquadRenderer] ${squad.id} requires exactly 4 members in Phase 1.`);
            }

            const homeObject = this.getHomeObject(squad.homeObjectId);
            const homeVisual = getWorldVisualDefinition(homeObject.visualId);
            const homeLeft = homeObject.gridX;
            const homeRight = homeObject.gridX + homeVisual.w;
            const homeBottom = homeObject.gridY + homeVisual.h;
            const spawnPoint = {
                x: (homeLeft + homeRight) / 2,
                y: homeBottom + 1,
            };

            const squadNode = new Node(`Squad_${squad.id}`);
            squadNode.setParent(this.squadRoot);
            squadNode.layer = this.squadRoot.layer;
            squadNode.addComponent(UITransform);

            const warriors: WarriorAnimator[] = [];
            for (let i = 0; i < squad.memberCount; i += 1) {
                const warriorNode = new Node(`Warrior_${i}`);
                warriorNode.setParent(squadNode);
                warriorNode.layer = squadNode.layer;
                warriorNode.setScale(2, 2, 1);
                warriorNode.setPosition(
                    FORMATION_OFFSETS[i].x * GRID_RENDER_SIZE,
                    -FORMATION_OFFSETS[i].y * GRID_RENDER_SIZE,
                    0,
                );

                const transform = warriorNode.addComponent(UITransform);
                transform.setContentSize(WARRIOR_FRAME_SIZE, WARRIOR_FRAME_SIZE);

                const sprite = warriorNode.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;

                const animator = warriorNode.addComponent(WarriorAnimator);
                animator.setup(sprite, frameSet, PHASE_OFFSETS[i]);
                warriors.push(animator);
            }

            const idleAI = squadNode.addComponent(SquadIdleAI);
            idleAI.setup({
                squadId: squad.id,
                homeObjectId: squad.homeObjectId,
                spawnPoint,
                mapWidth,
                mapHeight,
                homeLeft,
                homeRight,
                homeBottom,
                warriors,
            });
        }

        console.log(`[SquadRenderer] rendered ${squads.length} squads.`);
    }

    private getHomeObject(homeObjectId: string): WorldObjectData {
        const homeObject = STATIC_WORLD_OBJECTS.find((objectData) => objectData.id === homeObjectId);
        if (!homeObject) {
            throw new Error(`[SquadRenderer] home object not found: ${homeObjectId}`);
        }

        return homeObject;
    }

    private getOrCreateFrameSet(): WarriorFrameSet {
        return {
            [WarriorDirection.Down]: this.getFramesForDirection(WarriorDirection.Down),
            [WarriorDirection.Up]: this.getFramesForDirection(WarriorDirection.Up),
            [WarriorDirection.Left]: this.getFramesForDirection(WarriorDirection.Left),
            [WarriorDirection.Right]: this.getFramesForDirection(WarriorDirection.Right),
        };
    }

    private getFramesForDirection(direction: WarriorDirection): SpriteFrame[] {
        const frames: SpriteFrame[] = [];
        for (let frameIndex = 0; frameIndex < WARRIOR_WALK_FRAME_COUNT; frameIndex += 1) {
            const key = `${direction}_${frameIndex}`;
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
}
