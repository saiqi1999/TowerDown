# TowerDown 地形换装、建筑美术统一与后续地表拼接方案 V1

基线：2026-09-23，origin/main `3dca3f5`。本文是待执行方案，不表示运行时代码或美术已经完成替换。

## 1. 本轮目标与分期

第一阶段：用新推送的 `assets/art/terrain/terrain2.png` 制作可验证的地形换装；锁定建筑视角、像素密度、光线和地面模板。先支持泥地、绿地、石铺地三种外观，同类地面连续。第二阶段：建筑地面与建筑主体分离，补齐交界素材，再以局部约束求解选择过渡与装饰。不要把整张地图生成、寻路或建筑布局交给 WFC。

旧 hover 方案仍然有效，本方案不将其移入 deprecated。旧版贴边滚动禁用补丁此前未写入远端，当前代码仍有该行为；独立处理，不混入本次美术换装。

## 2. 已核实的代码与素材

- `TerrainAtlas.ts` 以 `GRID_SOURCE_SIZE=16` 切旧图，`getAtlasRect()` 从列行号计算裁切。新图 576×1120，sprite UUID 为 `0ca7c1ca-86e7-4aba-9a38-521cfec5c983@f9941`。仅替换 UUID 会读错区域。
- 新图包括高台顶面、悬崖侧壁、斜角、下方草地和石质地表。尺寸可被 32 整除不等于已经确认全部素材都按 32×32 独立切片；需要逐块标定并出接缝样张。
- `MapResolver.resolve()` 只查询上下左右 Dirt，返回九种泥地外观之一；不支持完整内角、孤岛、窄通道与 T 形连接。不可直接套用新图的所有转角。
- `MapRenderer.render()` 每格一个 Sprite，`getOrCreateFrame()` 按 rect 裁贴图，目前没有独立悬崖、地面装饰层。
- `MainMapController.loadAtlasSpriteFrame()` 加载主图，失败后尝试旧图；当前地图布局仍为静态地图，换层主要刷新资源与敌人。
- `TerrainType` 只有 Grass/Dirt；建筑摆放、泥地 idle 等逻辑依赖这个分类。石铺地本轮只作为视觉覆盖，不新增可行走规则。
- 新图 meta 当前 min/mag filter 为 linear，packable=true、trimType=auto。像素图换装需要同步核对导入设置。

## 3. 必须固定的美术规格

| 项目 | 统一规则 |
| --- | --- |
| 单格密度 | 32 原生像素对应一个逻辑格；2×2 建筑 64×64，主基地 4×4 建筑 128×128；禁止将 64 图放大冒充 128 图 |
| 镜头 | 正交投影，沿画面纵向看向建筑正面；视线与地面约 60°，屋顶为主要可见面，正面墙体次之；不展示明显左/右侧墙 |
| 朝向 | 门朝画面正下方，前檐水平，建筑在地面上的轴线与地图轴线平行；无菱形等距构图 |
| 光照 | 唯一光源来自左上，投影朝右下；短、硬边、少色阶；不烘焙 bloom 或 hover 提亮 |
| 描边 | 以 1 原生像素深色轮廓为主，细节简化；所有素材使用同一像素尺度 |
| 安全区 | 四边各 4 原生像素为地面连接带，主体、道具、阴影不侵入；64 和 128 均为 4px，保持地图像素尺度一致 |
| 地面相位 | 底纹基准周期 32px；地块原点对齐地图格点；64、128 均拼接同一母版 |
| 地面高度 | 建筑地块不画侧壁、立体底座、框线；悬崖侧壁只属于真实平台外沿 |

角度数字是生成约束，不是模型能够精确保证的参数。选择一张通过验收的建筑作固定视角参考，后续始终同时提供“视角参考图 + 地面母版”，不要每次仅凭文字重新猜测角度。

### 3.1 地面色板与母版

以下颜色来自新图实际像素采样，按用途整理；石铺地仍需选定完整平铺纹理后验收：

| 材质 | 主色 | 辅色 | 暗色 |
| --- | --- | --- | --- |
| 干燥泥地/高台顶面 | `#948E77` | `#AAA377` | `#8C7D63` |
| 绿地 | `#6E8C45` | `#7F9454` | `#8CA158`（亮色，非阴影色） |
| 石铺地 | `#7A695D` | `#856F4E` | `#70605C` |

