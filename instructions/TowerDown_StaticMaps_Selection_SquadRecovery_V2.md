# TowerDown 双静态地图选择与部队整备技术方案 V2

> 基于main提交 `8418c66f7539024dbf1724555568205dc3672dd8`（towncenter click）。
> 在已实现的杀敌计数、基地换图和BasePanelView上继续迭代。本次交付为技术方案，不是功能实现。
> 最新规则：进入所选地图时刷新资源与敌怪，保留城市和队伍；**恢复已有队伍的完整编制、全部成员生命及可战斗状态**。此条替代旧方案“不复活、不回血”。
> 仍沿用单个Main.scene，不实现随机地图、时代、下潜经济结算、建筑弹性反馈或通用存档系统。

## 1. 本轮完整行为

1. 首次启动保持现有静态地图与两队初始化流程。
2. 当前层击败3名敌人后基地就绪，点击打开现有Hover同款面板。
3. 面板新增左右两个可点击目的地：“林地补给区”“石矿遗址”，底部保留当前“返回”链接。
4. 卡片显示地图名称、资源种类及资源点数量、敌怪人数。点任意一张即进入对应静态地图。
5. 新层所有资源点恢复初始库存，所有敌怪按该图配置重新生成；旧层未采资源和未击败敌怪丢弃，不折算奖励。
6. 已建建筑、基地、库存、已解锁蓝图、全局属性modifier保留；不扣换层费，不重复应用建筑效果。
7. 现有队伍全部成员恢复到各自当前生命上限，包括阵亡成员；回到基地附近集合并恢复可接收命令状态。
8. 杀敌计数重置为0/3，基地切回未就绪图；本层再杀3个才能重新打开选图。
9. 两张卡每次都显示forest/quarry；可以再次选择同一模板，但每次创建新的层实例并刷新。首次启动图不再作为第三张候选卡。
10. 只点返回不触发资源刷新、回血、复活或计数重置。打开选择页时沿用当前行为：后台模拟继续运行；**实际选卡执行切换时才短暂锁定世界**。

## 2. 当前实现的具体接点

| 文件（默认assets/scripts/下） | 已实现/限制 | 本轮增量 |
|---|---|---|
| ui/base/BasePanelView.ts | 九宫格背景，底部居中返回链接，BlockInputEvents | 添加左右卡片、摘要、busy/error状态，保留原外观和返回位置 |
| ui/base/BaseInteractionController.ts | ready只从false变true；counter构造时注入 | 保存idleFrame，支持counter重置后同步ready=false及换回idle |
| combat/EnemyKillCounter.ts | 有效ID只在constructor初始化，无重置接口 | beginFloor更新有效ID与层实例，清击杀并通知原订阅 |
| map/MainMapController.ts | bootstrap内创建一次所有注册表和渲染器，大部分为局部变量 | 把切层需要的依赖交给FloorTransitionController，bootstrap不重复执行 |
| world/WorldObjectRenderer.ts | render会clear基地及资源；现有getNode可找到基地 | 新增只替换资源的接口，保留base_main节点和素材设置 |
| monster/MonsterGroupRenderer.ts | render只removeAllChildren，旧receiver未显式集中清理 | dispose旧怪与注册、重新生成并传入本层死亡回调 |
| world/WorldObjectLifecycleController.ts | 资源延迟0.12秒清理并释放格子 | clearPending，阻止旧层延迟清理影响新层 |
| command/WorldCommandController.ts | setup一次绑定当前所有WorldObjectView | 新资源生成后绑定点击；清掉旧旗帜与目标 |
| combat/HealthComponent.ts | heal拒绝0血；setup设满血但不notify | 新增restoreFullForFloor，仅修改currentHealth并notify(null) |
| squad/WarriorCombatController.ts | 阵亡后状态Dead，但当前die不destroy成员节点 | 显式清战斗状态并恢复Inactive；不重复setup |
| squad/SquadRenderer.ts | 目前强制每队4人；handle中保留全部成员数组 | 保留现有handle，逐成员恢复，不能按存活数重建队伍 |
| navigation/NavigationGrid.ts、world/WorldCellGrid.ts | 多系统共享实例，没有整层重置接口 | 新增replaceFrom，原位更新内容保留引用 |

