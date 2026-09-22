# TowerDown 兵营、动态队形、死亡与移动修复方案 V1.1：逐脚本实施详解

> 基于远端 main a976aab1d2f94300226b644214a1093d5e988930（reform）。本次交付技术方案，不修改运行时代码。已重新核对远端ada3b9b，运行时代码仍为a976aab。第9～16节将前文目标细化为明确接口；冲突时以详细节规定的调用顺序为准。
> 本轮用户重新确认：保留免费首营、第二营正常收费、两队与动态扩编。此确认优先于上一轮“延期扩编/未来预置兵营”的范围限制。不要回退现有扩编功能。

## 1. 现状与目标

已核对最新代码：
- PrimitiveRunState已有免费首营、第二营收费与两队限制，但spawnPoint硬编码为(19,14)/(21,14)，homeObjectId始终base_main。
- SquadRenderer已追加真实成员；getFormationOffset循环旧四人偏移，每组下移0.65格。不是完全没有扩展，但不足以避免图像重叠。
- WarriorCombatController.die只停止移动、播放idle并设Dead，不隐藏Sprite或血条。HealthBarView只把fillRange设0，边框仍在。
- SquadEngagementController分配采集位及处理impact没有存活过滤；隐藏图片不能解决死亡成员仍被下指令的问题。
- 当前剑士整体移动和局部移动均2格/秒，本轮改为8格/秒；不改攻击速度、怪物速度、动画播放速度或游戏全局时间。
- FloorTransitionController.retryPending没有UI调用处；pending存在时choose被拦截。MainMapController的finally无条件清战斗阻断，提交失败后的状态可能继续运行。

目标：两个营地产生两队，各自从营地下方出发；1～16人具有独立且清晰的待机/归队位置；死亡当帧消失且停止参与行为，下层恢复；切层与扩编失败可恢复且不重复发资源/成员。

## 2. 免费首营、第二营与兵营出生点

### 2.1 建造规则

- 第一座剑士营有效落地免费并创建4人；第二座消耗40木/20石并创建另一支4人队伍；最多两支绑定队伍、两座营地。
- 首营权益仅在整个建造事务成功后消费；取消预览、钱不够、不可放、生成失败不消费，也不残留建筑/部队/占格。
- 原有costResolver保留，卡片价格、affordable、Ghost校验及实际扣款共用同一结果。首营成功后立即刷新全栏，第二营显示40W/20S；落地第二营后显示上限原因。两队有独立ID、颜色、快捷键和命令状态。
- 每营每层20F扩编1人至16；招募与免费恢复战损分开，不因死亡腾出永久队伍位。
- 使用稳定队伍位1/2，不把递增nextSquadSequence直接当commandSlot。首营失败重试仍使用空闲位1，第二队始终位2；实体唯一ID可递增有空洞。
- registerBarracksPlacement按buildingId幂等；重放回调不能创建第二队。成功后不能重复领取免费权益。
- 本轮不新增拆营/换绑玩法入口；若现有入口允许拆营，禁止其绕过两队上限或重新送4人。已拥有队伍及首营已消费状态不能随建筑移除而重置，重绑行为留显式后续规则。

### 2.2 从实际兵营下方出生

新增BarracksSpawnResolver，查询BuildingRuntimeRegistry与BuildingCatalog，不能把建筑ID硬塞给只查询WorldObjectRuntimeRegistry的getHomeObject。

已知营地左上格(x,y)，宽w高h；本项目格坐标y增大表示画面向下。门前期望中心x=x+w/2，门前候选行从y+h开始，取可走格中心（+0.5）。按第3节全队offset反算队伍中心，使最前一排在营地下方第一片合法空间。

- 移除PrimitiveRunState中的固定spawnPoint与MainMapController切层时baseX/baseY+队伍序号的硬编码。
- 队伍归属记录boundBarracksId；基地ID可继续表示城市归属，但出生/归队参考必须显式查询绑定营地。给SquadRenderer/Brain注入解析出的homeAnchor/homeBounds，覆盖初次创建、空闲归队和切层整备。
- 优先下方，向下及左右按稳定距离顺序扩展搜索；必须在同一可达地面区域，不能穿墙选到隔离空地。检查地图边界、导航阻挡、建筑占格，以及同批另一队已预留的位置。
- 找不到能容纳4人的出生区，建造预览标记“营地下方空间不足”，提交再次校验，拒绝并原样保留资金和权益。不能落成后传送到主基地或墙里。
- 下潜prepare时为所有恢复/扩编后的成员预计算营地下方落点，整个位置集合统一预留；无合法位置则在任何经济扣款前报告错误。本轮静态地图可据此调整建筑位置，不偷偷丢兵。

## 3. 动态队形与成员身份

新增纯函数SquadFormationLayout，生成一次完整offset列表，取代SQUAD_FORMATION_OFFSETS和0.65叠排。坐标单位为格，不是像素；只在最终同步节点时调用gridOffsetToLocalWorld。

起调规则：
- n=0返回空；n为1～16时columns=min(4,ceil(sqrt(n)))，rows=ceil(n/columns)。
- 以1.1格为水平和垂直间距。每行k名成员，列j偏移x=(j-(k-1)/2)*1.1；行r偏移y=(r-(rows-1)/2)*1.1。
- 不满行单独居中。示例：4人为2×2，5人为3+2，9人为3×3，16人为4×4；禁止index取模后重用同一位置。
- 当前士兵渲染约32×32世界单位，1.1格约35.2单位是初始间距。血条及轮廓仍遮挡时调整间距参数，不缩小单位去掩盖布局错误。

位置分配以稳定memberId为身份，数组index不能因死亡被压缩后变成另一名士兵的ID。队形槽位与战斗实体ID分离；spawn、扩编、死亡收拢、下层复活使用同一布局器，按稳定成员顺序分配。

WarriorMotor新增setFormationOffset(offset,{snap})：只更新目标槽位，不重新setup、不重置属性/监听。出生和切层复活允许snap；正常归队平滑移动；战斗中只更新未来归队槽位，不强制把交战士兵拉回阵型。死亡成员不占活人展示槽位，活人待机/归队时收拢；复活后按全部编制重排。

