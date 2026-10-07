# TowerDown：十二固定建筑位与木城墙技术方案 V1

> 状态：待实施的技术方案；本次提交只写文档，不修改游戏代码、GDD或数值。
> 代码基线：main 2f4ad84（2026-10-07）。图片提交为2f4ad84、225c9a2、db06f65；严格最近三次提交中4eb0991是GDD更新，并非图片提交。
> 本轮覆盖：中央基地保持4×4，外围12个2×2固定建筑位、1格厚木城墙和四个常开通道。继续从下方蓝图进入建造模式。
> 不做防御塔位、点击加号建设菜单、城墙生命/攻击/维修、宝箱运输、经济结算重构或新兵种。空地图片上的加号只是视觉，不注册点击事件。

## 1. 已核对的代码与图片

### 1.1 现状与需要修复的连接点

- StaticWorldObjects.ts：base_main锚点(18,10)；WorldAtlasConfig.ts定义基地4×4。
- StaticMap.ts：40×23，现有泥地是较大的不规则区域，不是10×10城市边界。
- BuildingCatalog.ts：当前四种建筑均2×2、blocksNavigation:true。
- BuildingPlacementValidator.validate()：只检查泥地、占用、费用、队伍限制；任意泥地均能造。validateRelocation()另行检查allowedTerrain，还未统一固定槽位。
- BuildingPlacementTool.refreshPointer()将指针格直接作为建筑左上角；拖移refresh()使用鼠标格减grabOffset，也不认识槽位。
- MainMapController.bootstrap()和换层commit回调分别构造WorldCellGrid、NavigationGrid；只修首层会在换层丢掉墙体约束。
- PrimitiveRunState.registerBarracksPlacement()的出生参考点为(19,14)/(21,14)，不是动态查找营地下方；本轮不顺便重做兵营出生规则。
- SquadRenderer.createSquad()做基地下方偏移；换层恢复又自行算点，需检查新增城墙后是否落墙。
- MapRenderer已经绘制世界外缘悬崖。城市围墙是内层实体，不替换悬崖，也不改TerrainAtlas坐标。

### 1.2 实图核验与导入ID

以下都是独立PNG，不是新atlas；使用导入的SpriteFrame，不再猜column/row。所有图都有铺满画布的棕色背景，不能假定透明。

| 文件（assets/art/buildings/） | 尺寸 | SpriteFrame UUID | 实图用途判断 |
|---|---|---|---|
| empty land.png | 64×64 | c6dbcda9-95cc-47c6-9186-9ee0b0c38369@f9941 | 土地中央带白色加号；整个槽位提示 |
| woodwall1.png | 32×32 | 6b12cb8a-61dc-47cc-b7e5-fe3fa662e31a@f9941 | 横向连续墙段 |
| woodwall2png.png | 32×32 | 243e3b12-a088-4cae-b457-656068ebf2b2@f9941 | 连向上方与右方的转角 |
| woodwall3.png | 32×32 | 968bdc66-9e3a-449a-9bcc-1edd1c8ad3ba@f9941 | 纵向连续墙段 |
| woodwall4.png | 32×32 | f296672d-0a2b-44c4-b516-976e3b20ce38@f9941 | 连向下方与右方的转角 |
| woodwalldoor1.png | 32×32 | 48ca0e37-5ea5-4b17-85f3-2c284dc0649e@f9941 | 纵墙上侧终止段，向下留缺口 |
| woodwalldoor2.png | 32×32 | b9f0fc4d-5758-4958-ab00-617b6bd736b1@f9941 | 纵墙下侧起始段，向上留缺口 |
| woodwalldoor3.png | 32×32 | d2e6918d-bb36-4e2c-81ce-68d7906889b4@f9941 | 横墙左侧终止段，向右留缺口 |

保留woodwall2png.png的现有拼写及空格文件名，不重命名资源、不重生成UUID。新增图片的texture subMeta目前使用linear，实施时这8个.meta的minfilter、magfilter改nearest，mipfilter保持none；通过Creator导入设置修改并保留其他字段。

这些是本方案对图片的拼接解释，不是作者提供的方向标记。没有独立背面墙图：南北暂复用横墙，东西以水平镜像复用，不做90度旋转或上下翻转。先按下表拼预览检查接缝；若背面透视不能接受，后续补图，不擅自声称已有完整四向美术。

## 2. 单一布局坐标

地图坐标x向右、y向下，均为0起点。保持基地(18,10)不变，因此城市左上角为(15,7)，范围x=15..24、y=7..16（10×10）。内部为x=16..23、y=8..15。中央基地x=18..21、y=10..13。

