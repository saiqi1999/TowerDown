/**
 * Why this file exists:
 * Hover feedback needs a subtle per-sprite RGB gain without reusing combat hit flash.
 *
 * Ownership boundary:
 * This file owns interaction brightness material instances for explicitly listed sprites.
 *
 * This file deliberately does NOT:
 * It does not animate scale, alter SpriteFrame assets, or touch unlisted sprites.
 */
import { _decorator, Component, Material, Sprite, renderer } from 'cc';

const { ccclass } = _decorator;

interface BrightnessTarget {
    readonly sprite: Sprite;
    readonly originalMaterial: Material | null;
    readonly instance: renderer.MaterialInstance;
}

@ccclass('InteractionBrightnessView')
export class InteractionBrightnessView extends Component {
    private readonly targets: BrightnessTarget[] = [];
    private value = Number.NaN;

    public setup(sprites: readonly Sprite[], baseMaterial: Material | null): void {
        this.restoreAndClear();
        if (!baseMaterial) {
            this.value = 0;
            return;
        }

        for (const sprite of sprites) {
            if (!sprite?.isValid) {
                continue;
            }
            const originalMaterial = sprite.getSharedMaterial(0);
            sprite.setSharedMaterial(baseMaterial, 0);
            const instance = sprite.getMaterialInstance(0);
            if (!instance) {
                continue;
            }
            this.targets.push({ sprite, originalMaterial, instance });
        }

        this.setBrightnessGain(0);
    }

    public setBrightnessGain(value: number): void {
        const next = Number.isFinite(value) ? Math.max(0, value) : 0;
        if (next === this.value) {
            return;
        }
        this.value = next;
        for (const target of this.targets) {
            target.instance.setProperty('brightnessGain', next);
        }
    }

    protected onDisable(): void {
        this.setBrightnessGain(0);
    }

    protected onDestroy(): void {
        this.setBrightnessGain(0);
        this.restoreAndClear();
    }

    private restoreAndClear(): void {
        for (const target of this.targets) {
            if (target.sprite.isValid && target.sprite.getMaterialInstance(0) === target.instance) {
                target.sprite.setSharedMaterial(target.originalMaterial, 0);
            }
            target.instance.destroy();
        }
        this.targets.length = 0;
        this.value = Number.NaN;
    }
}
