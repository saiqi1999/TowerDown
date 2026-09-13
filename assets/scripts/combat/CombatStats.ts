import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

export interface CombatStatsConfig {
    attackDamage: number;
    attackRangeCells?: number;
    preferredCombatDistanceCells?: number;
}

@ccclass('CombatStats')
export class CombatStats extends Component {
    private attackDamage = 1;
    private attackRangeCells = 1;
    private preferredCombatDistanceCells = 1;

    public setup(config: CombatStatsConfig): void {
        if (config.attackDamage < 0) {
            throw new Error('[CombatStats] attackDamage must be >= 0');
        }
        this.attackDamage = config.attackDamage;
        this.attackRangeCells = config.attackRangeCells ?? 1;
        this.preferredCombatDistanceCells = config.preferredCombatDistanceCells ?? this.attackRangeCells;
    }

    public getAttackDamage(): number {
        return this.attackDamage;
    }
    public getAttackRangeCells(): number { return this.attackRangeCells; }
    public getPreferredCombatDistanceCells(): number { return this.preferredCombatDistanceCells; }
}
