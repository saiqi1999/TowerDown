# TowerDown 静态层切换、三击杀下潜与建筑弹性反馈技术方案 V1

> 基于main提交 `4a0a01010a7a33c317ffdc20e5e78095dd3f3f21`（towncenter image），Cocos Creator 3.8.8。
> 交付性质：可分步实施的技术方案；本次不提交游戏功能代码，不声称已运行验收。
> 放置于仓库现有 `instructions/`，两份旧Hover方案原样移入 `instructions/deprecated/`。本方案吸收其仍适用的交互约束。
> 本轮目标：每层击败3名敌人后，主基地换图并可点击；建筑Hover/点击有X、Y独立弹性缩放及衰减震荡；点击已就绪基地打开左右目的地页面；确认后刷新地形、资源、怪物，保留城市、部队和库存。

## 1. 范围与行为定稿

1. 使用一个Main.scene，不通过重新加载场景切层。
2. A沿用现有静态地图，新增B林地与C石矿两张静态地图。总计3张，初始进入A；A选B/C，B选A/C，C选A/B。每次进入都是新的floorInstanceId，即使回到同一模板也刷新资源和敌人。
3. 每层累计真实击败3名敌人即可下潜，不是3组，不必清空地图。击杀超过3仍可继续探索；不会自动弹出页面。
4. 基地未就绪时显示towncenter0；就绪时显示towncenter1。未就绪点击只提供反馈与“击败敌人 X/3”，不再向当前选中队伍发回城命令。普通资源点击继续原有派兵逻辑。
5. 地图所有已建建筑和主基地拥有Hover/点击视觉反馈；资源、怪物本轮不增加同款建筑缩放。建造预览Ghost不触发此反馈。
6. 点击就绪基地后立即锁定重复输入并暂停世界模拟，播放约0.18秒点击反馈，再展示选择页。两卡分别显示地图名称、资源种类及点数、敌人总人数；可点击返回或按Esc继续当前层。
7. 点卡即确认目的地，不增加第三个确认页。加载中禁止再次选卡；失败保持可恢复状态并提供重试/返回。
8. 已建建筑的位置、ID、效果，已有队伍/成员ID、存活状态、当前HP、属性、库存、蓝图均保留。换层不免费回血、不复活、不招募、不重复解锁蓝图。部队转移到同一城市的安全集合区并清除旧层作战命令。
9. 本轮只做切层原型，沿用当前游戏中的建筑效果与资源采集配置；不顺带实现数值文档里的结算生产、军需、免费首营或时代系统。

## 2. 已核对的代码与需要处理的缺口

| 现有文件 | 当前事实 | 本轮处理 |
|---|---|---|
| map/MainMapController.ts | bootstrap内创建大部分服务并硬编码STATIC_MAP、STATIC_WORLD_OBJECTS、STATIC_MONSTER_GROUPS、STATIC_SQUADS | 提升持久依赖为RunRuntimeContext，bootstrap只执行一次，切层交由专门控制器 |
| map/MapRenderer.ts | render先clear；clear仅removeAllChildren | 为替换地形建立显式dispose，摘除后destroy旧tile节点，避免离树泄漏 |
| world/WorldObjectRenderer.ts | render会clear StructureRoot及ResourceRoot | 拆分基地初始化与层资源渲染；绝不能用全量render刷新资源 |
| world/WorldObjectLifecycleController.ts | 延迟0.12秒移除资源，并释放导航/占格 | 换层前清理pending并校验层实例，避免旧回调解封新层格子 |
| monster/MonsterCombatController.ts | die先进入Dead，通知组，再延迟destroy | 在真实die边沿发送一次本层击杀事件；清场销毁不算击杀 |
| combat/CombatEventHub.ts | 只有命中路由；同targetId重复注册会抛错 | 保留职责；新增统一模拟阻断入口，敌人/资源注册及时dispose |
| command/WorldCommandController.ts | setup把全部WorldObjectView点击绑定成队伍命令；基地也会进入SquadBrain回城逻辑 | 增加基地路由优先级与动态资源绑定，不重复setup整套UI |
| ui/hover/HoverInfoController.ts | 已有集中pickTarget，当前World与UI仍统一用UITransform.hitTest | 吸收旧Scope方案，明确UI/World命中坐标路径；共享同一个目标选择器 |
| building/BuildingRenderer.ts | Sprite、UITransform、缩放都在同一节点 | 拆分逻辑命中根与VisualRoot，只让VisualRoot弹性变换 |
| navigation/NavigationGrid.ts、world/WorldCellGrid.ts | 多个系统长期持有同一实例，无reset/copyFrom | 新增原位replaceFrom，保留实例身份，更新内部格子状态 |
| building/BuildingPlacementValidator.ts | 持有terrainMap引用，只允许Dirt建造 | 保持terrainMap外层引用；增加固定城市可建掩码，避免外部新Dirt变成跨层遗失的建造区 |
| building/effects/BuildingEffectSystem.ts | 建筑注册表驱动modifier，dispose会清来源 | 切层不dispose、不重建建筑注册表，不重复挂效果 |
| squad/SquadRenderer.ts及SquadTypes.ts | handle已持有Brain、Motor、成员HP/Stats/Combat等 | 保留handle和组件实例，新增切层清理与集合接口，不重新render STATIC_SQUADS |

