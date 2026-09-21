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

export class BasePanelView {
    private readonly transform: UITransform;
    private readonly returnNode: Node;
    private readonly panelNode: Node;

    constructor(
        root: Node,
        backgroundFrame: SpriteFrame | null,
        onReturn: () => void,
    ) {
        this.panelNode = root;
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
        this.returnNode.on(Node.EventType.TOUCH_END, onReturn);
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
    }

    public dispose(): void {
        this.returnNode.off(Node.EventType.TOUCH_END);
    }

    private getChild(parent: Node, name: string): Node {
        const child = parent.getChildByName(name) ?? new Node(name);
        if (!child.parent) {
            child.setParent(parent);
            child.layer = parent.layer;
        }
        return child;
    }
}
