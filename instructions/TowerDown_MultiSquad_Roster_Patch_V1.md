# TowerDown 第二支小队 + 左侧 Squad Roster / Hotkey Patch V1

> Repo: `saiqi1999/TowerDown`
> Base: `main @ fe3fa757ebf23f253bc33fae9c56c6049dcb923d`
> Goal: 加入第二支 4 人 Sword Warrior 小队；左侧常驻纵向 Squad Roster；鼠标点击或数字键 1/2 切换当前小队；地图点击命令只发送给当前选中小队；每支小队拥有独立目标、目标旗帜与指挥颜色。

---

# 0. UX 参考与最终方向

采用两个成熟范式的组合：

1. RTS Control Group：
   - 数字键直接选组。
   - 选中后后续地图命令作用于当前组。
   - StarCraft II 的成熟规则是数字键选 Control Group，快速双击同一数字可把镜头居中到该组。

2. Persistent Roster：
   - RimWorld 的 Colonist Bar 使用常驻头像/状态作为“永远找得到角色”的入口。
   - 点击 roster entry 切换关注对象，而不是要求玩家先在地图上找到单位。

TowerDown 采用：

```text
Persistent Squad Roster
        +
1 / 2 Hotkeys
        +
Single Selected Squad
        +
Per-Squad Independent Target / Flag
```

不采用传统 RTS 的框选、多选、Ctrl+数字自定义编组。
原因：TowerDown 的 Squad 本身就是 persistent strategic unit，玩家是在“调度固定队伍”，不是自由编组几十个单位。

---

# 1. 当前代码判断

当前 `STATIC_SQUADS` 只有：

```text
initial_01
4 Sword Warriors
```

当前 `WorldCommandController` 已经有：

```ts
targetBySquad: Map<string, string>
flagBySquad: Map<string, TargetFlagView>
```

这说明多小队目标状态的骨架已经正确。

真正的单队限制主要是：

```ts
private activeSquadId = 'initial_01';
```

因此不要重写 WorldCommand / SquadBrain。

应该把 `activeSquadId` 的 ownership 抽出来成为：

```text
SquadSelectionController
```

然后让 WorldCommandController 查询当前 selection。

另外当前 `MonsterGroupController` 已经用：

```text
participants: Map<squadId, Participant>
```

管理参与战斗的小队，所以同一个 guarded encounter 同时出现两支 Squad 已经有架构基础，不需要为第二支队伍重写 Monster combat。

---

# 2. 新 Squad 数据

修改：

```text
assets/scripts/squad/SquadTypes.ts
```

给 `SquadSpawnData` 增加：

```ts
commandSlot: number;
commandColor: SquadCommandColor;
```

新增：

```ts
export enum SquadCommandColor {
    Cyan = 0,
    Amber = 1,
    Green = 2,
    Violet = 3,
}
```

不要把具体 `cc.Color` 塞进 SpawnData。
颜色值由 UI/presentation config 转换。

`commandSlot` 同时代表：

```text
UI 编号
数字快捷键
Roster 排序
```

当前：

```ts
initial_01:
commandSlot = 1
commandColor = Cyan

initial_02:
commandSlot = 2
commandColor = Amber
```

---

# 3. 第二支 Squad

`StaticSquads.ts`：

```ts
export const STATIC_SQUADS: SquadSpawnData[] = [
    {
        id: 'initial_01',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
        commandSlot: 1,
        commandColor: SquadCommandColor.Cyan,
        spawnPoint: { x: 19, y: 14 },
    },
    {
        id: 'initial_02',
        warriorVisualId: WarriorVisualId.SwordWarrior,
        memberCount: 4,
        homeObjectId: 'base_main',
        commandSlot: 2,
        commandColor: SquadCommandColor.Amber,
        spawnPoint: { x: 21, y: 14 },
    },
];
```

当前 base_main：

```text
grid = (18, 10)
size = 4×3
```

所以两队分别在基地前方左右出生，而不是叠在相同 `(20,14)`。

Agent 在运行时必须验证两个 spawnPoint 都能解析到可走格；
若 StaticMap 变动导致不可走，则通过现有 navigator 的 nearest walkable 逻辑解决，不要在 Renderer 写像素 offset 补丁。

---

# 4. SquadSelectionController

新增：

```text
assets/scripts/squad/SquadSelectionController.ts
```

职责：

```text
唯一拥有 selectedSquadId
维护 commandSlot -> squadId
监听数字键
提供订阅
```

推荐 API：

