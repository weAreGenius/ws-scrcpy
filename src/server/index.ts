import '../../LICENSE';
import * as readline from 'readline';
import { Config } from './Config';
import { HttpServer } from './services/HttpServer';
import { WebSocketServer } from './services/WebSocketServer';
import { Service, ServiceClass } from './services/Service';
import { MwFactory } from './mw/Mw';
import { WebsocketProxy } from './mw/WebsocketProxy';
import { HostTracker } from './mw/HostTracker';
import { WebsocketMultiplexer } from './mw/WebsocketMultiplexer';
/**需要启用的服务, 如HttpServer, WebSocketServer,ControlCenter*/
const servicesToStart: ServiceClass[] = [HttpServer, WebSocketServer];

// MWs that accept WebSocket
/***包含RemoteDevtools,WebsocketProxyOverAdb */
const mwList: MwFactory[] = [WebsocketProxy, WebsocketMultiplexer];

// MWs that accept Multiplexer
/** 双向ws链接? 包含DeviceTracker,RemoteShell,FileListing **/
const mw2List: MwFactory[] = [HostTracker];
/**正在运行的服务*/
const runningServices: Service[] = [];
//模块加载完成回调
const loadPlatformModulesPromises: Promise<void>[] = [];

//获取配置
const config = Config.getInstance();

//读取谷歌的模块
/// #if INCLUDE_GOOG
async function loadGoogModules() {
    //控制中心
    const { ControlCenter } = await import('./goog-device/services/ControlCenter');
    //设备追踪器
    const { DeviceTracker } = await import('./goog-device/mw/DeviceTracker');
    //ws
    const { WebsocketProxyOverAdb } = await import('./goog-device/mw/WebsocketProxyOverAdb');

    //如果启用了谷歌设备追踪器,就添加到mw中
    if (config.getRunLocalGoogTracker()) {
        mw2List.push(DeviceTracker);
    }

    //这个不知道是干什么用的
    if (config.getAnnounceLocalGoogTracker()) {
        HostTracker.registerLocalTracker(DeviceTracker);
    }

    servicesToStart.push(ControlCenter);

    //如果开启了shell
    /// #if INCLUDE_ADB_SHELL
    const { RemoteShell } = await import('./goog-device/mw/RemoteShell');
    mw2List.push(RemoteShell);
    /// #endif

    //如果开启了调试工具
    /// #if INCLUDE_DEV_TOOLS
    const { RemoteDevtools } = await import('./goog-device/mw/RemoteDevtools');
    mwList.push(RemoteDevtools);
    /// #endif

    //如果开启了文件管理
    /// #if INCLUDE_FILE_LISTING
    const { FileListing } = await import('./goog-device/mw/FileListing');
    mw2List.push(FileListing);
    /// #endif

    mwList.push(WebsocketProxyOverAdb);
}
loadPlatformModulesPromises.push(loadGoogModules());
/// #endif

//如果开启了苹果设备,就会执行下面的代码
/// #if INCLUDE_APPL
async function loadApplModules() {
    const { ControlCenter } = await import('./appl-device/services/ControlCenter');
    const { DeviceTracker } = await import('./appl-device/mw/DeviceTracker');
    const { WebDriverAgentProxy } = await import('./appl-device/mw/WebDriverAgentProxy');

    // Hack to reduce log-level of appium libs
    const npmlog = await import('npmlog');
    npmlog.level = 'warn';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any)._global_npmlog = npmlog;

    if (config.getRunLocalApplTracker()) {
        mw2List.push(DeviceTracker);
    }

    if (config.getAnnounceLocalApplTracker()) {
        HostTracker.registerLocalTracker(DeviceTracker);
    }

    servicesToStart.push(ControlCenter);

    /// #if USE_QVH_SERVER
    const { QVHStreamProxy } = await import('./appl-device/mw/QVHStreamProxy');
    mw2List.push(QVHStreamProxy);
    /// #endif
    mw2List.push(WebDriverAgentProxy);
}
loadPlatformModulesPromises.push(loadApplModules());
/// #endif


//google或者apple模块加载完成的回调
Promise.all(loadPlatformModulesPromises)
    .then(() => {
        
        //启动服务,比如ControlCenter
        return servicesToStart.map((serviceClass: ServiceClass) => {
            const service = serviceClass.getInstance();
            runningServices.push(service);
            return service.start();
        });
    })
    .then(() => {
        
        //启用websocket
        const wsService = WebSocketServer.getInstance();
        
        //
        mwList.forEach((mwFactory: MwFactory) => {
            wsService.registerMw(mwFactory);
        });

        mw2List.forEach((mwFactory: MwFactory) => {
            WebsocketMultiplexer.registerMw(mwFactory);
        });

        if (process.platform === 'win32') {
            readline
                .createInterface({
                    input: process.stdin,
                    output: process.stdout,
                })
                .on('SIGINT', exit);
        }

        process.on('SIGINT', exit);
        process.on('SIGTERM', exit);
    })
    .catch((error) => {
        console.error(error.message);
        exit('1');
    });

let interrupted = false;
function exit(signal: string) {
    console.log(`\nReceived signal ${signal}`);
    if (interrupted) {
        console.log('Force exit');
        process.exit(0);
        return;
    }
    interrupted = true;
    runningServices.forEach((service: Service) => {
        const serviceName = service.getName();
        console.log(`Stopping ${serviceName} ...`);
        service.release();
    });
}
