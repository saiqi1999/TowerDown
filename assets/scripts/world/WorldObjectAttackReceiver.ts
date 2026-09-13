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
import { WorldObjectLifecycleController } from './WorldObjectLifecycleController';
import { WorldObjectView } from './WorldObjectView';

const { ccclass } = _decorator;

export interface WorldObjectAttackReceiverConfig {
    objectId: string;
    combatEventHub: CombatEventHub;
    health: HealthComponent;
    hitFlashView: HitFlashView;
    damagePopupSpawner: DamagePopupSpawner;
    lifecycle: WorldObjectLifecycleController;
}

@ccclass('WorldObjectAttackReceiver')
export class WorldObjectAttackReceiver extends Component implements AttackImpactReceiver {
    private objectId = '';
    private combatEventHub: CombatEventHub | null = null;
    private health: HealthComponent | null = null;
    private hitFlashView: HitFlashView | null = null;
    private damagePopupSpawner: DamagePopupSpawner | null = null;
    private lifecycle: WorldObjectLifecycleController | null = null;
    private registered = false;

    public setup(
        config: WorldObjectAttackReceiverConfig,
    ): void {
        // Receiver 自己完成注册，是为了让资源节点在创建时就把“目标身份”和“表现组件”封装成一个完整接收端。
        this.objectId = config.objectId;
        this.combatEventHub = config.combatEventHub;
        this.health = config.health;
        this.hitFlashView = config.hitFlashView;
        this.damagePopupSpawner = config.damagePopupSpawner;
        this.lifecycle = config.lifecycle;
        this.combatEventHub.registerReceiver(this.objectId, this);
        this.registered = true;
    }

    public onAttackImpact(
        signal: AttackImpactSignal,
    ): AttackImpactResult {
        const damageResult = this.health?.takeDamage(signal.damage) ?? {
            requestedDamage: signal.damage,
            actualDamage: 0,
            healthBefore: 0,
            healthAfter: 0,
            becameDepleted: true,
        };
        if (damageResult.actualDamage > 0) {
            this.hitFlashView?.flash();
            this.damagePopupSpawner?.spawnDamage(this.node, damageResult.actualDamage);
        }
        if (damageResult.becameDepleted) {
            this.node.getComponent(WorldObjectView)?.setInteractable(false);
            this.lifecycle?.requestRemove(this.objectId);
        }
        console.log(
            `[Damage] target=${signal.targetId} requested=${damageResult.requestedDamage} actual=${damageResult.actualDamage} hp=${damageResult.healthAfter}/${this.health?.getMaxHealth() ?? 0}`,
        );
        return {
            targetId: this.objectId,
            damageResult,
            targetDepleted: this.health?.isDepleted() ?? true,
        };
    }

    public dispose(): void {
        // dispose 单独暴露给 renderer 调用，是因为 clear/re-render 的时机可能早于 onDestroy，不能把注销完全赌在生命周期回调上。
        if (!this.registered || !this.combatEventHub) {
            return;
        }

        // Renderer 可能在同一帧内先清旧节点再创建新节点，所以这里要同步注销，不能只等 onDestroy。
        this.combatEventHub.unregisterReceiver(this.objectId, this);
        this.registered = false;
    }

    onDestroy(): void {
        // onDestroy 再走一遍 dispose 是兜底，保证无论是主动清理还是编辑器销毁都不会留下脏注册。
        this.dispose();
        this.hitFlashView = null;
        this.health = null;
        this.damagePopupSpawner = null;
        this.lifecycle = null;
        this.combatEventHub = null;
    }
}
