import { CombatEventHub } from './CombatEventHub';
import { type AttackImpactResult } from './CombatTypes';
import { CombatPositionReservation } from './CombatPositionReservation';
import { type CombatantAdapter, type CombatEncounterLike } from './CombatantTypes';

export enum CombatEncounterState { Active = 0, Retreating = 1, Victory = 2, Closed = 3 }

export class CombatEncounter implements CombatEncounterLike {
    private readonly combatants = new Map<string, CombatantAdapter>();
    private state = CombatEncounterState.Active;
    private readonly stateListeners = new Set<(state: CombatEncounterState) => void>();
    public readonly reservations = new CombatPositionReservation();
    constructor(public readonly id: string, private readonly hub: CombatEventHub) {}
    public addCombatant(combatant: CombatantAdapter): void { if (this.state === CombatEncounterState.Active) this.combatants.set(combatant.id, combatant); }
    public getCombatants(): readonly CombatantAdapter[] { return [...this.combatants.values()]; }
    public getCombatant(id: string): CombatantAdapter | null { return this.combatants.get(id) ?? null; }
    public getState(): CombatEncounterState { return this.state; }
    public subscribeState(listener: (state: CombatEncounterState) => void): () => void {
        this.stateListeners.add(listener);
        listener(this.state);
        return () => this.stateListeners.delete(listener);
    }
    public retreat(): void {
        if (this.state === CombatEncounterState.Active) this.setState(CombatEncounterState.Retreating);
    }
    public close(): void { this.setState(CombatEncounterState.Closed); this.reservations.releaseAll(); }
    public emitDamage(attackerId: string, targetId: string, damage: number): AttackImpactResult | null {
        return this.hub.emitAttackImpact({ attackerId, targetId, damage });
    }
    public update(dt: number): void {
        if (this.state !== CombatEncounterState.Active) return;
        for (const combatant of this.combatants.values()) {
            if (!combatant.isAlive()) continue;
            const target = combatant.getCombatTarget?.() ?? null;
            if (target && this.combatants.get(target)?.isAlive()) continue;
            const candidate = [...this.combatants.values()]
                .filter((other) => other.team !== combatant.team && other.isAlive())
                .sort((a, b) => this.distance(combatant, a) - this.distance(combatant, b))[0];
            combatant.setCombatTarget(candidate?.id ?? null);
        }
        for (const combatant of this.combatants.values()) if (combatant.isAlive()) combatant.updateCombat(dt, this);
        const monsters = [...this.combatants.values()].filter((c) => c.team === 'monster' && c.isAlive());
        const squads = [...this.combatants.values()].filter((c) => c.team === 'squad' && c.isAlive());
        if (monsters.length === 0) this.setState(CombatEncounterState.Victory);
        else if (squads.length === 0) this.setState(CombatEncounterState.Retreating);
    }
    private distance(a: CombatantAdapter, b: CombatantAdapter): number {
        const ap = a.getPosition(); const bp = b.getPosition();
        return Math.hypot(ap.x - bp.x, ap.y - bp.y);
    }
    private setState(state: CombatEncounterState): void {
        if (this.state === state) return;
        this.state = state;
        for (const listener of this.stateListeners) listener(state);
    }
}