仅限地面使用这些颜色，木材、金属、布料可有独立统一色板。泥地不得因建筑类型变成红土或深棕土。草地亮色不要大面积铺满。底部石质纹理不等同于规则矩形石板路，生成时统一称“低对比小块石铺地”。

制作并版本化 `ground_dirt_32`、`ground_grass_32`、`ground_paving_32` 三张母版，先检查自身左右、上下平铺连续，再生成 64 和 128 模板。母版待制，不把尚未验证的图集坐标作为正式配置。

**无缝的保证来自相同底图和边缘像素，不来自提示词。** 首阶段可以保留不透明建筑图，但采用锁定地面模板/编辑蒙版生成主体；若工具无法锁像素，导出后按模板合成连接带，验收边界。不能只在边缘加纯色框，否则会出现每隔两格一圈边线。只替换 4px 环不能修复内部材质突变，整块地面都必须遵守同一母版。

## 4. 第一阶段代码实施清单

### 4.1 `assets/scripts/map/TerrainAtlas.ts`

保留旧图配置，新增 `TerrainAtlasProfile`，包含 `id`、`spriteFrameUuid`、各 visual 的显式 `AtlasRect` 和 fallback profile。新增 `getTerrainAtlasProfile(id)`，将 `getAtlasRect(visual, profile)` 改成按 profile 查表。

原因：贴图和裁切坐标必须绑定，避免新图加载失败后拿新坐标裁旧图。不要修改全局 `GRID_SOURCE_SIZE`；它仍服务旧素材。新 terrain 源尺寸与世界渲染 32px 解耦，显式记录每个 rect 的真实尺寸。

第一批只登记验收过的平面泥地、草地及过渡；悬崖片暂不映射为 Dirt/Grass 边界。缺少兼容过渡时先保留完整旧 profile 做默认，新 profile 作为可切换试验，不能新旧图半套混用。

### 4.2 `assets/scripts/map/MainMapController.ts`

将 `loadAtlasSpriteFrame()` 改为 `loadTerrainAtlas()`，返回 `{ profile, spriteFrame }`；失败时成套加载旧 profile。初始化 `MapRenderer` 时同时传入二者。添加单一可配置 `TERRAIN_ATLAS_PROFILE_ID`，用于新旧对照，加载失败打印所用 profile 与原因。

原因：允许随时恢复旧外观，并保证资源加载和裁切同源。地图格子、队伍路径、建筑落点、拖动与资源逻辑不改变。

### 4.3 `assets/scripts/map/MapRenderer.ts`

构造函数增加 profile；`getOrCreateFrame()` 使用 profile 对应裁切，缓存键包含 profile id，或 renderer 生命周期固定 profile。新增 `validateAtlasRect()` 检查坐标非负、宽高大于零、未越界；校验失败应在创建地图前回退完整 profile，避免只渲染半张地图。

每格仍渲染 32×32。新图若使用 32 原生像素切片，则是 1:1；不通过全局缩放改变建筑或单位。首次接入以完整 atlas 纹理固定 rect 裁切，禁用此 atlas 的动态合图，避免固定坐标与合图后的纹理坐标混淆。

### 4.4 `assets/scripts/map/MapResolver.ts` / `MapTypes.ts`

首轮沿用逻辑 TerrainMap；不得把外观石铺地当作新的可建造判定。新增过渡之前先列出当前地图实际出现的邻接形态，再检查图集是否覆盖。要支持任意地形时新增 `getNeighborMask()`（含对角）和形态表；内角、窄条、孤岛不能靠九宫格算法凑合。

若现有素材缺少平面过渡，先补美术，不能拿悬崖代替。后续独立 `GroundAppearanceMap` 表达 Dirt/Grass/Paving 的显示，TerrainMap 继续负责游戏规则。

### 4.5 素材导入与切片交付

在 Creator 中将 terrain2 的 min/mag 调整为 nearest、mip none，固定整图范围且关闭自动裁透明边，禁用该图 packable。用编辑器生成正确 meta，避免手写错误枚举。

制作切片清单：每项列出用途、源 rect、边缘标签、是否完全不透明、示例拼接截图。正式切换默认 profile 前，至少提交：泥地 4×4、草地 4×4、直线交界、凸角、凹角、64 建筑相邻、128 基地邻接的样张。尺寸可整除不能替代这些验证。

