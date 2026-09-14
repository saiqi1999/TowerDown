/**
 * Why this file exists:
 * BuildBar、Ghost 和正式建筑必须使用同一套 Building Atlas 裁图规则。
 *
 * Ownership boundary:
 * 本文件只负责 definition visual 到缓存 SpriteFrame 的转换。
 *
 * This file deliberately does NOT:
 * 不创建 Node、不做放置校验、不处理资源和工具状态。
 */
import { Rect, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';
import { GRID_SOURCE_SIZE } from '../grid/GridConfig';
import { type BuildingDefinition } from './BuildingTypes';
import { BuildingVisualLibrary } from './BuildingVisualLibrary';
export class BuildingSpriteFrameFactory {
    private readonly cache = new Map<string, SpriteFrame>();
    constructor(
        private readonly texture: Texture2D,
        private readonly visualLibrary: BuildingVisualLibrary | null = null,
    ) {}
    public getFrame(definition: BuildingDefinition): SpriteFrame {
        const cached = this.cache.get(definition.id); if (cached) return cached;
        const standaloneFrame = this.visualLibrary?.getFrame(definition.id);
        const frame = standaloneFrame ?? new SpriteFrame();
        if (!standaloneFrame) {
            frame.texture = this.texture;
            frame.rect = new Rect(definition.visual.col * GRID_SOURCE_SIZE, definition.visual.row * GRID_SOURCE_SIZE, definition.visual.w * GRID_SOURCE_SIZE, definition.visual.h * GRID_SOURCE_SIZE);
            frame.originalSize = new Size(frame.rect.width, frame.rect.height);
            frame.offset = new Vec2(0, 0); frame.rotated = false;
        }
        this.cache.set(definition.id, frame);
        return frame;
    }
}
