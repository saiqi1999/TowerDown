# TowerDown Hover 持续放大与提亮技术方案 V1

> 代码基线：main 23f81c25f1b69a3c617a1a323b9de425e3d42768。
> 本次只提交方案，不修改运行时代码。覆盖旧方案中“hover 触发独立震荡脉冲”的规定；点击脉冲保留。
> 目标：排除 hover 弹跳曲线造成的起效不明显，观察命中检测本身是否及时。

## 1. 明确表现与范围

适用对象：地图建筑（含已接入反馈的主基地）、下方建筑蓝图卡片、左侧队伍卡片。不是地图中的每名士兵。只处理已经接入 InteractionFeedbackView 的对象，不给资源点/怪物新增表现。

首版参数：

| 项目 | 规则 |
|---|---|
| Hover 缩放 | X、Y 均为原始比例的 1.05；Z 不变 |
| 进入过渡 | 0ms：收到有效 hover 的同一回调中写缩放，不等待 update、不播放缓动 |
| 持续 | 保持 105%，不来回弹动、不积累 hover 脉冲 |
| Hover 提亮 | 建筑 gain=0.06；队伍卡与蓝图卡 gain=0.05，沿用现有材质 |
| 离开 | 同一回调清除 hover 缩放与提亮，下一次绘制体现 |
| 点击 | 仍可播放现有独立 X/Y 点击脉冲；不得重新引入 hover 脉冲 |
| Tooltip | 原显示/隐藏延迟保留，不控制反馈起效时间 |

“快速放大”在本次排查版明确为立即放大，而不是新增 50～100ms 渐变。排查完成后若需要平滑，另调参数；本版不混入缓动，以免再次难以区分检测与动画延迟。

退出时“复原”指 hover 通道回到基准；如果存在尚未结束的点击脉冲，它可继续完成，结束后精确回到 baseScale。验收 hover 时先不点击，避免混淆。各对象的状态互不影响。

不引入 Button，不增加路径穿越补发，不重写地图点击/拖动/框选规则，不承诺本次解决采样跳过目标。

## 2. 当前代码事实与假设

1. InteractionFeedbackView.setHovered(true) 当前调用 pushPulse(preset.hover)。
2. InteractionFeedbackMath.sampleInteractionPulse 使用 amplitude × decay × sin(2πft)，t=0 时缩放增量为0；实际可见程度依赖后续采样时刻。没有发现专门的 hover 动画启动计时器。
3. setHovered(false) 只撤提亮，不取消已进入 pulses 的弹跳，这是旧需求的实现，不符合本轮持续状态表现。
4. update 在 pulses.length===0 时早退。新实现使用即时状态写入，不依靠 update 启动 hover。
5. HoverInfoController.changeHovered 立即调用 onHoverChanged，再开始 tooltip 显示流程；tooltip 的 showTimer 不应解释为缩放启动延迟。
6. 地图建筑仍为 World：onMouseMove 只记录最终鼠标位置，lateUpdate 才 pickWorldTarget；UI 为 MOUSE_ENTER/LEAVE。漏采样与视觉起效不明显可能并存。
7. BuildingRenderer 已将命中节点与 FeedbackRoot 分开。必须保留，不能让放大改变命中矩形形成反复进入/退出。

结论：有依据怀疑正弦起点使反馈不明显，但尚无运行日志证明这是全部原因。本方案通过替换表现验证该假设。

## 3. 逐脚本修改清单

### 3.1 assets/scripts/feedback/interaction/InteractionFeedbackConfig.ts

修改 InteractionFeedbackPreset：
- 删除 hover: InteractionPulsePreset。
- 新增 readonly hoverScaleMultiplier: number，三个 preset 均为1.05。
- 保留 click 和 hoverBrightnessGain 原参数。

原因：hover 是持续状态，不能再借用一次性 pulse 的数据结构。删除旧字段可让编译器暴露遗漏调用。

### 3.2 assets/scripts/feedback/interaction/InteractionFeedbackView.ts

继续作为唯一缩放写入者，不增加并行 Tween 或另一个组件写同一 visualRoot。

| 方法 | 修改/新增、原因与功能 |
|---|---|
| setup(config) | 保留；重新 setup 前 resetFeedback 恢复旧 visualRoot，再读取新根的 baseScale，防止把105%当新基准 |
| setHovered(hovered:boolean):void | 修改；只保存状态，同步调用 applyScale/applyBrightness；删除 pushPulse(preset.hover) |
| isHoverVisualActive():boolean | 新增 private；返回 hovered && enabledForInteraction，缩放和亮度共用这个资格 |
| setInteractionEnabled(enabled:boolean):void | 修改；状态变化立即同时刷新缩放与亮度，不能只恢复亮度 |
| playClick():void | 保留；只追加 click 脉冲 |
| applyScale():void | 修改；先计算 hover 倍率，再叠加点击偏移，保持唯一写入点 |
| applyBrightness():void | 修改；以 isHoverVisualActive 统一资格；非 hover 为0 |
| resetFeedback():void | 新增 private；hovered=false、清点击脉冲、now=0、恢复基准缩放和亮度 |
| onDisable/onDestroy | 调 resetFeedback；onDestroy 先复原，再置空引用；校验节点有效性 |
| update(dt) | 仅负责点击脉冲的推进和到期清理；没有脉冲时无需每帧重写缩放 |

