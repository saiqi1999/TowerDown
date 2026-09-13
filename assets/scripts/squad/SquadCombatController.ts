import { CombatEncounter } from '../combat/CombatEncounter';
import { type CombatantAdapter } from '../combat/CombatantTypes';

export class SquadCombatController {
    private encounter: CombatEncounter | null = null;
    public begin(encounter: CombatEncounter, combatants: readonly CombatantAdapter[]): void {
        this.encounter = encounter;
        for (const combatant of combatants) encounter.addCombatant(combatant);
    }
    public retreat(): void { this.encounter?.retreat(); }
    public getEncounter(): CombatEncounter | null { return this.encounter; }
}
