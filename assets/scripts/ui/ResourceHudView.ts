import { _decorator, Component, Label, Node, UITransform } from 'cc';
import {
    type ResourceInventory,
    type ResourceInventorySnapshot,
} from '../economy/ResourceInventory';

const { ccclass } = _decorator;

@ccclass('ResourceHudView')
export class ResourceHudView extends Component {
    private unsubscribe: (() => void) | null = null;
    private label: Label | null = null;

    public setup(inventory: ResourceInventory): void {
        const transform = this.node.getComponent(UITransform)
            ?? this.node.addComponent(UITransform);
        transform.setContentSize(680, 42);
        this.node.setPosition(0, 320, 0);
        this.label = this.node.getComponent(Label) ?? this.node.addComponent(Label);
        this.label.fontSize = 20;
        this.label.lineHeight = 28;
        this.label.horizontalAlign = Label.HorizontalAlign.CENTER;
        this.label.verticalAlign = Label.VerticalAlign.CENTER;
        this.unsubscribe?.();
        this.unsubscribe = inventory.subscribe((snapshot) => this.render(snapshot));
    }

    onDestroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.label = null;
    }

    private render(snapshot: ResourceInventorySnapshot): void {
        if (this.label) {
            this.label.string = `木材 ${snapshot.wood}    石材 ${snapshot.stone}    食物 ${snapshot.food}    黄金 ${snapshot.gold}`;
        }
    }
}
