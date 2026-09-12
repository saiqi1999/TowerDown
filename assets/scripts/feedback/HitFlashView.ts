import { _decorator, Component, Material, Sprite, renderer } from 'cc';

const { ccclass } = _decorator;

const FLASH_HOLD_SECONDS = 0.06;
const FLASH_FADE_SECONDS = 0.08;

export interface HitFlashViewConfig {
    sprite: Sprite;
    baseMaterial: Material;
}

@ccclass('HitFlashView')
export class HitFlashView extends Component {
    private sprite: Sprite | null = null;
    private materialInstance: renderer.MaterialInstance | null = null;
    private elapsed = 0;
    private flashing = false;
    private initialized = false;

    public setup(config: HitFlashViewConfig): void {
        // 这里强制从共享材质派生实例，是为了把“资源共用同一份效果定义”和“每个资源独立改 flashAmount”同时满足。
        this.sprite = config.sprite;
        this.sprite.setSharedMaterial(config.baseMaterial, 0);
        this.materialInstance = this.sprite.getMaterialInstance(0);
        if (!this.materialInstance) {
            throw new Error('[HitFlashView] failed to create material instance.');
        }

        this.elapsed = 0;
        this.flashing = false;
        this.initialized = true;
        // 每个资源都必须拥有独立材质实例，否则一次命中会把所有同材质资源一起染白。
        this.setFlashAmount(0);
    }

    public flash(): void {
        // flash 采用 restart 而不是排队，是为了让多人连续命中时仍然维持简洁、稳定的受击反馈。
        if (!this.initialized) {
            return;
        }

        // 连续多人命中时直接重启闪白，不排队也不叠多个计时器。
        this.elapsed = 0;
        this.flashing = true;
        this.setFlashAmount(1);
    }

    update(dt: number): void {
        // 不使用 Tween，是为了避免同一资源短时间多次受击时堆叠出多条并发动画和计时器。
        if (!this.flashing) {
            return;
        }

        this.elapsed += dt;
        if (this.elapsed <= FLASH_HOLD_SECONDS) {
            this.setFlashAmount(1);
            return;
        }

        const fadeElapsed = this.elapsed - FLASH_HOLD_SECONDS;
        const t = Math.min(fadeElapsed / FLASH_FADE_SECONDS, 1);
        this.setFlashAmount(1 - t);

        if (t >= 1) {
            this.flashing = false;
            this.setFlashAmount(0);
        }
    }

    onDisable(): void {
        // 节点被隐藏时立刻归零，避免资源池复用或开关节点后残留半白状态。
        this.flashing = false;
        this.elapsed = 0;
        this.setFlashAmount(0);
    }

    onDestroy(): void {
        // 销毁时连同材质实例一起释放，防止 runtime instance 越积越多。
        this.flashing = false;
        this.elapsed = 0;
        this.setFlashAmount(0);
        this.materialInstance?.destroy();
        this.materialInstance = null;
        this.sprite = null;
    }

    private setFlashAmount(value: number): void {
        // flashAmount 是 shader 唯一的可写入口，这样视觉层就不会反向耦合到任何战斗字段。
        this.materialInstance?.setProperty('flashAmount', value);
    }
}
