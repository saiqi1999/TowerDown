import {
    _decorator,
    Component,
    director,
    Node,
} from 'cc';

const { ccclass, property } = _decorator;

@ccclass('RuntimeNodeTreeLogger')
export class RuntimeNodeTreeLogger extends Component {
    @property
    public intervalSeconds = 20;

    @property
    public collapseLargeBranches = true;

    @property
    public collapseThreshold = 100;

    protected onEnable(): void {
        // 历史上我们排查过“节点明明应该存在，但运行时层级里看不到”的问题，
        // 所以开发态默认启动后先打一份快照，避免还没等到 20 秒就错过初始化现场。
        this.printRuntimeTree();
        this.schedule(
            this.printRuntimeTree,
            this.intervalSeconds,
        );
    }

    protected onDisable(): void {
        this.unschedule(this.printRuntimeTree);
    }

    private readonly printRuntimeTree = (): void => {
        const scene = director.getScene();

        if (!scene) {
            console.warn('[RuntimeNodeTree] scene is null.');
            return;
        }

        const lines: string[] = [];
        lines.push('[RuntimeNodeTree]');
        lines.push(
            `===== Runtime Node Tree @ ${new Date().toLocaleTimeString()} =====`,
        );

        this.appendNode(scene, 0, lines);

        lines.push('===== End Runtime Node Tree =====');

        // 节点树如果逐行 console.log，会把一轮快照拆成几十上百条 entry，
        // 之前分析动态节点是否丢失时非常难对照，所以这里强制汇总为单条日志。
        console.log(lines.join('\n'));
    };

    private appendNode(
        node: Node,
        depth: number,
        lines: string[],
    ): void {
        const indent = '  '.repeat(depth);
        const activeState = node.activeInHierarchy ? 'ACTIVE' : 'INACTIVE';
        const collapse = this.collapseLargeBranches
            && node.children.length >= this.collapseThreshold;

        lines.push(
            `${indent}${node.name} ` +
            `[${activeState}] ` +
            `children=${node.children.length}` +
            (collapse ? ' [COLLAPSED]' : ''),
        );

        // TileRoot 这类大分支完整展开会把真正想看的 Squad / Warrior / Flag 淹没，
        // 所以默认折叠超大分支，把日志可读性优先保住。
        if (collapse) {
            return;
        }

        for (const child of node.children) {
            this.appendNode(child, depth + 1, lines);
        }
    }
}
