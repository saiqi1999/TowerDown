import {
    _decorator,
    assetManager,
    Component,
    Node,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
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
import { STATIC_WORLD_OBJECTS } from '../world/StaticWorldObjects';
import { MapRenderer } from './MapRenderer';
import { STATIC_MAP } from './StaticMap';
import { TERRAIN_SPRITE_FRAME_FALLBACK_UUID, TERRAIN_SPRITE_FRAME_UUID } from './TerrainAtlas';

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

    private mapRenderer: MapRenderer | null = null;
    private worldObjectRenderer: WorldObjectRenderer | null = null;
    private squadRenderer: SquadRenderer | null = null;

    start(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
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

        this.structureRoot = structureRoot;
        this.resourceRoot = resourceRoot;
        this.buildingAtlasTexture = buildingTexture;
        this.natureAtlasTexture = natureTexture;
        this.warriorTexture = warriorTexture;
        this.targetFlagTexture = targetFlagTexture;
        this.warriorAttackTexture = warriorAttackTexture;

        this.mapRenderer = new MapRenderer(tileRoot, atlasSpriteFrame);
        this.mapRenderer.render(STATIC_MAP);

        this.worldObjectRenderer = new WorldObjectRenderer(
            structureRoot,
            resourceRoot,
            buildingTexture,
            natureTexture,
        );
        this.worldObjectRenderer.render(
            STATIC_WORLD_OBJECTS,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );

        const navigationGrid = new NavigationGridBuilder().build(
            STATIC_MAP,
            STATIC_WORLD_OBJECTS,
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
            navigator,
        );
        const squadHandles = this.squadRenderer.render(
            STATIC_SQUADS,
            STATIC_MAP[0]?.length ?? 0,
            STATIC_MAP.length,
        );

        commandController.setup({
            worldObjectRoot,
            commandRoot,
            worldObjects: STATIC_WORLD_OBJECTS,
            squadHandles,
            targetFlagTexture,
            mapWidth: STATIC_MAP[0]?.length ?? 0,
            mapHeight: STATIC_MAP.length,
        });
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
}