槽位每2格一个锚点，排除中间四块：

| 行 | 槽位ID与左上角 |
|---|---|
| y=8 | S01(16,8)、S02(18,8)、S03(20,8)、S04(22,8) |
| y=10 | S05(16,10)、S06(22,10) |
| y=12 | S07(16,12)、S08(22,12) |
| y=14 | S09(16,14)、S10(18,14)、S11(20,14)、S12(22,14) |

边框共36格；四门各2格共8格允许导航，剩28格墙体阻挡：

| 方向 | 门格 | 外侧参考点 |
|---|---|---|
| 北 | (19,7)、(20,7) | (19,6)、(20,6) |
| 南 | (19,16)、(20,16) | (19,17)、(20,17) |
| 西 | (15,11)、(15,12) | (14,11)、(14,12) |
| 东 | (24,11)、(24,12) | (25,11)、(25,12) |

坐标参考只用于计算入口，不代表这次实现宝箱交付。

### 2.1 没有道路空间的处理（明确的原型取舍）

12×4+16=64格，内部已经铺满，不能同时承诺“建筑全占格阻挡”“不留道路”“满城仍能通行”。

本方案选择：普通2×2建筑保留WorldCellGrid建造占用，但blocksNavigation改false，表示可穿行的生产地块；主基地仍阻挡，实墙阻挡，门常开。不新增道路槽、不挤掉建筑位、不扩大城墙。
代价：部队可能经过建筑图像；当前美术不是逐像素碰撞，先以经营地块可通行为准。若要求房屋本体不可穿，应另开子格导航/局部障碍方案，不能在此次将全部地块重新设为障碍。

墙和门都占建造保留格，因此门“可行走”不等于“可建造”。空槽不能claim为Reserved，否则合法建造永远失败。

## 3. 修改文件与职责

新增3个生产脚本及Creator生成的.meta：
1. assets/scripts/map/CityLayout.ts：纯布局、槽位查询、边框分类、共享占格/导航应用函数。
2. assets/scripts/map/CityVisualConfig.ts：图片UUID及墙体视觉映射，不存经济规则。
3. assets/scripts/map/CityRenderer.ts：加载静态图、渲染槽位和墙、订阅槽位占用变化。

其余改既有脚本。新增.ts遵守根AGENTS.md，头部必须写Why this file exists / Ownership boundary / This file deliberately does NOT。不把城市布局塞进TerrainAtlas或PrimitiveRunState。

### 3.1 CityLayout.ts：新增方法与原因

建议类型CitySlot{id,gridX,gridY,w:2,h:2}、CityBoundaryCell{x,y,kind:'wall'|'gate',visualKey,flipX}。所有数据由一个CITY_LAYOUT常量派生，不能在渲染、放置、换层各写一套坐标。

- getCitySlots()：生成上述12槽；ID按行排序，稳定不随建筑变化。
- findSlotContainingCell(x,y)：鼠标处于槽位任意一格均返回该槽；城外/基地/墙/门返回null。
- findSlotByAnchor(x,y)：只接受精确槽位左上角，服务最终验证，不做隐式修正。
- getCityBoundaryCells()：返回36个不重复边框格及各自墙/门分类。
- applyCityOccupancy(cells)：以ownerId='city:boundary'、WorldCellFlag.Reserved一次claim全部36格；只在新建grid调用，不能对活grid重复claim。
- applyCityNavigation(grid)：仅对28墙格setBlocked，不对门调用setWalkable（避免覆盖其他实体障碍）；门的默认可走来自空白网格。
- validateCityLayout(mapWidth,mapHeight)：检查数量、界内、无槽位重叠、无基地/边框交叠。失败明确报错，不静默丢槽。
- assertBuildingsInCitySlots(entries)：换层候选构建前确认现有建筑锚点合法且无重复槽位；不迁移、不收费、不自行重造。

参考核心纯逻辑：

```ts
export function findSlotContainingCell(x: number, y: number): CitySlot | null {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    return getCitySlots().find(slot =>
        x >= slot.gridX && x < slot.gridX + 2 &&
        y >= slot.gridY && y < slot.gridY + 2) ?? null;
}
export function findSlotByAnchor(x: number, y: number): CitySlot | null {
    return getCitySlots().find(slot => slot.gridX === x && slot.gridY === y) ?? null;
}
```

不得使用全地图x%2/y%2吸附：本项目锚点相对城市内部偏移计算，且中央四块不是建筑槽位。

### 3.2 CityVisualConfig.ts：新增映射

