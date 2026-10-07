import { _decorator, Component } from 'cc';
import { WorldObjectRenderer } from './WorldObjectRenderer';
import { WorldObjectRuntimeRegistry } from './WorldObjectRuntimeRegistry';
import { type WorldCellGrid } from './WorldCellGrid';

const { ccclass } = _decorator;
const RESOURCE_REMOVE_DELAY_SECONDS = 0.12;

interface PendingRemoval {
    objectId: string;
    objectData: ReturnType<WorldObjectRuntimeRegistry['get']>;
    remaining: number;
}

@ccclass('WorldObjectLifecycleController')
export class WorldObjectLifecycleController extends Component {
    private registry: WorldObjectRuntimeRegistry | null = null;
    private renderer: WorldObjectRenderer | null = null;
    private worldCellGrid: WorldCellGrid | null = null;
    private readonly pending = new Map<string, PendingRemoval>();

    public setup(
        registry: WorldObjectRuntimeRegistry,
        renderer: WorldObjectRenderer,
        worldCellGrid: WorldCellGrid,
    ): void {
        this.registry = registry;
        this.renderer = renderer;
        this.worldCellGrid = worldCellGrid;
    }

    public requestRemove(objectId: string): void {
        if (this.pending.has(objectId) || !this.registry) {
            return;
        }
        const objectData = this.registry.remove(objectId);
        if (!objectData) {
            return;
        }
        this.pending.set(objectId, {
            objectId,
            objectData,
            remaining: RESOURCE_REMOVE_DELAY_SECONDS,
        });
    }

    public clearPendingForFloorChange(): void {
        this.pending.clear();
    }

    update(dt: number): void {
        for (const [objectId, removal] of this.pending) {
            removal.remaining -= dt;
            if (removal.remaining > 0) {
                continue;
            }
            this.commitRemoval(removal);
            this.pending.delete(objectId);
        }
    }

    private commitRemoval(removal: PendingRemoval): void {
        const objectData = removal.objectData;
        if (!objectData || !this.renderer || !this.worldCellGrid) {
            return;
        }

        this.renderer.removeObject(removal.objectId);
        this.worldCellGrid.releaseOwner(removal.objectId);
        console.log(`[WorldObjectLifecycle] removed=${removal.objectId}`);
    }
}
