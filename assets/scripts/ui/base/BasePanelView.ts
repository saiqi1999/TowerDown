/**
 * Why this file exists:
 * 达到击杀阈值后需要一个独立的全屏基地面板，视觉沿用 Hover 背景但尺寸和交互独立。
 *
 * Ownership boundary:
 * 本文件只拥有 BasePanel 节点、九宫格背景和唯一“返回”链接的布局。
 *
 * This file deliberately does NOT:
 * 不决定面板何时打开、不读取击杀计数、不暂停游戏模拟。
 */
import { BlockInputEvents, Color, Label, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { ResourceType } from '../../world/WorldObjectTypes';
import { type FloorPreview } from '../../map/StaticFloorCatalog';

export class BasePanelView {
    private readonly transform: UITransform;
    private readonly returnNode: Node;
    private readonly panelNode: Node;
    private readonly backgroundFrame: SpriteFrame | null;
    private readonly destinationNodes: Node[] = [];
    private chooseHandler: ((id: string) => void) | null = null;
    private busy = false;

    constructor(
        root: Node,
        backgroundFrame: SpriteFrame | null,
        onReturn: () => void,
    ) {
        this.panelNode = root;
        this.backgroundFrame = backgroundFrame;
        this.transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        root.addComponent(BlockInputEvents);
        const backgroundNode = this.getChild(root, 'Background');
        const background = backgroundNode.getComponent(Sprite) ?? backgroundNode.addComponent(Sprite);
        const backgroundTransform = backgroundNode.getComponent(UITransform)
            ?? backgroundNode.addComponent(UITransform);
        backgroundTransform.setAnchorPoint(0.5, 0.5);
        background.type = backgroundFrame ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        background.spriteFrame = backgroundFrame;
        background.color = backgroundFrame ? Color.WHITE : new Color(24, 27, 30, 245);
        this.returnNode = this.getChild(root, 'ReturnLink');
        const returnTransform = this.returnNode.getComponent(UITransform)
            ?? this.returnNode.addComponent(UITransform);
        returnTransform.setContentSize(100, 44);
        const label = this.returnNode.getComponent(Label) ?? this.returnNode.addComponent(Label);
        label.string = '返回';
        label.fontSize = 18;
        label.lineHeight = 22;
        label.color = new Color(150, 210, 255, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        this.returnNode.on(Node.EventType.TOUCH_END, () => {
            if (!this.busy) onReturn();
        });
        this.destinationNodes.push(this.createDestination('LeftDestination'));
        this.destinationNodes.push(this.createDestination('RightDestination'));
        this.layout();
        this.setVisible(false);
    }

    public setVisible(visible: boolean): void {
        this.panelNode.active = visible;
    }

    public isVisible(): boolean {
        return this.panelNode.active;
    }

    public getRoot(): Node {
        return this.panelNode;
    }

    public layout(): void {
        const parentSize = this.panelNode.parent?.getComponent(UITransform)?.contentSize;
        const width = Math.max(0, (parentSize?.width ?? 1280) - 32);
        const height = Math.max(0, (parentSize?.height ?? 720) - 32);
        this.transform.setContentSize(width, height);
        const background = this.panelNode.getChildByName('Background');
        background?.getComponent(UITransform)?.setContentSize(width, height);
        this.returnNode.setPosition(0, -height / 2 + 24 + 22, 0);
        const cardWidth = Math.min(360, Math.max(220, (width - 48) / 2));
        const cardHeight = Math.min(380, Math.max(220, height - 120));
        this.destinationNodes[0]?.setPosition(-cardWidth / 2 - 24, 20, 0);
        this.destinationNodes[1]?.setPosition(cardWidth / 2 + 24, 20, 0);
        for (const node of this.destinationNodes) {
            node.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
            node.getChildByName('Background')?.getComponent(UITransform)?.setContentSize(cardWidth, cardHeight);
        }
    }

    public setDestinations(previews: readonly FloorPreview[], onChoose: (id: string) => void): void {
        this.chooseHandler = onChoose;
        for (let index = 0; index < this.destinationNodes.length; index += 1) {
            const node = this.destinationNodes[index]!;
            const preview = previews[index];
            node.active = !!preview;
            if (!preview) continue;
            const title = node.getChildByName('Title')?.getComponent(Label);
            if (title) title.string = preview.displayName;
        const detail = node.getChildByName('Detail')?.getComponent(Label);
            if (detail) detail.string = this.formatPreview(preview);
            node.off(Node.EventType.TOUCH_END);
            node.on(Node.EventType.TOUCH_END, () => {
                if (!this.busy) this.chooseHandler?.(preview.id);
            });
        }
    }

    public setBusy(value: boolean): void {
        this.busy = value;
        this.returnNode.getComponent(Label)!.string = value ? '进入中…' : '返回';
        for (const node of this.destinationNodes) node.getComponent(UITransform)!.enabled = !value;
    }

    public setError(message: string | null): void {
        const error = this.getChild(this.panelNode, 'Error');
        const label = error.getComponent(Label) ?? error.addComponent(Label);
        label.string = message ?? '';
        error.active = !!message;
    }

    public dispose(): void {
        this.returnNode.off(Node.EventType.TOUCH_END);
        for (const node of this.destinationNodes) node.off(Node.EventType.TOUCH_END);
        this.chooseHandler = null;
    }

    private getChild(parent: Node, name: string): Node {
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) {
            child.setParent(parent);
            child.layer = parent.layer;
        }
        return child;
    }

    private createDestination(name: string): Node {
        const node = this.getChild(this.panelNode, name);
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setAnchorPoint(0.5, 0.5);
        const backgroundNode = this.getChild(node, 'Background');
        const background = backgroundNode.getComponent(Sprite) ?? backgroundNode.addComponent(Sprite);
        background.type = Sprite.Type.SLICED;
        background.sizeMode = Sprite.SizeMode.CUSTOM;
        background.spriteFrame = this.backgroundFrame;
        background.color = this.backgroundFrame ? Color.WHITE : new Color(24, 27, 30, 245);
        const titleNode = this.getChild(node, 'Title');
        const title = titleNode.getComponent(Label) ?? titleNode.addComponent(Label);
        title.fontSize = 20;
        title.lineHeight = 26;
        title.color = new Color(255, 238, 186);
        title.horizontalAlign = Label.HorizontalAlign.CENTER;
        title.verticalAlign = Label.VerticalAlign.CENTER;
        titleNode.getComponent(UITransform)?.setContentSize(320, 40);
        titleNode.setPosition(0, 110, 0);
        const detailNode = this.getChild(node, 'Detail');
        const detail = detailNode.getComponent(Label) ?? detailNode.addComponent(Label);
        detail.fontSize = 15;
        detail.lineHeight = 24;
        detail.color = Color.WHITE;
        detail.horizontalAlign = Label.HorizontalAlign.CENTER;
        detail.verticalAlign = Label.VerticalAlign.CENTER;
        detailNode.getComponent(UITransform)?.setContentSize(320, 180);
        detailNode.setPosition(0, -10, 0);
        return node;
    }

    private formatPreview(preview: FloorPreview): string {
        const names: Record<number, string> = {
            [ResourceType.Wood]: '木头',
            [ResourceType.Stone]: '石头',
            [ResourceType.Food]: '食物',
            [ResourceType.Gold]: '黄金',
        };
        const rows: string[] = [];
        for (const [type, count] of preview.resourceCounts) rows.push(`${names[type]}×${count}个资源点`);
        rows.push(`敌怪人数×${preview.monsterCount}`);
        rows.push('点击进入');
        return rows.join('\n');
    }
}
