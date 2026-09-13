# Cocos Creator 3.8.x：Main Scene + 静态 Tile Map 最小可运行方案

> 目标：让一个空 Cocos Creator 3.8.x 2D 项目能够正常启动，进入 `Main.scene`，读取 `StaticMap.ts` 中的二维数组，并使用 `terrain.png` Atlas 渲染出静态草地/泥土地形。之后只修改 `STATIC_MAP`，画面应发生对应变化。
>
> 当前阶段 **不做 UI、基地、资源、角色、敌人、随机地图、Tiled/TMX、47 Tile、Chunk、Mesh**。

---

## 0. 本阶段最终必须跑通的链路

```text
Main.scene
    ↓
MainMapController.start()
    ↓
STATIC_MAP
    ↓
MapResolver.resolve(...)
    ↓
TileVisual
    ↓
TerrainAtlas: TileVisual -> (col,row)
    ↓
MapRenderer
    ↓
从 terrain.png 创建子 SpriteFrame
    ↓
TileRoot 下生成 Tile Node
    ↓
浏览器中看到地图
```

完成后，修改：

```text
assets/scripts/map/StaticMap.ts
```

不修改 Scene、不修改 Renderer、不修改 Atlas 配置，重新 Preview 后地图形状必须变化。

---

# 1. 文件目录

在 Cocos 的 `assets` 下建立：

```text
assets/
├── art/
│   └── terrain/
│       └── terrain.png
│
├── scenes/
│   └── Main.scene
│
└── scripts/
    └── map/
        ├── MapTypes.ts
        ├── StaticMap.ts
        ├── TerrainAtlas.ts
        ├── MapResolver.ts
        ├── MapRenderer.ts
        └── MainMapController.ts
```

注意：

- `Main.scene` **必须在 Cocos Creator 编辑器中创建和保存**。
- 不要手写或手改 `.scene` JSON。
- `.meta` 文件由 Cocos 自动生成，不要手工创建。
- `terrain.png` 使用原始整张 Atlas，不拆成几十张 PNG。

---

# 2. 导入 terrain.png

把提供的地形图复制到：

```text
assets/art/terrain/terrain.png
```

当前图片参数已经验证：

```text
图片宽度：352 px
图片高度：417 px
基础 Tile：16 × 16 px
横向：22 个 16px 列
有效地形高度：前 416 px
最后约 1 px 为透明尾部
```

当前第一版只使用 Grass + Dirt 的基础 Tile：

```text
GrassBase       (col=0,row=12)

DirtTopLeft     (0,7)
DirtTop         (1,7)
DirtTopRight    (2,7)

DirtLeft        (0,8)
DirtCenter      (1,8)
DirtRight       (2,8)

DirtBottomLeft  (0,9)
DirtBottom      (1,9)
DirtBottomRight (2,9)
```

这里的 `(col,row)` 是**从原图左上角开始数**：

```text
col 向右增加
row 向下增加
```

---

# 3. 设置 Pixel Art 纹理

在 Cocos 的 **Assets / 资源管理器** 中选中：

```text
terrain.png
```

在右侧 Inspector 中检查纹理导入设置。

目标是：

```text
Min Filter / Minification Filter = Nearest / Point
Mag Filter / Magnification Filter = Nearest / Point
```

如果当前 Cocos 3.8 小版本中字段名称略有不同，原则不变：

> Pixel Art 采样必须使用 Point / Nearest，不能使用 Linear。

如果存在 Mipmap 选项，第一版关闭即可。

保存资源设置。

---

# 4. 创建 Main.scene —— 这一段必须在 Cocos 编辑器里做

## 4.1 创建 Scene

在 Assets 面板：

```text
assets/scenes
```

右键：

```text
Create / 创建
    ↓
Scene / 场景
```

命名：

```text
Main
```

应该生成：

```text
assets/scenes/Main.scene
```

然后：

**双击 `Main.scene` 打开它。**

非常重要：

> Cocos Preview 默认可以运行 Current Scene。Scene 文件创建了但没有双击打开时，可能预览的仍然是别的场景或空场景。

---

# 5. 创建 Canvas

