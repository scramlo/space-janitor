import { createApp } from './app/createApp.ts';
import { preloadTruckEngine } from './audio/truckEngine.ts';
import { Game } from './game/Game.ts';
import { garbageTruckTuning } from './player/garbageTruckTuning.ts';
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
const game = new Game(app, uiHost, emptyWorldTextures());

app.on('update', (dt: number) => game.update(dt));
app.on('destroy', () => game.destroy());

try {
    const [rockWall, shipMaps, truck] = await Promise.all([
        loadRockWallTextures(app),
        loadShipTextures(app),
        loadContainer(app, garbageTruckTuning.url)
    ]);
    game.setTextures({ rockWall, ...shipMaps });
    game.setTruckModel(truck);
    preloadTruckEngine();
} catch (error) {
    console.error('World assets failed to load', error);
}
