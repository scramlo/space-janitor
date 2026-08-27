import { Color, StandardMaterial } from 'playcanvas';

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