打开 `Main.scene` 后，在 Hierarchy / 层级管理器中创建一个 Canvas。

可使用编辑器顶部菜单或 Hierarchy 的 `+`：

```text
Create UI Node
    ↓
Canvas
```

不同 3.8 小版本菜单文字可能略有不同，只要最终创建的是带有 **Canvas Component** 的 Canvas 即可。

完成后检查 Hierarchy。

至少应存在：

```text
Main Scene
└── Canvas
```

Cocos 使用 Canvas 模板创建时通常会同时配置 2D 渲染所需 Camera。

如果当前模板没有自动产生 Camera，则检查：

- 场景中是否有启用的 Camera；
- Camera 是否能看到 `UI_2D` Layer；
- Camera 使用正交方式进行 2D 显示。

第一版不要自行调整复杂 Camera 参数，先使用 Canvas 默认配置。

---

# 6. 创建 MapRoot 和 TileRoot

在 `Canvas` 下创建两个普通空节点。

最终 Hierarchy 必须是：

```text
Main.scene
└── Canvas
    └── MapRoot
        └── TileRoot
```

其中：

### MapRoot

用途：

```text
整个地图系统的根节点
```

要求：

```text
Position = (0, 0, 0)
Rotation = 0
Scale    = (1, 1, 1)
```

### TileRoot

用途：

```text
MapRenderer 动态生成的所有 Tile 都放到这里
```

要求：

```text
Position = (0, 0, 0)
Rotation = 0
Scale    = (1, 1, 1)
```

**不要手工往 TileRoot 里面放 Sprite。**

运行时应该由代码生成：

```text
TileRoot
├── Tile_0_0
├── Tile_1_0
├── Tile_2_0
├── ...
```

---

# 7. 创建代码文件

下面代码直接按文件保存。

---

## 7.1 `MapTypes.ts`

路径：

```text
assets/scripts/map/MapTypes.ts
```

内容：

```ts
export enum TerrainType {
    Grass = 0,
    Dirt = 1,
}

export enum TileVisual {
    GrassBase = 0,

    DirtTopLeft,
    DirtTop,
    DirtTopRight,

    DirtLeft,
    DirtCenter,
    DirtRight,

    DirtBottomLeft,
    DirtBottom,
    DirtBottomRight,
}

export type TerrainMap = TerrainType[][];
```

职责：

```text
定义地图逻辑类型和渲染结果类型。
```

这里绝对不能出现：

```text
Node
Sprite
Texture2D
SpriteFrame
Atlas Pixel Rect
```

---

# 8. 创建 StaticMap.ts

路径：

```text
assets/scripts/map/StaticMap.ts
```

内容：

```ts
import { TerrainMap, TerrainType } from './MapTypes';

const G = TerrainType.Grass;
const D = TerrainType.Dirt;

export const STATIC_MAP: TerrainMap = [
    [G,G,G,G,G,G,G,G,G,G,G,G],
    [G,G,G,G,G,G,G,G,G,G,G,G],
    [G,G,G,D,D,D,D,D,D,G,G,G],
    [G,G,G,D,D,D,D,D,D,G,G,G],
    [G,G,G,D,D,D,D,D,D,G,G,G],
    [G,G,G,D,D,D,D,D,D,G,G,G],
    [G,G,G,G,G,G,G,G,G,G,G,G],
    [G,G,G,G,G,G,G,G,G,G,G,G],
];
```

地图坐标约定：

```text
map[y][x]
```

也就是：

```text
map[row][column]
```

数组左上角：

```text
map[0][0]
```

是地图视觉上的左上角。

---

# 9. 创建 TerrainAtlas.ts

路径：

```text
assets/scripts/map/TerrainAtlas.ts
```

内容：

