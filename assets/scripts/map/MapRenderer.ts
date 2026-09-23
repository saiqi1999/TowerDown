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
        for (const child of [...this.tileRoot.children]) {
            child.removeFromParent();
            child.destroy();
        }
    }

    public render(map: TerrainMap): void {
        this.clear();

        const rows = map.length;
        const columns = map[0]?.length ?? 0;

        if (rows === 0 || columns === 0) return;

        this.renderPitBoundary(columns, rows);
        for (let y = 0; y < rows; y += 1) {
            for (let x = 0; x < columns; x += 1) {
                this.createTile(
                    this.resolver.resolve(map, x, y),
                    x, y, columns, rows, 'Tile',
                );
            }
        }
    }

    private createTile(
        visual: TileVisual,
        x: number,
        y: number,
        columns: number,
        rows: number,
        prefix: string,
    ): void {
        const tileNode = new Node(`${prefix}_${x}_${y}`);
        tileNode.setParent(this.tileRoot);
        tileNode.layer = this.tileRoot.layer;
        tileNode.setPosition(gridCellToWorldCenter(x, y, columns, rows));

        const transform = tileNode.addComponent(UITransform);
        transform.setContentSize(GRID_RENDER_SIZE, GRID_RENDER_SIZE);

        const sprite = tileNode.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.getOrCreateFrame(visual);
    }

    private renderPitBoundary(columns: number, rows: number): void {
        const put = (visual: TileVisual, x: number, y: number): void => {
            this.createTile(visual, x, y, columns, rows, 'Pit');
        };

        // Far wall faces into the pit; the near edge only exposes its rim.
        for (let x = 0; x < columns; x += 1) {
            put(TileVisual.PitNorthWallUpper, x, -2);
            put(TileVisual.PitNorthWallLower, x, -1);
            put(TileVisual.PitSouthRim, x, rows);
        }
        for (let y = 0; y < rows; y += 1) {
            put(TileVisual.PitWestRim, -1, y);
            put(TileVisual.PitEastRim, columns, y);
        }

        // Dedicated concave corners occupy these cells, not straight rims.
        put(TileVisual.PitNorthWestUpper, -1, -2);
        put(TileVisual.PitNorthWestLower, -1, -1);
        put(TileVisual.PitNorthEastUpper, columns, -2);
        put(TileVisual.PitNorthEastLower, columns, -1);
        put(TileVisual.PitSouthWest, -1, rows);
        put(TileVisual.PitSouthEast, columns, rows);
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
