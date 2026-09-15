/**
 * Why this file exists:
 * 多支 persistent Squad 同时存在后，玩家的“当前命令接收者”必须只有一个
 * 明确的状态拥有者，并同时支持 UI 点击与数字快捷键切换。
 *
 * Ownership boundary:
 * 本文件唯一拥有 selectedSquadId、command-slot mapping 和 selection events。
 *
 * This file deliberately does NOT:
 * 不移动 Squad、不执行 target command、不渲染 Roster，也不控制 Camera。
 */
import { _decorator, Component, EventKeyboard, input, Input, KeyCode } from 'cc';
import { type SquadRuntimeHandle, type SquadSpawnData } from './SquadTypes';

const { ccclass } = _decorator;

export interface SquadSelectionState {
    selectedSquadId: string | null;
}

export type SquadSelectionListener = (state: SquadSelectionState) => void;

@ccclass('SquadSelectionController')
export class SquadSelectionController extends Component {
    private selectedSquadId: string | null = null;
    private readonly slotToSquadId = new Map<number, string>();
    private readonly listeners = new Set<SquadSelectionListener>();
    private beforeUserSelection: (() => void) | null = null;
    private handles: ReadonlyMap<string, SquadRuntimeHandle> = new Map();

    public setup(
        squads: readonly SquadSpawnData[],
        handles: ReadonlyMap<string, SquadRuntimeHandle>,
    ): void {
        this.handles = handles;
        this.slotToSquadId.clear();
        const sorted = [...squads].sort((a, b) => a.commandSlot - b.commandSlot);
        for (const squad of sorted) {
            if (handles.has(squad.id)) this.slotToSquadId.set(squad.commandSlot, squad.id);
        }
        this.selectedSquadId = sorted.find((squad) => handles.has(squad.id))?.id ?? null;
        this.notify();
    }

    public setBeforeUserSelection(callback: (() => void) | null): void {
        this.beforeUserSelection = callback;
    }

    public selectSquad(squadId: string): boolean {
        return this.selectSquadInternal(squadId, true);
    }

    public selectSlot(slot: number): boolean {
        const squadId = this.slotToSquadId.get(slot);
        return !!squadId && this.selectSquadInternal(squadId, true);
    }

    public getSelectedSquadId(): string | null {
        return this.selectedSquadId;
    }

    public subscribe(listener: SquadSelectionListener): () => void {
        const listeners = this.listeners;
        listeners.add(listener);
        listener(this.getState());
        return () => listeners.delete(listener);
    }

    onEnable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    private onKeyDown(event: EventKeyboard): void {
        const slot = this.keyCodeToSlot(event.keyCode);
        if (slot !== null) this.selectSlot(slot);
    }

    private keyCodeToSlot(keyCode: KeyCode): number | null {
        switch (keyCode) {
        case KeyCode.DIGIT_1: return 1;
        case KeyCode.DIGIT_2: return 2;
        case KeyCode.DIGIT_3: return 3;
        case KeyCode.DIGIT_4: return 4;
        case KeyCode.DIGIT_5: return 5;
        case KeyCode.DIGIT_6: return 6;
        case KeyCode.DIGIT_7: return 7;
        case KeyCode.DIGIT_8: return 8;
        case KeyCode.DIGIT_9: return 9;
        default: return null;
        }
    }

    private selectSquadInternal(squadId: string, userInitiated: boolean): boolean {
        if (!this.handles.has(squadId)) return false;
        if (userInitiated) this.beforeUserSelection?.();
        if (this.selectedSquadId === squadId) return true;
        this.selectedSquadId = squadId;
        this.notify();
        return true;
    }

    private getState(): SquadSelectionState {
        return { selectedSquadId: this.selectedSquadId };
    }

    private notify(): void {
        const state = this.getState();
        for (const listener of this.listeners) listener(state);
    }
}
