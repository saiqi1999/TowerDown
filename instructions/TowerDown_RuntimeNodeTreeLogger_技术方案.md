# TowerDown 运行时节点树定时日志技术方案

## 1. 目标

在 Cocos Creator 3.8.8 的浏览器预览环境中，每隔 **20 秒**将当前运行时完整节点树打印到浏览器 DevTools Console。

用途：

```text
确认运行时动态节点是否创建成功
确认节点父子关系是否正确
确认 Squad / Warrior / Flag 等动态节点是否仍然存在
快速定位节点被删除、挂错父节点、active 状态异常等问题
```

当前截图中的 Chrome DevTools：

```text
Console
```

就是运行时日志窗口。

现有日志例如：

```text
[WorldObjectRenderer] rendered 5 world objects.
[NavigationGridBuilder] built 40x23 grid, blocked=25
[SquadRenderer] rendered 1 squads.
[WorldCommandController] bound 5 world objects.
```

均为正常运行时日志。

---

# 2. 设计原则

本功能只作为 Debug 工具，不参与任何游戏逻辑。

禁止把节点树打印逻辑塞进：

```text
MainMapController
SquadBrain
WorldCommandController
SquadRenderer
```

应新增独立 Debug Component：

```text
assets/scripts/debug/RuntimeNodeTreeLogger.ts
```

职责只有：

```text
定时获取当前 Scene
↓
递归遍历节点
↓
生成一整段字符串
↓
一次 console.log 输出
```

这样后续删除 Debug 工具不会影响正式代码。

---

# 3. 推荐节点挂载位置

将：

```text
RuntimeNodeTreeLogger
```

挂在：

```text
Canvas
```

推荐结构：

```text
Main
└── Canvas
    ├── Camera
    └── MapRoot
        ├── TileRoot
        ├── WorldObjectRoot
        ├── ActorRoot
        └── CommandRoot
```

`RuntimeNodeTreeLogger` 是 Canvas 上的 Component，不需要额外创建可视 Node。

选择 Canvas 的原因：

```text
Canvas 整场游戏持续 active
Debug Logger 不依赖 MapRoot 生命周期
即使 MapRoot 层级出问题，仍然可以打印整个 Scene
```

---

# 4. 新增文件

```text
assets/scripts/debug/
└── RuntimeNodeTreeLogger.ts
```

如果 `debug` 目录不存在则创建。

---

# 5. 推荐实现

```ts
import {
    _decorator,
    Component,
    director,
    Node,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RuntimeNodeTreeLogger')
export class RuntimeNodeTreeLogger extends Component {

    @property
    public intervalSeconds = 20;

    protected onEnable(): void {
        this.schedule(
            this.printRuntimeTree,
            this.intervalSeconds,
        );
    }

    protected onDisable(): void {
        this.unschedule(
            this.printRuntimeTree,
        );
    }

    private printRuntimeTree = (): void => {
        const scene = director.getScene();

        if (!scene) {
            console.warn(
                '[RuntimeNodeTree] scene is null.',
            );
            return;
        }

        const lines: string[] = [];

        lines.push(
            `===== Runtime Node Tree @ ${new Date().toLocaleTimeString()} =====`
        );

        this.appendNode(
            scene,
            0,
            lines,
        );

        lines.push(
            '===== End Runtime Node Tree ====='
        );

        console.log(
            lines.join('\n')
        );
    };

    private appendNode(
        node: Node,
        depth: number,
        lines: string[],
    ): void {
        const indent =
            '  '.repeat(depth);

        const activeState =
            node.activeInHierarchy
                ? 'ACTIVE'
                : 'INACTIVE';

        lines.push(
            `${indent}${node.name} [${activeState}] children=${node.children.length}`
        );

        for (
            const child
            of node.children
        ) {
            this.appendNode(
                child,
                depth + 1,
                lines,
            );
        }
    }
}
```

---

# 6. 为什么使用一次 console.log

不要这样：

```ts
console.log(node.name);
console.log(child.name);
console.log(grandChild.name);
```

否则一次节点树会产生几十甚至几百条 Console Entry。

推荐先：

```text
递归
↓
lines[]
↓
join('\n')
↓
一次 console.log
```

最终浏览器 Console 中一轮只出现一条大型日志。

更容易阅读，也更容易复制给 Agent 做分析。

---

# 7. 输出示例

运行 20 秒后：

