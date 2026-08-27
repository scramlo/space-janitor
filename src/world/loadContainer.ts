import type { AppBase, Asset, ContainerResource } from 'playcanvas';

export function loadContainer(app: AppBase, url: string): Promise<Asset> {
    return new Promise((resolve, reject) => {
        app.assets.loadFromUrl(url, 'container', (err, asset) => {
            if (err || !asset) {
                reject(err ?? new Error(`Failed to load container ${url}`));
                return;
            }
            resolve(asset);
        });
    });
}

export function containerResource(asset: Asset): ContainerResource {
    return asset.resource as ContainerResource;
}
