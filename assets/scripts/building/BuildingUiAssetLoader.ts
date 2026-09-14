/**
 * Why this file exists:
 * Building UI 需要独立加载卡片背景等 UI SpriteFrame，避免把 UI 美术资源
 * 继续堆到 MainMapController Inspector 中。
 *
 * Ownership boundary:
 * 本文件只负责 Building UI 静态资源的异步加载与返回。
 *
 * This file deliberately does NOT:
 * 不创建卡片、不读取 Blueprint、不处理 Build Mode，也不执行地图交互。
 */
import { assetManager, resources, SpriteFrame } from 'cc';
import { BLUEPRINT_CARD_RESOURCE_PATH, BLUEPRINT_CARD_SPRITE_FRAME_UUID } from './BuildCardUiConfig';

export interface BuildingUiAssets {
    blueprintCardFrame: SpriteFrame | null;
}

export class BuildingUiAssetLoader {
    public async load(): Promise<BuildingUiAssets> {
        return {
            blueprintCardFrame: await this.loadOptionalSpriteFrame(BLUEPRINT_CARD_RESOURCE_PATH)
                ?? await this.loadOptionalSpriteFrameByUuid(BLUEPRINT_CARD_SPRITE_FRAME_UUID),
        };
    }

    private loadOptionalSpriteFrame(path: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            resources.load(path, SpriteFrame, (error, frame) => {
                if (error || !frame) {
                    console.warn(`[BuildingUiAssetLoader] optional sprite missing: ${path}`);
                    resolve(null);
                    return;
                }
                resolve(frame);
            });
        });
    }

    private loadOptionalSpriteFrameByUuid(uuid: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            assetManager.loadAny<SpriteFrame>(uuid, (error, frame) => {
                if (error || !frame) {
                    console.warn(`[BuildingUiAssetLoader] optional sprite uuid missing: ${uuid}`);
                    resolve(null);
                    return;
                }
                resolve(frame);
            });
        });
    }
}
