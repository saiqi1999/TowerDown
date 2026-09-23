/**
 * Why this file exists:
 * 框选指令需要一个不参与世界缩放和平移的屏幕空间选区反馈。
 *
 * Ownership boundary:
 * 本组件只绘制并控制一个半透明选择矩形的屏幕坐标、尺寸和显隐。
 *
 * This file deliberately does NOT:
 * 不读取输入、不筛选游戏对象、不创建队伍指令。
 */
import { _decorator, Color, Component, Graphics, UITransform, Vec2 } from 'cc';

const { ccclass } = _decorator;

@ccclass('WorldSelectionBox')
export class WorldSelectionBox extends Component {
    private graphics: Graphics | null = null;
    private transform: UITransform | null = null;

    protected onLoad(): void {
        this.transform = this.getComponent(UITransform) ?? this.addComponent(UITransform);
        this.graphics = this.getComponent(Graphics) ?? this.addComponent(Graphics);
        this.node.setSiblingIndex(this.node.parent?.children.length ?? 0);
        this.node.active = false;
    }

    public show(start: Vec2, end: Vec2, _windowId: number): void {
        if (!this.transform || !this.graphics) return;
        const minX = Math.min(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const width = Math.abs(end.x - start.x);
        const height = Math.abs(end.y - start.y);
        const parentTransform = this.node.parent?.getComponent(UITransform);
        const parentSize = parentTransform?.contentSize;
        const center = new Vec2(minX + width / 2, minY + height / 2);
        // getUILocation() uses the Canvas bottom-left origin; HUDRoot is centered.
        const localX = center.x - (parentSize?.width ?? 1280) / 2;
        const localY = center.y - (parentSize?.height ?? 720) / 2;
        this.node.setPosition(localX, localY, 0);
        this.transform.setContentSize(width, height);
        this.graphics.clear();
        this.graphics.fillColor = new Color(90, 210, 185, 42);
        this.graphics.strokeColor = new Color(125, 245, 220, 220);
        this.graphics.lineWidth = 2;
        this.graphics.rect(-width / 2, -height / 2, width, height);
        this.graphics.fill();
        this.graphics.stroke();
        this.node.active = true;
    }

    public hide(): void {
        this.graphics?.clear();
        this.node.active = false;
    }
}
