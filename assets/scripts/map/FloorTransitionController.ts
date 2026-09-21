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
    commit: (floorInstanceId: string, mapId: StaticFloorId, onError: (error: Error) => void) => void;
}

export class FloorTransitionController {
    private sequence = 1;
    private currentFloorInstanceId = 'f1';
    private currentMapId: StaticFloorId | null = null;
    private transitioning = false;
    private pendingMapId: StaticFloorId | null = null;
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
        if (this.transitioning || !this.config.baseInteraction.isOpen()) return;
        this.transitioning = true;
        this.pendingMapId = mapId;
        this.config.panel.setBusy(true);
        this.config.panel.setError(null);
        const nextInstance = `f${this.sequence + 1}`;
        const instantiated = instantiateFloor(getStaticFloor(mapId), nextInstance);
        if (instantiated.resources.length === 0 || instantiated.monsterGroups.length === 0) {
            this.fail(new Error(`[FloorTransition] invalid floor data: ${mapId}`));
            return;
        }
        try {
            this.config.commit(nextInstance, mapId, (error) => this.fail(error));
            if (this.transitioning) {
                this.sequence += 1;
                this.currentFloorInstanceId = nextInstance;
                this.currentMapId = mapId;
                this.pendingMapId = null;
                this.transitioning = false;
                this.config.panel.setBusy(false);
                this.config.baseInteraction.close();
            }
        } catch (error) {
            this.fail(error instanceof Error ? error : new Error(String(error)));
        }
    }

    private fail(error: Error): void {
        this.transitioning = false;
        this.pendingMapId = null;
        this.config.panel.setBusy(false);
        this.config.panel.setError(error.message);
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
