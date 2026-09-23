# TowerDown：terrain2 瓦片替换与草地边缘解析方案

本方案替代此前的泥地边缘映射。仅涉及 tile 图片、切片、类型及解析；修改现有文件，不新增、删除或移动文件。本文是实施方案，尚未执行代码修改。

## 1. 统一规则

- TerrainType.Grass 仍表示草地，TerrainType.Dirt 仍表示泥地；不交换地图数据或逻辑含义。
- 泥地只显示 DirtCenter。
- 草地根据上下左右是否也是草地，显示 GrassCenter、四边或四角。
- 新素材底部是棕色地面包围草坪，因此过渡切片应放在草地格内。
- 每格世界大小仍为 32×32；新图源切片为 32×32。

## 2. assets/scripts/map/MapTypes.ts

TerrainType 和 TerrainMap 保持不变。将 TileVisual 枚举整体替换为：

```ts
export enum TileVisual {
    DirtCenter = 'DirtCenter',
    GrassCenter = 'GrassCenter',
    GrassTop = 'GrassTop',
    GrassBottom = 'GrassBottom',
    GrassLeft = 'GrassLeft',
    GrassRight = 'GrassRight',
    GrassTopLeft = 'GrassTopLeft',
    GrassTopRight = 'GrassTopRight',
    GrassBottomLeft = 'GrassBottomLeft',
    GrassBottomRight = 'GrassBottomRight',
}
```

旧 TileVisual.Grass 改为 GrassCenter；原 Dirt 的八个边角名称全部改成 Grass 对应名称。DirtCenter 保留。

## 3. assets/scripts/map/TerrainAtlas.ts

### 3.1 图片与尺寸

将 GridConfig 导入改为只导入 GRID_RENDER_SIZE；不要修改 GridConfig 本身。

```ts
export const ATLAS_TILE_SIZE = 32;
export const TILE_RENDER_SIZE = GRID_RENDER_SIZE;
export const TERRAIN_SPRITE_FRAME_UUID =
    '0ca7c1ca-86e7-4aba-9a38-521cfec5c983@f9941';
```

删除旧 TERRAIN_SPRITE_FRAME_FALLBACK_UUID 常量，并按第 6 节清理加载引用，避免新坐标裁旧图。

### 3.2 完整替换 ATLAS_CELLS

以下 column、row 均从整张 576×1120 PNG 左上角开始，索引从 0 开始，不是底部素材区域的局部坐标。

```ts
const ATLAS_CELLS: Record<TileVisual, AtlasCell> = {
    [TileVisual.DirtCenter]:       { column: 0, row: 31 },
    [TileVisual.GrassTopLeft]:     { column: 2, row: 31 },
    [TileVisual.GrassTop]:         { column: 3, row: 31 },
    [TileVisual.GrassTopRight]:    { column: 4, row: 31 },
    [TileVisual.GrassLeft]:        { column: 2, row: 32 },
    [TileVisual.GrassCenter]:      { column: 3, row: 32 },
    [TileVisual.GrassRight]:       { column: 4, row: 32 },
    [TileVisual.GrassBottomLeft]:  { column: 2, row: 34 },
    [TileVisual.GrassBottom]:      { column: 3, row: 34 },
    [TileVisual.GrassBottomRight]: { column: 4, row: 34 },
};
```

| 类型 | column,row | 源像素 x,y | 尺寸 |
| --- | --- | --- | --- |
| DirtCenter | 0,31 | 0,992 | 32×32 |
| GrassTopLeft | 2,31 | 64,992 | 32×32 |
| GrassTop | 3,31 | 96,992 | 32×32 |
| GrassTopRight | 4,31 | 128,992 | 32×32 |
| GrassLeft | 2,32 | 64,1024 | 32×32 |
| GrassCenter | 3,32 | 96,1024 | 32×32 |
| GrassRight | 4,32 | 128,1024 | 32×32 |
| GrassBottomLeft | 2,34 | 64,1088 | 32×32 |
| GrassBottom | 3,34 | 96,1088 | 32×32 |
| GrassBottomRight | 4,34 | 128,1088 | 32×32 |