阵型仅在成员集合或相关布局状态变化时重算，不能每帧排序。先算全队新offset，再一次应用，避免新增成员使用新布局、旧成员仍留在四人布局。

### 3.1 行进边界

本轮是动态阵型与归队位置修复，不宣称已经实现完整单列跟随、局部避障或群体碰撞。现有SquadMotor负责路径、WarriorMotor负责局部偏移；不得新加另一套同时写位置的组件。

必须测试窄路和转角：大队形offset可能落到障碍格。至少在出生/切层拒绝无效落点；行进时若固定阵型越障，明确作为未完成项，进入独立路径队列实现，不以主队中心可通行冒充16人均可通行。需要推进到真实窄路队列时，单开路径跟随子任务，不在此次补丁中暗中重写导航。

## 4. 死亡表现、行为与复活

### 4.1 保留编制，立即隐藏

不销毁死亡士兵的永久编制记录；现有下层整备需要恢复同一成员。将Sprite、血条、选择标记等表现置于WarriorVisualRoot，死亡时隐藏该视觉层，停止动画/局部移动、清命中闪白。逻辑根保留Health和稳定ID，供显式恢复使用。

不要仅让血条fill=0；血条边框也隐藏。不要只停用整个根节点却让恢复依赖其被停用的update。HealthBarView新增明确可见性接口或随VisualRoot一起隐藏；不要让本次士兵修复意外改变怪物血条策略。

WarriorCombatController持有Health订阅退订函数，重复setup前与onDestroy中解绑；死亡逻辑幂等，重复伤害事件不会重复退订/移除成员。最后一次伤害飘字可自然结束，隐藏后不得继续产生伤害或采集。

### 4.2 统一存活资格

- die：先设状态Dead，再releaseTarget、解除占用/采集assignment、motor.stop、停止attack/impact、隐藏VisualRoot、通知队伍刷新存活人数和未来队形。先设Dead以阻止同步回调重入。
- SquadMotor/Brain播放walk或idle只面向活人；Animator还应有存活/表现门禁，防止旧回调重新显示尸体。
- SquadEngagementController配置/追加成员时同时传Health或isAlive查询；assignSlots、updateAssignments、onWarriorAttackImpact、归队完成判断均过滤死亡者。删除死亡assignment并释放slot，必要时让活人补位。
- WarriorCombatController.onImpact再次检查自己和目标存活；不能只检查state与target引用。迟到impact无伤害。
- 敌人选目标通过isAlive过滤；死亡士兵不继续占攻击目标名额。AttackReceiver对已死亡者不重复闪白/飘字。
- 全灭队保留编制与Roster，显示0/N；拒绝新战斗/采集命令，不无限等待死人到位。通过既有合法下潜流程恢复，不能靠点选队伍复活。

### 4.3 下层整备

统一一个恢复入口：清旧战斗/采集状态→补齐本次已提交扩编成员→恢复全部编制HP→按绑定营地位置与新队形定位→清冷却/闪白并恢复idle→显示视觉→刷新Roster。

审查当前SquadFloorRecovery中多处resetForFloor调用，避免重复恢复或反复发布通知。可以先让底层reset幂等，但要明确哪个协调器唯一负责复活与位置布局。

4人死2人：无招募费用进入下层仍为4人；有20F且营地可招募时为5人；16人死8人恢复16人且不扣20F。编制不等于存活数。

## 5. 移速4倍

SWORD_WARRIOR_MOVE_SPEED_CELLS_PER_SECOND由2改8，注入SquadMotor整体行进和WarriorMotor靠近/撤退/归队。移除或统一两处默认2，避免只有大队加速而士兵归队仍慢。世界32单位/格下等于256单位/秒。

不修改attackIntervalSeconds（仍1秒）、伤害、动画帧间隔、史莱姆速度或引擎时间。

修复SquadMotor高速度跨waypoint丢失剩余距离：每帧预算speed*dt，while消费路径段长度并跳过零长点，直到预算耗尽/终点；限制循环不超过剩余节点数，终点arrived只派发一次。否则低帧率下一帧最多走一个格，无法稳定达到8格/秒。局部移动同样夹到目标不超调。

## 6. 其他已知问题修复

### 6.1 切层失败后无法继续

BasePanelView新增错误态“重试”入口，绑定retryPending。无pending的prepare失败可重新选目的地；已提交或地图部分应用失败则只允许重试固定事务，不允许换目的地或返回旧层继续经营。

将transitioning与needsRecovery/pending状态分开。isInteractionBlocked覆盖进行中和待恢复；MainMapController不能finally无条件开放攻击。准备失败安全回到旧层时才解除阻断，提交后失败保持阻断直到重试成功；错误面板仍可点击重试。

把地图实例、资源引用、导航、所有队伍营地下方位置、目标编制与经济草案放在prepare中验证；此阶段不替换正式navigation/worldCell。提交状态后幂等应用视图，成功后才推进floorInstanceId/关闭面板。

### 6.2 防重复结算与部分创建

PrimitiveRunState.commitSettlement当前先replaceSnapshot通知再标记结算完成。改成计算/校验完成后先安装完整权威状态（库存、编制、modifier、settled标记），最后统一发布通知；需要库存静默替换/显式通知接口。监听器异常不能导致经济已变却未标记，从而重试再扣料。

addMembers按目标memberCount幂等，仅补缺失稳定ID。当前createWarrior会注册receiver等资源，任一中途异常必须销毁本次未成功成员并解除自己的注册；不得留下同名receiver使重试永久失败。成员各数组、engagement订阅采用一个事务式注册入口，完成后统一可见，不能只看combat数组长度推断其他数组都完整。

建造失败后的runState、实体、占格、导航、花费与Roster同时回滚；验证失败重试不会让commandSlot从1跳成2/3。避免setup队伍选择器累积输入监听。

### 6.3 近战强化匹配