以下接口是拟新增API，实施者应按本表落地，不假设当前代码已经存在。

## 3. 地图定义与两个静态配置

新增 `assets/scripts/map/StaticFloorCatalog.ts`。本轮只需一个数据模块，无需地图编辑器或生成器。

建议定义StaticFloorDefinition：
- id: 'forest' | 'quarry'
- displayName: string
- terrain: TerrainMap
- resources: readonly WorldObjectData[]，只包含Resource
- monsterGroups: readonly MonsterGroupData[]
- requiredKills: 3

两张地图均40×23格，使用现有Grass/Dirt与图集，各自深拷贝STATIC_MAP。当前阶段用资源位置、种类和怪物配置区分两张地图，**不额外改变城市地形或扩大可建区**。这样所有已建建筑原位置仍合法，不需要引入新的建造掩码。地形视觉差异可后续再做。

基地仍为base_main，位置(18,10)、占4×3格，属于持久城市；不得在resources数组再次生成。所有Dirt建造格与启动图完全相同。

### 3.1 静态资源位置

W=ResourceType.Wood/WorldVisualId.TreeGreen，S=Stone/StoneGray，F=Food/FoodPlantRed，G=Gold/GoldOreSmall。坐标使用现有gridX/gridY口径；木石2×2，食物黄金1×1。

| 模板 | 模板资源ID | 类型 | gridX, gridY | 占格 |
|---|---|---|---|---|
| forest | wood_b1 | W | 5, 4 | 2×2 |
| forest | wood_b2 | W | 8, 7 | 2×2 |
| forest | wood_b3 | W | 5, 16 | 2×2 |
| forest | stone_b1 | S | 31, 6 | 2×2 |
| forest | food_b1 | F | 29, 16 | 1×1 |
| forest | food_b2 | F | 33, 17 | 1×1 |
| forest | gold_b1 | G | 10, 18 | 1×1 |
| quarry | wood_c1 | W | 7, 5 | 2×2 |
| quarry | stone_c1 | S | 29, 4 | 2×2 |
| quarry | stone_c2 | S | 32, 8 | 2×2 |
| quarry | stone_c3 | S | 29, 17 | 2×2 |
| quarry | food_c1 | F | 8, 17 | 1×1 |
| quarry | gold_c1 | G | 10, 6 | 1×1 |
| quarry | gold_c2 | G | 32, 16 | 1×1 |

本表坐标已按当前STATIC_MAP核对：不越40×23边界、不相互重叠、不进入Dirt建造区。因此不会与现有合法建造建筑重叠。实际部队集合位置和资源邻接格可达性仍需运行导航校验。

### 3.2 怪物

使用现有BlueSlime配置，不另调伤害与血量。每组3只，engageRadiusCells=3、leashRadiusCells=6，guardOffset复用(-1.25,0)、(1.25,0)、(0,-1.25)。

| 模板 | 怪物组ID | 守卫资源 | 成员ID |
|---|---|---|---|
| forest | forest_guard_01 | gold_b1 | forest_slime_0 / 1 / 2 |
| quarry | quarry_guard_01 | gold_c1 | quarry_slime_0 / 1 / 2 |
| quarry | quarry_guard_02 | gold_c2 | quarry_slime_3 / 4 / 5 |

守卫引用指向本地图实际资源，不能残留gold_01。组中心沿用当前MonsterGroupRenderer算法；本轮守卫目标均1×1黄金，避免2×2资源中心计算引入额外改动。

### 3.3 预览来自同一份数据

