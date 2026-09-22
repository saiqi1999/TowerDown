import { ResourceType } from './WorldObjectTypes';

export interface ResourceRuntimeDefinition {
    maxHealth: number;
    yieldPerDamage: number;
}

const RESOURCE_RUNTIME_DEFINITIONS: Record<ResourceType, ResourceRuntimeDefinition> = {
    [ResourceType.Wood]: { maxHealth: 20, yieldPerDamage: 1 },
    [ResourceType.Stone]: { maxHealth: 20, yieldPerDamage: 1 },
    [ResourceType.Food]: { maxHealth: 20, yieldPerDamage: 1 },
    [ResourceType.Gold]: { maxHealth: 5, yieldPerDamage: 1 },
};

export function getResourceRuntimeDefinition(
    resourceType: ResourceType,
): ResourceRuntimeDefinition {
    const definition = RESOURCE_RUNTIME_DEFINITIONS[resourceType];
    if (!definition) {
        throw new Error(`[ResourceRuntimeConfig] missing definition for ${resourceType}`);
    }
    return definition;
}
