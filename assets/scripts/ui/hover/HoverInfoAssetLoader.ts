/**
 * Why this file exists:
 * The shared hover panel needs its background SpriteFrame without an Inspector dependency.
 *
 * Ownership boundary:
 * This file owns loading and preparing the hover background for 9-slice rendering.
 *
 * This file deliberately does NOT:
 * It does not create the panel or decide how tooltip content is laid out.
 */
import { assetManager, SpriteFrame } from 'cc';
import {
    HOVER_BACKGROUND_SPRITE_FRAME_UUID,
    HOVER_BG_INSET_BOTTOM,
    HOVER_BG_INSET_LEFT,
    HOVER_BG_INSET_RIGHT,
    HOVER_BG_INSET_TOP,
} from './HoverInfoUiConfig';

export interface HoverInfoAssets {
    readonly backgroundFrame: SpriteFrame | null;
}

export class HoverInfoAssetLoader {
    public async load(): Promise<HoverInfoAssets> {
        const backgroundFrame = await new Promise<SpriteFrame | null>((resolve) => {
            assetManager.loadAny<SpriteFrame>(
                HOVER_BACKGROUND_SPRITE_FRAME_UUID,
                (error, frame) => {
                    if (error || !frame) {
                        console.warn('[HoverInfoAssetLoader] hover background is unavailable.');
                        resolve(null);
                        return;
                    }
                    resolve(frame);
                },
            );
        });
        if (backgroundFrame) {
            backgroundFrame.insetLeft = HOVER_BG_INSET_LEFT;
            backgroundFrame.insetRight = HOVER_BG_INSET_RIGHT;
            backgroundFrame.insetTop = HOVER_BG_INSET_TOP;
            backgroundFrame.insetBottom = HOVER_BG_INSET_BOTTOM;
            const slicedFrame = backgroundFrame as SpriteFrame & {
                calculateSlicedUV?: () => void;
            };
            slicedFrame.calculateSlicedUV?.();
        }
        return { backgroundFrame };
    }
}