| 卡片 | 木点 | 石点 | 食物点 | 金点 | 敌怪人数 |
|---|---:|---:|---:|---:|---:|
| 林地补给区 | 3 | 1 | 2 | 1 | 3 |
| 石矿遗址 | 1 | 3 | 1 | 2 | 6 |

新增纯函数buildFloorPreview(definition)，遍历resources按resourceType聚合，怪物人数为所有members.length之和。卡片不手写另一套数量，也不把怪物组数当人数。

资源展示“木头×3个资源点”，不要把3写成库存数量。若将来显示总产量，应从ResourceRuntimeConfig计算；当前实现各类型单点80HP、每伤害产出1，与经济策划表的20W/5G投放参数不同。本轮不改变该数值。

## 4. 在现有面板上扩展

修改BasePanelView，保留其Background和底部ReturnLink：

- 新增LeftDestination、RightDestination两个子节点，复用当前已加载的Hover backgroundFrame与九宫格样式。
- 两卡分别展示名称、资源点行、敌怪人数、点击进入提示。
- 新增setDestinations(previews, onChoose)、setBusy(value)、setError(message)；业务只返回mapId，不由View操作世界。
- 1280×720下每卡约360×380，水平间隔48，居中放置；底部预留80px给返回链接。layout随当前HUD尺寸计算，窄窗口等比压缩且不遮挡返回。
- 正常状态点击卡立即触发一次onChoose。busy禁用两卡和返回并显示“进入中…”。
- 面板重复打开只更新视图，不重复注册TOUCH_END；dispose清理两卡与返回监听。
- 保留已接入的输入阻断与Hover悬停暂停。BaseInteractionController.isOpen()仍是正常面板阻断依据；切换控制器isTransitioning也必须加入所有已有阻断谓词。
- 打开和返回保持原来的后台模拟规则，不借机恢复部队。选择页面不是治疗按钮。

不新建第二套FloorSelection界面，不更换基地图片，不重做Hover命中系统。

## 5. 每层实例与计数重置

新增 `assets/scripts/map/FloorTransitionController.ts`，保存：
currentFloorInstanceId、currentMapId、isTransitioning、pendingMapId。

即使再次选择forest，也使用不同实例编号。所有新层资源、怪物组、敌人成员运行ID统一加前缀，例如：
- f2:forest:gold_b1
- f2:forest:forest_guard_01
- f2:forest:forest_slime_0

同步改写guardedObjectId。模板对象深拷贝，不能在原始静态常量上改ID或扣资源。基地、建筑、我方队伍/成员ID保持不变。

### EnemyKillCounter增量

新增beginFloor(floorInstanceId, validEnemyIds)，清defeatedIds、替换validEnemyIds、保存currentFloorInstanceId，notify一次。保留同一个counter实例和BaseInteractionController订阅，不每层重新创建controller。

recordDefeat增加可选/必填的floorInstanceId校验；统一修改所有调用点。MonsterGroupRenderer生成时把本层ID捕获进死亡回调，不在死亡时才读取全局“当前层ID”，否则旧怪可能被误认为新层死亡。

初始地图也调用beginFloor(1, 初始怪物ID列表)，保留当前启动资源ID即可。后续使用前缀ID。切换成功时计数从0开始；清怪dispose与资源采空都不增加击杀。

### BaseInteractionController增量

当前onCounterChanged只处理第一次ready。改为每次赋值：
ready = snapshot.ready；
setBaseSpriteFrame(ready ? readyFrame : idleFrame)。

setup保存idleFrame与readyFrame。计数变化不自动open，不因beginFloor通知而取消正在执行的切换。切换控制器成功后显式close；destroy仍只在场景退出执行。

## 6. 保留与刷新边界

