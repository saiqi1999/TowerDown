import { Component, _decorator } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { distance, moveTargetAtDistance, resolveFacing } from '../combat/CombatMath';
import { type CombatUnitRef } from '../combat/CombatUnitTypes';
import { CombatStats } from '../combat/CombatStats';
import { HealthComponent } from '../combat/HealthComponent';
import { type MonsterGroupController } from '../monster/MonsterGroupController';
import { SquadMotor } from './SquadMotor';
import { WarriorAnimator } from './WarriorAnimator';
import { WarriorMotor } from './WarriorMotor';

const { ccclass } = _decorator;
export enum WarriorCombatState { Inactive = 0, AcquiringTarget = 1, Approaching = 2, Attacking = 3, Dead = 4 }

@ccclass('WarriorCombatController')
export class WarriorCombatController extends Component implements CombatUnitRef {
    public readonly team = 'squad' as const;
    private group: MonsterGroupController | null = null;
    private target: CombatUnitRef | null = null;
    private state = WarriorCombatState.Inactive;
    private impactUnsubscribe: (() => void) | null = null;
    private health!: HealthComponent;
    private stats!: CombatStats;
    private motor!: WarriorMotor;
    private squadMotor!: SquadMotor;
    private animator!: WarriorAnimator;
    private hub!: CombatEventHub;
    private unitId = '';

    public setup(config: { unitId: string; squadMotor: SquadMotor; motor: WarriorMotor; animator: WarriorAnimator; health: HealthComponent; stats: CombatStats; hub: CombatEventHub }): void {
        this.unitId = config.unitId; this.squadMotor = config.squadMotor; this.motor = config.motor; this.animator = config.animator; this.health = config.health; this.stats = config.stats; this.hub = config.hub;
        this.impactUnsubscribe?.();
        this.impactUnsubscribe = this.animator.subscribeAttackImpact(() => this.onImpact());
        this.health.subscribe((_current, _max, result) => { if (result?.becameDepleted) this.die(); });
    }
    public get id(): string { return this.unitId; }
    public isAlive(): boolean { return !this.health.isDepleted(); }
    public getWorldGridPosition() { return this.motor.getWorldGridPosition(this.squadMotor.getGridPosition()); }
    public enterGuardCombat(group: MonsterGroupController): void { if (!this.isAlive()) return; this.group = group; this.target = null; this.state = WarriorCombatState.AcquiringTarget; }
    public exitCombat(): void { this.releaseTarget(); this.motor.stop(); this.animator.playIdle(); this.state = this.isAlive() ? WarriorCombatState.Inactive : WarriorCombatState.Dead; this.group = null; }
    public getCombatState(): WarriorCombatState { return this.state; }
    // public update(dt: number): void {
    //     if (!this.isAlive() || !this.group || this.state === WarriorCombatState.Inactive || this.state === WarriorCombatState.Dead) return;
    //     if (!this.target || !this.target.isAlive()) {
    //         this.releaseTarget();
    //         const next = this.group.acquireMonsterTarget(this.id, this.getWorldGridPosition());
    //         if (!next) { this.state = WarriorCombatState.AcquiringTarget; return; }
    //         this.target = next; this.group.claimWarriorTarget(this.id, next.id); this.state = WarriorCombatState.Approaching;
    //     }
    //     const current = this.getWorldGridPosition();
    //     const targetPosition = this.target.getWorldGridPosition();
    //     const currentDistance = distance(current, targetPosition);
    //     const attackRange = this.stats.getAttackRangeCells();
    //     if (currentDistance <= attackRange) {
    //         this.motor.stop(); this.animator.playAttack(resolveFacing(current, targetPosition)); this.state = WarriorCombatState.Attacking;
    //     } else if (this.state !== WarriorCombatState.Attacking || currentDistance > attackRange + 0.1) {
    //         const desired = moveTargetAtDistance(current, targetPosition, this.stats.getPreferredCombatDistanceCells());
    //         const squadPosition = this.squadMotor.getGridPosition();
    //         this.motor.moveToLocalGridOffset({ x: desired.x - squadPosition.x, y: desired.y - squadPosition.y });
    //         this.state = WarriorCombatState.Approaching;
    //     }
    //     void dt;
    // }
    update(dt: number): void {
    if (
        !this.isAlive()
        || !this.group
        || this.state === WarriorCombatState.Inactive
        || this.state === WarriorCombatState.Dead
    ) {
        return;
    }

    // 1. Target 不存在或死亡 → 重新找最近目标
    if (!this.target || !this.target.isAlive()) {
        this.releaseTarget();

        const next = this.group.acquireMonsterTarget(
            this.id,
            this.getWorldGridPosition(),
        );

        if (!next) {
            this.state = WarriorCombatState.AcquiringTarget;
            return;
        }

        this.target = next;
        this.state = WarriorCombatState.Approaching;
    }

    const current = this.getWorldGridPosition();
    const targetPosition = this.target.getWorldGridPosition();
    const currentDistance = distance(current, targetPosition);

    const attackRange = this.stats.getAttackRangeCells();
    const attackExitRange = attackRange + 0.1;

    // 2. Attack hysteresis
    const shouldAttack =
        this.state === WarriorCombatState.Attacking
            ? currentDistance <= attackExitRange
            : currentDistance <= attackRange;

    if (shouldAttack) {
        const direction = resolveFacing(
            current,
            targetPosition,
        );

        // 只在第一次进入 Attack 时 stop
        if (this.state !== WarriorCombatState.Attacking) {
            this.motor.stop();
            this.state = WarriorCombatState.Attacking;
        }

        // 已经 Attack 时不会重新开始动画，
        // 一轮攻击结束后会自动开启下一轮
        this.animator.playAttack(direction);
        return;
    }

    // 3. 不在攻击距离 → 追目标
    const desired = moveTargetAtDistance(
        current,
        targetPosition,
        this.stats.getPreferredCombatDistanceCells(),
    );

    const squadPosition =
        this.squadMotor.getGridPosition();

    this.motor.moveToLocalGridOffset({
        x: desired.x - squadPosition.x,
        y: desired.y - squadPosition.y,
    });

    this.state = WarriorCombatState.Approaching;

    void dt;
}
    private releaseTarget(): void { if (this.target && this.group) this.group.releaseWarriorTarget(this.id, this.target.id); this.target = null; }
    private die(): void { this.releaseTarget(); this.motor.stop(); this.animator.playIdle(); this.state = WarriorCombatState.Dead; }
    private onImpact(): void {
        if (this.state !== WarriorCombatState.Attacking || !this.target) return;
        if (distance(this.getWorldGridPosition(), this.target.getWorldGridPosition()) <= this.stats.getAttackRangeCells() + 0.08) {
            this.hub.emitAttackImpact({ attackerId: this.id, targetId: this.target.id, damage: this.stats.getAttackDamage() });
        }
    }
    onDestroy(): void { this.impactUnsubscribe?.(); }
}
