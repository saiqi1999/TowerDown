import {
    _decorator,
    assetManager,
    Component,
    find,
    Node,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { MapRenderer } from './MapRenderer';
import { STATIC_MAP } from './StaticMap';
import { TERRAIN_SPRITE_FRAME_FALLBACK_UUID, TERRAIN_SPRITE_FRAME_UUID } from './TerrainAtlas';
import {
    BUILDING_ATLAS_TEXTURE_UUID,
    NATURE_ATLAS_TEXTURE_UUID,
} from '../world/WorldAtlasConfig';
import { STATIC_WORLD_OBJECTS } from '../world/StaticWorldObjects';
import { WorldObjectRenderer } from '../world/WorldObjectRenderer';

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

    private mapRenderer: MapRenderer | null = null;
    private worldObjectRenderer: WorldObjectRenderer | null = null;

    start(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
        const mapRoot = this.node;
        const tileRoot = this.getOrCreateChild(mapRoot, 'TileRoot');
        const worldObjectRoot = this.getOrCreateChild(mapRoot, 'WorldObjectRoot');
        const structureRoot = this.structureRoot ?? this.getOrCreateChild(worldObjectRoot, 'StructureRoot');
        const resourceRoot = this.resourceRoot ?? this.getOrCreateChild(worldObjectRoot, 'ResourceRoot');
        this.ensureUITransform(mapRoot);
        this.ensureUITransform(tileRoot);
        this.ensureUITransform(worldObjectRoot);
        this.ensureUITransform(structureRoot);
        this.ensureUITransform(resourceRoot);

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

        this.structureRoot = structureRoot;
        this.resourceRoot = resourceRoot;
        this.buildingAtlasTexture = buildingTexture;
        this.natureAtlasTexture = natureTexture;

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

    private getOrCreateChild(parent: Node, name: string): Node {
        const existing = find(name, parent) ?? parent.getChildByName(name);
        if (existing) {
            return existing;
        }

        const node = new Node(name);
        node.setParent(parent);
        node.layer = parent.layer;
        return node;
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
}