代码路径默认相对 `assets/scripts/`。以下新增接口均是实施要求，不能当作仓库已经存在的API。

## 3. 新静态地图数据

### 3.1 统一定义与目录

新增：

- `assets/scripts/map/floor/FloorTypes.ts`
- `assets/scripts/map/floor/StaticFloorCatalog.ts`
- `assets/scripts/map/floor/StaticFloorValidator.ts`
- `assets/scripts/map/floor/StaticFloorPreview.ts`

StaticFloorDefinition字段：

| 字段 | 类型/内容 |
|---|---|
| id | start / forest / quarry |
| displayName | 初始营地 / 林地补给区 / 石矿遗址 |
| terrain | TerrainMap，40列×23行 |
| resources | readonly WorldObjectData[]，只含Resource，不重复放base_main |
| monsterGroups | readonly MonsterGroupData[] |
| requiredKills | 3 |
| destinationIds | 长度2，不能包含自己，不重复 |
| cityBuildMask | 与A原始Dirt区域一致，三图共享的只读掩码 |
| rallyCells | 经过导航校验的安全集合候选 |

新增B/C配置在StaticFloorCatalog中即可，不创建第二、第三个Cocos场景。A适配现有三个静态文件：STATIC_MAP；STATIC_WORLD_OBJECTS中过滤Resource；STATIC_MONSTER_GROUPS。base_main独立属于持久城市。

### 3.2 地形

三图40×23，继续32px/格。base_main维持(18,10)，占格4×3。

- A：现有STATIC_MAP深拷贝。
- B：A深拷贝，在外部矩形x=3..10、y=3..8设置Dirt，形成林地营地色块；其余按A。
- C：A深拷贝，在外部矩形x=28..35、y=14..19设置Dirt，形成矿场色块；其余按A。
- 三图城市区域完全相同，不因换层改变城市建筑下面的地形。外部新Dirt仅是视觉地形，不可建造。
- cityBuildMask直接由原始A中TerrainType.Dirt生成；BuildingPlacementValidator增加mask判定。不能使用每张地图当前全部Dirt作为城市边界。
- 集合/出口预留x=18..21、y=13..15，加入WorldCellFlag.Reserved以禁止建造，但不在导航里设障碍。首层初始化即预留，三图一致。

### 3.3 B/C资源点坐标

使用当前WorldVisualId：W=TreeGreen、S=StoneGray、F=FoodPlantRed、G=GoldOreSmall。坐标是左上格坐标，遵循现有gridY口径。

