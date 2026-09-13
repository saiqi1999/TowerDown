import { type GridPoint } from '../navigation/NavigationTypes';
import { CombatPositionReservation } from './CombatPositionReservation';

export enum CombatPositionSide { Left = 0, Right = 1, Up = 2, Down = 3 }

export class CombatPositionResolver {
    constructor(private readonly reservations: CombatPositionReservation) {}
    public resolve(
        anchor: GridPoint,
        combatantId: string,
        preferredDistance: number,
        side: CombatPositionSide = CombatPositionSide.Left,
    ): GridPoint {
        const offsets: Record<CombatPositionSide, GridPoint> = {
            [CombatPositionSide.Left]: { x: -preferredDistance, y: 0 },
            [CombatPositionSide.Right]: { x: preferredDistance, y: 0 },
            [CombatPositionSide.Up]: { x: 0, y: -preferredDistance },
            [CombatPositionSide.Down]: { x: 0, y: preferredDistance },
        };
        const order = [
            side,
            CombatPositionSide.Left,
            CombatPositionSide.Right,
            CombatPositionSide.Up,
            CombatPositionSide.Down,
        ];
        const candidates = order
            .filter((candidate, index) => order.indexOf(candidate) === index)
            .map((candidate) => ({
                x: anchor.x + offsets[candidate].x,
                y: anchor.y + offsets[candidate].y,
            }));
        for (const candidate of candidates) if (this.reservations.reserve(combatantId, candidate)) return candidate;
        return anchor;
    }
}
