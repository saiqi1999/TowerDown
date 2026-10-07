const ts = (() => {
    const candidates = [
        process.env.TYPESCRIPT_PATH,
        'typescript',
        '/Applications/Cocos/Creator/3.8.8/CocosCreator.app/Contents/Resources/app.asar.unpacked/node_modules/typescript',
    ].filter(Boolean);
    for (const candidate of candidates) {
        try { return require(candidate); } catch {}
    }
    throw new Error('TypeScript runtime not found. Set TYPESCRIPT_PATH before running this test.');
})();
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const Module = require('module');
const root = path.resolve(__dirname, '../assets/scripts');

require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
    fs.readFileSync(filename, 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, experimentalDecorators: true } },
).outputText, filename);

class Vec2 {
    constructor(x = 0, y = 0) { this.x = x; this.y = y; }
    set(x, y) {
        if (typeof x === 'object') { this.x = x.x; this.y = x.y; } else { this.x = x; this.y = y; }
        return this;
    }
    static distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}
class Vec3 extends Vec2 {
    constructor(x = 0, y = 0, z = 0) { super(x, y); this.z = z; }
    clone() { return new Vec3(this.x, this.y, this.z); }
}
const cc = {
    Vec2,
    Vec3,
    Component: class {},
    _decorator: { ccclass: () => (value) => value },
    EventMouse: { BUTTON_LEFT: 0, BUTTON_RIGHT: 2 },
    KeyCode: { ESCAPE: 27, SPACE: 32 },
    Node: { EventType: {} },
    UITransform: class {},
    Game: { EVENT_HIDE: 'hide' },
    game: { on() {}, off() {} },
    Input: { EventType: {} },
    input: { on() {}, off() {} },
};
const originalLoad = Module._load;
Module._load = function load(name, ...args) {
    return name === 'cc' ? cc : originalLoad.call(this, name, ...args);
};
const load = (modulePath) => require(path.join(root, modulePath));

const { WorldCellGrid } = load('world/WorldCellGrid.ts');
const { NavigationGrid } = load('navigation/NavigationGrid.ts');
const { NavigationObstacleResolver } = load('navigation/NavigationObstacleResolver.ts');
const { AStarPathfinder } = load('navigation/AStarPathfinder.ts');
const { buildBoundaryOccupants, getCitySlots, validateCityLayout } = load('map/CityLayout.ts');
const { BuildingRuntimeRegistry } = load('building/BuildingRuntimeRegistry.ts');
const { ResourceInventory } = load('economy/ResourceInventory.ts');
const { BuildingPlacementValidator } = load('building/BuildingPlacementValidator.ts');
const { BuildingRelocationService } = load('building/BuildingRelocationService.ts');
const { getBuildingDefinition } = load('building/BuildingCatalog.ts');
const { TerrainType } = load('map/MapTypes.ts');

validateCityLayout();
assert.equal(getCitySlots().length, 12);
const resolver = new NavigationObstacleResolver();
const cells = new WorldCellGrid(40, 23);
for (const record of buildBoundaryOccupants(resolver)) cells.claimOccupant(record);
const grid = new NavigationGrid(cells);
assert.equal(cells.getAllOwnerRecords().length, 32);
assert.equal(grid.width, 80);
assert.equal(grid.height, 46);
assert.equal(grid.isPointWalkable({ x: 19.25, y: 7.25 }), true);
assert.equal(grid.isPointWalkable({ x: 18.25, y: 7.25 }), false);
assert.equal(grid.isPointWalkable({ x: 16.25, y: 8.25 }), true);

const definition = getBuildingDefinition('barracks_01');
const instance = {
    id: 'a',
    definitionId: definition.id,
    gridX: 16,
    gridY: 8,
    enabled: false,
    createdSequence: 7,
    paidCost: { 0: 40 },
    boundSquadId: 'squad_01',
};
cells.claimOccupant(resolver.forBuilding(instance, definition));
assert.equal(grid.isPointWalkable({ x: 16.25, y: 8.25 }), true);
assert.equal(grid.isPointWalkable({ x: 16.75, y: 8.75 }), false);
assert.equal(grid.isPointWalkable({ x: 17.75, y: 9.75 }), true);
cells.assertConsistent();

const pathfinder = new AStarPathfinder();
const pathThroughNorthGate = pathfinder.findPath(
    grid,
    grid.worldToNavCell({ x: 19.25, y: 6.25 }),
    grid.worldToNavCell({ x: 19.25, y: 8.25 }),
);
assert(pathThroughNorthGate);

const candidate = cells.clone();
candidate.releaseOwner('a');
candidate.claimOccupant(resolver.forBuilding({ ...instance, gridX: 18, gridY: 8 }, definition));
assert.equal(grid.isPointWalkable({ x: 16.75, y: 8.75 }), false);
cells.replaceFrom(candidate);
assert.equal(grid.isPointWalkable({ x: 16.75, y: 8.75 }), true);
assert.equal(grid.isPointWalkable({ x: 18.75, y: 8.75 }), false);
assert.equal(grid.canTraverseSegment({ x: 18.25, y: 8.25 }, { x: 19.25, y: 9.25 }), false);
assert.equal(grid.canTraverseSegment({ x: 16.25, y: 8.25 }, { x: 17.25, y: 8.25 }), true);