BuildingFloorSettlement目前用squads.length>0判断近战资格。改为按兵种定义标签匹配melee_infantry，包含本层死亡但即将恢复的已拥有编制；不能未来只有弓手也扣近战材料。现有全局成长与新成员继承保留。

## 7. 文件范围与施工顺序

1. PrimitiveRunState、BuildingPlacementValidator/Service及卡片：核对免费/第二营价格/两队上限，稳定slot、失败回滚。
2. 新BarracksSpawnResolver，SquadRenderer、MainMapController、SquadBrain接入营地锚点；切层prepare验证全部落点。
3. 新SquadFormationLayout，WarriorMotor更新槽位，SquadRenderer新增后全队重排，保留稳定成员ID。
4. WarriorCombatController、WarriorAnimator、HealthBarView、SquadEngagementController及Roster接死亡/复活与存活门禁。
5. WarriorCombatConfig与两类Motor改8格/秒，跨路点消费剩余距离。
6. FloorTransitionController、BasePanelView、MainMapController、ResourceInventory/PrimitiveRunState接重试与提交防重。

不新增兵种、美术、资源类别或地图随机机制，不撤销现有产木与永久强化。新TS使用AGENTS.md要求的三段文件头。新增脚本meta由Creator生成提交。

## 8. 验收矩阵

| 场景 | 预期 |
|---|---|
| 0库存首营；取消后再建 | 取消不耗权益；合法落地4人，资源不变 |
| 首营后建第二营 | 少于40W/20S拒绝；足够只扣一次，另有独立4人队 |
| 第三营/快速连点 | 禁止，不扣资源、不产生第三队 |
| 首营生成故意失败再重试 | 无残留占格/receiver；快捷键仍为1，第二队为2 |
| 两营相隔较远 | 两队各在自己营地下方；下层仍回各自营地 |
| 营地靠边或下方受阻 | 可解释地就近找合法完整落点；无解拒绝，无墙内出生 |
| 1/4/5/8/9/16人 | slot唯一、居中、至少1.1格间距；5人明显可见 |
| 扩编/归队/复活 | 新旧成员都使用同一新队形；每个成员仅注册一次 |
| 单兵死亡/全灭 | 当帧士兵及空血条消失，无移动/采集/伤害，Roster更新 |
| 死亡时还有迟到攻击回调 | 不继续发伤害，不重新显示 |
| 4人死2人后无招募/有招募 | 下层分别4/5人满血；编制/实例/UI一致 |
| 16人死8人 | 满编不扣食物，下层恢复16人 |
| 30/60/120FPS行进16格 | 无障碍直线约2秒（允许一帧误差）；不越过终点 |
| 切层prepare失败 | 原库存、编制、地图不变，可重选 |
| 经济提交后故意渲染失败 | 世界阻断、可重试；一次产木/扣料/扩编，无重复成员 |
| 重试成功 | 队伍正确归位、计数重置、面板关闭、战斗恢复 |

自动验证布局唯一性/距离、出生区合法性、免费与限额、防重复结算/创建、跨waypoint距离预算。死亡表现、相邻营地、16人归队与窄路表现需Creator预览；本方案不宣称已完成实机验证。

## 9. 实施约定与数据契约

以下“新增”方法是本方案要求实现的接口，不表示仓库已存在。代码块为局部实现参考；导入路径、既有字段可按对应脚本补齐，不可把代码块当成完整可编译文件。没有标为新增的方法优先修改原方法，避免平行实现两个管理器。

所有位置保持GridPoint（格坐标），只有Motor负责转换到世界坐标。一个成员拥有稳定memberId；布局变化不改变ID。成员数量真相在PrimitiveRunState，存活真相在HealthComponent，场景成员装配真相在SquadRenderer；UI只读三者结果。

### 9.1 新增 squad/SquadFormationLayout.ts

原因：当前Renderer私有getFormationOffset既不以总人数布局，也不更新已有成员；出生、扩编、归队需要同一个纯函数。

| 方法 | 功能与调用方 |
|---|---|
| generateFormationOffsets(count, spacing=1.1): GridPoint[] | 校验0～16整数，生成唯一局部点；由Renderer和出生规划调用 |
| assignFormation(memberIds, spacing): ReadonlyMap<string, GridPoint> | 按传入稳定顺序绑定ID，拒绝重复ID；由reflowFormation调用 |
| getFormationBounds(offsets): {minX,maxX,minY,maxY} | 为营地下方完整队形放置计算外包范围；空队返回零范围 |

参考核心算法：

```ts
export function generateFormationOffsets(count: number, spacing = 1.1): GridPoint[] {
    if (!Number.isInteger(count) || count < 0 || count > 16) throw new Error('Invalid count');
    if (!Number.isFinite(spacing) || spacing <= 0) throw new Error('Invalid spacing');
    if (count === 0) return [];
    const columns = Math.min(4, Math.ceil(Math.sqrt(count)));
    const rows = Math.ceil(count / columns);
    const points: GridPoint[] = [];
    for (let row = 0; row < rows; row++) {
        const inRow = Math.min(columns, count - row * columns);
        for (let col = 0; col < inRow; col++) {
            points.push({
                x: (col - (inRow - 1) / 2) * spacing,
                y: (row - (rows - 1) / 2) * spacing,
            });
        }
    }
    return points;
}
```

### 9.2 修改 squad/SquadTypes.ts

新增下列接口；保留现有handle数组兼容旧代码，但不得再由多个调用方任意push。数组与members映射只由Renderer的attach/detach改动。

```ts
export interface SquadHomeAnchor {
    buildingId: string;
    gridX: number; gridY: number; width: number; height: number;
}
export interface SquadSpawnPlan {
    squadId: string;
    home: SquadHomeAnchor;
    squadPoint: GridPoint;
    homeRestCell: GridCell;
    offsets: ReadonlyMap<string, GridPoint>;
}
export interface WarriorRuntimeMember {
    id: string;
    ordinal: number;
    node: Node;
    visualRoot: Node;
    lifeView: WarriorLifeView;
    animator: WarriorAnimator;
    motor: WarriorMotor;
    health: HealthComponent;
    stats: CombatStats;
    combat: WarriorCombatController;
    receiver: WarriorAttackReceiver;
    dispose(): void;
}
// 扩展SquadRuntimeHandle：
// members: Map<string, WarriorRuntimeMember>;
// home: SquadHomeAnchor;
```

