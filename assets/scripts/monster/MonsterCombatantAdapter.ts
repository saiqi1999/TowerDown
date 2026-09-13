import { CombatStats } from '../combat/CombatStats';
import { type CombatantAdapter, type CombatEncounterLike } from '../combat/CombatantTypes';
import { HealthComponent } from '../combat/HealthComponent';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type MonsterMotor } from './MonsterMotor';

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
        if (Math.hypot(target.getPosition().x - this.position.x, target.getPosition().y - this.position.y) > this.getAttackRangeCells()) return;
        this.attackTimer -= dt;
        if (this.attackTimer > 0) return;
        this.attackTimer = 0.6;
        encounter.emitDamage(this.id, this.targetId, this.getAttackDamage());
    }
}