```text
===== Runtime Node Tree @ 00:42:20 =====
Main [ACTIVE] children=1
  Canvas [ACTIVE] children=2
    Camera [ACTIVE] children=0
    MapRoot [ACTIVE] children=4
      TileRoot [ACTIVE] children=920
      WorldObjectRoot [ACTIVE] children=2
        StructureRoot [ACTIVE] children=1
          Base_base_main [ACTIVE] children=0
        ResourceRoot [ACTIVE] children=4
          Resource_wood_01 [ACTIVE] children=0
          Resource_wood_02 [ACTIVE] children=0
          Resource_stone_01 [ACTIVE] children=0
          Resource_food_01 [ACTIVE] children=0
      ActorRoot [ACTIVE] children=1
        SquadRoot [ACTIVE] children=1
          Squad_initial_01 [ACTIVE] children=4
            Warrior_0 [ACTIVE] children=0
            Warrior_1 [ACTIVE] children=0
            Warrior_2 [ACTIVE] children=0
            Warrior_3 [ACTIVE] children=0
      CommandRoot [ACTIVE] children=1
        TargetFlag_initial_01 [ACTIVE] children=0
===== End Runtime Node Tree =====
```

---

# 8. TileRoot 日志量问题

当前地图：

```text
40 × 23
=
920 cells
```

如果 TileRoot 每格都是一个 Node，则完整打印会出现约 920 个 Tile 节点。

这会让节点树日志非常长。

因此推荐增加一个 **折叠 TileRoot** 的功能。

正式 Debug 版建议：

```ts
@property
public collapseLargeBranches = true;

@property
public collapseThreshold = 100;
```

如果：

```text
node.children.length >= 100
```

则不展开所有子节点，只打印：

```text
TileRoot [ACTIVE] children=920 [COLLAPSED]
```

这样真正关心的：

```text
WorldObjectRoot
ActorRoot
CommandRoot
Squad
Warrior
Flag
```

仍然完整展示。

---

# 9. 推荐完整版 appendNode

```ts
private appendNode(
    node: Node,
    depth: number,
    lines: string[],
): void {
    const indent =
        '  '.repeat(depth);

    const activeState =
        node.activeInHierarchy
            ? 'ACTIVE'
            : 'INACTIVE';

    const collapse =
        this.collapseLargeBranches
        &&
        node.children.length
            >= this.collapseThreshold;

    lines.push(
        `${indent}${node.name} ` +
        `[${activeState}] ` +
        `children=${node.children.length}` +
        (collapse ? ' [COLLAPSED]' : '')
    );

    if (collapse) {
        return;
    }

    for (
        const child
        of node.children
    ) {
        this.appendNode(
            child,
            depth + 1,
            lines,
        );
    }
}
```

推荐默认：

```text
collapseLargeBranches = true
collapseThreshold = 100
```

这样 `TileRoot` 自动折叠。

---

# 10. 完整推荐代码

```ts
import {
    _decorator,
    Component,
    director,
    Node,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RuntimeNodeTreeLogger')
export class RuntimeNodeTreeLogger extends Component {

    @property
    public intervalSeconds = 20;

    @property
    public collapseLargeBranches = true;

    @property
    public collapseThreshold = 100;

    protected onEnable(): void {
        this.schedule(
            this.printRuntimeTree,
            this.intervalSeconds,
        );
    }

    protected onDisable(): void {
        this.unschedule(
            this.printRuntimeTree,
        );
    }

    private printRuntimeTree = (): void => {
        const scene =
            director.getScene();

        if (!scene) {
            console.warn(
                '[RuntimeNodeTree] scene is null.'
            );
            return;
        }

        const lines: string[] = [];

        lines.push(
            `===== Runtime Node Tree @ ${
                new Date().toLocaleTimeString()
            } =====`
        );

        this.appendNode(
            scene,
            0,
            lines,
        );

        lines.push(
            '===== End Runtime Node Tree ====='
        );

        console.log(
            lines.join('\n')
        );
    };

    private appendNode(
        node: Node,
        depth: number,
        lines: string[],
    ): void {
        const indent =
            '  '.repeat(depth);

        const activeState =
            node.activeInHierarchy
                ? 'ACTIVE'
                : 'INACTIVE';

        const collapse =
            this.collapseLargeBranches
            &&
            node.children.length
                >= this.collapseThreshold;

        lines.push(
            `${indent}${node.name} ` +
            `[${activeState}] ` +
            `children=${node.children.length}` +
            (
                collapse
                    ? ' [COLLAPSED]'
                    : ''
            )
        );

        if (collapse) {
            return;
        }

        for (
            const child
            of node.children
        ) {
            this.appendNode(
                child,
                depth + 1,
                lines,
            );
        }
    }
}
```

---

# 11. Cocos Editor 手工操作

Agent 创建脚本并等待 Cocos 编译完成后：

