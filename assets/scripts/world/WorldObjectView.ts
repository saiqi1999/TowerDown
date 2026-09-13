import { _decorator, Component, Node } from 'cc';
import { ResourceType, WorldObjectKind } from './WorldObjectTypes';

const { ccclass } = _decorator;

@ccclass('WorldObjectView')
export class WorldObjectView extends Component {
    public objectId = '';
    public kind = WorldObjectKind.Resource;
    public gridX = 0;
    public gridY = 0;
    public gridW = 1;
    public gridH = 1;
    public resourceType: ResourceType | null = null;
    private interactable = true;
    private clickHandler: ((objectId: string) => void) | null = null;

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    public bindClickHandler(
        handler: (objectId: string) => void,
    ): void {
        this.clickHandler = handler;
    }

    public setInteractable(value: boolean): void {
        this.interactable = value;
    }

    private handleTouchEnd(): void {
        if (!this.interactable) {
            return;
        }
        this.clickHandler?.(this.objectId);
    }
}
