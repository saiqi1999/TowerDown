import { type GridPoint } from '../navigation/NavigationTypes';
import { WarriorDirection } from '../squad/WarriorSpriteConfig';

export function distanceSquared(a: GridPoint, b: GridPoint): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
}
export function distance(a: GridPoint, b: GridPoint): number {
    return Math.sqrt(distanceSquared(a, b));
}
export function normalize(dx: number, dy: number): GridPoint {
    const length = Math.sqrt(dx * dx + dy * dy);
    return length < 0.001 ? { x: 0, y: 0 } : { x: dx / length, y: dy / length };
}
export function resolveFacing(from: GridPoint, to: GridPoint): WarriorDirection {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? WarriorDirection.Left : WarriorDirection.Right;
    return dy < 0 ? WarriorDirection.Up : WarriorDirection.Down;
}
export function moveTargetAtDistance(from: GridPoint, target: GridPoint, desiredDistance: number): GridPoint {
    const direction = normalize(target.x - from.x, target.y - from.y);
    if (direction.x === 0 && direction.y === 0) return { ...from };
    return {
        x: target.x - direction.x * desiredDistance,
        y: target.y - direction.y * desiredDistance,
    };
}
