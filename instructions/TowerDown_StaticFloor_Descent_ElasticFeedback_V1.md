# TowerDown 杀敌计数与基地全屏面板技术方案 V1.1（最小版）

> 本文替代同路径原V1大方案，沿用文件路径以免已有链接失效；文件名中的StaticFloor/Descent/ElasticFeedback不再代表本轮工作范围。
> 本轮仅做：杀敌计数达到3 → 基地换图并可点击 → 打开Hover同款样式的大面板 → 点击唯一“返回”链接关闭。
> 仅更新技术方案，尚未实现或运行验收。依据当前MainMapController、MonsterCombatController、WorldCommandController和Hover面板代码编写。

## 1. 最小行为

| 状态 | 基地 | 点击结果 |
|---|---|---|
| 杀敌0～2名 | towncenter0 | 不打开面板，不向部队发回城命令 |
| 杀敌达到3名 | towncenter1 | 可打开主屏幕面板；无需选中队伍 |
| 面板已打开 | 保持towncenter1 | 重复点击不创建第二个面板 |
| 点击“返回” | 保持towncenter1 | 关闭面板回到当前游戏画面，可再次打开 |

计数按敌人成员，不按怪物组。第三个敌人死亡只使基地就绪，不自动打开面板。达到条件后不消耗计数，不要求清空地图。

面板内**仅一个“返回”文字链接**，其余留空。不加标题、左右卡片、资源预览、确定按钮或占位说明。点击空白不关闭；初版只实现“返回”这一关闭入口。

保持当前静态地图和战斗规则。本轮不做新地图、资源刷新、建筑/部队迁移、下潜结算、弹性缩放、震荡函数、Hover拾取重构、存档或通用切层框架。已归档的旧Hover方案仍留在deprecated，不重新纳入本轮工作。

## 2. 杀敌计数器

新增 `assets/scripts/combat/EnemyKillCounter.ts`，为普通TypeScript类，由MainMapController创建并注入。本轮只有当前场景，不引入floorInstanceId。

建议接口：

- constructor(validEnemyIds: readonly string[], requiredKills = 3)
- recordDefeat(enemyId: string): boolean：首次有效记录返回true，未知或重复ID返回false。
- getCount(): number
- isReady(): boolean
- subscribe(listener): () => void：立即通知当前快照，并返回取消订阅函数。

内部使用已知敌人ID集合和已击败ID集合。validEnemyIds由STATIC_MONSTER_GROUPS的members展平产生；不要用worldObjectRegistry中的资源ID。真实计数可超过3，UI进度显示min(count,3)/3。就绪状态从false变true只发生一次。

### 死亡接入点

修改 `assets/scripts/monster/MonsterCombatController.ts`：

1. setup配置增加可选onDefeated: (enemyId: string) => void并存为字段。
2. 当前die已有Dead状态防重入。保留该判断，在首次进入Dead并完成原战斗组通知后，调用onDefeated(this.id)。
3. 保留现有releaseTarget、stop、playDead、group.notifyMonsterDeath和0.12秒后destroy逻辑。
4. 不在onDestroy、受击次数或怪物组清空事件里计数。资源采集耗尽也不计数。
5. 销毁时清理自己保存的回调引用和订阅；不能在dispose中补发死亡。

修改 `MonsterGroupRenderer.ts`：通过构造参数或render依赖传入死亡回调，创建每个MonsterCombatController时注入。MainMapController统一连接到counter.recordDefeat。CombatEventHub继续只负责攻击命中路由，无需增加新的全局事件总线。

计数生命周期随MainMapController/当前场景；正常销毁后释放订阅，重启场景重新创建计数器。打开/关闭基地面板不重置计数。

## 3. 基地换图与点击

### 素材

| 状态 | 图片 | SpriteFrame UUID |
|---|---|---|
| 未就绪 | assets/art/buildings/towncenter0.png | 89b116e7-6b29-4acd-b553-625ac46f5e4a@f9941 |
| 就绪 | assets/art/buildings/towncenter1.png | a5e06615-45ef-414d-9a35-32431801e4a9@f9941 |

两张图原始尺寸128×128，裁切尺寸不同。固定显示尺寸及对齐基准，换图不修改base_main的ID、gridX/gridY、4×3占格和导航。用固定原始画布显示，不能按两帧裁切宽高各自调整命中框。

