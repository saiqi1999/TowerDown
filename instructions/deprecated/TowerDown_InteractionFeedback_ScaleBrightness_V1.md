# TowerDown 建筑与卡片交互反馈技术方案 V1.2：UI 原生进入退出与持续微提亮

> 基于main提交 `ad31bb35efd24445148074d5c8f43d39e404e636`（next level），Cocos Creator 3.8.8。
> 本轮交付技术方案，不修改运行时代码。目标：地图建筑、队伍UI、建筑蓝图卡的Hover与点击具有X/Y独立阻尼震荡缩放，并轻微提亮图片。
> 不改变建造、选队、基地面板、地图切换与部队整备业务。UI 改用 MOUSE_ENTER / MOUSE_LEAVE 上报，集中控制器仍唯一管理 Hover 身份与 Tooltip；世界对象保留现有拾取。

## 1. 反馈范围

| 对象                      | Hover             | 有效点击                | 提亮对象                  |
| ----------------------- | ----------------- | ------------------- | --------------------- |
| 地图已建建筑                  | 进入时播放一次独立拉伸震荡      | 横向展开、纵向压缩后回弹        | 建筑Sprite              |
| 主基地                     | 同地图建筑             | 反馈后立即执行现有基地逻辑，不等待动画 | 基地Sprite              |
| 左侧队伍UI                  | 卡片小幅放大            | 回弹＋现有选队             | Portrait图片；不改变阵营色条与文字 |
| 底部蓝图卡                   | 卡片小幅放大            | 可操作时回弹＋现有蓝图选择       | 卡片背景Sprite与Icon       |
| 不足资源的蓝图                 | 保留Tooltip；不做放大/提亮 | 不做点击反馈，不放行按钮        | 保持现有低透明度              |
| 资源、敌人、地图单位本体、Ghost、目的地卡 | 本轮不接入             | 原业务不变               | 不接入                   |

Hover反馈在命中目标改变时立即发生，不等待Tooltip的0.08秒显示延迟。离开Hover当帧提亮归零；已经启动的缩放动画继续自然结束。每次重新进入可立即启动新的独立动画，不等待、不重置、不停止旧动画。点击不循环播放，不持续抖动，不震动相机或地图位置。本轮“震荡”只作用X/Y缩放，不额外添加位置晃动和旋转。

按钮禁用、面板打开、地图切换、建造模式禁止世界交互时均遵守当前门禁，视觉反馈不能绕过业务限制。触摸没有Hover，只有有效点击反馈。

## 2. 当前代码接点与主要风险

| 文件（默认assets/scripts/下）                        | 现状                                                      | 本轮处理                               |
| --------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| ui/hover/HoverInfoController.ts | 当前统一 pickTarget，退出无视觉通知 | UI 改接原生事件；世界保留拾取；统一 changeHovered 与清理 |
| ui/hover/HoverInfoTypes.ts、HoverInfoTarget.ts | 注册信息只有 getInfo 等 | 增加回调；UI Target 绑定/解绑原生 enter、leave |
| building/BuildingRenderer.ts                  | Sprite、Hover、尺寸和缩放同节点                                   | 逻辑Root保持不动，Sprite移入独立视觉子层          |
| world/WorldObjectRenderer.ts                  | 基地Sprite位于Root                                          | 仅基地拆视觉子层，资源链不变                     |
| map/MainMapController.ts                      | setBaseSpriteFrame直接getComponent(Sprite)                | 改为设置基地视觉Sprite，防止换图时又在Root创建第二张图   |
| building/BuildingBlueprintCardView\.ts        | Root有Sprite、Button、UIOpacity，selected/affordable各自控制    | 视觉子层反馈，Root继续负责命中、Button及opacity   |
| ui/squad/SquadRosterItemView\.ts              | setSelected移动Root、修改opacity与Graphics                    | 选中位移独立于弹性缩放，避免两个逻辑争写position/scale |
| feedback/HitFlashView\.ts                     | 每Sprite独立材质实例，自己写flashAmount并销毁                         | 参考生命周期，不复用受击闪白逻辑、不覆盖其材质            |
| effects/hit-flash.effect                      | 现有Sprite采样/透明混合模板                                       | 新建交互提亮effect，复用已运行的采样结构，不改现有受击效果   |

