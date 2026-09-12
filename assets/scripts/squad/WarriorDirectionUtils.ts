import { WarriorDirection } from './WarriorSpriteConfig';

// Walk 与 Attack 过去各自维护方向判定时，极易在 Grid 方向语义上再次分叉。
// 这里收敛到一个工具函数，保证“朝哪边走”和“朝哪边攻击”共享同一历史约定。
export function resolveWarriorDirection(
    dx: number,
    dy: number,
    fallback = WarriorDirection.Down,
): WarriorDirection {
    if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) {
        return fallback;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
        return dx < 0
            ? WarriorDirection.Left
            : WarriorDirection.Right;
    }

    return dy < 0
        ? WarriorDirection.Up
        : WarriorDirection.Down;
}
