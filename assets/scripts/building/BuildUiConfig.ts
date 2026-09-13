/**
 * Why this file exists:
 * 建造栏的像素倍率与世界渲染倍率职责不同，需要集中管理 UI 尺寸。
 *
 * Ownership boundary:
 * 本文件只拥有 BuildBar 的视觉尺寸和布局常量。
 *
 * This file deliberately does NOT:
 * 不管理建造状态、资源成本或放置规则。
 */
export const BUILD_UI_PIXEL_SCALE = 2;
export const BUILD_BAR_SOURCE_WIDTH = 300;
export const BUILD_BAR_SOURCE_HEIGHT = 58;
export const BUILD_BAR_WIDTH = BUILD_BAR_SOURCE_WIDTH * BUILD_UI_PIXEL_SCALE;
export const BUILD_BAR_HEIGHT = BUILD_BAR_SOURCE_HEIGHT * BUILD_UI_PIXEL_SCALE;
export const BUILD_BAR_BOTTOM_MARGIN = 16;
export const ERA_SLOT_WIDTH = 92;
export const BUILD_ITEM_WIDTH = 112;
export const BUILD_ITEM_HEIGHT = 100;
export const BUILD_ITEM_GAP = 8;
export const BUILD_ICON_SIZE = 32;
export const BUILD_NAME_FONT_SIZE = 14;
export const BUILD_COST_FONT_SIZE = 12;