## 5. 可直接使用的建筑提示词

用下面“固定前缀 + 单个建筑内容 + 固定结尾”。生成时上传已确认的视角参考建筑和对应地面模板。不要把整张含悬崖的图集作为唯一参考，否则模型容易给建筑加立体底座。

### 固定前缀

> 重新设计一张用于方格经营游戏的静态像素建筑地块。保留提供的建筑参考图的像素密度、木材质感、描边和有限色板。严格遵循提供的地面模板，不重新发明背景颜色或地面纹理。
>
> 正交俯视，视线与水平地面约 60 度，屋顶清晰可见、正面墙体较短，所有建筑正面朝画面正下方，主要入口位于下侧，前檐和门槛水平，建筑地面轴线与画布横纵轴平行。不要朝左下或右下，不要菱形等距透视，不使用透视消失点。与参考建筑保持同样的屋顶和墙面视觉比例。
>
> 左上方唯一光源，右下方短阴影，简洁硬边明暗、清晰像素块、以单像素深色轮廓为主。设施紧凑，主体和工作区覆盖大部分可用区域，但屋顶不能遮住识别功能的工作区。
>
> 整块方形画布铺满指定平面地面，四角也有地面，不留透明背景。四边向内 4 像素是地面连接带，只保留给定母版底纹，不放建筑、草丛、石头、道具、描边或阴影，不画环形边框。连接带与内部地面自然连续，所有实体完整且在连接带内侧。
>
> 不画人物、文字、数字、UI、网格、山脉、立体地块侧壁，不画动态效果或光晕。细节数量服从小尺寸可读性，不用密集噪点填满。

### 伐木小屋（64×64，泥地）

> 一块 2×2 格、64×64 原生像素的伐木生产场所。后半部是一座低矮木制小屋，门朝下；前半部露出劈柴木墩、斧头和两三根整齐原木，侧边为紧凑木材堆。不要用大树冠遮挡地面，不画延伸出画布的树。木棕色、淡黄色为主。地面使用干燥泥地模板，主色 #948E77、辅色 #AAA377、暗色 #8C7D63。视觉重点是木材处理和储存。

### 剑士兵营（64×64，泥地）

> 一块 2×2 格、64×64 原生像素的剑士兵营。后半部一座短屋顶木制营房，入口朝下；前半部留出训练场，左右布置清晰的直剑武器架、木盾和一个训练木桩。屋顶不遮住剑架。少量低饱和暗红布料作为识别色，不加入弓箭、马匹或士兵。使用与伐木场完全相同的干燥泥地模板与颜色：#948E77、#AAA377、#8C7D63。视觉重点是剑盾步兵训练。

### 铁匠铺（64×64，石铺地）

> 一块 2×2 格、64×64 原生像素的铁匠生产场所。后半部是木梁和暗色短屋顶的半开放工棚，正面朝下；前半部是醒目的铁砧、锤子与少量金属坯料，一侧安排小型石炉。炉口可有少量固定暖橙色像素，不发光、不照亮周边、不冒烟。使用指定低对比小块石铺地模板：#7A695D、#856F4E、#70605C；外圈不能堆煤或增加焦黑边。视觉重点是锻造工作台。

### 仓库（64×64，泥地）

> 一块 2×2 格、64×64 原生像素的仓储场所。后半部为宽门木制仓房，门口朝下；前半部露出短装卸平台，左右紧凑排列木箱、木桶和扎口麻袋，中间保留搬运通道。不要画围墙把地块围成孤立岛屿。使用与伐木场完全相同的干燥泥地模板与颜色：#948E77、#AAA377、#8C7D63。视觉重点是大量有序存放的物资。

### 主基地（128×128，石铺地）

> 一块 4×4 格、128×128 原生像素的城镇中心，使用与 64×64 建筑相同的像素密度和描边厚度，不把小图直接放大。后半部为主要木制大厅，入口朝下；前半部是广场和两侧小型附属设施，旗帜、工具架与物资架紧凑分布，保持明确中央入口。允许火把有少量静态橙色火焰像素，但不画泛光。使用与铁匠铺相同的石铺地母版：#7A695D、#856F4E、#70605C；连接带仍为 4 原生像素。主要大厅清楚大于附属设施，整体辨识为基地。

