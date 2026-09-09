import { _decorator, assetManager, Component, find, Node, SpriteFrame, UITransform } from 'cc';
import { MapRenderer } from './MapRenderer';
import { STATIC_MAP } from './StaticMap';
import { TERRAIN_SPRITE_FRAME_FALLBACK_UUID, TERRAIN_SPRITE_FRAME_UUID } from './TerrainAtlas';

const { ccclass, property } = _decorator;

@ccclass('MainMapController')
export class MainMapController extends Component {
    private renderer: MapRenderer | null = null;

    start(): void {
        void this.bootstrap();
    }

    private async bootstrap(): Promise<void> {
        const mapRoot = this.getOrCreateChild(this.node, 'MapRoot');
        const tileRoot = this.getOrCreateChild(mapRoot, 'TileRoot');
        this.ensureUITransform(mapRoot);
        this.ensureUITransform(tileRoot);

        const atlasSpriteFrame = await this.loadAtlasSpriteFrame();
        this.renderer = new MapRenderer(tileRoot, atlasSpriteFrame);
        this.renderer.render(STATIC_MAP);
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
        const existing = find(name, parent);
        if (existing) {
            return existing;
        }

        const node = new Node(name);
        node.setParent(parent);
        return node;
    }

    private ensureUITransform(node: Node): UITransform {
        const existing = node.getComponent(UITransform);
        if (existing) {
            return existing;
        }

        return node.addComponent(UITransform);
    }
}
