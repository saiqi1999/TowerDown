export class NavigationGrid {
    private readonly cells: Uint8Array;

    constructor(
        public readonly width: number,
        public readonly height: number,
    ) {
        if (width <= 0 || height <= 0) {
            throw new Error(`[NavigationGrid] invalid size ${width}x${height}`);
        }

        this.cells = new Uint8Array(width * height);
    }

    public isInside(x: number, y: number): boolean {
        return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }

    public isWalkable(x: number, y: number): boolean {
        return this.isInside(x, y) && this.cells[this.getIndex(x, y)] === 0;
    }

    public setBlocked(x: number, y: number): void {
        if (!this.isInside(x, y)) {
            return;
        }

        this.cells[this.getIndex(x, y)] = 1;
    }

    public setWalkable(x: number, y: number): void {
        if (!this.isInside(x, y)) {
            return;
        }

        this.cells[this.getIndex(x, y)] = 0;
    }

    public countBlocked(): number {
        let blocked = 0;
        for (const cell of this.cells) {
            if (cell !== 0) {
                blocked += 1;
            }
        }

        return blocked;
    }

    public replaceFrom(candidate: NavigationGrid): void {
        if (candidate.width !== this.width || candidate.height !== this.height) {
            throw new Error('[NavigationGrid] replaceFrom size mismatch.');
        }
        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                if (candidate.isWalkable(x, y)) this.setWalkable(x, y);
                else this.setBlocked(x, y);
            }
        }
    }

    private getIndex(x: number, y: number): number {
        return y * this.width + x;
    }
}