本轮明确替换 UI Scope 的 Hover 输入来源，适用于已注册的 UI Tooltip 目标，反馈仍按第1节白名单接入。世界 Scope 继续原拾取路径，不增加原生 enter/leave。两类来源共用一个 Hover 身份与 Tooltip，不允许旧 pickTarget 每帧重新选择 UI 并覆盖原生事件结果。

## 3. 节点结构：视觉动，逻辑不动

### 3.1 地图建筑

BuildingRoot：现有ID、世界坐标、UITransform固定尺寸、固定definition.visualScale、HoverInfoTarget及点击入口。

其下新增FeedbackRoot，再下放SpriteVisual。FeedbackRoot局部scale默认(1,1,1)，反馈系数乘在这一层，不改逻辑Root。原材质、SpriteFrame、尺寸与默认外观保持一致。

建筑采用底边中心作为缩放支点。若Root原锚点为中心、视觉高为H：
FeedbackRoot.position=(0,-H/2,0)，SpriteVisual.position=(0,+H/2,0)。
H是未乘Root固定scale的局部高度；不要重复乘GRID\_RENDER\_SCALE或definition.visualScale。初始化时先验证新旧静态图像重合。

SpriteVisual保留原中心锚点和尺寸，FeedbackRoot只是支点容器。选择线、血条、目标标记、导航、占格不放到反馈层内。Hover锚点始终为逻辑Root，其矩形不随动画变大。

基地走同样结构，但保留当前towncenter显示尺寸与对齐。把现有换图入口改成WorldObjectRenderer.setBaseSpriteFrame(frame)或等价显式接口，修改视觉子节点Sprite，不再由MainMapController在根节点get/add Sprite。

### 3.2 队伍与蓝图UI

CardRoot固定布局与命中，保留Button、HoverInfoTarget、UITransform及现有UIOpacity。
下面依次为SelectionOffsetRoot（只承载业务选中位移）与FeedbackRoot（只承载交互缩放），所有卡片可见内容放入FeedbackRoot。

- 蓝图背景Sprite从Root搬到视觉子层；Icon、NameLabel、EffectLabel、CostRoot、SelectionOutline同步迁移；修正getChild查找父节点。
- 队伍背景Graphics、Portrait、ColorStrip、MiniFlag、SlotBadge、SelectedOutline迁到视觉子层；修正drawBackground和getChild。
- 队伍setSelected不再移动CardRoot，而是设置SelectionOffsetRoot的X偏移；偏移量沿用SQUAD\_ROSTER\_SELECTED\_OFFSET\_X。CardRoot原始排列位置由RosterController唯一维护。
- 两类反馈均以卡片中心缩放；Button与Hover命中区保持原卡片大小，不能使用放大后的图像作为新命中范围。
- Button的自动Transition设置为NONE，避免内置SCALE/COLOR与反馈组件争抢；interactable仍由原逻辑控制。
- 选中描边与文字随卡片小幅缩放，但不参与提亮材质；selected颜色/opacity不被交互组件重置。

当卡片放大后视觉略超出命中边界，仍按原逻辑区域拾取，这是有意保持稳定。布局间距不足时减小UI预设放大比例，不在Hover时重新排版整条卡栏。

## 4. 独立动画实例与叠加合成

本轮明确采用**独立时间轴＋加法合成**，替代旧稿“单个弹簧修改target/velocity”的处理。新事件不打断旧动画，也不继承或改写旧实例速度。

新增文件仍为InteractionFeedbackMath.ts、InteractionFeedbackConfig.ts、InteractionFeedbackView.ts、InteractionBrightnessView.ts；无需引入第三方动画库。

### 4.1 独立性的三个层次