memberId继续使用 `${squadId}/warrior_${ordinal}`，死亡不删除映射；正常扩编追加ordinal，失败重试复用同一个待补ID。禁止按存活人数分配新ID。

## 10. 兵营建造与出生：逐文件修改

### 10.1 新增 squad/BarracksSpawnResolver.ts

纯规划模块，通过参数接收导航和建筑范围，不依赖场景树。

| 方法 | 原因、功能、调用位置 |
|---|---|
| resolveHome(buildingId, registry): SquadHomeAnchor | 建筑不在WorldObjectRegistry中；从BuildingRuntimeRegistry获取实例和Catalog footprint；校验兵营类型和ID |
| planSpawn(home, memberIds, navigation, reservations): SquadSpawnPlan或失败结果 | 代替固定(19,14)/(21,14)；建造预览、提交和切层prepare共用 |
| enumerateCandidates(home, bounds, navigation): GridPoint[] | 先正下方，再按到门的路径距离/水平偏差/坐标排序，有限遍历地图范围 |
| canPlaceFormation(anchor, offsets, navigation, reservations): boolean | 检查全员位置，不只检查队伍中心；校验越界、障碍、与另一队间距 |
| reservePlan(plan, reservations): void | 两队规划共用临时预留集合，防止分别找到同一出生区 |

门前种子只能从营地下边缘相邻的可走格产生；种子为空直接失败，不能绕到营地上方。可达区域采用四邻接BFS，不穿阻挡。预览时额外把拟建营地footprint视为阻挡，不修改live NavigationGrid。

```ts
// bounds为offset范围，格坐标向下为正。
const preferred = {
    x: home.gridX + home.width / 2,
    y: home.gridY + home.height + 0.5 - bounds.minY,
};
// 每个候选检验anchor+offset；浮点点位先floor映射导航格。
// 同时检验成员周围占据范围（建议半径0.45格覆盖的格子），
// 不能仅中心可走而身体跨入营地。跨队中心距离至少spacing。
```

失败返回明确枚举NoDoorExit/NoFormationSpace/MissingBarracks，不抛未解释的“找不到base”。同一输入产生相同结果，便于重试和预览一致。

### 10.2 修改 building/PrimitiveRunState.ts

| 方法 | 修改说明与原因 |
|---|---|
| getEffectiveCost(definition)【已有】 | 保留首次为{}、后续Catalog.cost；不在查询时消费权益 |
| canPlaceDefinition(definition)【已有】 | 按已占用及pending的两个commandSlot检查；不是只看可见营地数量 |
| prepareBarracksPlacement(buildingId): BarracksPlacementTicket【新增】 | 返回稳定空位、预定squadId、初始4个memberId、是否免费，不改变库存和权益；重复同ID返回同ticket |
| commitBarracksPlacement(ticket, spawnPlan): SquadSpawnData【新增】 | 装配成功后安装绑定与编制、消费免费权益；同ticket重复提交返回原队伍 |
| abortBarracksPlacement(ticket)【新增】 | 释放pending预留，已提交ticket不误撤销；不回退全局ID序号但释放commandSlot |
| registerBarracksPlacement / rollbackBarracksPlacement【替换】 | 用上述三阶段取代“先创建真相再大范围回滚”；MainMapController调用同步迁移 |
| subscribe(listener): unsubscribe【新增】 | 成功提交后让卡栏价格、容量和Roster刷新；失败准备不发布成功通知 |
| prepareSettlement【已有】 | 生成完整目标编制，用于先规划下层队形；不提前修改成员 |
| installSettlement / publishSettlement【新增】 | 第14节定义静默安装与统一发布，替换commitSettlement的通知时序 |

Ticket至少含buildingId、squadId、commandSlot、usedFreePlacement、memberIds、状态。第一次创建失败后再建：commandSlot仍为1；第二队位2。canPlaceDefinition需要考虑pending，避免回调重入同时抢到同一位。

### 10.3 修改 building/BuildingTypes.ts

PlacementInvalidReason新增NoBarracksExit、NoFormationSpace；BuildingPlacementSnapshot增加可选reasonText。保留已有SquadCapacity原因。spawnPlan仅为预览结果，不作为提交时永久可信缓存；提交必须重算，防止鼠标停留期间地图状态已变化。

### 10.4 修改 building/BuildingPlacementValidator.ts

扩展现有BuildingPlacementGate参数为`(definition, gridX, gridY)`，返回`{allowed, reason?: PlacementInvalidReason, reasonText?: string}`。validate在footprint/terrain/occupancy/cost通过后调用gate；兵营gate依次查容量与planSpawn。不要把所有gate拒绝都硬编码成SquadCapacity。

MainMapController注入gate组合函数，Validator本身不创建ticket、队伍或节点；预览每次只读规划。

### 10.5 修改 building/BuildingPlacementService.ts

tryPlace保持唯一建造入口，新增可注入的PlacementParticipant接口：

```ts
interface PlacementParticipant {
    prepare(instance: BuildingInstanceData): PreparedPlacement;
    stage(prepared: PreparedPlacement): void; // 创建隐藏实体、内部注册，失败可清
    install(prepared: PreparedPlacement): void; // 纯状态提交，无外部回调
    publish(prepared: PreparedPlacement): void; // 显示、UI通知
    abort(prepared: PreparedPlacement): void; // 仅用于提交前清理
}
```

建造顺序：validate→生成instance→prepare ticket/出生计划→准备库存变更和占格→stage建筑/部队→静默安装库存、registry、runState→标记committed→publish。任一提交前异常逆序abort；提交后通知异常不能执行旧catch退款，否则免费权益/节点已发布而资金退回。

最小实现可先保留现有trySpendCost，但必须在发布通知前增加可回滚快照与重入锁；推荐统一使用第14节的静默库存接口。新增private placementInProgress，finally释放；public tryPlace重入返回失败，不再次扣费。旧onPlacementCommitted/onPlacementRolledBack替换为participant，避免把“已提交回调”当成还能任意失败的装配阶段。

