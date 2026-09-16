# TowerDown Building Ghost 跟手优化技术方案 V1

> Repo: `saiqi1999/TowerDown`  
> Engine: Cocos Creator 3.8.8  
> 目标：解决 Build Mode 下 Ghost 在鼠标快速移动、快速转圈、Camera Pan/Zoom 时“掉队”“滞后”“与鼠标下方格子不同步”的问题。  
> 原则：输入事件只采样最新 Pointer 状态；Ghost 在每帧 `lateUpdate()` 中基于最新 Pointer + 最新 MapRoot Transform 做一次 authoritative refresh；位置绝不做 Tween/Lerp。

---

# 0. 问题结论

当前流程：

```text
MOUSE_MOVE
→ BuildToolController.onPointerMove()
→ BuildingPlacementTool.handlePointerMove()
→ GridPointerProjector.project(event)
→ PlacementValidator.validate()
→ BuildingGhostView.show()
→ node.setPosition()
```

问题有两个：

```text
1. Pointer event 频率可能远高于 render frame：
   一个 frame 内可能收到多个 mouse move event，
   当前代码会对每个 event 都做 project + validate + ghost update。

2. Ghost 只在 Pointer Move 时刷新：
   鼠标不动，但 MapRoot 因 WASD / Edge Scroll / Zoom 改变时，
   鼠标下方对应的 Grid Cell 已变化，Ghost 却仍停在旧格。
```

因此 Ghost 不是“移动得慢”，而是：

```text
input event timing
≠
render frame timing
≠
world transform timing
```

本 Patch 改成：

```text
Pointer Event
→ 只记录 latest pointer screen position

WorldViewport.update()
→ 先完成本帧 MapRoot Pan / Zoom

BuildToolController.lateUpdate()
→ 用最新 pointer + 最新 MapRoot transform
→ project once
→ validate once
→ snap ghost once

Render
```

---

# 1. 最终架构

```text
Mouse / Touch
    │
    │ event
    ▼
BuildToolController
latestPointerScreenPosition
    │
    │ once per frame
    ▼
lateUpdate()
    │
    ▼
BuildingPlacementTool.refreshPointer()
    │
    ▼
GridPointerProjector.projectScreenPoint()
    │
    ▼
Grid Cell
    │
    ▼
BuildingPlacementValidator.validate()
    │
    ▼
PlacementSnapshot
    │
    ▼
BuildingGhostView.updatePlacement()
```

点击提交走另一条同步链：

```text
MouseDown / TouchStart
    │
    ▼
sample click screen point
    │
    ▼
refreshPointerImmediately()
    │
    ▼
confirmCurrentPlacement()
    │
    ▼
BuildingPlacementService.tryPlace()
    │
    ▼
commit-time revalidate
```

---

# 2. 核心设计原则

## 2.1 Pointer Event 不再驱动 Ghost

禁止：

```ts
onMouseMove(event) {
    projector.project(event);
    validator.validate(...);
    ghost.show(...);
}
```

改为：

```ts
onMouseMove(event) {
    latestPointerScreenPosition = event.getLocation();
}
```

事件只保存：

```text
“最新鼠标在哪”
```

不立即操作世界。

---

## 2.2 Ghost 每帧最多更新一次

在：

```ts
lateUpdate()
```

中：

```text
Build Mode active?
↓
有 pointer sample?
↓
project latest point
↓
validate
↓
ghost snap
```

不管一个 frame 收到：

```text
1
10
100
```

个 pointer move event，

最终都只有：

```text
1 次 project
1 次 validate
1 次 ghost update
```

---

## 2.3 使用 lateUpdate 而不是 update

当前 `WorldViewportController.update()` 会在本帧执行：

```text
WASD
Edge Scroll
MapRoot position change
```

Zoom 虽然主要由 wheel event 触发，但本质也会改变 MapRoot transform。

Ghost 必须最后基于：

```text
本帧最终 MapRoot transform
```

重新投影。

所以顺序固定：

```text
Input Sampling
↓
WorldViewport.update()
↓
Gameplay update
↓
BuildToolController.lateUpdate()
↓
Render
```

这样：

```text
Camera/MapRoot 先动
Ghost 后校正
```

---

# 3. 不允许位置平滑

Building Ghost 是：

```text
placement reticle
```

不是角色。

禁止：

```ts
lerp()
smoothDamp()
Tween
Spring
```

Ghost 必须：

```ts
node.setPosition(exactGridCenter);
```

原因：

```text
鼠标在哪个 Cell
Ghost 就必须在哪个 Cell
```

