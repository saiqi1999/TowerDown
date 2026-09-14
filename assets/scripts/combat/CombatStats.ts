import { _decorator, Component } from 'cc';
import { CombatStatId, CombatStatModifierRegistry } from './CombatStatModifierRegistry';

const { ccclass } = _decorator;

export interface CombatStatsConfig {
    attackDamage: number;
    attackRangeCells?: number;
    preferredCombatDistanceCells?: number;
    modifierRegistry?: CombatStatModifierRegistry;
}

@ccclass('CombatStats')
export class CombatStats extends Component {
    private baseAttackDamage = 1;
    private modifierRegistry: CombatStatModifierRegistry | null = null;
    private attackRangeCells = 1;
    private preferredCombatDistanceCells = 1;

    public setup(config: CombatStatsConfig): void {
        if (config.attackDamage < 0) {
            throw new Error('[CombatStats] attackDamage must be >= 0');
        }
        this.baseAttackDamage = config.attackDamage;
        this.modifierRegistry = config.modifierRegistry ?? null;
        this.attackRangeCells = config.attackRangeCells ?? 1;
        this.preferredCombatDistanceCells = config.preferredCombatDistanceCells ?? this.attackRangeCells;
    }

    public getAttackDamage(): number {
        return this.modifierRegistry?.resolve(CombatStatId.AttackDamage, this.baseAttackDamage)
            ?? this.baseAttackDamage;
    }
    public getAttackRangeCells(): number { return this.attackRangeCells; }
    public getPreferredCombatDistanceCells(): number { return this.preferredCombatDistanceCells; }
}
