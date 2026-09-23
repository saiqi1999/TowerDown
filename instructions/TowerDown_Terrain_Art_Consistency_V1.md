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
