/**
 * Why this file exists:
 * 2×2 prototype buildings use standalone imported pixel-art sprites rather than the old atlas crop.
 *
 * Ownership boundary:
 * This file owns building definition id -> SpriteFrame asset lookup and optional loading.
 *
 * This file deliberately does NOT:
 * It does not create building nodes, validate placement, or decide blueprint availability.
 */
import { assetManager, SpriteFrame } from 'cc';

const BUILDING_SPRITE_FRAME_UUIDS: Readonly<Record<string, string>> = {
    storage_house_01: '1110d710-bebe-4d25-88ed-5954c5c5757a@f9941',
    lumberjack_house_01: '4f285e40-b40e-48cb-9b50-19f6dff09321@f9941',
    barracks_01: 'd9909d8e-6d10-424d-867f-62d986f3c0e0@f9941',
    blacksmith_house_01: '6b4f0b18-0ff8-40fb-a7cb-be01251b27c3@f9941',
};

export class BuildingVisualLibrary {
    private readonly frames = new Map<string, SpriteFrame>();

    public static async load(): Promise<BuildingVisualLibrary> {
        const library = new BuildingVisualLibrary();
        await library.loadAll();
        return library;
    }

    public getFrame(definitionId: string): SpriteFrame | null {
        return this.frames.get(definitionId) ?? null;
    }

    private async loadAll(): Promise<void> {
        const entries = Object.keys(BUILDING_SPRITE_FRAME_UUIDS).map((id) => ({
            id,
            uuid: BUILDING_SPRITE_FRAME_UUIDS[id]!,
        }));
        await Promise.all(entries.map(async ({ id, uuid }) => {
            const frame = await this.loadOptionalSpriteFrame(uuid);
            if (frame) this.frames.set(id, frame);
        }));
    }

    private loadOptionalSpriteFrame(uuid: string): Promise<SpriteFrame | null> {
        return new Promise((resolve) => {
            assetManager.loadAny<SpriteFrame>(uuid, (error, frame) => {
                if (error || !frame) {
                    console.warn(`[BuildingVisualLibrary] optional building sprite missing: ${uuid}`);
                    resolve(null);
                    return;
                }
                resolve(frame);
            });
        });
    }
}
