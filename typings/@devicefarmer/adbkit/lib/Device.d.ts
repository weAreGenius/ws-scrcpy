
/**
 * 设备接口
 */
export interface Device {
    /** 设备id */
    id: string;
    /** 设备类型 */
    type: 'emulator' | 'device' | 'offline';
}
