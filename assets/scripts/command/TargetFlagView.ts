import {
    _decorator,
    Component,
    Sprite,
    type SpriteFrame,
    UITransform,
} from 'cc';
import { GRID_RENDER_SCALE } from '../grid/GridConfig';
import { gridPointToWorld } from '../grid/GridTransform';
import { type WorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { TARGET_FLAG_FRAME_COUNT, TARGET_FLAG_FRAME_SIZE } from './TargetFlagSpriteConfig';

const { ccclass } = _decorator;

const FLAG_VERTICAL_OFFSET = 10;

@ccclass('TargetFlagView')
export class TargetFlagView extends Component {
    private sprite: Sprite | null = null;
    private frames: SpriteFrame[] = [];
    private frameIndex = 0;
    private frameTimer = 0;
    private frameDuration = 0.12;

    public setup(frames: SpriteFrame[]): void {
        this.frames = frames;
        this.node.setScale(GRID_RENDER_SCALE, GRID_RENDER_SCALE, 1);

        const transform = this.node.getComponent(UITransform) ?? this.node.addComponent(UITransform);
        transform.setContentSize(TARGET_FLAG_FRAME_SIZE, TARGET_FLAG_FRAME_SIZE);

        this.sprite = this.node.getComponent(Sprite) ?? this.node.addComponent(Sprite);
        this.sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
        this.node.active = false;
    }

    public showAtObject(
        target: WorldObjectData,
        visual: WorldVisualDefinition,
        mapWidth: number,
        mapHeight: number,
    ): void {
        this.node.active = true;
        const worldPosition = gridPointToWorld(
            target.gridX + visual.w / 2,
            target.gridY,
            mapWidth,
            mapHeight,
        );
        this.node.setPosition(
            worldPosition.x,
            worldPosition.y + FLAG_VERTICAL_OFFSET,
            worldPosition.z,
        );
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
    }

    public hide(): void {
        this.node.active = false;
        this.frameIndex = 0;
        this.frameTimer = 0;
        this.applyFrame();
    }

    update(dt: number): void {
        if (!this.node.active || this.frames.length === 0) {
            return;
        }

        this.frameTimer += dt;
        while (this.frameTimer >= this.frameDuration) {
            this.frameTimer -= this.frameDuration;
            this.frameIndex = (this.frameIndex + 1) % TARGET_FLAG_FRAME_COUNT;
            this.applyFrame();
        }
    }

    private applyFrame(): void {
        if (!this.sprite) {
            return;
        }

        this.sprite.spriteFrame = this.frames[this.frameIndex] ?? null;
    }
}
