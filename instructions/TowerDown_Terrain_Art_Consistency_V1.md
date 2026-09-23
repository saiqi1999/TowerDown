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


## 9. 下一步：使用同图集绘制世界外沿悬崖

基于已推送的 `c19b232`。第 1～8 节的换图已完成，本节是新增待实施步骤。只修改现有 `MapTypes.ts`、`TerrainAtlas.ts`、`MapRenderer.ts` 三个脚本；不新增文件、图片、组件或场景层级。

### 9.1 显示规则

沿现有矩形地图外侧补画装饰瓦片：上方 1 行、左右各 1 列、下方 2 行。原地图内容和坐标不移动、不扩容。

同一平台素材在俯视角下，上沿是窄崖沿，左右是侧沿，下方才有完整可见岩壁。使用其原始方向，不旋转底部岩壁冒充另外三面，以保持光线和透视一致。

这是有限宽度的悬崖边界，不是无限背景填充。外沿之后以及素材透明角以外仍可见背景；当前镜头允许 overscroll=48、最小缩放 0.85，一格宽边界不能保证视口中完全没有黑色。本步不修改相机限制。

### 9.2 原图取块位置

只使用 terrain2 左上角矩形平台的 9 列×4 行区域，源范围 x=0～287、y=0～127。全部切片为 32×32，按 PNG 左上为原点，不使用下方斜坡形状，也不使用草坪区域。

| 新 TileVisual | column,row | 像素 x,y | 放置用途 |
| --- | --- | --- | --- |
| CliffTopLeft | 0,0 | 0,0 | 左上外角 |
| CliffTop | 4,0 | 128,0 | 上沿重复块 |
| CliffTopRight | 8,0 | 256,0 | 右上外角 |
| CliffLeft | 0,1 | 0,32 | 左侧重复块 |
| CliffRight | 8,1 | 256,32 | 右侧重复块 |
| CliffBottomLeftUpper | 0,2 | 0,64 | 下方第一行左角 |
| CliffBottomUpper | 4,2 | 128,64 | 下方第一行岩壁 |
| CliffBottomRightUpper | 8,2 | 256,64 | 下方第一行右角 |
| CliffBottomLeftLower | 0,3 | 0,96 | 下方第二行左角 |
| CliffBottomLower | 4,3 | 128,96 | 下方第二行岩壁 |
| CliffBottomRightLower | 8,3 | 256,96 | 下方第二行右角 |

已按 32px 网格查看原图：第 0 行是顶沿，第 1 行是平面侧沿，第 2、3 行是正面岩壁。Upper/Lower 是同一岩壁连续的两段，不可互换或将一段拉伸两倍高。侧边和角保留原图透明像素。

这些坐标对应真实素材区域；重复中心列后接缝的美术效果仍需运行验收，不能仅凭坐标正确就认定无缝。若有明显纹理断口，仅在这片矩形平台内调整重复列或采用连续列循环，不变更边界生成逻辑。

### 9.3 修改 MapTypes.ts：只扩充 TileVisual

在现有枚举末尾添加第 9.2 节的 11 个名字，每个字符串值与名字相同，例如：

```ts
CliffTopLeft = 'CliffTopLeft',
CliffTop = 'CliffTop',
// 其余按表补齐
```

TerrainType 不新增 Cliff，TerrainMap 不变。悬崖是外部显示节点，不进入逻辑地形枚举。

### 9.4 修改 TerrainAtlas.ts：补充 ATLAS_CELLS

保持现有 10 个泥地/草地映射原样，在同一个表中追加：

```ts
[TileVisual.CliffTopLeft]: { column: 0, row: 0 },
[TileVisual.CliffTop]: { column: 4, row: 0 },
[TileVisual.CliffTopRight]: { column: 8, row: 0 },
[TileVisual.CliffLeft]: { column: 0, row: 1 },
[TileVisual.CliffRight]: { column: 8, row: 1 },
[TileVisual.CliffBottomLeftUpper]: { column: 0, row: 2 },
[TileVisual.CliffBottomUpper]: { column: 4, row: 2 },
[TileVisual.CliffBottomRightUpper]: { column: 8, row: 2 },
[TileVisual.CliffBottomLeftLower]: { column: 0, row: 3 },
[TileVisual.CliffBottomLower]: { column: 4, row: 3 },
[TileVisual.CliffBottomRightLower]: { column: 8, row: 3 },
```

getAtlasCell()、getAtlasRect()、图片 UUID、切片尺寸保持不变。Record<TileVisual, AtlasCell> 会在编译时要求新枚举的坐标齐全。

