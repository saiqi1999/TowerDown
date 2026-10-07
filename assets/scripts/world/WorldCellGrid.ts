/**
 * Why this file exists:
 * 建造需要知道静态世界格子被谁占用，而 TerrainMap 与 NavigationGrid 回答的是不同问题。
 *
 * Ownership boundary:
 * 本文件拥有 Base、Resource、Building 的静态 cell occupancy。
 *
 * This file deliberately does NOT:
 * 不做寻路、不保存 Terrain、不跟踪移动 Actor，也不渲染对象。
 */
import { type GridCell, type NavCell } from '../navigation/NavigationTypes';
export enum WorldCellFlag { None = 0, Base = 1 << 0, Resource = 1 << 1, Building = 1 << 2, Reserved = 1 << 3 }
export const BUILD_PLACEMENT_BLOCK_MASK = WorldCellFlag.Base | WorldCellFlag.Resource | WorldCellFlag.Building | WorldCellFlag.Reserved;

export interface WorldOccupant {
    ownerId: string;
    flag: WorldCellFlag;
    placementCells: readonly GridCell[];
    navBlockedCells: readonly NavCell[];
}

export class WorldCellGrid {
    private readonly flags: Uint16Array;
    private readonly navBlocked: Uint8Array;
    private readonly owners = new Map<string, WorldOccupant>();
    private originRevision: number;
    private currentRevision = 0;

