import {
    AppBase,
    AppOptions,
    CameraComponentSystem,
    ContainerHandler,
    DEVICETYPE_WEBGL2,
    FILLMODE_FILL_WINDOW,
    Keyboard,
    KEY_ENTER,
    KEY_SPACE,
    LightComponentSystem,
    RenderComponentSystem,
    RESOLUTION_AUTO,
    TextureHandler,
    createGraphicsDevice
    
} from 'playcanvas';
import type { KeyboardEvent } from 'playcanvas';

export type CreatedApp = {
    app: AppBase;
    canvas: HTMLCanvasElement;
};

export async function createApp(canvas: HTMLCanvasElement): Promise<CreatedApp> {
    const device = await createGraphicsDevice(canvas, {
        deviceTypes: [DEVICETYPE_WEBGL2],
        antialias: true
    });
    device.maxPixelRatio = Math.min(window.devicePixelRatio, 2);

    const createOptions = new AppOptions();
    createOptions.graphicsDevice = device;
    createOptions.componentSystems = [RenderComponentSystem, CameraComponentSystem, LightComponentSystem];
    createOptions.resourceHandlers = [TextureHandler, ContainerHandler];

    const app = new AppBase(canvas);
    app.init(createOptions);
    app.keyboard = new Keyboard(window);

    app.start();
    app.setCanvasFillMode(FILLMODE_FILL_WINDOW);
    app.setCanvasResolution(RESOLUTION_AUTO);
    app.resizeCanvas();

    const onResize = () => app.resizeCanvas();
    window.addEventListener('resize', onResize);

    const onKeyDown = (event: KeyboardEvent) => {
        const native = event.event;
        if (!native) {
            return;
        }
        if (event.key === KEY_SPACE || event.key === KEY_ENTER) {
            native.preventDefault();
        }
        if (
            native.code === 'ArrowUp' ||
            native.code === 'ArrowDown' ||
            native.code === 'ArrowLeft' ||
            native.code === 'ArrowRight'
        ) {
            native.preventDefault();
        }
    };
    app.keyboard.on('keydown', onKeyDown);

    app.on('destroy', () => {
        window.removeEventListener('resize', onResize);
        app.keyboard?.off('keydown', onKeyDown);
    });

    return { app, canvas };
}