任何位置平滑都会人为制造：

```text
lag
overshoot
tracking delay
```

---

# 4. 修改 BuildToolController

文件：

```text
assets/scripts/building/BuildToolController.ts
```

新增状态：

```ts
private latestPointerScreenPosition: Vec2 | null = null;
private pointerInsideViewport = false;
```

如果 Touch 也支持：

```ts
private latestPointerSource: 'mouse' | 'touch' | null = null;
```

Phase 1 不一定需要区分 source。

---

## 4.1 Mouse Move

改成只记录 screen point：

```ts
private onPointerMove(event: Event): void {
    if (!this.active) {
        return;
    }

    const location =
        (event as Event & {
            getLocation?: () => { x: number; y: number };
        }).getLocation?.();

    if (!location) {
        return;
    }

    this.latestPointerScreenPosition = new Vec2(
        location.x,
        location.y,
    );
}
```

不要：

```text
project
validate
ghost.show
```

---

## 4.2 Touch Move

如果当前 `TOUCH_MOVE` 也走同一 handler，可以继续共用：

```text
getLocation()
```

保存最后一个 touch point。

---

## 4.3 lateUpdate

新增：

```ts
lateUpdate(): void {
    if (
        !this.active
        || !this.latestPointerScreenPosition
    ) {
        return;
    }

    this.tool?.refreshPointer(
        this.latestPointerScreenPosition,
    );
}
```

注意：

```text
lateUpdate 每帧最多一次。
```

---

# 5. 点击提交必须即时重新采样

这是重要细节。

如果：

```text
Frame N 的 Ghost 在 Cell A
鼠标快速移到 Cell B
MouseDown 在 lateUpdate 前发生
```

如果 click 直接使用：

```text
旧 pointerCell = A
```

就会放错格。

所以 PointerDown：

```ts
private onPointerDown(event: Event): void {
    if (!this.active) {
        return;
    }

    if (
        event instanceof EventMouse
        && event.getButton() === EventMouse.BUTTON_RIGHT
    ) {
        this.cancel();
        return;
    }

    if (this.isPointerOverExcludedUi(event)) {
        return;
    }

    const location =
        (event as Event & {
            getLocation?: () => { x: number; y: number };
        }).getLocation?.();

    if (!location) {
        return;
    }

    this.latestPointerScreenPosition = new Vec2(
        location.x,
        location.y,
    );

    this.tool?.refreshPointer(
        this.latestPointerScreenPosition,
    );

    if (this.tool?.confirmCurrentPlacement()) {
        this.cancel();
    }
}
```

即：

```text
click
→ immediate refresh
→ confirm
```

---

# 6. BuildingPlacementTool API 重构

当前：

```ts
handlePointerMove(event: Event)
handlePointerDown(event: Event)
```

改为：

```ts
public refreshPointer(
    screenPoint: Vec2,
): void;

public confirmCurrentPlacement(): boolean;
```

这样 Tool 不再知道 Cocos Event。

---

# 7. BuildingPlacementTool 新状态

继续保留：

```ts
definitionId: string | null
pointerCell: GridCell | null
```

建议新增：

```ts
private currentSnapshot:
    BuildingPlacementSnapshot | null = null;
```

作用：

```text
Ghost
和
当前 visual state
共享同一份 snapshot
```

但真正 commit 仍由 Service revalidate。

---

# 8. refreshPointer()

推荐实现：

```ts
public refreshPointer(
    screenPoint: Vec2,
): void {
    if (!this.definitionId) {
        return;
    }

    const cell =
        this.projector.projectScreenPoint(
            screenPoint,
        );

    if (!cell) {
        this.pointerCell = null;
        this.currentSnapshot = null;
        this.ghost.hide();
        return;
    }

    this.pointerCell = cell;

    const snapshot =
        this.validator.validate(
            this.definitionId,
            cell.x,
            cell.y,
        );

    this.currentSnapshot = snapshot;

    const definition =
        getBuildingDefinition(
            this.definitionId,
        );

    if (!definition) {
        this.ghost.hide();
        return;
    }

    this.ghost.updatePlacement(
        definition,
        snapshot,
    );
}
```

---

# 9. confirmCurrentPlacement()

```ts
public confirmCurrentPlacement(): boolean {
    if (
        !this.definitionId
        || !this.pointerCell
    ) {
        return false;
    }

    const result =
        this.service.tryPlace(
            this.definitionId,
            this.pointerCell.x,
            this.pointerCell.y,
        );

    if (!result.success) {
        // 保持 Build Mode / Ghost
        this.refreshCurrentCell();
        return false;
    }

    return true;
}
```

