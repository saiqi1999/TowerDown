import { CombatEventHub } from './CombatEventHub';
import { type AttackImpactResult } from './CombatTypes';
import { CombatPositionReservation } from './CombatPositionReservation';
import { type CombatantAdapter, type CombatEncounterLike } from './CombatantTypes';

export enum CombatEncounterState { Active = 0, Retreating = 1, Victory = 2, Closed = 3 }

export class CombatEncounter implements CombatEncounterLike {
    private readonly combatants = new Map<string, CombatantAdapter>();
    private state = CombatEncounterState.Active;
    public readonly reservations = new CombatPositionReservation();
    constructor(public readonly id: string, private readonly hub: CombatEventHub) {}
    public addCombatant(combatant: CombatantAdapter): void { if (this.state === CombatEncounterState.Active) this.combatants.set(combatant.id, combatant); }
    public getCombatant(id: string): CombatantAdapter | null { return this.combatants.get(id) ?? null; }
    public getState(): CombatEncounterState { return this.state; }
    public retreat(): void { if (this.state === CombatEncounterState.Active) this.state = CombatEncounterState.Retreating; }
    public close(): void { this.state = CombatEncounterState.Closed; this.reservations.releaseAll(); }
    public emitDamage(attackerId: string, targetId: string, damage: number): AttackImpactResult | null {
        return this.hub.emitAttackImpact({ attackerId, targetId, damage });
    }
    public update(dt: number): void {
        if (this.state !== CombatEncounterState.Active) return;
        for (const combatant of this.combatants.values()) if (combatant.isAlive()) combatant.updateCombat(dt, this);
        const monsters = [...this.combatants.values()].filter((c) => c.team === 'monster' && c.isAlive());
        const squads = [...this.combatants.values()].filter((c) => c.team === 'squad' && c.isAlive());
        if (monsters.length === 0) this.state = CombatEncounterState.Victory;
        else if (squads.length === 0) this.state = CombatEncounterState.Retreating;
    }
}
