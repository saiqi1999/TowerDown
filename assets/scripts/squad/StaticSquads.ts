import {
    type SquadSpawnData,
    WarriorVisualId,
} from './SquadTypes';

export const STATIC_SQUADS: SquadSpawnData[] = [
    {
        id: 'initial_01',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
    },
];
