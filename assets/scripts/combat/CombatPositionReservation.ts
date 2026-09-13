import { type GridPoint } from '../navigation/NavigationTypes';

export class CombatPositionReservation {
    private readonly positions = new Map<string, GridPoint>();
    public reserve(combatantId: string, position: GridPoint): boolean {
        for (const [id, current] of this.positions) {
            if (id !== combatantId && Math.hypot(current.x - position.x, current.y - position.y) < 0.2) return false;
        }
        this.positions.set(combatantId, { ...position });
        return true;
    }
    public release(combatantId: string): void { this.positions.delete(combatantId); }
    public releaseAll(): void { this.positions.clear(); }
    public get(combatantId: string): GridPoint | null { const p = this.positions.get(combatantId); return p ? { ...p } : null; }
}