- 不同对象：A移出后仍在回弹，B可以立即开始；各自维护pulse列表，没有全局isAnimating互斥锁。
- 同一对象：进入A→离开→再次进入A，生成A的第二个pulse；第一个继续自己的时间轴。点击再加入第三个pulse。
- 同一对象不同属性：缩放pulse可以继续，Hover退出立即关闭亮度；没有某个旧动画的onComplete把整个对象scale重置为1或重新点亮。

“互不干扰”指实例的参数、时间和生命周期独立；同一物理scale的最终视觉必须有明确合成规则。不能让多个Tween直接竞争写Node.scale，后写覆盖前写不等于独立播放。

每个pulse数据：

    { id, kind: 'hover' | 'click', startTime, duration,
      amplitudeX, amplitudeY, frequencyX, frequencyY, decay }

每个对象一个单调时钟now；每次有效Hover false→true或有效点击push一个新pulse。指针在对象内部移动不是新的enter，不每帧增加pulse；同一物理点击产生的重复事件仍要去重。真实新事件不因已有动画而被吞掉。

### 4.2 单个pulse函数

每轴独立使用衰减正弦，返回相对于1的缩放增量：

    u = t / T
    z = clamp((u - 0.8) / 0.2, 0, 1)
    tail = 1 - z*z*(3 - 2*z)
    delta(t) = A * exp(-lambda*t) * sin(2*pi*f*t) * tail

t=now-startTime；t<0或t>=T返回0。最后20%寿命用平滑窗收尾，确保到期增量与斜率回到0，不在删除时跳变。X/Y使用独立A、f；每个pulse的t、T不因其他pulse启动而修改。

用绝对elapsed计算函数，不逐帧积分；相同采样时刻与帧率无关。传入非负有限dt推进对象时钟；后台恢复时自然跳过已到期pulse，而不是重启它们。

### 4.3 合成与写入

每帧计算该对象全部活跃pulse：

    sumX = sum(sampleX(pulse, now))
    sumY = sum(sampleY(pulse, now))
    ratioX = 1 + clamp(sumX, -0.20, 0.20)
    ratioY = 1 + clamp(sumY, -0.20, 0.20)
    FeedbackRoot.setScale(baseX * ratioX, baseY * ratioY, baseZ)

每个对象由一个合成器每帧最多写一次scale。base固定为初始化比例，不从当前已动画缩放反推。夹限只保护最终输出，不修改/删除任一pulse；极端密集触发时视觉会饱和，这是有限幅度的明确取舍。正常强度由下表调小，避免频繁碰上限。

到期只删除自己的pulse，不调用reset、不直接setScale(1)。仅当列表为空时，合成器写回基准并停止更新。不同对象可以同帧都在播放，且相互不读写pulse列表。

本轮Hover拉伸是“一次进入、一次震荡、自然回原比例”，不额外保持旧稿的持续悬停放大目标；悬停期间仍持续轻微提亮。这样Hover退出不会重定向正在播放的缩放。

### 4.4 起调参数

| 预设 | Hover振幅X/Y | Click振幅X/Y | 频率X/Y | lambda | 生命周期T | Hover亮度 |
|---|---|---|---|---:|---:|---:|
| WorldBuilding（含基地） | +0.060 / +0.085 | +0.080 / -0.105 | 4 / 5 Hz | 6 | 0.60秒 | 0.06 |
| SquadCard | +0.045 / +0.055 | +0.060 / -0.075 | 4.5 / 5.5 Hz | 7 | 0.50秒 | 0.05 |
| BlueprintCard | +0.045 / +0.065 | +0.065 / -0.085 | 4.5 / 5.5 Hz | 7 | 0.55秒 | 0.05 |

A为正弦前系数，不代表实际峰值必达A；衰减会降低峰值。参数为本项目起调建议，不是引用框架的默认数值。对象池可复用到期pulse数据，不能通过“已有动画则return”或删除最老pulse限制正常并发。

### 4.5 亮度单独由当前交互状态控制