### 固定结尾

> 精确输出指定像素尺寸，单张静态图片。底纹重复相位、画布边缘颜色与提供的地面模板完全一致，不自动增加地块外轮廓、阴影底座或装饰边框。同类地面必须能够上下左右连续拼接。若文字与模板冲突，以模板的边缘像素、地面色板和参考建筑视角为准。

这些是生成目标，不能当作输出合格证明。导出后必须核对实际尺寸、色板、接缝及参考角度；生成器不保证严格 RGB 或像素锁定。

## 6. 后续精修：独立地表、过渡变体与 WFC

### 6.1 分层与迁移

先移除建筑图外围 4px 的烘焙地面，改为透明，露出地图统一底纹；这是迁移措施。最终应把整块背景地面与建筑主体分离，保留建筑、道具、接触阴影为前景，石铺地需求以独立 footprint 外观数据表达。不要通过按颜色抠图误删木材/墙体；使用人工或生成时提供的蒙版。建筑 hover 缩放、提亮只作用前景，地面不能跟着缩放露缝。

绘制层次：基础地面 → 地表过渡和贴花 → 建筑/单位；悬崖层需单独根据真实高台轮廓与排序规则建立。高台边缘与平面材质交界是两套邻接规则。

### 6.2 先有可完备的边缘规则，再使用 WFC

地块边和角标记材质类型，准备直边、外角、内角、端点等过渡，以及少量碎石、草簇、磨损变体。同一朝向每种过渡至少一个保底无装饰版本。美术可用 Tiled Terrain/Wang Set 核对连接标签。

首版自动拼接采用确定性的邻接掩码就足够。WFC 的价值是：在边界已经正确的前提下，选择兼容变体并约束装饰密度，降低重复感；它不能补出不存在的角块，也不能修复不一致的光照和调色。

### 6.3 建议模块与方法（本阶段不实现）

- `GroundAppearanceResolver.buildAppearanceMap(terrain, buildings)`：将规则地形和建筑地面覆盖映射为外观材质；处理重叠优先级，输出只读外观网格，不修改寻路数据。
- `GroundTransitionResolver.getCandidates(cell, neighbors)`：依据边/角材质筛选合法过渡；没有候选时标记素材缺口并选定确定性兜底，不能继续无限随机。
- `GroundVariantSolver.solve(region, seed, boundary)`：最小熵选格、带权选择、邻接传播、有限回溯。只在需要美术变化的局部区域运行；矛盾或预算耗尽使用无装饰确定性结果。
- `GroundDecorationRenderer.render(cells)`：仅创建视觉节点；装饰不能挡住门口、交互识别或暗示不存在的障碍。
- 地图初始化时求解一次。建筑重摆时仅重算旧/新 footprint 周边，锁定区域外边界；局部无解允许有限扩大区域，之后回退。hover、镜头移动不触发求解。缓存 seed 与结果，避免相同位置反复闪换。

变体不能任意旋转/镜像带光照的石块和阴影；需要分别绘制朝向或只旋转无方向性的地面纹理。装饰数量设置预算，防止“精细化”等同于信息噪声。

## 7. 验收与提交顺序

1. 提交切片坐标与地面母版、拼接样张；缺失过渡明确列出，不能假称图集完整。
2. 提交 profile 加载和渲染适配，开关对照旧版。实际启动 Creator 检查采样、透明边、缩放和纹理回退。
3. 用统一模板更新建筑素材，64/128 按相同像素密度生成。检查同材质连排、2×2 与 4×4 相邻、不同材质相邻。
4. 回归资源交互、基地入口、建筑拖动占地、泥地 idle 和寻路；外观变化不能改变这些结果。
5. 后续单独提交主体/地面分层、完整过渡表；最后才提交局部 WFC。

最有价值的自动校验：atlas rect 越界、所有实际邻接形态有候选、同模板重复平铺边缘、WFC 固定 seed 可复现且必能在预算内回退。角度、可读性、悬崖排序仍需运行画面验收。

## 8. 参考

- Tiled Terrain Sets：https://docs.mapeditor.org/en/latest/manual/terrain/ （边、角、混合型地形标签）
- Tiled Automapping：https://docs.mapeditor.org/en/latest/manual/automapping/ （规则驱动的地形装饰）
- WaveFunctionCollapse 原项目：https://github.com/mxgmn/WaveFunctionCollapse （候选、传播与约束矛盾）

