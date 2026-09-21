import {
    Material,
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
} from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { HealthComponent } from '../combat/HealthComponent';
import { ResourceInventory } from '../economy/ResourceInventory';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { HealthBarView } from '../feedback/HealthBarView';
import { HitFlashView } from '../feedback/HitFlashView';
import { GRID_RENDER_SCALE, GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import {
    getWorldVisualDefinition,
    getWorldVisualRect,
    WorldAtlasKey,
} from './WorldAtlasConfig';
import {
    type WorldObjectData,
    WorldObjectKind,
    WorldVisualId,
} from './WorldObjectTypes';
import { WorldObjectAttackReceiver } from './WorldObjectAttackReceiver';
import { WorldObjectView } from './WorldObjectView';
import { getResourceRuntimeDefinition } from './ResourceRuntimeConfig';
import { ResourceHarvestComponent } from './ResourceHarvestComponent';
import { WorldObjectLifecycleController } from './WorldObjectLifecycleController';
import { HoverInfoTarget } from '../ui/hover/HoverInfoTarget';
import { HoverPlacement, HoverTargetKind, HoverTargetScope } from '../ui/hover/HoverInfoTypes';
import { type HoverInfoController } from '../ui/hover/HoverInfoController';
import { type BaseInteractionController } from '../ui/base/BaseInteractionController';

export class WorldObjectRenderer {
    private readonly frameCache = new Map<WorldVisualId, SpriteFrame>();
    private readonly nodeByObjectId = new Map<string, Node>();

    constructor(
        private readonly structureRoot: Node,
        private readonly resourceRoot: Node,
        private readonly buildingTexture: Texture2D,
        private readonly natureTexture: Texture2D,
        private readonly combatEventHub: CombatEventHub,
        private readonly hitFlashMaterial: Material,
        private readonly resourceInventory: ResourceInventory,
        private readonly damagePopupSpawner: DamagePopupSpawner,
        private readonly lifecycle: WorldObjectLifecycleController,
        private readonly resourceHealthBarTexture: Texture2D,
        private readonly hover: HoverInfoController,
        private readonly baseInteraction: BaseInteractionController | null = null,
    ) {}

    public clear(): void {
        // WorldObject 现在带有 combat receiver，clear 不能再只是摘节点，否则 hub 里会留下失效 targetId。
        this.clearRoot(this.structureRoot);
        this.clearRoot(this.resourceRoot);
    }

    public render(objects: readonly WorldObjectData[], mapWidth: number, mapHeight: number): void {
        // render 时顺手完成资源侧的 receiver + flash view 装配，让资源节点成为完整的“可被命中目标”。
        this.clear();
        this.validateObjects(objects, mapWidth, mapHeight);

        for (const objectData of objects) {
            const definition = getWorldVisualDefinition(objectData.visualId);
            const root = this.getParentRoot(objectData.kind);
            const node = new Node(this.getNodeName(objectData));
            node.setParent(root);
            node.layer = root.layer;
            node.setPosition(
                gridRectToWorldCenter(
                    objectData.gridX,
                    objectData.gridY,
                    definition.w,
                    definition.h,
                    mapWidth,
                    mapHeight,
                ),
            );
            node.setScale(GRID_RENDER_SCALE, GRID_RENDER_SCALE, 1);
            this.nodeByObjectId.set(objectData.id, node);

            const transform = node.addComponent(UITransform);
            transform.setContentSize(
                definition.w * GRID_SOURCE_SIZE,
                definition.h * GRID_SOURCE_SIZE,
            );

            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this.getOrCreateFrame(objectData.visualId);

            const view = node.addComponent(WorldObjectView);
            view.objectId = objectData.id;
            view.kind = objectData.kind;
            view.gridX = objectData.gridX;
            view.gridY = objectData.gridY;
            view.gridW = definition.w;
            view.gridH = definition.h;
            view.resourceType = objectData.resourceType ?? null;

            if (objectData.kind === WorldObjectKind.Resource) {
                const resourceType = objectData.resourceType;
                if (resourceType === undefined) {
                    throw new Error(`[WorldObjectRenderer] resourceType missing: ${objectData.id}`);
                }
                const health = node.addComponent(HealthComponent);
                const resourceDefinition = getResourceRuntimeDefinition(resourceType);
                health.setup(resourceDefinition.maxHealth);
                const healthBar = node.addComponent(HealthBarView);
                healthBar.setup({
                    health,
                    texture: this.resourceHealthBarTexture,
                    localOffsetY: definition.h * GRID_SOURCE_SIZE / 2 + 3,
                });
                const hitFlashView = node.addComponent(HitFlashView);
                hitFlashView.setup({
                    sprite,
                    baseMaterial: this.hitFlashMaterial,
                });

                const harvest = node.addComponent(ResourceHarvestComponent);
                harvest.setup({
                    resourceType,
                    health,
                    inventory: this.resourceInventory,
                    yieldPerDamage: resourceDefinition.yieldPerDamage,
                });
                const attackReceiver = node.addComponent(WorldObjectAttackReceiver);
                attackReceiver.setup({
                    objectId: objectData.id,
                    combatEventHub: this.combatEventHub,
                    hitFlashView,
                    health,
                    damagePopupSpawner: this.damagePopupSpawner,
                    lifecycle: this.lifecycle,
                });
                node.addComponent(HoverInfoTarget).setup({
                    kind: HoverTargetKind.Resource,
                    scope: HoverTargetScope.World,
                    preferredPlacement: HoverPlacement.Right,
                    controller: this.hover,
                    getInfo: () => ({
                        title: this.getResourceName(resourceType),
                        rows: [
                            { label: '剩余资源', value: `${health.getCurrentHealth()} / ${health.getMaxHealth()}` },
                            { label: '采集效率', value: `${resourceDefinition.yieldPerDamage} resource / damage` },
                        ],
                    }),
                });
            } else {
                node.addComponent(HoverInfoTarget).setup({
                    kind: HoverTargetKind.Base,
                    scope: HoverTargetScope.World,
                    preferredPlacement: HoverPlacement.Right,
                    controller: this.hover,
                    getInfo: () => ({
                        title: 'Base',
                        subtitle: '文明核心',
                        footer: this.baseInteraction?.getHoverFooter() ?? '基地被摧毁则 Run 失败（未来）',
                    }),
                });
            }
        }

        console.log(`[WorldObjectRenderer] rendered ${objects.length} world objects.`);
    }

    public replaceResources(resources: readonly WorldObjectData[], mapWidth: number, mapHeight: number): void {
        this.clearRoot(this.resourceRoot);
        const resourceOnly = resources.filter((object) => object.kind === WorldObjectKind.Resource);
        for (const objectData of resourceOnly) {
            const definition = getWorldVisualDefinition(objectData.visualId);
            const node = new Node(this.getNodeName(objectData));
            node.setParent(this.resourceRoot);
            node.layer = this.resourceRoot.layer;
            node.setPosition(gridRectToWorldCenter(objectData.gridX, objectData.gridY, definition.w, definition.h, mapWidth, mapHeight));
            node.setScale(GRID_RENDER_SCALE, GRID_RENDER_SCALE, 1);
            const transform = node.addComponent(UITransform);
            transform.setContentSize(definition.w * GRID_SOURCE_SIZE, definition.h * GRID_SOURCE_SIZE);
            const sprite = node.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this.getOrCreateFrame(objectData.visualId);
            const view = node.addComponent(WorldObjectView);
            view.objectId = objectData.id;
            view.kind = objectData.kind;
            view.gridX = objectData.gridX;
            view.gridY = objectData.gridY;
            view.gridW = definition.w;
            view.gridH = definition.h;
            view.resourceType = objectData.resourceType ?? null;
            const resourceType = objectData.resourceType;
            if (resourceType === undefined) throw new Error(`[WorldObjectRenderer] resourceType missing: ${objectData.id}`);
            const health = node.addComponent(HealthComponent);
            const resourceDefinition = getResourceRuntimeDefinition(resourceType);
            health.setup(resourceDefinition.maxHealth);
            const healthBar = node.addComponent(HealthBarView);
            healthBar.setup({ health, texture: this.resourceHealthBarTexture, localOffsetY: definition.h * GRID_SOURCE_SIZE / 2 + 3 });
            const hitFlashView = node.addComponent(HitFlashView);
            hitFlashView.setup({ sprite, baseMaterial: this.hitFlashMaterial });
            const harvest = node.addComponent(ResourceHarvestComponent);
            harvest.setup({ resourceType, health, inventory: this.resourceInventory, yieldPerDamage: resourceDefinition.yieldPerDamage });
            const attackReceiver = node.addComponent(WorldObjectAttackReceiver);
            attackReceiver.setup({
                objectId: objectData.id,
                combatEventHub: this.combatEventHub,
                hitFlashView,
                health,
                damagePopupSpawner: this.damagePopupSpawner,
                lifecycle: this.lifecycle,
            });
            node.addComponent(HoverInfoTarget).setup({
                kind: HoverTargetKind.Resource,
                scope: HoverTargetScope.World,
                preferredPlacement: HoverPlacement.Right,
                controller: this.hover,
                getInfo: () => ({
                    title: this.getResourceName(resourceType),
                    rows: [
                        { label: '剩余资源', value: `${health.getCurrentHealth()} / ${health.getMaxHealth()}` },
                        { label: '采集效率', value: `${resourceDefinition.yieldPerDamage} resource / damage` },
                    ],
                }),
            });
            this.nodeByObjectId.set(objectData.id, node);
        }
    }

    public removeObject(objectId: string): boolean {
        const node = this.nodeByObjectId.get(objectId);
        if (!node) {
            return false;
        }
        node.getComponent(WorldObjectAttackReceiver)?.dispose();
        this.nodeByObjectId.delete(objectId);
        node.removeFromParent();
        node.destroy();
        return true;
    }

    public getNode(objectId: string): Node | null {
        return this.nodeByObjectId.get(objectId) ?? null;
    }

    private validateObjects(objects: readonly WorldObjectData[], mapWidth: number, mapHeight: number): void {
        const occupiedCells = new Set<string>();

        for (const objectData of objects) {
            const definition = getWorldVisualDefinition(objectData.visualId);

            if (
                objectData.gridX < 0 ||
                objectData.gridY < 0 ||
                objectData.gridX + definition.w > mapWidth ||
                objectData.gridY + definition.h > mapHeight
            ) {
                throw new Error(
                    `[WorldObjectRenderer] ${objectData.id} out of bounds: (${objectData.gridX}, ${objectData.gridY}) size ${definition.w}x${definition.h} on map ${mapWidth}x${mapHeight}`,
                );
            }

            for (let y = objectData.gridY; y < objectData.gridY + definition.h; y += 1) {
                for (let x = objectData.gridX; x < objectData.gridX + definition.w; x += 1) {
                    const key = `${x},${y}`;
                    if (occupiedCells.has(key)) {
                        throw new Error(`[WorldObjectRenderer] overlap at (${x}, ${y})`);
                    }
                    occupiedCells.add(key);
                }
            }
        }
    }

    private clearRoot(root: Node): void {
        // 这里先 dispose 再 destroy，是为了保证 combat hub 的注销时机早于同帧内的新节点重建。
        for (const child of [...root.children]) {
            child.getComponent(WorldObjectAttackReceiver)?.dispose();
            const view = child.getComponent(WorldObjectView);
            if (view) {
                this.nodeByObjectId.delete(view.objectId);
            }
            // 先从树上摘掉再 destroy，避免同一帧重建时旧 receiver 仍占着 targetId。
            child.removeFromParent();
            child.destroy();
        }
    }

    private getParentRoot(kind: WorldObjectKind): Node {
        return kind === WorldObjectKind.Base ? this.structureRoot : this.resourceRoot;
    }

    private getNodeName(objectData: WorldObjectData): string {
        return objectData.kind === WorldObjectKind.Base
            ? `Base_${objectData.id}`
            : `Resource_${objectData.id}`;
    }

    private getOrCreateFrame(visualId: WorldVisualId): SpriteFrame {
        const cached = this.frameCache.get(visualId);
        if (cached) {
            return cached;
        }

        const definition = getWorldVisualDefinition(visualId);
        const rect = getWorldVisualRect(visualId);
        const texture = this.getTexture(definition.atlas);

        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = new Rect(
            rect.x,
            rect.y,
            rect.width,
            rect.height,
        );
        frame.originalSize = new Size(rect.width, rect.height);
        frame.offset = new Vec2(0, 0);
        frame.rotated = false;
        this.frameCache.set(visualId, frame);

        return frame;
    }

    private getTexture(atlas: WorldAtlasKey): Texture2D {
        return atlas === WorldAtlasKey.Buildings ? this.buildingTexture : this.natureTexture;
    }

    private getResourceName(type: number): string {
        return ['Wood', 'Stone', 'Food', 'Gold'][type] ?? 'Resource';
    }
}
