import {
    _decorator,
    Component,
    Label,
    LabelOutline,
    Node,
    UIOpacity,
    UITransform,
} from 'cc';

const { ccclass } = _decorator;
const LIFETIME = 0.6;
const RISE_DISTANCE = 24;

@ccclass('DamagePopupView')
export class DamagePopupView extends Component {
    private elapsed = 0;
    private opacity: UIOpacity | null = null;

    public setup(amount: number): void {
        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(64, 24);
        const label = this.node.addComponent(Label);
        label.string = `-${amount}`;
        label.fontSize = 16;
        label.lineHeight = 20;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        const outline = this.node.addComponent(LabelOutline);
        outline.width = 2;
        outline.color.set(20, 20, 20, 255);
        this.opacity = this.node.addComponent(UIOpacity);
    }

    update(dt: number): void {
        this.elapsed += dt;
        this.node.setPosition(
            this.node.position.x,
            this.node.position.y + (RISE_DISTANCE / LIFETIME) * dt,
            this.node.position.z,
        );
        if (this.opacity) {
            this.opacity.opacity = Math.max(0, 255 * (1 - this.elapsed / LIFETIME));
        }
        if (this.elapsed >= LIFETIME) {
            this.node.destroy();
        }
    }
}
