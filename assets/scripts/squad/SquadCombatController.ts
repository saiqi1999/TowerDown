import { Component, _decorator } from 'cc';
import { type CombatUnitRef } from '../combat/CombatUnitTypes';
import { type MonsterGroupController } from '../monster/MonsterGroupController';
import { type GridPoint } from '../navigation/NavigationTypes';
import { WarriorCombatController } from './WarriorCombatController';
import { WarriorMotor } from './WarriorMotor';
import { SquadMotor } from './SquadMotor';

const { ccclass } = _decorator;
export enum SquadCombatState { Inactive = 0, Active = 1, Reforming = 2 }

@ccclass('SquadCombatController')
export class SquadCombatController extends Component {
    private squadId = '';
    private squadMotor!: SquadMotor;
    private warriors: WarriorCombatController[] = [];
    private currentGroup: MonsterGroupController | null = null;
    private state = SquadCombatState.Inactive;
    private guardDefeatedPending = false;

    public setup(squadId: string, squadMotor: SquadMotor, warriorControllers: WarriorCombatController[]): void {
        this.squadId = squadId; this.squadMotor = squadMotor; this.warriors = warriorControllers; this.state = SquadCombatState.Inactive;
    }
    public addWarrior(warrior: WarriorCombatController): void {
        if (this.warriors.indexOf(warrior) < 0) {
            this.warriors.push(warrior);
        }
    }
    public beginGuardCombat(group: MonsterGroupController): void {
        this.currentGroup = group; this.guardDefeatedPending = false; this.state = SquadCombatState.Active;
        group.engageSquad(this.squadId, this);
        for (const warrior of this.warriors) warrior.enterGuardCombat(group);
    }
    public requestRetreat(): void {
        this.currentGroup?.markSquadRetreating(this.squadId);
        for (const warrior of this.warriors) warrior.exitCombat();
        this.state = SquadCombatState.Reforming;
        for (const warrior of this.warriors) warrior.getComponent(WarriorMotor)?.returnToFormation();
    }
    public onGuardDefeated(): void { this.guardDefeatedPending = true; this.requestRetreat(); }
    public detachFromGuard(): void { this.currentGroup = null; this.state = SquadCombatState.Inactive; }
    public resetForFloor(): void {
        this.currentGroup?.markSquadRetreating(this.squadId);
        this.currentGroup = null;
        this.guardDefeatedPending = false;
        for (const warrior of this.warriors) warrior.resetForFloor();
        this.state = SquadCombatState.Inactive;
    }
    public getSquadPosition(): GridPoint { return this.squadMotor.getGridPosition(); }
    public getWarriorIds(): readonly string[] { return this.warriors.map((warrior) => warrior.id); }
    public hasWarrior(id: string): boolean { return this.warriors.some((warrior) => warrior.id === id); }
    public getWarriorRefs(): readonly CombatUnitRef[] { return this.warriors; }
    public consumeGuardDefeated(): boolean { const value = this.guardDefeatedPending; this.guardDefeatedPending = false; return value; }
    public isInactive(): boolean { return this.state === SquadCombatState.Inactive; }
    update(): void {
        if (this.state === SquadCombatState.Reforming && this.warriors.every((warrior) => !warrior.isAlive() || !warrior.getComponent(WarriorMotor)?.isMoving())) {
            this.state = SquadCombatState.Inactive;
        }
    }
}