```ts
export interface SquadSelectionState {
    selectedSquadId: string | null;
}

export type SquadSelectionListener =
    (state: SquadSelectionState) => void;

export class SquadSelectionController extends Component {
    public setup(
        squads: readonly SquadSpawnData[],
        handles: ReadonlyMap<string, SquadRuntimeHandle>,
    ): void;

    public selectSquad(squadId: string): boolean;

    public selectSlot(slot: number): boolean;

    public getSelectedSquadId(): string | null;

    public subscribe(
        listener: SquadSelectionListener,
    ): () => void;
}
```

默认：

```text
最小 commandSlot 的可用小队
→ initial_01
```

Keyboard：

```text
KeyCode.DIGIT_1 → slot 1
KeyCode.DIGIT_2 → slot 2
...
```

Phase 1 支持 1~9，虽然当前只有 1/2。

不要在 `WorldCommandController` 自己再监听数字键。
Selection 输入只能有一个 ownership。

---

# 5. Build Mode 与 Squad Selection

最终规则：

```text
点击 Squad Card
或
按数字键切 Squad
→ 立即退出 Build Mode
→ 切换 selected squad
```

原因：

如果 Build Mode 仍 active：

```text
按 2
→ UI 表示 Squad 2 selected
→ 玩家点地图
→ 实际却放建筑
```

这是错误的 interaction contract。

实现方式不要让 `SquadSelectionController` import Building system。

在 MainMap composition root 注入一个 callback：

```ts
selection.setBeforeUserSelection(
    () => buildToolController.cancel(),
);
```

或等价的 domain-neutral hook。

这样 Selection 不知道 BuildTool 类型。

---

# 6. WorldCommandController 改造

删除：

```ts
private activeSquadId = 'initial_01';
```

Config 注入：

```ts
selection: SquadSelectionController;
squadPresentationById: ReadonlyMap<string, SquadPresentation>;
```

世界点击：

```ts
const activeSquadId =
    this.selection.getSelectedSquadId();

const handle =
    this.squadHandles.get(activeSquadId);
```

其余命令逻辑尽量不动。

现有：

```text
targetBySquad
flagBySquad
```

继续保留。

结果：

```text
选择 1
点击 Wood
→ Squad 1 去 Wood
→ Flag 1 显示

选择 2
点击 Stone
→ Squad 2 去 Stone
→ Flag 2 显示

两面旗同时存在
```

再次点击当前 Squad 自己的同一目标，只取消该 Squad 的目标，不影响另一支 Squad。

---

# 7. 新 target_flag2.png

最新素材：

```text
assets/art/command/target_flag2.png
64×16
```

它不是 4 支不同颜色的旗。

它实际上仍然是：

```text
4 × 16×16 animation frames
```

所以它可以直接替换旧 TargetFlag animation source。

每支 Squad 的颜色通过 presentation tint 决定：

```text
Squad 1 → Cyan
Squad 2 → Amber
```

修改：

```text
TargetFlagView.setup(
    frames,
    commandColor,
)
```

在 Sprite 上应用 tint：

```ts
sprite.color = commandColor;
```

Phase 1 接受整张旗（包括旗杆）一起 tint。

如果以后最终美术要求“旗杆固定颜色、只有旗布换色”，再把素材拆成：

```text
Pole sprite
Flag cloth mask
```

本轮不要写 shader。

---

# 8. Portrait asset

最新：

```text
assets/art/units/warrior_sword_faceset.png
38×38
```

当前两支队伍都是：

```text
WarriorVisualId.SwordWarrior
```

所以都使用同一张 portrait。

Portrait 来源应由：

```text
WarriorVisualId
→ SquadPortraitCatalog
→ SpriteFrame
```

不要在 `SquadRosterItemView` 写：

```ts
if squadId === 'initial_01'
```

以后 Sword / Archer / Mage squad 可自然切不同头像。

---

# 9. Pixel filtering

当前新 portrait / flag 的 meta 是 linear filter。

统一改：

```text
Min Filter = Nearest
Mag Filter = Nearest
Mip = None
Wrap = Clamp
```

保持 pixel art。

---

# 10. 左侧 Roster UI

Runtime tree：

```text
HUDRoot
├ ResourceHud
├ BlueprintCardStrip
└ SquadRosterRoot
   ├ SquadCard_initial_01
   └ SquadCard_initial_02
```

UI 从屏幕左侧向右伸出。

推荐 card：

```text
128×84 screen px
```

每行：

```text
┌──────────────────────┐
│[1] [  Portrait  ] ▌  │
│    [   76×76    ] ⚑  │
└──────────────────────┘
```

其中：

```text
Background:
128×84

Portrait:
38×38 source ×2 = 76×76

Number Badge:
约 22×22

Mini Flag:
16×16 source ×2 = 32×32

Color Strip:
6~8px
```

左侧位置：

```text
card left edge 可以有约 8~12px 在屏幕外
```

产生“从左边伸出来”的感觉。

