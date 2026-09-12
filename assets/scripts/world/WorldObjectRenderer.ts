import {
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
} from 'cc';
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
import { WorldObjectView } from './WorldObjectView';

export class WorldObjectRenderer {
    private readonly frameCache = new Map<WorldVisualId, SpriteFrame>();

    constructor(
        private readonly structureRoot: Node,
        private readonly resourceRoot: Node,
        private readonly buildingTexture: Texture2D,
        private readonly natureTexture: Texture2D,
    ) {}

    public clear(): void {
        this.structureRoot.removeAllChildren();
        this.resourceRoot.removeAllChildren();
    }

    public render(objects: WorldObjectData[], mapWidth: number, mapHeight: number): void {
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
        }

        console.log(`[WorldObjectRenderer] rendered ${objects.length} world objects.`);
    }

    private validateObjects(objects: WorldObjectData[], mapWidth: number, mapHeight: number): void {
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
}
