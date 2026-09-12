import {
    Rect,
    Size,
    SpriteFrame,
    Texture2D,
    Vec2,
} from 'cc';

export const TARGET_FLAG_FRAME_SIZE = 16;
export const TARGET_FLAG_FRAME_COUNT = 4;

export function createTargetFlagFrames(texture: Texture2D): SpriteFrame[] {
    const frames: SpriteFrame[] = [];

    for (let frameIndex = 0; frameIndex < TARGET_FLAG_FRAME_COUNT; frameIndex += 1) {
        const rect = new Rect(
            frameIndex * TARGET_FLAG_FRAME_SIZE,
            0,
            TARGET_FLAG_FRAME_SIZE,
            TARGET_FLAG_FRAME_SIZE,
        );

        const frame = new SpriteFrame();
        frame.texture = texture;
        frame.rect = rect;
        frame.originalSize = new Size(rect.width, rect.height);
        frame.offset = new Vec2(0, 0);
        frame.rotated = false;
        frames.push(frame);
    }

    return frames;
}
