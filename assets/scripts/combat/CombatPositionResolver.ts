import { type GridPoint } from '../navigation/NavigationTypes';
import { CombatPositionReservation } from './CombatPositionReservation';

export class CombatPositionResolver {
    constructor(private readonly reservations: CombatPositionReservation) {}
    public resolve(anchor: GridPoint, combatantId: string, preferredDistance: number): GridPoint {
        const candidates = [
            { x: anchor.x - preferredDistance, y: anchor.y },
            { x: anchor.x + preferredDistance, y: anchor.y },
            { x: anchor.x, y: anchor.y - preferredDistance },
            { x: anchor.x, y: anchor.y + preferredDistance },
        ];
        for (const candidate of candidates) if (this.reservations.reserve(combatantId, candidate)) return candidate;
        return anchor;
    }
}
