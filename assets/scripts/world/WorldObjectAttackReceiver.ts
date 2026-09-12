import { _decorator, Component } from 'cc';
import { CombatEventHub } from '../combat/CombatEventHub';
import { type AttackImpactReceiver, type AttackImpactSignal } from '../combat/CombatTypes';
import { HitFlashView } from '../feedback/HitFlashView';

const { ccclass } = _decorator;

export interface WorldObjectAttackReceiverConfig {
    objectId: string;
    combatEventHub: CombatEventHub;
    hitFlashView: HitFlashView;
}

@ccclass('WorldObjectAttackReceiver')
export class WorldObjectAttackReceiver extends Component implements AttackImpactReceiver {
    private objectId = '';
    private combatEventHub: CombatEventHub | null = null;
    private hitFlashView: HitFlashView | null = null;
    private registered = false;

    public setup(
        config: WorldObjectAttackReceiverConfig,
    ): void {
        this.objectId = config.objectId;
        this.combatEventHub = config.combatEventHub;
        this.hitFlashView = config.hitFlashView;
        this.combatEventHub.registerReceiver(this.objectId, this);
        this.registered = true;
    }

    public onAttackImpact(
        signal: AttackImpactSignal,
    ): void {
        this.hitFlashView?.flash();
        console.log(
            `[AttackImpact] attacker=${signal.attackerId} target=${signal.targetId}`,
        );
    }

    public dispose(): void {
        if (!this.registered || !this.combatEventHub) {
            return;
        }

        // Renderer 可能在同一帧内先清旧节点再创建新节点，所以这里要同步注销，不能只等 onDestroy。
        this.combatEventHub.unregisterReceiver(this.objectId, this);
        this.registered = false;
    }

    onDestroy(): void {
        this.dispose();
        this.hitFlashView = null;
        this.combatEventHub = null;
    }
}
