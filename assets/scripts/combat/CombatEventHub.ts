import {
    type AttackImpactReceiver,
    type AttackImpactResult,
    type AttackImpactSignal,
} from './CombatTypes';

export class CombatEventHub {
    private readonly receivers = new Map<string, AttackImpactReceiver>();
    private impactBlockedPredicate: (() => boolean) | null = null;
    public setImpactBlockedPredicate(predicate: (() => boolean) | null): void { this.impactBlockedPredicate = predicate; }

    // Hub 明确要求一个 targetId 只对应一个接收端，避免后续同名对象把命中路由静默覆盖。
    public registerReceiver(
        targetId: string,
        receiver: AttackImpactReceiver,
    ): void {
        const existing = this.receivers.get(targetId);
        if (existing && existing !== receiver) {
            throw new Error(`[CombatEventHub] duplicate receiver: ${targetId}`);
        }

        this.receivers.set(targetId, receiver);
    }

    // unregister 采用“同一个实例才可移除”的规则，是为了防止旧节点销毁时把新节点刚注册的 receiver 一并删掉。
    public unregisterReceiver(
        targetId: string,
        receiver: AttackImpactReceiver,
    ): void {
        const existing = this.receivers.get(targetId);
        if (existing !== receiver) {
            return;
        }

        this.receivers.delete(targetId);
    }

    // emit 只做 targetId 路由，不夹带任何资源/伤害逻辑，这样未来怪物和建筑也能复用同一条攻击事件链。
    public emitAttackImpact(
        signal: AttackImpactSignal,
    ): AttackImpactResult | null {
        if (this.impactBlockedPredicate?.()) return null;
        const receiver = this.receivers.get(signal.targetId);
        if (!receiver) {
            // 目标可能在命中边沿到来前已经被销毁，这里保留 warning 但不把竞态升级成异常。
            console.warn(`[CombatEventHub] no receiver for target=${signal.targetId}`);
            return null;
        }

        return receiver.onAttackImpact(signal);
    }
}
