# TowerDown 建筑状态与 A/B 帧动画方案 V1

基线：origin/main `894813a`（town center drill）。本文件是待实施方案；本次不修改运行时代码。

## 1. 目标与实际资源

城镇中心未就绪时静态显示 towncenter0；就绪时 towncenter1/2 循环。今后其他正式建筑通过同一播放器和资源配置接入，不为每种建筑编写计时逻辑。

| 状态/帧 | 文件（assets/art/buildings/） | SpriteFrame UUID |
| --- | --- | --- |
| idle | towncenter0.png | 89b116e7-6b29-4acd-b553-625ac46f5e4a@f9941 |
| ready A | towncenter1.png | a5e06615-45ef-414d-9a35-32431801e4a9@f9941 |
| ready B | towncenter2.png | 31f95c6c-4025-4d6e-bcdb-9f1be9f4421e@f9941 |

实际图片均为 128×128，meta 当前 rect=128×128、offset=0。默认每帧 0.4 秒，即 A→B→A 一个周期 0.8 秒，保留配置口。直接换 SpriteFrame，不做渐变、整栋亮度脉冲或缩放。

## 2. 已有代码与职责调整

- MainMapController.bootstrap() 当前仅通过 resolveSpriteFrame() 加载 0/1，提供 Inspector 属性 townCenterIdleFrame、townCenterReadyFrame。
- BaseInteractionController.setup()/onCounterChanged() 持有 idleFrame/readyFrame，调用 setBaseSpriteFrame。EnemyKillCounter.subscribe() 会立即推送快照，并在后续每次有效击杀时通知。
- WorldObjectRenderer.setBaseSpriteFrame() 找到 base_main/FeedbackRoot/SpriteVisual，仅修改现有 Sprite。
- BuildingVisualLibrary.loadAll()/getFrame() 提供四种普通建筑的单张图。
- BuildingSpriteFrameFactory.getFrame() 同时服务建造卡、预览幽灵、正式建筑，保留这个静态接口。
- BuildingRenderer.create() 创建正式建筑 Sprite 和 InteractionFeedbackView。

调整为：资源库拥有帧配置；业务控制器决定状态；通用播放器拥有时钟和帧索引；渲染器把播放器挂在正确 Sprite 上。每个 Sprite 只能有一个运行时切帧入口。

## 3. 文件范围

新增一个运行时脚本 `assets/scripts/building/BuildingFrameAnimation.ts` 及 Creator 生成的 meta。其余扩展现有 BuildingVisualLibrary.ts、BuildingSpriteFrameFactory.ts、BuildingRenderer.ts、WorldObjectRenderer.ts、BaseInteractionController.ts、MainMapController.ts。三张图片不重命名、不复制。

新增脚本必须遵守 AGENTS.md 的 Why this file exists / Ownership boundary / This file deliberately does NOT 文件头。它只负责播放，不依赖击杀计数、建筑生产、下潜或面板。

## 4. 新增 BuildingFrameAnimation.ts

导出类型：

```ts
export interface BuildingFrameClip {
    readonly frames: readonly SpriteFrame[];
    readonly frameSeconds: number;
}
export interface BuildingAnimationSet {
    readonly defaultState: string;
    readonly clips: Readonly<Record<string, BuildingFrameClip>>;
}
```

播放器为继承 Component 的 @ccclass('BuildingFrameAnimation')，挂在 SpriteVisual 节点。字段：target、animations、currentState、currentClip、elapsed、frameIndex。每个实例独立保存播放状态，多个实例只共享只读 SpriteFrame 资源。

### 4.1 setup(target: Sprite, animations: BuildingAnimationSet): void

允许重新 setup，先清掉旧播放状态；校验默认状态存在、所有 clip 非空、frameSeconds 有限且大于 0。绑定 target 后强制选择默认状态并立即应用第 0 帧。不能等第一次 update 才显示。

保持 Sprite.SizeMode.CUSTOM；不修改 UITransform、节点坐标、缩放、锚点、颜色、材质。

### 4.2 setState(state: string, restart = false): void

同一状态且 restart=false 时直接 return，这是防止多次击杀重置动画的关键。切换有效状态时 elapsed=0、frameIndex=0，立即显示首帧。

未知状态警告一次并回退默认状态；如果默认状态已经在播，不重复重启。非法配置在 setup 时就应被拦截。

### 4.3 update(dt: number): void

单帧 clip 不需要持续写 Sprite；多帧按累计时间取索引，避免每帧只加 1 的低帧率错误：

```ts
if (!this.currentClip || !this.target) return;
const clip = this.currentClip;
if (clip.frames.length <= 1 || !Number.isFinite(dt) || dt <= 0) return;
const duration = clip.frameSeconds * clip.frames.length;
this.elapsed = (this.elapsed + dt) % duration;
const next = Math.floor(this.elapsed / clip.frameSeconds);
if (next !== this.frameIndex) {
    this.frameIndex = next;
    this.applyFrame(next);
}
```