| 地图 | 模板内ID | 资源 | gridX, gridY | 占格 |
|---|---|---|---|---|
| B 林地 | wood_b1 | W | 5, 4 | 2×2 |
| B 林地 | wood_b2 | W | 8, 7 | 2×2 |
| B 林地 | wood_b3 | W | 5, 16 | 2×2 |
| B 林地 | stone_b1 | S | 31, 6 | 2×2 |
| B 林地 | food_b1 | F | 29, 16 | 1×1 |
| B 林地 | food_b2 | F | 33, 17 | 1×1 |
| B 林地 | gold_b1 | G | 10, 18 | 1×1 |
| C 石矿 | wood_c1 | W | 7, 5 | 2×2 |
| C 石矿 | stone_c1 | S | 29, 4 | 2×2 |
| C 石矿 | stone_c2 | S | 32, 8 | 2×2 |
| C 石矿 | stone_c3 | S | 29, 17 | 2×2 |
| C 石矿 | food_c1 | F | 8, 17 | 1×1 |
| C 石矿 | gold_c1 | G | 10, 6 | 1×1 |
| C 石矿 | gold_c2 | G | 32, 16 | 1×1 |

这些点位已按40×23边界、资源占格和中央城市排除范围核对：无资源相互重叠，不进入城市建造区域。怪物guardOffset及集合点还需实现后通过导航检测与实机验收。

### 3.4 怪物与卡片摘要

沿用BlueSlime，engageRadiusCells=3、leashRadiusCells=6，不改战斗基础数值。每组3个成员，使用现有偏移(-1.25,0)、(1.25,0)、(0,-1.25)。

| 地图 | 守卫目标 | 组数 | 实际怪物人数 | 资源点数W/S/F/G |
|---|---|---:|---:|---|
| A | gold_01、gold_02（现有） | 2 | 6 | 1/1/1/2 |
| B | gold_b1 | 1 | 3 | 3/1/2/1 |
| C | gold_c1、gold_c2 | 2 | 6 | 1/3/1/2 |

模板内组ID用forest_guard_01、quarry_guard_01/02；成员ID用组ID加_0/_1/_2。守卫目标必须存在，成员ID在整张模板内唯一。

StaticFloorPreview直接遍历definition.resources按resourceType聚合点数，怪物人数=sum(groups.members.length)。不在卡片中手写第二套数字。可选展示总库存时读取getResourceRuntimeDefinition：当前每种点maxHealth80、yieldPerDamage1，单点总量80；不能套用策划数值表20W/5G的未来参数。

候选definition在进入选择页时固定；卡片点击提交definition.id与本次选择会话ID，加载相同定义，不能再次随机资源或怪物。

### 3.5 实例ID与校验

每次入层分配递增floorInstanceId。资源、组、成员运行时ID均加前缀，例如f2:forest:gold_b1，并同步改写guardedObjectId；base_main、建筑和我方成员ID保持不变。模板对象全部深拷贝，不让采集/死亡修改静态源数据。

校验器在启动及预加载时检查：地图尺寸、ID唯一、requiredKills≤怪物人数、守卫目标存在、资源不与基地/保留建筑/集合区重叠、城市格一致、存在通往资源邻接格的路径、集合位置可用。不得把资源移走或删除保留建筑来偷偷解决冲突。

## 4. 状态机与三击杀计数

新增 `FloorProgressState.ts` 与 `FloorTransitionController.ts`，由MainMapController注入依赖。

状态：Exploring → Ready → Opening → Choosing → Transitioning → Exploring。
取消Choosing返回Ready；Opening失败返回Ready；Transitioning失败恢复Choosing或显示可重试错误，不能放开半切换世界。

- Exploring：击杀计数0/1/2；基地未就绪。
- Ready：计数达到3；基地换图一次，播放短解锁反馈；仍可探索和战斗。
- Opening：基地接受点击后同步进入，立即上锁并暂停；约0.18秒后显示选择页。
- Choosing：世界暂停，UI和建筑反馈时钟仍运行；返回恢复原层，不重置击杀。
- Transitioning：只接受第一次有效选卡，加载、校验与切换成功后才增加层号并清零击杀。

新增 `FloorKillTracker`（可放在FloorProgressState文件）：

