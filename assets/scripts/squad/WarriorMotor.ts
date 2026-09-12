import { _decorator, Component } from 'cc';
import { gridOffsetToLocalWorld } from '../grid/GridTransform';
import { type GridPoint } from '../navigation/NavigationTypes';
import { resolveWarriorDirection } from './WarriorDirectionUtils';
import { WarriorAnimator } from './WarriorAnimator';
import { WarriorDirection } from './WarriorSpriteConfig';

const { ccclass } = _decorator;

const LOCAL_MOVE_SPEED_CELLS_PER_SECOND = 5.0;
const LOCAL_ARRIVE_EPSILON = 0.03;

export interface WarriorMotorConfig {
    animator: WarriorAnimator;
    formationOffset: GridPoint;
}

@ccclass('WarriorMotor')
export class WarriorMotor extends Component {
    private animator: WarriorAnimator | null = null;
    private formationOffset: GridPoint = { x: 0, y: 0 };
    private currentLocalGridOffset: GridPoint = { x: 0, y: 0 };
    private targetLocalGridOffset: GridPoint = { x: 0, y: 0 };
    private moving = false;
    private arrivedPending = false;
    private lastDirection = WarriorDirection.Down;
    private initialized = false;

    public setup(config: WarriorMotorConfig): void {
        this.animator = config.animator;
        this.formationOffset = {
            x: config.formationOffset.x,
            y: config.formationOffset.y,
        };
        this.currentLocalGridOffset = {
            x: config.formationOffset.x,
            y: config.formationOffset.y,
        };
        this.targetLocalGridOffset = {
            x: config.formationOffset.x,
            y: config.formationOffset.y,
        };
        this.moving = false;
        this.arrivedPending = false;
        this.initialized = true;
        this.syncNodePosition();
        // 出生时直接对齐阵型点，避免 Renderer 和 Motor 分别维护一套初始位置。
        this.animator?.playIdle(this.lastDirection);
    }

    public moveToLocalGridOffset(offset: GridPoint): void {
        this.targetLocalGridOffset = {
            x: offset.x,
            y: offset.y,
        };
        this.arrivedPending = false;

        const dx = this.targetLocalGridOffset.x - this.currentLocalGridOffset.x;
        const dy = this.targetLocalGridOffset.y - this.currentLocalGridOffset.y;
        if (Math.sqrt(dx * dx + dy * dy) <= LOCAL_ARRIVE_EPSILON) {
            // Reform 期间可能重复发出“回阵型”指令；这里直接吞掉抖动并保留到达事件语义。
            this.currentLocalGridOffset = {
                x: this.targetLocalGridOffset.x,
                y: this.targetLocalGridOffset.y,
            };
            this.moving = false;
            this.arrivedPending = true;
            this.syncNodePosition();
            this.animator?.playIdle(this.lastDirection);
            return;
        }

        this.moving = true;
        this.lastDirection = resolveWarriorDirection(dx, dy, this.lastDirection);
        this.animator?.playWalk(this.lastDirection);
    }

    public returnToFormation(): void {
        // 阵型恢复始终复用同一套局部移动逻辑，避免 cancel 分支出现另一种位移语义。
        this.moveToLocalGridOffset(this.formationOffset);
    }

    public stop(): void {
        this.moving = false;
        this.targetLocalGridOffset = {
            x: this.currentLocalGridOffset.x,
            y: this.currentLocalGridOffset.y,
        };
        this.arrivedPending = false;
        this.animator?.playIdle(this.lastDirection);
    }

    public isMoving(): boolean {
        return this.moving;
    }

    public consumeArrived(): boolean {
        const arrived = this.arrivedPending;
        this.arrivedPending = false;
        return arrived;
    }

    public getCurrentLocalGridOffset(): GridPoint {
        return {
            x: this.currentLocalGridOffset.x,
            y: this.currentLocalGridOffset.y,
        };
    }

    public getFormationOffset(): GridPoint {
        return {
            x: this.formationOffset.x,
            y: this.formationOffset.y,
        };
    }

    public getWorldGridPosition(squadGridPosition: GridPoint): GridPoint {
        return {
            x: squadGridPosition.x + this.currentLocalGridOffset.x,
            y: squadGridPosition.y + this.currentLocalGridOffset.y,
        };
    }

    update(dt: number): void {
        if (!this.initialized || !this.moving) {
            return;
        }

        const dx = this.targetLocalGridOffset.x - this.currentLocalGridOffset.x;
        const dy = this.targetLocalGridOffset.y - this.currentLocalGridOffset.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= LOCAL_ARRIVE_EPSILON) {
            this.snapToTarget();
            return;
        }

        const nextDirection = resolveWarriorDirection(dx, dy, this.lastDirection);
        if (nextDirection !== this.lastDirection) {
            this.lastDirection = nextDirection;
            this.animator?.playWalk(nextDirection);
        }

        const maxStep = LOCAL_MOVE_SPEED_CELLS_PER_SECOND * dt;
        if (distance <= maxStep) {
            this.snapToTarget();
            return;
        }

        this.currentLocalGridOffset = {
            x: this.currentLocalGridOffset.x + (dx / distance) * maxStep,
            y: this.currentLocalGridOffset.y + (dy / distance) * maxStep,
        };
        this.syncNodePosition();
    }

    private snapToTarget(): void {
        this.currentLocalGridOffset = {
            x: this.targetLocalGridOffset.x,
            y: this.targetLocalGridOffset.y,
        };
        this.moving = false;
        this.arrivedPending = true;
        this.syncNodePosition();
        // 到位后先回 Idle，真正 Attack 必须由 EngagementController 二次确认后触发。
        this.animator?.playIdle(this.lastDirection);
    }

    private syncNodePosition(): void {
        this.node.setPosition(
            gridOffsetToLocalWorld(
                this.currentLocalGridOffset.x,
                this.currentLocalGridOffset.y,
            ),
        );
    }
}