```ts
import { TileVisual } from './MapTypes';

export interface AtlasCell {
    col: number;
    row: number;
}

export const TILE_SOURCE_SIZE = 16;

// 第一版为了屏幕上看得清，按整数倍放大。
// 16 * 3 = 每格最终显示 48 px。
export const TILE_RENDER_SCALE = 3;

export const TILE_RENDER_SIZE =
    TILE_SOURCE_SIZE * TILE_RENDER_SCALE;

export const TERRAIN_ATLAS: Record<TileVisual, AtlasCell> = {
    [TileVisual.GrassBase]: {
        col: 0,
        row: 12,
    },

    [TileVisual.DirtTopLeft]: {
        col: 0,
        row: 7,
    },

    [TileVisual.DirtTop]: {
        col: 1,
        row: 7,
    },

    [TileVisual.DirtTopRight]: {
        col: 2,
        row: 7,
    },

    [TileVisual.DirtLeft]: {
        col: 0,
        row: 8,
    },

    [TileVisual.DirtCenter]: {
        col: 1,
        row: 8,
    },

    [TileVisual.DirtRight]: {
        col: 2,
        row: 8,
    },

    [TileVisual.DirtBottomLeft]: {
        col: 0,
        row: 9,
    },

    [TileVisual.DirtBottom]: {
        col: 1,
        row: 9,
    },

    [TileVisual.DirtBottomRight]: {
        col: 2,
        row: 9,
    },
};
```

这一层的职责只有：

```text
TileVisual
    ↓
Atlas Cell (col,row)
```

---

# 10. 创建 MapResolver.ts

路径：

```text
assets/scripts/map/MapResolver.ts
```

内容：

```ts
import {
    TerrainMap,
    TerrainType,
    TileVisual,
} from './MapTypes';

export class MapResolver {

    public resolve(
        map: TerrainMap,
        x: number,
        y: number,
    ): TileVisual {

        const terrain = map[y][x];

        if (terrain === TerrainType.Grass) {
            return TileVisual.GrassBase;
        }

        return this.resolveDirt(map, x, y);
    }

    private resolveDirt(
        map: TerrainMap,
        x: number,
        y: number,
    ): TileVisual {

        const top = this.isDirt(map, x, y - 1);
        const right = this.isDirt(map, x + 1, y);
        const bottom = this.isDirt(map, x, y + 1);
        const left = this.isDirt(map, x - 1, y);

        // 外角优先判断
        if (!top && !left) {
            return TileVisual.DirtTopLeft;
        }

        if (!top && !right) {
            return TileVisual.DirtTopRight;
        }

        if (!bottom && !left) {
            return TileVisual.DirtBottomLeft;
        }

        if (!bottom && !right) {
            return TileVisual.DirtBottomRight;
        }

        // 四条边
        if (!top) {
            return TileVisual.DirtTop;
        }

        if (!bottom) {
            return TileVisual.DirtBottom;
        }

        if (!left) {
            return TileVisual.DirtLeft;
        }

        if (!right) {
            return TileVisual.DirtRight;
        }

        return TileVisual.DirtCenter;
    }

    private isDirt(
        map: TerrainMap,
        x: number,
        y: number,
    ): boolean {

        if (y < 0 || y >= map.length) {
            return false;
        }

        if (x < 0 || x >= map[y].length) {
            return false;
        }

        return map[y][x] === TerrainType.Dirt;
    }
}
```

注意：

`MapResolver` 是纯逻辑类。

**严禁在这里创建 Cocos Node。**

第一版 Resolver 只适用于比较厚的矩形/简单 Blob。

暂时不要求正确处理：

```text
单格 Dirt
单行 Dirt
内凹角
洞
复杂 8-neighbor
47 Tile
```

这些下一阶段再做。

---

# 11. 创建 MapRenderer.ts

路径：

```text
assets/scripts/map/MapRenderer.ts
```

内容：

