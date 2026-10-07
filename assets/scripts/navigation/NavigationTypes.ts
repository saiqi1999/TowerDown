export interface GridCell {
    x: number;
    y: number;
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface NavCell {
    nx: number;
    ny: number;
}

export interface NavigationPathResult {
    approachPoint: GridPoint;
    path: GridPoint[];
}
