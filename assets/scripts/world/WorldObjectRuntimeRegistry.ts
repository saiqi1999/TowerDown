import { type WorldObjectData } from './WorldObjectTypes';

export class WorldObjectRuntimeRegistry {
    private readonly objects = new Map<string, WorldObjectData>();

    constructor(objects: readonly WorldObjectData[]) {
        for (const objectData of objects) {
            this.objects.set(objectData.id, objectData);
        }
    }

    public get(objectId: string): WorldObjectData | null {
        return this.objects.get(objectId) ?? null;
    }

    public has(objectId: string): boolean {
        return this.objects.has(objectId);
    }

    public getAll(): readonly WorldObjectData[] {
        return Array.from(this.objects.values());
    }

    public remove(objectId: string): WorldObjectData | null {
        const objectData = this.get(objectId);
        if (objectData) {
            this.objects.delete(objectId);
        }
        return objectData;
    }
}
