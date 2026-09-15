/**
 * Why this file exists:
 * Squad UI needs portrait and command flag assets without adding more Inspector wiring to MainMapController.
 *
 * Ownership boundary:
 * This file only loads static Squad UI assets.
 *
 * This file deliberately does NOT:
 * It does not create roster nodes, own selection state, or issue commands.
 */
import { Asset, assetManager, SpriteFrame, Texture2D } from 'cc';

const WARRIOR_SWORD_PORTRAIT_UUID = '7b2f5a9e-84e2-4c4a-bacc-44440db08191@f9941';
const TARGET_FLAG2_TEXTURE_UUID = '7dfd6875-e59b-4a3e-afec-f1e61c716a09@6c48a';

export interface SquadUiAssets {
    swordWarriorPortrait: SpriteFrame | null;
    targetFlagTexture: Texture2D | null;
}

export class SquadUiAssetLoader {
    public async load(): Promise<SquadUiAssets> {
        const [swordWarriorPortrait, targetFlagTexture] = await Promise.all([
            this.loadOptional<SpriteFrame>(WARRIOR_SWORD_PORTRAIT_UUID),
            this.loadOptional<Texture2D>(TARGET_FLAG2_TEXTURE_UUID),
        ]);
        return { swordWarriorPortrait, targetFlagTexture };
    }

    private loadOptional<T extends Asset>(uuid: string): Promise<T | null> {
        return new Promise((resolve) => {
            assetManager.loadAny<T>(uuid, (error, asset) => {
                if (error || !asset) {
                    console.warn(`[SquadUiAssetLoader] optional asset missing: ${uuid}`);
                    resolve(null);
                    return;
                }
                resolve(asset);
            });
        });
    }
}
