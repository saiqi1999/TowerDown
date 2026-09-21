/**
 * Why this file exists:
 * Hover targets and the shared panel need a small, gameplay-agnostic data contract.
 *
 * Ownership boundary:
 * This file owns hover placement, scope, target kind, and display model types.
 *
 * This file deliberately does NOT:
 * It does not create nodes, read gameplay state, or decide when a tooltip is visible.
 */
import { type Node } from 'cc';
import { type HoverInfoController } from './HoverInfoController';

export enum HoverPlacement {
    Top = 'top',
    Right = 'right',
    Left = 'left',
    Bottom = 'bottom',
}

export enum HoverTargetKind {
    Blueprint = 'blueprint',
    Squad = 'squad',
    Building = 'building',
    Resource = 'resource',
    Monster = 'monster',
    Base = 'base',
}

export enum HoverTargetScope {
    UI = 'ui',
    World = 'world',
}

export interface HoverInfoRow {
    readonly label?: string;
    readonly value: string;
}

export interface HoverInfoModel {
    readonly title: string;
    readonly subtitle?: string;
    readonly rows?: readonly HoverInfoRow[];
    readonly footer?: string;
}

export interface HoverInfoTargetConfig {
    readonly kind: HoverTargetKind;
    readonly scope: HoverTargetScope;
    readonly preferredPlacement: HoverPlacement;
    readonly controller: HoverInfoController;
    readonly getInfo: () => HoverInfoModel;
    readonly onHoverChanged?: (hovered: boolean) => void;
}

export interface HoverInfoSource {
    readonly anchor: Node;
    readonly kind: HoverTargetKind;
    readonly scope: HoverTargetScope;
    readonly preferredPlacement: HoverPlacement;
    readonly getInfo: () => HoverInfoModel;
    readonly onHoverChanged?: (hovered: boolean) => void;
}