原图中间草坪高四格，row=33 是额外的中段，不是下边；下边必须取 row=34。顶部切片大部分是棕色、草出现在下侧；底部切片草出现在上侧，这是原素材的过渡形状，不要因主体颜色占比而上下互换。

### 3.3 保持两个方法

getAtlasCell(visual) 保持返回 ATLAS_CELLS[visual]。
getAtlasRect(visual) 保持当前计算：

```ts
return {
    x: cell.column * ATLAS_TILE_SIZE,
    y: cell.row * ATLAS_TILE_SIZE,
    width: ATLAS_TILE_SIZE,
    height: ATLAS_TILE_SIZE,
};
```

不增加 profile、图集加载类或其他配置文件。

## 4. assets/scripts/map/MapResolver.ts

修改 resolve()：非草地返回 DirtCenter；只有草地计算邻接。将 isDirt() 改名为 isGrass()，判断对象改为 TerrainType.Grass。

完整替换参考：

```ts
import { TerrainType, TileVisual, type TerrainMap } from './MapTypes';

export class MapResolver {
    public resolve(map: TerrainMap, x: number, y: number): TileVisual {
        if (map[y]?.[x] !== TerrainType.Grass) {
            return TileVisual.DirtCenter;
        }

        const missingTop = !this.isGrass(map, x, y - 1);
        const missingRight = !this.isGrass(map, x + 1, y);
        const missingBottom = !this.isGrass(map, x, y + 1);
        const missingLeft = !this.isGrass(map, x - 1, y);

        if (missingTop && missingLeft) return TileVisual.GrassTopLeft;
        if (missingTop && missingRight) return TileVisual.GrassTopRight;
        if (missingBottom && missingLeft) return TileVisual.GrassBottomLeft;
        if (missingBottom && missingRight) return TileVisual.GrassBottomRight;
        if (missingTop) return TileVisual.GrassTop;
        if (missingBottom) return TileVisual.GrassBottom;
        if (missingLeft) return TileVisual.GrassLeft;
        if (missingRight) return TileVisual.GrassRight;
        return TileVisual.GrassCenter;
    }

    private isGrass(map: TerrainMap, x: number, y: number): boolean {
        return map[y]?.[x] === TerrainType.Grass;
    }
}
```

地图外仍按“不属于当前地形”处理，保持原解析器的越界规则，所以地图外沿的草地也会选边缘块。

本轮沿用原四邻接和分支优先级；没有增加对角判断。九宫格不覆盖凹角、单格草坪或同时缺失相对两边的窄条等全部组合；这些形状仍存在原算法的表达限制，不能将本次替换描述为完整自动拼接系统。

## 5. assets/scripts/map/MapRenderer.ts

不修改该文件。render() 原本就调用 resolver.resolve(map,x,y)，因此第 4 节更新后会自然取得 Grass 边角。

getOrCreateFrame() 继续调用 getAtlasRect(visual)；Map<TileVisual, SpriteFrame> 缓存仍适用。UITransform 保持 GRID_RENDER_SIZE，Sprite CUSTOM、格点位置均保持原样。

## 6. assets/scripts/map/MainMapController.ts

只调整 tile 相关 import 与已有 loadAtlasSpriteFrame()。

TerrainAtlas import 只保留 TERRAIN_SPRITE_FRAME_UUID。loadAtlasSpriteFrame() 替换为：

```ts
private loadAtlasSpriteFrame(): Promise<SpriteFrame> {
    return new Promise((resolve, reject) => {
        assetManager.loadAny<SpriteFrame>(
            TERRAIN_SPRITE_FRAME_UUID,
            (error, asset) => {
                if (error || !asset) {
                    reject(error ?? new Error('Failed to load terrain2 sprite frame.'));
                    return;
                }
                resolve(asset);
            },
        );
    });
}
```

保持 bootstrap() 调用方式与 new MapRenderer(tileRoot, atlasSpriteFrame) 不变。仅移除旧图回退，防止错误坐标组合。

## 7. assets/art/terrain/terrain2.png.meta

