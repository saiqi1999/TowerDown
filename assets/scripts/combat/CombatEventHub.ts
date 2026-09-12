import { type AttackImpactReceiver, type AttackImpactSignal } from './CombatTypes';

export class CombatEventHub {
    private readonly receivers = new Map<string, AttackImpactReceiver>();

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

    public emitAttackImpact(
        signal: AttackImpactSignal,
    ): void {
        const receiver = this.receivers.get(signal.targetId);
        if (!receiver) {
            // 目标可能在命中边沿到来前已经被销毁，这里保留 warning 但不把竞态升级成异常。
            console.warn(`[CombatEventHub] no receiver for target=${signal.targetId}`);
            return;
        }

        receiver.onAttackImpact(signal);
    }
}
