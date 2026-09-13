import { _decorator, Component } from 'cc';
import { HealthComponent } from '../combat/HealthComponent';
import { ResourceInventory } from '../economy/ResourceInventory';
import { ResourceType } from './WorldObjectTypes';

const { ccclass } = _decorator;

export interface ResourceHarvestConfig {
    resourceType: ResourceType;
    health: HealthComponent;
    inventory: ResourceInventory;
    yieldPerDamage: number;
}

@ccclass('ResourceHarvestComponent')
export class ResourceHarvestComponent extends Component {
    private unsubscribe: (() => void) | null = null;
    private resourceType: ResourceType | null = null;
    private inventory: ResourceInventory | null = null;
    private yieldPerDamage = 1;

    public setup(config: ResourceHarvestConfig): void {
        this.unsubscribe?.();
        this.resourceType = config.resourceType;
        this.inventory = config.inventory;
        this.yieldPerDamage = config.yieldPerDamage;
        this.unsubscribe = config.health.subscribe((_current, _max, result) => {
            if (!result || result.actualDamage <= 0 || !this.inventory || this.resourceType === null) {
                return;
            }
            const amount = result.actualDamage * this.yieldPerDamage;
            this.inventory.add(this.resourceType, amount);
            console.log(`[Harvest] type=${ResourceType[this.resourceType]} amount=${amount} total=${this.inventory.get(this.resourceType)}`);
        });
    }

    onDestroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.inventory = null;
        this.resourceType = null;
    }
}