recordEnemyDefeated({floorInstanceId, enemyId})只接受当前层且预先登记的敌人ID，使用Set去重。事件来源在MonsterCombatController.die首次进入Dead后，通过setup注入的回调上报；不在render清场、onDestroy或资源depleted中统计，不按group清空计数。重复命中、死亡延迟回调、旧层事件均不得再次计数。

保留原group.notifyMonsterDeath逻辑；新回调不能替代战斗组通知。Ready之后显示min(killed,3)/3，内部可保存真实击杀数。

## 5. 基地换图与独立视觉节点

### 5.1 已上传素材

| 状态 | 图片路径 | SpriteFrame UUID |
|---|---|---|
| Locked | assets/art/buildings/towncenter0.png | 89b116e7-6b29-4acd-b553-625ac46f5e4a@f9941 |
| Ready | assets/art/buildings/towncenter1.png | a5e06615-45ef-414d-9a35-32431801e4a9@f9941 |

两张原图128×128，但meta裁切尺寸分别104×107和91×104、offset也不同。不能直接根据trim尺寸改节点大小，否则换图会跳位置/缩小命中框。

新增 `BaseVisualAssetLoader.ts` 及 `BaseDescentView.ts` 于map/floor目录：沿用当前assetManager加载方式，允许MainMapController Inspector显式绑定两帧，未绑定时按上表UUID加载。启动预加载，失败明确报错且阻止进入此原型，不虚构新UUID。

BaseRoot继续4×3逻辑占格；本轮将基地逻辑Root固定scale=1，UITransform按世界尺寸128×96px设置，不能继续叠乘旧GRID_RENDER_SCALE=2。VisualRoot采用固定128×128原始画布、底部对齐基地占格底边，局部初始尺度0.75使画面宽96px。实现时统一关闭trim显示或用两张完整Texture创建同尺寸SpriteFrame，避免裁切offset引入抖动；实机按素材底边校准一次，不改变碰撞占格。直接帧与完整帧方案选一种统一使用。

基地命中区域保持固定，不随Ready换图或弹性动画变化。卡片/tooltip文字显示击杀进度和“点击选择下一层”。

### 5.2 建筑节点职责

逻辑Root拥有：世界位置、固定UITransform命中区域、ID、HoverInfoTarget、点击入口。
VisualRoot拥有：Sprite与缩放反馈，默认局部比例(1,1,1)。
若资源已有HitFlash则保持原链路；建筑反馈不得缩放HP条、命中框、网格、父MapRoot或导航数据。

对普通建筑，把现有definition.visualScale作为固定基准缩放保留，动画只乘在VisualRoot上。底部锚点通过VisualRoot局部位置补偿，保证新增子层级前后静态外观一致。

## 6. X/Y分离的弹性与震荡函数

新增 `assets/scripts/feedback/ElasticFeedbackMath.ts`（纯计算）和 `BuildingElasticFeedback.ts`（Component），配置放 `BuildingElasticFeedbackConfig.ts`。不能给每次hover创建一条永不取消的Tween，也不能每次点击把当前放大结果当新基准。

每轴保存value、velocity、target，使用阻尼弹簧：

acceleration = −ω²(value−target) − 2ζω velocity
velocity += acceleration × h
value += velocity × h

X/Y独立参数与状态。把每帧dt上限裁为0.05秒，再切成h≤1/120秒的子步；低帧率允许轻微慢放，避免积分发散。重入从当前value/velocity继续，不跳回1。误差<0.001且速度<0.01时吸附目标并归零。

| 参数 | X | Y |
|---|---:|---:|
| ω | 22 | 26 |
| ζ | 0.58 | 0.52 |
| idle目标 | 1 | 1 |
| hover目标 | 1.04 | 1.06 |
| 点击速度脉冲 | +2.2 | −3.2 |
| 最大累计速度绝对值 | 4 | 4 |
| 防异常缩放范围 | 0.80～1.20 | 0.80～1.20 |

点击产生先横向展开/纵向压缩，再回弹的不同步反馈；hover退出把目标设回1；连续点击只追加有界脉冲，不叠无限动画。移动端没有hover，点击结束回idle。

