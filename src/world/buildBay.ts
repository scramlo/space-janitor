import { Color, Entity  } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import { createLitMaterial, createUnlitMaterial } from './materials.ts';
import { createPrimitive } from './primitives.ts';

const floorMat = createLitMaterial(0.09, 0.1, 0.12, { metalness: 0.4, gloss: 0.2 });
const wallMat = createLitMaterial(0.16, 0.18, 0.2, { metalness: 0.55, gloss: 0.25 });
const stripeMat = createLitMaterial(0.78, 0.62, 0.12, { metalness: 0.1, gloss: 0.2, emissive: 0.08 });
const structureMat = createLitMaterial(0.22, 0.24, 0.28, { metalness: 0.7, gloss: 0.4 });
const starMat = createUnlitMaterial(0.85, 0.9, 1, 1.4);

export function buildBay(app: AppBase, job: JobDef): Entity {
    const root = new Entity('DockingBay');
    app.root.addChild(root);

    const floor = createPrimitive('Floor', 'box', floorMat);
    floor.setLocalScale(42, 0.4, 42);
    floor.setLocalPosition(0, -0.2, 0);
    root.addChild(floor);

    addGirder(root, 'BeamNegZ', 40, 0.45, 0.45, 0, 14.5, -20);
    addGirder(root, 'BeamPosZ', 40, 0.45, 0.45, 0, 14.5, 20);
    addGirder(root, 'BeamNegX', 0.45, 0.45, 40, -20, 14.5, 0);
    addGirder(root, 'BeamPosX', 0.45, 0.45, 40, 20, 14.5, 0);
    addGirder(root, 'RailNegZ', 40, 0.3, 0.3, 0, 0.4, -20);
    addGirder(root, 'RailPosZ', 40, 0.3, 0.3, 0, 0.4, 20);
    addGirder(root, 'RailNegX', 0.3, 0.3, 40, -20, 0.4, 0);
    addGirder(root, 'RailPosX', 0.3, 0.3, 40, 20, 0.4, 0);

    const pillars = [
        [-18, -18],
        [-18, 18],
        [18, -18],
        [18, 18]
    ] as const;
    for (const [x, z] of pillars) {
        const pillar = createPrimitive(`Pillar_${x}_${z}`, 'cylinder', structureMat);
        pillar.setLocalScale(1.2, 16, 1.2);
        pillar.setLocalPosition(x, 8, z);
        root.addChild(pillar);
    }

    for (let i = -3; i <= 3; i++) {
        const stripe = createPrimitive(`Stripe_${i}`, 'box', stripeMat, { castShadows: false });
        stripe.setLocalScale(1.4, 0.06, 6);
        stripe.setLocalPosition(i * 3.2, 0.03, 8);
        root.addChild(stripe);
    }

    const crateMat = createLitMaterial(0.28, 0.22, 0.16, { metalness: 0.05, gloss: 0.15 });
    const crate = createPrimitive('StaticCrate', 'box', crateMat);
    crate.setLocalScale(3.2, 2.2, 2.4);
    crate.setLocalPosition(-14, 1.1, -14);
    root.addChild(crate);

    const tank = createPrimitive('StaticTank', 'cylinder', structureMat);
    tank.setLocalScale(2.4, 3.2, 2.4);
    tank.setLocalPosition(14, 1.6, -13);
    root.addChild(tank);

    addStars(root);
    addLights(app, root);

    app.scene.ambientLight = new Color(0.16, 0.18, 0.24);

    void job;
    return root;
}

function addGirder(root: Entity, name: string, sx: number, sy: number, sz: number, x: number, y: number, z: number): void {
    const beam = createPrimitive(name, 'box', wallMat);
    beam.setLocalScale(sx, sy, sz);
    beam.setLocalPosition(x, y, z);
    root.addChild(beam);
}

function addLights(app: AppBase, root: Entity): void {
    const key = new Entity('KeyLight');
    key.addComponent('light', {
        type: 'directional',
        color: new Color(0.82, 0.9, 1),
        intensity: 1.6,
        castShadows: true,
        shadowDistance: 55,
        shadowResolution: 1024,
        shadowBias: 0.3,
        normalOffsetBias: 0.15
    });
    key.setEulerAngles(42, 35, 0);
    root.addChild(key);

    const fill = new Entity('FillLight');
    fill.addComponent('light', {
        type: 'directional',
        color: new Color(1, 0.72, 0.42),
        intensity: 0.28,
        castShadows: false
    });
    fill.setEulerAngles(200, -20, 0);
    root.addChild(fill);

    void app;
}

function addStars(root: Entity): void {
    const stars = new Entity('Stars');
    root.addChild(stars);
    for (let i = 0; i < 48; i++) {
        const star = createPrimitive(`Star_${i}`, 'sphere', starMat, { castShadows: false, receiveShadows: false });
        const radius = 70 + Math.random() * 40;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = Math.abs(radius * Math.cos(phi)) + 8;
        const z = radius * Math.sin(phi) * Math.sin(theta);
        const scale = 0.18 + Math.random() * 0.35;
        star.setLocalScale(scale, scale, scale);
        star.setLocalPosition(x, y, z);
        stars.addChild(star);
    }
}
