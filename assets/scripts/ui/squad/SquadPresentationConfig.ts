/**
 * Why this file exists:
 * Squad command colors and portrait frames must be shared by roster UI and world target flags.
 *
 * Ownership boundary:
 * This file owns presentation mapping from squad spawn data to display colors and portrait frames.
 *
 * This file deliberately does NOT:
 * It does not select squads, listen for input, or load assets by itself.
 */
import { Color, type SpriteFrame } from 'cc';
import { SquadCommandColor, WarriorVisualId, type SquadSpawnData } from '../../squad/SquadTypes';

export interface SquadPresentation {
    commandColor: Color;
    portraitFrame: SpriteFrame;
}

export interface SquadPresentationAssets {
    swordWarriorPortrait: SpriteFrame;
}

export function getCommandColor(color: SquadCommandColor): Color {
    switch (color) {
    case SquadCommandColor.Amber: return new Color(224, 165, 69, 255);
    case SquadCommandColor.Green: return new Color(114, 184, 117, 255);
    case SquadCommandColor.Violet: return new Color(167, 132, 216, 255);
    case SquadCommandColor.Cyan:
    default:
        return new Color(99, 190, 209, 255);
    }
}

export function buildSquadPresentationMap(
    squads: readonly SquadSpawnData[],
    assets: SquadPresentationAssets,
): Map<string, SquadPresentation> {
    const result = new Map<string, SquadPresentation>();
    for (const squad of squads) {
        const portraitFrame = squad.warriorVisualId === WarriorVisualId.SwordWarrior
            ? assets.swordWarriorPortrait
            : assets.swordWarriorPortrait;
        result.set(squad.id, {
            commandColor: getCommandColor(squad.commandColor),
            portraitFrame,
        });
    }
    return result;
}
