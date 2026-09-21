/**
 * Why this file exists:
 * Interaction pulses need deterministic frame-rate independent sampling.
 *
 * Ownership boundary:
 * This file owns pure math helpers for damped scale pulse composition.
 *
 * This file deliberately does NOT:
 * It does not know about Cocos nodes, materials, input events, or gameplay state.
 */
import { type InteractionPulsePreset } from './InteractionFeedbackConfig';

export interface InteractionPulse extends InteractionPulsePreset {
    readonly startTime: number;
}

const TWO_PI = Math.PI * 2;

export function sampleInteractionPulse(pulse: InteractionPulse, now: number): { x: number; y: number } {
    const t = now - pulse.startTime;
    if (!Number.isFinite(t) || t < 0 || t >= pulse.duration) {
        return { x: 0, y: 0 };
    }

    const tail = sampleTailWindow(t / pulse.duration);
    const decay = Math.exp(-pulse.decay * t) * tail;
    return {
        x: pulse.amplitudeX * decay * Math.sin(TWO_PI * pulse.frequencyX * t),
        y: pulse.amplitudeY * decay * Math.sin(TWO_PI * pulse.frequencyY * t),
    };
}

export function clampInteractionScaleDelta(value: number): number {
    return Math.max(-0.20, Math.min(0.20, value));
}

function sampleTailWindow(u: number): number {
    const z = Math.max(0, Math.min(1, (u - 0.8) / 0.2));
    return 1 - z * z * (3 - 2 * z);
}