```ts
import {
    Layers,
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec2,
} from 'cc';

import {
    TerrainMap,
    TileVisual,
} from './MapTypes';

import {
    TERRAIN_ATLAS,
    TILE_RENDER_SCALE,
    TILE_RENDER_SIZE,
    TILE_SOURCE_SIZE,
} from './TerrainAtlas';

import { MapResolver } from './MapResolver';

export class MapRenderer {

    private readonly resolver = new MapResolver();

    private readonly frameCache =
        new Map<TileVisual, SpriteFrame>();

    constructor(
        private readonly tileRoot: Node,
        private readonly terrainTexture: Texture2D,
    ) {}

    public render(map: TerrainMap): void {

        this.clear();

        if (map.length === 0) {
            console.warn('[MapRenderer] map is empty.');
            return;
        }

        const mapHeight = map.length;
        const mapWidth = map[0].length;

        const totalWidth =
            mapWidth * TILE_RENDER_SIZE;

        const totalHeight =
            mapHeight * TILE_RENDER_SIZE;

        for (let y = 0; y < mapHeight; y++) {

            if (map[y].length !== mapWidth) {
                throw new Error(
                    '[MapRenderer] STATIC_MAP must be rectangular.'
                );
            }

            for (let x = 0; x < mapWidth; x++) {

                const visual =
                    this.resolver.resolve(map, x, y);

                const tileNode =
                    new Node(`Tile_${x}_${y}`);

                tileNode.layer =
                    Layers.Enum.UI_2D;

                tileNode.parent =
                    this.tileRoot;

                const uiTransform =
                    tileNode.addComponent(UITransform);

                uiTransform.setContentSize(
                    TILE_SOURCE_SIZE,
                    TILE_SOURCE_SIZE,
                );

                const sprite =
                    tileNode.addComponent(Sprite);

                sprite.spriteFrame =
                    this.getSpriteFrame(visual);

                // 原图 16x16，使用整数倍缩放保持像素感。
                tileNode.setScale(
                    TILE_RENDER_SCALE,
                    TILE_RENDER_SCALE,
                    1,
                );

                // map[0][0] 定义为地图左上角。
                // Cocos UI 坐标中 y 向上，所以 row 增加时 y 减少。
                const posX =
                    -totalWidth / 2
                    + TILE_RENDER_SIZE / 2
                    + x * TILE_RENDER_SIZE;

                const posY =
                    totalHeight / 2
                    - TILE_RENDER_SIZE / 2
                    - y * TILE_RENDER_SIZE;

                tileNode.setPosition(
                    posX,
                    posY,
                    0,
                );
            }
        }

        console.log(
            `[MapRenderer] rendered ${mapWidth}x${mapHeight} map.`
        );
    }

    public clear(): void {

        const children =
            [...this.tileRoot.children];

        for (const child of children) {
            child.removeFromParent();
            child.destroy();
        }
    }

    private getSpriteFrame(
        visual: TileVisual,
    ): SpriteFrame {

        const cached =
            this.frameCache.get(visual);

        if (cached) {
            return cached;
        }

        const cell =
            TERRAIN_ATLAS[visual];

        const x =
            cell.col * TILE_SOURCE_SIZE;

        // 我们的 Atlas row 是从图片左上角向下数。
        const topY =
            cell.row * TILE_SOURCE_SIZE;

        /*
         * Cocos Rect 使用纹理坐标。
         * 这里统一把“左上原点 row”转换到纹理 Rect。
         *
         * terrain.png 实际 height 为 417，
         * 所以不要写死 416；
         * 直接使用 terrainTexture.height。
         */
        const y =
            this.terrainTexture.height
            - topY
            - TILE_SOURCE_SIZE;

        const frame =
            new SpriteFrame();

        frame.reset({
            texture: this.terrainTexture,

            rect: new Rect(
                x,
                y,
                TILE_SOURCE_SIZE,
                TILE_SOURCE_SIZE,
            ),

            originalSize: new Size(
                TILE_SOURCE_SIZE,
                TILE_SOURCE_SIZE,
            ),

            offset: new Vec2(0, 0),
        });

        // 第一版避免动态 Atlas 干扰我们的手工 Rect。
        frame.packable = false;

        this.frameCache.set(
            visual,
            frame,
        );

        return frame;
    }
}
```

---

# 12. 创建 MainMapController.ts

路径：

```text
assets/scripts/map/MainMapController.ts
```

内容：

