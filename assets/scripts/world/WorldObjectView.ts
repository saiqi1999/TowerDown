import { _decorator, Component } from 'cc';
import { ResourceType, WorldObjectKind } from './WorldObjectTypes';

const { ccclass } = _decorator;

@ccclass('WorldObjectView')
export class WorldObjectView extends Component {
    public objectId = '';
    public kind = WorldObjectKind.Resource;
    public gridX = 0;
    public gridY = 0;
    public gridW = 1;
    public gridH = 1;
    public resourceType: ResourceType | null = null;
}
