/**
 * Why this file exists:
 * Placed world objects need click feedback without mixing that behavior into gameplay command routing.
 *
 * Ownership boundary:
 * This file owns a small touch-distance filter and delegates visual click feedback.
 *
 * This file deliberately does NOT:
 * It does not issue commands, select targets, or alter hover state.
 */
import { _decorator, Component, EventTouch, Node } from 'cc';
import { InteractionFeedbackView } from './InteractionFeedbackView';

const { ccclass } = _decorator;

const CLICK_DRAG_THRESHOLD_PIXELS = 8;

@ccclass('FeedbackClickTarget')
export class FeedbackClickTarget extends Component {
    private feedback: InteractionFeedbackView | null = null;
    private startX = 0;
    private startY = 0;
    private tracking = false;

    public setup(feedback: InteractionFeedbackView): void {
        this.teardown();
        this.feedback = feedback;
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    protected onDisable(): void {
        this.tracking = false;
    }

    protected onDestroy(): void {
        this.teardown();
    }

    private onTouchStart(event: EventTouch): void {
        const location = event.getUILocation();
        this.startX = location.x;
        this.startY = location.y;
        this.tracking = true;
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.tracking) {
            return;
        }
        const location = event.getUILocation();
        const dx = location.x - this.startX;
        const dy = location.y - this.startY;
        if (Math.sqrt(dx * dx + dy * dy) > CLICK_DRAG_THRESHOLD_PIXELS) {
            this.tracking = false;
        }
    }

    private onTouchCancel(): void {
        this.tracking = false;
    }

    private onTouchEnd(): void {
        if (this.tracking) {
            this.feedback?.playClick();
        }
        this.tracking = false;
    }

    private teardown(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.feedback = null;
        this.tracking = false;
    }
}