```ts
import {
    _decorator,
    Component,
    Node,
    Texture2D,
} from 'cc';

import { STATIC_MAP } from './StaticMap';
import { MapRenderer } from './MapRenderer';

const {
    ccclass,
    property,
} = _decorator;

@ccclass('MainMapController')
export class MainMapController
extends Component {

    @property(Node)
    public tileRoot: Node | null = null;

    @property(Texture2D)
    public terrainTexture: Texture2D | null = null;

    private renderer: MapRenderer | null = null;

    start(): void {

        console.log(
            '[MainMapController] start.'
        );

        if (!this.tileRoot) {
            console.error(
                '[MainMapController] tileRoot is not assigned.'
            );
            return;
        }

        if (!this.terrainTexture) {
            console.error(
                '[MainMapController] terrainTexture is not assigned.'
            );
            return;
        }

        this.renderer =
            new MapRenderer(
                this.tileRoot,
                this.terrainTexture,
            );

        this.renderer.render(
            STATIC_MAP
        );

        console.log(
            '[MainMapController] map loaded successfully.'
        );
    }
}
```

---

# 13. 等待 Cocos 编译脚本

保存所有 `.ts` 文件以后回到 Cocos。

不要马上继续操作。

先看底部：

```text
Console
```

确保：

```text
没有红色 TypeScript 编译错误
```

如果 `MainMapController` 没有出现在 Add Component 中，优先看 Console。

常见原因：

```text
某个 import 拼错
TS 编译失败
文件名和 class 名不一致
脚本尚未刷新完成
```

---

# 14. 把 MainMapController 挂到 MapRoot

这是最容易漏掉的一步。

在 Hierarchy 中选择：

```text
Canvas
└── MapRoot   ← 选这个
```

在 Inspector 最下方点击：

```text
Add Component
    ↓
Custom Script
    ↓
MainMapController
```

也可以：

> 直接从 Assets 面板把 `MainMapController.ts` 拖到 `MapRoot` 的 Inspector。

完成以后，MapRoot 的 Inspector 中应该出现：

```text
MainMapController

Tile Root        [ None ]
Terrain Texture  [ None ]
```

如果看不到这两个字段，说明脚本还没有正确挂载或还没有成功编译。

---

# 15. 绑定 TileRoot

选中 `MapRoot`。

在 MainMapController 组件里找到：

```text
Tile Root
```

从 Hierarchy：

```text
Canvas
└── MapRoot
    └── TileRoot
```

把：

```text
TileRoot
```

直接拖进：

```text
Tile Root
```

字段。

最后应显示：

```text
Tile Root = TileRoot
```

---

# 16. 绑定 terrain.png Texture

在 MainMapController 组件里找到：

```text
Terrain Texture
```

从 Assets：

```text
assets/art/terrain/terrain.png
```

把对应的 **Texture2D 资源** 拖入：

```text
Terrain Texture
```

字段。

目标：

```text
Terrain Texture = terrain
```

注意：

PNG 导入后 Cocos 可能显示图片资源以及它的子资源。

`terrainTexture` 属性声明的是：

```ts
@property(Texture2D)
```

因此必须拖入能被 Inspector 接受为 `Texture2D` 的资源。

如果直接拖 PNG 不接受：

1. 展开 PNG 的子资源；
2. 找到 Texture / Texture2D；
3. 将它拖到 `Terrain Texture`。

不要把单个手工切好的 16×16 SpriteFrame 拖进来。

这里需要的是：

> 整张 352×417 terrain Atlas Texture。

---

# 17. 现在保存 Main.scene

执行：

```text
Cmd + S
```

Windows：

```text
Ctrl + S
```

确认：

```text
assets/scenes/Main.scene
```

已经保存。

**绑定 Inspector 字段之后如果不保存 Scene，重新打开项目时引用可能丢失。**

---

# 18. Preview Main.scene

确保当前编辑器已经双击打开：

```text
Main.scene
```

顶部 Preview 选择：

```text
Browser
```

Scene 选择：

```text
Current Scene
```

然后点击 Play / Preview。

第一版建议使用 Browser，方便看 Chrome DevTools Console。

---

# 19. 正常情况下 Console 应出现

至少：

```text
[MainMapController] start.

[MapRenderer] rendered 12x8 map.

[MainMapController] map loaded successfully.
```

如果三行都有，说明：

```text
Scene
↓
Component
↓
StaticMap
↓
Renderer
```

已经全部连通。

---

# 20. 正常画面应该是什么

你应该看到一个居中的：

```text
12 × 8
```

Tile Map。