---

# 11. Selected / unselected feedback

不要只靠颜色。

Selected：

```text
Card 向右伸出 +8px
Opacity 255
3px command-color outline
Number brighter
Mini flag full brightness
```

Unselected：

```text
正常位置
Opacity ~180-210
无 outline
```

这样即使色觉不敏感也能看懂当前小队。

点击任何 Card：

```text
selection.selectSquad(id)
```

不直接调用：

```text
SquadBrain.issueTarget(...)
```

Roster 只选择，不发地图命令。

---

# 12. SquadRosterController / ItemView

新增：

```text
assets/scripts/ui/squad/SquadRosterController.ts
assets/scripts/ui/squad/SquadRosterItemView.ts
assets/scripts/ui/squad/SquadRosterUiConfig.ts
assets/scripts/ui/squad/SquadPresentationConfig.ts
```

`SquadRosterController`：

```text
读取 STATIC_SQUADS / runtime handles
按 commandSlot 排序
创建 Item
监听 Selection
同步 selected state
```

`SquadRosterItemView`：

```text
只负责：
background
number
portrait
mini flag
command color
selected visual
click callback
```

它不拥有：

```text
selectedSquadId
world command
brain
combat
target
```

---

# 13. SquadPresentationConfig

建议集中：

```ts
export interface SquadPresentation {
    commandColor: Color;
    portraitFrame: SpriteFrame;
}
```

实际 Color：

```text
Cyan  = #63BED1
Amber = #E0A545
Green = #72B875
Violet= #A784D8
```

颜色值只是第一版，可后续美术调整。

UI Color Strip、Selected outline、Mini Flag tint、World Target Flag tint
全部读同一 `commandColor`。

禁止四处复制颜色常量。

---

# 14. UI input exclusion 是本次必须做的

Roster 在屏幕最左边，而当前 Camera 支持 mouse-edge pan。

因此如果不做 exclusion：

```text
玩家把鼠标移到 Squad Card
→ 鼠标同时位于左屏幕边缘
→ Camera 持续向左移动
```

这是严重 UX bug。

所以 `SquadRosterRoot` 必须加入：

```text
WorldViewportController.excludedUiNodes
```

同时加入：

```text
BuildToolController.inputExcludedNodes
```

防止 Build Mode 下点击 roster 同时落一个建筑。

---

# 15. 统一 UI exclusion ownership

当前 `BuildCardStripController.setup()` 会自己调用：

```ts
tool.setInputExcludedNodes([this.root]);
```

本次建议移除这种 child-controller 覆盖行为。

由 MainMapController 最终统一：

```ts
const interactionUiNodes = [
    blueprintCardStripNode,
    squadRosterRoot,
];

buildToolController.setInputExcludedNodes(
    interactionUiNodes,
);

viewport.setInputExcludedNodes(
    interactionUiNodes,
);
```

以后 Right Drawer / Research Panel 加入时只改 composition。

避免：

```text
BuildCard 设置 [card]
↓
SquadRoster 再设置 [roster]
↓
前一个 exclusion 被覆盖
```

---

# 16. Hotkey 规则

Phase 1：

```text
1 → Squad 1
2 → Squad 2
```

键盘只使用：

```ts
KeyCode.DIGIT_1
KeyCode.DIGIT_2
```

不把 Numpad 1/2 默认等价；
后续 Hotkey Settings 再统一处理。

成熟 RTS 有一个非常值得后续加入的规则：

```text
单击 1 → select Squad 1
快速双击 1 → select + camera center on Squad 1
```

StarCraft II 使用同样模式。

本 Patch 建议：

```text
先实现单击 select
预留 focusSelectedSquad() API
暂不做 double-tap
```

原因：当前 WorldViewport 是 MapRoot transform，camera-focus 需要一个明确的 `focusWorldPoint()` API。
不要为了这次 selection 在 UI 代码里直接改 MapRoot.position。

---

# 17. Future World Focus API

后续可以给：

```text
WorldViewportController
```

增加：

```ts
public focusWorldPosition(
    worldPosition: Vec3,
): void;
```

然后：

```text
double 1
→ selected Squad 1
→ focusWorldPosition(squad.node.worldPosition)
```

这应由 viewport 自己处理 clamp，不允许 Roster 直接平移 MapRoot。

---

# 18. 第二支队伍与 Guard Combat

必须做以下 regression：

```text
Squad 1 去 guarded Gold
→ 触发 combat

此时 Squad 2 也去 Gold
→ 进入同一 MonsterGroup participants

Monster target pool
→ 可从两个 active Squad 的 warriors 中选择

某一支 retreat
→ 只把该 participant 标记 Retreating

另一支仍 active
→ 战斗继续
```