const registry = new BuildingRuntimeRegistry();
const inventory = new ResourceInventory();
const terrain = Array.from({ length: 23 }, () => Array(40).fill(TerrainType.Dirt));
let throwPosition = false;
const node = {
    isValid: true,
    activeInHierarchy: true,
    position: new Vec3(),
    setPosition(value) {
        if (throwPosition) { throwPosition = false; throw Error('injected position failure'); }
        this.position = value.clone();
    },
    getComponent() { return null; },
};
instance.gridX = 18;
registry.add(instance, node);
let routeBlocked = false;
let routeApplied = 0;
let notified = 0;
registry.subscribe(() => {
    notified += 1;
    assert.equal(cells.getOwnerCells('a')[0].x, instance.gridX);
});
const validator = new BuildingPlacementValidator(
    terrain,
    cells,
    inventory,
    () => ({ 0: 999 }),
    () => ({ allowed: false }),
);
const relocation = new BuildingRelocationService(
    registry,
    validator,
    cells,
    grid,
    resolver,
    () => routeBlocked ? null : () => routeApplied += 1,
);
assert(relocation.preview('a', 20, 8).canPlace);
assert.equal(instance.gridX, 18);
assert(relocation.tryMove('a', 20, 8));
assert.equal(routeApplied, 1);
assert.equal(notified, 1);
assert.equal(cells.getOwnerCells('a')[0].x, 20);
assert.equal(relocation.tryMove('a', 18, 10), false);
assert.equal(relocation.tryMove('a', 17, 8), false);
routeBlocked = true;
assert.equal(relocation.tryMove('a', 22, 8), false);
routeBlocked = false;
throwPosition = true;
const originalError = console.error;
console.error = () => {};
assert.equal(relocation.tryMove('a', 22, 8), false);
console.error = originalError;
assert.equal(instance.gridX, 20);
assert.equal(cells.getOwnerCells('a')[0].x, 20);

const { BuildingRelocationController } = load('building/BuildingRelocationController.ts');
const controller = new BuildingRelocationController();
const moves = [];
const hover = [];
let hidden = 0;
let cancelClicks = 0;
let blocked = false;
let overUi = false;
const entry = {
    data: { id: 'b', definitionId: 'barracks_01', gridX: 16, gridY: 8 },
    node: {
        isValid: true,
        activeInHierarchy: true,
        getComponent(Type) {
            if (Type === cc.UITransform) return { hitTest: () => true };
            return { cancelPendingClick() { cancelClicks += 1; } };
        },
    },
};
controller.setup({
    registry: { getAll: () => [entry], get: () => entry },
    service: {
        preview: (id, x, y) => ({ gridX: x, gridY: y, canPlace: x >= 0 && y >= 0 }),
        tryMove: (id, x, y) => { moves.push([x, y]); return true; },
    },
    projector: { projectScreenPoint: (point) => point.x < 0 ? null : ({ x: Math.floor(point.x / 10), y: Math.floor(point.y / 10) }) },
    ghost: { hide() { hidden += 1; }, updatePlacement() {} },
    excludedUi: [{ isValid: true, activeInHierarchy: true, getComponent: () => ({ hitTest: () => overUi }) }],
    isBlocked: () => blocked,
    onDraggingChanged: (active) => hover.push(active),
});
const event = (x, y, button = 0) => ({
    windowId: 0,
    getButton: () => button,
    getLocation(out) { out.set(x, y); return out; },
});
controller.onDown(event(165, 85));
controller.onUp(event(167, 87));
assert.equal(moves.length, 0);
controller.onDown(event(165, 85));
controller.onMove(event(205, 85));
controller.onUp(event(205, 85));
assert.deepEqual(moves, [[20, 8]]);
assert.deepEqual(hover, [true, false]);
assert(cancelClicks > 0);
controller.onDown(event(165, 85));
controller.onMove(event(205, 85));
overUi = true;
controller.onUp(event(225, 85));
assert.equal(moves.length, 1);
overUi = false;
controller.onDown(event(165, 85));
controller.onMove(event(205, 85));
controller.onKeyDown({ keyCode: 27 });
controller.onUp(event(225, 85));
assert.equal(moves.length, 1);
controller.onDown(event(165, 85));
controller.onMove(event(205, 85));
blocked = true;
controller.lateUpdate();
assert(!controller.isTracking());
blocked = false;
controller.onDown(event(165, 85));
controller.onMove(event(205, 85));
controller.onDown(event(205, 85, 2));
assert(!controller.isTracking());
controller.onKeyDown({ keyCode: 32 });
controller.onDown(event(165, 85));
assert(!controller.isTracking());
controller.onBlur();
controller.onDown(event(165, 85));
assert(controller.isTracking());
controller.cancel();

console.log('PASS: single occupancy source, 16px navigation, wall/gate masks, central building core, A*, relocation transaction, and drag slot snapping.');