因为：

```text
TileSource = 16
Scale      = 3
RenderTile = 48
```

所以画面大小约：

```text
宽：12 × 48 = 576
高： 8 × 48 = 384
```

中央应该存在一个泥地区域。

视觉类似：

```text
GGGGGGGGGGGG
GGGGGGGGGGGG
GGGDDDDDDGGG
GGGDDDDDDGGG
GGGDDDDDDGGG
GGGDDDDDDGGG
GGGGGGGGGGGG
GGGGGGGGGGGG
```

边缘应使用：

```text
Top
Bottom
Left
Right
4 Corners
```

而不是全部显示 Dirt Center。

---

# 21. 验证“只修改 StaticMap 即可改变背景”

第一张图正常后，只修改：

```text
StaticMap.ts
```

例如改成：

```ts
import { TerrainMap, TerrainType } from './MapTypes';

const G = TerrainType.Grass;
const D = TerrainType.Dirt;

export const STATIC_MAP: TerrainMap = [
    [G,G,G,G,G,G,G,G,G,G,G,G],
    [G,G,D,D,D,D,G,G,G,G,G,G],
    [G,G,D,D,D,D,G,G,G,G,G,G],
    [G,G,D,D,D,D,D,D,D,D,G,G],
    [G,G,D,D,D,D,D,D,D,D,G,G],
    [G,G,G,G,G,G,D,D,D,D,G,G],
    [G,G,G,G,G,G,D,D,D,D,G,G],
    [G,G,G,G,G,G,G,G,G,G,G,G],
];
```

注意这一版 Resolver 还不是 47 Tile。

所以测试形状请先使用：

```text
矩形
多个连接矩形
足够厚的区域
```

避免测试：

```text
1 格宽线条
内凹洞
复杂岛屿
```

保存以后重新 Preview。

**如果画面跟 StaticMap 一起变化，第一阶段成功。**

---

# 22. 如果 Preview 是一片空白 —— 按这个顺序查

## A. 先看 Console

如果没有：

```text
[MainMapController] start.
```

说明 Controller 根本没运行。

检查：

```text
1. 是否打开 Main.scene
2. MainMapController 是否真的挂在 MapRoot
3. Scene 是否保存
4. 脚本是否编译成功
```

---

## B. 有 start，但提示 tileRoot 未绑定

如果出现：

```text
tileRoot is not assigned
```

说明 Inspector：

```text
Tile Root = None
```

把 Hierarchy 的 `TileRoot` 拖进去。

---

## C. 提示 terrainTexture 未绑定

如果出现：

```text
terrainTexture is not assigned
```

说明 Inspector：

```text
Terrain Texture = None
```

把 `terrain.png` 的 Texture2D 资源拖进去。

---

## D. 日志说 rendered 12x8，但画面还是空白

检查：

```text
TileRoot
```

运行时 Hierarchy 中有没有自动出现：

```text
Tile_0_0
Tile_1_0
...
```

如果有 Tile Node 但不可见：

重点检查：

```text
Node Layer
Camera Visibility
Canvas / Camera
```

代码已经设置：

```ts
tileNode.layer = Layers.Enum.UI_2D;
```

Camera 必须能够渲染 UI_2D。

---

## E. 地图出现了，但是切图内容完全不对

优先看：

```text
MapRenderer.getSpriteFrame()
```

特别是：

```ts
const y =
    terrainTexture.height
    - topY
    - TILE_SOURCE_SIZE;
```

我们的 Atlas 坐标表是：

```text
左上原点
row 向下
```

而 Cocos SpriteFrame Rect 使用的纹理 Rect 坐标需要转换。

如果所有 tile 都表现为“上下错位”，问题几乎一定在这里。

**不要因此修改 StaticMap。**

---

## F. Tile 显示成整张 terrain.png

说明生成的子 SpriteFrame 没正确使用：

```text
rect
```

检查：

```ts
frame.reset({
    texture,
    rect,
    originalSize,
    offset,
});
```

必须实际执行。

---

## G. 每个 tile 之间有缝

检查：

```text
TILE_SOURCE_SIZE = 16
TILE_RENDER_SCALE = 整数
TILE_RENDER_SIZE = 48
```

