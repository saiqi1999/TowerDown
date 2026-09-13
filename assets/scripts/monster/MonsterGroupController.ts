import { type GridPoint } from '../navigation/NavigationTypes';
import { CombatEncounter, CombatEncounterState } from '../combat/CombatEncounter';
import { type MonsterGroupData } from './MonsterTypes';

export enum MonsterGroupState { Guarding = 0, Engaged = 1, Returning = 2, Defeated = 3 }

export class MonsterGroupController {
    private state = MonsterGroupState.Guarding;
    private encounter: CombatEncounter | null = null;
    constructor(public readonly data: MonsterGroupData, private readonly guardCenter: GridPoint) {}
    public getState(): MonsterGroupState { return this.state; }
    public getGuardCenter(): GridPoint { return { ...this.guardCenter }; }
    public getEncounter(): CombatEncounter | null { return this.encounter; }
    public canEngage(squadPosition: GridPoint): boolean {
        if (this.state === MonsterGroupState.Defeated) return false;
        return Math.hypot(squadPosition.x - this.guardCenter.x, squadPosition.y - this.guardCenter.y)
            <= this.data.engageRadiusCells;
    }
    public activate(encounter: CombatEncounter): boolean {
        if (this.state === MonsterGroupState.Defeated) return false;
        this.encounter = encounter;
        this.state = MonsterGroupState.Engaged;
        encounter.subscribeState((state) => {
            if (state === CombatEncounterState.Victory) this.state = MonsterGroupState.Defeated;
            else if (state === CombatEncounterState.Retreating) this.state = MonsterGroupState.Returning;
        });
        return true;
    }
    public isWithinLeash(position: GridPoint): boolean {
        return Math.hypot(position.x - this.guardCenter.x, position.y - this.guardCenter.y)
            <= this.data.leashRadiusCells;
    }
    public retreat(): void {
        this.encounter?.retreat();
        if (this.state !== MonsterGroupState.Defeated) this.state = MonsterGroupState.Returning;
    }
}