另外导出可复用衰减震荡函数：
oscillation(t,A,λ,f,φ) = A × exp(−λt) × sin(2πft＋φ)。

点击位置震荡默认A_x=1.5px、A_y=0.8px，λ=12，f_x=11Hz、f_y=14Hz，φ=0，最长0.30秒；基于固定局部原点附加位移，不能把每帧偏移加回当前位置形成漂移。hover只做弹性缩放，不持续震动。取消/禁用/销毁调用reset，恢复基准位置比例、清空所有速度和震荡时间。震荡仅作用视觉子节点，不震动地图或影响命中。

## 7. 集中拾取与点击优先级

保留一个HoverInfoController，鼠标只记录屏幕位置，lateUpdate重新拾取；同一控制器统一发出原始目标enter/exit通知，建筑反馈无需等待tooltip延迟。

补齐旧Scope规则：

- HUD对象：UITransform.hitTest(screenPoint, windowId)。
- World对象：使用MainMapController注入的唯一游戏Camera，将屏幕点映射到世界，再转目标逻辑Root局部坐标，按固定矩形测试。当前2D正交平面下按旧Scope方案实现；若相机配置变化，必须改成射线与地图平面求交，不能硬猜深度。
- UI优先于World；保留当前Monster300、Building200、Resource100、Base90的顺序。同优先级重叠时用显示层级/稳定ID打破平局。
- 鼠标静止而地图平移/缩放时也重新拾取；动画变化不改变命中Root，因此不因缩放循环进出hover。
- unregister、失活、打开页面、建造模式切换都必须发送exit，不能仅清tooltip引用留下建筑放大。

新增 `WorldObjectInteractionController.ts`，负责点击资格与路由，复用上述拾取函数而不另建hover状态机。触摸按实际touch位置拾取，不使用最后鼠标位置。WorldObjectView旧TOUCH_END派发与新入口只能有一个生效路径。

一次世界点击成立条件：主指针按下/抬起命中同一对象、移动距离≤8屏幕像素、非右键/非多指缩放、未被UI/建造工具/拖图消费。由新增共享WorldInputGate记录手势token，Viewport标记已拖动；触摸模拟鼠标的同一次动作只处理一次。

路由顺序：

1. 选择页/加载态阻断全部世界输入，包括全局input监听、滚轮、数字选队、建造快捷键。
2. 建造模式由BuildToolController消费；不顺带点击建筑/基地。
3. Base：播放反馈；Ready则调用tryOpenSelection()，否则只显示进度。无需选中小队。
4. Building：播放反馈；保留以后打开面板的接口，本轮没有额外业务。
5. Resource：转给WorldCommandController现有派兵方法；不改变资源命令语义。

WorldCommandController新增public issueObjectCommand(objectId)及clearAllTargets()，内部保留现有队伍选择/旗帜逻辑；setup不再给基地绑定回城指令。动态新资源由新拾取入口处理，无需每层重装WorldCommandController。

输入门禁是逻辑阻断，不能只在HUD上加透明节点：WorldViewportController、BuildToolController、SquadSelectionController等现有全局监听也必须检查同一门禁。

## 8. 下一层选择页面

新增 `assets/scripts/ui/floor/FloorSelectionController.ts`、`FloorDestinationCardView.ts`、`FloorSelectionUiConfig.ts`。

挂在Canvas/HUDRoot/FloorSelectionRoot，始终位于普通HUD和HoverInfoLayer之上，不受MapRoot pan/zoom影响。使用项目现有UI资产；缺少专用卡面时以Graphics绘制底板配Label，不新增AI图片、不假设未上传的资源图标。

参考1280×720：左右卡各宽360、高400，间隔48，居中；标题“选择下一层”，卡片依次地图名称、资源行（木头×3等）、敌人“史莱姆×3”、行动提示。按视口宽度等比缩小并保持两列，不越界；触摸点击区域覆盖卡片主体。卡片摘要标明数量是“资源点”及“敌人人数”，不混用库存或营地组数。

