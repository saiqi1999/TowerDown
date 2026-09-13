import { CombatEventHub } from './CombatEventHub';
import { CombatEncounter } from './CombatEncounter';

export class CombatEncounterManager {
    private readonly encounters = new Map<string, CombatEncounter>();
    constructor(private readonly hub: CombatEventHub) {}
    public create(id: string): CombatEncounter {
        const existing = this.encounters.get(id);
        if (existing) return existing;
        const encounter = new CombatEncounter(id, this.hub);
        this.encounters.set(id, encounter);
        return encounter;
    }
    public get(id: string): CombatEncounter | null { return this.encounters.get(id) ?? null; }
    public update(dt: number): void { for (const encounter of this.encounters.values()) encounter.update(dt); }
}
