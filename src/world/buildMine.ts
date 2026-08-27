import { Color, Entity } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import type { BuiltWorld } from './buildBay.ts';
import { createLitMaterial } from './materials.ts';
import { boxObstacle } from './obstacles.ts';
import type { ObstacleBox } from './obstacles.ts';
import { createPrimitive } from './primitives.ts';
import { addStars } from './stars.ts';

const floorMat = createLitMaterial(0.12, 0.09, 0.07, { metalness: 0.15, gloss: 0.12 });
const rockMat = createLitMaterial(0.22, 0.16, 0.12, { metalness: 0.08, gloss: 0.1 });
const rustMat = createLitMaterial(0.42, 0.22, 0.1, { metalness: 0.55, gloss: 0.28 });
const steelMat = createLitMaterial(0.28, 0.3, 0.32, { metalness: 0.72, gloss: 0.38 });
const oreMat = createLitMaterial(0.48, 0.28, 0.12, { metalness: 0.2, gloss: 0.18, emissive: 0.04 });
const lampMat = createLitMaterial(1, 0.62, 0.22, { metalness: 0.1, gloss: 0.4, emissive: 0.7 });

export function buildMine(app: AppBase, job: JobDef): BuiltWorld {
    const root = new Entity('MiningFacility');
    app.root.addChild(root);
    const obstacles: ObstacleBox[] = [];

    const floor = createPrimitive('Floor', 'box', floorMat);
    floor.setLocalScale(48, 0.5, 48);
    floor.setLocalPosition(0, -0.25, 0);
    root.addChild(floor);

    addWall(root, obstacles, 'WallNegX', 1.2, 16, 46, -23, 8, 0);
    addWall(root, obstacles, 'WallPosX', 1.2, 16, 46, 23, 8, 0);
    addWall(root, obstacles, 'WallNegZ', 46, 16, 1.2, 0, 8, -23);
    addWall(root, obstacles, 'WallPosZ', 18, 16, 1.2, -14, 8, 23);
    addWall(root, obstacles, 'WallPosZRight', 18, 16, 1.2, 14, 8, 23);

    const ceiling = createPrimitive('Ceiling', 'box', rockMat);
    ceiling.setLocalScale(48, 0.8, 48);
    ceiling.setLocalPosition(0, 16.2, 0);
    root.addChild(ceiling);

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

    addLamp(root, -8, 12, 6);
    addLamp(root, 8, 12, -4);
    addLamp(root, 0, 13, 10);

    addStars(root, 28);
    addLights(root);

    app.scene.ambientLight = new Color(0.28, 0.18, 0.1);

    void job;
    return { root, obstacles };
}

function addWall(
    root: Entity,
    obstacles: ObstacleBox[],
    name: string,
    sx: number,
    sy: number,
    sz: number,
    x: number,
    y: number,
    z: number
): void {
    const wall = createPrimitive(name, 'box', rockMat);
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

function addLamp(root: Entity, x: number, y: number, z: number): void {
    const lamp = createPrimitive(`Lamp_${x}_${z}`, 'sphere', lampMat, { castShadows: false });
    lamp.setLocalScale(0.45, 0.45, 0.45);
    lamp.setLocalPosition(x, y, z);
    root.addChild(lamp);

    const light = new Entity(`HangLight_${x}_${z}`);
    light.addComponent('light', {
        type: 'omni',
        color: new Color(1, 0.62, 0.28),
        intensity: 0.55,
        range: 18,
        castShadows: false
    });
    light.setLocalPosition(x, y - 0.4, z);
    root.addChild(light);
}

function addLights(root: Entity): void {
    const key = new Entity('KeyLight');
    key.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.72, 0.42),
        intensity: 1.35,
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
        color: new Color(0.45, 0.62, 0.85),
        intensity: 0.4,
        castShadows: false
    });
    fill.setEulerAngles(210, 40, 0);
    root.addChild(fill);
}
