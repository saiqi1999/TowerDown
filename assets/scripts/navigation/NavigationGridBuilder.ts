import { WorldCellGrid } from '../world/WorldCellGrid';
import { NavigationGrid } from './NavigationGrid';

export class NavigationGridBuilder {
    public build(occupancy: WorldCellGrid): NavigationGrid {
        const grid = new NavigationGrid(occupancy);
        console.log(
            `[NavigationGridBuilder] built ${grid.width}x${grid.height} nav grid, blocked=${grid.countBlocked()}`,
        );
        return grid;
    }
}
