import { _decorator, Component, randomRange } from 'cc';
import { type GridCell, type GridPoint } from '../navigation/NavigationTypes';
import { WorldNavigator } from '../navigation/WorldNavigator';
import { type WorldObjectData, WorldObjectKind } from '../world/WorldObjectTypes';
import { WorldObjectRuntimeRegistry } from '../world/WorldObjectRuntimeRegistry';
import { SquadEngagementController } from './SquadEngagementController';
import { type CommandResult } from './SquadTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { SquadMotor } from './SquadMotor';
import { type MonsterRuntimeRegistry } from '../monster/MonsterRuntimeRegistry';
import { type SquadCombatController } from './SquadCombatController';

const { ccclass } = _decorator;

// Brain 只决定“当前命令应该走到哪一步”，跨地图位移仍由 SquadMotor、局部展开由 Engagement 接管。
export enum SquadBrainState {
    HomeIdle = 0,
    Wander = 1,
    MoveToTarget = 2,
    GuardCombat = 3,
    EngageTarget = 4,
    AttackResource = 5,
    Reform = 6,
    ReturnHome = 7,
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
    engagement: SquadEngagementController;
    // Navigator 在启动阶段注入，避免 Brain 自己持有地图构建职责。
    navigator: WorldNavigator;
    worldObjectRegistry: WorldObjectRuntimeRegistry;
    warriors: WarriorAnimator[];
    homeRestCell: GridCell;
    homeBounds: SquadHomeBounds;
    monsterRegistry?: MonsterRuntimeRegistry;
    onGuardEncounterRequested?: (squadId: string, guardedObjectId: string) => boolean;
    onGuardRetreatRequested?: (squadId: string, guardedObjectId: string) => void;
    combat?: SquadCombatController;
}

@ccclass('SquadBrain')
export class SquadBrain extends Component {
    private squadId = '';
    private state = SquadBrainState.HomeIdle;
    private commandTargetId: string | null = null;
    private activeTargetId: string | null = null;
    private pendingTargetId: string | null = null;
    private pendingReturnHome = false;
    private idleTimer = 0;
    private motor!: SquadMotor;
    private engagement!: SquadEngagementController;
    private navigator!: WorldNavigator;
    private worldObjectRegistry!: WorldObjectRuntimeRegistry;
    private warriors: WarriorAnimator[] = [];
    private homeRestCell!: GridCell;
    private homeBounds!: SquadHomeBounds;
    private initialized = false;
    private monsterRegistry: MonsterRuntimeRegistry | null = null;
    private onGuardEncounterRequested: ((squadId: string, guardedObjectId: string) => boolean) | null = null;
    private guardEncounterRequested = false;
    private combat: SquadCombatController | null = null;
    private onGuardRetreatRequested: ((squadId: string, guardedObjectId: string) => void) | null = null;

    public setup(config: SquadBrainConfig): void {
        this.squadId = config.squadId;
        this.motor = config.motor;
        this.engagement = config.engagement;
        this.navigator = config.navigator;
        this.worldObjectRegistry = config.worldObjectRegistry;
        this.warriors = config.warriors;
        this.homeRestCell = config.homeRestCell;
        this.homeBounds = config.homeBounds;
        this.monsterRegistry = config.monsterRegistry ?? null;
        this.onGuardEncounterRequested = config.onGuardEncounterRequested ?? null;
        this.onGuardRetreatRequested = config.onGuardRetreatRequested ?? null;
        this.combat = config.combat ?? null;
        this.guardEncounterRequested = false;
        this.initialized = true;
        // 出生后先进入返家附近的待机逻辑，保持基地门口活动的基本行为。
        this.enterHomeIdle();
    }

    public setGuardEncounterRequester(
        requester: (squadId: string, guardedObjectId: string) => boolean,
    ): void {
        this.onGuardEncounterRequested = requester;
    }
    public setGuardRetreatRequester(
        requester: (squadId: string, guardedObjectId: string) => void,
    ): void {
        this.onGuardRetreatRequested = requester;
    }