桌面规则：hovered && enabled && !suspended时才允许brightnessGain>0；false时**立即写0**，不保留旧稿0.10秒淡出，也不等缩放结束。删除旧版点击额外提亮脉冲，点击只增加缩放pulse，避免鼠标离开后被点击计时器重新点亮。

Hover 进入直接设置预设微亮值（UI 默认 0.05，建筑 0.06），停留期间一直保持，不设置回落计时器；退出同步归零。初版不做亮度渐入渐出，方便验证事件和保持效果。只有状态/资格改变才写属性，不用异步完成回调。

移动端无Hover，本版在有效touch按住且可交互时轻微提亮，touch end/cancel立即归零；有效点击缩放仍继续播放。禁用、面板打开、失焦、切层同样让提亮立即消失。

## 5. 持续微提亮与 Hit Flash：两种不同效果

| 项目 | Hover 微提亮 | 受击 Hit Flash |
|---|---|---|
| 触发 | 鼠标进入且允许反馈 | 受击事件 |
| 强度 | 原 RGB 约乘 1.05～1.06，保留色相和纹理 | 明显的高亮/闪白，沿用现有受击表现 |
| 持续 | 鼠标停留多久就保持多久 | 短促脉冲，随后恢复 |
| 结束 | leave、失焦、遮挡或反馈禁用时立即归零 | 受击效果计时结束 |
| 参数 | brightnessGain | flashAmount |

不得把 HitFlashView 的闪白计时器用于 Hover，不得每次 enter 播一次很亮再变暗的动画。点击也不触发 Hit Flash。第4节缩放 pulse 的到期与亮度保持完全独立。

### 5.1 独立 RGB 增益实现

新增 `assets/effects/interaction-brightness.effect` 与 `assets/material/interaction-brightness.mtl`，以仓库hit-flash.effect的Sprite渲染模板为基础；保留USE\_TEXTURE、分离Alpha采样、IS\_GRAY、顶点色、Alpha Test和原透明混合配置。材质UUID由Creator生成，不复制旧effect的UUID。

Hover离开当帧brightnessGain恢复0；是否仍有缩放pulse运行与此无关。

新uniform/property为brightnessGain，默认0。在纹理采样并乘顶点色之后、ALPHA\_TEST之前：

```
o.rgb = min(o.rgb * (1.0 + brightnessGain), vec3(1.0));
```

o.a完全不变。目标是略提高亮度，不混白、不增加白色光圈、不把透明像素变不透明；Label颜色、Graphics阵营色不改。

Sprite.color通常已经WHITE，继续加到255以上不能作为提亮实现。也不要修改整张Texture或共享SpriteFrame，不给同图集其他Sprite一起提亮。

InteractionBrightnessView为明确列出的目标Sprite各持有独立MaterialInstance：

1. 接收加载好的共享基础材质。
2. 对目标Sprite设置该材质，获取实例，只对该实例写brightnessGain。
3. 闲置且数值未变化时不重复setProperty。
4. disable时归零；destroy时释放自己拥有的实例，避免重复销毁与引用泄漏。
5. 保存原材质，仅在组件仍是该Sprite材质所有者时恢复，不能覆盖后来由别的系统安装的材质。

本轮这些目标不接入HitFlashView：资源/敌怪的闪白材质完全不变。如果未来建筑同时需要受击闪白，必须在同一effect中合成独立flashAmount与brightnessGain并统一材质所有权，不能两个组件反复setSharedMaterial。

蓝图卡的background和icon可用不同实例但接收同一亮度值；队伍只提亮Portrait；所有UIOpacity继续由原selected/affordable逻辑决定。提亮不能把不可用卡的115透明度改回255。

自定义材质可能增加draw call；本轮为少量可交互对象接受该成本，先测再优化，不为此引入全局图集或批处理重构。

## 6. UI 改用 MOUSE_ENTER / MOUSE_LEAVE，保留唯一 Hover 状态

### 6.1 输入职责与范围