注意：

`BuildingPlacementService.tryPlace()` 仍必须：

```text
重新 validate
```

不能相信：

```text
currentSnapshot
```

因为这是 visual-time snapshot，不是 commit-time authoritative state。

---

# 10. GridPointerProjector API 重构

文件：

```text
assets/scripts/building/GridPointerProjector.ts
```

当前：

```ts
project(event: Event)
```

改：

```ts
public projectScreenPoint(
    screenPoint: Vec2,
): GridCell | null;
```

实现：

```ts
public projectScreenPoint(
    screenPoint: Vec2,
): GridCell | null {
    const world = new Vec3(
        screenPoint.x,
        screenPoint.y,
        0,
    );

    this.camera.screenToWorld(
        world,
        world,
    );

    const local =
        this.mapNode.inverseTransformPoint(
            new Vec3(),
            world,
        );

    const x = Math.floor(
        (
            local.x
            + this.mapWidth
            * GRID_RENDER_SIZE
            / 2
        )
        / GRID_RENDER_SIZE,
    );

    const y = Math.floor(
        (
            this.mapHeight
            * GRID_RENDER_SIZE
            / 2
            - local.y
        )
        / GRID_RENDER_SIZE,
    );

    if (
        x < 0
        || y < 0
        || x >= this.mapWidth
        || y >= this.mapHeight
    ) {
        return null;
    }

    return { x, y };
}
```

---

# 11. Projector 职责边界

新的 Projector：

```text
Screen Point
↓
World
↓
MapRoot Local
↓
Grid Cell
```

它不知道：

```text
Event
Build Mode
Definition
Placement Rule
Ghost
```

以后可以复用：

```text
Mouse
Touch
Gamepad cursor
debug placement
```

---

# 12. BuildingGhostView 重构

当前 `show()` 每次都：

```text
set spriteFrame
set color
set position
```

改为分离：

```ts
public setDefinition(
    definition: BuildingDefinition | null,
): void;

public updatePlacement(
    definition: BuildingDefinition,
    snapshot: BuildingPlacementSnapshot,
): void;

public hide(): void;
```

---

# 13. setDefinition() 只在换 Blueprint 时调用

例如：

```ts
public setDefinition(
    definition: BuildingDefinition | null,
): void {
    if (!definition) {
        this.hide();
        return;
    }

    this.sprite.spriteFrame =
        this.factory.getFrame(definition);

    this.currentDefinitionId =
        definition.id;
}
```

这样：

```text
Blacksmith selected
```

时只 set 一次 SpriteFrame。

Pointer 每帧移动时：

```text
不重复 set spriteFrame
```

---

# 14. updatePlacement() 只更新必要表现

```ts
public updatePlacement(
    definition: BuildingDefinition,
    snapshot: BuildingPlacementSnapshot,
): void {
    this.node.active = true;

    const nextColor = snapshot.canPlace
        ? VALID_GHOST_COLOR
        : INVALID_GHOST_COLOR;

    if (!this.sprite.color.equals(nextColor)) {
        this.sprite.color = nextColor;
    }

    this.node.setPosition(
        gridRectToWorldCenter(
            snapshot.gridX,
            snapshot.gridY,
            definition.footprintW,
            definition.footprintH,
            this.mapWidth,
            this.mapHeight,
        ),
    );
}
```

如果当前 Cocos Color 没有适合的 equals API，
可以维护：

```ts
private lastCanPlace: boolean | null = null;
```

只有 validity 改变才 set color。

---

# 15. Validator 先保持 once-per-frame

本次不要做：

```text
only validate when cell changed
```

原因：

```text
同一个 Cell
但 world occupancy / resource / actor 状态可能变化
```

例如：

```text
Ghost 停在 (10,10)
↓
另一个系统把格子占了
↓
Ghost 应马上变红
```

所以 Phase 1：

```text
lateUpdate
→ 每帧 validate 1 次
```

完全足够。

---

# 16. 后续性能优化方案

如果以后 validator 复杂，再引入：

```text
Placement World Version
```

例如：

```ts
WorldCellGrid.version
ResourceInventory.version
ActorOccupancy.version
```

然后：

```text
if (
    cellChanged
    || worldVersionChanged
    || resourceVersionChanged
) {
    validate
}
```

本轮不实现。

---

# 17. Camera Pan / Zoom 同步

本 Patch 的直接收益之一：

```text
鼠标不动
```

也会：

