export interface AttackImpactSignal {
    attackerId: string;
    targetId: string;
}

export interface AttackImpactReceiver {
    onAttackImpact(signal: AttackImpactSignal): void;
}
