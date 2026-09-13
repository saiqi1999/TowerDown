import { _decorator, Component } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import {
    type AttackImpactReceiver,
    type AttackImpactResult,
    type AttackImpactSignal,
} from '../combat/CombatTypes';
import { HealthComponent } from '../combat/HealthComponent';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { HitFlashView } from '../feedback/HitFlashView';

const { ccclass } = _decorator;

export interface WarriorAttackReceiverConfig {
    targetId: string;
    combatEventHub: CombatEventHub;
    health: HealthComponent;
    hitFlashView: HitFlashView;
    damagePopupSpawner: DamagePopupSpawner;
}

@ccclass('WarriorAttackReceiver')
export class WarriorAttackReceiver extends Component implements AttackImpactReceiver {
    private targetId = '';
    private hub: CombatEventHub | null = null;
    private health: HealthComponent | null = null;
    private hitFlash: HitFlashView | null = null;
    private popupSpawner: DamagePopupSpawner | null = null;
    private registered = false;

    public setup(config: WarriorAttackReceiverConfig): void {
        this.targetId = config.targetId;
        this.hub = config.combatEventHub;
        this.health = config.health;
        this.hitFlash = config.hitFlashView;
        this.popupSpawner = config.damagePopupSpawner;
        this.hub.registerReceiver(this.targetId, this);
        this.registered = true;
    }

    public onAttackImpact(signal: AttackImpactSignal): AttackImpactResult {
        const damageResult = this.health?.takeDamage(signal.damage) ?? {
            requestedDamage: signal.damage,
            actualDamage: 0,
            healthBefore: 0,
            healthAfter: 0,
            becameDepleted: true,
        };
        if (damageResult.actualDamage > 0) {
            this.hitFlash?.flash();
            this.popupSpawner?.spawnDamage(this.node, damageResult.actualDamage);
        }
        return {
            targetId: this.targetId,
            damageResult,
            targetDepleted: this.health?.isDepleted() ?? true,
        };
    }

    onDestroy(): void {
        if (this.registered && this.hub) {
            this.hub.unregisterReceiver(this.targetId, this);
        }
        this.registered = false;
        this.hub = null;
        this.health = null;
        this.hitFlash = null;
        this.popupSpawner = null;
    }
}