```text
lateUpdate
→ project latest screen point
```

所以：

```text
WASD 移地图
Edge Scroll
Mouse Wheel Zoom
Trackpad Zoom
```

时 Ghost 会跟随鼠标下方的新 Cell。

不会再要求：

```text
先晃一下鼠标
Ghost 才更新
```

---

# 18. UI exclusion 行为

如果 pointer 在：

```text
BlueprintCardStrip
SquadRoster
RightDrawer future
```

上，

BuildToolController 应：

```text
不 placement
Ghost 隐藏
```

建议在 lateUpdate 前加：

```ts
if (
    this.isScreenPointOverExcludedUi(
        this.latestPointerScreenPosition
    )
) {
    this.tool?.hideGhost();
    return;
}
```

不要继续显示一个“穿过 UI 的 Ghost”。

---

# 19. Screen Point / UI Point 坐标约束

本 Patch 中：

```text
GridPointerProjector
```

需要的是：

```text
screen coordinate
```

因为内部使用：

```ts
camera.screenToWorld()
```

所以：

```text
latestPointerScreenPosition
```

必须来自：

```ts
event.getLocation()
```

不是：

```ts
event.getUILocation()
```

但 UI hit-test 如果使用：

```text
UITransform.getBoundingBoxToWorld()
```

必须确保传入的是同一 UI/world coordinate 语义。

如果当前 exclusion 已经使用 `getLocation()` 且实测正确，
本 Patch 不同时扩大坐标系修复范围。

若后续出现 UI hit-test 偏移，
单独统一：

```text
UI exclusion → getUILocation()
Projector → getLocation()
```

不要混成同一个 Point 类型。

---

# 20. Build Mode 开启时首帧 Ghost

当前问题之一可能是：

```text
点击 Card
↓
进入 Build Mode
↓
鼠标还没移动
↓
Ghost 不出现
```

本 Patch 建议记录最近一次全局 mouse position，即使 Build Mode inactive 时也记录。

因此：

```text
normal mode
mouse move
→ latestPointerScreenPosition 更新

点击 Blueprint Card
→ setDefinition
→ 下一次 lateUpdate
→ Ghost 立即出现在当前鼠标对应 Cell
```

无需再晃鼠标。

---

# 21. 选择新 Blueprint 时

`BuildToolController.select()`：

```text
definition changed
↓
tool.setDefinition()
↓
ghost.setDefinition()
```

如果已有：

```text
latestPointerScreenPosition
```

不需要立刻同步 refresh；
下一个 lateUpdate 会正确刷新。

如果希望零帧延迟：

```ts
if (this.latestPointerScreenPosition) {
    this.tool?.refreshPointer(
        this.latestPointerScreenPosition,
    );
}
```

也可以。

建议：

```text
select 时 immediate refresh
+ subsequent lateUpdate refresh
```

视觉会更直接。

---

# 22. 文件修改清单

本 Patch 只需要修改：

```text
assets/scripts/building/BuildToolController.ts
assets/scripts/building/BuildingPlacementTool.ts
assets/scripts/building/GridPointerProjector.ts
assets/scripts/building/BuildingGhostView.ts
```

原则上不需要修改：

```text
BuildingPlacementValidator.ts
BuildingPlacementService.ts
BuildingCatalog.ts
WorldCellGrid.ts
WorldViewportController.ts
MainMapController.ts
```

除非接口编译需要最小接线改动。

---

# 23. TS Header 更新

所有被大幅改职责的文件头注释同步更新。

## BuildToolController.ts

```ts
/**
 * Why this file exists:
 * Build Mode 需要统一拥有输入状态，并把高频 Pointer Event 转换为每帧一次的
 * authoritative pointer sample，避免 Ghost 直接被事件频率驱动。
 *
 * Ownership boundary:
 * 本文件拥有 Build Mode 生命周期、latest pointer screen position、
 * 输入监听和每帧 Ghost refresh 调度。
 *
 * This file deliberately does NOT:
 * 不做 Grid 投影、不判断 placement 合法性、不扣资源，也不直接设置 Ghost 位置。
 */
```

## BuildingPlacementTool.ts

```ts
/**
 * Why this file exists:
 * PlacementTool 将最新 Pointer 状态、Grid 投影、Placement Validation、
 * Ghost Preview 与最终 Confirm 组合成一次建造交互。
 *
 * Ownership boundary:
 * 本文件拥有当前 pointer cell、当前 placement snapshot 和 confirm 入口。
 *
 * This file deliberately does NOT:
 * 不监听原始输入事件、不拥有 Build Mode 生命周期、不直接扣资源。
 */
```

