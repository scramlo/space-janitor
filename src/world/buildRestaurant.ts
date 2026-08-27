import { Color, Entity } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import type { BuiltWorld } from './buildBay.ts';
import { createLitMaterial } from './materials.ts';
import { boxObstacle } from './obstacles.ts';
import type { ObstacleBox } from './obstacles.ts';
import { createPrimitive } from './primitives.ts';
import { addStars } from './stars.ts';

const floorDark = createLitMaterial(0.12, 0.08, 0.07, { metalness: 0.05, gloss: 0.18 });
const floorLight = createLitMaterial(0.78, 0.72, 0.62, { metalness: 0.02, gloss: 0.22 });
const wallCream = createLitMaterial(0.82, 0.74, 0.62, { metalness: 0.04, gloss: 0.18 });
const boothRed = createLitMaterial(0.62, 0.12, 0.1, { metalness: 0.08, gloss: 0.28 });
const counterChrome = createLitMaterial(0.55, 0.58, 0.62, { metalness: 0.85, gloss: 0.55 });
const neonAmber = createLitMaterial(0.95, 0.55, 0.08, { metalness: 0.1, gloss: 0.35, emissive: 0.35 });
const neonPink = createLitMaterial(0.9, 0.2, 0.45, { metalness: 0.1, gloss: 0.3, emissive: 0.4 });
const trimMat = createLitMaterial(0.28, 0.2, 0.16, { metalness: 0.15, gloss: 0.25 });

/** Space Burger dining deck — gravity failure zone dressed as a diner. */
export function buildRestaurant(app: AppBase, job: JobDef): BuiltWorld {
    const root = new Entity('SpaceBurger');
    app.root.addChild(root);
    const obstacles: ObstacleBox[] = [];

    const floor = createPrimitive('Floor', 'box', floorDark);
    floor.setLocalScale(42, 0.4, 42);
    floor.setLocalPosition(0, -0.2, 0);
    root.addChild(floor);
    obstacles.push(boxObstacle(0, -0.2, 0, 42, 0.4, 42));

    addCheckerTiles(root);

    // Soft perimeter walls (short so stars still read)
    addWall(root, obstacles, 'WallNegZ', 40, 3.2, 0.35, 0, 1.6, -20.2);
    addWall(root, obstacles, 'WallPosZ', 40, 3.2, 0.35, 0, 1.6, 20.2);
    addWall(root, obstacles, 'WallNegX', 0.35, 3.2, 40, -20.2, 1.6, 0);
    addWall(root, obstacles, 'WallPosX', 0.35, 3.2, 40, 20.2, 1.6, 0);

    // Neon rails
    addNeon(root, 'NeonNegZ', neonAmber, 38, 0.12, 0.12, 0, 3.4, -19.8);
    addNeon(root, 'NeonPosZ', neonPink, 38, 0.12, 0.12, 0, 3.4, 19.8);

    // Service counter
    const counter = createPrimitive('Counter', 'box', counterChrome);
    counter.setLocalScale(14, 1.1, 2.2);
    counter.setLocalPosition(0, 0.55, -15);
    root.addChild(counter);
    obstacles.push(boxObstacle(0, 0.55, -15, 14, 1.1, 2.2));

    const counterTop = createPrimitive('CounterTop', 'box', trimMat);
    counterTop.setLocalScale(14.4, 0.12, 2.5);
    counterTop.setLocalPosition(0, 1.16, -15);
    root.addChild(counterTop);

    // Booths
    addBooth(root, obstacles, -12, 8);
    addBooth(root, obstacles, -12, -2);
    addBooth(root, obstacles, 12, 8);
    addBooth(root, obstacles, 12, -2);

    // Broken gravity machine prop (decorative cylinder + hazard stripe)
    const gravityCore = createPrimitive('GravityCore', 'cylinder', counterChrome);
    gravityCore.setLocalScale(2.6, 2.8, 2.6);
    gravityCore.setLocalPosition(14, 1.4, -12);
    root.addChild(gravityCore);
    obstacles.push(boxObstacle(14, 1.4, -12, 2.6, 2.8, 2.6));

    const hazard = createPrimitive('GravityHazard', 'box', neonAmber, { castShadows: false });
    hazard.setLocalScale(2.8, 0.18, 0.35);
    hazard.setLocalPosition(14, 2.9, -12);
    root.addChild(hazard);

    addStars(root);
    addLights(root);

    app.scene.ambientLight = new Color(0.28, 0.2, 0.16);

    void job;
    return { root, obstacles };
}