applyFrame(index) 只赋值 target.spriteFrame。无 setInterval、无异步资源加载、无每次 update 新建 SpriteFrame。大 dt 只显示最终应处的帧，不补播中间所有帧。

### 4.4 生命周期

节点失活时利用 Component.update 停止推进；恢复激活保留相位。切换业务状态时才重置。onDestroy 清空本组件引用，不 destroy 共享帧、纹理或其他实例资源。

全局暂停若停止游戏更新自然停止；本方案不新增暂停系统。拖动建筑时不重建播放器、不重启相位。

## 5. BuildingVisualLibrary.ts：将单图配置扩展成状态配置

在现有文件中增加可配置资源表，类型包含 defaultState、各状态 frameUuids/frameSeconds；不要从文件名自动猜测状态。

用独立 visualKey `towncenter` 标识基地，不假装它是普通建筑 definitionId。普通建筑仍用 storage_house_01 等原 id。

基地配置示例：

```ts
towncenter: {
    defaultState: 'idle',
    clips: {
        idle: { frameUuids: [/* towncenter0 UUID */], frameSeconds: 0.4 },
        ready: { frameUuids: [/* towncenter1 UUID */, /* towncenter2 UUID */],
                 frameSeconds: 0.4 },
    },
},
```

实施时填第 1 节完整 UUID。四个现有建筑迁移成单帧 idle 配置，保持 UUID 原样。未来普通建筑如有 AB 图，只需将 idle 配成 [A,B]；具有工作/停用等状态时再增 working/disabled clip，由对应业务通知。

### 5.1 loadAll()

按 UUID 去重加载；同一资源只发出一次加载请求。先加载后形成可播放的 BuildingAnimationSet，不能在 setState 时加载。

缺帧规则：
- 基地 idle 为必需资源，缺失抛明确错误，不能只返回空图。
- 基地 ready A 存在、B 缺失：降级为 A 静态；只有 B 时使用 B 静态；两张都缺失回退 idle，并警告。视觉降级不影响可下潜状态。
- 普通建筑默认帧都缺失时，保持原 factory atlas fallback。
- 保存成功加载帧的原顺序；不向播放器传 null 或空数组。

校验同一套建筑帧的 originalSize、rect 尺寸、offset 一致。基地要求原生 128×128。尺寸不一致的 ready clip 降级为其第一张有效的 128×128 帧并警告，不能通过缩放掩盖跳动。颜色和轮廓差异仍须人工预览，程序尺寸校验无法证明内容对齐。

### 5.2 getAnimationSet(visualKey): BuildingAnimationSet | null

返回已加载的只读配置。同一实例的 elapsed/index 不得写入这个共享对象。

### 5.3 getFrame(definitionId): SpriteFrame | null

保持旧调用签名，返回默认状态首帧，保证建造卡和幽灵仍显示静态图。不让 UI/预览自动创建动画。

## 6. BuildingSpriteFrameFactory.ts / BuildingRenderer.ts

Factory 新增 getAnimationSet(definitionId)，仅代理 visualLibrary.getAnimationSet()；原 getFrame(definition) 与旧 atlas fallback 不变。

BuildingRenderer.create()：
1. 沿用原 Sprite 创建、大小设置、factory.getFrame()。
2. 取 factory.getAnimationSet(definition.id)。
3. 存在动画配置则给 SpriteVisual 添加 BuildingFrameAnimation 并 setup；缺失则保持静态 atlas 图。
4. 原 InteractionFeedbackView 继续使用同一个 sprite，层级和位置完全不动。

每个正式建筑一个播放器，不给卡片/幽灵添加。后续业务可通过现有建筑节点中的 SpriteVisual.getComponent(BuildingFrameAnimation).setState() 切换状态；本轮不添加任何不存在的生产状态逻辑，也不改建筑数值。

## 7. WorldObjectRenderer.ts：基地使用同一个播放器

新增 setupBaseAnimation(animations: BuildingAnimationSet): void：
- 从 nodeByObjectId.get('base_main') 找 FeedbackRoot/SpriteVisual/Sprite。
- getComponent 或 addComponent(BuildingFrameAnimation)，调用 setup。
- 未找到 Sprite 明确警告；必须在 WorldObjectRenderer 完成基地创建后调用。

新增 setBaseVisualState(state: 'idle' | 'ready'): void：
- 获取该节点已有播放器并 setState(state)。
- 不重新 setup，不重复添加 Component。