- HoverInfoTarget：UI Scope 在固定 CardRoot 上用 node.on 注册 Node.EventType.MOUSE_ENTER 和 MOUSE_LEAVE；不用 once（每次进出都需响应）。World Scope 不注册这两个事件。
- HoverInfoController：接受 UI enter/leave 上报，唯一拥有当前 hovered、UI 候选、门禁与 Tooltip；视觉层不再自行维护第二套命中判定。
- 原 pickTarget 改为 pickWorldTarget，只遍历 World Scope。lateUpdate 优先保留有效 UI 候选，只有没有 UI 候选且没有 HUD/弹窗遮挡时才拾取世界对象。
- UI 的正常进出不再依赖全局 input.MOUSE_MOVE 坐标是否更新，也不等待下一帧轮询。原全局监听保留给世界拾取及位置记录。

HoverInfoTargetConfig / HoverInfoSource 增加可选 onHoverChanged?: (hovered: boolean) => void，透传到 feedback.setHovered(value)。Target 新增稳定的 onMouseEnter/onMouseLeave 方法引用，注册一次；onDisable/onDestroy/setup 变更时先退出旧 source 并解绑自己的监听，再按新 config 注册。不能 off 掉 Button 或其他组件的回调；同步更新该文件的职责注释。

CardRoot 必须保留 UITransform，命中大小不随动画变化。反馈视觉子节点不再额外注册鼠标监听或 HoverInfoTarget；Button transition 为 NONE，但不移除 Button 和现有点击逻辑。若存在必须响应输入的子节点，需把事件归属统一映射到同一卡片，避免父子目标切换被当作真实重入；初版两类卡片优先保持一个输入根。

### 6.2 事件上报与幂等转换

建议控制器入口（命名可按项目风格调整）：

    notifyUiEnter(anchor, event)
    notifyUiLeave(anchor)
    changeHovered(next)
    clearHover(reason)

enter：查找已注册且有效的 UI source，记录最新坐标/windowId，登记 UI 候选；门禁允许则立即 changeHovered(source)。同目标重复 enter 不触发新 pulse。

leave：清除对应候选；仅当离开的 anchor 仍是当前目标时 changeHovered(null)。若 A 的 leave 晚于 B 的 enter，不能清掉 B。下一次世界拾取必须使用有效位置且通过 HUD 遮挡规则，不能用旧世界坐标立即点亮下方建筑。

changeHovered(next)：
1. 比较目标身份，相同则返回。
2. 对旧 source 调用 onHoverChanged(false)，立即清提亮。
3. 更新 hovered，再对新 source 调用 onHoverChanged(true)，保持微亮并追加一次独立缩放 pulse。
4. 最后执行 Tooltip beginShow/beginHide；提示框的 0.08 秒显示与 0.03 秒隐藏延迟不影响反馈。

getInfo 保持纯文本读取。Tooltip 到时隐藏只清展示状态，不能清除已切换到 B 的原始 Hover 身份。拆开 hideTooltipImmediately 与 clearHover，删除原有直接 hovered=null 而不通知 false 的路径。

### 6.3 原生事件的边界与恢复

本轮是原生 UI 事件接入试验，不声称原生事件能够解决所有静止指针、遮挡或失焦情形。

- unregister、节点停用/销毁、弹窗开启、切层、应用失焦：显式 clearHover，先 false 再清引用；不能指望 Cocos 一定补发 leave。
- suspended 时可以记录最新位置，但不产生视觉 enter。关闭面板、UI 布局改变/重建后，用有效最新位置做一次 UI 范围及遮挡校验，必要时恢复 hover；这属于结构变化校正，不恢复每帧 UI 扫描。
- 全局 input.MOUSE_MOVE 可能被 UI 消费。需要恢复校验时，位置缓存由全局监听和相关 UI 祖先的 MOUSE_MOVE 捕获监听共同更新；捕获回调只记录位置，不派发 Hover、不停止传播、不开放点击穿透。所有输入根都须覆盖并在销毁时解绑。
- 失焦/离开游戏窗口使位置无效并清亮度。Web 端窗口/画布离开与焦点监听封装在平台适配处，原生端使用对应可用生命周期；无有效位置时不按失焦前坐标恢复，等待新的有效输入。
- 结构变化校正只能选当前可交互层级最上方的 UI，考虑 Mask、弹窗/HUD 遮挡；相同层级按实际显示顺序决胜，不能靠注册顺序。先统一去重入口，后补此恢复校验，不能让两套路径各发一次动画。
- 世界门禁关闭只退出 World 目标，不误伤仍可操作的 UI；全局 suspended 则清所有 Hover。
- UI leave 后即使没有新的 enter，HUD 非目标区域仍应阻挡世界 Hover，不允许鼠标停在面板空白处却提亮下面建筑。
- 不修改引擎私有 previousMouseIn 等字段。补偿恢复后收到的重复原生 enter 由同目标去重解决。