使用已有 terrain2.png；保持图片及子资源 UUID、576×1120 尺寸。

- minfilter、magfilter 改 nearest；mipfilter 保持 none。
- sprite-frame 的 packable 改 false。
- 在 Creator 确认整图裁切、原点为 0、无旋转，避免裁边改变上述整图坐标。

## 8. 一致性检查与换图验收

实际修改五个现有文件：MapTypes.ts、TerrainAtlas.ts、MapResolver.ts、MainMapController.ts、terrain2.png.meta。

1. 全仓搜索 TileVisual.Grass 与 Dirt 的八种旧边角引用，逐处核对；生产脚本不能留下旧枚举使用。注意 GrassCenter 等新名称也会匹配普通前缀搜索，不能误删。
2. TerrainType、StaticMap、世界格尺寸不变；Grass 显示草，Dirt 显示棕色地面，不能通过交换地形数据修正画面。
3. 检查矩形草地区域：中心、上下左右、四角分别读取表中对应切片；泥地一律取 (0,31)。
4. 检查底边取 row=34，没有取到 row=33 或左侧透明区；检查顶底、左右没有颠倒。
5. 检查现有静态地图上的草泥边界，记录九宫格无法表达的凹角，不能用错误的凸角声称已解决。
6. 确认无旧 fallback 引用、类型检查通过、每格仍为 32×32。新图片加载失败时明确报错。


## 9. 下一步：地洞内壁式世界边界（替代凸起平台方案）

目标是基地位于低处、四周为高处岩层。**正面岩壁绘制在地图上方，窄边沿绘制在地图下方，左右边缘朝向洞内。** 本节完整替代旧的“上方窄边、下方正面岩壁”方案。

只修改现有 MapTypes.ts、TerrainAtlas.ts、MapRenderer.ts；不新增文件、资源、组件或场景层级。本次只更新方案，尚未修改运行时代码。

### 9.1 取图与空间关系

图片坐标从左上开始，以 32px 为一格。左上矩形平台的 row=0、1 是顶面，row=2、3 才是正面岩壁。row=4 中部透明，不能作为完整岩壁追加。

地图内部仍使用原 Grass/Dirt 地形，原点与行列数不变。边界节点只放在原地图之外：

| 地图位置 | 取图 | 作用 |
| --- | --- | --- |
| 北侧，靠外一行 y=-2 | 原正面岩壁 row=2 | 上部岩壁 |
| 北侧，靠地图一行 y=-1 | 原正面岩壁 row=3 | 岩壁下端面向基地 |
| 南侧 y=H | 原平台顶沿 row=0 | 近景洞口边沿，地面向画面下方延伸 |
| 西侧 x=-1 | 原平台右边缘 column=8 | 岩层在左、边缘朝右面的洞内 |
| 东侧 x=W | 原平台左边缘 column=0 | 岩层在右、边缘朝左面的洞内 |

这里是交换素材的使用位置，不旋转或镜像图片，保持原光照。不要仅把所有旧 CliffTop/Bottom 的坐标交换：原凸平台外角不能因此变成凹洞内角。

本次北侧使用完整两行岩壁，显示高 64px；不是“四行岩壁”。加高必须提供或确认可连续重复的中段，不能把 row=4 当作中段，也不能反复重复带收口的 row=3。此前讨论的 128px 加高尚未实施，不在这里写成已确认的素材能力。

### 9.2 使用十字结构中的内转角

已按 32px 网格核对原图左侧十字结构（column=0～5，row=23～30），其中存在内角。删除旧方案“没有内角、由直边拼接”的描述。

以下名称按**洞内地图的角位置**定义，不按素材在十字架的左右位置定义。PNG 行列从 0 开始。

| 新 TileVisual | column,row | 源像素 x,y | 地图绘制坐标 |
| --- | --- | --- | --- |
| PitNorthWestUpper | 3,27 | 96,864 | -1,-2 |
| PitNorthWestLower | 3,28 | 96,896 | -1,-1 |
| PitNorthEastUpper | 2,27 | 64,864 | W,-2 |
| PitNorthEastLower | 2,28 | 64,896 | W,-1 |
| PitSouthWest | 3,25 | 96,800 | -1,H |
| PitSouthEast | 2,25 | 64,800 | W,H |