参考代码（局部改造，不是可直接替换的完整类）：

```ts
private isHoverVisualActive(): boolean {
    return this.hovered && this.enabledForInteraction;
}

public setHovered(hovered: boolean): void {
    if (this.hovered === hovered) return;
    this.hovered = hovered;
    this.applyScale();       // 回调中直接写，不等待下一次 update
    this.applyBrightness();
}

public setInteractionEnabled(enabled: boolean): void {
    if (this.enabledForInteraction === enabled) return;
    this.enabledForInteraction = enabled;
    this.applyScale();
    this.applyBrightness();
}

private applyScale(): void {
    const root = this.visualRoot;
    if (!root?.isValid) return;

    const hover = this.isHoverVisualActive()
        ? this.preset.hoverScaleMultiplier : 1;
    let clickX = 0, clickY = 0;
    for (const pulse of this.pulses) {
        const sample = sampleInteractionPulse(pulse, this.now);
        clickX += sample.x;
        clickY += sample.y;
    }
    root.setScale(
        this.baseScale.x * hover * (1 + clampInteractionScaleDelta(clickX)),
        this.baseScale.y * hover * (1 + clampInteractionScaleDelta(clickY)),
        this.baseScale.z,
    );
}

private resetFeedback(): void {
    this.hovered = false;
    this.pulses.length = 0;
    this.now = 0;
    this.applyScale();
    this.applyBrightness();
}
```

注意：
- 从 baseScale 算105%，不是从当前 scale 再乘1.05。原本2倍的对象目标为2.1，退出为2。
- 本轮保留旧的 enabledForInteraction 资格：不足资源的蓝图不新增高亮，但仍可由原系统显示提示。不能趁此将“不可购买”和“不可查看”合并。
- 临时禁用再启用时，hovered 由控制器维持；组件停用/销毁则清状态。
- 点击可能使总体比例暂时超过105%，这不代表 hover 倍率错误。

### 3.3 assets/scripts/feedback/interaction/InteractionFeedbackMath.ts

保留 sampleInteractionPulse 和 clampInteractionScaleDelta，供点击使用；不删除整个数学模块。
更新文件职责描述，说明这里不再负责 hover 动画。全仓搜索 preset.hover，确保不存在旧脉冲入口。

### 3.4 assets/scripts/ui/hover/HoverInfoController.ts

保持唯一 hover 判定来源，不让每个 FeedbackView 自己对鼠标再做一套命中检测。

新增 public isHovered(anchor:Node):boolean，供调试核对，按以下条件返回：
- 未 suspended；
- hovered?.anchor===anchor；
- 对应 source 仍 isSourceActive。

“检查到不是 hover 就复原”通过 changeHovered 的 false 回调实现。lateUpdate 原本就会解析最终状态；保持这个过程。unregister、suspend、clearHover 必须通过 changeHovered(null) 发出旧目标的 false。

新增 private validateUiCandidate():void，在 resolveHoveredTarget 使用 uiCandidate 前执行：
1. 候选节点已失效/停用则清 uiCandidate。
2. hasPointer 为 true 时，以统一的屏幕坐标执行该 anchor 的 UITransform.hitTest(pointer,windowId)；不命中则清候选。
3. 继续原 resolve 流程，令 changeHovered 通知旧目标退出或切换世界目标。
4. 这是漏 leave 的兜底，只纠正当前候选，不遍历补发所有 UI enter；保留 UI 优先规则。

坐标必须一并统一：现有 onMouseMove 使用 getLocation，而 notifyUiEnter 使用 getUILocation；新的兜底 hitTest 不能混用。新增 private updatePointer(event:EventMouse):void，两处均调用 event.getLocation(this.pointer)，并保存 windowId/hasPointer，和当前 World hitTest 的屏幕坐标约定保持一致。验收浏览器缩放、Canvas适配和相机移动。

本轮仍保留 World 在 lateUpdate 判定的时序，用于与新表现对照。若运行日志证实漏掉中间目标，后续单独改为每个输入事件解析，不把两个改动混在一起得出结论。

### 3.5 assets/scripts/ui/hover/HoverInfoTarget.ts

现有注册、UI enter/leave 绑定保持不变：
- 不给 World 偷加第二套 enter/leave；
- 不在这里启动 Tween；
- onDisable/unregister 仍通知控制器退出。

### 3.6 assets/scripts/feedback/interaction/InteractionBrightnessView.ts

继续使用 setBrightnessGain(value)，退出传0。亮度写入应与缩放处在同一次反馈回调。

