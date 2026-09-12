import { _decorator, Component, randomRange } from 'cc';
import { type GridCell, type GridPoint } from '../navigation/NavigationTypes';
import { WorldNavigator } from '../navigation/WorldNavigator';
import { type WorldObjectData, WorldObjectKind } from '../world/WorldObjectTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { type CommandResult } from './SquadTypes';
import { SquadMotor } from './SquadMotor';

const { ccclass } = _decorator;

export enum SquadBrainState {
    HomeIdle = 0,
    Wander = 1,
    MoveToTarget = 2,
    AttackResource = 3,
    ReturnHome = 4,
}

export interface SquadHomeBounds {
    left: number;
    right: number;
    bottom: number;
    mapWidth: number;
    mapHeight: number;
}

export interface SquadBrainConfig {
    squadId: string;
    homeObjectId: string;
    motor: SquadMotor;
    navigator: WorldNavigator;
    worldObjectById: ReadonlyMap<string, WorldObjectData>;
    warriors: WarriorAnimator[];
    homeRestCell: GridCell;
    homeBounds: SquadHomeBounds;
}

@ccclass('SquadBrain')
export class SquadBrain extends Component {
    private squadId = '';
    private homeObjectId = '';
    private state = SquadBrainState.HomeIdle;
    private currentTargetId: string | null = null;
    private idleTimer = 0;
    private motor!: SquadMotor;
    private navigator!: WorldNavigator;
    private worldObjectById: ReadonlyMap<string, WorldObjectData> = new Map();
    private warriors: WarriorAnimator[] = [];
    private homeRestCell!: GridCell;
    private homeBounds!: SquadHomeBounds;
    private initialized = false;

    public setup(config: SquadBrainConfig): void {
        this.squadId = config.squadId;
        this.homeObjectId = config.homeObjectId;
        this.motor = config.motor;
        this.navigator = config.navigator;
        this.worldObjectById = config.worldObjectById;
        this.warriors = config.warriors;
        this.homeRestCell = config.homeRestCell;
        this.homeBounds = config.homeBounds;
        this.initialized = true;
        this.enterHomeIdle();
    }

    public issueTarget(targetId: string): CommandResult {
        const target = this.worldObjectById.get(targetId);
        if (!target) {
            return {
                accepted: false,
                reason: `[SquadBrain] ${this.squadId} target not found: ${targetId}`,
            };
        }

        if (target.kind === WorldObjectKind.Base) {
            return this.issueReturnHome(target);
        }

        const pathResult = this.navigator.findPathToObject(
            this.motor.getGridPosition(),
            target,
        );
        if (!pathResult) {
            return {
                accepted: false,
                reason: `[SquadBrain] ${this.squadId} target unreachable: ${targetId}`,
            };
        }

        this.currentTargetId = target.id;
        this.state = SquadBrainState.MoveToTarget;
        this.motor.setPath(pathResult.path);
        return { accepted: true };
    }

    public clearCommandAndReturnHome(): void {
        this.currentTargetId = null;
        const path = this.navigator.findPathToCell(
            this.motor.getGridPosition(),
            this.homeRestCell,
        );

        if (!path) {
            this.motor.stop();
            console.warn(
                `[SquadBrain] ${this.squadId} failed to find return-home path.`,
            );
            this.enterHomeIdle();
            return;
        }

        this.state = SquadBrainState.ReturnHome;
        this.motor.setPath(path);
    }

    public getCurrentTargetId(): string | null {
        return this.currentTargetId;
    }

    update(dt: number): void {
        if (!this.initialized) {
            return;
        }

        switch (this.state) {
        case SquadBrainState.HomeIdle:
            this.updateHomeIdle(dt);
            break;
        case SquadBrainState.Wander:
            if (this.motor.consumeArrived()) {
                this.enterHomeIdle();
            }
            break;
        case SquadBrainState.MoveToTarget:
            if (this.motor.consumeArrived()) {
                this.state = SquadBrainState.AttackResource;
                this.playAttack();
            }
            break;
        case SquadBrainState.ReturnHome:
            if (this.motor.consumeArrived()) {
                this.currentTargetId = null;
                this.enterHomeIdle();
            }
            break;
        case SquadBrainState.AttackResource:
        default:
            break;
        }
    }

    private issueReturnHome(target: WorldObjectData): CommandResult {
        const path = this.navigator.findPathToCell(
            this.motor.getGridPosition(),
            this.homeRestCell,
        );
        if (!path) {
            return {
                accepted: false,
                reason: `[SquadBrain] ${this.squadId} base path unreachable: ${target.id}`,
            };
        }

        this.currentTargetId = target.id;
        this.state = SquadBrainState.ReturnHome;
        this.motor.setPath(path);
        return { accepted: true };
    }

    private updateHomeIdle(dt: number): void {
        this.idleTimer -= dt;
        if (this.idleTimer > 0) {
            return;
        }

        const target = this.chooseRandomWanderTarget();
        this.state = SquadBrainState.Wander;
        this.motor.setWaypoints([target]);
    }

    private enterHomeIdle(): void {
        this.state = SquadBrainState.HomeIdle;
        this.currentTargetId = null;
        this.idleTimer = randomRange(0.8, 2.5);
        this.motor.stop();
    }

    private playAttack(): void {
        for (const warrior of this.warriors) {
            warrior.playAttack();
        }
    }

    private chooseRandomWanderTarget(): GridPoint {
        const minX = Math.max(0.5, this.homeBounds.left - 1.5);
        const maxX = Math.min(this.homeBounds.mapWidth - 0.5, this.homeBounds.right + 1.5);
        const minY = Math.max(0.5, this.homeBounds.bottom + 0.5);
        const maxY = Math.min(this.homeBounds.mapHeight - 0.5, this.homeBounds.bottom + 3.5);
        const current = this.motor.getGridPosition();

        for (let attempt = 0; attempt < 6; attempt += 1) {
            const candidate = {
                x: randomRange(minX, maxX),
                y: randomRange(minY, maxY),
            };
            const dx = candidate.x - current.x;
            const dy = candidate.y - current.y;
            if (Math.sqrt(dx * dx + dy * dy) > 0.2) {
                return candidate;
            }
        }

        return {
            x: randomRange(minX, maxX),
            y: randomRange(minY, maxY),
        };
    }
}
