import { CombatStats } from '../combat/CombatStats';
import { type CombatantAdapter, type CombatEncounterLike } from '../combat/CombatantTypes';
import { HealthComponent } from '../combat/HealthComponent';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type MonsterMotor } from './MonsterMotor';
import { MonsterAnimator } from './MonsterAnimator';
import { MonsterDirection } from './MonsterSpriteConfig';

export class MonsterCombatantAdapter implements CombatantAdapter {
    public readonly team = 'monster' as const;
    private targetId: string | null = null;
    private attackTimer = 0;
    constructor(
        public readonly id: string,
        private readonly health: HealthComponent,
        private readonly stats: CombatStats,
        private position: GridPoint,
        private readonly motor: MonsterMotor,
        private readonly animator: MonsterAnimator,
    ) {}
    public isAlive(): boolean { return !this.health.isDepleted(); }
    public getPosition(): GridPoint { return this.motor.getGridPosition(); }
    public getAttackRangeCells(): number { return this.stats.getAttackRangeCells(); }
    public getPreferredCombatDistanceCells(): number { return this.stats.getPreferredCombatDistanceCells(); }
    public getAttackDamage(): number { return this.stats.getAttackDamage(); }
    public setCombatTarget(targetId: string | null): void { this.targetId = targetId; }
    public getCombatTarget(): string | null { return this.targetId; }
    public setCombatPosition(position: GridPoint | null): void { if (position) { this.position = { ...position }; this.motor.moveTo(position); } }
    public updateCombat(dt: number, encounter: CombatEncounterLike): void {
        if (!this.targetId || !this.isAlive()) return;
        const target = encounter.getCombatant(this.targetId);
        if (!target || !target.isAlive()) return;
        const current = this.getPosition();
        const targetPosition = target.getPosition();
        const distance = Math.hypot(targetPosition.x - current.x, targetPosition.y - current.y);
        if (distance > this.getAttackRangeCells()) {
            const position = encounter.getReservedCombatPosition(this.id);
            if (position) this.motor.moveTo(position);
            return;
        }
        const direction = Math.abs(targetPosition.x - current.x) >= Math.abs(targetPosition.y - current.y)
            ? (targetPosition.x < current.x ? MonsterDirection.Left : MonsterDirection.Right)
            : (targetPosition.y < current.y ? MonsterDirection.Up : MonsterDirection.Down);
        this.attackTimer -= dt;
        if (this.attackTimer > 0) return;
        this.attackTimer = 0.6;
        this.animator.playAttack(direction);
    }

    public bindAttackImpact(encounter: CombatEncounterLike): () => void {
        return this.animator.subscribeAttackImpact(() => {
            if (!this.targetId || !this.isAlive()) return;
            const target = encounter.getCombatant(this.targetId);
            if (!target || !target.isAlive()) return;
            if (Math.hypot(target.getPosition().x - this.getPosition().x, target.getPosition().y - this.getPosition().y) <= this.getAttackRangeCells()) {
                encounter.emitDamage(this.id, this.targetId, this.getAttackDamage());
            }
        });
    }
}
