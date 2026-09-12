import {
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec2,
} from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { gridCellToWorldCenter } from '../grid/GridTransform';
import { getAtlasRect } from './TerrainAtlas';
import { MapResolver } from './MapResolver';
import { TileVisual, type TerrainMap } from './MapTypes';

export class MapRenderer {
    private readonly resolver = new MapResolver();
    private readonly frameCache = new Map<TileVisual, SpriteFrame>();

    constructor(
        private readonly tileRoot: Node,
        private readonly atlasSpriteFrame: SpriteFrame,
    ) {}

    public clear(): void {
        this.tileRoot.removeAllChildren();
    }

    public render(map: TerrainMap): void {
        this.clear();

        const rows = map.length;
        const columns = map[0]?.length ?? 0;

        for (let y = 0; y < rows; y += 1) {
            for (let x = 0; x < columns; x += 1) {
                const visual = this.resolver.resolve(map, x, y);
                const tileNode = new Node(`Tile_${x}_${y}`);
                tileNode.setParent(this.tileRoot);
                tileNode.layer = this.tileRoot.layer;
                tileNode.setPosition(gridCellToWorldCenter(x, y, columns, rows));

                const transform = tileNode.addComponent(UITransform);
                transform.setContentSize(GRID_RENDER_SIZE, GRID_RENDER_SIZE);

                const sprite = tileNode.addComponent(Sprite);
                sprite.sizeMode = Sprite.SizeMode.CUSTOM;
                sprite.spriteFrame = this.getOrCreateFrame(visual);
            }
        }
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
