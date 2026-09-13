import { _decorator, Component } from 'cc';
import { gridPointToWorld } from '../grid/GridTransform';
import { type GridPoint } from '../navigation/NavigationTypes';
import { MonsterAnimator } from './MonsterAnimator';
import { MonsterDirection } from './MonsterSpriteConfig';

const { ccclass } = _decorator;

@ccclass('MonsterMotor')
export class MonsterMotor extends Component {
    private animator: MonsterAnimator | null = null;
    private position: GridPoint = { x: 0, y: 0 };
    private target: GridPoint | null = null;
    private speed = 3.2;
    private mapWidth = 0;
    private mapHeight = 0;

    public setup(animator: MonsterAnimator, position: GridPoint, speed: number, mapWidth: number, mapHeight: number): void {
        this.animator = animator;
        this.position = { ...position };
        this.speed = speed;
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.target = null;
        this.syncNode();
    }
    public getGridPosition(): GridPoint { return { ...this.position }; }
    public moveTo(target: GridPoint): void {
        if (this.target && Math.hypot(target.x - this.target.x, target.y - this.target.y) < 0.02) return;
        this.target = { ...target };
    }
    public stop(): void { this.target = null; this.animator?.playIdle(); }
    public isMoving(): boolean { return this.target !== null; }
    update(dt: number): void {
        if (!this.target) return;
        const dx = this.target.x - this.position.x;
        const dy = this.target.y - this.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 0.03) { this.position = { ...this.target }; this.target = null; this.syncNode(); this.animator?.playIdle(); return; }
        const step = Math.min(distance, this.speed * dt);
        this.position.x += dx / distance * step;
        this.position.y += dy / distance * step;
        this.syncNode();
        const direction = Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? MonsterDirection.Left : MonsterDirection.Right)
            : (dy < 0 ? MonsterDirection.Up : MonsterDirection.Down);
        this.animator?.playMove(direction);
    }
    private syncNode(): void {
        this.node.setPosition(gridPointToWorld(this.position.x, this.position.y, this.mapWidth, this.mapHeight));
    }
}
