/**
 * Why this file exists:
 * 固定城市需要把十二个空建筑位和木墙门边渲染为独立于建筑实例的场景层。
 *
 * Ownership boundary:
 * 本文件拥有城市 SpriteFrame 加载、城市节点创建及空槽显隐同步。
 *
 * This file deliberately does NOT:
 * 不决定槽位合法性、不登记占用、不修改导航，也不处理空地点击。
 */
import {
    assetManager,
    Node,
    Sprite,
    SpriteFrame,
    UITransform,
} from 'cc';
import { type BuildingRuntimeRegistry } from '../building/BuildingRuntimeRegistry';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import { gridRectToWorldCenter } from '../grid/GridTransform';
import {
    getCityBoundaryCells,
    getCitySlots,
} from './CityLayout';
import {
    CITY_SPRITE_FRAME_UUIDS,
    getBoundaryVisual,
    type CityVisualKey,
} from './CityVisualConfig';

export class CityRenderer {
    private readonly slotNodes = new Map<string, Node>();
    private unsubscribeRegistry: (() => void) | null = null;
    private registry: BuildingRuntimeRegistry | null = null;

    constructor(
        private readonly root: Node,
        private readonly frames: ReadonlyMap<CityVisualKey, SpriteFrame>,
        private readonly mapWidth: number,
        private readonly mapHeight: number,
    ) {}

    public static async loadFrames(): Promise<ReadonlyMap<CityVisualKey, SpriteFrame>> {
        const entries = await Promise.all(
            Object.entries(CITY_SPRITE_FRAME_UUIDS).map(async ([key, uuid]) => [
                key as CityVisualKey,
                await loadRequiredFrame(key, uuid),
            ] as const),
        );
        return new Map(entries);
    }

    public render(): void {
        this.clearChildren();
        this.slotNodes.clear();
        const slotRoot = this.createRoot('SlotRoot');
        const wallRoot = this.createRoot('WallRoot');
        const emptyFrame = this.requireFrame('emptySlot');
        for (const slot of getCitySlots()) {
            const node = this.createSprite(
                slotRoot,
                `CitySlot_${slot.id}`,
                emptyFrame,
                slot.x,
                slot.y,
                slot.width,
                slot.height,
                false,
            );
            this.slotNodes.set(slot.id, node);
        }
        for (const cell of getCityBoundaryCells()) {
            const visual = getBoundaryVisual(cell);
            this.createSprite(
                wallRoot,
                `CityBoundary_${cell.x}_${cell.y}`,
                this.requireFrame(visual.key),
                cell.x,
                cell.y,
                1,
                1,
                visual.flipX,
            );
        }
        this.refreshSlots();
    }

    public bindRegistry(registry: BuildingRuntimeRegistry): void {
        this.unsubscribeRegistry?.();
        this.registry = registry;
        this.unsubscribeRegistry = registry.subscribe(() => this.refreshSlots());
        this.refreshSlots();
    }

    public refreshSlots(): void {
        const occupied = new Set(
            (this.registry?.getAll() ?? []).map((entry) =>
                `${entry.data.gridX},${entry.data.gridY}`),
        );
        for (const slot of getCitySlots()) {
            this.slotNodes.get(slot.id)!.active = !occupied.has(`${slot.x},${slot.y}`);
        }
    }

    public dispose(): void {
        this.unsubscribeRegistry?.();
        this.unsubscribeRegistry = null;
        this.registry = null;
        this.slotNodes.clear();
        this.clearChildren();
    }

    private createRoot(name: string): Node {
        const node = new Node(name);
        node.setParent(this.root);
        node.layer = this.root.layer;
        node.addComponent(UITransform);
        return node;
    }

    private createSprite(
        parent: Node,
        name: string,
        frame: SpriteFrame,
        gridX: number,
        gridY: number,
        gridWidth: number,
        gridHeight: number,
        flipX: boolean,
    ): Node {
        const node = new Node(name);
        node.setParent(parent);
        node.layer = parent.layer;
        node.setPosition(gridRectToWorldCenter(
            gridX,
            gridY,
            gridWidth,
            gridHeight,
            this.mapWidth,
            this.mapHeight,
        ));
        node.setScale(flipX ? -1 : 1, 1, 1);
        node.addComponent(UITransform).setContentSize(
            gridWidth * GRID_RENDER_SIZE,
            gridHeight * GRID_RENDER_SIZE,
        );
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        return node;
    }

    private requireFrame(key: CityVisualKey): SpriteFrame {
        const frame = this.frames.get(key);
        if (!frame) throw new Error(`[CityRenderer] missing loaded frame: ${key}`);
        return frame;
    }

    private clearChildren(): void {
        for (const child of [...this.root.children]) {
            child.removeFromParent();
            child.destroy();
        }
    }
}

function loadRequiredFrame(key: string, uuid: string): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
        assetManager.loadAny<SpriteFrame>(uuid, (error, frame) => {
            if (error || !frame) {
                reject(new Error(`[CityRenderer] failed to load ${key}: ${uuid}`));
                return;
            }
            resolve(frame);
        });
    });
}
