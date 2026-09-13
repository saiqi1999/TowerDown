import { Rect, Size, SpriteFrame, Texture2D, Vec2 } from 'cc';

export enum MonsterDirection { Down = 0, Up = 1, Left = 2, Right = 3 }
export const MONSTER_FRAME_SIZE = 16;
export const MONSTER_FRAME_COUNT = 4;
export type MonsterFrameSet = Record<MonsterDirection, SpriteFrame[]>;

export function createMonsterFrame(texture: Texture2D, direction: MonsterDirection, frame: number): SpriteFrame {
    const spriteFrame = new SpriteFrame();
    const rect = new Rect(direction * MONSTER_FRAME_SIZE, frame * MONSTER_FRAME_SIZE, MONSTER_FRAME_SIZE, MONSTER_FRAME_SIZE);
    spriteFrame.texture = texture;
    spriteFrame.rect = rect;
    spriteFrame.originalSize = new Size(MONSTER_FRAME_SIZE, MONSTER_FRAME_SIZE);
    spriteFrame.offset = new Vec2(0, 0);
    spriteFrame.rotated = false;
    return spriteFrame;
}
