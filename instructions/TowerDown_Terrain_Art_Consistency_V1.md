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
    [TileVisual.DirtTopLeft]: { column: 0, row: 31 },
    [TileVisual.DirtTop]: { column: 0, row: 31 },
    [TileVisual.DirtTopRight]: { column: 0, row: 31 },
    [TileVisual.DirtLeft]: { column: 0, row: 31 },
    [TileVisual.DirtCenter]: { column: 0, row: 31 },
    [TileVisual.DirtRight]: { column: 0, row: 31 },
    [TileVisual.DirtBottomLeft]: { column: 0, row: 31 },
    [TileVisual.DirtBottom]: { column: 0, row: 31 },
    [TileVisual.DirtBottomRight]: { column: 0, row: 31 },
};
```

对应源图片区域：

| 类型 | x | y | width | height |
| --- | --- | --- | --- | --- |
| 草地 | 96 | 1056 | 32 | 32 |
| 泥地（底部棕色地面） | 0 | 992 | 32 | 32 |

取图限定在图片底部平面地表区，不使用顶部高台。Grass=(3,33) 是底部草坪内部；DirtCenter=(0,31) 是底部棕色地面。像素原点均从整张 PNG 左上计算，不是从底部素材区重新计数。

**边角素材限制：** 底部中间图案是棕色地面包围绿色草坪。其左上、上边、右上等切片是草坪向棕色地面过渡，不是棕色泥地向草地过渡。现有 MapResolver 是在 Dirt 格子上选择 DirtTop/Left 等，直接将这些草坪边角填入 Dirt 枚举会造成材质内外反转。

因此，上表只有 Grass 和 DirtCenter 是对应材质的正式取图；八种 Dirt 边角共用 (0,31) 是明确的纯地面回退，不代表它们在素材中具有独立匹配块。当前保持解析逻辑不变的换图仍为硬边。不能把此表称为完整边角替换。要保留自然泥地边缘，需要提供方向匹配的泥地边角素材；不能仅靠重新填写坐标解决。

供核对的底部草坪切片如下（仅解释图集，不写入 Dirt 的映射）：

| 草坪外观 | column | row | 像素 x,y |
| --- | --- | --- | --- |
| 上左角 | 2 | 31 | 64,992 |
| 上边 | 3 | 31 | 96,992 |
| 上右角 | 4 | 31 | 128,992 |
| 左边 | 2 | 32 | 64,1024 |
| 中心 | 3 | 32 | 96,1024 |
| 右边 | 4 | 32 | 128,1024 |
| 下左角 | 2 | 34 | 64,1088 |
| 下边 | 3 | 34 | 96,1088 |
| 下右角 | 4 | 34 | 128,1088 |

原草坪图案高四格，row=33 是另一行中段；不能直接把它误作下边。列 0～1 的 row=33 区域透明，也不能取作地面。

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

1. 启动后，草地显示新草纹，泥地显示底部棕色地面，没有透明洞、黑块或误裁的崖壁。
2. 每格仍为 32×32，贴图位置与现有地图格点一致。
3. 新图正常加载；不存在旧 FALLBACK_UUID 引用。
4. 检查草地、泥地各自连续排列及相互交界，接受本次明确的硬边效果。
5. 本次实施仅修改上述三个现有文件；不改 MapRenderer、MapResolver、MapTypes 和 GridConfig，不新增测试文件或其他模块。

本次文档更新不代表上述代码已经执行。