内部key按用途命名，文件名仅保存在UUID配置中。映射如下：

| 位置 | 图片 | 水平镜像 |
|---|---|---|
| 北/南直墙 | woodwall1 | 否 |
| 西直墙 | woodwall3 | 否 |
| 东直墙 | woodwall3 | 是 |
| 西北角(15,7) | woodwall4 | 否 |
| 东北角(24,7) | woodwall4 | 是 |
| 西南角(15,16) | woodwall2png | 否 |
| 东南角(24,16) | woodwall2png | 是 |
| 北/南门左格 | woodwalldoor3 | 否 |
| 北/南门右格 | woodwalldoor3 | 是 |
| 西门上格/下格 | woodwalldoor1 / woodwalldoor2 | 否 |
| 东门上格/下格 | woodwalldoor1 / woodwalldoor2 | 是 |

每格Sprite仍32×32，不将单张门边图拉伸成64×32。两张终止段组成一处通道，没有开关动画。图内实际缺口窄于两格的逻辑可走范围，属于当前素材与粗粒度导航的近似；验收应观察视觉擦边，不能将整张棕色底图当成物理实心墙。

### 3.3 CityRenderer.ts：新增方法

- static async loadFrames()：用assetManager.loadAny<SpriteFrame>按@f9941加载8张图；任一必要资源缺失即抛出明确文件名/UUID，不能静默沿用其他建筑贴图。
- render()：先清理自身节点，创建12个64×64空槽和36个32×32边框节点。所有格位由CityLayout提供。
- createSprite(parent,frame,rect,flipX)：使用gridRectToWorldCenter和GRID_RENDER_SIZE；Sprite.SizeMode.CUSTOM；复制父layer，UITransform大小与实际占地一致。
- bindRegistry(registry)：保存unsubscribe，订阅建筑add/remove/notifyRelocated，调用refreshSlots()。
- refreshSlots()：从registry的实例锚点推导occupiedSlots，建筑占用则隐藏整个empty land节点，空槽再显示。不另存可写slotOccupied表。
- dispose()：取消订阅并销毁自身节点；不得销毁assetManager共享SpriteFrame。

空地图上的加号已经烘在empty land.png里，因此隐藏整个64×64图，不只在上面盖半透明建筑；不再绘制第二个加号。

节点放在MapRoot/WorldObjectRoot下专用CityRoot（包含SlotRoot、WallRoot），排在StructureRoot、ResourceRoot、BuildingRoot、各Ghost之前；ActorRoot现有层次不改。本轮不加墙体hover点击，不注册HoverInfoTarget、FeedbackClickTarget或Button，不拦截蓝图与单位指令。

加载是异步的，要防止组件销毁后继续render；MainMapController在await返回后检查isValid，失败则停止bootstrap，不建立一半可操作的城市。

### 3.4 StaticMap.ts与StaticWorldObjects.ts

StaticMap.ts：保留40×23及城外原有地形，只把CityLayout所定义10×10范围覆盖为Dirt，保证最下方y=16和侧边也具有统一土地。不要根据图片反推碰撞。

StaticWorldObjects.ts：base_main保持(18,10)，可引用CITY_LAYOUT.base避免魔法数字；外部资源保留。首层gold_01在(17,6)，没有与新城市相交，不需要随意挪动。
StaticFloorCatalog.ts的forest/quarry已复制STATIC_MAP，因此采用同一城市坐标，无需新增第三张地图或修改奖励配置。所有资源按完整footprint检查不能与城市保留格重叠。

### 3.5 BuildingTypes.ts与BuildingPlacementValidator.ts

PlacementInvalidReason末尾追加OutsideCitySlot、UnsupportedCityFootprint（不重排原枚举数字）。在所有reason→提示文本映射处补“请选择完整的2×2建筑位”等文案；通过rg检查引用，不默认为只有Ghost使用。

新增私有validateSpatial(definition,x,y,ignoredOwnerId?)，validate和validateRelocation共用，职责：
1. 整数坐标、完整footprint在地图内；
2. 仅普通2×2定义允许进入本批城市槽位；
3. findSlotByAnchor必须命中；
4. terrain检查统一使用definition.allowedTerrain；
5. 各格无其他owner占用；搬迁仅忽略自身owner。

返回空间判定供现有Snapshot字段使用。不要把“城外但地图内”标成OutOfBounds；reason应是OutsideCitySlot。
validate()额外检查费用与placementGate；validateRelocation()不扣费、不消耗队伍位。中心基地不通过蓝图建造，无需放宽它的4×4校验。

