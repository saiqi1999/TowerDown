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
import { type GridCell } from '../navigation/NavigationTypes';
export enum WorldCellFlag { None = 0, Base = 1 << 0, Resource = 1 << 1, Building = 1 << 2, Reserved = 1 << 3 }
export const BUILD_PLACEMENT_BLOCK_MASK = WorldCellFlag.Base | WorldCellFlag.Resource | WorldCellFlag.Building | WorldCellFlag.Reserved;
export class WorldCellGrid {
    private readonly flags: Uint16Array;
    private readonly owners = new Map<string, GridCell[]>();
    constructor(public readonly width: number, public readonly height: number) {
        this.flags = new Uint16Array(width * height);
    }
    public isInside(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
    public getFlags(x: number, y: number): WorldCellFlag { return this.isInside(x, y) ? this.flags[y * this.width + x] as WorldCellFlag : WorldCellFlag.None; }
    public isBlocked(x: number, y: number, mask = BUILD_PLACEMENT_BLOCK_MASK): boolean { return (this.getFlags(x, y) & mask) !== 0; }
    public claim(ownerId: string, flag: WorldCellFlag, cells: readonly GridCell[]): void {
        if (this.owners.has(ownerId)) throw new Error(`[WorldCellGrid] duplicate owner: ${ownerId}`);
        for (const cell of cells) {
            if (!this.isInside(cell.x, cell.y)) throw new Error(`[WorldCellGrid] out of bounds: (${cell.x},${cell.y})`);
            if (this.getFlags(cell.x, cell.y) !== WorldCellFlag.None) throw new Error(`[WorldCellGrid] occupied: (${cell.x},${cell.y})`);
        }
        for (const cell of cells) this.flags[cell.y * this.width + cell.x] |= flag;
        this.owners.set(ownerId, cells.map((cell) => ({ ...cell })));
    }
    public claimRect(ownerId: string, flag: WorldCellFlag, x: number, y: number, w: number, h: number): void {
        const cells: GridCell[] = [];
        for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) cells.push({ x: xx, y: yy });
        this.claim(ownerId, flag, cells);
    }
    public releaseOwner(ownerId: string): void {
        const cells = this.owners.get(ownerId); if (!cells) return;
        for (const cell of cells) this.flags[cell.y * this.width + cell.x] = WorldCellFlag.None;
        this.owners.delete(ownerId);
    }
    public getOwnerCells(ownerId: string): readonly GridCell[] { return this.owners.get(ownerId) ?? []; }
    public replaceFrom(candidate: WorldCellGrid): void {
        if (candidate.width !== this.width || candidate.height !== this.height) {
            throw new Error('[WorldCellGrid] replaceFrom size mismatch.');
        }
        this.flags.set(candidate.flags);
        this.owners.clear();
        for (const [ownerId, cells] of candidate.owners) {
            this.owners.set(ownerId, cells.map((cell) => ({ ...cell })));
        }
    }
}
