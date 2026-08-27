import { Color, Entity } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import type { BuiltWorld } from './buildBay.ts';
import { createLitMaterial, createRockMaterial, tilingForBox } from './materials.ts';
import { boxObstacle } from './obstacles.ts';
import type { ObstacleBox } from './obstacles.ts';
import { createPrimitive } from './primitives.ts';
import { addStars } from './stars.ts';
import type { PbrMaps } from './textures.ts';

const rustMat = createLitMaterial(0.42, 0.22, 0.1, { metalness: 0.55, gloss: 0.28 });
const steelMat = createLitMaterial(0.28, 0.3, 0.32, { metalness: 0.72, gloss: 0.38 });
const oreMat = createLitMaterial(0.48, 0.28, 0.12, { metalness: 0.2, gloss: 0.18 });
const crystalMat = createLitMaterial(0.62, 0.28, 0.92, { metalness: 0.08, gloss: 0.55, emissive: 1.35 });
const crystalCoreMat = createLitMaterial(0.82, 0.45, 1, { metalness: 0.05, gloss: 0.7, emissive: 2.1 });

export function buildMine(app: AppBase, job: JobDef, rockWall: PbrMaps | null = null): BuiltWorld {
    const root = new Entity('MiningFacility');
    app.root.addChild(root);
    const obstacles: ObstacleBox[] = [];
    const rockOf = rockMaterialFactory(rockWall);

    const floor = createPrimitive('Floor', 'box', rockOf(48, 0.5, 48));
    floor.setLocalScale(48, 0.5, 48);
    floor.setLocalPosition(0, -0.25, 0);
    root.addChild(floor);
    obstacles.push(boxObstacle(0, -0.25, 0, 48, 0.5, 48));

    addWall(root, obstacles, rockOf, 'WallNegX', 1.2, 16, 46, -23, 8, 0);
    addWall(root, obstacles, rockOf, 'WallPosX', 1.2, 16, 46, 23, 8, 0);
    addWall(root, obstacles, rockOf, 'WallNegZ', 46, 16, 1.2, 0, 8, -23);
    addWall(root, obstacles, rockOf, 'WallPosZ', 18, 16, 1.2, -14, 8, 23);
    addWall(root, obstacles, rockOf, 'WallPosZRight', 18, 16, 1.2, 14, 8, 23);

    const ceiling = createPrimitive('Ceiling', 'box', rockOf(48, 0.8, 48, { r: 0.85, g: 0.85, b: 0.88 }));
    ceiling.setLocalScale(48, 0.8, 48);
    ceiling.setLocalPosition(0, 16.2, 0);
    root.addChild(ceiling);
    obstacles.push(boxObstacle(0, 16.2, 0, 48, 0.8, 48));

    addMachine(root, obstacles, 'Hopper_L', rustMat, -10, 2.4, -2, 5.2, 4.8, 5.2);
    addMachine(root, obstacles, 'Hopper_R', rustMat, 11, 2.2, -10, 4.6, 4.4, 4.6);
    addMachine(root, obstacles, 'Crusher_L', steelMat, -3.2, 3.2, -8, 1.6, 6.4, 3.4);
    addMachine(root, obstacles, 'Crusher_R', steelMat, 3.2, 3.2, -8, 1.6, 6.4, 3.4);
    addMachine(root, obstacles, 'CrusherBeam', steelMat, 0, 6.6, -8, 8, 0.8, 2.2);
    addMachine(root, obstacles, 'Conveyor', steelMat, -10, 0.7, 8, 14, 1.1, 2.4);
    addMachine(root, obstacles, 'OreTank', rustMat, 13, 2.4, 8, 3.6, 4.8, 3.6);

    addOrePile(root, obstacles, 'OrePile_1', -14, 0.9, 12);
    addOrePile(root, obstacles, 'OrePile_2', 8, 0.8, 14);
    addOrePile(root, obstacles, 'OrePile_3', -6, 0.7, -16);

    addCrystal(root, obstacles, 'Crystal_Floor_1', 4.5, 0.2, 7.5, 'floor');
    addCrystal(root, obstacles, 'Crystal_Floor_2', -8.5, 0.2, 3, 'floor');
    addCrystal(root, obstacles, 'Crystal_Floor_3', 7, 0.2, -14, 'floor');
    addCrystal(root, obstacles, 'Crystal_Hang_1', 2.2, 15.4, 5, 'hang');
    addCrystal(root, obstacles, 'Crystal_Hang_2', -5, 15.4, -5.5, 'hang');
    addCrystal(root, obstacles, 'Crystal_Hang_3', 11, 15.4, 1.5, 'hang');

    addStars(root, 28);
    addLights(root);

    app.scene.ambientLight = new Color(0.4, 0.28, 0.18);

    void job;
    return { root, obstacles };
}