Opening阶段锁输入后暂停世界；Choosing允许返回/Esc恢复原层。Transitioning显示“前往中…”，禁用卡与返回直至成功或受控失败。页面关闭释放本次输入token并恢复隐藏HUD，不重复订阅监听。

禁止director.pause()一停全局导致选择页和反馈动画也停止。WorldSimulationGate只暂停战斗/移动/采集相关逻辑，HUD与反馈照常update。

## 9. 世界模拟暂停与旧层引用清理

新增 `WorldSimulationGate.ts`，把gate注入Brain、Squad/Warrior Motor、Engagement、Squad/Warrior Combat、MonsterGroup/Monster Combat/MonsterMotor、攻击Animator推进及Lifecycle更新。暂停时它们不推进时间；CombatEventHub.emitAttackImpact作为最后防线返回null，防止同帧残余攻击改变HP/库存。

门禁不修改HP，不调用HealthComponent.setup。所有新的延迟任务捕获floorInstanceId与transitionToken；旧层回调即使到达也只做旧对象本地清理，不改当前注册表或计数。取消选择时恢复旧层原指令与动画进度；不要在单纯打开页面时清除命令。

只有玩家真正选卡后，开始以下清理：

- SquadBrain新增prepareForFloorChange()，清active/pending/commandTargetId、guardEncounterRequested和返程标志。
- SquadCombatController清currentGroup、guardDefeatedPending并释放claims；各WarriorCombatController.exitCombat停止旧目标。
- SquadEngagementController新增resetForFloorChange()，立即清目标、slot映射、队形交互状态与消耗标志；不能只调用cancelAndReform等待旧世界寻路结束。
- SquadMotor.stop并清arrived标志；WarriorMotor新增立即恢复阵型接口；攻击动画停到Idle，清旧攻击帧回调资格。已死亡成员继续Dead，不因playIdle恢复可攻击。
- WorldCommandController.clearAllTargets隐藏并清旗帜；Hover清世界目标与tooltip；BuildToolController.cancel隐藏Ghost。
- Lifecycle.clearPendingForFloorChange()取消旧资源延迟删除；MonsterAttackReceiver新增幂等dispose，ResourceReceiver沿用现有dispose。
- 怪物组Registry新增clear/replaceAll；WorldObjectRegistry新增replaceResources，在同一实例里保留base_main、替换Resource条目。
- 不能调用BuildingEffectSystem.dispose或重跑STATIC_SQUADS render。

## 10. 持久城市与层世界的切换事务

### 10.1 持久/刷新边界

| 保留同一实例 | 每次入层刷新 |
|---|---|
| BaseRoot、BuildingRoot及所有建筑Node | TileRoot下地形节点 |
| BuildingRuntimeRegistry、BlueprintInventory | ResourceRoot下资源Node和剩余采集量 |
| ResourceInventory、CombatStatModifierRegistry | MonsterRoot下怪物组和成员，恢复模板初始HP |
| SquadRoot、squadHandles、成员Health/Stats | 旧层命令、claims、导航路径、目标旗帜 |
| HUD/选队控制器、建筑效果系统 | floorInstanceId、击杀Set、基地Ready状态 |
| WorldNavigator及其NavigationGrid对象身份 | 导航格与WorldCellGrid内部内容 |

主基地坐标不动，建筑位置不动。队伍位置归位是转场语义，血量与生死不变。我方死亡单位不能靠换层重生。

### 10.2 为什么原位更新依赖

当前Brain、Motor、Navigator、PlacementService、Lifecycle持有旧注册表/导航引用。只给MainMapController字段赋一个新对象，会造成部分系统仍在旧地图寻路。

新增：
- NavigationGrid.replaceFrom(candidateGrid)：尺寸相同后复制cells。
- WorldCellGrid.replaceFrom(candidateGrid)：尺寸相同，复制flags及owner记录。
- WorldObjectRuntimeRegistry.replaceResources(resources)：保留Base，仅替换Resource数据，拒绝ID冲突。
- MonsterRuntimeRegistry.replaceAll(groups)：替换组引用。
- terrainMap外层引用保持，逐行替换拷贝后的内容；所有持有terrainMap的使用方仍看到当前层。

