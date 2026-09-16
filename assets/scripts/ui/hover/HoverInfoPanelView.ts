/**
 * Why this file exists:
 * Every hover source shares one consistently styled, dynamically sized information panel.
 *
 * Ownership boundary:
 * This file owns panel node creation, text layout, background sizing, and visibility.
 *
 * This file deliberately does NOT:
 * It does not track hover timing, anchors, pointer state, or gameplay objects.
 */
import { Color, Label, Node, Sprite, SpriteFrame, UITransform, Vec3 } from 'cc';
import { type HoverInfoModel } from './HoverInfoTypes';
import {
    HOVER_FOOTER_FONT_SIZE,
    HOVER_FOOTER_LINE_HEIGHT,
    HOVER_HORIZONTAL_PADDING,
    HOVER_PANEL_MIN_HEIGHT,
    HOVER_PANEL_WIDTH,
    HOVER_ROW_FONT_SIZE,
    HOVER_ROW_LINE_HEIGHT,
    HOVER_SECTION_GAP,
    HOVER_SUBTITLE_FONT_SIZE,
    HOVER_SUBTITLE_LINE_HEIGHT,
    HOVER_TITLE_FONT_SIZE,
    HOVER_TITLE_LINE_HEIGHT,
    HOVER_VERTICAL_PADDING,
} from './HoverInfoUiConfig';

export class HoverInfoPanelView {
    private readonly transform: UITransform;
    private readonly background: Sprite;
    private readonly title: Label;
    private readonly subtitle: Label;
    private readonly rowsRoot: Node;
    private readonly footer: Label;
    private height = HOVER_PANEL_MIN_HEIGHT;

    constructor(public readonly node: Node, backgroundFrame: SpriteFrame | null) {
        this.transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        this.transform.setAnchorPoint(0.5, 0.5);
        const backgroundNode = this.getChild(node, 'Background');
        this.background = backgroundNode.getComponent(Sprite) ?? backgroundNode.addComponent(Sprite);
        this.background.sizeMode = Sprite.SizeMode.CUSTOM;
        this.background.type = backgroundFrame ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        this.background.spriteFrame = backgroundFrame;
        this.background.color = backgroundFrame ? Color.WHITE : new Color(24, 27, 30, 245);
        this.title = this.makeLabel('Title', HOVER_TITLE_FONT_SIZE, HOVER_TITLE_LINE_HEIGHT, new Color(255, 238, 186), node);
        this.subtitle = this.makeLabel('Subtitle', HOVER_SUBTITLE_FONT_SIZE, HOVER_SUBTITLE_LINE_HEIGHT, new Color(190, 198, 202), node);
        this.rowsRoot = this.getChild(node, 'RowsRoot');
        this.footer = this.makeLabel('Footer', HOVER_FOOTER_FONT_SIZE, HOVER_FOOTER_LINE_HEIGHT, new Color(166, 174, 178), node);
        this.setVisible(false);
    }

    public setVisible(visible: boolean): void {
        this.node.active = visible;
    }

    public isVisible(): boolean {
        return this.node.active;
    }

    public getSize(): Readonly<{ width: number; height: number }> {
        return { width: HOVER_PANEL_WIDTH, height: this.height };
    }

    public setWorldPosition(x: number, y: number): void {
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const local = parentTransform?.convertToNodeSpaceAR(new Vec3(x, y, 0)) ?? new Vec3(x, y, 0);
        this.node.setPosition(local);
    }

    public setModel(model: HoverInfoModel): void {
        this.title.string = model.title;
        this.subtitle.string = model.subtitle ?? '';
        this.subtitle.node.active = !!model.subtitle;
        for (const child of [...this.rowsRoot.children]) {
            child.removeFromParent();
            child.destroy();
        }
        for (const row of model.rows ?? []) {
            const text = row.label ? `${row.label}    ${row.value}` : row.value;
            this.makeLabel(`Row_${this.rowsRoot.children.length}`, HOVER_ROW_FONT_SIZE, HOVER_ROW_LINE_HEIGHT, Color.WHITE, this.rowsRoot).string = text;
        }
        this.footer.string = model.footer ?? '';
        this.footer.node.active = !!model.footer;
        this.layout(model.rows?.length ?? 0);
    }

    private layout(rowCount: number): void {
        const contentWidth = HOVER_PANEL_WIDTH - HOVER_HORIZONTAL_PADDING * 2;
        let cursor = -HOVER_VERTICAL_PADDING;
        this.positionLabel(this.title, cursor, contentWidth, HOVER_TITLE_LINE_HEIGHT);
        cursor -= HOVER_TITLE_LINE_HEIGHT;
        if (this.subtitle.node.active) {
            cursor -= HOVER_SECTION_GAP;
            this.positionLabel(this.subtitle, cursor, contentWidth, HOVER_SUBTITLE_LINE_HEIGHT);
            cursor -= HOVER_SUBTITLE_LINE_HEIGHT;
        }
        if (rowCount > 0) cursor -= HOVER_SECTION_GAP;
        this.rowsRoot.setPosition(-HOVER_PANEL_WIDTH / 2 + HOVER_HORIZONTAL_PADDING, cursor, 0);
        this.rowsRoot.children.forEach((child, index) => {
            const transform = child.getComponent(UITransform);
            transform?.setContentSize(contentWidth, HOVER_ROW_LINE_HEIGHT);
            child.setPosition(0, -index * HOVER_ROW_LINE_HEIGHT, 0);
        });
        cursor -= rowCount * HOVER_ROW_LINE_HEIGHT;
        if (this.footer.node.active) {
            cursor -= HOVER_SECTION_GAP;
            this.positionLabel(this.footer, cursor, contentWidth, HOVER_FOOTER_LINE_HEIGHT);
            cursor -= HOVER_FOOTER_LINE_HEIGHT;
        }
        this.height = Math.max(HOVER_PANEL_MIN_HEIGHT, HOVER_VERTICAL_PADDING - cursor + HOVER_VERTICAL_PADDING);
        this.transform.setContentSize(HOVER_PANEL_WIDTH, this.height);
        this.background.node.getComponent(UITransform)?.setContentSize(HOVER_PANEL_WIDTH, this.height);
        this.background.node.setPosition(0, 0, 0);
        const top = this.height / 2;
        this.title.node.setPosition(this.title.node.position.x, top + this.title.node.position.y, 0);
        if (this.subtitle.node.active) this.subtitle.node.setPosition(this.subtitle.node.position.x, top + this.subtitle.node.position.y, 0);
        this.rowsRoot.setPosition(this.rowsRoot.position.x, top + this.rowsRoot.position.y, 0);
        if (this.footer.node.active) this.footer.node.setPosition(this.footer.node.position.x, top + this.footer.node.position.y, 0);
    }

    private positionLabel(label: Label, topY: number, width: number, height: number): void {
        label.node.getComponent(UITransform)?.setContentSize(width, height);
        label.node.setPosition(-HOVER_PANEL_WIDTH / 2 + HOVER_HORIZONTAL_PADDING, topY - height / 2, 0);
    }

    private makeLabel(name: string, fontSize: number, lineHeight: number, color: Color, parent: Node): Label {
        const node = this.getChild(parent, name);
        const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
        transform.setAnchorPoint(0, 0.5);
        const label = node.getComponent(Label) ?? node.addComponent(Label);
        label.fontSize = fontSize;
        label.lineHeight = lineHeight;
        label.color = color;
        label.horizontalAlign = Label.HorizontalAlign.LEFT;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.CLAMP;
        return label;
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