所有切片 32×32。北侧内角由 row=27、28 连续两块组成，对应北墙两行；南侧使用 row=25 的平面内转角，只需一行。

方向判断：
- 十字架下竖臂右侧（column=3）的凹角，实体在左，空缺朝右下，用于地图西北内角。
- 下竖臂左侧（column=2）的凹角，实体在右，空缺朝左下，用于地图东北内角。
- 上竖臂右侧（column=3,row=25）空缺朝右上，用于地图西南内角。
- 上竖臂左侧（column=2,row=25）空缺朝左上，用于地图东南内角。

四角不再使用直边瓦片覆盖；不旋转、不镜像。素材在原十字架中的相邻块可以作为拼接参照，运行时仍需验收与长直边相接是否有纹理接缝。

### 9.3 修改 MapTypes.ts

保留现有 Grass/Dirt TileVisual，新增十一个显示类型：

```ts
PitNorthWallUpper = 'PitNorthWallUpper',
PitNorthWallLower = 'PitNorthWallLower',
PitSouthRim = 'PitSouthRim',
PitWestRim = 'PitWestRim',
PitEastRim = 'PitEastRim',
PitNorthWestUpper = 'PitNorthWestUpper',
PitNorthWestLower = 'PitNorthWestLower',
PitNorthEastUpper = 'PitNorthEastUpper',
PitNorthEastLower = 'PitNorthEastLower',
PitSouthWest = 'PitSouthWest',
PitSouthEast = 'PitSouthEast',
```

若本地已实现旧方案的 Cliff 枚举，删除其旧边界使用并同步清理不再使用的枚举和映射，不保留两套边界同时渲染。

TerrainType、TerrainMap 不变：Pit 只属于显示类型，不是新的可行走地形。

### 9.4 修改 TerrainAtlas.ts

保持原 10 个地表映射，追加：

```ts
[TileVisual.PitNorthWallUpper]: { column: 4, row: 2 },
[TileVisual.PitNorthWallLower]: { column: 4, row: 3 },
[TileVisual.PitSouthRim]: { column: 4, row: 0 },
[TileVisual.PitWestRim]: { column: 8, row: 1 },
[TileVisual.PitEastRim]: { column: 0, row: 1 },
[TileVisual.PitNorthWestUpper]: { column: 3, row: 27 },
[TileVisual.PitNorthWestLower]: { column: 3, row: 28 },
[TileVisual.PitNorthEastUpper]: { column: 2, row: 27 },
[TileVisual.PitNorthEastLower]: { column: 2, row: 28 },
[TileVisual.PitSouthWest]: { column: 3, row: 25 },
[TileVisual.PitSouthEast]: { column: 2, row: 25 },
```

直边对应源 rect 如下；六个内角 rect 见第 9.2 节，宽高均为 32：

| 类型 | x | y | width | height |
| --- | --- | --- | --- | --- |
| PitNorthWallUpper | 128 | 64 | 32 | 32 |
| PitNorthWallLower | 128 | 96 | 32 | 32 |
| PitSouthRim | 128 | 0 | 32 | 32 |
| PitWestRim | 256 | 32 | 32 | 32 |
| PitEastRim | 0 | 32 | 32 | 32 |

getAtlasCell()、getAtlasRect()、UUID 与尺寸保持原样。直边和内角共十一种素材都来自同一张 terrain2，不增加资源加载。

### 9.5 修改 MapRenderer.ts

#### A. 抽取 createTile()

将原 render() 中创建节点、设置位置和 Sprite 的代码抽入同类方法：

```ts
private createTile(
    visual: TileVisual,
    x: number,
    y: number,
    columns: number,
    rows: number,
    prefix: string,
): void {
    const tileNode = new Node(`${prefix}_${x}_${y}`);
    tileNode.setParent(this.tileRoot);
    tileNode.layer = this.tileRoot.layer;
    tileNode.setPosition(gridCellToWorldCenter(x, y, columns, rows));

    const transform = tileNode.addComponent(UITransform);
    transform.setContentSize(GRID_RENDER_SIZE, GRID_RENDER_SIZE);

    const sprite = tileNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = this.getOrCreateFrame(visual);
}
```