候选导航构建不能只调用现有NavigationGridBuilder.build(map, worldObjects)，因为它没有包含动态建筑。必须额外用BuildingRuntimeRegistry中每个definition的footprint重新block；预留集合区只禁止建设，不阻挡通行。

### 10.3 两阶段加载与失败恢复

prepare阶段（Choosing转Transitioning后）：
1. 固定选中definition、生成新实例ID并深拷贝资源/怪物。
2. 加载所有必要帧、建立candidate地图与占格/导航，在临时容器生成下一层节点。
3. 临时节点未激活模拟、未注册到live CombatEventHub/hover/registry；需给renderer拆出createPrepared与activateBindings，不能直接调用当前render在准备阶段破坏现有Root。
4. 校验所有现存建筑占格、城市地形、集合候选、卡片摘要和生成对象数量。
5. 任一步失败销毁临时节点，保留旧世界原样，回到Choosing显示错误，可重试/返回。

commit阶段应集中同步完成，中间不await：
1. 保持门禁，记录回滚包：旧层资源/怪物根与注册表快照、地图格、击杀状态、队伍瞬态与位置。
2. 冻结/显式解绑旧层receiver、hover与延迟工作，按第9节清部队旧引用。
3. 原位替换地图/注册表/占格导航，挂接候选根并激活新receiver/hover。
4. 把存活部队放入集合位置，按成员阵型恢复局部位置；保留Health/Stats实例。Brain进入HomeIdle，保留选中小队ID；相机回到城市默认视角。
5. 提交新层号和floorInstanceId，清击杀Set、基地恢复towncenter0，关闭页面。
6. 成功后才dispose/destroy旧层节点，清空旧对象字典和延迟任务，最后释放世界门禁。

回滚包不是长期存档；commit抛错时应先拆除候选绑定，恢复旧对象引用、格数据和队伍瞬态，再回Choosing。旧节点在commit成功前不得destroy。如果某异常无法回滚，保持世界锁定并显示重试/重新开始，不允许半新半旧状态继续运行。先将易失败的资源加载、坐标校验和节点构造移到prepare，缩小commit失败面。

只清除floor-owned节点。不要removeAllChildren(MapRoot/WorldObjectRoot/ActorRoot)，也不要在成功后再调用全量bootstrap。

### 10.4 集合区

默认两个队伍中心使用(19,14)、(21,14)，按现有阵型偏移安排存活成员。实现前对每个实际成员位置及移动入口校验导航；如不可用，在预留集合区按确定性BFS找最近合法中心/格子，禁止放进基地、资源或建筑。

本轮当前两队各4人足够使用上述区域；若运行态已有更多队伍/成员，应在prepare校验容量并扩充合法候选区配置，不截断成员、不删除部队。全灭队保留死亡状态，不重新render四人。出生区与主基地出口必须可连接外部资源邻接格。

## 11. 文件级施工顺序

| 步骤 | 文件与工作 | 完成标志 |
|---|---|---|
| 1 | 新建FloorTypes/Catalog/Validator/Preview；将A适配现有数据，增加B/C坐标与组 | 静态校验通过，预览统计A6/B3/C6敌人 |
| 2 | MainMapController提取RunRuntimeContext；持有服务、controller、registry | 现有单层启动行为不回归；只bootstrap一次 |
| 3 | FloorProgressState/TransitionController、MonsterCombatController死亡回调、BaseDescentView/AssetLoader | 第3个真实死亡换图；未点基地不弹页 |
| 4 | WorldObjectRenderer与BuildingRenderer拆视觉子节点；添加弹簧函数和反馈组件 | 普通建筑与基地有反馈，逻辑命中不抖 |
| 5 | HoverInfoController Scope命中、enter/exit订阅；WorldObjectInteractionController/InputGate | 放置、拖图、UI、资源指令与基地点击互不串行 |
| 6 | FloorSelection UI与SimulationGate | 左右正确摘要；打开页不掉血/采集，UI可动画与返回 |
| 7 | Renderer准备/激活/释放接口；Registry/Grid原位replace；部队reset/relocate接口 | 切层无旧目标，建筑/部队实例及HP一致 |
| 8 | 串联prepare/commit/rollback与集合校验 | A→B/C及后续循环可用，失败能返回 |
| 9 | 场景绑定与实机验收 | Main.scene素材引用、输入门禁、各种切换竞态通过 |