```text
1. 在 Hierarchy 选择 Canvas

2. Inspector
   → 添加组件

3. 搜索：
   RuntimeNodeTreeLogger

4. 添加组件

5. Interval Seconds：
   20

6. Collapse Large Branches：
   true

7. Collapse Threshold：
   100

8. 保存 Main.scene

9. 浏览器运行
```

---

# 12. 是否启动时立即打印

当前需求是：

```text
每 20 秒打印一次
```

因此默认行为：

```text
启动
↓
20s
第一次打印
↓
40s
第二次打印
↓
60s
第三次打印
```

如果希望游戏启动时也立即打一份，可以在：

```ts
onEnable()
```

增加：

```ts
this.printRuntimeTree();
```

变成：

```ts
protected onEnable(): void {
    this.printRuntimeTree();

    this.schedule(
        this.printRuntimeTree,
        this.intervalSeconds,
    );
}
```

建议开发阶段开启“启动即打印”，因为可以立刻确认 Bootstrap 后的节点结构。

---

# 13. 推荐最终行为

建议最终 Debug 配置：

```text
启动后立即打印一次
之后每 20 秒打印一次
TileRoot 等 >=100 children 的分支自动折叠
打印 activeInHierarchy
打印 children count
```

即：

```text
0s   → Node Tree
20s  → Node Tree
40s  → Node Tree
60s  → Node Tree
...
```

---

# 14. 不要加入的信息

当前不要默认打印：

```text
每个 Node 世界坐标
每个 Node Local Position
所有 Component
UUID
Layer
Scale
Rotation
SpriteFrame
```

否则日志会迅速变得不可读。

以后遇到特定定位需求，再加可选开关：

```text
includePosition
includeComponents
includeLayer
```

即可。

---

# 15. Debug 日志前缀

统一使用：

```text
[RuntimeNodeTree]
```

例如：

```text
[RuntimeNodeTree]
===== Runtime Node Tree @ 00:42:20 =====
...
```

这样 Chrome Console Filter 输入：

```text
RuntimeNodeTree
```

即可只看节点树。

---

# 16. Definition of Done

完成后必须满足：

- [ ] 新增 `RuntimeNodeTreeLogger.ts`
- [ ] Logger 不依赖游戏业务系统
- [ ] Component 挂载在 Canvas
- [ ] 启动时可打印一次节点树
- [ ] 后续每 20 秒打印一次
- [ ] 一轮节点树只产生一个 `console.log`
- [ ] 显示 Node Name
- [ ] 显示 activeInHierarchy
- [ ] 显示 children count
- [ ] 大型分支可以折叠
- [ ] 默认 threshold = 100
- [ ] TileRoot 不输出 920 条子节点
- [ ] 能看到运行时生成的 `Squad_initial_01`
- [ ] 能看到 `Warrior_0~3`
- [ ] 有旗帜时能看到 `TargetFlag_initial_01`
- [ ] 浏览器 Console 无额外 Error

---

# 17. Agent 回报要求

完成后回报：

```text
1. 新增/修改文件

2. commit SHA

3. RuntimeNodeTreeLogger 完整实现

4. Main.scene 中挂载位置

5. 浏览器 Console 的一次实际输出

6. 确认 20 秒后再次出现一轮节点树

7. 确认 TileRoot 被折叠

8. 确认 Console 无 Error
```

---

# 18. 推荐结果

最终 Chrome Console 应类似：

```text
[RuntimeNodeTree]
===== Runtime Node Tree @ 00:42:20 =====
Main [ACTIVE] children=1
  Canvas [ACTIVE] children=2
    Camera [ACTIVE] children=0
    MapRoot [ACTIVE] children=4
      CommandRoot [ACTIVE] children=1
        TargetFlag_initial_01 [ACTIVE] children=0
      TileRoot [ACTIVE] children=920 [COLLAPSED]
      WorldObjectRoot [ACTIVE] children=2
        ...
      ActorRoot [ACTIVE] children=1
        SquadRoot [ACTIVE] children=1
          Squad_initial_01 [ACTIVE] children=4
            Warrior_0 [ACTIVE] children=0
            Warrior_1 [ACTIVE] children=0
            Warrior_2 [ACTIVE] children=0
            Warrior_3 [ACTIVE] children=0
===== End Runtime Node Tree =====
```

核心原则：

> 节点树 Logger 是独立 Debug 基础设施，不进入任何游戏业务逻辑。

> 每 20 秒做一次快照，而不是逐帧打印。

> 大地图节点自动折叠，重点观察动态 WorldObject、Squad、Warrior、Flag。
