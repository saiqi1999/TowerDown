import { type GridPoint } from '../navigation/NavigationTypes';
import { MonsterGroupController } from './MonsterGroupController';

export class MonsterRuntimeRegistry {
    private readonly groups = new Map<string, MonsterGroupController>();
    public registerGroup(controller: MonsterGroupController): void { this.groups.set(controller.data.id, controller); }
    public getById(id: string): MonsterGroupController | null { return this.groups.get(id) ?? null; }
    public getByGuardedObject(objectId: string): MonsterGroupController | null {
        for (const group of this.groups.values()) if (group.data.guardedObjectId === objectId) return group;
        return null;
    }
    public getAll(): readonly MonsterGroupController[] { return [...this.groups.values()]; }
    public getGuardCenter(groupId: string): GridPoint | null { return this.groups.get(groupId)?.getGuardCenter() ?? null; }
}