function rockMaterialFactory(maps: PbrMaps | null) {
    const cache = new Map<string, ReturnType<typeof createRockMaterial>>();
    return (sx: number, sy: number, sz: number, tint?: { r: number; g: number; b: number }) => {
        const tiling = tilingForBox(sx, sy, sz);
        const key = `${tiling.x.toFixed(2)},${tiling.y.toFixed(2)},${tint?.r ?? 1},${tint?.g ?? 1},${tint?.b ?? 1}`;
        const existing = cache.get(key);
        if (existing) {
            return existing;
        }
        const material = createRockMaterial(maps, tiling, tint);
        cache.set(key, material);
        return material;
    };
}

function addWall(
    root: Entity,
    obstacles: ObstacleBox[],
    rockOf: ReturnType<typeof rockMaterialFactory>,
    name: string,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number
): void {
    const wall = createPrimitive(name, 'box', rockOf(sx, sy, sz));
    wall.setLocalScale(sx, sy, sz);
    wall.setLocalPosition(x, y, z);
    root.addChild(wall);
    obstacles.push(boxObstacle(x, y, z, sx, sy, sz));
}

function addMachine(
    root: Entity,
    obstacles: ObstacleBox[],
    name: string,
    material: ReturnType<typeof createLitMaterial>,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number
): void {
    const machine = createPrimitive(name, 'box', material);
    machine.setLocalScale(sx, sy, sz);
    machine.setLocalPosition(x, y, z);
    root.addChild(machine);
    obstacles.push(boxObstacle(x, y, z, sx, sy, sz));
}

function addOrePile(root: Entity, obstacles: ObstacleBox[], name: string, x: number, y: number, z: number): void {
    const pile = createPrimitive(name, 'sphere', oreMat);
    pile.setLocalScale(3.4, 2.1, 3.2);
    pile.setLocalPosition(x, y, z);
    root.addChild(pile);
    obstacles.push(boxObstacle(x, y, z, 3.2, 2.1, 3));
}

function addCrystal(
    root: Entity,
    obstacles: ObstacleBox[],
    name: string,
    x: number,
    y: number,
    z: number,
    kind: 'floor' | 'hang'
): void {
    const cluster = new Entity(name);
    cluster.setLocalPosition(x, y, z);
    root.addChild(cluster);

    const hanging = kind === 'hang';
    const shards = hanging
        ? [
              { sx: 0.9, sy: 3.4, sz: 0.9, x: 0, y: -1.5, z: 0, rx: 180, ry: 0, rz: 0, core: true },
              { sx: 0.55, sy: 2.4, sz: 0.55, x: 0.45, y: -1.1, z: 0.2, rx: 168, ry: 25, rz: -12, core: false },
              { sx: 0.42, sy: 1.9, sz: 0.42, x: -0.4, y: -0.9, z: -0.25, rx: 192, ry: -18, rz: 10, core: false }
          ]
        : [
              { sx: 0.85, sy: 2.6, sz: 0.85, x: 0, y: 1.2, z: 0, rx: 0, ry: 18, rz: 8, core: true },
              { sx: 0.5, sy: 1.8, sz: 0.5, x: 0.5, y: 0.85, z: 0.15, rx: 14, ry: -20, rz: -10, core: false },
              { sx: 0.38, sy: 1.4, sz: 0.38, x: -0.42, y: 0.7, z: -0.2, rx: -12, ry: 30, rz: 6, core: false }
          ];

    for (const [index, shard] of shards.entries()) {
        const spike = createPrimitive(`${name}_Shard_${index}`, 'cone', shard.core ? crystalCoreMat : crystalMat, {
            castShadows: false
        });
        spike.setLocalScale(shard.sx, shard.sy, shard.sz);
        spike.setLocalPosition(shard.x, shard.y, shard.z);
        spike.setLocalEulerAngles(shard.rx, shard.ry, shard.rz);
        cluster.addChild(spike);
    }

    const glow = new Entity(`${name}_Glow`);
    glow.addComponent('light', {
        type: 'omni',
        color: new Color(0.72, 0.32, 1),
        intensity: hanging ? 1.6 : 1.35,
        range: hanging ? 18 : 15,
        castShadows: false
    });
    glow.setLocalPosition(0, hanging ? -1.6 : 1.1, 0);
    cluster.addChild(glow);

    if (hanging) {
        obstacles.push(boxObstacle(x, y - 1.7, z, 1.8, 3.4, 1.8));
    } else {
        obstacles.push(boxObstacle(x, y + 1.1, z, 1.8, 2.4, 1.8));
    }
}

function addLights(root: Entity): void {
    const key = new Entity('KeyLight');
    key.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.78, 0.52),
        intensity: 2.4,
        castShadows: true,
        shadowDistance: 60,
        shadowResolution: 1024,
        shadowBias: 0.3,
        normalOffsetBias: 0.15
    });
    key.setEulerAngles(48, -25, 0);
    root.addChild(key);

    const fill = new Entity('FillLight');
    fill.addComponent('light', {
        type: 'directional',
        color: new Color(0.5, 0.62, 0.82),
        intensity: 0.95,
        castShadows: false
    });
    fill.setEulerAngles(210, 40, 0);
    root.addChild(fill);
}
