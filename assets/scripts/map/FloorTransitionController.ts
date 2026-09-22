/**
 * Why this file exists:
 * 地图选择需要在不重跑 MainMap bootstrap 的前提下，原位刷新资源、敌怪、计数和队伍整备。
 *
 * Ownership boundary:
 * 本文件拥有地图选择的准备/提交状态、实例编号、busy/error 状态和一次性提交门禁。
 *
 * This file deliberately does NOT:
 * 不创建 HUD、不重建建筑或 Squad，不修改玩家库存和建筑效果。
 */
import { EnemyKillCounter } from '../combat/EnemyKillCounter';
import { type StaticFloorId, getStaticFloor, instantiateFloor } from './StaticFloorCatalog';
import { BaseInteractionController } from '../ui/base/BaseInteractionController';
import { BasePanelView } from '../ui/base/BasePanelView';

export interface FloorTransitionConfig {
    counter: EnemyKillCounter;
    baseInteraction: BaseInteractionController;
    panel: BasePanelView;
    prepare?: (context: FloorTransitionContext) => FloorTransitionPreparation;
    commit: (
        context: FloorTransitionContext,
        preparation: FloorTransitionPreparation,
    ) => FloorTransitionCommitResult;
}

export interface FloorTransitionContext {
    readonly currentFloorInstanceId: string;
    readonly nextFloorInstanceId: string;
    readonly mapId: StaticFloorId;
}

export interface FloorTransitionPreparation {
    readonly payload?: unknown;
}

export interface FloorTransitionCommitResult {
    readonly success: boolean;
    readonly error?: Error;
}

export class FloorTransitionController {
    private sequence = 1;
    private currentFloorInstanceId = 'f1';
    private currentMapId: StaticFloorId | null = null;
    private transitioning = false;
    private pendingMapId: StaticFloorId | null = null;
    private pendingContext: FloorTransitionContext | null = null;
    private pendingPreparation: FloorTransitionPreparation | null = null;
    private readonly previews = [getStaticFloor('forest'), getStaticFloor('quarry')];

    constructor(private readonly config: FloorTransitionConfig) {}

    public isTransitioning(): boolean {
        return this.transitioning;
    }

    public getCurrentFloorInstanceId(): string {
        return this.currentFloorInstanceId;
    }

    public setupPanel(): void {
        this.config.panel.setDestinations(
            this.previews.map((definition) => ({
                ...this.preview(definition),
            })),
            (id) => this.choose(id as StaticFloorId),
        );
    }

    public choose(mapId: StaticFloorId): void {
        if (this.transitioning || this.pendingContext || !this.config.baseInteraction.isOpen()) return;
        this.transitioning = true;
        this.pendingMapId = mapId;
        this.config.panel.setBusy(true);
        this.config.panel.setError(null);
        const nextInstance = `f${this.sequence + 1}`;
        try {
            const instantiated = instantiateFloor(getStaticFloor(mapId), nextInstance);
            if (instantiated.resources.length === 0 || instantiated.monsterGroups.length === 0) {
                this.fail(new Error(`[FloorTransition] invalid floor data: ${mapId}`), false);
                return;
            }
            const context: FloorTransitionContext = {
                currentFloorInstanceId: this.currentFloorInstanceId,
                nextFloorInstanceId: nextInstance,
                mapId,
            };
            const preparation = this.config.prepare?.(context) ?? {};
            this.pendingContext = context;
            this.pendingPreparation = preparation;
            const result = this.config.commit(context, preparation);
            if (!result.success) {
                this.fail(result.error ?? new Error('[FloorTransition] commit rejected.'), true);
                return;
            }
            this.finalize(context);
        } catch (error) {
            this.fail(
                error instanceof Error ? error : new Error(String(error)),
                this.pendingContext !== null,
            );
        }
    }

    public retryPending(): void {
        if (
            this.transitioning
            || !this.pendingContext
            || !this.pendingPreparation
        ) {
            return;
        }
        this.transitioning = true;
        this.config.panel.setBusy(true);
        this.config.panel.setError(null);
        try {
            const result = this.config.commit(this.pendingContext, this.pendingPreparation);
            if (!result.success) {
                this.fail(result.error ?? new Error('[FloorTransition] retry rejected.'), true);
                return;
            }
            this.finalize(this.pendingContext);
        } catch (error) {
            this.fail(error instanceof Error ? error : new Error(String(error)), true);
        }
    }

    private fail(error: Error, preservePending: boolean): void {
        if (!preservePending) {
            this.pendingMapId = null;
            this.pendingContext = null;
            this.pendingPreparation = null;
        }
        this.transitioning = false;
        this.config.panel.setBusy(false);
        this.config.panel.setError(error.message);
    }

    private finalize(context: FloorTransitionContext): void {
        this.sequence += 1;
        this.currentFloorInstanceId = context.nextFloorInstanceId;
        this.currentMapId = context.mapId;
        this.pendingMapId = null;
        this.pendingContext = null;
        this.pendingPreparation = null;
        this.transitioning = false;
        this.config.panel.setBusy(false);
        this.config.baseInteraction.close();
    }

    private preview(definition: ReturnType<typeof getStaticFloor>) {
        const resourceCounts = new Map<number, number>();
        for (const item of definition.resources) {
            const type = item.resourceType!;
            resourceCounts.set(type, (resourceCounts.get(type) ?? 0) + 1);
        }
        return {
            id: definition.id,
            displayName: definition.displayName,
            resourceCounts,
            monsterCount: definition.monsterGroups.reduce((sum, group) => sum + group.members.length, 0),
        };
    }
}
