/**
 * Why this file exists:
 * Blueprint Card 使用固定 pixel-art source size，需要集中维护显示倍率、
 * 卡片尺寸、间距和文字布局，避免 UI 再次散落 magic number。
 *
 * Ownership boundary:
 * 本文件只定义 Building Card UI 常量。
 *
 * This file deliberately does NOT:
 * 不加载资源、不创建 Node、不处理输入，也不拥有运行时状态。
 */
export const BLUEPRINT_CARD_RESOURCE_PATH = 'ui/building/building_blueprint_card/spriteFrame';
export const BLUEPRINT_CARD_SPRITE_FRAME_UUID = '58a864f9-890f-4107-9713-bd247d46d0fe@f9941';
export const BLUEPRINT_CARD_PIXEL_SCALE = 2;
export const BLUEPRINT_CARD_SOURCE_WIDTH = 34;
export const BLUEPRINT_CARD_SOURCE_HEIGHT = 56;
export const BLUEPRINT_CARD_WIDTH = BLUEPRINT_CARD_SOURCE_WIDTH * BLUEPRINT_CARD_PIXEL_SCALE;
export const BLUEPRINT_CARD_HEIGHT = BLUEPRINT_CARD_SOURCE_HEIGHT * BLUEPRINT_CARD_PIXEL_SCALE;
export const BLUEPRINT_CARD_GAP = 8;
export const BLUEPRINT_CARD_BOTTOM_MARGIN = 14;
export const BLUEPRINT_CARD_ICON_SIZE = 32;
export const BLUEPRINT_CARD_NAME_FONT_SIZE = 11;
export const BLUEPRINT_CARD_COST_FONT_SIZE = 10;
