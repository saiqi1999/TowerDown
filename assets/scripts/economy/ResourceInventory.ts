import { ResourceType } from '../world/WorldObjectTypes';

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