最终service必须收到锚点并再次validate，不能仅靠Ghost吸附。非法直接调用tryPlace(id,17,8)也必须失败。

### 3.6 BuildingPlacementTool.ts

refreshPointer(screenPoint)：
- 保留GridPointerProjector的屏幕→地图变换，不能修改通用projector影响其他系统。
- projected cell查findSlotContainingCell，命中后pointerCell存槽位锚点，不保存原始鼠标格。
- 无槽时pointerCell/currentSnapshot清空、ghost.hide()；不能继续沿用上一合法槽。
- 已占槽仍显示该槽的红色Ghost，费用不足也红色，使用validator原规则。
confirmCurrentPlacement()维持service.tryPlace，但参数只能来自当前已吸附锚点；资源变化后仍重新验证。
refreshCurrentCell()保持使用同一锚点，保证预览与提交一致。

参考：

```ts
const raw = this.projector.projectScreenPoint(screenPoint);
const slot = raw ? findSlotContainingCell(raw.x, raw.y) : null;
if (!slot) {
    this.pointerCell = null;
    this.currentSnapshot = null;
    this.ghost.hide();
    return;
}
this.pointerCell = { x: slot.gridX, y: slot.gridY };
this.refreshCurrentCell();
```

BuildCardStripController、BuildingBlueprintCardView、BuildToolController继续现有下方卡片流程，不增加点击空地进入建造。Esc/右键取消、UI排除区域、主基地弹窗互斥保留。

### 3.7 BuildingRelocationController.ts与BuildingRelocationService.ts

refresh()改为指针所在槽作为目标；不再用cell-grabOffset生成任意锚点。清理已不用的grabOffset字段和onDown赋值，其余拖动阈值、取消、onUp最终重采样与输入互斥保留。
- 空槽：以锚点preview，合法则记录destination。
- 自身槽：允许no-op，不刷新效果/付费。
- 他人槽：红色，不实现交换。
- 基地/城墙/城外：destination=null、hideGhost；松开回原位。

BuildingRelocationService.preview/tryMove/prepare保留事务与身份更新，只通过新的共享validator限制锚点。普通建筑不挡导航后，prepare不再新增阻挡，不能因此撤销原有墙体；保留现有路径检查回调。notifyRelocated()触发空地占用展示刷新。

十二槽全部占满时，没有空槽可供搬移；本轮不偷偷加入原子交换。满城调序需要后续交换功能，作为限制记录，不宣称这次完成GDD全部调序体验。

### 3.8 BuildingCatalog.ts

仅将当前storage_house_01、lumberjack_house_01、barracks_01、blacksmith_house_01的blocksNavigation置false；占地、费用、效果、蓝图、外观和免费首营规则保持。

BuildingPlacementService.tryPlace()已有blocksNavigation条件，因此不需重写扣费/回滚。WorldCellGrid继续claim 4格，确保不能叠放。禁止将“可走”实现为不claim建筑占格。

### 3.9 MainMapController.ts：首层与换层共用城市约束

bootstrap()：
1. 先validateCityLayout。
2. 现有WorldCellGrid登记base/resources后applyCityOccupancy，发现冲突报错。
3. NavigationGridBuilder.build()完成后applyCityNavigation，再创建SquadRenderer/WorldNavigator。
4. 创建CityRoot并显式排在建筑与ghost下方；加载图片、render。
5. buildingRegistry创建后bindRegistry；新建/搬移由订阅刷新。
6. 保存cityRenderer字段，onDestroy()调用dispose。不把墙伪装成资源WorldObject，避免加入采集、点击或怪物守卫体系。

FloorTransitionController的commit回调（位于MainMapController.ts，不是FloorTransitionController.ts内部）：
1. 构造nextObjects，先断言建筑锚点合法。
2. candidateNavigation由NavigationGridBuilder建立，再applyCityNavigation。
3. candidateCells登记世界对象、applyCityOccupancy、登记已有建筑；blocksNavigation为true时才补建筑障碍，保持现有泛用逻辑。
4. 校验候选网格、恢复点后才replaceFrom；不能因候选布局错误先覆盖活状态。
5. 既有建筑和CityRoot保留，不能换层重复加36墙、12空槽；仅refreshSlots做显示校验。
6. 不因城墙创建重新扣款、刷队伍、发过层奖励。

NavigationGridBuilder本身可不改；首层和换层都显式调用同一个applyCityNavigation，而不是复制28格的循环。
WorldCellGrid无需新增flag，复用Reserved与现有owner语义。

