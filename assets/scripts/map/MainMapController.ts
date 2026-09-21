/**
 * Why this file exists:
 * MainMapController 是主地图 composition root，负责创建系统并注入它们的依赖。
 *
 * Ownership boundary:
 * 本文件拥有 bootstrap 和系统装配关系。
 *
 * This file deliberately does NOT:
 * 不拥有 Blueprint Card 布局、不拥有 WorldViewport 输入状态、
 * 不执行 Building Placement 和 Camera UX 规则。
 */
import {
    _decorator,
    assetManager,
    Camera,
    Component,
    Material,
    Node,
    Sprite,
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
import { BuildingBlueprintInventory } from '../building/BuildingBlueprintInventory';
import { BuildingRuntimeRegistry } from '../building/BuildingRuntimeRegistry';
import { BuildingSpriteFrameFactory } from '../building/BuildingSpriteFrameFactory';
import { BuildingRenderer } from '../building/BuildingRenderer';
import { BuildingPlacementValidator } from '../building/BuildingPlacementValidator';
import { BuildingPlacementService } from '../building/BuildingPlacementService';
import { BuildingGhostView } from '../building/BuildingGhostView';
import { BuildingPlacementTool } from '../building/BuildingPlacementTool';
import { BuildToolController } from '../building/BuildToolController';
import { GridPointerProjector } from '../building/GridPointerProjector';
import { WorldCellFlag, WorldCellGrid } from '../world/WorldCellGrid';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { BuildingUiAssetLoader } from '../building/BuildingUiAssetLoader';
import { BuildCardStripController } from '../building/BuildCardStripController';
import { WorldViewportController } from '../camera/WorldViewportController';
import { CombatStatModifierRegistry } from '../combat/CombatStatModifierRegistry';
import { BuildingVisualLibrary } from '../building/BuildingVisualLibrary';
import { BuildingEffectSystem } from '../building/effects/BuildingEffectSystem';
import { validateBuildingEffectReferences } from '../building/effects/BuildingEffectCatalog';
import { SquadSelectionController } from '../squad/SquadSelectionController';
import { SquadUiAssetLoader } from '../ui/squad/SquadUiAssetLoader';
import { buildSquadPresentationMap } from '../ui/squad/SquadPresentationConfig';
import { SquadRosterController } from '../ui/squad/SquadRosterController';
import { HoverInfoAssetLoader } from '../ui/hover/HoverInfoAssetLoader';
import { HoverInfoController } from '../ui/hover/HoverInfoController';
import { HoverInfoPanelView } from '../ui/hover/HoverInfoPanelView';
import { EnemyKillCounter } from '../combat/EnemyKillCounter';
import { BaseInteractionController } from '../ui/base/BaseInteractionController';
import { BasePanelView } from '../ui/base/BasePanelView';

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

    @property(SpriteFrame)
    public townCenterIdleFrame: SpriteFrame | null = null;

    @property(SpriteFrame)
    public townCenterReadyFrame: SpriteFrame | null = null;

    private mapRenderer: MapRenderer | null = null;
    private worldObjectRenderer: WorldObjectRenderer | null = null;
    private squadRenderer: SquadRenderer | null = null;
    private combatEventHub: CombatEventHub | null = null;
    private monsterRegistry: MonsterRuntimeRegistry | null = null;
    private baseInteraction: BaseInteractionController | null = null;

    start(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
        // MainMapController 作为 composition root 统一创建并注入 CombatEventHub，避免攻击事件链退化成全局单例。
        const mapRoot = this.node;
        const camera = this.node.parent?.getChildByName('Camera')?.getComponent(Camera)
            ?? this.node.scene?.getComponentInChildren(Camera);
        if (!camera) {
            throw new Error('[MainMapController] Camera is required in scene.');
        }
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
        const squadUiAssets = await new SquadUiAssetLoader().load();
        const targetFlagTexture = squadUiAssets.targetFlagTexture
            ?? this.requireInspectorTexture(
                this.targetFlagTexture,
                'targetFlagTexture',
            );
        const swordWarriorPortrait = squadUiAssets.swordWarriorPortrait;
        if (!swordWarriorPortrait) {
            throw new Error('[MainMapController] sword warrior portrait is required.');
        }
        const squadPresentationById = buildSquadPresentationMap(STATIC_SQUADS, {
            swordWarriorPortrait,
        });
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
        const buildingUiAssets = await new BuildingUiAssetLoader().load();
        const hoverInfoAssets = await new HoverInfoAssetLoader().load();
        const townCenterIdleFrame = await this.resolveSpriteFrame(
            this.townCenterIdleFrame,
            '89b116e7-6b29-4acd-b553-625ac46f5e4a@f9941',
            'towncenter0',
        );
        const townCenterReadyFrame = await this.resolveSpriteFrame(
            this.townCenterReadyFrame,
            'a5e06615-45ef-414d-9a35-32431801e4a9@f9941',
            'towncenter1',
        );
        const hudRoot = this.getOrCreateCanvasChild('HUDRoot');
        const hudTransform = hudRoot.getComponent(UITransform)
            ?? hudRoot.addComponent(UITransform);
        hudTransform.setContentSize(1280, 720);
        hudTransform.setAnchorPoint(0.5, 0.5);
        hudRoot.setPosition(0, 0, 0);
        const hoverLayer = this.getOrCreateChild(hudRoot, 'HoverInfoLayer');
        const hoverLayerTransform = hoverLayer.getComponent(UITransform)
            ?? hoverLayer.addComponent(UITransform);
        hoverLayerTransform.setContentSize(1280, 720);
        hoverLayerTransform.setAnchorPoint(0.5, 0.5);
        hoverLayer.setPosition(0, 0, 0);
        const hoverPanelNode = this.getOrCreateChild(hoverLayer, 'HoverInfoPanel');
        const hoverPanel = new HoverInfoPanelView(
            hoverPanelNode,
            hoverInfoAssets.backgroundFrame,
        );
        const hoverInfo = hoverLayer.getComponent(HoverInfoController)
            ?? hoverLayer.addComponent(HoverInfoController);
        hoverInfo.setup(hoverPanel, hudTransform);
        const basePanelRoot = this.getOrCreateChild(hudRoot, 'BasePanelRoot');
        const basePanelTransform = basePanelRoot.getComponent(UITransform)
            ?? basePanelRoot.addComponent(UITransform);
        basePanelTransform.setContentSize(hudTransform.contentSize);
        basePanelTransform.setAnchorPoint(0.5, 0.5);
        basePanelRoot.setPosition(0, 0, 0);
        const defeatedEnemyIds: string[] = [];
        for (const group of STATIC_MONSTER_GROUPS) {
            for (const member of group.members) {
                defeatedEnemyIds.push(member.id);
            }
        }
        const enemyKillCounter = new EnemyKillCounter(defeatedEnemyIds, 3);
        const baseInteraction = new BaseInteractionController(enemyKillCounter);
        this.baseInteraction = baseInteraction;
        const basePanel = new BasePanelView(
            basePanelRoot,
            hoverInfoAssets.backgroundFrame,
            () => baseInteraction.close(),
        );
        validateBuildingEffectReferences();
        const playerCombatModifiers = new CombatStatModifierRegistry();
        const buildingVisualLibrary = await BuildingVisualLibrary.load();

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
        const worldCellGrid = new WorldCellGrid(
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );
        for (const objectData of worldObjectRegistry.getAll()) {
            const visual = getWorldVisualDefinition(objectData.visualId);
            const cells = [];
            for (let y = objectData.gridY; y < objectData.gridY + visual.h; y += 1) {
                for (let x = objectData.gridX; x < objectData.gridX + visual.w; x += 1) {
                    cells.push({ x, y });
                }
            }
            worldCellGrid.claim(
                objectData.id,
                objectData.kind === 0 ? WorldCellFlag.Base : WorldCellFlag.Resource,
                cells,
            );
        }

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
            hoverInfo,
            baseInteraction,
        );
        lifecycle.setup(worldObjectRegistry, this.worldObjectRenderer, navigationGrid, worldCellGrid);
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
            hoverInfo,
            (enemyId) => enemyKillCounter.recordDefeat(enemyId),
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
            playerCombatModifiers,
        );
        const squadHandles = this.squadRenderer.render(
            STATIC_SQUADS,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );
        const selectionNode = this.getOrCreateChild(mapRoot, 'SquadSelectionController');
        const selection = selectionNode.getComponent(SquadSelectionController)
            ?? selectionNode.addComponent(SquadSelectionController);
        selection.setup(STATIC_SQUADS, squadHandles);
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
            selection,
            squadPresentationById,
            targetFlagTexture,
            mapWidth: STATIC_MAP[0]?.length ?? 0,
            mapHeight: STATIC_MAP.length,
            onBaseClicked: () => baseInteraction.open(),
        });
        baseInteraction.setup({
            idleFrame: townCenterIdleFrame,
            readyFrame: townCenterReadyFrame,
            panel: basePanel,
            setBaseSpriteFrame: (frame) => this.setBaseSpriteFrame(frame),
            onOpenStateChanged: (open) => {
                if (open) buildToolController?.cancel();
                hoverInfo.setSuspended(open);
            },
        });
        const resourceHudNode = this.getOrCreateChild(hudRoot, 'ResourceHud');
        const resourceHud = resourceHudNode.getComponent(ResourceHudView)
            ?? resourceHudNode.addComponent(ResourceHudView);
        resourceHud.setup(resourceInventory);

        const buildingRoot = this.getOrCreateChild(worldObjectRoot, 'BuildingRoot');
        const previewRoot = this.getOrCreateChild(worldObjectRoot, 'BuildPreviewRoot');
        const buildToolNode = this.getOrCreateChild(mapRoot, 'BuildToolController');
        const buildToolController = buildToolNode.getComponent(BuildToolController)
            ?? buildToolNode.addComponent(BuildToolController);
        const buildingFactory = new BuildingSpriteFrameFactory(buildingTexture, buildingVisualLibrary);
        const buildingRegistry = new BuildingRuntimeRegistry();
        const buildingEffectSystem = new BuildingEffectSystem(buildingRegistry, playerCombatModifiers);
        buildingEffectSystem.setup();
        const buildingRenderer = new BuildingRenderer(
            buildingRoot,
            buildingFactory,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
            hoverInfo,
        );
        const blueprintInventory = new BuildingBlueprintInventory();
        const validator = new BuildingPlacementValidator(STATIC_MAP, worldCellGrid, resourceInventory);
        const service = new BuildingPlacementService(
            validator,
            resourceInventory,
            worldCellGrid,
            navigationGrid,
            buildingRenderer,
            buildingRegistry,
        );
        const ghost = new BuildingGhostView(
            previewRoot,
            buildingFactory,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );
        const placementTool = new BuildingPlacementTool(
            new GridPointerProjector(mapRoot, camera, STATIC_MAP[0]?.length ?? 0, STATIC_MAP.length),
            validator,
            service,
            ghost,
        );
        buildToolController.setup(placementTool);
        buildToolController.setInputBlockedPredicate(() => baseInteraction.isOpen());
        commandController.setInputBlockedPredicate(() => buildToolController.isActive() || baseInteraction.isOpen());
        const cardStripNode = this.getOrCreateChild(hudRoot, 'BlueprintCardStrip');
        const cardStrip = new BuildCardStripController(
            cardStripNode,
            blueprintInventory,
            resourceInventory,
            buildingFactory,
            buildToolController,
            buildingUiAssets.blueprintCardFrame,
            hoverInfo,
        );
        cardStrip.setup();
        const rosterNode = this.getOrCreateChild(hudRoot, 'SquadRosterRoot');
        const roster = new SquadRosterController(
            rosterNode,
            STATIC_SQUADS,
            squadHandles,
            selection,
            squadPresentationById,
            hoverInfo,
        );
        roster.setup();
        selection.setBeforeUserSelection(() => buildToolController.cancel());
        selection.setInputBlockedPredicate(() => baseInteraction.isOpen());
        const interactionUiNodes = [cardStripNode, rosterNode, basePanelRoot];
        buildToolController.setInputExcludedNodes(interactionUiNodes);
        hoverInfo.setWorldHoverEnabledPredicate(() => !buildToolController.isActive() && !baseInteraction.isOpen());
        hoverLayer.setSiblingIndex(hudRoot.children.length - 1);
        basePanelRoot.setSiblingIndex(hudRoot.children.length - 1);
        const viewportNode = this.getOrCreateChild(mapRoot, 'WorldViewportController');
        const viewport = viewportNode.getComponent(WorldViewportController)
            ?? viewportNode.addComponent(WorldViewportController);
        viewport.setup({
            mapRoot,
            camera,
            mapWidthCells: STATIC_MAP[0]?.length ?? 0,
            mapHeightCells: STATIC_MAP.length,
            viewportWidth: hudTransform.contentSize.width,
            viewportHeight: hudTransform.contentSize.height,
            excludedUiNodes: interactionUiNodes,
        });
        for (const definitionId of ['storage_house_01', 'lumberjack_house_01', 'barracks_01', 'blacksmith_house_01']) {
            blueprintInventory.unlock(definitionId);
        }
    }

    protected onDestroy(): void {
        this.baseInteraction?.destroy();
        this.baseInteraction = null;
    }

    private setBaseSpriteFrame(frame: SpriteFrame): void {
        const node = this.worldObjectRenderer?.getNode('base_main');
        if (!node) {
            console.warn('[MainMapController] base_main node missing for base sprite swap.');
            return;
        }
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setContentSize(64, 64);
        const sprite = node.getComponent(Sprite) ?? node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
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

    private async resolveSpriteFrame(
        existingFrame: SpriteFrame | null,
        uuid: string,
        label: string,
    ): Promise<SpriteFrame> {
        if (existingFrame) {
            return existingFrame;
        }

        return new Promise((resolve, reject) => {
            assetManager.loadAny<SpriteFrame>(uuid, (error, asset) => {
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
