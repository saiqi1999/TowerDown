# TowerDown：替换 terrain2 瓦片的最小修改方案

本方案完整替代本文旧内容。仅修改现有文件中的瓦片图片引用、切片尺寸与坐标，以及对应加载失败处理；不新增、删除或移动任何文件。

## 1. 修改 assets/scripts/map/TerrainAtlas.ts

保持 AtlasCell、AtlasRect、getAtlasCell()、getAtlasRect() 的接口与调用方式不变。

### 1.1 图片引用和切片大小

将导入改为：

```ts
import { GRID_RENDER_SIZE } from '../grid/GridConfig';
```

修改两个现有常量：

```ts
export const ATLAS_TILE_SIZE = 32;
export const TERRAIN_SPRITE_FRAME_UUID =
    '0ca7c1ca-86e7-4aba-9a38-521cfec5c983@f9941';
```

TILE_RENDER_SIZE 继续使用 GRID_RENDER_SIZE。新图以 32×32 源像素裁切，每格仍显示为原来的 32×32 世界尺寸。不要改 GridConfig。

删除本文件中旧的 TERRAIN_SPRITE_FRAME_FALLBACK_UUID 常量：旧图不能使用新图的裁切坐标。对应加载引用一并按第 2 节调整，不增加新的图集配置系统。

### 1.2 替换 ATLAS_CELLS

下列坐标按原图左上为原点，column/row 从 0 开始：

```ts
const ATLAS_CELLS: Record<TileVisual, AtlasCell> = {
    [TileVisual.Grass]: { column: 3, row: 33 },
    [TileVisual.DirtTopLeft]: { column: 1, row: 1 },
    [TileVisual.DirtTop]: { column: 1, row: 1 },
    [TileVisual.DirtTopRight]: { column: 1, row: 1 },
    [TileVisual.DirtLeft]: { column: 1, row: 1 },
    [TileVisual.DirtCenter]: { column: 1, row: 1 },
    [TileVisual.DirtRight]: { column: 1, row: 1 },
    [TileVisual.DirtBottomLeft]: { column: 1, row: 1 },
    [TileVisual.DirtBottom]: { column: 1, row: 1 },
    [TileVisual.DirtBottomRight]: { column: 1, row: 1 },
};
```

对应源图片区域：

| 类型 | x | y | width | height |
| --- | --- | --- | --- | --- |
| 草地 | 96 | 1056 | 32 | 32 |
| 泥地 | 32 | 32 | 32 | 32 |

已检查仓库 terrain2.png：两块区域 alpha 全为 255，分别为纯草地内部和高台平面顶面，不包含透明空洞、崖沿或侧壁。

**本表的实际效果是平面草地与泥地硬边拼接。** 九种泥地外观暂时共用同一切片，因此不会保留旧图的泥地边缘花纹，也不包含悬崖。这是本次最小换图的明确显示范围，不能描述成已完成新图所有边角的映射。

### 1.3 两个方法保持原样

getAtlasCell(visual) 继续读取 ATLAS_CELLS。

getAtlasRect(visual) 继续使用原公式，无须修改方法：

```ts
return {
    x: cell.column * ATLAS_TILE_SIZE,
    y: cell.row * ATLAS_TILE_SIZE,
    width: ATLAS_TILE_SIZE,
    height: ATLAS_TILE_SIZE,
};
```

因此 MapRenderer 不需要调整参数或调用代码。

## 2. 修改 assets/scripts/map/MainMapController.ts

只修改瓦片 import 和已有 loadAtlasSpriteFrame()。bootstrap() 中原来的调用和 new MapRenderer(tileRoot, atlasSpriteFrame) 均保持原样。

将 TerrainAtlas 的导入改为只导入 TERRAIN_SPRITE_FRAME_UUID。

loadAtlasSpriteFrame() 保留原方法名、参数与返回类型，移除使用旧图片的回退分支：

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

原因仅是保证图片与切片坐标一致。加载失败直接报错，不拿新坐标裁旧图片；不新增加载类、profile 或初始化流程。

## 3. 修改 assets/art/terrain/terrain2.png.meta

使用仓库已有 terrain2.png，不复制、不重命名图片。

仅调整与瓦片采样相关的导入设置：

- texture 的 minfilter、magfilter：linear 改为 nearest。
- mipfilter 保持 none。
- sprite-frame 的 packable 改为 false，保持固定整图坐标。
- 保持 UUID、576×1120 尺寸、原点、无旋转；在 Creator 内确认整图裁切，避免自动裁透明边改变坐标基准。

由 Creator 保存需要更新的导入字段，不重建 UUID。

## 4. 换图验收

1. 启动后，草地显示新草纹，泥地显示浅灰褐色顶面，没有透明洞、黑块或误裁的崖壁。
2. 每格仍为 32×32，贴图位置与现有地图格点一致。
3. 新图正常加载；不存在旧 FALLBACK_UUID 引用。
4. 检查草地、泥地各自连续排列及相互交界，接受本次明确的硬边效果。
5. 本次实施仅修改上述三个现有文件；不改 MapRenderer、MapResolver、MapTypes 和 GridConfig，不新增测试文件或其他模块。

本次文档更新不代表上述代码已经执行。