## GridPointerProjector.ts

```ts
/**
 * Why this file exists:
 * 建筑放置需要把当前 screen-space pointer 在最新 Camera/MapRoot transform 下
 * 稳定转换成逻辑 Grid Cell。
 *
 * Ownership boundary:
 * 本文件只负责 screen point -> world -> MapRoot local -> grid 的几何投影。
 *
 * This file deliberately does NOT:
 * 不监听 Event、不控制 Camera、不验证 placement，也不更新 Ghost。
 */
```

## BuildingGhostView.ts

```ts
/**
 * Why this file exists:
 * Building Ghost 需要以零插值、Grid-snapped 的方式表现当前放置位置和合法性。
 *
 * Ownership boundary:
 * 本文件拥有 Ghost Sprite、Definition visual、位置、可放/不可放视觉状态。
 *
 * This file deliberately does NOT:
 * 不读取 Pointer、不做 Grid 投影、不判断 placement rule，也不执行提交。
 */
```

---

# 24. Agent 实施顺序

```text
Phase 1
GridPointerProjector Event-free API
↓
BuildingPlacementTool refresh/confirm split
↓
BuildToolController latest pointer + lateUpdate

Phase 2
BuildingGhostView definition/render split
↓
remove repeated SpriteFrame set

Phase 3
click-time immediate refresh
↓
UI exclusion ghost hide
↓
camera pan/zoom regression

Phase 4
performance / correctness regression
```

---

# 25. Acceptance Tests

## Fast mouse

- [ ] Build Mode 下快速横向甩鼠标，Ghost 不明显落后。
- [ ] 快速画圆，Ghost 始终在当前鼠标所指 Cell。
- [ ] 高频鼠标输入时每 frame 最多 1 次 normal preview refresh。

## Camera

鼠标固定不动：

- [ ] WASD 移动地图，Ghost 持续保持在鼠标下方 Cell。
- [ ] Edge Scroll 时 Ghost 不需要鼠标移动也会更新。
- [ ] Wheel Zoom 后 Ghost 立即重新 snap。
- [ ] Trackpad Zoom 后 Ghost 立即重新 snap。

## Click correctness

- [ ] 快速移动后立刻点击，建筑落在 click 当刻位置。
- [ ] 不能出现 Ghost 在 B，建筑却落在 A。
- [ ] Service commit 仍做最终 revalidate。

## UI

- [ ] Pointer 在 Blueprint Card 上时 Ghost 隐藏。
- [ ] Pointer 在 Squad Roster 上时 Ghost 隐藏。
- [ ] UI 点击不会 placement 穿透。

## Blueprint

- [ ] 切换建筑 Definition 时 SpriteFrame 正确。
- [ ] Pointer 每 frame refresh 不重复 set SpriteFrame。
- [ ] Ghost valid/invalid color 正确切换。

## Regression

- [ ] 右键取消 Build Mode。
- [ ] ESC 取消。
- [ ] 成功放置后按当前规则退出 Build Mode。
- [ ] 非法位置点击不会错误退出（若当前产品规则是保留 Build Mode）。
- [ ] Camera Zoom/Pan 后 GridPointerProjector 仍准确。

---

# 26. 明确禁止

```text
1. 用 lerp/smoothDamp 修 Ghost 跟手。
2. MouseMove event 中继续执行 validate。
3. MouseMove event 中继续 set Ghost position。
4. 直接把 event 传进 GridPointerProjector。
5. 只在 grid cell changed 时 validate，导致 world state 改变时 Ghost 不更新。
6. click 直接使用上一帧 pointerCell 而不 refresh。
7. 为了修 lag 提高 Ghost move speed。
8. 把 Camera/Viewport 逻辑塞进 PlacementTool。
9. 让 BuildingGhostView 读取 Input。
10. 每 frame 重设相同 SpriteFrame。
```

---

# 27. Done Definition

最终链路必须是：

```text
Raw Input Events
      ↓
Latest Pointer State
      ↓
World/Camera Update
      ↓
lateUpdate
      ↓
Project latest pointer
      ↓
Validate once
      ↓
Snap Ghost
      ↓
Render
```

点击时：

```text
MouseDown
↓
Refresh latest pointer immediately
↓
Confirm
↓
Service revalidate
↓
Commit
```

目标不是“让 Ghost 看起来更平滑”，而是：

> **让 Ghost 成为鼠标所在逻辑格子的实时、无插值、authoritative preview。**