新增RunRuntimeContext.ts放map/floor；MainMapController仍为composition root，业务规则留给专门模块。WorldObjectInteractionController、WorldInputGate放command目录。两个registry/grid只增加需要的生命周期接口，不改成全局单例。

所有新建.ts文件遵守根AGENTS.md，以以下三段文件级注释开头：Why this file exists / Ownership boundary / This file deliberately does NOT。Cocos导入生成.meta并随代码提交，不拷贝其他文件UUID。

## 12. 验收矩阵

| 测试 | 预期 |
|---|---|
| 击杀0、1、2个 | 基地towncenter0；点击不下潜、不派回城 |
| 击杀第3个 / 同一敌人多次受击 | 只进入Ready一次，显示towncenter1 |
| 未清另一组怪 | 仍可点击基地选择下一层 |
| 清资源、销毁尸体、转场清怪 | 不增加击杀数 |
| 基地无选中队伍时点击 | Ready可打开页面 |
| 连点基地、连点左右卡 | 只打开一次，只切换一次 |
| Hover后平移/缩放地图、鼠标不动 | 目标正确变化；退出后建筑回原比例 |
| 连续点击100次、低帧率 | 无无限变大、负比例、位置漂移或Tween堆积 |
| 拖图从基地上起手并松开 | 不打开页面；移动端无幽灵点击 |
| UI覆盖基地/处于建造模式 | 点击不穿透，建造取消逻辑正常 |
| 打开选择页 | 战斗、采集、世界移动暂停；两卡及反馈仍能动画 |
| 返回/Esc | 原层资源、击杀、战斗进度保持，门禁释放 |
| B/C卡片 | B显示W3/S1/F2/G1与3敌人；C显示W1/S3/F1/G2与6敌人 |
| 采空/采一半资源后换层 | 新层资源满量；库存不清零、不额外发资源 |
| 建筑增攻后换层3次 | 建筑ID、坐标、Node身份及效果不变，不重复叠加 |
| 部分成员受伤/死亡后换层 | 存活人数、死亡状态、HP、modifier保持 |
| 点击时正处于攻击命中帧/资源0.12秒待删除 | 新层不被旧回调扣血、删资源、释放错误占格 |
| 返回曾访问地图 | 资源和怪物重新创建，kill归零，运行ID不同 |
| 地图循环10次 | 无duplicate receiver、遗留hover、无效target；接收器/监听数量不随访问次数累积 |
| 缺素材或候选校验失败 | 旧层可恢复，不消耗库存、不丢建筑部队 |

轻量自动校验仅覆盖有实际风险的部分：目录配置/摘要、kill去重与层隔离、网格占格/通路、弹簧在不同dt下有限收敛。输入手感、素材对齐及完整切层必须在Creator预览中测试。当前package.json没有测试脚本，不宣称npm test已通过；实现时接入项目真实编译/预览流程。

## 13. 本次文档归档

新增当前方案：
`instructions/TowerDown_StaticFloor_Descent_ElasticFeedback_V1.md`

原样移动：
- `instructions/TowerDown_Hover_CentralPicking_Patch_V2.md` → `instructions/deprecated/TowerDown_Hover_CentralPicking_Patch_V2.md`
- `instructions/TowerDown_Hover_ScopeHitTest_Patch_V2.1.md` → `instructions/deprecated/TowerDown_Hover_ScopeHitTest_Patch_V2.1.md`

不移动根目录GDD、数值表、docs/superpowers规格或既有deprecated内容。归档仅表示新方案为本轮执行入口，不表示旧方案所有要求已实现；第2、7节明确了仍需补齐的Scope命中逻辑。
