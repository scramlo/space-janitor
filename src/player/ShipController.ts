import {
    Color,
    Entity,
    KEY_A,
    KEY_D,
    KEY_DOWN,
    KEY_LEFT,
    KEY_RIGHT,
    KEY_S,
    KEY_UP,
    KEY_W,
    Vec3
} from 'playcanvas';
import type { AppBase, Keyboard } from 'playcanvas';

import { gameConfig } from '../config/gameConfig.ts';
import type { JobBounds, JobStart } from '../config/jobs.ts';
import { createLitMaterial } from '../world/materials.ts';
import { resolveSphereObstacles } from '../world/obstacles.ts';
import type { ObstacleBox } from '../world/obstacles.ts';
import { createPrimitive } from '../world/primitives.ts';

const hullMat = createLitMaterial(0.86, 0.74, 0.18, { metalness: 0.35, gloss: 0.45 });
const darkMat = createLitMaterial(0.12, 0.14, 0.16, { metalness: 0.6, gloss: 0.5 });
const accentMat = createLitMaterial(0.18, 0.42, 0.38, { metalness: 0.2, gloss: 0.3, emissive: 0.15 });

export class ShipController {
    readonly entity: Entity;
    readonly radius = gameConfig.ship.radius;

    private readonly app: AppBase;
    private readonly velocity = new Vec3();
    private readonly accel = new Vec3();
    private readonly forward = new Vec3();
    private readonly right = new Vec3();
    private readonly position = new Vec3();
    private yaw = 0;
    private pitch = 0;
    private thrustMul = 1;
    private speedMul = 1;
    private bounds: JobBounds;
    private start: JobStart = { x: 0, y: 5, z: 12 };
    private obstacles: readonly ObstacleBox[] = [];
    private overlapping = false;
    private hits = 0;

    constructor(app: AppBase, bounds: JobBounds) {
        this.app = app;
        this.bounds = bounds;
        this.entity = new Entity('Ship');
        this.buildVisual();
        app.root.addChild(this.entity);
        this.reset();
    }

    setBounds(bounds: JobBounds): void {
        this.bounds = bounds;
    }

    setStart(start: JobStart): void {
        this.start = start;
    }

    setObstacles(obstacles: readonly ObstacleBox[]): void {
        this.obstacles = obstacles;
        this.overlapping = false;
    }

    setMultipliers(thrust: number, maxSpeed: number): void {
        this.thrustMul = thrust;
        this.speedMul = maxSpeed;
    }

    consumeHits(): number {
        const count = this.hits;
        this.hits = 0;
        return count;
    }

    reset(): void {
        this.yaw = 0;
        this.pitch = 0;
        this.velocity.set(0, 0, 0);
        this.hits = 0;
        this.overlapping = false;
        this.entity.setPosition(this.start.x, this.start.y, this.start.z);
        this.entity.setEulerAngles(this.pitch, this.yaw, 0);
    }

    update(dt: number): void {
        const keyboard = this.app.keyboard;
        if (!keyboard) {
            return;
        }

        this.applyLook(keyboard, dt);
        this.entity.setEulerAngles(this.pitch, this.yaw, 0);
        this.applyThrust(keyboard, dt);
        this.integrate(dt);
    }

    private applyLook(keyboard: Keyboard, dt: number): void {
        const yawInput = (keyboard.isPressed(KEY_LEFT) ? 1 : 0) - (keyboard.isPressed(KEY_RIGHT) ? 1 : 0);
        const pitchInput = (keyboard.isPressed(KEY_DOWN) ? 1 : 0) - (keyboard.isPressed(KEY_UP) ? 1 : 0);
        this.yaw += yawInput * gameConfig.ship.yawSpeed * dt;
        this.pitch += pitchInput * gameConfig.ship.pitchSpeed * dt;
        const maxPitch = gameConfig.ship.maxPitch;
        if (this.pitch > maxPitch) {
            this.pitch = maxPitch;
        } else if (this.pitch < -maxPitch) {
            this.pitch = -maxPitch;
        }
    }

