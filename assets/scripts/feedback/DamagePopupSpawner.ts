import { Node, UITransform, Vec3 } from 'cc';
import { DamagePopupView } from './DamagePopupView';

export class DamagePopupSpawner {
    constructor(private readonly feedbackRoot: Node) {}

    public spawnDamage(targetNode: Node, amount: number): void {
        if (amount <= 0) {
            return;
        }

        const popupNode = new Node(`DamagePopup_${Date.now()}`);
        popupNode.setParent(this.feedbackRoot);
        const worldPosition = targetNode.worldPosition;
        const targetTransform = targetNode.getComponent(UITransform);
        const worldHeight = (targetTransform?.contentSize.height ?? 16) * targetNode.worldScale.y;
        const feedbackTransform = this.feedbackRoot.getComponent(UITransform);
        const local = feedbackTransform?.convertToNodeSpaceAR(
            new Vec3(worldPosition.x, worldPosition.y + worldHeight / 2 + 12, worldPosition.z),
        ) ?? worldPosition;
        popupNode.setPosition(local);
        const popup = popupNode.addComponent(DamagePopupView);
        popup.setup(amount);
    }
}