UI 卡不可支付时仍可显示 Tooltip，原始 Hover 身份保留，反馈资格设为 false；恢复可支付且仍 Hover 时恢复微亮，不伪造新 enter 或补发缩放。已启动的缩放 pulse 不受上述普通退出/门禁变化影响；实际节点停用/销毁才清实例。

### 6.4 最小诊断

开发开关下记录输入来源、时间、anchor、旧/新 Hover、brightnessGain 与清理原因。重点比较原生 enter/leave 与全局 MOUSE_MOVE 是否同时到达。正常日志关闭，禁止每帧刷屏。若仍有漏报，先区分事件未到、门禁过滤、命中层级错误和材质未更新，再决定是否扩大校正范围；不能用持续触发 pulse 掩盖问题。

## 7. 点击接入：反馈只发生一次

### UI卡片

在现有Button.EventType.CLICK回调内统一包装：
先检查现有交互门禁和button.interactable；
feedback.playClick()；
执行原onSelect()。

不要同时在TOUCH\_END和Button.CLICK都播放。键盘数字选队引起setSelected不应伪造鼠标点击脉冲；本轮只反馈真实点击。重复setup时按当前风格先解绑自己的旧回调再绑定，不能累积监听。

当蓝图setAffordable(false)，同步feedback.setInteractionEnabled(false)，立即归零亮度并禁止新pulse；已有缩放pulse自然结束，不因此被打断；Tooltip仍允许解释成本。变回可用时，如果当前鼠标仍在该卡上，恢复适用Hover状态，不要求重新进出。反馈组件可保留原始hovered意图与enabled两个独立字段，亮度资格由两者共同决定，已经启动的pulse与这两个字段独立。

### 地图建筑

已建建筑当前只有Hover，没有业务点击。仅给其逻辑Root加轻量点击反馈适配，不把建筑强行注册成资源/队伍目标。使用与WorldObjectView一致的8屏幕像素拖动阈值、单指/取消判定、按下/抬起同一逻辑命中区域；多指、右键、取消、拖图不触发。

实现可把上述手势判断提成feedback/FeedbackClickTarget.ts，**只接新建建筑**。主基地继续已有WorldObjectView→WorldCommandController入口，在基地分流处插入一次playClick，不重复加Touch适配器。

地图点击应复用当前输入阻断条件：建造工具激活、基地面板打开、transition.isTransitioning、HUD覆盖时不反馈。点击时采样当前点击位置，不用上一帧鼠标Hover对象代替。若当前逻辑拾取判定不是该建筑则忽略，避免被上层UI/对象挡住还弹跳；必要时把HoverInfoController现有候选排序提为可复用pickAt(screenPoint)方法，但不增加第二套拾取状态机。

基地反馈在门禁通过后、现有onBaseClicked前调用。基地弹出面板使Hover暂停，应立刻清除提亮，已有缩放pulse可在仍可见的节点上自然结束；不为了完整播放动画延迟打开面板。未达三杀时可以响应轻量点击触感，但仍不打开页面、不派回城。

反馈不负责扣资源、切选队、进入建造或弹出面板，以上依然归原controller。

## 8. 生命周期与切层

InteractionFeedbackView建议接口：

- setup({visualRoot, brightnessTargets, preset})
- setHovered(value)
- playClick()
- setInteractionEnabled(value)
- reset()
- dispose()

