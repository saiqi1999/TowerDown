import { MonsterType, MonsterVisualId, type MonsterGroupData } from './MonsterTypes';

export const STATIC_MONSTER_GROUPS: readonly MonsterGroupData[] = [{
    id: 'slime_guard_gold_01',
    guardedObjectId: 'gold_01',
    engageRadiusCells: 3,
    leashRadiusCells: 6,
    members: [
        { id: 'slime_gold_0', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: -1.25, y: 0 } },
        { id: 'slime_gold_1', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: 1.25, y: 0 } },
        { id: 'slime_gold_2', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: 0, y: -1.25 } },
    ],
},
{
    id: 'slime_guard_gold_02',
    guardedObjectId: 'gold_02',
    engageRadiusCells: 3,
    leashRadiusCells: 6,
    members: [
        { id: 'slime_gold_3', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: -1.25, y: 0 } },
        { id: 'slime_gold_4', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: 1.25, y: 0 } },
        { id: 'slime_gold_5', type: MonsterType.BlueSlime, visualId: MonsterVisualId.BlueSlime, guardOffset: { x: 0, y: -1.25 } },
    ],
}];
