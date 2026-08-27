import { Entity, Vec3  } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import type { JobDef } from '../config/jobs.ts';

import { createLitMaterial } from './materials.ts';
import { pointInsideObstacle } from './obstacles.ts';
import type { ObstacleBox } from './obstacles.ts';
import { createPrimitive } from './primitives.ts';

export type DebrisPiece = {
    entity: Entity;
    radius: number;
    collected: boolean;
    spin: Vec3;
};

const scrapPalette = [
    createLitMaterial(0.55, 0.42, 0.22, { metalness: 0.1, gloss: 0.2 }),
    createLitMaterial(0.32, 0.38, 0.28, { metalness: 0.05, gloss: 0.15 }),
    createLitMaterial(0.45, 0.22, 0.16, { metalness: 0.2, gloss: 0.25 }),
    createLitMaterial(0.22, 0.4, 0.42, { metalness: 0.15, gloss: 0.4, emissive: 0.08 }),
    createLitMaterial(0.5, 0.5, 0.48, { metalness: 0.55, gloss: 0.45 }),
    createLitMaterial(0.62, 0.55, 0.32, { metalness: 0.08, gloss: 0.18 })
];

const orePalette = [
    createLitMaterial(0.48, 0.28, 0.1, { metalness: 0.18, gloss: 0.16 }),
    createLitMaterial(0.32, 0.2, 0.12, { metalness: 0.08, gloss: 0.12 }),
    createLitMaterial(0.58, 0.4, 0.16, { metalness: 0.35, gloss: 0.28 }),
    createLitMaterial(0.22, 0.22, 0.24, { metalness: 0.6, gloss: 0.35 }),
    createLitMaterial(0.4, 0.16, 0.08, { metalness: 0.12, gloss: 0.14, emissive: 0.05 }),
    createLitMaterial(0.7, 0.55, 0.28, { metalness: 0.22, gloss: 0.2 })
];

export class DebrisField {
    readonly pieces: DebrisPiece[] = [];

    private readonly root: Entity;

    constructor(app: AppBase) {
        this.root = new Entity('DebrisField');
        app.root.addChild(this.root);
    }

    spawn(job: JobDef, obstacles: readonly ObstacleBox[] = []): void {
        this.clear();
        const start = job.start;
        const { min, max } = job.bounds;
        const margin = job.debris.innerMargin;
        const palette = job.environment === 'mining-facility' ? orePalette : scrapPalette;

        for (let i = 0; i < job.debrisCount; i++) {
            const radius = lerp(job.debris.minRadius, job.debris.maxRadius, Math.random());
            let x = 0;
            let y = 0;
            let z = 0;
            let attempts = 0;
            do {
                x = lerp(min.x + margin, max.x - margin, Math.random());
                y = lerp(min.y + 0.4, max.y - 1.5, Math.random());
                z = lerp(min.z + margin, max.z - margin, Math.random());
                attempts += 1;
            } while (
                attempts < 40 &&
                (distanceSq(x, y, z, start.x, start.y, start.z) < 36 ||
                    pointInsideObstacle(x, y, z, obstacles, radius + 0.4))
            );

            const type = Math.random() > 0.45 ? 'sphere' : 'box';
            const material = palette[i % palette.length] ?? palette[0];
            const entity = createPrimitive(`Debris_${i}`, type, material);
            const scale = radius * 2;
            entity.setLocalScale(type === 'box' ? scale * (0.7 + Math.random() * 0.5) : scale, scale, scale);
            entity.setPosition(x, y, z);
            entity.setEulerAngles(Math.random() * 360, Math.random() * 360, Math.random() * 360);
            this.root.addChild(entity);

            this.pieces.push({
                entity,
                radius,
                collected: false,
                spin: new Vec3((Math.random() - 0.5) * 40, (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 40)
            });
        }
    }

    spin(dt: number): void {
        for (const piece of this.pieces) {
            if (piece.collected) {
                continue;
            }
            piece.entity.rotate(piece.spin.x * dt, piece.spin.y * dt, piece.spin.z * dt);
        }
    }

    collect(piece: DebrisPiece): void {
        piece.collected = true;
        piece.entity.enabled = false;
    }

    remainingCount(): number {
        let count = 0;
        for (const piece of this.pieces) {
            if (!piece.collected) {
                count += 1;
            }
        }
        return count;
    }

    clear(): void {
        for (const piece of this.pieces) {
            piece.entity.destroy();
        }
        this.pieces.length = 0;
    }
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

function distanceSq(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    const dz = az - bz;
    return dx * dx + dy * dy + dz * dz;
}
