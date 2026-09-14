/**
 * Why this file exists:
 * 玩家单位的 Base Attack 需要与来自建筑、研究等来源的运行时 Modifier 分离，
 * 并在真正发生攻击时解析出当前 Effective Attack。
 *
 * Ownership boundary:
 * 本文件拥有 source-keyed stat modifiers 及 AddFlat / Multiply bucket 的聚合。
 *
 * This file deliberately does NOT:
 * 不知道 Warrior、Blacksmith、Building Instance、攻击目标或 Health。
 */
export enum CombatStatId {
    AttackDamage = 'attackDamage',
}

export enum StatModifierOperation {
    AddFlat = 'addFlat',
    Multiply = 'multiply',
}

export interface CombatStatModifier {
    readonly sourceId: string;
    readonly stat: CombatStatId;
    readonly operation: StatModifierOperation;
    readonly value: number;
}

export class CombatStatModifierRegistry {
    private readonly modifiers = new Map<string, CombatStatModifier>();

    public set(modifier: CombatStatModifier): void {
        this.modifiers.set(modifier.sourceId, modifier);
    }

    public removeSource(sourceId: string): void {
        this.modifiers.delete(sourceId);
    }

    public resolve(stat: CombatStatId, baseValue: number): number {
        let flatAdd = 0;
        let multiplier = 1;
        for (const modifier of this.modifiers.values()) {
            if (modifier.stat !== stat) continue;
            if (modifier.operation === StatModifierOperation.AddFlat) {
                flatAdd += modifier.value;
            } else if (modifier.operation === StatModifierOperation.Multiply) {
                multiplier *= modifier.value;
            }
        }
        return (baseValue + flatAdd) * multiplier;
    }
}
