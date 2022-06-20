import { ControlCenterCommand } from '../../common/ControlCenterCommand';
import { TypedEmitter } from '../../common/TypedEmitter';

/**
 * 控制中心触发的事件
 */
export interface ControlCenterEvents<T> {
    device: T;
}

/**
 * BaseControlCenter抽象类
 * 
 * 控制中心的一些基础操作
 * 
 * 
 */
export abstract class BaseControlCenter<T> extends TypedEmitter<ControlCenterEvents<T>> {
    abstract getId(): string;
    abstract getName(): string;
    abstract getDevices(): T[];
    abstract runCommand(command: ControlCenterCommand): Promise<string | void>;
}
