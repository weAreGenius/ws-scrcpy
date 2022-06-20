import { TrackerChangeSet } from '@devicefarmer/adbkit/lib/TrackerChangeSet';
import { Device } from '../Device';
import { Service } from '../../services/Service';
import AdbKitClient from '@devicefarmer/adbkit/lib/adb/client';
import { AdbExtended } from '../adb';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import Tracker from '@devicefarmer/adbkit/lib/adb/tracker';
import Timeout = NodeJS.Timeout;
import { BaseControlCenter } from '../../services/BaseControlCenter';
import { ControlCenterCommand } from '../../../common/ControlCenterCommand';
import * as os from 'os';
import * as crypto from 'crypto';
import { DeviceState } from '../../../common/DeviceState';

/**
 * 
 * ControlCenter
 * 
 * 控制中心实现类
 * 
 * 
 * 
 */
export class ControlCenter extends BaseControlCenter<GoogDeviceDescriptor> implements Service {
    private static readonly defaultWaitAfterError = 1000;
    private static instance?: ControlCenter;

    /**是否已经初始化 */
    private initialized = false;
    /** adbClient扩展类实例 */
    private client: AdbKitClient = AdbExtended.createClient();
    /** 追踪器 */
    private tracker?: Tracker;
    /**  */
    private waitAfterError = 1000;
    private restartTimeoutId?: Timeout;
    /** 设备map */
    private deviceMap: Map<string, Device> = new Map();
    /** 设备描述信息map */
    private descriptors: Map<string, GoogDeviceDescriptor> = new Map();
    /** 控制中心唯一编码 */
    private readonly id: string;

    protected constructor() {
        super();
        const idString = `goog|${os.hostname()}|${os.uptime()}`;
        this.id = crypto.createHash('md5').update(idString).digest('hex');
    }

    /**
     * 获取控制中心实例
     */
    public static getInstance(): ControlCenter {
        if (!this.instance) {
            this.instance = new ControlCenter();
        }
        return this.instance;
    }

    /**
     * 是否存在实例
     * @returns 
     */
    public static hasInstance(): boolean {
        return !!ControlCenter.instance;
    }

    /**
     * 重启追踪器
     * @returns 
     */
    private restartTracker = (): void => {
        if (this.restartTimeoutId) {
            return;
        }
        console.log(`Device tracker is down. Will try to restart in ${this.waitAfterError}ms`);
        this.restartTimeoutId = setTimeout(() => {
            this.stopTracker();
            this.waitAfterError *= 1.2;
            this.init();
        }, this.waitAfterError);
    };

    /**
     * 列表变化时，触发的事件
     * @param changes 
     */
    private onChangeSet = (changes: TrackerChangeSet): void => {
        this.waitAfterError = ControlCenter.defaultWaitAfterError;
        if (changes.added.length) {
            for (const item of changes.added) {
                const { id, type } = item;
                this.handleConnected(id, type);
            }
        }
        if (changes.removed.length) {
            for (const item of changes.removed) {
                const { id } = item;
                this.handleConnected(id, DeviceState.DISCONNECTED);
            }
        }
        if (changes.changed.length) {
            for (const item of changes.changed) {
                const { id, type } = item;
                this.handleConnected(id, type);
            }
        }
    };

    /**
     * 触发设备更新事件
     * @param device 设备
     */
    private onDeviceUpdate = (device: Device): void => {
        const { udid, descriptor } = device;
        this.descriptors.set(udid, descriptor);
        this.emit('device', descriptor);
    };

    /**
     * 连接后对设备状态的处理
     * @param udid 设备id
     * @param state 状态
     */
    private handleConnected(udid: string, state: string): void {
        let device = this.deviceMap.get(udid);
        if (device) {
            device.setState(state);
        } else {
            device = new Device(udid, state);
            device.on('update', this.onDeviceUpdate);
            this.deviceMap.set(udid, device);
        }
    }

    /**
     * 初始化控制中心
     * @returns 
     */
    public async init(): Promise<void> {
        if (this.initialized) {
            return;
        }
        this.tracker = await this.startTracker();
        const list = await this.client.listDevices();
        list.forEach((device) => {
            const { id, type } = device;
            this.handleConnected(id, type);
        });
        this.initialized = true;
    }

    /**
     * 开启设备追踪器
     * @returns 
     */
    private async startTracker(): Promise<Tracker> {
        if (this.tracker) {
            return this.tracker;
        }
        const tracker = await this.client.trackDevices();
        tracker.on('changeSet', this.onChangeSet);
        tracker.on('end', this.restartTracker);
        tracker.on('error', this.restartTracker);
        return tracker;
    }

    /**
     * 停用设备追踪器
     */
    private stopTracker(): void {
        if (this.tracker) {
            this.tracker.off('changeSet', this.onChangeSet);
            this.tracker.off('end', this.restartTracker);
            this.tracker.off('error', this.restartTracker);
            this.tracker.end();
            this.tracker = undefined;
        }
        this.tracker = undefined;
        this.initialized = false;
    }

    /**
     * 获取设备描述列表
     * @returns 
     */
    public getDevices(): GoogDeviceDescriptor[] {
        return Array.from(this.descriptors.values());
    }

    /**
     * 获取设备
     * @param udid 
     * @returns 
     */
    public getDevice(udid: string): Device | undefined {
        return this.deviceMap.get(udid);
    }

    /**
     * 获取控制中心id
     * @returns 
     */
    public getId(): string {
        return this.id;
    }

    /**
     * 获取控制中心名称
     * @returns 
     */
    public getName(): string {
        return `aDevice Tracker [${os.hostname()}]`;
    }

    /**
     * 开启控制中心
     * @returns 
     */
    public start(): Promise<void> {
        return this.init().catch((e) => {
            console.error(`Error: Failed to init "${this.getName()}". ${e.message}`);
        });
    }

    /**
     * 释放追踪器
     */
    public release(): void {
        this.stopTracker();
    }

    /**
     * 运行命令行命令
     * @param command 
     * @returns 
     */
    public async runCommand(command: ControlCenterCommand): Promise<void> {
        const udid = command.getUdid();
        const device = this.getDevice(udid);
        if (!device) {
            console.error(`Device with udid:"${udid}" not found`);
            return;
        }
        const type = command.getType();
        switch (type) {
            case ControlCenterCommand.KILL_SERVER:
                await device.killServer(command.getPid());
                return;
            case ControlCenterCommand.START_SERVER:
                await device.startServer();
                return;
            case ControlCenterCommand.UPDATE_INTERFACES:
                await device.updateInterfaces();
                return;
            default:
                throw new Error(`Unsupported command: "${type}"`);
        }
    }
}