当前 `MonsterGroupController` 已经按 participant Map 设计，
所以重点是验证，而不是新写一套 multiplayer encounter。

---

# 19. 独立目标 regression

Case：

```text
Squad 1 → Wood
Squad 2 → Stone
```

要求：

```text
两支 Squad 同时移动
两个 Target Flag 同时显示
Flag 颜色不同
Roster 切换不改变任何已经下达的命令
```

Selection 是：

```text
“下一条玩家命令发给谁”
```

不是：

```text
“只有选中的 Squad 才能继续执行”
```

因此 unselected Squad 必须继续 AI / combat / harvest。

---

# 20. Assets loading

推荐新增：

```text
assets/scripts/ui/squad/SquadUiAssetLoader.ts
```

集中加载：

```text
warrior_sword_faceset SpriteFrame
target_flag2 Texture2D
```

不要继续给 `MainMapController` 新增：

```text
@property portraitTexture
@property targetFlag2Texture
```

MainMap 只负责 composition。

如果当前资源不在 `resources/`，可第一版用稳定 meta UUID + `assetManager.loadAny`；
后续资源管线统一时再迁 resources。

---

# 21. Files to add

```text
assets/scripts/squad/SquadSelectionController.ts

assets/scripts/ui/squad/SquadRosterController.ts
assets/scripts/ui/squad/SquadRosterItemView.ts
assets/scripts/ui/squad/SquadRosterUiConfig.ts
assets/scripts/ui/squad/SquadPresentationConfig.ts
assets/scripts/ui/squad/SquadUiAssetLoader.ts
```

---

# 22. Files to modify

```text
assets/scripts/squad/SquadTypes.ts
assets/scripts/squad/StaticSquads.ts

assets/scripts/command/WorldCommandController.ts
assets/scripts/command/TargetFlagView.ts

assets/scripts/building/BuildCardStripController.ts
assets/scripts/building/BuildToolController.ts (only if UI-coordinate hit-test still needs normalization)

assets/scripts/camera/WorldViewportController.ts

assets/scripts/map/MainMapController.ts
```

---

# 23. Mandatory TS headers

所有新增 `.ts`：

```ts
/**
 * Why this file exists:
 * ...
 *
 * Ownership boundary:
 * ...
 *
 * This file deliberately does NOT:
 * ...
 */
```

例如 `SquadSelectionController.ts`：

```ts
/**
 * Why this file exists:
 * 多支 persistent Squad 同时存在后，玩家的“当前命令接收者”必须只有一个
 * 明确的状态拥有者，并同时支持 UI 点击与数字快捷键切换。
 *
 * Ownership boundary:
 * 本文件唯一拥有 selectedSquadId、command-slot mapping 和 selection events。
 *
 * This file deliberately does NOT:
 * 不移动 Squad、不执行 target command、不渲染 Roster，也不控制 Camera。
 */
```

---

# 24. Acceptance checklist

## Spawn
- [ ] 地图启动后有 2 支 Squad，每支 4 人。
- [ ] 两支队伍出生不重叠。
- [ ] 都使用现有 Sword Warrior combat/stat 系统。

## Selection
- [ ] 默认 Squad 1 selected。
- [ ] 点击 Squad 1 card 可选 1。
- [ ] 点击 Squad 2 card 可选 2。
- [ ] Key 1 选 1。
- [ ] Key 2 选 2。
- [ ] selected card 有明确位置/边框变化。

## Commands
- [ ] 选 1 点击 Wood，只给 Squad 1 下令。
- [ ] 选 2 点击 Stone，只给 Squad 2 下令。
- [ ] Squad 1 的旧命令不会因为切换到 Squad 2 而暂停。
- [ ] 两支 Squad 可同时执行不同命令。
- [ ] 同一目标可被两支 Squad 分别下令。

## Flags
- [ ] 新 target_flag2 4 帧动画正常。
- [ ] Squad 1 / Squad 2 target flag commandColor 不同。
- [ ] 两面 flag 可以同时显示。
- [ ] flag lifecycle 仍按各自 SquadBrain current target 独立消失。

## UI
- [ ] 左侧有 2 行 roster。
- [ ] 每行有背景、编号、38×38 portrait 的清晰像素显示、对应 flag/color。
- [ ] 鼠标 hover/click roster 时不会触发左边缘 camera pan。
- [ ] Build Mode 下点击 roster 不会穿透 placement。
- [ ] 通过 roster/1/2 切 Squad 会退出 Build Mode。

## Combat
- [ ] 两 Squad 可同时进入同一个 guarded Gold encounter。
- [ ] 一队 retreat 不会让另一队失去 targetability。
- [ ] Monster 全灭后两个 participant 都能正确收到 victory/reform。
