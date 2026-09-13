export interface AttackImpactSignal {
    attackerId: string;
    targetId: string;
    damage: number;
}

export interface DamageResult {
    requestedDamage: number;
    actualDamage: number;
    healthBefore: number;
    healthAfter: number;
    becameDepleted: boolean;
}

export interface AttackImpactResult {
    targetId: string;
    damageResult: DamageResult;
    targetDepleted: boolean;
}

export interface AttackImpactReceiver {
    onAttackImpact(signal: AttackImpactSignal): AttackImpactResult;
}