    public issueTarget(targetId: string): CommandResult {
        const target = this.worldObjectRegistry.get(targetId);
        if (!target) {
            return {
                accepted: false,
                reason: `[SquadBrain] ${this.squadId} target not found: ${targetId}`,
            };
        }

        if (target.kind === WorldObjectKind.Base) {
            return this.issueReturnHome(target);
        }

        // 先验证路径可达，再修改当前命令，避免不可达点击污染现有状态。
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

        this.commandTargetId = target.id;
        if (this.shouldReformBeforeNewCommand()) {
            this.pendingTargetId = target.id;
            this.pendingReturnHome = false;
            this.beginReform();
            return { accepted: true };
        }

        this.pendingTargetId = null;
        this.pendingReturnHome = false;
        this.activeTargetId = target.id;
        this.guardEncounterRequested = false;
        this.state = SquadBrainState.MoveToTarget;
        this.motor.setPath(pathResult.path);
        return { accepted: true };
    }

    public clearCommandAndReturnHome(): void {
        this.commandTargetId = null;
        this.pendingTargetId = null;
        this.pendingReturnHome = true;

        if (this.shouldReformBeforeNewCommand()) {
            this.beginReform();
            return;
        }

        this.startReturnHomeFromCurrentPosition();
    }

    public getCurrentTargetId(): string | null {
        // Flag 需要跟随“最新已接受命令”而不是旧的实际交互目标，否则 reform 期间会提前消失。
        return this.commandTargetId;
    }
    private resumeTargetAfterGuardVictory(): void {
        const target = this.getActiveTarget();
        if (!target) {
            this.clearCommandAndReturnHome();
            return;
        }

        const pathResult = this.navigator.findPathToObject(
            this.motor.getGridPosition(),
            target,
        );
        if (!pathResult) {
            console.warn(
                `[SquadBrain] ${this.squadId} target unreachable after guard victory: ${target.id}`,
            );
            this.clearCommandAndReturnHome();
            return;
        }

        this.guardEncounterRequested = false;
        this.state = SquadBrainState.MoveToTarget;
        this.motor.setPath(pathResult.path);
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
            if (this.tryActivateGuard()) {
                break;
            }
            if (this.motor.consumeArrived()) {
                this.beginTargetEngagement();
            }
            break;
        case SquadBrainState.EngageTarget:
            if (this.engagement.hasAnyWarriorEngaged()) {
                this.state = SquadBrainState.AttackResource;
            }
            break;
        case SquadBrainState.GuardCombat:
            if (this.combat?.isInactive()) {
                if (this.combat.consumeGuardDefeated()) {
                    this.resumeTargetAfterGuardVictory();
                } else {
                    this.state = SquadBrainState.MoveToTarget;
                }
            }
            break;
        case SquadBrainState.Reform:
            if (this.engagement.isInactive() && (this.combat?.isInactive() ?? true)) {
                this.resumePostReformCommand();
            }
            break;
        case SquadBrainState.ReturnHome:
            if (this.motor.consumeArrived()) {
                this.activeTargetId = null;
                this.commandTargetId = null;
                this.enterHomeIdle();
            }
            break;
        case SquadBrainState.AttackResource:
            if (this.engagement.consumeTargetDepleted()) {
                this.clearCommandAndReturnHome();
            }
            break;
        default:
            break;
        }
    }

    private issueReturnHome(target: WorldObjectData): CommandResult {
        // Base 点击语义是“返家”，不是把基地当作一个普通互动目标。
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

        this.commandTargetId = target.id;
        this.pendingTargetId = null;
        this.pendingReturnHome = true;

        if (this.shouldReformBeforeNewCommand()) {
            this.beginReform();
            return { accepted: true };
        }

        this.activeTargetId = target.id;
        this.state = SquadBrainState.ReturnHome;
        this.motor.setPath(path);
        return { accepted: true };
    }

    private beginTargetEngagement(): void {
        const target = this.getActiveTarget();
        if (!target) {
            this.clearCommandAndReturnHome();
            return;
        }

        if (!this.engagement.beginInteraction(target)) {
            console.warn(
                `[SquadBrain] ${this.squadId} failed to begin interaction: ${target.id}`,
            );
            this.clearCommandAndReturnHome();
            return;
        }

        this.state = SquadBrainState.EngageTarget;
    }

    private tryActivateGuard(): boolean {
        if (this.guardEncounterRequested || !this.activeTargetId || !this.monsterRegistry) {
            return false;
        }
        const guard = this.monsterRegistry.getByGuardedObject(this.activeTargetId);
        if (!guard || !guard.canEngage(this.motor.getGridPosition())) {
            return false;
        }
        this.motor.stop();
        this.guardEncounterRequested = true;
        const accepted = this.onGuardEncounterRequested?.(this.squadId, this.activeTargetId) ?? false;
        if (!accepted) {
            this.guardEncounterRequested = false;
            console.warn(`[SquadBrain] guard encounter request rejected: ${this.activeTargetId}`);
            return false;
        }
        this.state = SquadBrainState.GuardCombat;
        return true;
    }

    private beginReform(): void {
        if (this.guardEncounterRequested && this.activeTargetId) {
            this.onGuardRetreatRequested?.(this.squadId, this.activeTargetId);
            this.guardEncounterRequested = false;
        }
        this.motor.stop();

        if (this.engagement.isInactive()) {
            // 即使当前没有展开，也统一走一遍 reform 入口，保持命令切换的时序单一。
            this.state = SquadBrainState.Reform;
            this.engagement.cancelAndReform();
            return;
        }

        this.state = SquadBrainState.Reform;
        this.engagement.cancelAndReform();
    }

    private resumePostReformCommand(): void {
        if (this.pendingReturnHome) {
            this.startReturnHomeFromCurrentPosition();
            return;
        }

        if (this.pendingTargetId) {
            const target = this.worldObjectRegistry.get(this.pendingTargetId);
            if (!target) {
                console.warn(
                    `[SquadBrain] ${this.squadId} pending target disappeared: ${this.pendingTargetId}`,
                );
                this.pendingTargetId = null;
                this.commandTargetId = null;
                this.enterHomeIdle();
                return;
            }

            const pathResult = this.navigator.findPathToObject(
                this.motor.getGridPosition(),
                target,
            );
            if (!pathResult) {
                console.warn(
                    `[SquadBrain] ${this.squadId} pending target unreachable after reform: ${target.id}`,
                );
                this.pendingTargetId = null;
                this.commandTargetId = null;
                this.enterHomeIdle();
                return;
            }

            this.activeTargetId = target.id;
            this.pendingTargetId = null;
            this.state = SquadBrainState.MoveToTarget;
            this.motor.setPath(pathResult.path);
            return;
        }

        this.enterHomeIdle();
    }

    private startReturnHomeFromCurrentPosition(): void {
        // ReturnHome 必须从 reform 后的实时位置重新求路，不能复用 reform 之前的旧路径。
        const path = this.navigator.findPathToCell(
            this.motor.getGridPosition(),
            this.homeRestCell,
        );
        this.pendingReturnHome = false;
        this.pendingTargetId = null;

        if (!path) {
            this.motor.stop();
            console.warn(
                `[SquadBrain] ${this.squadId} failed to find return-home path.`,
            );
            this.activeTargetId = null;
            this.commandTargetId = null;
            this.enterHomeIdle();
            return;
        }

        this.activeTargetId = this.commandTargetId;
        this.state = SquadBrainState.ReturnHome;
        this.motor.setPath(path);
    }

    private updateHomeIdle(dt: number): void {
        this.idleTimer -= dt;
        if (this.idleTimer > 0) {
            return;
        }

        // 待机结束后只在基地前方小范围巡逻，避免把 HomeIdle 演化成新的自由探索逻辑。
        const target = this.chooseRandomWanderTarget();
        this.state = SquadBrainState.Wander;
        this.motor.setWaypoints([target]);
    }

    private enterHomeIdle(): void {
        this.state = SquadBrainState.HomeIdle;
        this.activeTargetId = null;
        this.pendingTargetId = null;
        this.pendingReturnHome = false;
        this.idleTimer = randomRange(0.8, 2.5);
        // 进入 Idle 时主动停掉 Squad root 的路径，保证 Wander/ReturnHome/MoveToTarget 能彼此打断。
        this.motor.stop();

        // Brain 不再直接控制单兵攻击，但回到 HomeIdle 时仍要确保所有人都处于静止站姿。
        for (const warrior of this.warriors) {
            warrior.playIdle(this.motor.getFacingDirection());
        }
    }

    private shouldReformBeforeNewCommand(): boolean {
        return this.state === SquadBrainState.GuardCombat
            || this.guardEncounterRequested
            || this.state === SquadBrainState.EngageTarget
            || this.state === SquadBrainState.AttackResource
            || this.state === SquadBrainState.Reform
            || !this.engagement.isInactive();
    }

    private getActiveTarget(): WorldObjectData | null {
        if (!this.activeTargetId) {
            return null;
        }

        const target = this.worldObjectRegistry.get(this.activeTargetId);
        if (!target) {
            console.warn(
                `[SquadBrain] ${this.squadId} current target disappeared: ${this.activeTargetId}`,
            );
        }

        return target;
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
            // 过滤几乎原地不动的点，避免 HomeIdle 看起来像没有触发 Wander。
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