不要使用：

```text
scale = 2.7
scale = 1.5
```

Pixel Art 第一版全部整数缩放。

---

## H. 图片模糊

不是 MapResolver 问题。

检查 `terrain.png` 的 Texture Filter：

```text
Nearest / Point
```

不要：

```text
Linear
```

---

# 23. 设置 Main.scene 为正式 Start Scene

仅仅 Preview Current Scene 时，不需要提前配置 Start Scene。

但要让之后 Build 后直接从 Main 启动，需要：

```text
Project
↓
Build
```

在 Build 面板的：

```text
Included Scenes
```

确保：

```text
Main.scene
```

已加入。

然后把：

```text
Main.scene
```

设为：

```text
Start Scene
```

如果项目当前只有 Main.scene，一般会比较简单。

第一阶段至少要验证：

```text
Browser Preview -> Current Scene
```

能正常运行。

---

# 24. Agent 绝对不要做的事情

当前任务完成前禁止：

```text
不要引入 Tiled Editor
不要创建 TMX
不要创建 TSX
不要上 Wang Tile
不要实现 47 Tile
不要实现随机地图
不要实现 Noise
不要实现 Chunk
不要实现 Mesh
不要写 Shader
不要做资源生成
不要做基地
不要做 UI
不要做防御塔
不要做角色
不要做碰撞
不要做物理
不要做寻路
```

也不要因为 Scene 配置困难就：

```text
手工编辑 Main.scene JSON
```

Scene 的创建、节点层级、脚本挂载和资源引用，都应该通过 Cocos Creator Editor 完成。

---

# 25. Definition of Done

只有下面全部满足，任务才算结束：

- [ ] `assets/scenes/Main.scene` 已创建并能打开
- [ ] Scene 中存在 `Canvas -> MapRoot -> TileRoot`
- [ ] `MainMapController` 已挂到 `MapRoot`
- [ ] `tileRoot` Inspector 引用已绑定
- [ ] `terrainTexture` Inspector 引用已绑定
- [ ] Cocos Console 无 TypeScript 编译错误
- [ ] Preview 能进入 Main.scene
- [ ] Console 出现 `[MainMapController] start.`
- [ ] Console 出现 `[MapRenderer] rendered 12x8 map.`
- [ ] Console 出现 `map loaded successfully`
- [ ] 画面中能看到 Grass
- [ ] 画面中能看到 Dirt
- [ ] Dirt Center / Edge / Corner 有区别
- [ ] Tile 像素边缘清晰，不明显模糊
- [ ] 只修改 `StaticMap.ts`，重新 Preview 后地图发生对应变化
- [ ] 不需要改 Scene
- [ ] 不需要改 MapRenderer
- [ ] 不需要重新切图
- [ ] 没有加入 Gameplay / UI / Random Map 等额外功能

---

# 26. Agent 完成后必须回报

完成以后不要只说“完成”。

必须返回：

```text
1. Cocos Creator 实际版本：
   例如 3.8.7 / 3.8.8 / 3.8.9

2. Main.scene Hierarchy：
   Main
   └ Canvas
     └ MapRoot
       └ TileRoot

3. MainMapController Inspector：
   tileRoot = ?
   terrainTexture = ?

4. Preview Console：
   粘贴以下三条日志
   [MainMapController] start.
   [MapRenderer] rendered ...
   [MainMapController] map loaded successfully.

5. 实际画面截图

6. 将 StaticMap 改成第二个形状后的截图

7. 如果 Atlas 切片上下颠倒：
   说明当前实际 SpriteFrame Rect 的表现，
   不要擅自修改 Atlas 坐标表。
```

---

# 27. 这一阶段通过以后再做什么

下一阶段才升级：

```text
4-neighbor 9 Tile
    ↓
8-neighbor mask
    ↓
47 Tile Blob Resolver
    ↓
任意凹凸地图
```

届时保持：

```text
STATIC_MAP
MapRenderer
Main.scene
```

总体接口不变，只升级：

```text
MapResolver
+
TerrainAtlas Lookup
```

当前阶段先保证最小地图骨架稳定运行。