| 对象 | 换层行为 |
|---|---|
| 主基地、BuildingRoot及全部建筑Node | 保留ID、坐标、节点身份和效果 |
| BuildingRuntimeRegistry / BuildingEffectSystem | 不清空、不重复setup、不重复应用modifier |
| ResourceInventory / BlueprintInventory / CombatStatModifierRegistry | 保留实例和数值 |
| SquadRoot / squadHandles / 每个我方成员 | 保留身份、兵种及永久属性，恢复完整编制和满血 |
| 地图资源与剩余库存 | 丢弃旧层节点；按所选模板重建满资源节点 |
| 怪物组、怪物HP与存活状态 | 丢弃旧层；按所选模板全部重新生成 |
| 部队命令、目标、路径、采集占位、敌我claims | 清理，回到基地附近待机 |
| 杀敌计数与基地就绪 | 0/3与idleFrame |
| 已采到玩家库存的资源 | 不清零、不重复发放 |
| HUD、基地面板、选队/建造控制器 | 保留实例，关闭面板后继续使用 |

不要调用director.loadScene、MainMapController.bootstrap或SquadRenderer.render(STATIC_SQUADS)来换层；它们会重置/重复创建本应保留的状态。

## 7. “人数与血量全恢复”的准确实现

### 7.1 恢复目标不是当前存活人数

恢复到该队**已经拥有的完整成员编制**，不是统一设为4，也不是直接补到数值表16人上限。

当前SquadRenderer仅支持4人且阵亡不destroy成员节点，因此每个handle的4个成员就是完整编制；本轮两队即各恢复4人。可在创建handle时记录authorizedMemberIds（或明确用固定成员数组作为当前权威编制），战斗死亡不移除该记录。以后若实现付费扩军，扩军成功必须更新此编制；本轮不顺带实现动态扩军。

严禁用filter(isAlive()).length作为恢复目标，否则阵亡越多，恢复人数越少。整队阵亡也保留handle并能在合法换层时复原。

### 7.2 专用满状态接口

HealthComponent新增restoreFullForFloor(): void：
currentHealth = maxHealth；
notify(null)。
允许从0恢复，保留当前maxHealth，不调用setup重新设回基础HP，也不通过takeDamage伪造事件。通知使血条与队伍UI刷新。

WarriorCombatController新增resetForFloor(): void：
释放旧group/target/claim，motor.stop，清攻击状态，将state设为Inactive。必须在恢复HP后执行或在该接口内严格按先恢复HP、再进入可战斗状态的顺序处理；单纯heal不能移除Dead状态。

WarriorAnimator新增resetToIdleForFloor(direction)：清当前攻击帧索引、累计时间、已触发命中标记，返回Idle；保留现有attackImpactListeners，不能再次setup，因为当前setup会clear监听。若素材曾被隐藏/染色，恢复正常可见状态。

WarriorMotor新增snapToFormationForFloor()：清路径、目标、arrived标志，立即回到已有formationOffset，不等待旧层路径走完。

SquadMotor新增teleportForFloor(point)：清waypoints/arrived，更新grid位置和世界坐标。SquadBrain新增resetForFloor(homeRestCell)，清commandTargetId、activeTargetId、pendingTargetId、返程/遇敌标志，使用更新后的导航进入HomeIdle。

SquadCombatController与SquadEngagementController各新增resetForFloor()：清currentGroup、guardDefeatedPending、交互目标、slots/assignment、攻击资格与重组状态，不只是requestRetreat等待旧组结束。

上述顺序由新增 `assets/scripts/squad/SquadFloorRecovery.ts` 协调。模块只恢复现有队伍，不生成新兵营、不发资源、不改modifier。

### 7.3 人数恢复与引用校验

切换准备时检查authorizedMemberIds对应的Node、Health、Animator、Motor、Combat组件均存在；当前die保留节点，可原位恢复全部成员。发现缺失则在破坏旧层前报错，不能静默少恢复人数，也不能盲目重跑整支队伍setup叠加订阅。

本轮不改变“我方阵亡保留节点”的生命周期。以后要销毁死亡成员时，再加入按权威编制重建缺失成员的工厂；不能提前把当前4人渲染器当成任意人数恢复方案。

