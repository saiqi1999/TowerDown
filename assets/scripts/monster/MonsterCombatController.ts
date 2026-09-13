import { Component, _decorator } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { distance, moveTargetAtDistance, resolveFacing } from '../combat/CombatMath';
import { type CombatUnitRef } from '../combat/CombatUnitTypes';
import { CombatStats } from '../combat/CombatStats';
import { HealthComponent } from '../combat/HealthComponent';
import { type GridPoint } from '../navigation/NavigationTypes';
import { MonsterAnimator } from './MonsterAnimator';
import { MonsterDirection } from './MonsterSpriteConfig';
import { MonsterMotor } from './MonsterMotor';
import { type MonsterGroupController } from './MonsterGroupController';

const { ccclass } = _decorator;
export enum MonsterCombatState { GuardIdle = 0, AcquiringTarget = 1, Approaching = 2, Attacking = 3, Returning = 4, Dead = 5 }

@ccclass('MonsterCombatController')
export class MonsterCombatController extends Component implements CombatUnitRef {
    public readonly team = 'monster' as const;
    private group: MonsterGroupController | null = null;
    private target: CombatUnitRef | null = null;
    private state = MonsterCombatState.GuardIdle;
    private guardWorldPosition: GridPoint = { x: 0, y: 0 };
    private impactUnsubscribe: (() => void) | null = null;
    private health: HealthComponent | null = null;
    private stats: CombatStats | null = null;
    private animator: MonsterAnimator | null = null;
    private motor: MonsterMotor | null = null;
    private hub: CombatEventHub | null = null;
    private unitId = '';

    public setup(config: {
        unitId: string; guardWorldPosition: GridPoint; motor: MonsterMotor;
        animator: MonsterAnimator; health: HealthComponent; stats: CombatStats; hub: CombatEventHub;
    }): void {
        this.unitId = config.unitId; this.guardWorldPosition = { ...config.guardWorldPosition };
        this.motor = config.motor; this.animator = config.animator; this.health = config.health; this.stats = config.stats; this.hub = config.hub;
        this.impactUnsubscribe?.();
        this.impactUnsubscribe = this.animator.subscribeAttackImpact(() => this.onImpact());
        this.health.subscribe((_current, _max, result) => {
            if (result?.becameDepleted) this.die();
        });
    }
    public get id(): string { return this.unitId; }
    public isAlive(): boolean { return !(this.health?.isDepleted() ?? true); }
    public getWorldGridPosition(): GridPoint { return this.motor?.getGridPosition() ?? this.guardWorldPosition; }
    public activateGuardCombat(group: MonsterGroupController): void {
        if (!this.isAlive()) return;
        this.group = group; this.target = null; this.state = MonsterCombatState.AcquiringTarget;
    }
    public returnToGuard(): void {
        if (!this.isAlive()) return;
        this.target = null; this.state = MonsterCombatState.Returning; this.motor?.moveTo(this.guardWorldPosition);
    }
    public getCombatState(): MonsterCombatState { return this.state; }
    update(dt: number): void {
        if (!this.isAlive()) return;
        if (this.state === MonsterCombatState.Returning) {
            if (distance(this.getWorldGridPosition(), this.guardWorldPosition) <= 0.03) {
                this.motor?.stop(); this.animator?.playIdle(); this.state = MonsterCombatState.GuardIdle;
            }
            return;
        }
        if (this.state === MonsterCombatState.GuardIdle) return;
        if (!this.target || !this.target.isAlive() || !this.group?.isWarriorTargetable(this.target.id)) {
            this.releaseTarget();
            const next = this.group?.acquireWarriorTarget(this.id, this.getWorldGridPosition()) ?? null;
            if (!next) { this.state = MonsterCombatState.Returning; this.motor?.moveTo(this.guardWorldPosition); return; }
            this.target = next; this.group?.claimMonsterTarget(this.id, next.id); this.state = MonsterCombatState.Approaching;
        }
        const targetPosition = this.target.getWorldGridPosition();
        const current = this.getWorldGridPosition();
        const currentDistance = distance(current, targetPosition);
        const range = this.stats?.getAttackRangeCells() ?? 0.85;
        if (currentDistance <= range) {
            this.motor?.stop();
            this.animator?.playAttack(resolveFacing(current, targetPosition) as unknown as MonsterDirection);
            this.state = MonsterCombatState.Attacking;
        } else if (this.state !== MonsterCombatState.Attacking || currentDistance > range + 0.1) {
            this.motor?.moveTo(moveTargetAtDistance(current, targetPosition, this.stats?.getPreferredCombatDistanceCells() ?? 0.75));
            this.state = MonsterCombatState.Approaching;
        }
        void dt;
    }
    public exitCombat(): void { this.releaseTarget(); this.motor?.stop(); this.animator?.playIdle(); this.state = MonsterCombatState.GuardIdle; this.group = null; }
    private releaseTarget(): void { if (this.target) this.group?.releaseMonsterTarget(this.id, this.target.id); this.target = null; }
    private die(): void { this.releaseTarget(); this.motor?.stop(); this.animator?.playDead(); this.state = MonsterCombatState.Dead; this.group?.notifyMonsterDeath(this.id); }
    private onImpact(): void {
        if (this.state !== MonsterCombatState.Attacking || !this.target || !this.hub || !this.stats) return;
        if (distance(this.getWorldGridPosition(), this.target.getWorldGridPosition()) <= this.stats.getAttackRangeCells() + 0.08) {
            this.hub.emitAttackImpact({ attackerId: this.id, targetId: this.target.id, damage: this.stats.getAttackDamage() });
        }
    }
    onDestroy(): void { this.impactUnsubscribe?.(); }
}
