import { _decorator, Component, randomRange } from 'cc';
import { type GridCell, type GridPoint } from '../navigation/NavigationTypes';
import { WorldNavigator } from '../navigation/WorldNavigator';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData, WorldObjectKind } from '../world/WorldObjectTypes';
import { WarriorAnimator } from './WarriorAnimator';
import { type CommandResult } from './SquadTypes';
import { type WarriorDirection } from './WarriorSpriteConfig';
import { resolveWarriorDirection } from './WarriorDirectionUtils';
import { SquadMotor } from './SquadMotor';

const { ccclass } = _decorator;

// Brain 只负责“决策现在该做什么”，真正的位置写入统一交给 SquadMotor。
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
    // Navigator 在启动阶段注入，避免 Brain 自己持有地图构建职责。
    navigator: WorldNavigator;
    worldObjectById: ReadonlyMap<string, WorldObjectData>;
    warriors: WarriorAnimator[];
    homeRestCell: GridCell;
    homeBounds: SquadHomeBounds;
}

@ccclass('SquadBrain')
export class SquadBrain extends Component {
    private squadId = '';
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
        this.motor = config.motor;
        this.navigator = config.navigator;
        this.worldObjectById = config.worldObjectById;
        this.warriors = config.warriors;
        this.homeRestCell = config.homeRestCell;
        this.homeBounds = config.homeBounds;
        this.initialized = true;
        // 出生后先进入返家附近的待机逻辑，保持 Phase 1 的“基地门口活动”体验。
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

        // 先算出新路径，再切换 currentTarget/state，避免不可达目标覆盖旧命令。
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
        // 返家永远从“当前实时位置”开始算，保证移动途中取消命令也能自然折返。
        const path = this.navigator.findPathToCell(
            this.motor.getGridPosition(),
            this.homeRestCell,
        );

        if (!path) {
            this.motor.stop();
            console.warn(
                `[SquadBrain] ${this.squadId} failed to find return-home path.`,
            );
            // 回家失败时降级回 HomeIdle，避免行为卡死在 ReturnHome。
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

        // Brain 只在状态切换点消费 Motor 的“到达事件”，不直接参与逐帧位移。
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
                const attackDirection = this.resolveAttackDirection();
                if (attackDirection === null) {
                    this.clearCommandAndReturnHome();
                    break;
                }

                this.state = SquadBrainState.AttackResource;
                // Phase 2 到达资源后只进入攻击演出，不做伤害或采集结算。
                this.playAttack(attackDirection);
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
        // Base 点击语义被定义为“返家”，而不是把 Base 当作普通攻击目标。
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

        // 待机结束后只在基地前方的小范围内巡逻，延续出生点附近活动的感觉。
        const target = this.chooseRandomWanderTarget();
        this.state = SquadBrainState.Wander;
        this.motor.setWaypoints([target]);
    }

    private enterHomeIdle(): void {
        this.state = SquadBrainState.HomeIdle;
        this.currentTargetId = null;
        this.idleTimer = randomRange(0.8, 2.5);
        // 进入 Idle 时立即停掉旧路径，确保 Attack/Move/ReturnHome 都能被完整打断。
        this.motor.stop();
    }

    // 资源中心与 Squad 实时位置的相对关系决定攻击朝向，避免再把素材列顺序误当时间帧。
    private resolveAttackDirection(): WarriorDirection | null {
        const target = this.getCurrentTarget();
        if (!target) {
            console.warn(
                `[SquadBrain] ${this.squadId} lost current target before entering attack.`,
            );
            return null;
        }

        const visual = getWorldVisualDefinition(target.visualId);
        const targetCenterX = target.gridX + visual.w / 2;
        const targetCenterY = target.gridY + visual.h / 2;
        const squadPosition = this.motor.getGridPosition();
        const dx = targetCenterX - squadPosition.x;
        const dy = targetCenterY - squadPosition.y;
        return resolveWarriorDirection(dx, dy, this.motor.getFacingDirection());
    }

    private getCurrentTarget(): WorldObjectData | null {
        if (!this.currentTargetId) {
            return null;
        }

        const target = this.worldObjectById.get(this.currentTargetId) ?? null;
        if (!target) {
            console.warn(
                `[SquadBrain] ${this.squadId} current target disappeared: ${this.currentTargetId}`,
            );
        }

        return target;
    }

    private playAttack(direction: WarriorDirection): void {
        for (const warrior of this.warriors) {
            warrior.playAttack(direction);
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
            // 过滤掉几乎原地不动的点，避免待机结束后看起来像没触发 Wander。
            if (Math.sqrt(dx * dx + dy * dy) > 0.2) {
                return candidate;
            }
        }

        // 多次采样都太近时退化为任意合法点，优先保证行为继续推进。
        return {
            x: randomRange(minX, maxX),
            y: randomRange(minY, maxY),
        };
    }
}