只保存初始化基准scale/position，不在每次点击读取已经被动画放大的scale作为新基准。由于FeedbackRoot只供本组件写，缩放增量始终相对基准(1,1)，静态美术缩放由其父节点负责。

普通Hover exit不调用reset，只清提亮。onDisable/onDestroy/显式reset才释放该对象全部pulse及亮度并恢复基准；这是对象生命周期清理，不是新动画中断旧动画。对象未被停用、仅失去Hover或变为不可交互时，已有pulse继续更新。列表为空时跳过缩放更新。

主基地面板打开/切层时，使用当前HoverInfoController.setSuspended和世界门禁退出。持久建筑经过地图切换后不会再次setup或重复创建MaterialInstance；新建建筑创建时接入一次即可。SpriteFrame从towncenter0换成1时保留视觉组件与材质，仅替换帧。

Roster/Card重建前应销毁旧节点及其组件，不能只removeAllChildren让材质实例和监听滞留；本轮只修接入对象的清理，不清除其业务注册表。

## 9. 施工顺序与文件范围

| 顺序 | 工作                                 | 验证点                         |
| -- | ---------------------------------- | --------------------------- |
| 1  | Math、Config纯函数与三个预设                | 30/60/120FPS接近，连续点击有界且收敛    |
| 2  | 新effect/mtl及BrightnessView         | RGB微亮、Alpha不变、不影响共用图集对象     |
| 3 | UI Target 原生 enter/leave 接入，Controller 分离 UI 与 World 来源 | A→B、离开、暂停、销毁配对；旧轮询不覆盖 UI |
| 4  | BlueprintCardView接入独立视觉层与原Button点击 | 选中描边、不可支付、Tooltip不回归        |
| 5  | SquadRosterItemView接入，选中位移拆层       | 不与setSelected争写，头像轻亮、队伍颜色不变 |
| 6  | BuildingRenderer与基地视觉接入            | 占格、命中、基地产帧切换与业务点击正常         |
| 7  | MainMapController加载并注入新材质，绑定现有门禁   | 打开面板与切层无残留缩放/亮度             |

新增文件：Math、Config、FeedbackView、BrightnessView，以及普通建筑需要的FeedbackClickTarget；新增一套effect/mtl。
修改接点：Hover三文件、两种CardView、BuildingRenderer、WorldObjectRenderer、基地点击分流、MainMapController。不要修改怪物数值、地图数据、建筑费用或部队整备逻辑。

遵守AGENTS.md：新.ts使用Why this file exists / Ownership boundary / This file deliberately does NOT文件头。新资源及脚本.meta由Creator独立生成并提交。

## 10. 验收清单

- 三类目标Hover即响应，X/Y有独立节奏；离开后最终scale精确归1、brightnessGain归0。
- 静止鼠标时地图平移/缩放，仍由既有集中拾取选择正确目标；弹性不导致反复进出边界。
- 连点100次每次产生独立pulse，输出有界；所有pulse到期后归零，不永久累积实例或缩放。
- 30/60/120FPS相同输入下曲线接近；后台恢复无爆跳。
- 鼠标点击和触摸各只播放一次；拖图、取消手势、多指不播放。
- 队伍选中偏移/透明度/颜色不丢，蓝图selected描边/affordable禁用不丢。
- Disabled蓝图可看Tooltip，但不产生成功点击反馈或提亮。
- 同图集另一张卡/建筑不跟着亮，半透明边缘和Alpha保持正确。
- UI 原生 enter 立即微亮并保持至少10秒，无先强闪再回落；leave 当次处理就写0，不等 Tooltip 或缩放结束。
- 在卡片内部移动不重复触发 pulse；A→B→A 每次真实重入追加独立 pulse；A 晚到 leave 不清 B。
- Button 消费全局移动事件时 UI enter/leave 仍驱动 Tooltip 与反馈；旧世界轮询不夺取 UI Hover。
- 鼠标不动时开关弹窗、重建卡栏，校正结果与遮挡一致；失焦、离开窗口、销毁后没有残留亮度。
- 不足资源蓝图仍显示成本提示，变为可用且仍 Hover 时恢复微亮；HitFlashView 受击强闪与恢复表现不变。
- 打开面板立即无提亮，仍可见对象的既有pulse自然结束；实际停用/销毁或切层reset后无缩放与提亮残留。
- 基地换图后只有一张Sprite，位置尺寸正常，仍能三杀后打开面板。
- 新建/反复切换后材质实例、事件监听数量不无界增长。
- 弹性只改视觉，建筑占格/寻路/点击判定和UI布局不受影响。

