import { ResourceType } from '../world/WorldObjectTypes';
import { type ResourceCost } from '../building/BuildingTypes';

export interface ResourceInventorySnapshot {
    wood: number;
    stone: number;
    food: number;
    gold: number;
}

export type ResourceInventoryListener = (
    snapshot: ResourceInventorySnapshot,
) => void;

export class ResourceInventory {
    private readonly amounts = new Map<ResourceType, number>([
        [ResourceType.Wood, 0],
        [ResourceType.Stone, 0],
        [ResourceType.Food, 0],
        [ResourceType.Gold, 0],
    ]);
    private readonly listeners = new Set<ResourceInventoryListener>();

    public get(type: ResourceType): number {
        return this.amounts.get(type) ?? 0;
    }

    public add(type: ResourceType, amount: number): void {
        if (amount <= 0) {
            return;
        }
        this.amounts.set(type, this.get(type) + amount);
        this.notify();
    }

    public canSpend(type: ResourceType, amount: number): boolean {
        return amount >= 0 && this.get(type) >= amount;
    }

    public trySpend(type: ResourceType, amount: number): boolean {
        if (!this.canSpend(type, amount)) {
            return false;
        }
        if (amount > 0) {
            this.amounts.set(type, this.get(type) - amount);
            this.notify();
        }
        return true;
    }

    public canAfford(cost: ResourceCost): boolean {
        for (const key of Object.keys(cost)) {
            const type = Number(key) as ResourceType;
            const required = cost[type] ?? 0;
            if (required < 0 || this.get(type) < required) return false;
        }
        return true;
    }

    public trySpendCost(cost: ResourceCost): boolean {
        if (!this.canAfford(cost)) return false;
        let changed = false;
        for (const key of Object.keys(cost)) {
            const type = Number(key) as ResourceType;
            const amount = cost[type] ?? 0;
            if (amount > 0) {
                this.amounts.set(type, this.get(type) - amount);
                changed = true;
            }
        }
        if (changed) this.notify();
        return true;
    }

    public addCost(cost: ResourceCost): void {
        let changed = false;
        for (const key of Object.keys(cost)) {
            const type = Number(key) as ResourceType;
            const amount = cost[type] ?? 0;
            if (amount > 0) {
                this.amounts.set(type, this.get(type) + amount);
                changed = true;
            }
        }
        if (changed) this.notify();
    }

    public subscribe(listener: ResourceInventoryListener): () => void {
        this.listeners.add(listener);
        listener(this.snapshot());
        return () => this.listeners.delete(listener);
    }

    private snapshot(): ResourceInventorySnapshot {
        return {
            wood: this.get(ResourceType.Wood),
            stone: this.get(ResourceType.Stone),
            food: this.get(ResourceType.Food),
            gold: this.get(ResourceType.Gold),
        };
    }

    private notify(): void {
        const snapshot = this.snapshot();
        for (const listener of this.listeners) {
            listener(snapshot);
        }
    }
}