切换恢复清除当前攻击/移动等临时状态；当前仓库没有需要保存的技能冷却/临时异常状态系统。以后新增时需接入此整备入口，定义重置，不能用重置永久属性代替全状态恢复。

### 7.4 集合位置

优先使用两队当前默认中心(19,14)、(21,14)，但现有建造可占这些格，不能直接传送进建筑。准备阶段基于“基地＋保留建筑＋新资源”候选导航，从基地下方开始按固定顺序搜索可站立中心：

- 检查每个formationOffset对应位置及不同队伍之间不重叠。
- 中心与成员位置不落在base、建筑、资源占格。
- 至少有通向外部资源邻接格的可行路径。
- 默认点不合法时，向基地周围逐圈/BFS扩展。
- 找不到完整编制所需空间时，在切换前显示错误并允许返回；不移动/拆除玩家建筑，不丢弃成员。

本轮不新增强制预留区或改现有可建范围。换层后可把相机resetView到基地附近，选中队伍ID保持。

## 8. 更新地图依赖，不留下旧引用

当前NavigationGrid、WorldCellGrid、WorldObjectRuntimeRegistry、MonsterRuntimeRegistry被多处持有。保持对象身份，新增局部方法：

| 对象 | 新增接口 | 行为 |
|---|---|---|
| NavigationGrid | replaceFrom(candidate) | 尺寸一致时复制cells |
| WorldCellGrid | replaceFrom(candidate) | 深拷贝flags与owners，不能只复制flags |
| WorldObjectRuntimeRegistry | replaceResources(resources) | 保留base_main，仅替换Resource条目 |
| MonsterRuntimeRegistry | clear / replaceAll | 移除旧组引用、注册新组 |
| WorldObjectLifecycleController | clearPendingForFloorChange | 清旧pending，不能让旧延迟事件释放新格 |

本轮两图terrain数值相同，验证后可保留现有terrain引用和TileRoot以降低开销；两个definition仍是独立只读配置。若实现者选择重绘tile，MapRenderer.clear必须destroy旧tile节点而非只removeAllChildren。任何未来不同地形的实现都须同步更新PlacementValidator持有的map，不能只换渲染。

候选WorldCellGrid与NavigationGrid必须重建以下占格：
1. base_main的4×3；
2. 所有保留建筑在BuildingRuntimeRegistry中的footprint；
3. 新地图资源；
4. 项目当前存在的其他保留占格标志（如有）。

现有NavigationGridBuilder只包含worldObjects，不含动态建筑；调用build后仍要补上所有保留建筑的blocked格。不要因为换层让部队穿建筑或Ghost在旧建筑上合法。

新地图点击绑定：WorldCommandController提取bindWorldObjectViews(views)和clearTargetsForFloorChange。新资源创建后调用前者，保留onBaseClicked路由与所有门禁；清旧targetBySquad并隐藏/销毁旧旗帜。不重新setup选队或建造面板。

## 9. 资源与敌怪生命周期

WorldObjectRenderer新增replaceResources(resources, dimensions)或clearResources/renderResources配对，只操作ResourceRoot及资源字典。保留StructureRoot/base_main与BuildingRoot。不能直接调用现有render，因为它先全量clear。

MonsterGroupRenderer新增clear/dispose：逐怪注销MonsterAttackReceiver、取消旧节点的延迟任务、注销Hover，再移出树并destroy。MonsterAttackReceiver增加幂等dispose，onDestroy调用同一方法；不能只等帧末onDestroy。所有当前旧怪节点均属刷新范围，包括尚活着的怪。

资源侧沿用WorldObjectAttackReceiver.dispose；Lifecycle.pending先清；renderer中nodeByObjectId必须删除旧资源项。新资源按ResourceRuntimeConfig从满HP创建，继续使用同一ResourceInventory。

