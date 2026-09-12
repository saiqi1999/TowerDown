import { type NavigationGrid } from '../navigation/NavigationGrid';
import { type GridPoint } from '../navigation/NavigationTypes';
import { getWorldVisualDefinition } from '../world/WorldAtlasConfig';
import { type WorldObjectData } from '../world/WorldObjectTypes';
import {
    InteractionSide,
    INTERACTION_CONTACT_GAP_CELLS,
    type InteractionSlot,
} from './InteractionTypes';
import { WarriorDirection } from './WarriorSpriteConfig';

export class InteractionSlotResolver {
    constructor(
        private readonly navigationGrid: NavigationGrid,
    ) {}

    public resolveSlots(target: WorldObjectData): InteractionSlot[] {
        const visual = getWorldVisualDefinition(target.visualId);
        const left = target.gridX;
        const right = target.gridX + visual.w;
        const top = target.gridY;
        const bottom = target.gridY + visual.h;
        const allSlots: InteractionSlot[] = [];

        for (let x = left; x < right; x += 1) {
            allSlots.push(this.createSlot(
                InteractionSide.Top,
                x - left,
                {
                    x: x + 0.5,
                    y: top - INTERACTION_CONTACT_GAP_CELLS,
                },
            ));
            allSlots.push(this.createSlot(
                InteractionSide.Bottom,
                x - left,
                {
                    x: x + 0.5,
                    y: bottom + INTERACTION_CONTACT_GAP_CELLS,
                },
            ));
        }

        for (let y = top; y < bottom; y += 1) {
            allSlots.push(this.createSlot(
                InteractionSide.Left,
                y - top,
                {
                    x: left - INTERACTION_CONTACT_GAP_CELLS,
                    y: y + 0.5,
                },
            ));
            allSlots.push(this.createSlot(
                InteractionSide.Right,
                y - top,
                {
                    x: right + INTERACTION_CONTACT_GAP_CELLS,
                    y: y + 0.5,
                },
            ));
        }

        return allSlots.filter((slot) => this.isSlotAvailable(slot));
    }

    private createSlot(
        side: InteractionSide,
        index: number,
        gridPoint: GridPoint,
    ): InteractionSlot {
        return {
            id: `${this.getSideLabel(side)}_${index}`,
            gridPoint,
            facing: this.resolveFacing(side),
            side,
        };
    }

    private isSlotAvailable(slot: InteractionSlot): boolean {
        const cellX = Math.floor(slot.gridPoint.x);
        const cellY = Math.floor(slot.gridPoint.y);

        // Slot 是浮点接触点，但可达性仍由其落在哪个导航格来判定。
        return this.navigationGrid.isInside(cellX, cellY)
            && this.navigationGrid.isWalkable(cellX, cellY);
    }

    private resolveFacing(side: InteractionSide): WarriorDirection {
        switch (side) {
        case InteractionSide.Top:
            return WarriorDirection.Down;
        case InteractionSide.Bottom:
            return WarriorDirection.Up;
        case InteractionSide.Left:
            return WarriorDirection.Right;
        case InteractionSide.Right:
        default:
            return WarriorDirection.Left;
        }
    }

    private getSideLabel(side: InteractionSide): string {
        switch (side) {
        case InteractionSide.Top:
            return 'Top';
        case InteractionSide.Bottom:
            return 'Bottom';
        case InteractionSide.Left:
            return 'Left';
        case InteractionSide.Right:
        default:
            return 'Right';
        }
    }
}
