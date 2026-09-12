import { _decorator, Component } from 'cc';
import { type GridPoint } from '../navigation/NavigationTypes';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import { InteractionSlotResolver } from './InteractionSlotResolver';
import {
    InteractionSide,
    type InteractionSlot,
    type WarriorSlotAssignment,
} from './InteractionTypes';
import { SquadMotor } from './SquadMotor';
import { WarriorAnimator } from './WarriorAnimator';
import { WarriorMotor } from './WarriorMotor';

const { ccclass } = _decorator;

const POSITION_EPSILON = 0.03;

export enum SquadEngagementState {
    Inactive = 0,
    MovingToSlots = 1,
    Engaged = 2,
    Reforming = 3,
}

export interface SquadEngagementConfig {
    squadId: string;
    squadMotor: SquadMotor;
    warriorMotors: WarriorMotor[];
    warriorAnimators: WarriorAnimator[];
    slotResolver: InteractionSlotResolver;
}

interface AssignmentCandidate {
    warriorIndex: number;
    motor: WarriorMotor;
    animator: WarriorAnimator;
    worldGridPosition: GridPoint;
}

@ccclass('SquadEngagementController')
export class SquadEngagementController extends Component {
    private squadId = '';
    private squadMotor: SquadMotor | null = null;
    private warriorMotors: WarriorMotor[] = [];
    private warriorAnimators: WarriorAnimator[] = [];
    private slotResolver: InteractionSlotResolver | null = null;
    private currentTarget: WorldObjectData | null = null;
    private assignments: WarriorSlotAssignment[] = [];
    private state = SquadEngagementState.Inactive;
    private anyWarriorEngaged = false;
    private initialized = false;

    public setup(config: SquadEngagementConfig): void {
        this.squadId = config.squadId;
        this.squadMotor = config.squadMotor;
        this.warriorMotors = [...config.warriorMotors];
        this.warriorAnimators = [...config.warriorAnimators];
        this.slotResolver = config.slotResolver;
        this.currentTarget = null;
        this.assignments = [];
        this.state = SquadEngagementState.Inactive;
        this.anyWarriorEngaged = false;
        this.initialized = true;
    }

    public beginInteraction(target: WorldObjectData): boolean {
        if (!this.initialized || !this.squadMotor || !this.slotResolver) {
            return false;
        }

        const squadGridPosition = this.squadMotor.getGridPosition();
        const approachSide = this.resolveApproachSide(squadGridPosition, target);
        const resolvedSlots = this.slotResolver.resolveSlots(target);
        const candidateSlots = this.filterCandidateSlots(target, approachSide, resolvedSlots);
        if (candidateSlots.length === 0) {
            return false;
        }

        const assignments = this.assignSlots(squadGridPosition, candidateSlots);
        if (assignments.length === 0) {
            return false;
        }

        this.currentTarget = target;
        this.assignments = assignments;
        this.anyWarriorEngaged = false;
        this.state = SquadEngagementState.MovingToSlots;

        const assignedWarriors = new Set<number>();
        for (const assignment of this.assignments) {
            assignedWarriors.add(assignment.warriorIndex);
            const localOffset = {
                x: assignment.slot.gridPoint.x - squadGridPosition.x,
                y: assignment.slot.gridPoint.y - squadGridPosition.y,
            };
            assignment.motor.moveToLocalGridOffset(localOffset);
            console.log(
                `[InteractionSlot] warrior=${assignment.warriorIndex} slot=${assignment.slot.id} point=(${assignment.slot.gridPoint.x.toFixed(2)}, ${assignment.slot.gridPoint.y.toFixed(2)}) facing=${assignment.slot.facing}`,
            );
        }

        // Slot 不足时，未分配者保持或回到阵型，不参与攻击。
        for (let index = 0; index < this.warriorMotors.length; index += 1) {
            if (!assignedWarriors.has(index)) {
                this.warriorMotors[index]?.returnToFormation();
            }
        }

        console.log(
            `[Engagement] begin squad=${this.squadId} target=${target.id} slots=${candidateSlots.length} assigned=${this.assignments.length}`,
        );
        return true;
    }

    public cancelAndReform(): void {
        if (!this.initialized) {
            return;
        }

        console.log(
            `[Engagement] cancel target=${this.currentTarget?.id ?? 'none'} reforming=true`,
        );
        this.currentTarget = null;
        this.assignments = [];
        this.anyWarriorEngaged = false;
        this.state = SquadEngagementState.Reforming;

        for (const motor of this.warriorMotors) {
            motor.returnToFormation();
        }

        this.tryCompleteReform();
    }

    public hasAnyWarriorEngaged(): boolean {
        return this.anyWarriorEngaged;
    }

    public isInactive(): boolean {
        return this.state === SquadEngagementState.Inactive;
    }

    public isReforming(): boolean {
        return this.state === SquadEngagementState.Reforming;
    }

    public getState(): SquadEngagementState {
        return this.state;
    }

    update(): void {
        if (!this.initialized) {
            return;
        }

        if (this.state === SquadEngagementState.MovingToSlots
            || this.state === SquadEngagementState.Engaged) {
            this.updateAssignments();
            return;
        }

        if (this.state === SquadEngagementState.Reforming) {
            this.tryCompleteReform();
        }
    }

    private updateAssignments(): void {
        for (const assignment of this.assignments) {
            if (assignment.state !== 'moving') {
                continue;
            }

            if (!assignment.motor.consumeArrived()) {
                continue;
            }

            assignment.state = 'attacking';
            this.anyWarriorEngaged = true;
            assignment.animator.playAttack(assignment.slot.facing);
            console.log(
                `[Engagement] warrior=${assignment.warriorIndex} arrived slot=${assignment.slot.id} attack=${assignment.slot.facing}`,
            );
        }

        if (this.anyWarriorEngaged) {
            this.state = SquadEngagementState.Engaged;
        }
    }