复用现有 TileRoot 和 frameCache，不新增输入、碰撞或地形数据。

#### B. 新增 renderPitBoundary()，取代旧 renderCliffBoundary()

```ts
private renderPitBoundary(columns: number, rows: number): void {
    const put = (visual: TileVisual, x: number, y: number): void => {
        this.createTile(visual, x, y, columns, rows, 'Pit');
    };

    for (let x = 0; x < columns; x += 1) {
        put(TileVisual.PitNorthWallUpper, x, -2);
        put(TileVisual.PitNorthWallLower, x, -1);
        put(TileVisual.PitSouthRim, x, rows);
    }

    // 直侧沿只覆盖原地图行，不占用内角位置。
    for (let y = 0; y < rows; y += 1) {
        put(TileVisual.PitWestRim, -1, y);
        put(TileVisual.PitEastRim, columns, y);
    }

    // 北侧两个内角各由上下两块组成。
    put(TileVisual.PitNorthWestUpper, -1, -2);
    put(TileVisual.PitNorthWestLower, -1, -1);
    put(TileVisual.PitNorthEastUpper, columns, -2);
    put(TileVisual.PitNorthEastLower, columns, -1);

    // 南侧内角只占一行。
    put(TileVisual.PitSouthWest, -1, rows);
    put(TileVisual.PitSouthEast, columns, rows);
}
```

gridCellToWorldCenter() 支持负数及范围外坐标，直接复用；始终传入原 columns、rows，不能传扩容后的地图大小。

#### C. 修改 render()

```ts
public render(map: TerrainMap): void {
    this.clear();
    const rows = map.length;
    const columns = map[0]?.length ?? 0;
    if (rows === 0 || columns === 0) return;

    this.renderPitBoundary(columns, rows);

    for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
            this.createTile(
                this.resolver.resolve(map, x, y),
                x, y, columns, rows, 'Tile',
            );
        }
    }
}
```

原地表渲染顺序和位置不变。若旧边界已存在，只保留 renderPitBoundary() 调用，不能再调用旧方法。

#### D. clear() 与缓存

为避免重绘只脱离旧边界但不销毁，clear() 改为：

```ts
public clear(): void {
    for (const child of [...this.tileRoot.children]) {
        child.removeFromParent();
        child.destroy();
    }
}
```

TileRoot 仍专用于地图瓦片。getOrCreateFrame() 不变，新增枚举复用现有缓存。普通重绘不销毁共享图集。

### 9.6 保持一致性

MapResolver 仍只解析地图内 Grass/Dirt；MainMapController 加载和初始化不改；StaticMap、GridTransform、地图可建造和可行走范围不改。

悬崖不是无限背景。北侧覆盖 64px，其他方向覆盖 32px，素材透明边及外沿之外仍可见背景。本次不通过相机或逻辑地图扩容掩盖背景。

### 9.7 验收

1. 正面岩壁位于地图上方，其底部贴近基地地面；下方只显示近景边沿。不能再呈现“基地上表面、岩壁垂在基地下方”的凸平台构图。
2. 左边使用原图右沿、右边使用原图左沿；岩层实体位于外围，边缘朝洞内；禁止旋转、负缩放。
3. 四处使用十字结构的真实内角：北角 row=27 在上、row=28 在下，南角 row=25；西侧取 column=3，东侧取 column=2。检查与北墙、侧沿、南沿连接，无透明裂口、重复覆盖或方向反转。不得再用直侧沿覆盖六个角格。
4. W×H 地图新增节点数 3W+2H+6；40×23 地图新增 172 个，总计 1092 个。连续重绘数量不翻倍。
5. 所有 Pit 节点在地图逻辑范围外，原 Tile_0_0、建筑和单位位置不变。
6. row=4 不用于横墙；北墙下段 row=3 不被当作重复中段。确认 TypeScript 枚举和 atlas 表完整对应。
