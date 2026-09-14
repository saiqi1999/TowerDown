/**
 * Why this file exists:
 * TowerDown 的地图已经大到不能继续依赖固定一屏视野，同时底部 UI 会覆盖部分
 * 世界交互区域，因此需要统一拥有地图 Pan、Zoom、输入与边界约束。
 *
 * Ownership boundary:
 * 本文件唯一拥有 MapRoot 的 viewport transform：平移、缩放、zoom anchor、
 * edge scroll、WASD、drag 和 boundary clamp。
 *
 * This file deliberately does NOT:
 * 不修改逻辑 Grid 坐标、不处理 Squad Command、不处理 Building Placement、
 * 不修改 NavigationGrid，也不移动 HUD。
 */
import { _decorator, Camera, Component, EventMouse, EventTouch, input, Input, KeyCode, Node, UITransform, Vec2, Vec3 } from 'cc';
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
import {
    WORLD_VIEW_DEFAULT_SCALE,
    WORLD_VIEW_DRAG_THRESHOLD,
    WORLD_VIEW_EDGE_SPEED,
    WORLD_VIEW_EDGE_THRESHOLD,
    WORLD_VIEW_INTERACTION_OVERSCROLL,
    WORLD_VIEW_MAX_SCALE,
    WORLD_VIEW_MIN_SCALE,
    WORLD_VIEW_WASD_SPEED,
    WORLD_VIEW_ZOOM_STEP,
} from './WorldViewportConfig';

const { ccclass } = _decorator;

export interface WorldViewportSetup {
    mapRoot: Node;
    camera: Camera;
    mapWidthCells: number;
    mapHeightCells: number;
    viewportWidth: number;
    viewportHeight: number;
    excludedUiNodes?: readonly Node[];
}

@ccclass('WorldViewportController')
export class WorldViewportController extends Component {
    private mapRoot: Node | null = null;
    private camera: Camera | null = null;
    private mapWidthCells = 0;
    private mapHeightCells = 0;
    private viewportWidth = 1280;
    private viewportHeight = 720;
    private excludedUiNodes: readonly Node[] = [];
    private readonly pressedKeys = new Set<KeyCode>();
    private pointerUiPosition: Vec2 | null = null;
    private dragging = false;
    private spacePressed = false;
    private previousDragLocation: Vec2 | null = null;
    private previousPinchDistance = 0;

    public setup(config: WorldViewportSetup): void {
        this.mapRoot = config.mapRoot;
        this.camera = config.camera;
        this.mapWidthCells = config.mapWidthCells;
        this.mapHeightCells = config.mapHeightCells;
        this.viewportWidth = config.viewportWidth;
        this.viewportHeight = config.viewportHeight;
        this.excludedUiNodes = config.excludedUiNodes ?? [];
        this.resetView();
    }

    public resetView(): void {
        if (!this.mapRoot) return;
        this.mapRoot.setScale(WORLD_VIEW_DEFAULT_SCALE, WORLD_VIEW_DEFAULT_SCALE, 1);
        this.mapRoot.setPosition(0, 0, 0);
        this.clampViewport();
    }

    public setInputExcludedNodes(nodes: readonly Node[]): void {
        this.excludedUiNodes = nodes;
    }

    public getScale(): number {
        return this.mapRoot?.scale.x ?? WORLD_VIEW_DEFAULT_SCALE;
    }

    public panByCameraDelta(dx: number, dy: number): void {
        if (!this.mapRoot) return;
        const position = this.mapRoot.position;
        this.mapRoot.setPosition(position.x - dx, position.y - dy, position.z);
        this.clampViewport();
    }

    public zoomAtUiPoint(uiX: number, uiY: number, zoomSteps: number): void {
        if (!this.mapRoot || !this.camera || zoomSteps === 0) return;
        const oldScale = this.getScale();
        const newScale = this.clampScale(oldScale + zoomSteps * WORLD_VIEW_ZOOM_STEP);
        if (Math.abs(newScale - oldScale) < 0.0001) return;
        const anchor = this.screenToMapParentPoint(uiX, uiY);
        const oldPosition = this.mapRoot.position;
        const ratio = newScale / oldScale;
        this.mapRoot.setScale(newScale, newScale, 1);
        this.mapRoot.setPosition(
            anchor.x - (anchor.x - oldPosition.x) * ratio,
            anchor.y - (anchor.y - oldPosition.y) * ratio,
            oldPosition.z,
        );
        this.clampViewport();
    }