### 10.6 修改 building/BuildingRuntimeRegistry.ts

新增`addSilently(data,node)`、`removeSilently(id)`、`publishChanged()`；原add/remove包装调用它们，保持其他调用者行为。原因：stage不能让BuildingEffectSystem或UI观察半完成建造。仅事务协调者使用静默接口，不允许Renderer自行发布。

### 10.7 修改卡栏脚本

- BuildCardStripController：新增`refreshAvailability()`，逐卡重算costResolver、容量及affordable；setup订阅runState变更，销毁退订。不能只依赖库存变化，因为免费首营可能不扣库存。
- BuildingBlueprintCardView：新增`setPlacementAvailability({cost,affordable,reasonText})`，更新实际价格与不可建原因；继续使用现有setAffordable/反馈门禁。不能显示目录40W20S却实际首营免费。
- 原有点击去重、hover保持行为不改；上限两营时允许看说明，禁止执行建造。

## 11. 动态成员与队形：逐文件修改

### 11.1 修改 squad/SquadRenderer.ts

| 方法 | 修改内容、原因及调用者 |
|---|---|
| createWarrior【已有，改签名】 | 接收memberId、ordinal、offset；返回WarriorRuntimeMember；创建视觉子层，去掉私有四人offset计算 |
| createSquad【已有，改签名】 | 接收SquadSpawnPlan，使用营地home，不再getHomeObject(base_main)算出生；初次装配整队 |
| addSquad【已有】 | 调用createSquad，验证ID未在句柄表中；传plan，无默认固定坐标 |
| stageMembers(handle,targetCount): StagedMembers【新增】 | 只为不存在的稳定ID创建隐藏成员；全部成功再交给attach；中途失败销毁整批stage |
| attachMember(handle,member)【新增】 | 唯一写入members、兼容数组和控制器监听；检查ID重复，异常反向detach |
| detachMember(handle,id)【新增】 | 只清失败装配/销毁成员，不用于正常死亡；解除各控制器和Hub引用 |
| addMembers【已有】 | stage→attach→重排→显示；不只while检查combat数组长度；同目标人数调用两次返回第二次0 |
| reflowFormation(handle,{includeDead,snap})【新增】 | 根据成员集合调用布局器、统一setFormationOffset；正常包含活人，切层包含全部编制 |
| getFormationOffset【删除】 | 所有调用改为共享布局结果，禁止继续index%4 |

节点结构：WarriorRoot保留Motor/Health/Stats/Combat/Receiver，静态scale沿用2；WarriorVisualRoot局部scale1，放Sprite和血条视觉。WarriorAnimator可以仍挂Root但持有子Sprite引用。HealthBarView.setup增加parent:Node，把barRoot放到VisualRoot；不要把Motor挪到子节点导致坐标多乘一次scale。

stage创建root先active=false，显式setup完成后才启用；dispose必须显式解除receiver，不等待Cocos延迟destroy。恢复场景可用同memberId重试，旧对象延迟onDestroy只能注销自己的receiver实例。

### 11.2 修改 squad/WarriorMotor.ts

新增`setFormationOffset(offset: GridPoint, snap=false): void`、`setAlive(value: boolean): void`。前者更新formationOffset；snap调用已有snapToFormationForFloor，否则仅更新未来归队目标。由Renderer重排后在idle/reforming状态调用returnToFormation，战斗/采集不立即拉回。

```ts
public setFormationOffset(offset: GridPoint, snap = false): void {
    this.formationOffset = { ...offset };
    if (snap) this.snapToFormationForFloor();
}
public setAlive(value: boolean): void {
    this.alive = value;
    if (!value) this.stop();
}
// update、moveToLocalGridOffset、returnToFormation入口：if (!this.alive) return;
```

stop的idle调用仍经过Animator门禁；setAlive(false)不修改HP，Health是唯一存活真相。出生setup默认alive=true，复活协调器显式恢复。

### 11.3 修改 squad/SquadMotor.ts

setup新增`canAnimateMember?: (animator)=>boolean`；playWalk/playIdle按此过滤，避免改变原共享数组语义。addWarrior已有去重保留，新增removeWarrior只供失败装配清理。update用第15节跨段算法。teleportForFloor清路径、到达标记，只有恢复协调器调用。

### 11.4 修改 squad/SquadBrain.ts

- setup接收新的homeAnchor/homeRestCell及`hasAliveMembers()`、`canAnimateMember()`查询。
- 新增`setHomeAnchor(home,restCell)`，用于绑定营地出生和切层更新；原homeObjectId仍可表示城市业务归属，但不能再据base坐标决定营地归队。
- 所有开始移动/采集/交战入口先hasAliveMembers；0人拒绝命令并返回可解释结果；不要触发自动回血。
- addWarrior保留，新增removeWarrior供回滚。播放idle处过滤活人。
- resetForFloor只清Brain自己的状态、更新restCell；不调用单兵restoreFull或重排队形。

### 11.5 修改 squad/SquadCombatController.ts

新增`removeWarrior(warrior)`、`onMemberDied(memberId)`、`clearForFloor()`。onMemberDied解除对应目标占用；活人归队完成判断继续忽略死者。clearForFloor仅清队伍状态/currentGroup，替代resetForFloor内部遍历恢复全员；全员恢复只由SquadFloorRecovery执行一次。

### 11.6 修改 squad/SquadEngagementController.ts

setup/addWarrior新增同索引Health或稳定memberId查询；优先把assignment扩为memberId并按映射查成员，不改变Hub中的ID格式。

新增`removeWarrior(memberId)`（失败清理）、`onMemberDied(memberId)`（只撤assignment/释放slot，不删除编制）、`clearForFloor()`（清目标/assignment，不snap和复活）。

修改assignSlots、beginInteraction未分配归队循环、updateAssignments、onWarriorAttackImpact、tryCompleteReform：只处理活人。onMemberDied如果仍有目标，可为尚未占位的活人重新分配空位；先移除死人，不能保留slot并重复补位。