旧层敌人ID加层前缀、新层counter校验，防止迟到死亡误计数；我方ID不变，因此切换前必须停止/解绑旧怪命中来源，不能仅依靠目标ID隔离。

切换时清旧DamagePopup/临时旗帜和旧世界Hover。不要释放共享材质、SpriteFrame或BuildingEffectSystem，这些仍被持久对象使用。

## 10. 选择与切换的最小流程

Controller状态：Idle → Preparing → Committing → Idle；失败区分“尚未破坏旧层”和“已进入提交”。

### 10.1 准备阶段

点卡回调同步设置isTransitioning=true并setBusy(true)，拒绝重复回调。将面板根或所有世界操作的阻断条件扩展为baseInteraction.isOpen() || transition.isTransitioning()。

本轮地图素材都是已有素材，优先在bootstrap预加载；准备阶段只深拷贝定义、生成唯一ID、校验摘要/坐标/成员完整性、构建候选格与集合点。需要异步加载时全部放在这里，**此时不清旧资源、不回血、不重置计数**。

当前面板打开时世界仍在运行；若准备发生await，恢复执行后重新核对最新建筑、部队及可达性。没有任何await之后再使用早先快照当作未变化的当前状态。

准备失败：取消busy，保留旧层与正常返回链接，显示失败原因。不要把“再点返回”变成一次免费整备。

### 10.2 同步提交阶段

预加载和校验通过后，在一个同步调用内完成提交，中途不await，不安排跨帧一段段清场：

1. 暂时停用ActorRoot、ResourceRoot，禁用Lifecycle更新并阻断CombatEventHub.emitAttackImpact；保存原激活/启用状态。这只发生在真正选卡后，不新增全局SimulationGate架构。
2. 清除我方旧战斗/采集引用、移动路径、旗帜；清Lifecycle pending与旧层命中来源。
3. 显式dispose并销毁旧资源/怪物；清注册表旧数据。
4. 原位替换格数据、资源注册；创建并绑定新资源、怪物；新怪死亡回调捕获本层实例ID。
5. 校验生成数量等于卡片预览，确认新资源点击已绑定。
6. 对现有完整成员编制调用整备接口，恢复HP、Inactive、Idle与阵型，移到准备好的集合位置。
7. 更新currentMapId和floorInstanceId，counter.beginFloor设为新敌人集合和0计数，基地恢复idle图。
8. 清busy、关闭原面板，恢复根节点/组件原状态，解除命中与输入阻断，回到Idle。

CombatEventHub新增setImpactBlockedPredicate(() => boolean)，emitAttackImpact在阻断期间直接返回null；保持原有路由和实例匹配注销规则，不清掉全部我方receiver。

现有全局回调若在同次事件后才运行，应检查isTransitioning或层实例；旧尸体定时destroy只许作用旧节点。禁止对MapRoot、WorldObjectRoot或SquadRoot整体removeAllChildren。不得重复调用MainMapController.bootstrap。

### 10.3 提交异常

为保持这期规模，不要求完整世界快照回滚。但必须明确失败安全边界：

- 提交前失败可返回原层，任何恢复/刷新都没发生。
- 提交中异常不能伪装成成功并继续游戏。保持ActorRoot/ResourceRoot停用、输入与命中阻断，显示错误与“重试当前目的地”；此时禁用“返回旧层”，因为旧层可能已经销毁。
- 重试先清理本次创建的半成品资源/敌怪和注册，使用同一个pending目的地重新生成，保留建筑/队伍/库存。层号只在成功时提交一次；新尝试可分配新的运行ID前缀。
- 恢复成员满血操作必须幂等，不叠加属性、不增加编制、不重复setup。异常后的重试不会产生额外经济奖励。
- 无法恢复则保持错误画面并记录具体异常，不解除门禁让半新半旧世界运行。

成功入口与失败路径都释放/恢复它们实际持有的状态。正常返回选择页沿用原逻辑，不影响世界模拟规则。