自动检查聚焦独立pulse函数、加法合成、不同dt一致性与亮度状态；实际手感、材质编译、九宫格与输入需Creator预览验证。本次仅提供实施方案，不宣称完成运行测试。

## 11. 文档位置

本方案放置：
`instructions/TowerDown_InteractionFeedback_ScaleBrightness_V1.md`。

上一份双地图与部队整备方案仍保留，作为已实现功能的参考；本轮未要求归档，不移动其他文档。

## 12. 成熟模式参考与本项目选择

本轮检索采用下列一手文档/平台文档，借鉴的是动画合成模式，不把Unity或Web动画API引入Cocos。

1. [Unity AnimationLayerMixerPlayable.SetLayerAdditive](https://docs.unity3d.com/ScriptReference/Animations.AnimationLayerMixerPlayable.SetLayerAdditive.html)：官方区分叠加层与覆盖层；为本方案选择独立效果相加提供模式参考。
2. [MDN animation-composition](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-composition)：说明多个效果如何与基础属性进行replace/add/accumulate合成。本项目只借鉴显式合成概念；数值scale增量求和是本项目规则，不声称等价于CSS transform列表的add语义。
3. [Cocos Creator 3.8 Tween接口](https://docs.cocos.com/creator/3.8/manual/en/tween/tween-interface.html)：stopAllByTarget会停止同目标上的全部Tween。因此本轮普通Hover/点击禁止通过此接口清掉旧动画；采用独立pulse数据＋唯一写入者。

旧方案“持续修改一个弹簧目标”“重复点击重启一个计时器”的规则已由第4节替换。不是排队，也不是停掉旧动画后从当前值续播。

### 必测并发序列

| 输入 | 缩放预期 | 亮度预期 |
|---|---|---|
| A进入，0.08秒后移到B | A的pulse继续，B新pulse同时开始 | A立即0，B提亮 |
| A进入→退出→0.15秒内重入 | A有两个不同startTime的pulse，旧者不重启 | 按最新Hover状态 |
| 同一A连续点击3次 | 三个pulse独立计时，逐帧增量求和 | 仍只看Hover/触摸按住状态 |
| 旧pulse结束，新pulse仍活跃 | 仅移除旧实例，不把scale设回1 | 不受pulse结束影响 |
| A退出后仍震荡 | 正常播放至自己的T | 全程为0，不被晚到回调点亮 |
| 所有pulse结束 | 精确基准scale，无活动实例 | 若仍Hover可亮；退出必为0 |

调试纯函数检查：记录第一个pulse在单独播放时的sample(t)，加入第二个后其sample(t)必须完全一致；合成前sum等于各sample之和。这样验证的是“旧动画未被修改”，不只是肉眼觉得连续。

### V1.2 输入参考

- [Cocos Creator 3.8 节点事件](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-node.html)：MOUSE_ENTER / MOUSE_LEAVE、捕获与冒泡。
- [Cocos 3.8.8 NodeEventProcessor](https://github.com/cocos/cocos-engine/blob/v3.8.8/cocos/scene-graph/node-event-processor.ts)：原生鼠标命中与进入退出处理。
- [Cocos 3.8.8 PointerEventDispatcher](https://github.com/cocos/cocos-engine/blob/v3.8.8/cocos/2d/event/pointer-event-dispatcher.ts)：UI 派发与后续全局事件的关系。

本版仅更新实施方案，尚未修改运行时代码或验证 Creator 实机表现。
