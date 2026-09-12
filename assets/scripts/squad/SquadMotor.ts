import { _decorator, Component } from 'cc';
import { gridPointToWorld } from '../grid/GridTransform';
import { type GridCell, type GridPoint } from '../navigation/NavigationTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { WarriorDirection } from './WarriorSpriteConfig';

const { ccclass } = _decorator;

export interface SquadMotorConfig {
    spawnPoint: GridPoint;
    mapWidth: number;
    mapHeight: number;
    warriors: WarriorAnimator[];
}

@ccclass('SquadMotor')
export class SquadMotor extends Component {
    private currentGridPoint: GridPoint = { x: 0, y: 0 };
    private waypoints: GridPoint[] = [];
    private waypointIndex = 0;
    private moveSpeedCellsPerSecond = 1.25;
    private mapWidth = 0;
    private mapHeight = 0;
    private warriors: WarriorAnimator[] = [];
    private arrivedPending = false;
    private initialized = false;
    private lastDirection = WarriorDirection.Down;

    public setup(config: SquadMotorConfig): void {
        this.currentGridPoint = {
            x: config.spawnPoint.x,
            y: config.spawnPoint.y,
        };
        this.mapWidth = config.mapWidth;
        this.mapHeight = config.mapHeight;
        this.warriors = config.warriors;
        this.waypoints = [];
        this.waypointIndex = 0;
        this.arrivedPending = false;
        this.initialized = true;
        this.syncWorldPosition();
        this.playIdle(this.lastDirection);
    }

    public getGridPosition(): GridPoint {
        return {
            x: this.currentGridPoint.x,
            y: this.currentGridPoint.y,
        };
    }

    public setWaypoints(waypoints: GridPoint[]): void {
        this.waypoints = waypoints.map((waypoint) => ({
            x: waypoint.x,
            y: waypoint.y,
        }));
        this.waypointIndex = 0;
        this.arrivedPending = false;

        if (this.waypoints.length === 0) {
            this.arrivedPending = true;
            this.playIdle(this.lastDirection);
            return;
        }

        const direction = this.resolveDirectionTo(this.waypoints[0]);
        this.lastDirection = direction;
        this.playWalk(direction);
    }

    public setPath(cells: GridCell[]): void {
        const waypoints = cells.map((cell) => ({
            x: cell.x + 0.5,
            y: cell.y + 0.5,
        }));
        this.setWaypoints(waypoints);
    }

    public stop(): void {
        this.waypoints = [];
        this.waypointIndex = 0;
        this.arrivedPending = false;
        this.playIdle(this.lastDirection);
    }

    public isMoving(): boolean {
        return this.waypointIndex < this.waypoints.length;
    }

    public consumeArrived(): boolean {
        const arrived = this.arrivedPending;
        this.arrivedPending = false;
        return arrived;
    }

    update(dt: number): void {
        if (!this.initialized || !this.isMoving()) {
            return;
        }

        const target = this.waypoints[this.waypointIndex];
        const dx = target.x - this.currentGridPoint.x;
        const dy = target.y - this.currentGridPoint.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= 0.03) {
            this.snapToWaypoint(target);
            return;
        }

        const direction = this.resolveDirection(dx, dy);
        this.lastDirection = direction;
        this.playWalk(direction);

        const maxStep = this.moveSpeedCellsPerSecond * dt;
        if (distance <= maxStep) {
            this.snapToWaypoint(target);
            return;
        }

        this.currentGridPoint = {
            x: this.currentGridPoint.x + (dx / distance) * maxStep,
            y: this.currentGridPoint.y + (dy / distance) * maxStep,
        };
        this.syncWorldPosition();
    }

    private snapToWaypoint(target: GridPoint): void {
        this.currentGridPoint = {
            x: target.x,
            y: target.y,
        };
        this.syncWorldPosition();
        this.waypointIndex += 1;

        if (!this.isMoving()) {
            this.waypoints = [];
            this.waypointIndex = 0;
            this.arrivedPending = true;
            this.playIdle(this.lastDirection);
            return;
        }

        const direction = this.resolveDirectionTo(this.waypoints[this.waypointIndex]);
        this.lastDirection = direction;
        this.playWalk(direction);
    }

    private resolveDirectionTo(target: GridPoint): WarriorDirection {
        return this.resolveDirection(
            target.x - this.currentGridPoint.x,
            target.y - this.currentGridPoint.y,
        );
    }

    private resolveDirection(dx: number, dy: number): WarriorDirection {
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx < 0 ? WarriorDirection.Left : WarriorDirection.Right;
        }

        return dy < 0 ? WarriorDirection.Up : WarriorDirection.Down;
    }

    private playWalk(direction: WarriorDirection): void {
        for (const warrior of this.warriors) {
            warrior.playWalk(direction);
        }
    }

    private playIdle(direction: WarriorDirection): void {
        for (const warrior of this.warriors) {
            warrior.playIdle(direction);
        }
    }

    private syncWorldPosition(): void {
        this.node.setPosition(
            gridPointToWorld(
                this.currentGridPoint.x,
                this.currentGridPoint.y,
                this.mapWidth,
                this.mapHeight,
            ),
        );
    }
}