### 9.5 修改 MapRenderer.ts：复用已有节点创建过程

#### A. 抽取 createTile()，避免复制原 render() 中的 Sprite 设置

在同一个类中新增方法，不新建脚本：

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

这是将原有逐格渲染代码移入方法，行为不变。不添加按钮、碰撞器或输入监听。

#### B. 新增 renderCliffBoundary(columns, rows)

```ts
private renderCliffBoundary(columns: number, rows: number): void {
    const put = (visual: TileVisual, x: number, y: number): void => {
        this.createTile(visual, x, y, columns, rows, 'Cliff');
    };

    // 上沿：不包括角，角单独画一次。
    put(TileVisual.CliffTopLeft, -1, -1);
    for (let x = 0; x < columns; x += 1) {
        put(TileVisual.CliffTop, x, -1);
    }
    put(TileVisual.CliffTopRight, columns, -1);

    // 左右沿：只覆盖原地图的行。
    for (let y = 0; y < rows; y += 1) {
        put(TileVisual.CliffLeft, -1, y);
        put(TileVisual.CliffRight, columns, y);
    }

    // 正面岩壁：连续两行，包含各自左右角。
    put(TileVisual.CliffBottomLeftUpper, -1, rows);
    put(TileVisual.CliffBottomLeftLower, -1, rows + 1);
    for (let x = 0; x < columns; x += 1) {
        put(TileVisual.CliffBottomUpper, x, rows);
        put(TileVisual.CliffBottomLower, x, rows + 1);
    }
    put(TileVisual.CliffBottomRightUpper, columns, rows);
    put(TileVisual.CliffBottomRightLower, columns, rows + 1);
}
```

外部坐标可直接使用现有 gridCellToWorldCenter()：它只是位置换算，没有数组索引或边界截断。**传入的 columns/rows 始终是原地图尺寸**，不要改成 columns+2、rows+3，否则原地图与建筑会错位。

#### C. 修改 render(map)

```ts
public render(map: TerrainMap): void {
    this.clear();
    const rows = map.length;
    const columns = map[0]?.length ?? 0;
    if (rows === 0 || columns === 0) return;

    this.renderCliffBoundary(columns, rows);
    for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < columns; x += 1) {
            const visual = this.resolver.resolve(map, x, y);
            this.createTile(visual, x, y, columns, rows, 'Tile');
        }
    }
}
```

先画外沿，再画地表。它们在同一 TileRoot 内，使用同一 layer 和 SpriteFrame 缓存。格子不重叠，不需要引入额外排序系统。

#### D. clear() / getOrCreateFrame()

getOrCreateFrame() 保持现有方法不变，新 visual 自动走同一裁切缓存。

clear() 原来仅 removeAllChildren；本次会反复创建额外边界节点，改为销毁该 renderer 专用 TileRoot 下的旧瓦片，避免只脱离但不销毁：

```ts
public clear(): void {
    for (const child of [...this.tileRoot.children]) {
        child.removeFromParent();
        child.destroy();
    }
}
```

TileRoot 当前只承载地图瓦片；不要将其他交互节点放入其中。先脱离再销毁避免延迟销毁导致当帧重叠。普通重绘保留 frameCache，不在每次 clear 时销毁贴图。

### 9.6 本轮保持不变的 tile 调用

- MapResolver 仍只负责原地图内 Grass/Dirt 解析，不在它里面访问负坐标或返回 Cliff。
- MainMapController 原 new MapRenderer 与 render(STATIC_MAP) 调用不改。
- 原 STATIC_MAP 行列数不变，不能补 Cliff 到地图数组。
- GridTransform 不改，世界原点不移动。

### 9.7 验收

1. 原图为 W×H 时，外沿节点数是 3W+2H+6。当前 40×23 地图应新增 172 个 Cliff 节点，总瓦片节点 1092；四角不能重复。
2. 上方 y=-1、两侧 x=-1/W、下方 y=H/H+1 全部有对应方向素材，底部两行顺序正确。
3. 原 Tile_0_0、基地及建筑位置与修改前完全相同；外沿没有成为可建造/可行走格。
4. 平移和缩放地图，检查外沿随 MapRoot 一起移动；TileRoot 及父节点如有 Mask 导致外沿被裁切，先定位现有遮罩，不通过扩大逻辑地图修复。
5. 检查上下左右的重复接缝、四角与直边连接；岩壁没有上下倒置或非等比拉伸。底部之外的背景仍属于本次边界范围外。
6. 连续 render 两次，节点数量不翻倍；类型检查通过，无缺失的 TileVisual 映射。
