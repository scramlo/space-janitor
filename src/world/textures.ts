import { ADDRESS_REPEAT, FILTER_LINEAR, FILTER_LINEAR_MIPMAP_LINEAR } from 'playcanvas';
import type { AppBase, Texture } from 'playcanvas';

export type PbrMaps = {
    albedo: Texture;
    normal: Texture;
    roughness: Texture;
};

export type WorldTextures = {
    rockWall: PbrMaps | null;
};

export async function loadRockWallTextures(app: AppBase): Promise<PbrMaps> {
    const [albedo, normal, roughness] = await Promise.all([
        loadTexture(app, '/textures/dark-rock/dark-rock_albedo.jpg', true),
        loadTexture(app, '/textures/dark-rock/dark-rock_normal.jpg', false),
        loadTexture(app, '/textures/dark-rock/dark-rock_roughness.jpg', false)
    ]);
    return { albedo, normal, roughness };
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