## 9. 可执行技术细案：将当前瓦片管线切换到 terrain2

本节于 2026-09-23 基于远端 `c44bde1` 重新核对。**本节替代第 4 节中尚未确定的首版实施选择**；第 3、5、6 节仍分别作为美术规范、提示词和后续扩展。第一阶段必须实际默认显示新图，而不是仅增加配置但继续显示旧图。

### 9.1 确定交付边界

首版从 terrain2 中裁出两块完全不透明的平面纹理，显示现有 Dirt/Grass 地图。旧九宫格边缘在新 profile 下统一映射为新泥地中心，形成方格硬边交界。这是明确的阶段效果：已经换用新图，但不宣称已完成自然地表过渡或无缝美术验收。连续纹理是否存在视觉重复还要看拼接画面。

不在这一提交中展示悬崖：当前 Dirt/Grass 边界不是高度或不可通行边界，把悬崖画在那里会让部队看起来穿过峭壁。完整高台地形需要独立的高度/边界设计，属于下一阶段。

### 9.2 精确裁切数据

源 PNG 坐标原点为左上，x 向右、y 向下；rect 为左闭右开。

| 新 visual 实际取图 | x | y | width | height | 用途 |
| --- | --- | --- | --- | --- | --- |
| Grass | 80 | 1040 | 32 | 32 | 底部中间草坪的内部区域 |
| 全部 Dirt visual | 32 | 16 | 32 | 32 | 顶部左侧高台的纯顶面区域，不包含崖沿和侧壁 |

已经用实际 PNG 核对以上两块 alpha 全部为 255。泥地切片含 `#948E77/#929581/#8C7D63`，草地含 `#6E8C45/#7F9454`。这证明它们可填满格子，不证明它们已经通过美术连续性验收。禁止使用 `(32,1056,32,32)` 作为草地：那里是透明区域。

### 9.3 文件改动总表

| 文件 | 操作 | 方法/声明 |
| --- | --- | --- |
| `assets/scripts/map/TerrainAtlas.ts` | 修改 | 新增 profile 类型、配置、加载顺序；替换 `getAtlasRect()`，删除 `getAtlasCell()` 等旧导出 |
| `assets/scripts/map/MapRenderer.ts` | 修改 | constructor、getOrCreateFrame、clear；新增 destroy；render 主循环不变 |
| `assets/scripts/map/MainMapController.ts` | 修改 | bootstrap、loadAtlasSpriteFrame（改名）、onDestroy；新增单资源加载和校验方法 |
| `assets/art/terrain/terrain2.png.meta` | 修改 | nearest、禁用 packable、关闭自动裁边；保留 UUID |
| `assets/scripts/map/MapResolver.ts` | 保留 | resolve/isDirt 无改动 |
| `assets/scripts/map/MapTypes.ts` | 保留 | TerrainType/TileVisual/TerrainMap 无改动 |
| `assets/scripts/grid/GridConfig.ts` | 保留 | 源 16、倍率 2、世界格 32 无改动 |
| `tests/terrain-atlas.cjs` | 新增 | profile 覆盖、裁切范围与 resolver 输出兼容测试，沿用项目已有 CJS 测试风格 |

所有改动过的旧符号都要全仓搜索清理；不要同时保留两套决定“当前图集”的全局常量。新增 TS 文件须满足根目录 AGENTS.md 的文件头要求；本方案不需要新增 TS 模块。

### 9.4 `TerrainAtlas.ts`：统一图集配置入口

保留 `AtlasRect`，删除 `AtlasCell`、`ATLAS_TILE_SIZE`、`TILE_RENDER_SIZE`、`ATLAS_CELLS`、`getAtlasCell()`，以及两个裸 UUID 导出。当前这些导出没有其他独立使用者，旧 `getAtlasRect()` 只被 MapRenderer 调用。

新增如下类型和方法，profile id 使用有限联合类型避免拼写错误：

