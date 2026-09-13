import {
    _decorator,
    assetManager,
    Component,
    Material,
    Node,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { ResourceInventory } from '../economy/ResourceInventory';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { WorldCommandController } from '../command/WorldCommandController';
import { AStarPathfinder } from '../navigation/AStarPathfinder';
import { NavigationGridBuilder } from '../navigation/NavigationGridBuilder';
import { TargetApproachResolver } from '../navigation/TargetApproachResolver';
import { WorldNavigator } from '../navigation/WorldNavigator';
import { STATIC_SQUADS } from '../squad/StaticSquads';
import { SquadRenderer } from '../squad/SquadRenderer';
import {
    WARRIOR_TEXTURE_UUID,
} from '../squad/WarriorSpriteConfig';
import {
    BUILDING_ATLAS_TEXTURE_UUID,
    NATURE_ATLAS_TEXTURE_UUID,
} from '../world/WorldAtlasConfig';
import { WorldObjectRenderer } from '../world/WorldObjectRenderer';
import { WorldObjectLifecycleController } from '../world/WorldObjectLifecycleController';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { STATIC_WORLD_OBJECTS } from '../world/StaticWorldObjects';
import { MapRenderer } from './MapRenderer';
import { STATIC_MAP } from './StaticMap';
import { TERRAIN_SPRITE_FRAME_FALLBACK_UUID, TERRAIN_SPRITE_FRAME_UUID } from './TerrainAtlas';
import { ResourceHudView } from '../ui/ResourceHudView';
import { MonsterGroupRenderer } from '../monster/MonsterGroupRenderer';
import { STATIC_MONSTER_GROUPS } from '../monster/StaticMonsterGroups';
import { MonsterRuntimeRegistry } from '../monster/MonsterRuntimeRegistry';

const { ccclass, property } = _decorator;

@ccclass('MainMapController')
export class MainMapController extends Component {
    @property(Node)
    public structureRoot: Node | null = null;

    @property(Node)
    public resourceRoot: Node | null = null;

    @property(Texture2D)
    public buildingAtlasTexture: Texture2D | null = null;

    @property(Texture2D)
    public natureAtlasTexture: Texture2D | null = null;

    @property(Texture2D)
    public warriorTexture: Texture2D | null = null;

    @property(Texture2D)
    public targetFlagTexture: Texture2D | null = null;

    @property(Texture2D)
    public warriorAttackTexture: Texture2D | null = null;

    @property(Material)
    public hitFlashMaterial: Material | null = null;

    @property(Texture2D)
    public friendlyHealthBarTexture: Texture2D | null = null;

    @property(Texture2D)
    public resourceHealthBarTexture: Texture2D | null = null;

    @property(Texture2D)
    public slimeMoveTexture: Texture2D | null = null;

    @property(Texture2D)
    public slimeAttackTexture: Texture2D | null = null;

    private mapRenderer: MapRenderer | null = null;
    private worldObjectRenderer: WorldObjectRenderer | null = null;
    private squadRenderer: SquadRenderer | null = null;
    private combatEventHub: CombatEventHub | null = null;
    private monsterRegistry: MonsterRuntimeRegistry | null = null;

    start(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
        // MainMapController 作为 composition root 统一创建并注入 CombatEventHub，避免攻击事件链退化成全局单例。
        const mapRoot = this.node;
        const tileRoot = this.requireChild(mapRoot, 'TileRoot');
        const worldObjectRoot = this.requireChild(mapRoot, 'WorldObjectRoot');
        const structureRoot = this.requireChild(worldObjectRoot, 'StructureRoot');
        const resourceRoot = this.requireChild(worldObjectRoot, 'ResourceRoot');
        const actorRoot = this.requireChild(mapRoot, 'ActorRoot');
        const squadRoot = this.requireChild(actorRoot, 'SquadRoot');
        const commandRoot = this.requireChild(mapRoot, 'CommandRoot');
        const commandController = mapRoot.getComponent(WorldCommandController);
        if (!commandController) {
            throw new Error('[MainMapController] WorldCommandController is required on MapRoot.');
        }

        this.ensureUITransform(mapRoot);
        this.ensureUITransform(tileRoot);
        this.ensureUITransform(worldObjectRoot);
        this.ensureUITransform(structureRoot);
        this.ensureUITransform(resourceRoot);
        this.ensureUITransform(actorRoot);
        this.ensureUITransform(squadRoot);
        this.ensureUITransform(commandRoot);

        const atlasSpriteFrame = await this.loadAtlasSpriteFrame();
        const buildingTexture = await this.resolveTexture(
            this.buildingAtlasTexture,
            BUILDING_ATLAS_TEXTURE_UUID,
            'building atlas',
        );
        const natureTexture = await this.resolveTexture(
            this.natureAtlasTexture,
            NATURE_ATLAS_TEXTURE_UUID,
            'nature atlas',
        );
        const warriorTexture = await this.resolveTexture(
            this.warriorTexture,
            WARRIOR_TEXTURE_UUID,
            'warrior texture',
        );
        const targetFlagTexture = this.requireInspectorTexture(
            this.targetFlagTexture,
            'targetFlagTexture',
        );
        const warriorAttackTexture = this.requireInspectorTexture(
            this.warriorAttackTexture,
            'warriorAttackTexture',
        );
        const hitFlashMaterial = this.requireInspectorMaterial(
            this.hitFlashMaterial,
            'hitFlashMaterial',
        );
        const friendlyHealthBarTexture = this.requireInspectorTexture(
            this.friendlyHealthBarTexture,
            'friendlyHealthBarTexture',
        );
        const resourceHealthBarTexture = this.requireInspectorTexture(
            this.resourceHealthBarTexture,
            'resourceHealthBarTexture',
        );
        const slimeMoveTexture = this.requireInspectorTexture(this.slimeMoveTexture, 'slimeMoveTexture');
        const slimeAttackTexture = this.requireInspectorTexture(this.slimeAttackTexture, 'slimeAttackTexture');

        this.structureRoot = structureRoot;
        this.resourceRoot = resourceRoot;
        this.buildingAtlasTexture = buildingTexture;
        this.natureAtlasTexture = natureTexture;
        this.warriorTexture = warriorTexture;
        this.targetFlagTexture = targetFlagTexture;
        this.warriorAttackTexture = warriorAttackTexture;
        this.hitFlashMaterial = hitFlashMaterial;
        this.friendlyHealthBarTexture = friendlyHealthBarTexture;
        this.resourceHealthBarTexture = resourceHealthBarTexture;
        this.combatEventHub = new CombatEventHub();
        this.monsterRegistry = new MonsterRuntimeRegistry();
        const worldObjectRegistry = new WorldObjectRuntimeRegistry(STATIC_WORLD_OBJECTS);
        const resourceInventory = new ResourceInventory();
        const feedbackRoot = this.getOrCreateChild(mapRoot, 'WorldFeedbackRoot');
        const monsterRoot = this.getOrCreateChild(actorRoot, 'MonsterRoot');
        const damagePopupSpawner = new DamagePopupSpawner(feedbackRoot);

        this.mapRenderer = new MapRenderer(tileRoot, atlasSpriteFrame);
        this.mapRenderer.render(STATIC_MAP);

        const navigationGrid = new NavigationGridBuilder().build(
            STATIC_MAP,
            worldObjectRegistry.getAll(),
        );
        const lifecycle = mapRoot.getComponent(WorldObjectLifecycleController)
            ?? mapRoot.addComponent(WorldObjectLifecycleController);
        this.worldObjectRenderer = new WorldObjectRenderer(
            structureRoot,
            resourceRoot,
            buildingTexture,
            natureTexture,
            this.combatEventHub,
            hitFlashMaterial,
            resourceInventory,
            damagePopupSpawner,
            lifecycle,
            resourceHealthBarTexture,
        );
        lifecycle.setup(worldObjectRegistry, this.worldObjectRenderer, navigationGrid);
        this.worldObjectRenderer.render(
            worldObjectRegistry.getAll(),
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );
        new MonsterGroupRenderer(
            monsterRoot,
            slimeMoveTexture,
            slimeAttackTexture,
            friendlyHealthBarTexture,
            hitFlashMaterial,
            this.combatEventHub,
            damagePopupSpawner,
        ).render(
            STATIC_MONSTER_GROUPS,
            worldObjectRegistry.getAll(),
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
            this.monsterRegistry,
        );

        const navigator = new WorldNavigator(
            navigationGrid,
            new AStarPathfinder(),
            new TargetApproachResolver(),
        );

        this.squadRenderer = new SquadRenderer(
            squadRoot,
            warriorTexture,
            warriorAttackTexture,
            navigationGrid,
            navigator,
            this.combatEventHub,
            worldObjectRegistry,
            friendlyHealthBarTexture,
            hitFlashMaterial,
            damagePopupSpawner,
            this.monsterRegistry,
        );
        const squadHandles = this.squadRenderer.render(
            STATIC_SQUADS,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );
        for (const handle of squadHandles.values()) {
            handle.brain.setGuardEncounterRequester((squadId, objectId) =>
                this.beginGuardCombat(squadId, objectId, squadHandles));
            handle.brain.setGuardRetreatRequester((_squadId, objectId) => {
                const group = this.monsterRegistry?.getByGuardedObject(objectId);
                group?.markSquadRetreating(handle.id);
                handle.combat.requestRetreat();
            });
        }

        commandController.setup({
            worldObjectRoot,
            commandRoot,
            worldObjectRegistry,
            squadHandles,
            targetFlagTexture,
            mapWidth: STATIC_MAP[0]?.length ?? 0,
            mapHeight: STATIC_MAP.length,
        });
        const hudRoot = this.getOrCreateCanvasChild('HUDRoot');
        const hudTransform = hudRoot.getComponent(UITransform)
            ?? hudRoot.addComponent(UITransform);
        hudTransform.setContentSize(1280, 720);
        hudTransform.setAnchorPoint(0.5, 0.5);
        hudRoot.setPosition(0, 0, 0);
        const resourceHudNode = this.getOrCreateChild(hudRoot, 'ResourceHud');
        const resourceHud = resourceHudNode.getComponent(ResourceHudView)
            ?? resourceHudNode.addComponent(ResourceHudView);
        resourceHud.setup(resourceInventory);
    }

    private beginGuardCombat(
        squadId: string,
        guardedObjectId: string,
        squadHandles: ReadonlyMap<string, import('../squad/SquadTypes').SquadRuntimeHandle>,
    ): boolean {
        if (!this.monsterRegistry) return false;
        const group = this.monsterRegistry.getByGuardedObject(guardedObjectId);
        const squad = squadHandles.get(squadId);
        if (!group || !squad || group.getState() === 3) return false;
        squad.combat.beginGuardCombat(group);
        return true;
    }

    private loadAtlasSpriteFrame(): Promise<SpriteFrame> {
        return new Promise((resolve, reject) => {
            const tryLoad = (uuid: string, next?: () => void): void => {
                assetManager.loadAny<SpriteFrame>(uuid, (error, asset) => {
                    if (!error && asset) {
                        resolve(asset);
                        return;
                    }

                    if (next) {
                        next();
                        return;
                    }

                    reject(error ?? new Error('Failed to load terrain sprite frame.'));
                });
            };

            tryLoad(TERRAIN_SPRITE_FRAME_UUID, () => {
                tryLoad(TERRAIN_SPRITE_FRAME_FALLBACK_UUID);
            });
        });
    }

    private requireChild(parent: Node, name: string): Node {
        const child = parent.getChildByName(name);
        if (!child) {
            throw new Error(
                `[MainMapController] required node missing: ${parent.name}/${name}`,
            );
        }

        return child;
    }

    private getOrCreateChild(parent: Node, name: string): Node {
        return parent.getChildByName(name) ?? (() => {
            const node = new Node(name);
            node.setParent(parent);
            node.layer = parent.layer;
            this.ensureUITransform(node);
            return node;
        })();
    }

    private getOrCreateCanvasChild(name: string): Node {
        const canvas = this.node.parent;
        if (!canvas) {
            throw new Error('[MainMapController] MapRoot must have a Canvas parent.');
        }
        return this.getOrCreateChild(canvas, name);
    }

    private ensureUITransform(node: Node): UITransform {
        const existing = node.getComponent(UITransform);
        if (existing) {
            return existing;
        }

        return node.addComponent(UITransform);
    }

    private async resolveTexture(
        existingTexture: Texture2D | null,
        uuid: string,
        label: string,
    ): Promise<Texture2D> {
        if (existingTexture) {
            return existingTexture;
        }

        return new Promise((resolve, reject) => {
            assetManager.loadAny<Texture2D>(uuid, (error, asset) => {
                if (error || !asset) {
                    reject(error ?? new Error(`Failed to load ${label}.`));
                    return;
                }

                resolve(asset);
            });
        });
    }

    private requireInspectorTexture(
        texture: Texture2D | null,
        propertyName: string,
    ): Texture2D {
        if (!texture) {
            throw new Error(`[MainMapController] ${propertyName} must be assigned in Inspector.`);
        }

        return texture;
    }

    private requireInspectorMaterial(
        material: Material | null,
        propertyName: string,
    ): Material {
        // hit flash material 明确要求由编辑器绑定，这样 effect/material 的可视化调参仍然留在美术友好的工作流里。
        if (!material) {
            throw new Error(`[MainMapController] ${propertyName} must be assigned in Inspector.`);
        }

        return material;
    }
}