新增 `assets/scripts/ui/base/BaseInteractionController.ts`，负责订阅计数、切换基地SpriteFrame、打开/关闭面板；不处理怪物伤害。

MainMapController可通过两个Inspector SpriteFrame字段加载，未配置时按上表UUID预加载。两张图及Hover背景准备完成后再启用基地面板入口；资源加载失败要报明确错误，不创建无法返回的空白遮罩。

`WorldObjectRenderer.ts`增加getView(objectId)或getNode(objectId)只读访问，用于找到base_main。只对基地Sprite增加固定视觉子节点/对齐处理（如需要），不重构全部建筑渲染。现有Base根缩放为GRID_RENDER_SCALE=2，必须计入最终显示尺寸，不能把128px画布又无意放大一倍。建议视觉最终宽约96px，保持底部对齐；实际按素材校准。

### 接入现有点击链

继续使用WorldObjectView已有点击入口，无需新建全地图点击管理器。

WorldCommandController的setup配置增加onBaseClicked回调，在onWorldObjectClicked内按顺序处理：

1. 若建造模式或面板已打开，直接返回。
2. 查询objectId对应对象；若kind为Base，调用onBaseClicked并return。
3. 其他对象继续原有选中队伍检查和派兵流程。

**基地分流必须发生在“是否选中队伍”的判断之前。**未就绪点击不派回城、不打开页面；就绪点击打开一次。不要再给同一个WorldObjectView绑定第二条点击监听，避免覆盖或重复触发。

若现有TOUCH_END会把拖图释放误当点击，仅在WorldObjectView增加按下/抬起位置与单指判断：移动超过8屏幕像素、取消触摸或多指手势不算点击；沿用一个点击事件入口，不同时监听鼠标释放再派发一次。这是防误触的小补丁，不引入新的拾取系统。

基地原Hover内容可增加“击败敌人 X/3”；就绪后显示“点击打开”。不添加独立杀敌HUD，计数通过基地Hover即可观察。

## 4. Hover同款大面板

新增 `assets/scripts/ui/base/BasePanelView.ts`，由BaseInteractionController控制。只创建一次，初始隐藏，通过open/close切换，不每次实例化。

节点挂在：
`Canvas/HUDRoot/BasePanelRoot`
位于普通HUD和HoverInfoLayer之上，跟随HUD尺寸，不受MapRoot平移/缩放影响。

### 复用方式

- 直接使用MainMapController已加载的HoverInfoAssets.backgroundFrame。
- 背景样式沿用HoverInfoPanelView：Sprite.Type.SLICED、Sprite.SizeMode.CUSTOM、同款背景帧和颜色。
- 现有HoverInfoAssetLoader已经设置四边8px九宫格边距，复用该帧，不另复制图片、不修改公共帧的边距。
- 不把现有Tooltip节点挪过来，也不直接复用固定宽316的HoverInfoPanelView布局；大面板独立尺寸，只复用外观。
- 不注册为Hover目标，不显示延迟、不随鼠标移动。

### 尺寸与唯一控件

Root覆盖整个HUD，可拦截全屏输入。框体四边留16个UI单位边距；1280×720参考视口下框体为1248×688，尺寸变化时重新计算。背景采用九宫格扩展，不把整张小图等比例拉伸。

面板左上角内边距24px放“返回”链接：字体18px、颜色沿用Hover标题的浅金色(255,238,186)，文字可加下划线体现链接感。点击区至少80×44px，文本仍是普通链接外观，不加按钮底板。使用独立Label和点击区域即可，不需要网页链接或RichText事件解析。

点击返回只执行close：隐藏Root，恢复普通HUD输入和Hover。保持地图、已建建筑、队伍、库存、杀敌计数与基地就绪状态。返回不是重启场景或回主菜单。

## 5. 面板期间的输入边界

初版采用**只阻断玩家操作，后台保持当前战斗/采集模拟运行**。返回时显示当前实时状态，不做暂停、恢复或快照系统。这个选择用于保持本轮实现最小；若以后需要暂停，单独安排，不夹带进本次方案。

必须阻断面板背后的鼠标、触摸、拖图、缩放、建造及选队输入：