```ts
export type TerrainAtlasProfileId = 'terrain2-flat' | 'legacy' | 'legacy-fallback';
export interface TerrainAtlasProfile {
    readonly id: TerrainAtlasProfileId;
    readonly spriteFrameUuid: string;
    readonly rects: Readonly<Record<TileVisual, Readonly<AtlasRect>>>;
}

export const DEFAULT_TERRAIN_ATLAS_PROFILE_ID: TerrainAtlasProfileId = 'terrain2-flat';

export function getTerrainAtlasProfile(id: TerrainAtlasProfileId): TerrainAtlasProfile;
export function getTerrainAtlasLoadOrder(
    preferredId: TerrainAtlasProfileId,
): readonly TerrainAtlasProfile[];
export function getAtlasRect(
    profile: TerrainAtlasProfile,
    visual: TileVisual,
): Readonly<AtlasRect>;
```

`getTerrainAtlasProfile()` 从模块内部 `PROFILES` 取配置；`getAtlasRect()` 直接返回 `profile.rects[visual]`，缺项抛包含 profile id 与 visual 的异常，禁止隐式取旧图坐标。

`getTerrainAtlasLoadOrder()` 的明确规则：terrain2-flat → legacy → legacy-fallback；选择 legacy 时只走 legacy → legacy-fallback；选择 legacy-fallback 时只加载自身。方便对照旧外观，也避免回退循环。

新 profile 的 rects 必须显式覆盖所有十个 TileVisual：

```ts
const dirt32 = { x: 32, y: 16, width: 32, height: 32 } as const;
const terrain2Rects: Record<TileVisual, Readonly<AtlasRect>> = {
    [TileVisual.Grass]: { x: 80, y: 1040, width: 32, height: 32 },
    [TileVisual.DirtCenter]: dirt32,
    [TileVisual.DirtTop]: dirt32,
    [TileVisual.DirtBottom]: dirt32,
    [TileVisual.DirtLeft]: dirt32,
    [TileVisual.DirtRight]: dirt32,
    [TileVisual.DirtTopLeft]: dirt32,
    [TileVisual.DirtTopRight]: dirt32,
    [TileVisual.DirtBottomLeft]: dirt32,
    [TileVisual.DirtBottomRight]: dirt32,
};
```

新 profile UUID：`0ca7c1ca-86e7-4aba-9a38-521cfec5c983@f9941`。legacy UUID：`d7fe297d-ca47-49aa-93d4-0c947fdf5ebc@f9941`。legacy-fallback UUID：`165f2715-1733-4ccf-94bc-6cc30740bac2@f9941`。

两套 legacy 保持原来的 16px 表：Grass=(48,176,16,16)；泥地九宫格 x=0/16/32、y=112/128/144，与原枚举位置对应。可以共享 readonly rects，因为原加载器就是同坐标回退；最终应启动验证备用图仍能正确显示。

### 9.5 `MainMapController.ts`：加载结果必须携带 profile

替换 TerrainAtlas import，导入 `DEFAULT_TERRAIN_ATLAS_PROFILE_ID`、`getTerrainAtlasLoadOrder`、`TerrainAtlasProfile`；已有 SpriteFrame、assetManager import 继续使用。新增文件内接口：

```ts
interface LoadedTerrainAtlas {
    readonly profile: TerrainAtlasProfile;
    readonly spriteFrame: SpriteFrame;
}
```

**删除旧 `loadAtlasSpriteFrame()`，新增三个方法：**

1. `loadTerrainSpriteFrame(uuid: string): Promise<SpriteFrame>`：只将 `assetManager.loadAny<SpriteFrame>()` 包装成 Promise，不负责决定 fallback。不成功则 reject，包括 error 为空但 asset 为空的情况。
2. `validateTerrainAtlas(profile, frame): void`：遍历 `Object.values(TileVisual)`，验证所有 rect 为整数、非负起点、正宽高，且不越过 frame.texture.width/height；检查 frame.texture 有效。terrain2-flat 额外检查原纹理尺寸为 576×1120。校验全图 frame 未旋转、rect 原点为 0、范围为全纹理，防止裁图或动态合图使坐标失效。失败 throw 带 profile id 的 Error。需从 MapTypes 导入 TileVisual。
3. `loadTerrainAtlas(): Promise<LoadedTerrainAtlas>`：依次尝试完整 profile；加载成功且校验通过才返回；某项失败继续下一 profile 并 warn；全部失败抛错，不能挂起 Promise。

参考主体：