    private tryCompleteReform(): void {
        for (const motor of this.warriorMotors) {
            motor.consumeArrived();
            if (!this.isAtFormation(motor)) {
                return;
            }
        }

        this.state = SquadEngagementState.Inactive;
        console.log(`[Engagement] reform complete squad=${this.squadId}`);
    }

    private isAtFormation(motor: WarriorMotor): boolean {
        const current = motor.getCurrentLocalGridOffset();
        const formation = motor.getFormationOffset();
        return Math.abs(current.x - formation.x) <= POSITION_EPSILON
            && Math.abs(current.y - formation.y) <= POSITION_EPSILON;
    }

    private resolveApproachSide(
        squadGridPosition: GridPoint,
        target: WorldObjectData,
    ): InteractionSide {
        const visual = getWorldVisualDefinition(target.visualId);
        const left = target.gridX;
        const right = target.gridX + visual.w;
        const top = target.gridY;
        const bottom = target.gridY + visual.h;

        if (squadGridPosition.y < top) {
            return InteractionSide.Top;
        }

        if (squadGridPosition.y >= bottom) {
            return InteractionSide.Bottom;
        }

        if (squadGridPosition.x < left) {
            return InteractionSide.Left;
        }

        if (squadGridPosition.x >= right) {
            return InteractionSide.Right;
        }

        // 理论上 Squad 到达的是 approach cell；这里保底按最近边推导，避免数据轻微漂移时无侧可用。
        const centerX = target.gridX + visual.w / 2;
        const centerY = target.gridY + visual.h / 2;
        const dx = squadGridPosition.x - centerX;
        const dy = squadGridPosition.y - centerY;
        return Math.abs(dx) > Math.abs(dy)
            ? (dx < 0 ? InteractionSide.Left : InteractionSide.Right)
            : (dy < 0 ? InteractionSide.Top : InteractionSide.Bottom);
    }

    private filterCandidateSlots(
        target: WorldObjectData,
        approachSide: InteractionSide,
        slots: InteractionSlot[],
    ): InteractionSlot[] {
        const visual = getWorldVisualDefinition(target.visualId);
        const preferredSides = new Set<InteractionSide>(
            visual.w === 1 && visual.h === 1
                ? this.getPreferredSidesForSingleCell(approachSide)
                : this.getPreferredSidesForMultiCell(approachSide),
        );

        return slots.filter((slot) => preferredSides.has(slot.side));
    }

    private getPreferredSidesForMultiCell(approachSide: InteractionSide): InteractionSide[] {
        switch (approachSide) {
        case InteractionSide.Top:
            return [InteractionSide.Top, InteractionSide.Left, InteractionSide.Right, InteractionSide.Bottom];
        case InteractionSide.Bottom:
            return [InteractionSide.Bottom, InteractionSide.Left, InteractionSide.Right, InteractionSide.Top];
        case InteractionSide.Left:
            return [InteractionSide.Left, InteractionSide.Top, InteractionSide.Bottom, InteractionSide.Right];
        case InteractionSide.Right:
        default:
            return [InteractionSide.Right, InteractionSide.Top, InteractionSide.Bottom, InteractionSide.Left];
        }
    }

    private getPreferredSidesForSingleCell(approachSide: InteractionSide): InteractionSide[] {
        // 1x1 资源理论上四边都能站，但第一版仍优先 approach side + 相邻 sides，避免绕到背面穿模。
        return this.getPreferredSidesForMultiCell(approachSide);
    }

    private assignSlots(
        squadGridPosition: GridPoint,
        candidateSlots: InteractionSlot[],
    ): WarriorSlotAssignment[] {
        const availableWarriors: AssignmentCandidate[] = this.warriorMotors.map((motor, index) => ({
            warriorIndex: index,
            motor,
            animator: this.warriorAnimators[index]!,
            worldGridPosition: motor.getWorldGridPosition(squadGridPosition),
        }));
        const availableSlots = [...candidateSlots];
        const assignments: WarriorSlotAssignment[] = [];

        while (availableWarriors.length > 0 && availableSlots.length > 0) {
            let bestWarriorIndex = -1;
            let bestSlotIndex = -1;
            let bestDistance = Number.POSITIVE_INFINITY;

            for (let warriorIndex = 0; warriorIndex < availableWarriors.length; warriorIndex += 1) {
                const warrior = availableWarriors[warriorIndex];
                for (let slotIndex = 0; slotIndex < availableSlots.length; slotIndex += 1) {
                    const slot = availableSlots[slotIndex];
                    const dx = warrior.worldGridPosition.x - slot.gridPoint.x;
                    const dy = warrior.worldGridPosition.y - slot.gridPoint.y;
                    const distance = dx * dx + dy * dy;
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        bestWarriorIndex = warriorIndex;
                        bestSlotIndex = slotIndex;
                    }
                }
            }

            if (bestWarriorIndex < 0 || bestSlotIndex < 0) {
                break;
            }

            const warrior = availableWarriors.splice(bestWarriorIndex, 1)[0]!;
            const slot = availableSlots.splice(bestSlotIndex, 1)[0]!;
            assignments.push({
                warriorIndex: warrior.warriorIndex,
                motor: warrior.motor,
                animator: warrior.animator,
                slot,
                state: 'moving',
            });
        }

        return assignments;
    }
}
