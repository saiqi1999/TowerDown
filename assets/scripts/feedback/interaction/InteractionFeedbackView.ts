/**
 * Why this file exists:
 * Hover and click feedback need one component to compose sustained hover state,
 * click pulses, and brightness.
 *
 * Ownership boundary:
 * This file owns one feedback target's visual root scale and listed sprite brightness.
 *
 * This file deliberately does NOT:
 * It does not decide gameplay gates, select squads, build structures, or show tooltips.
 */
import { _decorator, Component, Material, Node, Sprite, Vec3 } from 'cc';
import {
    INTERACTION_FEEDBACK_PRESETS,
    InteractionFeedbackPresetId,
    type InteractionFeedbackPreset,
    type InteractionPulsePreset,
} from './InteractionFeedbackConfig';
import {
    clampInteractionScaleDelta,
    sampleInteractionPulse,
    type InteractionPulse,
} from './InteractionFeedbackMath';
import { InteractionBrightnessView } from './InteractionBrightnessView';

const { ccclass } = _decorator;

export interface InteractionFeedbackViewConfig {
    readonly visualRoot: Node;
    readonly presetId: InteractionFeedbackPresetId;
    readonly brightnessTargets?: readonly Sprite[];
    readonly brightnessMaterial?: Material | null;
}

@ccclass('InteractionFeedbackView')
export class InteractionFeedbackView extends Component {
    private visualRoot: Node | null = null;
    private preset: InteractionFeedbackPreset = INTERACTION_FEEDBACK_PRESETS[InteractionFeedbackPresetId.WorldBuilding];
    private brightness: InteractionBrightnessView | null = null;
    private baseScale = new Vec3(1, 1, 1);
    private readonly pulses: InteractionPulse[] = [];
    private now = 0;
    private hovered = false;
    private enabledForInteraction = true;

    public setup(config: InteractionFeedbackViewConfig): void {
        this.resetFeedback();
        this.visualRoot = config.visualRoot;
        this.preset = INTERACTION_FEEDBACK_PRESETS[config.presetId];
        this.baseScale.set(config.visualRoot.scale);
        this.pulses.length = 0;
        this.now = 0;
        this.hovered = false;
        this.enabledForInteraction = true;
        this.brightness = this.node.getComponent(InteractionBrightnessView)
            ?? this.node.addComponent(InteractionBrightnessView);
        this.brightness.setup(config.brightnessTargets ?? [], config.brightnessMaterial ?? null);
        this.applyScale();
        this.applyBrightness();
    }

    public setHovered(hovered: boolean): void {
        if (this.hovered === hovered) {
            return;
        }
        this.hovered = hovered;
        this.applyScale();
        this.applyBrightness();
    }

    public playClick(): void {
        if (!this.enabledForInteraction) {
            return;
        }
        this.pushPulse(this.preset.click);
    }

    public setInteractionEnabled(enabled: boolean): void {
        if (this.enabledForInteraction === enabled) {
            return;
        }
        this.enabledForInteraction = enabled;
        this.applyScale();
        this.applyBrightness();
    }

    update(dt: number): void {
        if (!this.visualRoot || this.pulses.length === 0) {
            return;
        }
        this.now += Number.isFinite(dt) && dt > 0 ? dt : 0;
        this.removeExpiredPulses();
        this.applyScale();
    }

    protected onDisable(): void {
        this.resetFeedback();
    }

    protected onDestroy(): void {
        this.resetFeedback();
        this.visualRoot = null;
        this.brightness = null;
        this.pulses.length = 0;
    }

    private pushPulse(preset: InteractionPulsePreset): void {
        this.pulses.push({ ...preset, startTime: this.now });
        this.applyScale();
    }

    private removeExpiredPulses(): void {
        for (let index = this.pulses.length - 1; index >= 0; index -= 1) {
            const pulse = this.pulses[index];
            if (this.now - pulse.startTime >= pulse.duration) {
                this.pulses.splice(index, 1);
            }
        }
    }

    private applyScale(): void {
        const root = this.visualRoot;
        if (!root?.isValid) {
            return;
        }

        const hoverScale = this.isHoverVisualActive()
            ? this.preset.hoverScaleMultiplier
            : 1;
        let sumX = 0;
        let sumY = 0;
        for (const pulse of this.pulses) {
            const sample = sampleInteractionPulse(pulse, this.now);
            sumX += sample.x;
            sumY += sample.y;
        }

        root.setScale(
            this.baseScale.x * hoverScale * (1 + clampInteractionScaleDelta(sumX)),
            this.baseScale.y * hoverScale * (1 + clampInteractionScaleDelta(sumY)),
            this.baseScale.z,
        );
    }

    private applyBrightness(): void {
        this.brightness?.setBrightnessGain(
            this.isHoverVisualActive()
                ? this.preset.hoverBrightnessGain
                : 0,
        );
    }

    private isHoverVisualActive(): boolean {
        return this.hovered && this.enabledForInteraction;
    }

    private resetFeedback(): void {
        this.hovered = false;
        this.pulses.length = 0;
        this.now = 0;
        this.applyScale();
        this.applyBrightness();
    }
}
