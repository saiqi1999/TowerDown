import {
    Rect,
    Size,
    SpriteFrame,
    Texture2D,
    Vec2,
} from 'cc';

export enum WarriorDirection {
    Down = 0,
    Up = 1,
    Left = 2,
    Right = 3,
}

export type WarriorFrameSet = Record<WarriorDirection, SpriteFrame[]>;

export const WARRIOR_TEXTURE_UUID = '124985db-a3b8-41df-825f-03d735f0c02c@6c48a';
export const WARRIOR_FRAME_SIZE = 16;
export const WARRIOR_WALK_FRAME_COUNT = 4;
export const WARRIOR_ATTACK_FRAME_COUNT = 4;

const DIRECTION_COLUMN: Record<WarriorDirection, number> = {
    [WarriorDirection.Down]: 0,
    [WarriorDirection.Up]: 1,
    [WarriorDirection.Left]: 2,
    [WarriorDirection.Right]: 3,
};

export function createWarriorFrame(
    texture: Texture2D,
    direction: WarriorDirection,
    frameIndex: number,
): SpriteFrame {
    const column = DIRECTION_COLUMN[direction];
    const rect = new Rect(
        column * WARRIOR_FRAME_SIZE,
        frameIndex * WARRIOR_FRAME_SIZE,
        WARRIOR_FRAME_SIZE,
        WARRIOR_FRAME_SIZE,
    );

    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = rect;
    frame.originalSize = new Size(rect.width, rect.height);
    frame.offset = new Vec2(0, 0);
    frame.rotated = false;
    return frame;
}

export function createWarriorAttackFrame(
    texture: Texture2D,
    frameIndex: number,
): SpriteFrame {
    const rect = new Rect(
        frameIndex * WARRIOR_FRAME_SIZE,
        0,
        WARRIOR_FRAME_SIZE,
        WARRIOR_FRAME_SIZE,
    );

    const frame = new SpriteFrame();
    frame.texture = texture;
    frame.rect = rect;
    frame.originalSize = new Size(rect.width, rect.height);
    frame.offset = new Vec2(0, 0);
    frame.rotated = false;
    return frame;
}
