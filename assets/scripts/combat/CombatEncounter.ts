import { CombatEventHub } from './CombatEventHub';
import { type AttackImpactResult } from './CombatTypes';
import { CombatPositionReservation } from './CombatPositionReservation';
import { CombatPositionResolver, CombatPositionSide } from './CombatPositionResolver';
import { type CombatantAdapter, type CombatEncounterLike } from './CombatantTypes';
import { type GridPoint } from '../navigation/NavigationTypes';

export enum CombatEncounterState { Active = 0, Retreating = 1, Victory = 2, Closed = 3 }

export class CombatEncounter implements CombatEncounterLike {
    private readonly combatants = new Map<string, CombatantAdapter>();
    private state = CombatEncounterState.Active;
    private readonly stateListeners = new Set<(state: CombatEncounterState) => void>();
    public readonly reservations = new CombatPositionReservation();
    private readonly positionResolver = new CombatPositionResolver(this.reservations);
    private readonly targetByCombatant = new Map<string, string>();
    constructor(public readonly id: string, private readonly hub: CombatEventHub) {}
    public addCombatant(combatant: CombatantAdapter): void { if (this.state === CombatEncounterState.Active) this.combatants.set(combatant.id, combatant); }
    public getCombatants(): readonly CombatantAdapter[] { return [...this.combatants.values()]; }
    public getCombatant(id: string): CombatantAdapter | null { return this.combatants.get(id) ?? null; }
    public getReservedCombatPosition(combatantId: string): GridPoint | null {
        return this.reservations.get(combatantId);
    }
    public getState(): CombatEncounterState { return this.state; }
    public subscribeState(listener: (state: CombatEncounterState) => void): () => void {
        this.stateListeners.add(listener);
        listener(this.state);
        return () => this.stateListeners.delete(listener);
    }
    public retreat(): void {
        if (this.state === CombatEncounterState.Active) {
            this.setState(CombatEncounterState.Retreating);
            this.reservations.releaseAll();
            this.targetByCombatant.clear();
        }
    }
    public close(): void {
        this.setState(CombatEncounterState.Closed);
        this.reservations.releaseAll();
        this.targetByCombatant.clear();
    }
    public emitDamage(attackerId: string, targetId: string, damage: number): AttackImpactResult | null {
        return this.hub.emitAttackImpact({ attackerId, targetId, damage });
    }
    public update(dt: number): void {
        if (this.state !== CombatEncounterState.Active) return;
        for (const combatant of this.combatants.values()) {
            if (!combatant.isAlive()) {
                this.reservations.release(combatant.id);
                this.targetByCombatant.delete(combatant.id);
                continue;
            }
            const target = combatant.getCombatTarget?.() ?? null;
            if (target && this.combatants.get(target)?.isAlive()) continue;
            const candidate = [...this.combatants.values()]
                .filter((other) => other.team !== combatant.team && other.isAlive())
                .sort((a, b) => this.distance(combatant, a) - this.distance(combatant, b))[0];
            const oldTarget = this.targetByCombatant.get(combatant.id);
            if (oldTarget) this.reservations.release(combatant.id);
            combatant.setCombatTarget(candidate?.id ?? null);
            this.targetByCombatant.delete(combatant.id);
            if (candidate) {
                const position = this.positionResolver.resolve(
                    candidate.getPosition(),
                    combatant.id,
                    combatant.getPreferredCombatDistanceCells(),
                    this.resolveSide(combatant, candidate),
                );
                combatant.setCombatPosition(position);
                this.targetByCombatant.set(combatant.id, candidate.id);
            }
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
    private resolveSide(attacker: CombatantAdapter, target: CombatantAdapter): CombatPositionSide {
        const attackerPosition = attacker.getPosition();
        const targetPosition = target.getPosition();
        if (Math.abs(attackerPosition.x - targetPosition.x) >= Math.abs(attackerPosition.y - targetPosition.y)) {
            return attackerPosition.x <= targetPosition.x
                ? CombatPositionSide.Left
                : CombatPositionSide.Right;
        }
        return attackerPosition.y <= targetPosition.y
            ? CombatPositionSide.Up
            : CombatPositionSide.Down;
    }
    private setState(state: CombatEncounterState): void {
        if (this.state === state) return;
        this.state = state;
        for (const listener of this.stateListeners) listener(state);
    }
}
