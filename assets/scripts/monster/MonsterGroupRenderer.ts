import { Material, Node, Sprite, Texture2D, UITransform } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { HealthComponent } from '../combat/HealthComponent';
import { CombatStats } from '../combat/CombatStats';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { HealthBarView } from '../feedback/HealthBarView';
import { HitFlashView } from '../feedback/HitFlashView';
import { GRID_RENDER_SCALE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { getMonsterRuntimeDefinition } from './MonsterConfig';
import { MonsterAnimator } from './MonsterAnimator';
import { createMonsterFrame, MonsterDirection, MONSTER_FRAME_COUNT, type MonsterFrameSet } from './MonsterSpriteConfig';
import { type MonsterGroupData } from './MonsterTypes';
import { MonsterRuntimeRegistry } from './MonsterRuntimeRegistry';
import { MonsterGroupController } from './MonsterGroupController';
import { MonsterMotor } from './MonsterMotor';
import { MonsterCombatController } from './MonsterCombatController';
import { MonsterAttackReceiver } from './MonsterAttackReceiver';

export class MonsterGroupRenderer {
    private readonly frames = new Map<string, ReturnType<typeof createMonsterFrame>>();
    constructor(
        private readonly root: Node,
        private readonly moveTexture: Texture2D,
        private readonly attackTexture: Texture2D,
        private readonly healthTexture: Texture2D,
        private readonly flashMaterial: Material,
        private readonly hub: CombatEventHub,
        private readonly popup: DamagePopupSpawner,
    ) {}
    public render(groups: readonly MonsterGroupData[], objects: readonly WorldObjectData[], mapWidth: number, mapHeight: number, registry?: MonsterRuntimeRegistry): void {
        this.root.removeAllChildren();
        for (const group of groups) {
            const guarded = objects.find((object) => object.id === group.guardedObjectId);
            if (!guarded) throw new Error(`[MonsterGroupRenderer] guarded object missing: ${group.guardedObjectId}`);
            const groupNode = new Node(`MonsterGroup_${group.id}`); groupNode.setParent(this.root); groupNode.layer = this.root.layer;
            const groupController = groupNode.addComponent(MonsterGroupController);
            groupController.setup(group, { x: guarded.gridX + 0.5, y: guarded.gridY + 0.5 });
            registry?.registerGroup(groupController);
            const definition = { w: 1, h: 1 };
            for (const member of group.members) {
                const node = new Node(`Slime_${member.id}`); node.setParent(groupNode); node.layer = groupNode.layer;
                node.setScale(GRID_RENDER_SCALE, GRID_RENDER_SCALE, 1);
                node.setPosition(gridRectToWorldCenter(guarded.gridX + member.guardOffset.x, guarded.gridY + member.guardOffset.y, definition.w, definition.h, mapWidth, mapHeight));
                node.addComponent(UITransform).setContentSize(16, 16);
                const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                const moveFrames: MonsterFrameSet = {
                    [MonsterDirection.Down]: this.getFrames(MonsterDirection.Down),
                    [MonsterDirection.Up]: this.getFrames(MonsterDirection.Up),
                    [MonsterDirection.Left]: this.getFrames(MonsterDirection.Left),
                    [MonsterDirection.Right]: this.getFrames(MonsterDirection.Right),
                };
                const attackFrames: MonsterFrameSet = {
                    [MonsterDirection.Down]: this.getAttackFrames(MonsterDirection.Down),
                    [MonsterDirection.Up]: this.getAttackFrames(MonsterDirection.Up),
                    [MonsterDirection.Left]: this.getAttackFrames(MonsterDirection.Left),
                    [MonsterDirection.Right]: this.getAttackFrames(MonsterDirection.Right),
                };
                const direction = member.guardOffset.x < 0 ? MonsterDirection.Left : member.guardOffset.x > 0 ? MonsterDirection.Right : MonsterDirection.Up;
                const animator = node.addComponent(MonsterAnimator);
                const config = getMonsterRuntimeDefinition(member.type);
                animator.setup(
                    sprite,
                    moveFrames,
                    attackFrames,
                    config.moveFrameDuration,
                    config.attackFrameDuration,
                    config.attackHitFrame,
                    direction,
                );
                const stats = node.addComponent(CombatStats);
                stats.setup({
                    attackDamage: config.attackDamage,
                    attackRangeCells: config.attackRangeCells,
                    preferredCombatDistanceCells: config.preferredCombatDistanceCells,
                });
                const health = node.addComponent(HealthComponent); health.setup(config.maxHealth);
                // health.subscribe((_current, _max, result) => {
                //     if (result?.becameDepleted) animator.playDead();
                // });
                const healthBar = node.addComponent(HealthBarView); healthBar.setup({ health, texture: this.healthTexture, localOffsetY: 11 });
                const flash = node.addComponent(HitFlashView); flash.setup({ sprite, baseMaterial: this.flashMaterial });
                node.addComponent(MonsterAttackReceiver).setup(member.id, this.hub, health, flash, this.popup);
                const motor = node.addComponent(MonsterMotor);
                const position = { x: guarded.gridX + 0.5 + member.guardOffset.x, y: guarded.gridY + 0.5 + member.guardOffset.y };
                motor.setup(
                    animator,
                    position,
                    config.moveSpeedCellsPerSecond,
                    mapWidth,
                    mapHeight,
                );
                const combat = node.addComponent(MonsterCombatController);
                combat.setup({
                    unitId: member.id,
                    guardWorldPosition: position,
                    motor,
                    animator,
                    health,
                    stats,
                    hub: this.hub,
                });
                groupController.addMonster(member.id, combat);
            }
        }
    }
    private getFrames(direction: MonsterDirection) {
        const result = [];
        for (let index = 0; index < MONSTER_FRAME_COUNT; index += 1) {
            const key = `${direction}:${index}`;
            let frame = this.frames.get(key);
            if (!frame) { frame = createMonsterFrame(this.moveTexture, direction, index); this.frames.set(key, frame); }
            result.push(frame);
        }
        return result;
    }

    private getAttackFrames(direction: MonsterDirection) {
        const result = [];
        for (let index = 0; index < MONSTER_FRAME_COUNT; index += 1) {
            const key = `attack:${direction}:${index}`;
            let frame = this.frames.get(key);
            if (!frame) {
                frame = createMonsterFrame(this.attackTexture, direction, index);
                this.frames.set(key, frame);
            }
            result.push(frame);
        }
        return result;
    }
}
