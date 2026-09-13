import { _decorator, Component } from 'cc';
import { type DamageResult } from './CombatTypes';

const { ccclass } = _decorator;

export type HealthChangedListener = (
    current: number,
    max: number,
    result: DamageResult | null,
) => void;

@ccclass('HealthComponent')
export class HealthComponent extends Component {
    private maxHealth = 1;
    private currentHealth = 1;
    private readonly listeners = new Set<HealthChangedListener>();

    public setup(maxHealth: number): void {
        if (maxHealth <= 0) {
            throw new Error(`[HealthComponent] maxHealth must be > 0, got ${maxHealth}`);
        }

        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
    }

    public getMaxHealth(): number {
        return this.maxHealth;
    }

    public getCurrentHealth(): number {
        return this.currentHealth;
    }

    public getHealthRatio(): number {
        return this.maxHealth <= 0 ? 0 : this.currentHealth / this.maxHealth;
    }

    public isDepleted(): boolean {
        return this.currentHealth <= 0;
    }

    public takeDamage(amount: number): DamageResult {
        const requestedDamage = Math.max(0, amount);
        const healthBefore = this.currentHealth;
        const healthAfter = requestedDamage <= 0 || this.isDepleted()
            ? healthBefore
            : Math.max(0, healthBefore - requestedDamage);
        const actualDamage = healthBefore - healthAfter;
        const result: DamageResult = {
            requestedDamage,
            actualDamage,
            healthBefore,
            healthAfter,
            becameDepleted: healthBefore > 0 && healthAfter <= 0,
        };

        this.currentHealth = healthAfter;
        if (actualDamage > 0) {
            this.notify(result);
        }

        return result;
    }

    public heal(amount: number): number {
        if (amount <= 0 || this.isDepleted()) {
            return 0;
        }

        const before = this.currentHealth;
        this.currentHealth = Math.min(this.maxHealth, before + amount);
        const healed = this.currentHealth - before;
        if (healed > 0) {
            this.notify(null);
        }
        return healed;
    }

    public subscribe(listener: HealthChangedListener): () => void {
        this.listeners.add(listener);
        listener(this.currentHealth, this.maxHealth, null);
        return () => this.listeners.delete(listener);
    }

    private notify(result: DamageResult | null): void {
        for (const listener of this.listeners) {
            listener(this.currentHealth, this.maxHealth, result);
        }
    }
}
