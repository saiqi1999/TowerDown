import { _decorator, Component } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { type AttackImpactReceiver, type AttackImpactResult, type AttackImpactSignal } from '../combat/CombatTypes';
import { HealthComponent } from '../combat/HealthComponent';
import { DamagePopupSpawner } from '../feedback/DamagePopupSpawner';
import { HitFlashView } from '../feedback/HitFlashView';

const { ccclass } = _decorator;
@ccclass('MonsterAttackReceiver')
export class MonsterAttackReceiver extends Component implements AttackImpactReceiver {
    private id = ''; private hub: CombatEventHub | null = null; private health: HealthComponent | null = null;
    private flash: HitFlashView | null = null; private popup: DamagePopupSpawner | null = null;
    public setup(id: string, hub: CombatEventHub, health: HealthComponent, flash: HitFlashView, popup: DamagePopupSpawner): void {
        this.id = id; this.hub = hub; this.health = health; this.flash = flash; this.popup = popup; hub.registerReceiver(id, this);
    }
    public onAttackImpact(signal: AttackImpactSignal): AttackImpactResult {
        const damageResult = this.health!.takeDamage(signal.damage);
        if (damageResult.actualDamage > 0) { this.flash?.flash(); this.popup?.spawnDamage(this.node, damageResult.actualDamage); }
        return { targetId: this.id, damageResult, targetDepleted: this.health!.isDepleted() };
    }
    onDestroy(): void { if (this.hub) this.hub.unregisterReceiver(this.id, this); }
}
