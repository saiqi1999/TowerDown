import { _decorator, Component, randomRange } from 'cc';
import { gridPointToWorld } from '../grid/GridTransform';
import { type GridPoint } from './SquadTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { WarriorDirection } from './WarriorSpriteConfig';

const { ccclass } = _decorator;

enum SquadIdleState {
    Idle = 0,
    Wander = 1,
}

export interface SquadIdleAIConfig {
    squadId: string;
    homeObjectId: string;
    spawnPoint: GridPoint;
    mapWidth: number;
    mapHeight: number;
    homeLeft: number;
    homeRight: number;
    homeBottom: number;
    warriors: WarriorAnimator[];
}

@ccclass('SquadIdleAI')
export class SquadIdleAI extends Component {
    private state = SquadIdleState.Idle;
    private squadId = '';
    private homeObjectId = '';
    private currentGridX = 0;
    private currentGridY = 0;
    private targetGridX = 0;
    private targetGridY = 0;
    private idleTimer = 0;
    private moveSpeedCellsPerSecond = 1.25;
    private mapWidth = 0;
    private mapHeight = 0;
    private homeLeft = 0;
    private homeRight = 0;
    private homeBottom = 0;
    private warriors: WarriorAnimator[] = [];
    private initialized = false;

    public setup(config: SquadIdleAIConfig): void {
        this.squadId = config.squadId;
        this.homeObjectId = config.homeObjectId;
        this.currentGridX = config.spawnPoint.x;
        this.currentGridY = config.spawnPoint.y;
        this.targetGridX = config.spawnPoint.x;
        this.targetGridY = config.spawnPoint.y;
        this.mapWidth = config.mapWidth;
        this.mapHeight = config.mapHeight;
        this.homeLeft = config.homeLeft;
        this.homeRight = config.homeRight;
        this.homeBottom = config.homeBottom;
        this.warriors = config.warriors;
        this.initialized = true;

        this.syncWorldPosition();
        this.setAllDirection(WarriorDirection.Down);
        this.enterIdle();

        console.log(
            `[SquadIdleAI] ${this.squadId} home=${this.homeObjectId} spawn=(${this.currentGridX.toFixed(2)},${this.currentGridY.toFixed(2)})`,
        );
    }

    update(dt: number): void {
        if (!this.initialized) {
            return;
        }

        if (this.state === SquadIdleState.Idle) {
            this.updateIdle(dt);
            return;
        }

        this.updateWander(dt);
    }

    private updateIdle(dt: number): void {
        this.idleTimer -= dt;
        if (this.idleTimer > 0) {
            return;
        }

        const target = this.chooseRandomTarget();
        this.targetGridX = target.x;
        this.targetGridY = target.y;
        this.state = SquadIdleState.Wander;
        this.setAllMoving(true);
        this.setAllDirection(this.resolveDirection(
            this.targetGridX - this.currentGridX,
            this.targetGridY - this.currentGridY,
        ));
    }

    private updateWander(dt: number): void {
        const dx = this.targetGridX - this.currentGridX;
        const dy = this.targetGridY - this.currentGridY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= 0.03) {
            this.currentGridX = this.targetGridX;
            this.currentGridY = this.targetGridY;
            this.syncWorldPosition();
            this.enterIdle();
            return;
        }

        this.setAllDirection(this.resolveDirection(dx, dy));

        const maxStep = this.moveSpeedCellsPerSecond * dt;
        if (distance <= maxStep) {
            this.currentGridX = this.targetGridX;
            this.currentGridY = this.targetGridY;
            this.syncWorldPosition();
            this.enterIdle();
            return;
        }

        this.currentGridX += (dx / distance) * maxStep;
        this.currentGridY += (dy / distance) * maxStep;
        this.syncWorldPosition();
    }

    private enterIdle(): void {
        this.state = SquadIdleState.Idle;
        this.idleTimer = randomRange(0.8, 2.5);
        this.setAllMoving(false);
    }

    private chooseRandomTarget(): GridPoint {
        const minX = Math.max(0.5, this.homeLeft - 1.5);
        const maxX = Math.min(this.mapWidth - 0.5, this.homeRight + 1.5);
        const minY = Math.max(0.5, this.homeBottom + 0.5);
        const maxY = Math.min(this.mapHeight - 0.5, this.homeBottom + 3.5);

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const candidate = {
                x: randomRange(minX, maxX),
                y: randomRange(minY, maxY),
            };

            const dx = candidate.x - this.currentGridX;
            const dy = candidate.y - this.currentGridY;
            if (Math.sqrt(dx * dx + dy * dy) > 0.2) {
                return candidate;
            }
        }

        return {
            x: randomRange(minX, maxX),
            y: randomRange(minY, maxY),
        };
    }

    private resolveDirection(dx: number, dy: number): WarriorDirection {
        if (Math.abs(dx) > Math.abs(dy)) {
            return dx < 0 ? WarriorDirection.Left : WarriorDirection.Right;
        }

        return dy < 0 ? WarriorDirection.Up : WarriorDirection.Down;
    }

    private setAllDirection(direction: WarriorDirection): void {
        for (const warrior of this.warriors) {
            warrior.setDirection(direction);
        }
    }

    private setAllMoving(moving: boolean): void {
        for (const warrior of this.warriors) {
            warrior.setMoving(moving);
        }
    }

    private syncWorldPosition(): void {
        this.node.setPosition(
            gridPointToWorld(
                this.currentGridX,
                this.currentGridY,
                this.mapWidth,
                this.mapHeight,
            ),
        );
    }
}