```ts
private onWarriorAttackImpact(memberId: string): void {
    const member = this.members.get(memberId);
    if (!member || member.health.isDepleted()) return;
    const assignment = this.assignments.find(a => a.memberId === memberId);
    if (!this.currentTarget || assignment?.state !== 'attacking') return;
    // 以下继续原emitAttackImpact；attackerId直接用memberId，不用活人列表index拼接。
}
```

### 11.7 修改 squad/SquadSelectionController.ts

setup先off旧输入监听和订阅再on；新增`updateSquads(squads,handles)`只更新数据/选择合法性，MainMapController新建第二队时调用此方法，不重复setup。保留第一队选择；此前无队伍时自动选第一队。死亡0/N队仍可选查看，但命令执行由Brain拒绝。

## 12. 死亡与复活：逐文件方法及事件顺序

### 12.1 新增 squad/WarriorLifeView.ts

只管理表现，不扣血、不复活、不删成员。

| 方法 | 功能 |
|---|---|
| setup({visualRoot,animator,motor,hitFlash}) | 保存显式引用，不自行注册另一份Health事件 |
| hideDead() | visualRoot.active=false，Animator/Motor alive=false，HitFlash.reset；重复调用无副作用 |
| prepareRecovery() | 仍保持隐藏，清残余flash与动画时间；不展示半恢复节点 |
| showAlive() | 开放Animator/Motor门禁，reset idle，再显示visualRoot；必须由恢复协调器最后调用 |

### 12.2 修改 squad/WarriorCombatController.ts

setup新增lifeView及onDied(memberId)，保存`healthUnsubscribe`；setup前与onDestroy中释放两种订阅。注意Health.subscribe会立即回调当前值，引用必须先初始化。

新增`clearCombatForFloor()`，只清target/group/cooldown/state，移除原resetForFloor中的health.restoreFullForFloor；原resetForFloor调用迁移到协调器。die幂等，并先设置Dead阻止任何同步回调继续攻击。

```ts
private die(): void {
    if (this.state === WarriorCombatState.Dead) return;
    this.state = WarriorCombatState.Dead;
    this.releaseTarget();
    this.group = null;
    this.attackCooldown = 0;
    this.motor.stop();
    this.lifeView.hideDead();
    this.onDied?.(this.unitId);
}
// setup末尾，先解绑旧回调：
this.healthUnsubscribe = this.health.subscribe((current) => {
    if (current <= 0) this.die();
});
// onImpact首行：
// if (!this.isAlive() || !this.target?.isAlive() || this.state !== Attacking) return;
```

onDied由MainMapController/Renderer注入，依次通知combat、engagement、Renderer.reflowFormation（战斗时仅未来槽位）、Roster.refreshCounts。不得在onDied中调用runState减少memberCount。

### 12.3 修改 squad/WarriorAnimator.ts

新增`setAlive(value)`、`isAliveForPresentation()`；alive=false时清attackPoseVisible/frameTimer并停止推进。playIdle/playWalk/playAttack/update/applyFrame都需检查，避免多个控制器晚到调用重启死亡动画。

applyFrame可能同步派发impact并触发状态变化：每次listener调用前检查alive，回调后再次检查alive及animationState仍为Attack再写SpriteFrame；否则退出。resetToIdleForFloor不负责复活门禁，只有LifeView.showAlive开放它。不能调用setup恢复，因为setup会清空attackImpactListeners。

### 12.4 修改 feedback/HealthBarView.ts 与 HitFlashView.ts

- HealthBarView.setup新增可选parent:Node；默认this.node保持现有怪物/资源行为。新增setVisible(value)，只控制barRoot。士兵由LifeView父层隐藏，因此不新增全局“0HP全部隐藏”规则。
- HitFlashView新增reset():void，把当前onDisable里的flashing=false、elapsed=0、setFlashAmount(0)抽出；onDisable/onDestroy复用。死亡视觉层隐藏时组件可能仍在Root上，所以必须显式reset。

### 12.5 修改 squad/WarriorAttackReceiver.ts

新增dispose():void，显式注销Hub并清引用，onDestroy调用它，重复调用安全。setup前先dispose，避免重复注册。

```ts
public onAttackImpact(signal: AttackImpactSignal): AttackImpactResult {
    const health = this.health;
    // 继续使用项目DamageResult字段，已死亡takeDamage得到actualDamage=0。
    const result = health?.takeDamage(signal.damage) ?? makeNoDamageResult(signal.damage);
    if (result.actualDamage > 0) {
        // 致死takeDamage已同步触发die；不能随后重新flash。
        if (health && !health.isDepleted()) this.hitFlash?.flash();
        this.popupSpawner?.spawnDamage(this.node, result.actualDamage);
    }
    return { targetId: this.targetId, damageResult: result,
        targetDepleted: health?.isDepleted() ?? true };
}
```

makeNoDamageResult为局部辅助函数，字段与CombatTypes.DamageResult一致；不使用becameDepleted=true伪造第二次死亡。逻辑Root仍在，因此最后一次飘字可以读取位置。

### 12.6 修改 squad/SquadFloorRecovery.ts

recover改为接收`plans: ReadonlyMap<string,SquadSpawnPlan>`，不得内部再算baseX/baseY。新增`recoverSquad(handle,plan)`并按下列固定顺序实现：

1. 全部member.lifeView.prepareRecovery保持隐藏。
2. combat.clearForFloor、engagement.clearForFloor、brain清状态；单兵clearCombatForFloor。
3. 更新handle.home、motor.teleportForFloor(plan.squadPoint)，安装plan.offsets；此时所有编制成员已由addMembers完成。
4. 每个Health恢复一次；Motor开放alive后snap到新offset。
5. lifeView.showAlive；Brain设home/restCell；最后发布一次Roster状态更新。

不能再同时由SquadCombatController.resetForFloor和recover的单兵循环各恢复一遍。重试可重复执行恢复，成员数量、已提交经济、modifier不变；所有复活位置来自同一pending plan。

