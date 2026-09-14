/**
 * Why this file exists:
 * BuildBar 负责最终尺寸、蓝图 item 布局和当前选择状态同步。
 *
 * Ownership boundary:
 * 本文件拥有 BuildBar item 的创建、布局和 selected View 状态。
 *
 * This file deliberately does NOT:
 * 不提交建筑、不维护 Ghost、不修改资源或放置规则。
 */
import { Color, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { getAllBuildingDefinitions } from './BuildingCatalog';
import { BuildingBlueprintInventory } from './BuildingBlueprintInventory';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import { BuildToolController, type BuildToolState } from './BuildToolController';
import { BuildBarItemView } from './BuildBarItemView';
import { BUILD_BAR_BOTTOM_MARGIN, BUILD_BAR_HEIGHT, BUILD_BAR_WIDTH, BUILD_ITEM_GAP, BUILD_ITEM_WIDTH, ERA_SLOT_WIDTH } from './BuildUiConfig';

export class BuildBarController {
    private inventoryUnsubscribe: (() => void) | null = null;
    private stateUnsubscribe: (() => void) | null = null;
    private readonly itemViews = new Map<string, BuildBarItemView>();
    private buildItemRoot: Node | null = null;

    constructor(
        private readonly root: Node,
        private readonly inventory: BuildingBlueprintInventory,
        private readonly factory: BuildingSpriteFrameFactory,
        private readonly tool: BuildToolController,
        private readonly backgroundTexture: Texture2D | null = null,
    ) {}

    public setup(): void {
        // const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
        // transform.setContentSize(BUILD_BAR_WIDTH, BUILD_BAR_HEIGHT);
        const transform =
        this.root.getComponent(UITransform)
        ?? this.root.addComponent(UITransform);

        const background =
            this.root.getComponent(Sprite)
            ?? this.root.addComponent(Sprite);

        // 必须先进入 CUSTOM
        background.sizeMode = Sprite.SizeMode.CUSTOM;

        if (this.backgroundTexture) {
            const frame = new SpriteFrame();
            frame.texture = this.backgroundTexture;
            background.spriteFrame = frame;
        }

        // 最后再设置最终尺寸，最保险
        transform.setContentSize(
        BUILD_BAR_WIDTH,
        BUILD_BAR_HEIGHT,
    );
        const hudHeight = this.root.parent?.getComponent(UITransform)?.contentSize.height ?? 720;
        this.root.setPosition(0, -hudHeight / 2 + BUILD_BAR_BOTTOM_MARGIN + BUILD_BAR_HEIGHT / 2, 0);
        // const background = this.root.getComponent(Sprite) ?? this.root.addComponent(Sprite);
        // background.color = new Color(40, 45, 48, 220);
        if (this.backgroundTexture) {
            const frame = new SpriteFrame();
            frame.texture = this.backgroundTexture;
            background.spriteFrame = frame;
            background.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        const eraSlot = this.root.getChildByName('EraBadgeSlot') ?? new Node('EraBadgeSlot');
        if (!eraSlot.parent) eraSlot.setParent(this.root);
        eraSlot.setPosition(-BUILD_BAR_WIDTH / 2 + ERA_SLOT_WIDTH / 2, 0, 0);
        (eraSlot.getComponent(UITransform) ?? eraSlot.addComponent(UITransform)).setContentSize(ERA_SLOT_WIDTH, BUILD_BAR_HEIGHT - 24);
        this.buildItemRoot = this.root.getChildByName('BuildItemRoot') ?? new Node('BuildItemRoot');
        if (!this.buildItemRoot.parent) this.buildItemRoot.setParent(this.root);
        this.inventoryUnsubscribe = this.inventory.subscribe((ids) => this.render(ids));
        this.stateUnsubscribe = this.tool.subscribeState((state) => this.syncSelected(state));
        this.tool.setInputExcludedNode(this.root);
    }
    public destroy(): void {
        this.inventoryUnsubscribe?.();
        this.stateUnsubscribe?.();
        this.inventoryUnsubscribe = null;
        this.stateUnsubscribe = null;
        this.itemViews.clear();
    }
    private render(ids: readonly string[]): void {
        if (!this.buildItemRoot) return;
        this.buildItemRoot.removeAllChildren();
        this.itemViews.clear();
        const unlocked = ids.length ? ids : getAllBuildingDefinitions().map((definition) => definition.id);
        const contentLeft = -BUILD_BAR_WIDTH / 2 + ERA_SLOT_WIDTH;
        unlocked.forEach((id, index) => {
            const definition = getAllBuildingDefinitions().find((item) => item.id === id);
            if (!definition) return;
            const node = new Node(`BuildBarItem_${id}`);
            node.setParent(this.buildItemRoot);
            node.setPosition(contentLeft + BUILD_ITEM_WIDTH / 2 + index * (BUILD_ITEM_WIDTH + BUILD_ITEM_GAP), 0, 0);
            const item = node.addComponent(BuildBarItemView);
            item.setup(definition, this.factory, () => this.tool.select(id));
            this.itemViews.set(id, item);
        });
        this.syncSelected(this.tool.getState());
    }
    private syncSelected(state: BuildToolState): void {
        for (const [id, item] of this.itemViews) item.setSelected(state.active && state.definitionId === id);
    }
}
