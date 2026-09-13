import { Rect, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';

export enum HealthBarPart {
    Top = 0,
    Bottom = 1,
    Left = 2,
    Right = 3,
    Fill = 4,
}

const PART_RECTS: Record<HealthBarPart, Rect> = {
    [HealthBarPart.Top]: new Rect(1, 0, 16, 1),
    [HealthBarPart.Bottom]: new Rect(1, 3, 16, 1),
    [HealthBarPart.Left]: new Rect(0, 1, 1, 2),
    [HealthBarPart.Right]: new Rect(17, 1, 1, 2),
    [HealthBarPart.Fill]: new Rect(1, 1, 16, 2),
};

export function createHealthBarFrame(
    texture: Texture2D,
    part: HealthBarPart,
): SpriteFrame {
    const rect = PART_RECTS[part];
    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = new Rect(rect.x, rect.y, rect.width, rect.height);
    frame.originalSize = new Size(rect.width, rect.height);
    frame.offset = new Vec2(0, 0);
    frame.rotated = false;
    return frame;
}