```ts
private async loadTerrainAtlas(): Promise<LoadedTerrainAtlas> {
    const profiles = getTerrainAtlasLoadOrder(DEFAULT_TERRAIN_ATLAS_PROFILE_ID);
    const failures: string[] = [];
    for (const profile of profiles) {
        try {
            const spriteFrame = await this.loadTerrainSpriteFrame(profile.spriteFrameUuid);
            this.validateTerrainAtlas(profile, spriteFrame);
            console.info(`[TerrainAtlas] active=${profile.id}`);
            return { profile, spriteFrame };
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            failures.push(`${profile.id}: ${reason}`);
            console.warn(`[TerrainAtlas] ${profile.id} failed: ${reason}`);
        }
    }
    throw new Error(`[TerrainAtlas] All profiles failed: ${failures.join('; ')}`);
}
```

**修改 `bootstrap()` 两处：**

```ts
// 原：const atlasSpriteFrame = await this.loadAtlasSpriteFrame();
const terrainAtlas = await this.loadTerrainAtlas();
// 异步加载后若当前组件/节点已经销毁，停止后续初始化；
// 使用本项目 cc.isValid(this.node) 检查并正确导入 isValid。

// 原：new MapRenderer(tileRoot, atlasSpriteFrame)
this.mapRenderer = new MapRenderer(
    tileRoot, terrainAtlas.spriteFrame, terrainAtlas.profile,
);
this.mapRenderer.render(STATIC_MAP);
```

bootstrap 后面还有其他 await；在最终创建场景节点之前也检查 isValid，不能只在第一次 await 后检查。沿用项目已有 start/bootstrap 错误处理风格，但要确保最终加载失败能打印，不能吞掉异常。不要在 load 方法内写 this.mapRenderer 或更改游戏状态。

**修改 `onDestroy()`：** 在现有 baseInteraction 清理后追加 `this.mapRenderer?.destroy(); this.mapRenderer = null;`。渲染器只释放自己创建的切片和节点，不释放 assetManager 的共享整图。

### 9.6 `MapRenderer.ts`：从注入 profile 取切片

导入 TerrainAtlasProfile；删除对任何裸图集 UUID 的依赖（当前没有，保持这一边界）。

**constructor** 增加第三个只读参数 `private readonly atlasProfile: TerrainAtlasProfile`。一个 renderer 的生命周期内只使用一套 profile，切换 profile 时销毁旧 renderer、重新创建；这样原 `Map<TileVisual, SpriteFrame>` 缓存仍正确，不需要另一套全局缓存。

**getOrCreateFrame(visual)** 唯一裁切来源改为：

```ts
const rect = getAtlasRect(this.atlasProfile, visual);
const frame = new SpriteFrame();
frame.texture = this.atlasSpriteFrame.texture;
frame.rect = new Rect(rect.x, rect.y, rect.width, rect.height);
frame.originalSize = new Size(rect.width, rect.height);
frame.offset = new Vec2(0, 0);
frame.rotated = false;
frame.packable = false;
this.frameCache.set(visual, frame);
```

其余缓存命中逻辑不变。禁止在这里根据 Grass/Dirt 再硬编码一次坐标；新增过渡只修改 profile 表。

**render(map)** 保留原 `resolver.resolve()`、`gridCellToWorldCenter()`、节点 layer、Sprite CUSTOM、UITransform 大小 `GRID_RENDER_SIZE`。新切片 32→32，旧切片 16→32；不能把世界格扩大一倍，不能把地图高度偏移一半。没有新装饰层或悬崖层需求，不新增场景节点层级。

**clear()** 当前只 removeAllChildren，会脱离节点但不销毁。修改为仅销毁本 renderer 创建并记录的 tile 节点：新增 `private readonly tileNodes: Node[] = []`；render 创建节点后 push；clear 遍历时先从父节点移除、再 destroy，最后清空数组。避免延迟销毁导致本帧重绘同时显示两套格子，也不误删 TileRoot 未来的其他子节点。

**新增 destroy(): void**：调用 clear；对 frameCache 中每个运行时创建的 SpriteFrame 调用 destroy；clear cache。方法可重复调用。不要 destroy `atlasSpriteFrame` 或 texture，它们是共享资源。

### 9.7 不改动的业务接口与原因

