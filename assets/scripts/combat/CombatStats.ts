import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

export interface CombatStatsConfig {
    attackDamage: number;
}

@ccclass('CombatStats')
export class CombatStats extends Component {
    private attackDamage = 1;

    public setup(config: CombatStatsConfig): void {
        if (config.attackDamage < 0) {
            throw new Error('[CombatStats] attackDamage must be >= 0');
        }
        this.attackDamage = config.attackDamage;
    }

    public getAttackDamage(): number {
        return this.attackDamage;
    }
}
