/**
 * Why this file exists:
 * BuildBar 负责把可用蓝图变成可点击入口，并将选择交给 BuildToolController。
 *
 * Ownership boundary:
 * 本文件拥有 BuildBar item 的创建与布局。
 *
 * This file deliberately does NOT:
 * 不提交建筑、不维护 Ghost、不修改资源。
 */
import { Color, Node, Sprite, SpriteFrame, Texture2D, UITransform } from 'cc';
import { getAllBuildingDefinitions } from './BuildingCatalog';
import { BuildingBlueprintInventory } from './BuildingBlueprintInventory';
import { BuildingSpriteFrameFactory } from './BuildingSpriteFrameFactory';
import { BuildToolController } from './BuildToolController';
import { BuildBarItemView } from './BuildBarItemView';
export class BuildBarController {
    private unsubscribe: (() => void) | null = null;
    constructor(
        private readonly root: Node,
        private readonly inventory: BuildingBlueprintInventory,
        private readonly factory: BuildingSpriteFrameFactory,
        private readonly tool: BuildToolController,
        private readonly backgroundTexture: Texture2D | null = null,
    ) {}
    public setup(): void {
        const transform = this.root.getComponent(UITransform) ?? this.root.addComponent(UITransform);
        transform.setContentSize(300, 58);
        this.root.setPosition(0, -315, 0);
        const background = this.root.getComponent(Sprite) ?? this.root.addComponent(Sprite);
        background.color = new Color(40, 45, 48, 220);
        if (this.backgroundTexture) {
            const frame = new SpriteFrame();
            frame.texture = this.backgroundTexture;
            background.spriteFrame = frame;
            background.sizeMode = Sprite.SizeMode.CUSTOM;
        }
        this.unsubscribe = this.inventory.subscribe((ids) => this.render(ids));
    }
    public destroy(): void { this.unsubscribe?.(); this.unsubscribe = null; }
    private render(ids: readonly string[]): void {
        this.root.removeAllChildren();
        const unlocked = ids.length ? ids : getAllBuildingDefinitions().map((definition) => definition.id);
        unlocked.forEach((id, index) => {
            const definition = getAllBuildingDefinitions().find((item) => item.id === id);
            if (!definition) return;
            const node = new Node(`BuildBarItem_${id}`);
            node.setParent(this.root);
            node.setPosition(-102 + index * 68, 0, 0);
            const item = node.addComponent(BuildBarItemView);
            item.setup(definition, this.factory, () => this.tool.select(id));
        });
    }
}