    onEnable(): void {
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.on(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        input.on(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    onDisable(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        input.off(Input.EventType.MOUSE_WHEEL, this.onMouseWheel, this);
        input.off(Input.EventType.TOUCH_MOVE, this.onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this.onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this.onTouchEnd, this);
    }

    update(dt: number): void {
        const direction = new Vec2();
        if (this.pressedKeys.has(KeyCode.KEY_A)) direction.x -= 1;
        if (this.pressedKeys.has(KeyCode.KEY_D)) direction.x += 1;
        if (this.pressedKeys.has(KeyCode.KEY_W)) direction.y += 1;
        if (this.pressedKeys.has(KeyCode.KEY_S)) direction.y -= 1;
        if (direction.lengthSqr() > 0) {
            direction.normalize();
            this.panByCameraDelta(direction.x * WORLD_VIEW_WASD_SPEED * dt, direction.y * WORLD_VIEW_WASD_SPEED * dt);
        }
        if (this.pointerUiPosition && !this.isPointOverExcludedUi(this.pointerUiPosition)) {
            const edge = new Vec2();
            if (this.pointerUiPosition.x <= WORLD_VIEW_EDGE_THRESHOLD) edge.x -= 1;
            if (this.pointerUiPosition.x >= this.viewportWidth - WORLD_VIEW_EDGE_THRESHOLD) edge.x += 1;
            if (this.pointerUiPosition.y <= WORLD_VIEW_EDGE_THRESHOLD) edge.y -= 1;
            if (this.pointerUiPosition.y >= this.viewportHeight - WORLD_VIEW_EDGE_THRESHOLD) edge.y += 1;
            if (edge.lengthSqr() > 0) {
                edge.normalize();
                this.panByCameraDelta(edge.x * WORLD_VIEW_EDGE_SPEED * dt, edge.y * WORLD_VIEW_EDGE_SPEED * dt);
            }
        }
    }

    private onKeyDown(event: { keyCode: KeyCode }): void {
        this.pressedKeys.add(event.keyCode);
        if (event.keyCode === KeyCode.SPACE) this.spacePressed = true;
    }

    private onKeyUp(event: { keyCode: KeyCode }): void {
        this.pressedKeys.delete(event.keyCode);
        if (event.keyCode === KeyCode.SPACE) {
            this.spacePressed = false;
            this.dragging = false;
            this.previousDragLocation = null;
        }
    }

    private onMouseMove(event: EventMouse): void {
        const location = event.getLocation();
        this.pointerUiPosition = new Vec2(location.x, location.y);
        if (!this.dragging || !this.previousDragLocation) return;
        const dx = location.x - this.previousDragLocation.x;
        const dy = location.y - this.previousDragLocation.y;
        if (Math.abs(dx) + Math.abs(dy) >= WORLD_VIEW_DRAG_THRESHOLD) {
            this.panByCameraDelta(-dx, -dy);
        }
        this.previousDragLocation = new Vec2(location.x, location.y);
    }

    private onMouseDown(event: EventMouse): void {
        const location = event.getLocation();
        this.pointerUiPosition = new Vec2(location.x, location.y);
        if (this.isPointOverExcludedUi(this.pointerUiPosition)) return;
        if (event.getButton() === EventMouse.BUTTON_MIDDLE || (event.getButton() === EventMouse.BUTTON_LEFT && this.spacePressed)) {
            this.dragging = true;
            this.previousDragLocation = new Vec2(location.x, location.y);
        }
    }

    private onMouseUp(): void {
        this.dragging = false;
        this.previousDragLocation = null;
    }

    private onMouseWheel(event: EventMouse): void {
        const location = event.getLocation();
        const point = new Vec2(location.x, location.y);
        if (this.isPointOverExcludedUi(point)) return;
        const scrollY = event.getScrollY();
        const steps = Math.max(-3, Math.min(3, Math.round(scrollY / 120)));
        this.zoomAtUiPoint(location.x, location.y, steps);
    }

    private onTouchMove(event: EventTouch): void {
        const touches = event.getAllTouches();
        if (touches.length !== 2) return;
        const a = touches[0].getLocation();
        const b = touches[1].getLocation();
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.previousPinchDistance <= 0) {
            this.previousPinchDistance = distance;
            return;
        }
        const centerX = (a.x + b.x) / 2;
        const centerY = (a.y + b.y) / 2;
        const ratio = distance / this.previousPinchDistance;
        const oldScale = this.getScale();
        const targetScale = this.clampScale(oldScale * ratio);
        const steps = Math.round((targetScale - oldScale) / WORLD_VIEW_ZOOM_STEP);
        this.zoomAtUiPoint(centerX, centerY, steps);
        this.previousPinchDistance = distance;
    }

    private onTouchEnd(): void {
        this.previousPinchDistance = 0;
    }

    private clampViewport(): void {
        if (!this.mapRoot) return;
        const scale = this.getScale();
        const scaledWidth = this.mapWidthCells * GRID_RENDER_SIZE * scale;
        const scaledHeight = this.mapHeightCells * GRID_RENDER_SIZE * scale;
        const limitX = Math.max(0, (scaledWidth - this.viewportWidth) / 2) + WORLD_VIEW_INTERACTION_OVERSCROLL;
        const limitY = Math.max(0, (scaledHeight - this.viewportHeight) / 2) + WORLD_VIEW_INTERACTION_OVERSCROLL;
        const position = this.mapRoot.position;
        this.mapRoot.setPosition(
            Math.max(-limitX, Math.min(limitX, position.x)),
            Math.max(-limitY, Math.min(limitY, position.y)),
            position.z,
        );
    }

    private clampScale(scale: number): number {
        return Math.max(WORLD_VIEW_MIN_SCALE, Math.min(WORLD_VIEW_MAX_SCALE, scale));
    }

    private screenToMapParentPoint(x: number, y: number): Vec3 {
        const world = new Vec3(x, y, 0);
        this.camera?.screenToWorld(world, world);
        return this.mapRoot?.parent?.inverseTransformPoint(new Vec3(), world) ?? world;
    }

    private isPointOverExcludedUi(point: Vec2): boolean {
        return this.excludedUiNodes.some((node) =>
            node.isValid && node.activeInHierarchy
            && !!node.getComponent(UITransform)?.getBoundingBoxToWorld().contains(point));
    }
}