- `MapResolver.resolve(map,x,y)` 仍返回现有 TileVisual。它判断逻辑地形邻接；profile 决定每种邻接怎么画，两者职责分开。
- `TerrainType.Dirt` 不重命名为 Cliff/Paving；地面外观不参与资源收益、建筑 allowedTerrain 或 idle 目标筛选。
- `GRID_SOURCE_SIZE=16` 不改；本轮只移除 TerrainAtlas 对它的依赖。全局世界格仍为 32，建筑 64=2×2、128=4×4，单位位置、拖动幽灵、鼠标投影均不改。
- `StaticMap.ts` 不改布局；楼层过渡控制器无需重新创建 terrain renderer。当前换层使用相同地形，仅刷新对象。
- 建筑自身已经烘焙的地板不会随本补丁自动变色；不要在地形渲染器中篡改建筑图。按本文美术模板后续替换。

### 9.8 导入设置与资源生命周期

在 Creator 3.8.8 导入设置中将 terrain2 minfilter/magfilter 改 nearest、mipfilter 保持 none；spriteFrame 关闭 packable，保持整图 rect 和无旋转，关闭自动裁透明边。保存编辑器产出的 meta，保留图片 UUID 和两个子资源 UUID。不要修改图片尺寸或重新导入生成新 UUID。

运行时生成的切片也必须 `packable=false`；只改源 spriteFrame 不足以说明所有派生 frame 都不会合图。旧图回退仍按原采样设置显示，如需要把旧图也禁用自动合图，应单独注明 meta 变更目的。

### 9.9 验证步骤与明确失败标准

**静态检查：**

```sh
rg -n 'loadAtlasSpriteFrame|TERRAIN_SPRITE_FRAME_UUID|TERRAIN_SPRITE_FRAME_FALLBACK_UUID|ATLAS_TILE_SIZE|TILE_RENDER_SIZE|getAtlasCell' assets/scripts
rg -n 'getAtlasRect|new MapRenderer|loadTerrainAtlas' assets/scripts
```

第一条在生产脚本应无结果；第二条应只有统一实现及对应调用。通过项目 TypeScript 检查；不能仅靠文本替换判断编译正确。

**自动测试 `tests/terrain-atlas.cjs`：** 参考现有 `tests/building-relocation.cjs` 的 TS 转译方式。测试所有 profile 覆盖十个 visual，两个新 rect 精确匹配本方案，legacy 坐标未变，fallback 顺序正确。对 STATIC_MAP 每格运行真实 resolver，输出必能在所选 profile 中找到 rect。尺寸/越界校验应覆盖负坐标、缺项、贴图过小。若校验仍为 controller 私有方法，这些错误路径通过实际加载验证，不为了测试复制一份实现。

**Creator 实机：**

1. 正常启动日志 active=terrain2-flat；Grass 为新草地，Dirt 为浅灰褐顶面；无旧九宫格边线、透明洞、崖壁或黑块。
2. 检查地图左上/右下坐标与建筑格点对齐，基地仍 4×4，兵营等仍 2×2；鼠标点选/拖动落点一致。
3. 测试单位穿越两种地表、泥地 idle 和绕建筑寻路；游戏行为与改图前相同。
4. 临时在开发配置使用无效新 UUID：应落到 legacy，且使用旧 rect，不能仍以 32px 裁旧图；测试结束还原。
5. 临时给新 rect 设置越界：加载校验应拦截并回退，不能渲染半张地图；全部 UUID 无效时应明确报错。
6. 同 renderer 连续 render 两次，节点数量等于地图格数，无重复显示；退出场景后切片释放，无访问已销毁节点的异常。
7. 1×、2×和常用镜头缩放检查最近邻采样；非整数镜头缩放可能有像素粗细变化，不应误诊为线性采样。

**完成定义：** 新图为默认、回退成套正确、无悬空旧接口、玩法格子完全一致、通过上述运行验证。此时可交付“新图平面换装”，不能写成“完整悬崖自动拼接已经完成”。

### 9.10 后续升级接口约束

补齐自然过渡后只扩展新 profile 的 rects；若实际需要比十种 TileVisual 更多的内角/孤岛，再一次性扩展 MapTypes、MapResolver 与所有 profile（包括旧图的明确降级映射）。不得只扩展 enum 导致回退缺项。WFC、地面独立层和悬崖渲染继续按第 6 节单独实现，不加进这次最小换装提交。
