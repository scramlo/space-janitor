import { createApp } from './app/createApp.ts';
import { preloadBackupBeep } from './audio/backupBeep.ts';
import { preloadBgMusic } from './audio/bgMusic.ts';
import { preloadCollectBlip } from './audio/blip.ts';
import { preloadTruckEngine } from './audio/truckEngine.ts';
import { Game } from './game/Game.ts';
import { garbageTruckTuning } from './player/garbageTruckTuning.ts';
import { foodDebrisCatalog } from './world/foodDebrisTuning.ts';
import { loadContainer } from './world/loadContainer.ts';
import { emptyWorldTextures, loadRockWallTextures, loadShipTextures } from './world/textures.ts';
import './style.css';
import './styles/overlay.css';

const canvas = document.getElementById('application-canvas');
const uiHost = document.getElementById('ui-root');
if (!(canvas instanceof HTMLCanvasElement) || !uiHost) {
    throw new Error('Missing application canvas or UI root.');
}

const { app } = await createApp(canvas);

try {
    const foodLoads = foodDebrisCatalog.map(async (item) => {
        const asset = await loadContainer(app, item.url);
        return [item.id, asset] as const;
    });
    const [rockWall, shipMaps, truck, foodSettled] = await Promise.all([
        loadRockWallTextures(app),
        loadShipTextures(app),
        loadContainer(app, garbageTruckTuning.url),
        Promise.allSettled(foodLoads)
    ]);

    const foodEntries: Array<readonly [string, Awaited<ReturnType<typeof loadContainer>>]> = [];
    for (const result of foodSettled) {
        if (result.status === 'fulfilled') {
            foodEntries.push(result.value);
        } else {
            console.warn('Food model failed to load', result.reason);
        }
    }

    const game = new Game(app, uiHost, emptyWorldTextures());
    game.setTextures({ rockWall, ...shipMaps });
    game.setTruckModel(truck);
    game.setFoodAssets(new Map(foodEntries));
    preloadTruckEngine();
    preloadBgMusic();
    preloadBackupBeep();
    preloadCollectBlip();

    app.on('update', (dt: number) => game.update(dt));
    app.on('destroy', () => game.destroy());
} catch (error) {
    console.error('World assets failed to load', error);
}
