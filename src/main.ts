import { createApp } from './app/createApp.ts';
import { Game } from './game/Game.ts';
import { loadRockWallTextures } from './world/textures.ts';
import type { PbrMaps } from './world/textures.ts';
import './style.css';
import './styles/overlay.css';

const canvas = document.getElementById('application-canvas');
const uiHost = document.getElementById('ui-root');
if (!(canvas instanceof HTMLCanvasElement) || !uiHost) {
    throw new Error('Missing application canvas or UI root.');
}

const { app } = await createApp(canvas);
const game = new Game(app, uiHost, { rockWall: null });

app.on('update', (dt: number) => game.update(dt));
app.on('destroy', () => game.destroy());

try {
    const rockWall: PbrMaps = await loadRockWallTextures(app);
    game.setTextures({ rockWall });
} catch (error) {
    console.error('Rock wall textures failed to load', error);
}
