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
        // Receiver 自己完成注册，是为了让资源节点在创建时就把“目标身份”和“表现组件”封装成一个完整接收端。
        this.objectId = config.objectId;
        this.combatEventHub = config.combatEventHub;
        this.hitFlashView = config.hitFlashView;
        this.combatEventHub.registerReceiver(this.objectId, this);
        this.registered = true;
    }

    public onAttackImpact(
        signal: AttackImpactSignal,
    ): void {
        // 第一版只触发视觉反馈，不引入 HP / Damage，这样能先把攻击事件链和数值系统彻底分开。
        this.hitFlashView?.flash();
        console.log(
            `[AttackImpact] attacker=${signal.attackerId} target=${signal.targetId}`,
        );
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
        this.combatEventHub = null;
    }
}
