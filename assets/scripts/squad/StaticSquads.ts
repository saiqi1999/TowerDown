import {
    SquadCommandColor,
    type SquadSpawnData,
    WarriorVisualId,
} from './SquadTypes';

export const STATIC_SQUADS: SquadSpawnData[] = [
    {
        id: 'initial_01',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
        commandSlot: 1,
        commandColor: SquadCommandColor.Cyan,
        spawnPoint: { x: 19, y: 14 },
    },
    {
        id: 'initial_02',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
        commandSlot: 2,
        commandColor: SquadCommandColor.Amber,
        spawnPoint: { x: 21, y: 14 },
    },
];