本轮不复用 HitFlashView，不添加强闪白。已有材质缺失时会直接不提亮；开发模式输出一次明确告警或在装配验收中报告缺失，不能声称已通过提亮验收。

### 3.7 三类接入脚本及主基地

| 脚本 | 核对内容 |
|---|---|
| assets/scripts/building/BuildingRenderer.ts | 保留 onHoverChanged → feedback.setHovered；固定节点命中，FeedbackRoot缩放；不改变占地/导航 |
| assets/scripts/building/BuildingBlueprintCardView.ts | 保留绑定与 setInteractionEnabled(affordable)；购买/拖拽规则不变；不因刷新价格重新捕获被放大的 baseScale |
| assets/scripts/ui/squad/SquadRosterItemView.ts | 保留绑定；人数/血量更新不重建反馈组件；卡片停用恢复 |
| assets/scripts/world/WorldObjectRenderer.ts | 核对已接入反馈的主基地走同样逻辑，保留可下潜资格，不给其他 world object 新加表现 |

命中节点、布局占位、兄弟排序均不放大。只放大 visualRoot，避免相邻物体命中范围变化。不要为突出 hover 将节点移到新的 siblingIndex，以免改变地图渲染和输入优先级。

## 4. 排查“启动延迟”的观测办法

开发模式启用可关闭的内存环形日志；默认关闭。高频路径不直接 console.log，以免日志本身降低帧率。只保留最近256条，手动导出。

记录三类事件，同一运行使用相同时间源（如 performance.now）并记 director.getTotalFrames()：
- input：onMouseMove 的屏幕坐标、时间与帧号；
- hover-change：changeHovered 的旧/新目标ID、时间与帧号；
- visual-apply：setHovered 写入后的实际 root.scale、brightnessGain、时间与帧号。

调试函数可放当前模块的开发开关分支，不必新增全局调试服务。gain 记录传入值，不能冒充截图验证到的实际像素亮度。

| 观测 | 能得出的结论 |
|---|---|
| 有输入位置落在建筑内，但没有 hover-change | 优先查每帧采样/优先级/门禁；不能归因于动画 |
| hover-change 与 visual-apply 同回调，且立即105% | 动画通道无启动等待；实际屏幕最多等后续绘制 |
| 进入后同一帧又退出，最终100% | 可能未被渲染为可见hover；符合本轮状态表现，不增加最短保留时长 |
| 有105%和gain，但看不到提亮 | 检查材质、Sprite列表、遮挡和渲染，不先改检测 |
| 输入采样从A直接到C，中间无B样本 | 本方案不能保证B反馈；需要独立讨论轨迹补样 |

先以只 hover、不点击、60FPS稳定场景观察，再做30FPS与快速划过测试。对比旧版时使用相同地图、缩放和建筑排列，不根据体感直接宣布根因已修复。

## 5. 实施顺序

1. 改 Config 与 View，移除 hover 脉冲并统一即时缩放/亮度。
2. 接 resetFeedback 生命周期与重复 setup 恢复。
3. 控制器统一 pointer 坐标，加入候选失效/离开命中的退出兜底。
4. 检查三类目标和主基地装配，保留点击脉冲。
5. 加临时观测记录，进行对比验收，提交结果区分代码审查与Creator实测。

本方案覆盖旧文档的 hover 震荡条款，其他条款不自动废弃；不移动整个旧文档，以免连带删除仍适用的点击、提亮与输入约定。
如实现需要新建TS，遵循AGENTS.md的三段文件头；本方案本身不新增运行脚本。

## 6. 验收表

| 场景 | 预期 |
|---|---|
| 进入单个建筑并停留2秒 | 同回调写105%，持续保持；提亮保持，不弹动 |
| 离开 | 同回调恢复100%与gain=0，无回弹尾巴 |
| 原始scale为2 | 进入2.1，退出2，重复100次不漂移 |
| A→B→C | 判定到的目标分别进入/退出；无旧目标持续放大 |
| 不足资源的蓝图 | 沿用不可交互反馈资格；提示框仍按原逻辑工作 |
| hover中资源变化导致资格关闭 | 缩放、亮度一起恢复，不出现大图但不亮 |
| hover中点击 | 105%基准上播放点击脉冲；hover退出后点击可继续 |
| 组件停用/切层/面板暂停 | 无残留放大、亮度或旧引用 |
| 重复setup/卡片复用 | 不把105%记录为新baseScale |
| UI漏leave且指针已移出 | lateUpdate候选校验清除并恢复，不长期粘住 |
| 缩放Canvas/移动相机 | 命中位置与图像对应，根命中区域不随反馈改变 |
| 同帧进入退出/极快扫过 | 最终显示正常态；不为追求“都闪一下”延长hover |
| 点击脉冲全部结束 | 精确恢复当前hover所决定的100%或105% |

运行报告必须说明材质是否加载、测试帧率、是否实际收到enter/hover-change。没有Creator预览时只报告静态审查通过，不报告体验已验证。
