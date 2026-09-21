import { _decorator, Component, EventTouch, Node, Vec2 } from 'cc';
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
    private touchStart: Vec2 | null = null;
    private touchCancelled = false;

    onEnable(): void {
        this.node.on(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
        this.node.on(Node.EventType.TOUCH_END, this.handleTouchEnd, this);
    }

    onDisable(): void {
        this.node.off(Node.EventType.TOUCH_START, this.handleTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.handleTouchMove, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.handleTouchCancel, this);
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

    private handleTouchStart(event: EventTouch): void {
        this.touchCancelled = event.getAllTouches().length > 1;
        const location = event.getLocation();
        this.touchStart = new Vec2(location.x, location.y);
    }

    private handleTouchMove(event: EventTouch): void {
        if (!this.touchStart) return;
        const location = event.getLocation();
        if (Vec2.distance(this.touchStart, new Vec2(location.x, location.y)) > 8) {
            this.touchCancelled = true;
        }
    }

    private handleTouchCancel(): void {
        this.touchCancelled = true;
        this.touchStart = null;
    }

    private handleTouchEnd(): void {
        if (!this.interactable) {
            return;
        }
        if (this.touchCancelled) {
            this.touchCancelled = false;
            this.touchStart = null;
            return;
        }
        this.touchStart = null;
        this.clickHandler?.(this.objectId);
    }
}
