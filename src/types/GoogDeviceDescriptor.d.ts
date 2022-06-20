import { NetInterface } from './NetInterface';
import { BaseDeviceDescriptor } from './BaseDeviceDescriptor';

/**
 * GoogDeviceDescriptor接口
 * 
 * 安卓设备的一些描述信息
 * 
 * 
 */
export default interface GoogDeviceDescriptor extends BaseDeviceDescriptor {
    'ro.build.version.release': string;
    'ro.build.version.sdk': string;
    'ro.product.cpu.abi': string;
    'ro.product.manufacturer': string;
    'ro.product.model': string;
    'wifi.interface': string;
    interfaces: NetInterface[];
    pid: number;
    'last.update.timestamp': number;
}
