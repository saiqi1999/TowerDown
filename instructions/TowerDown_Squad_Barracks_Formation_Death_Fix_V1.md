# TowerDown 兵营、动态队形、死亡与移动修复方案 V1

> 基于远端 main a976aab1d2f94300226b644214a1093d5e988930（reform）。本次交付技术方案，不修改运行时代码。
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

- die：releaseTarget、解除占用/采集assignment、motor.stop、停止attack/impact、状态Dead、隐藏VisualRoot、通知队伍刷新存活人数和未来队形。
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