    private applyThrust(keyboard: Keyboard, dt: number): void {
        const thrustZ = (keyboard.isPressed(KEY_W) ? 1 : 0) - (keyboard.isPressed(KEY_S) ? 1 : 0);
        const thrustX = (keyboard.isPressed(KEY_D) ? 1 : 0) - (keyboard.isPressed(KEY_A) ? 1 : 0);
        this.forward.copy(this.entity.forward);
        this.right.copy(this.entity.right);
        this.accel.set(0, 0, 0);
        this.accel.add(this.forward.mulScalar(thrustZ));
        this.accel.add(this.right.mulScalar(thrustX));
        if (this.accel.lengthSq() > 1) {
            this.accel.normalize();
        }
        const thrust = gameConfig.ship.thrust * this.thrustMul;
        this.accel.mulScalar(thrust * dt);
        this.velocity.add(this.accel);
        this.velocity.mulScalar(Math.exp(-gameConfig.ship.linearDamping * dt));

        const maxSpeed = gameConfig.ship.maxSpeed * this.speedMul;
        if (this.velocity.length() > maxSpeed) {
            this.velocity.normalize().mulScalar(maxSpeed);
        }
    }

    private integrate(dt: number): void {
        this.position.copy(this.entity.getPosition());
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;
        this.position.z += this.velocity.z * dt;

        const { min, max } = this.bounds;
        this.position.x = this.bounce(this.position.x, min.x, max.x, 'x');
        this.position.y = this.bounce(this.position.y, min.y, max.y, 'y');
        this.position.z = this.bounce(this.position.z, min.z, max.z, 'z');

        const speed = this.velocity.length();
        const hit = resolveSphereObstacles(this.position, this.velocity, this.radius, this.obstacles);
        if (hit && !this.overlapping && speed > 2.5) {
            this.hits += 1;
        }
        this.overlapping = hit;

        this.entity.setPosition(this.position);
    }

    private bounce(value: number, min: number, max: number, axis: 'x' | 'y' | 'z'): number {
        if (value < min) {
            this.velocity[axis] = Math.abs(this.velocity[axis]) * 0.25;
            return min;
        }
        if (value > max) {
            this.velocity[axis] = -Math.abs(this.velocity[axis]) * 0.25;
            return max;
        }
        return value;
    }

    private buildVisual(): void {
        const visual = new Entity('ShipVisual');
        this.entity.addChild(visual);

        const hull = createPrimitive('Hull', 'box', hullMat);
        hull.setLocalScale(1.15, 0.48, 2.35);
        visual.addChild(hull);

        const cabin = createPrimitive('Cabin', 'box', darkMat);
        cabin.setLocalScale(0.72, 0.38, 0.7);
        cabin.setLocalPosition(0, 0.38, 0.35);
        visual.addChild(cabin);

        const window = createPrimitive('Window', 'box', accentMat, { castShadows: false });
        window.setLocalScale(0.62, 0.18, 0.12);
        window.setLocalPosition(0, 0.42, 0.68);
        visual.addChild(window);

        const nozzle = createPrimitive('Nozzle', 'box', darkMat);
        nozzle.setLocalScale(0.55, 0.55, 0.7);
        nozzle.setLocalPosition(0, -0.05, -1.35);
        visual.addChild(nozzle);

        const stripe = createPrimitive('Stripe', 'box', hullMat, { castShadows: false });
        stripe.setLocalScale(1.18, 0.08, 0.5);
        stripe.setLocalPosition(0, 0.18, -0.2);
        visual.addChild(stripe);

        const fill = new Entity('ShipFill');
        fill.addComponent('light', {
            type: 'omni',
            color: new Color(1, 0.92, 0.55),
            intensity: 0.35,
            range: 8,
            castShadows: false
        });
        fill.setLocalPosition(0, 0.6, 0);
        visual.addChild(fill);
    }
}
