import {
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
    Vec3,
} from 'cc';
import { Texture2D } from 'cc';


import { getAtlasRect, TILE_RENDER_SIZE } from './TerrainAtlas';
import { MapResolver } from './MapResolver';
import { TileVisual, type TerrainMap } from './MapTypes';

export class MapRenderer {
    private readonly resolver = new MapResolver();
    private readonly frameCache = new Map<TileVisual, SpriteFrame>();

    constructor(
        private readonly tileRoot: Node,
        private readonly atlasSpriteFrame: SpriteFrame,
    ) {
        const texture = this.atlasSpriteFrame.texture;
        texture.setFilters(
            Texture2D.Filter.NEAREST,
            Texture2D.Filter.NEAREST
        );
        texture.setMipFilter(Texture2D.Filter.NONE);
    }

    public clear(): void {
        this.tileRoot.removeAllChildren();
    }

    public render(map: TerrainMap): void {
        this.clear();

        const rows = map.length;
        const columns = map[0]?.length ?? 0;
        const mapWidth = columns * TILE_RENDER_SIZE;
        const mapHeight = rows * TILE_RENDER_SIZE;

        for (let y = 0; y < rows; y += 1) {
            for (let x = 0; x < columns; x += 1) {
                const visual = this.resolver.resolve(map, x, y);
                const tileNode = new Node(`Tile_${x}_${y}`);
                tileNode.setParent(this.tileRoot);
                tileNode.setPosition(this.toWorldPosition(x, y, mapWidth, mapHeight));

                const transform = tileNode.addComponent(UITransform);
                transform.setContentSize(TILE_RENDER_SIZE, TILE_RENDER_SIZE);

                const sprite = tileNode.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = this.getOrCreateFrame(visual);
            }
        }
    }

    private toWorldPosition(x: number, y: number, mapWidth: number, mapHeight: number): Vec3 {
        const worldX = -mapWidth / 2 + TILE_RENDER_SIZE / 2 + x * TILE_RENDER_SIZE;
        const worldY = mapHeight / 2 - TILE_RENDER_SIZE / 2 - y * TILE_RENDER_SIZE;
        return new Vec3(worldX, worldY, 0);
    }

    private getOrCreateFrame(visual: TileVisual): SpriteFrame {
        const cached = this.frameCache.get(visual);
        if (cached) {
            return cached;
        }

        const rect = getAtlasRect(visual);
        const frame = new SpriteFrame();
        frame.texture = this.atlasSpriteFrame.texture;
        frame.rect = new Rect(rect.x, rect.y, rect.width, rect.height);
        frame.originalSize = new Size(rect.width, rect.height);
        frame.offset = new Vec2(0, 0);
        frame.rotated = false;
        this.frameCache.set(visual, frame);

        return frame;
    }
}