    constructor(public readonly width: number, public readonly height: number) {
        if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
            throw new Error(`[WorldCellGrid] invalid size: ${width}x${height}`);
        }
        this.flags = new Uint16Array(width * height);
        this.navBlocked = new Uint8Array(width * height * 4);
        this.originRevision = 0;
    }

    public get revision(): number { return this.currentRevision; }
    public get navWidth(): number { return this.width * 2; }
    public get navHeight(): number { return this.height * 2; }

    public isInside(x: number, y: number): boolean {
        return Number.isInteger(x) && Number.isInteger(y)
            && x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    public isNavInside(nx: number, ny: number): boolean {
        return Number.isInteger(nx) && Number.isInteger(ny)
            && nx >= 0 && ny >= 0 && nx < this.navWidth && ny < this.navHeight;
    }

    public getFlags(x: number, y: number): WorldCellFlag { return this.isInside(x, y) ? this.flags[y * this.width + x] as WorldCellFlag : WorldCellFlag.None; }
    public isBlocked(x: number, y: number, mask = BUILD_PLACEMENT_BLOCK_MASK): boolean { return (this.getFlags(x, y) & mask) !== 0; }

    public isNavBlocked(nx: number, ny: number): boolean {
        if (!this.isNavInside(nx, ny)) return true;
        return this.navBlocked[ny * this.navWidth + nx] !== 0;
    }

    public claimOccupant(record: WorldOccupant): void {
        this.validateRecord(record);
        if (this.owners.has(record.ownerId)) {
            throw new Error(`[WorldCellGrid] duplicate owner: ${record.ownerId}`);
        }
        for (const cell of record.placementCells) {
            if (this.getFlags(cell.x, cell.y) !== WorldCellFlag.None) {
                throw new Error(`[WorldCellGrid] occupied: (${cell.x},${cell.y})`);
            }
        }
        const stored = cloneRecord(record);
        for (const cell of stored.placementCells) {
            this.flags[cell.y * this.width + cell.x] = stored.flag;
        }
        for (const cell of stored.navBlockedCells) {
            this.navBlocked[cell.ny * this.navWidth + cell.nx] = 1;
        }
        this.owners.set(stored.ownerId, stored);
        this.currentRevision += 1;
    }

    public releaseOwner(ownerId: string): void {
        const record = this.owners.get(ownerId);
        if (!record) return;
        for (const cell of record.placementCells) {
            this.flags[cell.y * this.width + cell.x] = WorldCellFlag.None;
        }
        for (const cell of record.navBlockedCells) {
            this.navBlocked[cell.ny * this.navWidth + cell.nx] = 0;
        }
        this.owners.delete(ownerId);
        this.currentRevision += 1;
    }

    public getOwnerCells(ownerId: string): readonly GridCell[] {
        return this.owners.get(ownerId)?.placementCells.map((cell) => ({ ...cell })) ?? [];
    }

    public getOwnerRecord(ownerId: string): WorldOccupant | null {
        const record = this.owners.get(ownerId);
        return record ? cloneRecord(record) : null;
    }

    public getAllOwnerRecords(): readonly WorldOccupant[] {
        return [...this.owners.values()].map(cloneRecord);
    }

    public clone(): WorldCellGrid {
        const candidate = new WorldCellGrid(this.width, this.height);
        candidate.originRevision = this.currentRevision;
        candidate.currentRevision = this.currentRevision;
        candidate.copyStateFrom(this);
        return candidate;
    }

    public createEmptyCandidate(): WorldCellGrid {
        const candidate = new WorldCellGrid(this.width, this.height);
        candidate.originRevision = this.currentRevision;
        return candidate;
    }

    public replaceFrom(candidate: WorldCellGrid): void {
        if (candidate.width !== this.width || candidate.height !== this.height) {
            throw new Error('[WorldCellGrid] replaceFrom size mismatch.');
        }
        if (candidate.originRevision !== this.currentRevision) {
            throw new Error(
                `[WorldCellGrid] stale candidate: expected revision ${this.currentRevision}, got ${candidate.originRevision}.`,
            );
        }
        candidate.assertConsistent();
        this.copyStateFrom(candidate);
        this.currentRevision += 1;
        this.originRevision = this.currentRevision;
    }

    public assertConsistent(): void {
        const expectedFlags = new Uint16Array(this.flags.length);
        const expectedNav = new Uint8Array(this.navBlocked.length);
        for (const record of this.owners.values()) {
            this.validateRecord(record);
            for (const cell of record.placementCells) {
                const index = cell.y * this.width + cell.x;
                if (expectedFlags[index] !== WorldCellFlag.None) {
                    throw new Error(`[WorldCellGrid] overlapping placement index: ${index}`);
                }
                expectedFlags[index] = record.flag;
            }
            for (const cell of record.navBlockedCells) {
                const index = cell.ny * this.navWidth + cell.nx;
                if (expectedNav[index] !== 0) {
                    throw new Error(`[WorldCellGrid] overlapping navigation index: ${index}`);
                }
                expectedNav[index] = 1;
            }
        }
        if (!arraysEqual(expectedFlags, this.flags) || !arraysEqual(expectedNav, this.navBlocked)) {
            throw new Error('[WorldCellGrid] derived indexes are inconsistent with owner records.');
        }
    }

    private validateRecord(record: WorldOccupant): void {
        if (!record.ownerId) throw new Error('[WorldCellGrid] ownerId is required.');
        if (record.flag === WorldCellFlag.None) {
            throw new Error(`[WorldCellGrid] owner ${record.ownerId} must have a flag.`);
        }
        if (record.placementCells.length === 0) {
            throw new Error(`[WorldCellGrid] owner ${record.ownerId} has no placement cells.`);
        }
        const placementKeys = new Set<string>();
        for (const cell of record.placementCells) {
            if (!this.isInside(cell.x, cell.y)) {
                throw new Error(`[WorldCellGrid] placement out of bounds: (${cell.x},${cell.y})`);
            }
            const key = `${cell.x},${cell.y}`;
            if (placementKeys.has(key)) {
                throw new Error(`[WorldCellGrid] duplicate placement cell: ${key}`);
            }
            placementKeys.add(key);
        }
        const navKeys = new Set<string>();
        for (const cell of record.navBlockedCells) {
            if (!this.isNavInside(cell.nx, cell.ny)) {
                throw new Error(`[WorldCellGrid] navigation out of bounds: (${cell.nx},${cell.ny})`);
            }
            const key = `${cell.nx},${cell.ny}`;
            if (navKeys.has(key)) {
                throw new Error(`[WorldCellGrid] duplicate navigation cell: ${key}`);
            }
            navKeys.add(key);
            if (!placementKeys.has(`${Math.floor(cell.nx / 2)},${Math.floor(cell.ny / 2)}`)) {
                throw new Error(
                    `[WorldCellGrid] navigation cell (${cell.nx},${cell.ny}) lies outside owner placement.`,
                );
            }
        }
    }

    private copyStateFrom(source: WorldCellGrid): void {
        this.flags.set(source.flags);
        this.navBlocked.set(source.navBlocked);
        this.owners.clear();
        for (const [ownerId, record] of source.owners) {
            this.owners.set(ownerId, cloneRecord(record));
        }
    }
}

function cloneRecord(record: WorldOccupant): WorldOccupant {
    return {
        ownerId: record.ownerId,
        flag: record.flag,
        placementCells: record.placementCells.map((cell) => ({ ...cell })),
        navBlockedCells: record.navBlockedCells.map((cell) => ({ ...cell })),
    };
}

function arraysEqual(a: Uint16Array | Uint8Array, b: Uint16Array | Uint8Array): boolean {
    if (a.length !== b.length) return false;
    for (let index = 0; index < a.length; index += 1) {
        if (a[index] !== b[index]) return false;
    }
    return true;
}