### 3.10 出生、换层整备及寻路边界

新增纯帮助函数resolveCityRecoveryPoints（可放CityLayout.ts，不另增第四文件）：给定NavigationGrid、人数生成的formationOffsets、候选参考点，按固定距离顺序查找可用集合点；检查中心及所有成员foot point位于可走格且在地图内。优先基地下方内部两排地块，失败再查城门外空地，不静默传送进墙。
候选使用连续grid point而非仅整数格左上角；每队结果检查阵型边界，避免恢复点落在y=16的南墙。多队候选避免相同中心，仍不引入新的单位碰撞系统。

- SquadRenderer.createSquad()：以现有preferredSpawn为输入，resolve后再motor.setup；homeRestCell由已验证point生成，不只修homeRestCell却保留旧spawnPoint。
- MainMapController换层恢复段：替换直接baseY+height+0.5-bounds.minY的结果为同一resolver；使用结算后人数验算，再交SquadFloorRecovery.recover()。
- PrimitiveRunState不负责寻路、无需移入Node依赖，也不修改免费首营状态。
- SquadBrain.updateHomeIdle()当前找Dirt可达点。铺满城市并应用墙后继续走同一寻路；不直接随机传送。若未找到可达目标保持idle。

重要已知限制：SquadMotor使用队伍中心寻路，WarriorMotor是相对偏移/局部直线移动，没有完整单兵导航。因此本轮能保证队伍中心不穿28格墙，不保证所有阵型成员、展开攻击和归队动画绝不擦墙。不得通过扩大门或删除墙碰撞掩盖问题。完整单兵过门排队/局部避障单开方案；若项目要求本次所有成员绝不穿墙，则本方案需先追加该范围，不能将中心寻路验收冒充单兵碰撞验收。

## 4. 实施顺序

1. CityLayout与坐标断言；先确认12槽、28实墙、8门格、基地不重叠。
2. CityVisualConfig与CityRenderer；用已上传8图拼出完整城市，检查转角、门缺口、镜像、背景色。
3. validator与placementTool固定槽位；保留下方蓝图入口。
4. 搬迁槽位吸附、空地图显示订阅。
5. 普通地块通行政策、首层/换层墙网格、出生与恢复点。
6. 整体回归；只修改本方案列出的相关文件。不顺便实现scoreboard、城墙受击或塔楼。

美术不足时报告具体缺的朝向或接缝，不改既有tilemap裁剪坐标、不新增臆测atlas。

## 5. 验证与验收

### 5.1 纯逻辑验证（值得自动化的边界）
- 12槽共48格，与16格基地不交叠，恰好覆盖内部64格。
- 城市边框36格唯一，28阻挡+8通道；四门位置正确。
- 每槽四个鼠标格映射同一锚点；基地、门、墙、城外返回null。
- 非锚点直接提交失败；重定位忽略自身但不忽略他人。
- 满建12槽后门到各内部地块仍有导航路径，基地仍不可走。
- 首层与换层网格的墙阻挡、保留格完全一致。
- 4、8、16人恢复点的全体foot point不在墙、基地或资源障碍内。

### 5.2 Creator运行验收
1. 默认场景显示中心基地、12空槽、闭合城墙四处开口，无塔位。
2. 空槽只有烘焙加号，不响应点击弹菜单；下方蓝图仍可选、hover与取消正常。
3. 指针在同槽四格移动Ghost不抖到邻格；城外无残留Ghost、无法建造。
4. 任意合法槽放置成功只扣一次费用；已占槽不可重复建；建成隐藏加号。
5. 拖至空槽保留实例ID、绑定队伍、强化和已付费用；旧槽重现、新槽隐藏；非法拖移不影响原位。
6. 从四门分别下达城内外指令，队伍中心绕墙走门；单兵阵型擦边另记已知限制。
7. 连续forest→quarry→forest：建筑位置、槽位显示、28格墙障碍保留，资源刷新不压城墙；节点不累加、部队恢复点合法。
8. 基地AB动画、点击下潜、悬崖边界、摄像机拖动、下方蓝图交互不回归。
9. 最近邻显示不模糊；墙图不旋转90°；水平镜像仅作用于图片子节点，逻辑位置不翻转。
10. 资源不足、队伍上限和免费首营仍按当前代码行为，不借本次变动重平衡。

### 5.3 不作为此次完成声明
- 尚无城墙伤害、四门共享生命实现或塔位。
- 尚无逐士兵防穿墙与过门排队。
- 尚无满城建筑交换。
- 没有以截图拼接验证代替Creator运行验收。
