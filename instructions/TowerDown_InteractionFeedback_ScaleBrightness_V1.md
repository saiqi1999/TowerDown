# TowerDown 建筑与卡片交互反馈技术方案 V1

> 基于main提交 `ad31bb35efd24445148074d5c8f43d39e404e636`（next level），Cocos Creator 3.8.8。
> 本轮交付技术方案，不修改运行时代码。目标：地图建筑、队伍UI、建筑蓝图卡的Hover与点击具有X/Y独立阻尼震荡缩放，并轻微提亮图片。
> 不改变建造、选队、基地面板、地图切换与部队整备业务。继续复用已有集中Hover控制器。

## 1. 反馈范围

| 对象                      | Hover             | 有效点击                | 提亮对象                  |
| ----------------------- | ----------------- | ------------------- | --------------------- |
| 地图已建建筑                  | 小幅放大并回弹到悬停比例      | 横向展开、纵向压缩后回弹        | 建筑Sprite              |
| 主基地                     | 同地图建筑             | 反馈后立即执行现有基地逻辑，不等待动画 | 基地Sprite              |
| 左侧队伍UI                  | 卡片小幅放大            | 回弹＋现有选队             | Portrait图片；不改变阵营色条与文字 |
| 底部蓝图卡                   | 卡片小幅放大            | 可操作时回弹＋现有蓝图选择       | 卡片背景Sprite与Icon       |
| 不足资源的蓝图                 | 保留Tooltip；不做放大/提亮 | 不做点击反馈，不放行按钮        | 保持现有低透明度              |
| 资源、敌人、地图单位本体、Ghost、目的地卡 | 本轮不接入             | 原业务不变               | 不接入                   |

Hover反馈在命中目标改变时立即发生，不等待Tooltip的0.08秒显示延迟。离开后回到正常比例和亮度。点击不循环播放，不持续抖动，不震动相机或地图位置。本轮“震荡”只作用X/Y缩放，不额外添加位置晃动和旋转。

按钮禁用、面板打开、地图切换、建造模式禁止世界交互时均遵守当前门禁，视觉反馈不能绕过业务限制。触摸没有Hover，只有有效点击反馈。

## 2. 当前代码接点与主要风险

| 文件（默认assets/scripts/下）                        | 现状                                                      | 本轮处理                               |
| --------------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| ui/hover/HoverInfoController.ts               | 集中pickTarget；没有enter/exit对外通知；hideImmediately直接清hovered | 增加纯视觉回调，并统一所有离开/清空路径               |
| ui/hover/HoverInfoTypes.ts、HoverInfoTarget.ts | 注册信息只有getInfo等                                          | 可选onHoverChanged(boolean)，注册时透传    |
| building/BuildingRenderer.ts                  | Sprite、Hover、尺寸和缩放同节点                                   | 逻辑Root保持不动，Sprite移入独立视觉子层          |
| world/WorldObjectRenderer.ts                  | 基地Sprite位于Root                                          | 仅基地拆视觉子层，资源链不变                     |
| map/MainMapController.ts                      | setBaseSpriteFrame直接getComponent(Sprite)                | 改为设置基地视觉Sprite，防止换图时又在Root创建第二张图   |
| building/BuildingBlueprintCardView\.ts        | Root有Sprite、Button、UIOpacity，selected/affordable各自控制    | 视觉子层反馈，Root继续负责命中、Button及opacity   |
| ui/squad/SquadRosterItemView\.ts              | setSelected移动Root、修改opacity与Graphics                    | 选中位移独立于弹性缩放，避免两个逻辑争写position/scale |
| feedback/HitFlashView\.ts                     | 每Sprite独立材质实例，自己写flashAmount并销毁                         | 参考生命周期，不复用受击闪白逻辑、不覆盖其材质            |
| effects/hit-flash.effect                      | 现有Sprite采样/透明混合模板                                       | 新建交互提亮effect，复用已运行的采样结构，不改现有受击效果   |

本轮不顺带重写Scope HitTest或重构地图切换。继续使用仓库当前拾取路径；如果实现中发现命中精度问题，单独定位，而不是给世界对象额外加MOUSE\_ENTER/LEAVE形成两套Hover状态机。

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

## 4. 公共阻尼震荡函数

新增：

- feedback/InteractionFeedbackMath.ts：纯函数，X/Y分别更新。
- feedback/InteractionFeedbackConfig.ts：三个预设，不散落魔法数。
- feedback/InteractionFeedbackView\.ts：单个对象的Hover/点击状态与视觉更新。
- feedback/InteractionBrightnessView\.ts：Sprite材质实例与亮度写入。

每轴保存value、velocity、target，满足：
x''＋2ζωx'＋ω²(x−target)=0。