移除 setBaseSpriteFrame() 及全仓对它的旧调用，避免交互控制器与播放器同时写同一个 Sprite。基地初始创建过程可暂设原图，bootstrap 中应在同一段同步初始化中完成动画绑定，不能先订阅状态、后异步绑定播放器。

## 8. BaseInteractionController.ts：业务只发状态

删除 SpriteFrame import、idleFrame/readyFrame 字段与 baseSpriteFrameSetter。

setup(config) 删除三个旧配置项，新增：
```ts
setBaseVisualState: (state: 'idle' | 'ready') => void;
```

保存回调，先解除旧 unsubscribe（防重复 setup），再订阅 counter。subscribe 会立即发送当前快照，所以不必额外硬写 idle；这样从已就绪状态初始化也正确。

onCounterChanged(snapshot)：
- 保存 ready=snapshot.ready。
- 调用 setter(ready ? 'ready' : 'idle')；播放器同状态不重启。
- 若已打开面板且变为未就绪，调用 close()，释放原有输入阻断；首次进入未就绪不受影响。
- 面板点击资格仍只使用 counter.ready，不能用当前显示图片判断。

open()/close() 不改变播放状态：就绪时打开或关闭面板都继续 AB。destroy() 解除订阅、清理状态回调，保留原面板销毁逻辑，不释放渲染器中的共享帧。

## 9. MainMapController.ts：统一初始化与调用链

bootstrap() 已经加载 BuildingVisualLibrary。删除仅供基地使用的两次 resolveSpriteFrame() 和 townCenterIdleFrame/townCenterReadyFrame Inspector 字段；删除同名 setBaseSpriteFrame() 转发方法。

不要删除仍被其他资源使用的 resolveSpriteFrame() 通用方法；先全仓核对引用。清理场景/预制体中确实存在的旧 Inspector 序列化字段，不凭猜测重写场景。这个迁移意味着基地素材配置统一由资源表决定，避免 Inspector 旧图覆盖新文件。

在世界对象完成渲染、base_main 节点已存在之后：
```ts
const baseAnimation = buildingVisualLibrary.getAnimationSet('towncenter');
if (!baseAnimation) throw new Error('Towncenter animation assets missing.');
this.worldObjectRenderer.setupBaseAnimation(baseAnimation);
```

以上步骤必须在 baseInteraction.setup() 之前。将其配置改为：
```ts
setBaseVisualState: state => this.worldObjectRenderer?.setBaseVisualState(state),
```
保留 panel、onOpenStateChanged 及所有输入阻断回调。

下潜流程继续由 EnemyKillCounter.beginFloor() 发布 ready=false，自动切回 towncenter0；不在 FloorTransitionController 再加第二套停动画逻辑。若换层失败未重置计数，应保留就绪动画，不能提前把图换成 idle。

## 10. 图片导入与交互兼容

三张图统一最近邻采样、完整 128×128 rect、中心 pivot、offset=0；在 Creator 中关闭自动裁边以固定后续替换行为，保留原 UUID。不要靠调每帧节点位置纠正原图未对齐。

播放器只改 spriteFrame；hover/click 的缩放继续由 FeedbackRoot 承担，提亮由原 InteractionFeedbackView 管理。同一个 Sprite 和材质实例保持不变，禁止切帧时重置 customMaterial、color 或 hover 状态。

动画不是碰撞或寻路变化：基地占地仍为 4×4，普通建筑按原 footprint。销毁建筑应随节点销毁播放器，没有全局定时器遗留。

## 11. 验收与必要测试

1. 新层初始 towncenter0；达标瞬间显示 towncenter1，0.4s 后 towncenter2，再 0.4s 回到 1。
2. 已就绪后继续击杀，不重置到 A；打开/关闭面板不重启；成功下潜后立即显示 0。
3. 使用不同 dt（含跨过多个周期）结果正确；重复 setState('ready') 保持 elapsed；真正切回 idle 后再 ready 从 A 开始。
4. hover 期间换 A/B，尺寸和提亮不丢；退出 hover 正常复原；点击反馈正常。
5. 缺 B 时显示 A 静态仍能打开下潜面板；缺全部 ready 帧回退 idle，但 ready 业务仍为 true。
6. 同配置的两个普通建筑动画时钟互不影响；拖动不重启，拆除后不再更新。
7. 建造卡与幽灵仍显示默认首帧；现有无 AB 图的建筑保持静态。
8. 检查三帧地面/轮廓是否跳动，不能把素材内容错位误认为播放器时间问题。
9. 全仓清理基地旧 setBaseSpriteFrame/readyFrame 字段引用，TypeScript 检查通过；播放器测试覆盖状态切换、同状态幂等、大 dt、单帧、生命周期。Creator 实机确认材质兼容。

交付应包含通用播放器、基地配置和普通建筑接入接口；不提前制作普通建筑的新帧，不添加额外生产或经济规则。
