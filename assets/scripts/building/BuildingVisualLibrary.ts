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
import { type BuildingAnimationSet, type BuildingFrameClip } from './BuildingFrameAnimation';

const VISUAL_CONFIG: Readonly<Record<string, { defaultState: string; clips: Readonly<Record<string, { frameUuids: readonly string[]; frameSeconds: number }>> }>> = {
    towncenter: {
        defaultState: 'idle',
        clips: {
            idle: { frameUuids: ['89b116e7-6b29-4acd-b553-625ac46f5e4a@f9941'], frameSeconds: 0.4 },
            ready: { frameUuids: ['a5e06615-45ef-414d-9a35-32431801e4a9@f9941', '31f95c6c-4025-4d6e-bcdb-9f1be9f4421e@f9941'], frameSeconds: 0.4 },
        },
    },
    storage_house_01: { defaultState: 'idle', clips: { idle: { frameUuids: ['1110d710-bebe-4d25-88ed-5954c5c5757a@f9941'], frameSeconds: 0.4 } } },
    lumberjack_house_01: { defaultState: 'idle', clips: { idle: { frameUuids: ['bf1d01c0-f7da-4f0a-9317-43fdc0db77f5@f9941'], frameSeconds: 0.4 } } },
    barracks_01: { defaultState: 'idle', clips: { idle: { frameUuids: ['d9909d8e-6d10-424d-867f-62d986f3c0e0@f9941'], frameSeconds: 0.4 } } },
    blacksmith_house_01: { defaultState: 'idle', clips: { idle: { frameUuids: ['6b4f0b18-0ff8-40fb-a7cb-be01251b27c3@f9941'], frameSeconds: 0.4 } } },
};

export class BuildingVisualLibrary {
    private readonly frames = new Map<string, SpriteFrame>();
    private readonly animations = new Map<string, BuildingAnimationSet>();

    public static async load(): Promise<BuildingVisualLibrary> {
        const library = new BuildingVisualLibrary();
        await library.loadAll();
        return library;
    }

    public getFrame(definitionId: string): SpriteFrame | null {
        return this.frames.get(definitionId) ?? this.animations.get(definitionId)?.clips.idle?.frames[0] ?? null;
    }

    public getAnimationSet(visualKey: string): BuildingAnimationSet | null {
        return this.animations.get(visualKey) ?? null;
    }

    private async loadAll(): Promise<void> {
        const loaded = new Map<string, SpriteFrame>();
        const uuids = new Set<string>();
        for (const config of Object.values(VISUAL_CONFIG)) {
            for (const clip of Object.values(config.clips)) for (const uuid of clip.frameUuids) uuids.add(uuid);
        }
        await Promise.all([...uuids].map(async (uuid) => {
            const frame = await this.loadOptionalSpriteFrame(uuid);
            if (frame) loaded.set(uuid, frame);
        }));
        for (const [key, config] of Object.entries(VISUAL_CONFIG)) {
            const clips: Record<string, BuildingFrameClip> = {};
            for (const [state, clipConfig] of Object.entries(config.clips)) {
                const frames = clipConfig.frameUuids.map((uuid) => loaded.get(uuid)).filter((frame): frame is SpriteFrame => !!frame);
                if (frames.length) clips[state] = { frames, frameSeconds: clipConfig.frameSeconds };
            }
            if (!clips[config.defaultState]) {
                if (key === 'towncenter') throw new Error('[BuildingVisualLibrary] towncenter idle asset missing.');
                continue;
            }
            this.animations.set(key, { defaultState: config.defaultState, clips });
            const first = clips[config.defaultState]?.frames[0];
            if (first) this.frames.set(key, first);
        }
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
