import { Color, StandardMaterial, Vec2 } from 'playcanvas';

import type { PbrMaps } from './textures.ts';

export function createLitMaterial(r: number, g: number, b: number, options?: { metalness?: number; gloss?: number; emissive?: number }): StandardMaterial {
    const material = new StandardMaterial();
    material.diffuse.set(r, g, b);
    material.useMetalness = true;
    material.metalness = options?.metalness ?? 0.15;
    material.gloss = options?.gloss ?? 0.35;
    material.useLighting = true;
    if (options?.emissive) {
        material.emissive = new Color(r, g, b);
        material.emissiveIntensity = options.emissive;
    }
    material.update();
    return material;
}

export function createUnlitMaterial(r: number, g: number, b: number, intensity = 1): StandardMaterial {
    const material = new StandardMaterial();
    material.useLighting = false;
    material.emissive = new Color(r, g, b);
    material.emissiveIntensity = intensity;
    material.diffuse.set(0, 0, 0);
    material.update();
    return material;
}

export function tilingForBox(sx: number, sy: number, sz: number, metersPerTile = 5): Vec2 {
    if (sy <= sx && sy <= sz) {
        return new Vec2(sx / metersPerTile, sz / metersPerTile);
    }
    if (sx <= sz) {
        return new Vec2(sz / metersPerTile, sy / metersPerTile);
    }
    return new Vec2(sx / metersPerTile, sy / metersPerTile);
}

export function createRockMaterial(maps: PbrMaps | null, tiling: Vec2, tint = { r: 1, g: 1, b: 1 }): StandardMaterial {
    return createPbrMaterial(maps, tiling, {
        tint,
        metalness: 0.04,
        gloss: maps ? 1 : 0.1
    });
}

export function createPbrMaterial(
    maps: PbrMaps | null,
    tiling: Vec2,
    options?: { tint?: { r: number; g: number; b: number }; metalness?: number; gloss?: number }
): StandardMaterial {
    const tint = options?.tint ?? { r: 1, g: 1, b: 1 };
    const material = createLitMaterial(tint.r, tint.g, tint.b, {
        metalness: options?.metalness ?? (maps?.metalness ? 1 : 0.15),
        gloss: options?.gloss ?? (maps ? 1 : 0.35)
    });
    if (!maps) {
        return material;
    }
    material.diffuseMap = maps.albedo;
    material.normalMap = maps.normal;
    material.glossMap = maps.roughness;
    material.glossInvert = true;
    if (maps.metalness) {
        material.metalnessMap = maps.metalness;
        material.metalnessMapTiling = tiling;
    }
    material.diffuseMapTiling = tiling;
    material.normalMapTiling = tiling;
    material.glossMapTiling = tiling;
    material.update();
    return material;
}