## 11. 文件与执行顺序

新增业务文件限定为：
1. map/StaticFloorCatalog.ts：两图定义、预览统计、配置校验（可先同文件内纯函数）。
2. map/FloorTransitionController.ts：选择与刷新顺序、busy/error状态。
3. squad/SquadFloorRecovery.ts：完整编制恢复与集合位置协调。

其余在现有类增加必要方法，不创建一套平行UI/战斗框架。

| 阶段 | 修改重点 | 验证 |
|---|---|---|
| A | Catalog＋BasePanelView两卡 | 左林地3怪、右石矿6怪，资源摘要匹配，返回正常 |
| B | Counter.beginFloor＋基地ready双向更新 | 手动测试重置后0/3与idle，旧敌人不计入 |
| C | Health/Warrior/Squad整备接口 | 有死伤的队伍恢复完整编制满血且能再次攻击 |
| D | Renderer/Registry/Grid生命周期 | 刷新不销毁基地建筑、不遗留旧资源目标 |
| E | TransitionController与MainMap装配 | 选卡进入正确地图，重复访问再次刷新 |
| F | 多轮切换/错误路径 | 无重复receiver、效果重复或点击穿透 |

MainMapController只负责注入现有依赖，可用局部context对象集中传给TransitionController，不必全面重构composition root。所有新增.ts遵守根AGENTS.md三段文件头并提交独立.meta。

## 12. 验收矩阵

| 用例 | 预期 |
|---|---|
| 当前层3杀后打开 | 现有基地换图正常，出现两卡和返回 |
| 选林地/石矿 | 对应7资源点，分别3/6敌人，坐标与配置一致 |
| 返回而不选择 | 无回血、复活、刷新或计数重置 |
| 采空或采一半资源后进入 | 新图资源完整；已采库存保留 |
| 留活怪进入下一层 | 旧活怪消失，不增加击杀；新怪满HP生成 |
| 部队4人中死2伤1 | 入层后4人全部满血，移动、采集、攻击均有效 |
| 整队4人死亡但已有3杀可换层 | 该队仍恢复4人，不丢handle |
| 已拥有编制恢复 | 不按存活数减少，不补到16人上限，不额外创建队伍 |
| 新一层 | 杀敌0/3、基地未就绪；旧尸体回调不解锁 |
| 两座增攻建筑保留 | ID、位置、Node、modifier来源一致，攻击不重复叠加 |
| 进入时集合点被建筑占据 | 选择合法替代集合点；无点时提交前报错 |
| 选同张地图两次 | 每次新实例、新资源怪物、整备一次、计数归零 |
| 连点左右卡 | 仅一次提交，不混合两图 |
| 资源待删除0.12秒时切换 | 新层占格不被旧pending解封 |
| 攻击动画命中边沿切换 | 旧敌人不能伤害刚恢复的我方，旧我方目标被清理 |
| 切换10轮 | 接收器、监听、离树节点不持续累积；我方成员ID稳定 |
| 提交前加载/校验失败 | 原层不变，可返回 |
| 提交中故障后重试 | 门禁保持，半成品清理；成功前不放行世界 |

本方案已做静态资源边界、互斥占格与城市区域检查。真正导航、部队复活、输入和反复切换需在实现后的Creator预览验证；文档提交不等于功能测试通过。

## 13. 文档归档

本轮执行入口：
`instructions/TowerDown_StaticMaps_Selection_SquadRecovery_V2.md`

旧方案原样移动：
`instructions/TowerDown_StaticFloor_Descent_ElasticFeedback_V1.md`
→ `instructions/deprecated/TowerDown_StaticFloor_Descent_ElasticFeedback_V1.md`

保留之前归档的Hover方案，不移动根GDD和经济数值表。旧方案的基地计数/面板行为已作为当前实现基线，本方案只定义后续增量及新的部队整备规则。
