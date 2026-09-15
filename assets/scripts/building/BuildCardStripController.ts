/**
 * Why this file exists:
 * 本次 Run 已解锁的建筑蓝图需要以底部紧凑卡片形式动态生成，
 * 并同步 affordability 与当前 BuildTool selected 状态。
 *
 * Ownership boundary:
 * 本文件拥有 Blueprint Card 列表的创建、横向布局和状态同步。
 *
 * This file deliberately does NOT:
 * 不拥有 Blueprint 解锁真相、不拥有 Build Mode 状态、不扣资源、
 * 不判断地图 placement 合法性。
 */
import { Node, SpriteFrame, UITransform } from 'cc';
import { ResourceInventory, type ResourceInventorySnapshot } from '../economy/ResourceInventory';
import { getAllBuildingDefinitions } from './BuildingCatalog';
import { BuildingBlueprintInventory } from './BuildingBlueprintInventory';
import { BuildingBlueprintCardView } from './BuildingBlueprintCardView';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import { BuildToolController, type BuildToolState } from './BuildToolController';
import { BLUEPRINT_CARD_BOTTOM_MARGIN, BLUEPRINT_CARD_GAP, BLUEPRINT_CARD_HEIGHT, BLUEPRINT_CARD_WIDTH } from './BuildCardUiConfig';

export class BuildCardStripController {
    private blueprintUnsubscribe: (() => void) | null = null;
    private toolUnsubscribe: (() => void) | null = null;
    private inventoryUnsubscribe: (() => void) | null = null;
    private readonly cardViews = new Map<string, BuildingBlueprintCardView>();

    constructor(
        private readonly root: Node,
        private readonly blueprints: BuildingBlueprintInventory,
        private readonly inventory: ResourceInventory,
        private readonly factory: BuildingSpriteFrameFactory,
        private readonly tool: BuildToolController,
        private readonly cardFrame: SpriteFrame | null,
    ) {}

    public setup(): void {
        const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
        transform.setContentSize(BLUEPRINT_CARD_WIDTH * 4 + BLUEPRINT_CARD_GAP * 3, BLUEPRINT_CARD_HEIGHT);
        const hudHeight = this.root.parent?.getComponent(UITransform)?.contentSize.height ?? 720;
        this.root.setPosition(0, -hudHeight / 2 + BLUEPRINT_CARD_BOTTOM_MARGIN + BLUEPRINT_CARD_HEIGHT / 2, 0);
        this.blueprintUnsubscribe = this.blueprints.subscribe((ids) => this.render(ids));
        this.toolUnsubscribe = this.tool.subscribeState((state) => this.syncSelected(state));
        this.inventoryUnsubscribe = this.inventory.subscribe((snapshot) => this.syncAffordable(snapshot));
    }

    public destroy(): void {
        this.blueprintUnsubscribe?.();
        this.toolUnsubscribe?.();
        this.inventoryUnsubscribe?.();
        this.cardViews.clear();
    }

    private render(ids: readonly string[]): void {
        this.root.removeAllChildren();
        this.cardViews.clear();
        const unlocked = ids.length ? ids : getAllBuildingDefinitions().map((definition) => definition.id);
        const totalWidth = unlocked.length * BLUEPRINT_CARD_WIDTH + Math.max(0, unlocked.length - 1) * BLUEPRINT_CARD_GAP;
        (this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform))
            .setContentSize(totalWidth, BLUEPRINT_CARD_HEIGHT);
        unlocked.forEach((id, index) => {
            const definition = getAllBuildingDefinitions().find((item) => item.id === id);
            if (!definition) return;
            const node = new Node(`Card_${id}`);
            node.setParent(this.root);
            node.setPosition(-totalWidth / 2 + BLUEPRINT_CARD_WIDTH / 2 + index * (BLUEPRINT_CARD_WIDTH + BLUEPRINT_CARD_GAP), 0, 0);
            const view = node.addComponent(BuildingBlueprintCardView);
            view.setup(definition, this.factory, this.cardFrame, () => this.tool.select(id));
            this.cardViews.set(id, view);
        });
        this.syncSelected(this.tool.getState());
        this.syncAffordable();
    }

    private syncSelected(state: BuildToolState): void {
        for (const [id, view] of this.cardViews) view.setSelected(state.active && state.definitionId === id);
    }

    private syncAffordable(_snapshot?: ResourceInventorySnapshot): void {
        for (const [id, view] of this.cardViews) {
            const definition = getAllBuildingDefinitions().find((item) => item.id === id);
            if (definition) view.setAffordable(this.inventory.canAfford(definition.cost));
        }
    }
}
