import { type GridPoint } from '../navigation/NavigationTypes';
import { MonsterGroupController } from './MonsterGroupController';
import { type MonsterGroupData } from './MonsterTypes';
import { type MonsterCombatantAdapter } from './MonsterCombatantAdapter';

export class MonsterRuntimeRegistry {
    private readonly groups = new Map<string, MonsterGroupController>();
    private readonly members = new Map<string, MonsterCombatantAdapter>();

    public register(data: MonsterGroupData, guardCenter: GridPoint): MonsterGroupController {
        const controller = new MonsterGroupController(data, guardCenter);
        this.groups.set(data.id, controller);
        return controller;
    }

    public getByGuardedObject(objectId: string): MonsterGroupController | null {
        for (const group of this.groups.values()) {
            if (group.data.guardedObjectId === objectId) return group;
        }
        return null;
    }

    public getAll(): readonly MonsterGroupController[] {
        return [...this.groups.values()];
    }
    public registerMember(adapter: MonsterCombatantAdapter): void { this.members.set(adapter.id, adapter); }
    public getMembersForGroup(group: MonsterGroupController): readonly MonsterCombatantAdapter[] {
        return group.data.members.map((member) => this.members.get(member.id)).filter((member): member is MonsterCombatantAdapter => !!member);
    }
}
