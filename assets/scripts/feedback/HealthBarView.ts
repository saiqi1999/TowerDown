import {
    _decorator,
    Component,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
} from 'cc';
import { type HealthComponent } from '../combat/HealthComponent';
import {
    createHealthBarFrame,
    HealthBarPart,
} from './HealthBarSpriteConfig';

const { ccclass } = _decorator;

export interface HealthBarViewConfig {
    health: HealthComponent;
    texture: Texture2D;
    localOffsetY: number;
}

@ccclass('HealthBarView')
export class HealthBarView extends Component {
    private health: HealthComponent | null = null;
    private unsubscribe: (() => void) | null = null;
    private fill: Sprite | null = null;
    private barRoot: Node | null = null;

    public setup(config: HealthBarViewConfig): void {
        this.health = config.health;
        this.barRoot?.destroy();
        const barRoot = new Node('HealthBar');
        barRoot.setParent(this.node);
        barRoot.setPosition(0, config.localOffsetY, 0);
        barRoot.setScale(1, 1, 1);
        this.barRoot = barRoot;

        const parts: Array<[HealthBarPart, string]> = [
            [HealthBarPart.Top, 'TopBorder'],
            [HealthBarPart.Bottom, 'BottomBorder'],
            [HealthBarPart.Left, 'LeftBorder'],
            [HealthBarPart.Right, 'RightBorder'],
        ];
        for (const [part, name] of parts) {
            this.addSprite(name, createHealthBarFrame(config.texture, part), this.getPartPosition(part));
        }
        this.fill = this.addSprite(
            'Fill',
            createHealthBarFrame(config.texture, HealthBarPart.Fill),
            { x: 0, y: 0 },
        );
        this.fill.type = Sprite.Type.FILLED;
        this.fill.fillType = Sprite.FillType.HORIZONTAL;
        this.fill.fillStart = 0;

        this.unsubscribe?.();
        this.unsubscribe = this.health.subscribe((current, max) => {
            if (this.fill) {
                this.fill.fillRange = max <= 0 ? 0 : current / max;
            }
        });
    }

    onDestroy(): void {
        this.unsubscribe?.();
        this.unsubscribe = null;
        this.health = null;
        this.fill = null;
        this.barRoot = null;
    }

    private addSprite(
        name: string,
        frame: SpriteFrame,
        position: { x: number; y: number },
    ): Sprite {
        const child = new Node(name);
        child.setParent(this.barRoot ?? this.node);
        child.setPosition(position.x, position.y, 0);
        const transform = child.addComponent(UITransform);
        transform.setContentSize(frame.rect.width, frame.rect.height);
        const sprite = child.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = frame;
        return sprite;
    }

    private getPartPosition(part: HealthBarPart): { x: number; y: number } {
        switch (part) {
        case HealthBarPart.Top:
            return { x: 0, y: 1.5 };
        case HealthBarPart.Bottom:
            return { x: 0, y: -1.5 };
        case HealthBarPart.Left:
            return { x: -8.5, y: 0 };
        case HealthBarPart.Right:
            return { x: 8.5, y: 0 };
        default:
            return { x: 0, y: 0 };
        }
    }
}
