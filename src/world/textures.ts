import { ADDRESS_REPEAT, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR } from 'playcanvas';
import type { AppBase, Texture } from 'playcanvas';

export type PbrMaps = {
    albedo: Texture;
    normal: Texture;
    roughness: Texture;
    metalness?: Texture;
};

export type WorldTextures = {
    rockWall: PbrMaps | null;
    rustyMetal: PbrMaps | null;
    rustyMetalGrid: PbrMaps | null;
    polystyrene: PbrMaps | null;
    rubberTiles: PbrMaps | null;
};

export function emptyWorldTextures(): WorldTextures {
    return {
        rockWall: null,
        rustyMetal: null,
        rustyMetalGrid: null,
        polystyrene: null,
        rubberTiles: null
    };
}

export async function loadRockWallTextures(app: AppBase): Promise<PbrMaps> {
    return loadPbrMaps(app, '/textures/dark-rock/dark-rock');
}

export async function loadShipTextures(
    app: AppBase
): Promise<Pick<WorldTextures, 'rustyMetal' | 'rustyMetalGrid' | 'polystyrene' | 'rubberTiles'>> {
    const [rustyMetal, rustyMetalGrid, polystyrene, rubberTiles] = await Promise.all([
        loadPbrMaps(app, '/textures/rusty-metal/rusty-metal', true),
        loadPbrMaps(app, '/textures/rusty-metal-grid/rusty-metal-grid'),
        loadPbrMaps(app, '/textures/polystyrene/polystyrene'),
        loadPbrMaps(app, '/textures/rubber-tiles/rubber-tiles')
    ]);
    return { rustyMetal, rustyMetalGrid, polystyrene, rubberTiles };
}

async function loadPbrMaps(app: AppBase, base: string, withMetalness = false): Promise<PbrMaps> {
    const [albedo, normal, roughness, metalness] = await Promise.all([
        loadTexture(app, `${base}_albedo.jpg`, true),
        loadTexture(app, `${base}_normal.jpg`, false),
        loadTexture(app, `${base}_roughness.jpg`, false),
        withMetalness ? loadTexture(app, `${base}_metalness.jpg`, false) : Promise.resolve(undefined)
    ]);
    return metalness ? { albedo, normal, roughness, metalness } : { albedo, normal, roughness };
}

function loadTexture(app: AppBase, url: string, srgb: boolean): Promise<Texture> {
    return new Promise((resolve, reject) => {
        app.assets.loadFromUrl(url, 'texture', (err, asset) => {
            if (err || !asset) {
                reject(new Error(err ? String(err) : `Missing texture ${url}`));
                return;
            }
            const texture = asset.resource as Texture;
            texture.addressU = ADDRESS_REPEAT;
            texture.addressV = ADDRESS_REPEAT;
            texture.minFilter = FILTER_LINEAR_MIPMAP_LINEAR;
            texture.magFilter = FILTER_LINEAR;
            texture.anisotropy = 8;
            texture.srgb = srgb;
            resolve(texture);
        });
    });
}
