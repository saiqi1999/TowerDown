/**
 * Why this file exists:
 * 建筑效果需要稳定的数据契约，避免建筑渲染层直接耦合玩法系统。
 *
 * Ownership boundary:
 * 本文件只定义效果上下文和执行器接口。
 *
 * This file deliberately does NOT:
 * 不实现具体效果、不决定触发时机。
 */
import { type BuildingInstanceData } from './BuildingTypes';
export interface BuildingEffectContext { instance: BuildingInstanceData; }
export type BuildingEffectExecutor = (context: BuildingEffectContext) => void;