### 12.7 修改 UI 的两份脚本

SquadRosterItemView新增`setMemberCounts(alive,total)`，显示alive/total；0/N可查看但视觉标记全灭，Tooltip同口径。数字变化不重新setup卡片，保留当前hover和选择。

SquadRosterController新增`refreshCounts(squadId?)`，只读取handle.members的Health与runState编制，调用上述方法。成员死亡/整备由一次统一通知驱动；原refresh只用于新队伍或结构变化，不能每次扣血都销毁整栏。

## 13. MainMapController：明确装配与调用位置

当前匿名建造回调与切层commit很长，本轮提取以下private方法，保持主控制器负责装配，不放队形数学与BFS：

| 方法 | 调用处/行为 |
|---|---|
| createBarracksPlacementParticipant(context) | bootstrap创建PlacementService前；注入runState、SpawnResolver、Renderer和registry |
| onSquadInstalled(squad,handle) | 建造publish阶段；安装handles/presentation，配置guard回调，selection.updateSquads、roster.refresh、cardStrip.refreshAvailability |
| onMemberDied(squadId,memberId) | WarriorCombatController回调；撤assignment、刷新队形资格和人数；不减编制 |
| prepareFloorTransition(context) | transition.prepare；生成完整PreparedFloorTransition，纯准备、不替换live网格 |
| applyPreparedFloor(context,prepared) | transition.commit；提交状态后幂等应用资源、怪物、成员、营地布局与恢复 |
| syncTransitionGate(state) | 状态变化时同步世界命令/建造/hover/伤害/模拟阻断；错误面板不被阻断 |
| disposeRuntimeSubscriptions() | onDestroy释放新订阅与成员dispose，避免切场景遗留 |

PreparedFloorTransition不能继续只有unknown经济payload：增加项目内显式类型，含map实例、候选导航与占格、经济plan、每队spawnPlan、事务阶段（prepared/stateCommitted/viewApplied）。不重新在每次重试随机选出生点。

门禁不等于只忽略伤害：pending恢复期间暂停SquadBrain、两类Motor、战斗/采集控制器和怪物行为。推荐注入`isSimulationBlocked:()=>boolean`统一查询，在update与命令入口早退；至少列入SquadBrain/SquadMotor/WarriorMotor/SquadCombatController/SquadEngagementController/WarriorCombatController，以及MonsterGroupController/MonsterMotor/MonsterCombatController。正常基地面板是否暂停沿用旧规则，只有transition busy/recovering必须阻断；不能设置全局timeScale=0阻断重试UI。

## 14. 切层失败恢复与原子发布：逐脚本方法

### 14.1 修改 economy/ResourceInventory.ts

保留getSnapshot，新增`validateSnapshot(snapshot)`、`installSnapshotSilently(snapshot)`、`publishSnapshot()`。validate四项均有限非负整数；install只赋值且不通知；publish调用现有监听器。replaceSnapshot包装validate→install→publish，保持旧调用行为。

禁止其他业务用silently接口隐藏未完成事务；只能由本局提交协调器调用。预先完成全部可能失败的校验，静默安装期间不执行用户回调。

### 14.2 修改 PrimitiveRunState与BuildingFloorSettlement

```ts
public installSettlement(plan: BuildingFloorSettlementPlan, inventory: ResourceInventory): boolean {
    if (this.settledFloorIds.has(plan.floorInstanceId)) return false;
    this.validateSettlement(plan, inventory); // 层ID/版本、非负库存、成员ID/上限、成长合法
    // 从此处到标记结束不得调用外部监听器。
    inventory.installSnapshotSilently(plan.nextInventory);
    this.installSquadCounts(plan.nextSquads);
    this.meleeAttackGrowth = plan.nextMeleeAttackGrowth;
    this.publishMeleeAttackGrowth(); // 现有modifierRegistry.set不发监听
    this.settledFloorIds.add(plan.floorInstanceId);
    this.settlementResults.set(plan.floorInstanceId, plan);
    return true;
}
public publishSettlement(inventory: ResourceInventory): void {
    inventory.publishSnapshot();
    this.notifyRunChanged();
}
```

新增validateSettlement/installSquadCounts/notifyRunChanged均为private。ResourceInventory与PrimitiveRunState各新增getRevision():number，所有成功的权威状态写入递增各自revision，通知不递增；失败回滚恢复事务前revision。plan增加baseRevision:{inventory:number,run:number}，prepare记录，install前校验本局和库存版本未变；同层已提交时返回已存结果，不使用另一份新草案覆盖。缺少此检查则待重试期间库存变化可能被旧nextInventory覆盖。

BuildingFloorSettlement修改近战资格为`hasSquadWithTag(squads,'melee_infantry')`，新增纯函数标签查询/映射，兵种标签从现有剑士定义集中读取。不要用数组非空替代类型判断。只有数据校验通过才进入Source→Squad→Sink。

### 14.3 修改 map/FloorTransitionController.ts

新增TransitionState：idle/preparing/committing/recovering；保留当前pendingContext/preparation但改为明确类型。新增`isInteractionBlocked()`、`getState()`、`subscribeState()`、private `setState()`。

- choose：idle且基地面板打开才能进入；prepare成功后记pending并commit；prepare失败清pending回idle；一旦进入可能有副作用的commit失败则recovering。
- retryPending：仅recovering允许，同一pending重试，不再prepare、不换层ID、不重复结算。
- fail：根据提交阶段选择idle/recovering；recovering保留原目的地和plan，显示重试。
- finalize：确认viewApplied后推进sequence，清pending→idle→强制成功关闭面板；成功只执行一次。
- isTransitioning可保留表示正在工作，但所有世界门禁迁移isInteractionBlocked，避免recovering时放行。

```ts
public isInteractionBlocked(): boolean {
    return this.state !== 'idle';
}
// 外部回调只负责状态联动，不在finally一律解除伤害门禁。
// UI监听：recovering => setRecoveryState(error, () => retryPending())。
```

### 14.4 修改 ui/base/BasePanelView.ts 与 BaseInteractionController.ts

