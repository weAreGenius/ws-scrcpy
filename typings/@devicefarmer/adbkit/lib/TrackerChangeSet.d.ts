import { Device } from './Device';

/**
 * 追踪器变化事件接口
 */
export interface TrackerChangeSet {
    removed: Device[];
    changed: Device[];
    added: Device[];
}