function addCheckerTiles(root: Entity): void {
    const size = 2.4;
    for (let ix = -8; ix <= 8; ix++) {
        for (let iz = -8; iz <= 8; iz++) {
            if ((ix + iz) % 2 !== 0) {
                continue;
            }
            const tile = createPrimitive(`Tile_${ix}_${iz}`, 'box', floorLight, { castShadows: false });
            tile.setLocalScale(size, 0.05, size);
            tile.setLocalPosition(ix * size, 0.02, iz * size);
            root.addChild(tile);
        }
    }
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
    const wall = createPrimitive(name, 'box', wallCream);
    wall.setLocalScale(sx, sy, sz);
    wall.setLocalPosition(x, y, z);
    root.addChild(wall);
    obstacles.push(boxObstacle(x, y, z, sx, sy, sz));
}

function addNeon(root: Entity, name: string, mat: ReturnType<typeof createLitMaterial>, sx: number, sy: number, sz: number, x: number, y: number, z: number): void {
    const beam = createPrimitive(name, 'box', mat, { castShadows: false });
    beam.setLocalScale(sx, sy, sz);
    beam.setLocalPosition(x, y, z);
    root.addChild(beam);
}

function addBooth(root: Entity, obstacles: ObstacleBox[], x: number, z: number): void {
    const seat = createPrimitive(`BoothSeat_${x}_${z}`, 'box', boothRed);
    seat.setLocalScale(3.4, 0.55, 2.2);
    seat.setLocalPosition(x, 0.35, z);
    root.addChild(seat);
    obstacles.push(boxObstacle(x, 0.35, z, 3.4, 0.55, 2.2));

    const back = createPrimitive(`BoothBack_${x}_${z}`, 'box', boothRed);
    back.setLocalScale(3.4, 1.4, 0.35);
    back.setLocalPosition(x, 1.0, z + (x < 0 ? -1.0 : 1.0));
    root.addChild(back);
    obstacles.push(boxObstacle(x, 1.0, z + (x < 0 ? -1.0 : 1.0), 3.4, 1.4, 0.35));

    const table = createPrimitive(`BoothTable_${x}_${z}`, 'box', trimMat);
    table.setLocalScale(2.4, 0.12, 1.4);
    table.setLocalPosition(x + (x < 0 ? 3.2 : -3.2), 0.85, z);
    root.addChild(table);
    obstacles.push(boxObstacle(x + (x < 0 ? 3.2 : -3.2), 0.85, z, 2.4, 0.12, 1.4));
}

function addLights(root: Entity): void {
    const key = new Entity('KeyLight');
    key.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.88, 0.72),
        intensity: 1.45,
        castShadows: true,
        shadowDistance: 55,
        shadowResolution: 1024,
        shadowBias: 0.3,
        normalOffsetBias: 0.15
    });
    key.setEulerAngles(48, 28, 0);
    root.addChild(key);

    const fill = new Entity('FillLight');
    fill.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.45, 0.55),
        intensity: 0.35,
        castShadows: false
    });
    fill.setEulerAngles(210, -30, 0);
    root.addChild(fill);

    const neon = new Entity('NeonFill');
    neon.addComponent('light', {
        type: 'point',
        color: new Color(1, 0.55, 0.15),
        intensity: 0.55,
        range: 28,
        castShadows: false
    });
    neon.setLocalPosition(0, 4.5, -10);
    root.addChild(neon);
}