BasePanelView新增`setRecoveryState(message,onRetry)`、`clearRecoveryState()`、`setReturnEnabled(value)`：错误态禁用两个目的地/返回，显示独立重试链接；retry事件只绑定一次并在dispose解绑，busy时禁用重试。不能只禁用UITransform而仍让业务回调执行，TOUCH_END内也检查busy/recovery。

BaseInteractionController新增`setCloseGuard(canClose)`，close(reason:'user'|'transitionSuccess'='user')：用户返回必须通过guard，transitionSuccess由finalize调用允许关闭；外部强制销毁走destroy。这样不会出现按钮隐藏了但快捷键/其他close调用仍回旧层。

### 14.5 提交与重试的参考顺序

```ts
// prepareFloorTransition：所有步骤无live副作用
const settlement = run.prepareSettlement(currentId, buildings, inventory);
const nextWorld = prepareStaticWorld(nextId, mapId); // 候选网格也包含持久建筑
const homes = planAllBarracksSpawns(settlement.nextSquads, nextWorld.navigation);
return { settlement, nextWorld, homes, phase: 'prepared' };

// applyPreparedFloor：函数名为本方案新增适配方法
if (prepared.phase === 'prepared') {
    run.installSettlement(prepared.settlement, inventory);
    prepared.phase = 'stateCommitted';
}
applyWorldIdempotently(prepared.nextWorld);
ensureSquadMembers(prepared.settlement.nextSquads); // 稳定ID，补缺不重复
recovery.recover(handles, prepared.homes);
run.publishSettlement(inventory);
roster.refreshCounts();
prepared.phase = 'viewApplied';
return { success: true };
```

applyWorldIdempotently由MainMapController封装现有replaceResources/monsterRenderer.render/导航替换/计数器操作。重新render前显式清旧receiver注册及实例；不能只removeAllChildren等延迟destroy后与同ID新对象冲突。是否重复恢复HP不影响最终结果；不能重复经济、成员或击杀计数累计。基于当前scene的效果，不声称已有磁盘存档事务。

## 15. 四倍移速的代码参考

WarriorCombatConfig已有SWORD_WARRIOR_MOVE_SPEED_CELLS_PER_SECOND设为8；SquadRenderer注入整体与局部Motor。配置优先，Motor默认值引用同一配置或要求必填，不能保留隐式2。

SquadMotor.update用预算消费多路径段。原snapToWaypoint会修改路径/状态，应将“推进索引”和“派发结束”拆开，不直接放入循环导致中途清数组。

```ts
private advanceAlongPath(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0 || !this.isMoving()) return;
    let remaining = this.moveSpeedCellsPerSecond * dt;
    const limit = this.waypoints.length - this.waypointIndex;
    for (let step = 0; step < limit && this.waypointIndex < this.waypoints.length; step++) {
        const target = this.waypoints[this.waypointIndex];
        const dx = target.x - this.currentGridPoint.x;
        const dy = target.y - this.currentGridPoint.y;
        const length = Math.hypot(dx, dy);
        if (length <= 1e-6) { this.waypointIndex++; continue; }
        if (remaining <= 0) break;
        this.lastDirection = resolveWarriorDirection(dx, dy, this.lastDirection);
        if (remaining >= length) {
            this.currentGridPoint = { ...target };
            remaining -= length;
            this.waypointIndex++;
        } else {
            const t = remaining / length;
            this.currentGridPoint = { x: this.currentGridPoint.x + dx*t,
                y: this.currentGridPoint.y + dy*t };
            remaining = 0;
            break;
        }
    }
    this.syncWorldPosition();
    if (this.waypointIndex >= this.waypoints.length) this.finishPath();
    else this.playWalk(this.lastDirection);
}
private finishPath(): void {
    this.waypoints = [];
    this.waypointIndex = 0;
    this.arrivedPending = true;
    this.playIdle(this.lastDirection);
}
```

update负责检查simulation门禁，再调用advanceAlongPath。消费arrived沿用现有consume接口。WarriorMotor局部直线已有maxStep夹紧，不引入重复速度倍率；这里只对默认/注入速度及死亡门禁修改。

## 16. 分阶段提交与检查要求

| 独立提交 | 修改脚本群 | 必须通过的检查 |
|---|---|---|
| A 布局与移动纯逻辑 | FormationLayout、Formation类型、两类Motor、速度配置 | 0/1/4/5/9/16点唯一；30/60/120FPS16格≈2秒；零长路点不死循环 |
| B 成员与死亡生命周期 | Renderer、LifeView、Animator、Combat、Receiver、Engagement、HealthBar、HitFlash、Recovery、Roster | 第5人可见；致死后无尸体/血条/采集；下层4或5人；重复addMembers返回0 |
| C 兵营出生与建造事务 | SpawnResolver、PrimitiveRunState、Validator、Service、Registry、卡栏、MainMap | 首免后二收费；两队上限；出生在各营地下方；失败后无残留且快捷键1/2 |
| D 切层恢复闭环 | Transition、BasePanel、BaseInteraction、Inventory、RunState、MainMap及模拟门禁 | prepare失败无变化；commit失败可点重试且世界冻结；重试不重复收益/成员 |

A～D可分提交但发布前必须集成验证，不在中间提交让旧调用签名继续引用已删除方法。新增接口先接调用者再移除旧方法；搜索旧getFormationOffset、固定spawnPoint、baseX/baseY整备位置、重复resetForFloor调用及直接成员数组push，逐项清除或解释保留理由。

必要测试建议放tests或项目现有测试目录：formation-layout、path-budget、barracks-placement-transaction、floor-settlement-retry；项目若无测试runner，优先建立能执行上述纯函数的最小入口，不为此引入完整框架。Cocos组件装配与材质/视觉必须Creator验证，不能用纯函数通过代替实机结论。

所有新增方法必须在实现PR中列出实际文件路径和调用者，不能只交新增类未接线。验收截图至少包括两个相隔营地、5人和16人队形、死亡前后、重试错误面板。报告区分“静态审查”“自动测试”“Creator预览”三种证据。
