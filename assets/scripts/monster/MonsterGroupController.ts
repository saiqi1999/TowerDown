import { Component, _decorator } from 'cc';
import { distance } from '../combat/CombatMath';
import { type CombatUnitRef } from '../combat/CombatUnitTypes';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type SquadCombatController } from '../squad/SquadCombatController';
import { type MonsterCombatController } from './MonsterCombatController';
import { type MonsterGroupData } from './MonsterTypes';

const { ccclass } = _decorator;
export enum MonsterGroupState { Guarding = 0, Engaged = 1, Returning = 2, Defeated = 3 }
export enum GuardParticipantState { Active = 0, Retreating = 1 }
interface Participant { squadId: string; combat: SquadCombatController; state: GuardParticipantState; }

@ccclass('MonsterGroupController')
export class MonsterGroupController extends Component {
    public data!: MonsterGroupData;
    private guardCenter: GridPoint = { x: 0, y: 0 };
    private state = MonsterGroupState.Guarding;
    private readonly participants = new Map<string, Participant>();
    private readonly monsters = new Map<string, MonsterCombatController>();
    private readonly warriorClaims = new Map<string, string>();
    private readonly monsterClaims = new Map<string, string>();

    public setup(data: MonsterGroupData, guardCenter: GridPoint): void { this.data = data; this.guardCenter = { ...guardCenter }; this.state = MonsterGroupState.Guarding; }
    public getState(): MonsterGroupState { return this.state; }
    public canEngage(position: GridPoint): boolean { return this.state !== MonsterGroupState.Defeated && distance(position, this.guardCenter) <= this.data.engageRadiusCells; }
    public addMonster(id: string, controller: MonsterCombatController): void { this.monsters.set(id, controller); }
    public getAliveMonsters(): readonly MonsterCombatController[] { return [...this.monsters.values()].filter((monster) => monster.isAlive()); }
    public engageSquad(squadId: string, combat: SquadCombatController): void {
        if (this.state === MonsterGroupState.Defeated) return;
        this.participants.set(squadId, { squadId, combat, state: GuardParticipantState.Active }); this.state = MonsterGroupState.Engaged;
        for (const monster of this.getAliveMonsters()) monster.activateGuardCombat(this);
    }
    public markSquadRetreating(squadId: string): void { const participant = this.participants.get(squadId); if (participant) participant.state = GuardParticipantState.Retreating; }
    public isWarriorTargetable(warriorId: string): boolean { for (const participant of this.participants.values()) if (participant.state === GuardParticipantState.Active && participant.combat.hasWarrior(warriorId)) return true; return false; }
    public acquireWarriorTarget(_monsterId: string, position: GridPoint): CombatUnitRef | null { return this.rankTarget(this.getWarriors().filter((warrior) => warrior.isAlive() && this.isWarriorTargetable(warrior.id)), position, this.monsterClaims); }
    public acquireMonsterTarget(_warriorId: string, position: GridPoint): CombatUnitRef | null { return this.rankTarget(this.getAliveMonsters(), position, this.warriorClaims); }
    public claimWarriorTarget(warriorId: string, monsterId: string): void { this.warriorClaims.set(warriorId, monsterId); }
    public claimMonsterTarget(monsterId: string, warriorId: string): void { this.monsterClaims.set(monsterId, warriorId); }
    public releaseWarriorTarget(warriorId: string, monsterId?: string): void { if (!monsterId || this.warriorClaims.get(warriorId) === monsterId) this.warriorClaims.delete(warriorId); }
    public releaseMonsterTarget(monsterId: string, warriorId?: string): void { if (!warriorId || this.monsterClaims.get(monsterId) === warriorId) this.monsterClaims.delete(monsterId); }
    // public notifyMonsterDeath(monsterId: string): void {
    //     this.monsterClaims.delete(monsterId); for (const [warriorId, claimed] of this.warriorClaims) if (claimed === monsterId) this.warriorClaims.delete(warriorId);
    //     if (this.getAliveMonsters().length === 0) { this.state = MonsterGroupState.Defeated; for (const participant of this.participants.values()) participant.combat.onGuardDefeated(); }
    // }
    public notifyMonsterDeath(monsterId: string): void {
    // 清掉这只 Monster 自己的攻击目标
    this.monsterClaims.delete(monsterId);

    // 清掉所有 Warrior 对这只 Monster 的 claim
    for (const [warriorId, claimedMonsterId] of this.warriorClaims) {
        if (claimedMonsterId === monsterId) {
            this.warriorClaims.delete(warriorId);
        }
    }

    // 从当前存活 Monster 集合移除
    this.monsters.delete(monsterId);

    // 还有活怪，战斗继续
    if (this.monsters.size > 0) {
        return;
    }

    // 全灭
    this.state = MonsterGroupState.Defeated;

    for (const participant of this.participants.values()) {
        participant.combat.onGuardDefeated();
    }
    }
    public update(): void {
        if (this.state === MonsterGroupState.Defeated) return;
        for (const participant of [...this.participants.values()]) {
            if (participant.state === GuardParticipantState.Retreating && distance(participant.combat.getSquadPosition(), this.getGuardCenter()) > this.data.leashRadiusCells) {
                participant.combat.detachFromGuard(); this.releaseParticipantClaims(participant); this.participants.delete(participant.squadId);
            }
        }
        if (this.participants.size === 0 && this.state === MonsterGroupState.Engaged) { this.state = MonsterGroupState.Returning; for (const monster of this.getAliveMonsters()) monster.returnToGuard(); }
        if (this.state === MonsterGroupState.Returning && this.getAliveMonsters().every((monster) => monster.getCombatState() === 0 || !monster.isAlive())) this.state = MonsterGroupState.Guarding;
    }
    public getGuardCenter(): GridPoint { return { ...this.guardCenter }; }
    private releaseParticipantClaims(participant: Participant): void {
        for (const warrior of participant.combat.getWarriorIds()) this.warriorClaims.delete(warrior);
        for (const [monster, warrior] of this.monsterClaims) if (participant.combat.hasWarrior(warrior)) this.monsterClaims.delete(monster);
    }
    private getWarriors(): CombatUnitRef[] { const result: CombatUnitRef[] = []; for (const participant of this.participants.values()) result.push(...participant.combat.getWarriorRefs()); return result; }
    private rankTarget<T extends CombatUnitRef>(candidates: readonly T[], position: GridPoint, claims: Map<string, string>): T | null {
        return [...candidates].sort((a, b) => [...claims.values()].filter((id) => id === a.id).length - [...claims.values()].filter((id) => id === b.id).length || distance(position, a.getWorldGridPosition()) - distance(position, b.getWorldGridPosition()))[0] ?? null;
    }
}