采用欠阻尼解析步进（0<ζ<1），避免不同FPS下不同震荡幅度。一个共享函数stepAxis(value, velocity, target, omega, zeta, dt)同时用于X/Y，仅参数不同。

计算步骤：

```
e = value - target
a = zeta * omega
w = omega * sqrt(1 - zeta * zeta)
c = cos(w * dt)
s = sin(w * dt)
decay = exp(-a * dt)

nextValue = target + decay * (e * c + (velocity + a * e) / w * s)
nextVelocity = decay * (velocity * c - (a * velocity + omega * omega * e) / w * s)
```

调用前校验omega>0、0\<zeta<1、dt有限且非负。正常帧使用实际dt；从后台恢复且dt>0.25秒时直接吸附目标并清速度/点击闪亮脉冲，避免隔很久回来继续弹。若绝对误差<0.001且绝对速度<0.01，吸附目标，停止无意义更新。

### 4.1 默认参数（起调值）

| 预设                 | Hover目标X/Y    | omega X/Y | zeta X/Y    | 点击速度脉冲X/Y   | Hover亮度增益 | 点击额外亮度峰值 |
| ------------------ | ------------- | --------- | ----------- | ----------- | --------: | -------: |
| WorldBuilding（含基地） | 1.035 / 1.055 | 23 / 27   | 0.56 / 0.50 | +2.2 / -3.0 |      0.06 |     0.04 |
| SquadCard          | 1.035 / 1.035 | 27 / 31   | 0.65 / 0.58 | +1.6 / -2.2 |      0.05 |     0.04 |
| BlueprintCard      | 1.03 / 1.045  | 26 / 30   | 0.62 / 0.55 | +1.8 / -2.5 |      0.05 |     0.04 |

idle目标均为(1,1)。进入Hover只改变target，不把当前value/velocity重置；离开改回(1,1)。因此快速扫过/重入也是连续的。

有效点击对当前velocity追加脉冲；X先展开、Y先压缩，然后围绕当前Hover或idle目标回弹。禁止点击时排队Tween或等上次动画结束。速度逐轴夹到\[-4,4]；缩放数值防护夹到\[0.80,1.20]，碰到边界时清掉朝外的速度。正常预设应很少触发此夹限。

点击亮度额外量从峰值在0.12秒内平滑衰减到0，重复点击重启这一个计时器，不无限叠加。交互亮度总增益上限0.12。Hover亮度进入约0.08秒、离开约0.10秒平滑变化，可用1-exp(-dt/tau)插值，避免线性逐帧加常量导致FPS差异。

## 5. 轻微提亮：独立RGB增益

新增 `assets/effects/interaction-brightness.effect` 与 `assets/material/interaction-brightness.mtl`，以仓库hit-flash.effect的Sprite渲染模板为基础；保留USE\_TEXTURE、分离Alpha采样、IS\_GRAY、顶点色、Alpha Test和原透明混合配置。材质UUID由Creator生成，不复制旧effect的UUID。

hover离开后，亮度恢复为初始值。

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

## 6. 接入唯一Hover来源

HoverInfoTargetConfig与HoverInfoSource都增加可选：
onHoverChanged?: (hovered: boolean) => void。

HoverInfoTarget注册时把回调透传；调用反馈组件setHovered(value)。原getInfo与Tooltip位置逻辑保持。

HoverInfoController内部新增统一changeHovered(next)：

1. 相同目标不重复通知。
2. 对旧目标调用false。
3. 更新hovered。
4. 对新目标调用true。
5. 再执行原Tooltip的beginShow/beginHide流程。

必须接入：

- resolveHoveredTarget的A→B、A→空。
- unregister当前目标。
- setSuspended(true)。
- worldHoverEnabled关闭。
- 当前目标失活/无效。
- hideImmediately及onDestroy。

不能先把hovered=null再调用false，否则视觉组件收不到退出。清Tooltip与清原始Hover身份要区分：Tooltip延迟隐藏不应延迟视觉exit；切换A→B时不能让后续旧Tooltip清理把B再误退出。

暂挂时清反馈并停止拾取；解除时使用有效的最新指针位置重新拾取。现有setSuspended会清hasPointer，可改为暂挂期间继续采样位置但不拾取，恢复时下一帧重新计算；应用失焦则清指针有效性，避免在未知位置恢复Hover。

getInfo只返回文本，不承担动画副作用。FeedbackRoot不注册第二个HoverInfoTarget，不用MOUSE\_ENTER/MOUSE\_LEAVE驱动同一反馈。

## 7. 点击接入：反馈只发生一次

### UI卡片

在现有Button.EventType.CLICK回调内统一包装：
先检查现有交互门禁和button.interactable；
feedback.playClick()；
执行原onSelect()。

不要同时在TOUCH\_END和Button.CLICK都播放。键盘数字选队引起setSelected不应伪造鼠标点击脉冲；本轮只反馈真实点击。重复setup时按当前风格先解绑自己的旧回调再绑定，不能累积监听。

