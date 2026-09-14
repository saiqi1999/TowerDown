/**
 * Why this file exists:
 * World viewport 的移动速度、边缘阈值、缩放范围和 overscroll 都是同一套
 * Camera UX 参数，应集中管理而不是散落在输入回调里。
 *
 * Ownership boundary:
 * 本文件只定义 WorldViewportController 使用的配置常量。
 *
 * This file deliberately does NOT:
 * 不处理输入、不修改 MapRoot，也不保存运行时 Camera 状态。
 */
export const WORLD_VIEW_DEFAULT_SCALE = 1.0;
export const WORLD_VIEW_MIN_SCALE = 0.85;
export const WORLD_VIEW_MAX_SCALE = 1.5;
export const WORLD_VIEW_ZOOM_STEP = 0.05;
export const WORLD_VIEW_WASD_SPEED = 520;
export const WORLD_VIEW_EDGE_SPEED = 420;
export const WORLD_VIEW_EDGE_THRESHOLD = 24;
export const WORLD_VIEW_INTERACTION_OVERSCROLL = 128;
export const WORLD_VIEW_DRAG_THRESHOLD = 8;
