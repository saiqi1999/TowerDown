/**
 * Why this file exists:
 * Squad Roster uses fixed pixel-art dimensions that should not be scattered as magic numbers.
 *
 * Ownership boundary:
 * This file only defines roster layout constants.
 *
 * This file deliberately does NOT:
 * It does not load assets, select squads, or issue world commands.
 */
export const SQUAD_ROSTER_CARD_WIDTH = 128;
export const SQUAD_ROSTER_CARD_HEIGHT = 84;
export const SQUAD_ROSTER_CARD_GAP = 8;
export const SQUAD_ROSTER_LEFT_X = -640 + 54;
export const SQUAD_ROSTER_TOP_Y = 210;
export const SQUAD_ROSTER_SELECTED_OFFSET_X = 8;
export const SQUAD_PORTRAIT_SIZE = 76;
export const SQUAD_MINI_FLAG_SIZE = 32;