当蓝图setAffordable(false)，同步feedback.setInteractionEnabled(false)，立即清Hover/点击脉冲并归零亮度；Tooltip仍允许解释成本。变回可用时，如果当前鼠标仍在该卡上，恢复适用Hover状态，不要求重新进出。反馈组件可保留原始hovered意图与enabled两个独立字段，最终目标由两者共同决定。

### 地图建筑

已建建筑当前只有Hover，没有业务点击。仅给其逻辑Root加轻量点击反馈适配，不把建筑强行注册成资源/队伍目标。使用与WorldObjectView一致的8屏幕像素拖动阈值、单指/取消判定、按下/抬起同一逻辑命中区域；多指、右键、取消、拖图不触发。

实现可把上述手势判断提成feedback/FeedbackClickTarget.ts，**只接新建建筑**。主基地继续已有WorldObjectView→WorldCommandController入口，在基地分流处插入一次playClick，不重复加Touch适配器。

地图点击应复用当前输入阻断条件：建造工具激活、基地面板打开、transition.isTransitioning、HUD覆盖时不反馈。点击时采样当前点击位置，不用上一帧鼠标Hover对象代替。若当前逻辑拾取判定不是该建筑则忽略，避免被上层UI/对象挡住还弹跳；必要时把HoverInfoController现有候选排序提为可复用pickAt(screenPoint)方法，但不增加第二套拾取状态机。

基地反馈在门禁通过后、现有onBaseClicked前调用。基地弹出面板使Hover暂停，应立刻释放Hover反馈；不为了完整播放动画延迟打开面板。未达三杀时可以响应轻量点击触感，但仍不打开页面、不派回城。

反馈不负责扣资源、切选队、进入建造或弹出面板，以上依然归原controller。

## 8. 生命周期与切层

InteractionFeedbackView建议接口：

- setup({visualRoot, brightnessTargets, preset})
- setHovered(value)
- playClick()
- setInteractionEnabled(value)
- reset()
- dispose()

只保存初始化基准scale/position，不在每次点击读取已经被动画放大的scale作为新基准。由于FeedbackRoot只供本组件写，目标比例始终相对(1,1)，静态美术缩放由其父节点负责。

onDisable/onDestroy/reset清速度、计时器、hover状态和亮度，恢复基准比例。组件不可见时不计算动画；达到平衡时跳过变换与材质写入。

主基地面板打开/切层时，使用当前HoverInfoController.setSuspended和世界门禁退出。持久建筑经过地图切换后不会再次setup或重复创建MaterialInstance；新建建筑创建时接入一次即可。SpriteFrame从towncenter0换成1时保留视觉组件与材质，仅替换帧。

Roster/Card重建前应销毁旧节点及其组件，不能只removeAllChildren让材质实例和监听滞留；本轮只修接入对象的清理，不清除其业务注册表。

## 9. 施工顺序与文件范围

| 顺序 | 工作                                 | 验证点                         |
| -- | ---------------------------------- | --------------------------- |
| 1  | Math、Config纯函数与三个预设                | 30/60/120FPS接近，连续点击有界且收敛    |
| 2  | 新effect/mtl及BrightnessView         | RGB微亮、Alpha不变、不影响共用图集对象     |
| 3  | HoverTypes/Target/Controller增加视觉回调 | A→B、离开、暂停、销毁都有配对通知          |
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
- 连点100次不越来越大、不堆积Tween、不出现负比例；重入平滑。
- 30/60/120FPS相同输入下曲线接近；后台恢复无爆跳。
- 鼠标点击和触摸各只播放一次；拖图、取消手势、多指不播放。
- 队伍选中偏移/透明度/颜色不丢，蓝图selected描边/affordable禁用不丢。
- Disabled蓝图可看Tooltip，但不产生成功点击反馈或提亮。
- 同图集另一张卡/建筑不跟着亮，半透明边缘和Alpha保持正确。
- 打开基地面板、切换地图、禁用/销毁对象后无放大或提亮残留。
- 基地换图后只有一张Sprite，位置尺寸正常，仍能三杀后打开面板。
- 新建/反复切换后材质实例、事件监听数量不无界增长。
- 弹性只改视觉，建筑占格/寻路/点击判定和UI布局不受影响。

自动检查聚焦阻尼函数有界收敛、不同dt一致性与亮度钳制；实际手感、材质编译、九宫格与输入需Creator预览验证。本次仅提供实施方案，不宣称完成运行测试。

## 11. 文档位置

本方案放置：
`instructions/TowerDown_InteractionFeedback_ScaleBrightness_V1.md`。

上一份双地图与部队整备方案仍保留，作为已实现功能的参考；本轮未要求归档，不移动其他文档。
