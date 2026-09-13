import { type CombatantAdapter, type CombatEncounterLike } from '../combat/CombatantTypes';
import { type CombatStats } from '../combat/CombatStats';
import { type HealthComponent } from '../combat/HealthComponent';
import { type GridPoint } from '../navigation/NavigationTypes';
import { type SquadMotor } from './SquadMotor';
import { type WarriorMotor } from './WarriorMotor';

export class WarriorCombatantAdapter implements CombatantAdapter {
    public readonly team = 'squad' as const;
    private targetId: string | null = null;
    private attackTimer = 0;
    constructor(
        public readonly id: string,
        private readonly health: HealthComponent,
        private readonly stats: CombatStats,
        private readonly squadMotor: SquadMotor,
        private readonly warriorMotor: WarriorMotor,
    ) {}
    public isAlive(): boolean { return !this.health.isDepleted(); }
    public getPosition(): GridPoint { return this.warriorMotor.getWorldGridPosition(this.squadMotor.getGridPosition()); }
    public getAttackRangeCells(): number { return this.stats.getAttackRangeCells(); }
    public getPreferredCombatDistanceCells(): number { return this.stats.getPreferredCombatDistanceCells(); }
    public getAttackDamage(): number { return this.stats.getAttackDamage(); }
    public setCombatTarget(targetId: string | null): void { this.targetId = targetId; }
    public getCombatTarget(): string | null { return this.targetId; }
    public setCombatPosition(position: GridPoint | null): void {
        if (!position) return;
        const squad = this.squadMotor.getGridPosition();
        this.warriorMotor.moveToLocalGridOffset({ x: position.x - squad.x, y: position.y - squad.y });
    }
    public updateCombat(dt: number, encounter: CombatEncounterLike): void {
        if (!this.targetId || !this.isAlive()) return;
        const target = encounter.getCombatant(this.targetId);
        if (!target || !target.isAlive()) return;
        const distance = Math.hypot(target.getPosition().x - this.getPosition().x, target.getPosition().y - this.getPosition().y);
        if (distance > this.getAttackRangeCells()) {
            this.setCombatPosition(target.getPosition());
            return;
        }
        this.attackTimer -= dt;
        if (this.attackTimer > 0) return;
        this.attackTimer = 0.55;
        encounter.emitDamage(this.id, this.targetId, this.getAttackDamage());
    }
}
