export interface GridCell {
    x: number;
    y: number;
}

export interface GridPoint {
    x: number;
    y: number;
}

export interface NavigationPathResult {
    approachCell: GridCell;
    path: GridCell[];
}