- BasePanelRoot添加BlockInputEvents，覆盖整个HUD；“返回”子控件正常接收事件。
- 透明遮罩不能单独拦住全局input监听。将panel.isOpen加入WorldCommandController的现有inputBlockedPredicate。
- WorldViewportController/BuildToolController使用现有excludedUiNodes机制追加面板Root，保留原蓝图/队伍UI排除节点；检查inactive面板不会继续拦截。
- 对数字选队、建造快捷键、建造入口select等绕过命中检测的路径，补充轻量isUiBlocked谓词；面板打开时提前return。不需要建立通用InputGate框架。
- 打开时先设isOpen=true，再取消当前建造工具、显示面板，避免同一点击继续产生世界行为。
- HoverInfoController增加最小setSuspended(boolean)接口，暂停时清当前/候选Hover并立即隐藏提示，停止重新拾取UI和World；关闭后恢复。不能只禁用World Hover，留下HUD Tooltip盖住面板。
- 返回点击必须在BasePanelRoot上消费，不透传到底下的基地；如现有事件时序会透传，将解除逻辑门禁延到当前输入派发结束，视图可立即隐藏。
- 重复open/close幂等。onDestroy注销所有计数订阅与点击监听。

本轮不暂停director、不重置队伍命令、不调用HealthComponent.setup，也不处理切层旧目标清理。

## 6. 文件修改清单与施工顺序

| 顺序 | 新增/修改文件 | 工作 |
|---|---|---|
| 1 | 新增combat/EnemyKillCounter.ts | 唯一ID计数、3杀阈值、订阅 |
| 2 | 修改monster/MonsterCombatController.ts、MonsterGroupRenderer.ts | 真实死亡边沿回调并注入计数器 |
| 3 | 新增ui/base/BasePanelView.ts | 九宫格主屏幕框、唯一返回链接 |
| 4 | 新增ui/base/BaseInteractionController.ts | 计数订阅、基地两帧切换、面板状态 |
| 5 | 修改world/WorldObjectRenderer.ts、command/WorldCommandController.ts | 暴露基地节点，点击优先分流 |
| 6 | 修改map/MainMapController.ts | 创建依赖、加载素材、注入回调和面板 |
| 7 | 修改Hover及有全局输入的少量控制器 | 面板遮挡、快捷键阻断、关闭后恢复 |
| 8 | 需要时修改WorldObjectView.ts | 拖动/取消手势不触发点击 |

不新建FloorTransitionController、StaticFloorCatalog、SimulationGate或ElasticFeedback文件。不修改STATIC_MAP、STATIC_WORLD_OBJECTS、STATIC_SQUADS及资源经济配置。

所有新.ts按根AGENTS.md添加文件级说明：Why this file exists / Ownership boundary / This file deliberately does NOT；生成并提交各自.meta，不复制旧UUID。

## 7. 验收

| 操作 | 预期 |
|---|---|
| 击败0、1、2个敌人 | Hover进度对应；基地未就绪，点击无业务动作 |
| 击败第3个敌人 | 基地换towncenter1一次，不自动弹窗 |
| 同一敌人重复命中/节点销毁 | 不重复计数 |
| 采空资源或销毁未死亡的怪物节点 | 不算击杀 |
| 无选中小队时点击就绪基地 | 大面板正常打开 |
| 查看面板 | Hover同款框占主屏幕，内部仅“返回”链接 |
| 面板上点击/拖动/滚轮/按选队建造快捷键 | 不操作背后的世界；后台模拟继续 |
| 点击空白 | 面板保持打开 |
| 点击返回 | 关闭面板，不回主菜单、不清库存或计数；无点击穿透 |
| 返回后再次点击基地 | 可再次打开；不重计杀敌、不重复创建节点 |
| 快速连点/连续开关20次 | 仅一个面板、一个计数订阅，无输入锁残留 |
| 窗口缩放/不同HUD尺寸 | 面板边距与返回点击区正常，九宫格边框不拉花 |
| 地图拖动从基地上起手 | 不误打开面板 |

自动验证只需覆盖计数器的有效ID、去重和阈值；换图、九宫格、触摸和输入遮挡使用Creator预览验收。本次是方案更新，不宣称上述功能已实现或测试通过。
