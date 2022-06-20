
/**
 * 服务接口
 */
export interface Service {
    /**获取服务的名称 */
    getName(): string;
    /**启动服务 */
    start(): Promise<void>;
    /**释放服务 */
    release(): void;
}

/**
 * 服务类接口
 */
export interface ServiceClass {
    /**获取服务实例 */
    getInstance(): Service;
    /**是否有实例 */
    hasInstance(): boolean;
}
