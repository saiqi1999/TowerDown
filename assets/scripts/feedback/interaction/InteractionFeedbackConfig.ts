/**
 * Why this file exists:
 * Interaction feedback needs shared, named presets so world and UI entry points feel coherent.
 *
 * Ownership boundary:
 * This file owns static tuning data for sustained hover scale, click pulses, and hover brightness.
 *
 * This file deliberately does NOT:
 * It does not sample animation curves, touch nodes, or decide whether feedback is allowed.
 */

export enum InteractionFeedbackPresetId {
    WorldBuilding = 'world-building',
    SquadCard = 'squad-card',
    BlueprintCard = 'blueprint-card',
}

export interface InteractionPulsePreset {
    readonly amplitudeX: number;
    readonly amplitudeY: number;
    readonly frequencyX: number;
    readonly frequencyY: number;
    readonly decay: number;
    readonly duration: number;
}

export interface InteractionFeedbackPreset {
    readonly hoverScaleMultiplier: number;
    readonly click: InteractionPulsePreset;
    readonly hoverBrightnessGain: number;
}

export const INTERACTION_FEEDBACK_PRESETS: Readonly<Record<InteractionFeedbackPresetId, InteractionFeedbackPreset>> = {
    [InteractionFeedbackPresetId.WorldBuilding]: {
        hoverScaleMultiplier: 1.05,
        click: { amplitudeX: 0.080, amplitudeY: -0.105, frequencyX: 4, frequencyY: 5, decay: 6, duration: 0.60 },
        hoverBrightnessGain: 0.06,
    },
    [InteractionFeedbackPresetId.SquadCard]: {
        hoverScaleMultiplier: 1.05,
        click: { amplitudeX: 0.060, amplitudeY: -0.075, frequencyX: 4.5, frequencyY: 5.5, decay: 7, duration: 0.50 },
        hoverBrightnessGain: 0.05,
    },
    [InteractionFeedbackPresetId.BlueprintCard]: {
        hoverScaleMultiplier: 1.05,
        click: { amplitudeX: 0.065, amplitudeY: -0.085, frequencyX: 4.5, frequencyY: 5.5, decay: 7, duration: 0.55 },
        hoverBrightnessGain: 0.05,
    },
};
