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
    LIGHTFALLOFF_LINEAR,
    Vec3
} from 'playcanvas';
import type { AppBase, Keyboard, LightComponent, StandardMaterial } from 'playcanvas';

import { gameConfig } from '../config/gameConfig.ts';
import type { JobBounds, JobStart } from '../config/jobs.ts';
import { createLitMaterial, createPbrMaterial, tilingForBox } from '../world/materials.ts';
import { resolveSphereObstacles } from '../world/obstacles.ts';
import type { ObstacleBox } from '../world/obstacles.ts';
import { createPrimitive } from '../world/primitives.ts';
import type { WorldTextures } from '../world/textures.ts';

const bodyFallback = createLitMaterial(0.42, 0.38, 0.34, { metalness: 0.72, gloss: 0.38 });
const cargoFallback = createLitMaterial(0.32, 0.4, 0.36, { metalness: 0.55, gloss: 0.28 });
const suckerFallback = createLitMaterial(0.82, 0.8, 0.74, { metalness: 0.02, gloss: 0.12 });
const wheelFallback = createLitMaterial(0.07, 0.07, 0.08, { metalness: 0.04, gloss: 0.12 });

const bodySize = { sx: 0.92, sy: 0.7, sz: 0.68 };
const cargoSize = { sx: 1.38, sy: 1.18, sz: 1.95 };
const suckerSize = { sx: 0.88, sy: 0.85, sz: 0.88 };
const wheelSize = { diameter: 0.56, thickness: 0.2 };
const cabCargoJoint = 0.46;

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
    private steer = 0;
    private thrustMul = 1;
    private speedMul = 1;
    private bounds: JobBounds;
    private start: JobStart = { x: 0, y: 5, z: 12 };
    private obstacles: readonly ObstacleBox[] = [];
    private overlapping = false;
    private hits = 0;
    private headlightOn = true;
    private headlight: LightComponent | null = null;
    private lampMat: StandardMaterial | null = null;
    private visual!: Entity;
    private body: Entity | null = null;
    private cargo: Entity | null = null;
    private sucker: Entity | null = null;
    private showcasing = false;
    private showcaseYaw = 0;
    private readonly wheels: { pivot: Entity; mesh: Entity }[] = [];

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

    setTextures(textures: WorldTextures): void {
        if (this.body) {
            assignMaterial(
                this.body,
                createPbrMaterial(textures.rustyMetal, tilingForBox(bodySize.sx, bodySize.sy, bodySize.sz, 0.7), {
                    metalness: textures.rustyMetal?.metalness ? 1 : 0.72,
                    gloss: textures.rustyMetal ? 1 : 0.38
                })
            );
        }
        if (this.cargo) {
            assignMaterial(
                this.cargo,
                createPbrMaterial(textures.rustyMetalGrid, tilingForBox(cargoSize.sx, cargoSize.sy, cargoSize.sz, 0.85), {
                    metalness: 0.58,
                    gloss: textures.rustyMetalGrid ? 1 : 0.28
                })
            );
        }
        if (this.sucker) {
            assignMaterial(
                this.sucker,
                createPbrMaterial(textures.polystyrene, tilingForBox(suckerSize.sx, suckerSize.sy, suckerSize.sz, 0.55), {
                    metalness: 0.02,
                    gloss: textures.polystyrene ? 1 : 0.12
                })
            );
        }
        const wheelMat = createPbrMaterial(
            textures.rubberTiles,
            tilingForBox(wheelSize.diameter, wheelSize.thickness, wheelSize.diameter, 0.35),
            {
                metalness: 0.02,
                gloss: textures.rubberTiles ? 1 : 0.12
            }
        );
        for (const wheel of this.wheels) {
            assignMaterial(wheel.mesh, wheelMat);
        }
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
        this.steer = 0;
        this.velocity.set(0, 0, 0);
        this.applySteerPose();
        this.hits = 0;
        this.overlapping = false;
        this.showcaseYaw = 0;
        this.visual.setLocalEulerAngles(0, 0, 0);
        this.entity.setPosition(this.start.x, this.start.y, this.start.z);
        this.entity.setEulerAngles(this.pitch, this.yaw, 0);
    }

    setShowcase(active: boolean): void {
        this.showcasing = active;
        if (active) {
            return;
        }
        this.showcaseYaw = 0;
        this.visual.setLocalEulerAngles(0, 0, 0);
    }

    updateShowcase(dt: number): void {
        if (!this.showcasing) {
            return;
        }
        this.showcaseYaw = (this.showcaseYaw + gameConfig.camera.showcase.spinSpeed * dt) % 360;
        this.visual.setLocalEulerAngles(0, this.showcaseYaw, 0);
    }

    update(dt: number): void {
        const keyboard = this.app.keyboard;
        if (!keyboard) {
            return;
        }

        this.applyLook(keyboard, dt);
        this.applySteer(keyboard, dt);
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

    private applySteer(keyboard: Keyboard, dt: number): void {
        const yawInput = (keyboard.isPressed(KEY_LEFT) ? 1 : 0) - (keyboard.isPressed(KEY_RIGHT) ? 1 : 0);
        const target = yawInput * gameConfig.ship.steerAngle;
        const alpha = 1 - Math.exp(-gameConfig.ship.steerLerp * dt);
        this.steer += (target - this.steer) * alpha;
        this.applySteerPose();
    }

    private applySteerPose(): void {
        for (const wheel of this.wheels) {
            wheel.pivot.setLocalEulerAngles(0, this.steer, 0);
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

    toggleHeadlight(): void {
        if (!this.headlight || !this.lampMat) {
            return;
        }
        this.headlightOn = !this.headlightOn;
        this.headlight.enabled = this.headlightOn;
        this.lampMat.emissiveIntensity = this.headlightOn ? 1.1 : 0;
        this.lampMat.update();
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
        this.visual = new Entity('ShipVisual');
        this.entity.addChild(this.visual);
        const visual = this.visual;

        const bodyZ = cabCargoJoint - bodySize.sz * 0.5;
        const cargoZ = cabCargoJoint + cargoSize.sz * 0.5;
        const cabFront = cabCargoJoint - bodySize.sz;

        const body = createPrimitive('Body', 'box', bodyFallback);
        body.setLocalScale(bodySize.sx, bodySize.sy, bodySize.sz);
        body.setLocalPosition(0, 0, bodyZ);
        visual.addChild(body);
        this.body = body;

        const cargo = createPrimitive('Cargo', 'box', cargoFallback);
        cargo.setLocalScale(cargoSize.sx, cargoSize.sy, cargoSize.sz);
        cargo.setLocalPosition(0, 0.28, cargoZ);
        visual.addChild(cargo);
        this.cargo = cargo;

        const sucker = createPrimitive('Sucker', 'cone', suckerFallback);
        sucker.setLocalScale(suckerSize.sx, suckerSize.sy, suckerSize.sz);
        sucker.setLocalPosition(0, 0, cabFront - 0.445);
        sucker.setLocalEulerAngles(90, 0, 0);
        visual.addChild(sucker);
        this.sucker = sucker;

        const frontTrack = bodySize.sx * 0.5 + wheelSize.thickness * 0.35;
        const rearTrack = cargoSize.sx * 0.5 + wheelSize.thickness * 0.15;
        this.wheels.push(
            addWheel(visual, 'WheelFL', -frontTrack, -0.38, bodyZ - bodySize.sz * 0.22),
            addWheel(visual, 'WheelFR', frontTrack, -0.38, bodyZ - bodySize.sz * 0.22),
            addWheel(visual, 'WheelRL', -rearTrack, -0.38, cargoZ + cargoSize.sz * 0.14),
            addWheel(visual, 'WheelRR', rearTrack, -0.38, cargoZ + cargoSize.sz * 0.14)
        );

        const lampMat = createLitMaterial(1, 0.92, 0.72, { metalness: 0.1, gloss: 0.5, emissive: 1.1 });
        this.lampMat = lampMat;
        const lamp = createPrimitive('Headlamp', 'box', lampMat, { castShadows: false });
        lamp.setLocalScale(0.36, 0.14, 0.16);
        lamp.setLocalPosition(0, 0.2, cabFront - 0.775);
        visual.addChild(lamp);

        const fill = new Entity('ShipFill');
        fill.addComponent('light', {
            type: 'omni',
            color: new Color(1, 0.92, 0.55),
            intensity: 0.35,
            range: 8,
            castShadows: false
        });
        fill.setLocalPosition(0, 0.7, 0.2);
        visual.addChild(fill);

        const headlight = new Entity('Headlight');
        headlight.addComponent('light', {
            type: 'spot',
            color: new Color(0.95, 0.92, 0.82),
            intensity: gameConfig.ship.headlight.intensity,
            range: gameConfig.ship.headlight.range,
            innerConeAngle: gameConfig.ship.headlight.innerCone,
            outerConeAngle: gameConfig.ship.headlight.outerCone,
            falloffMode: LIGHTFALLOFF_LINEAR,
            castShadows: false
        });
        headlight.setLocalPosition(0, 0.12, cabFront - 0.745);
        headlight.setLocalEulerAngles(82, 0, 0);
        visual.addChild(headlight);
        this.headlight = headlight.light ?? null;
    }
}

function addWheel(parent: Entity, name: string, x: number, y: number, z: number): { pivot: Entity; mesh: Entity } {
    const pivot = new Entity(name);
    pivot.setLocalPosition(x, y, z);
    parent.addChild(pivot);
    const mesh = createPrimitive(`${name}_Mesh`, 'cylinder', wheelFallback);
    mesh.setLocalScale(wheelSize.diameter, wheelSize.thickness, wheelSize.diameter);
    mesh.setLocalEulerAngles(0, 0, 90);
    pivot.addChild(mesh);
    return { pivot, mesh };
}

function assignMaterial(entity: Entity, material: StandardMaterial): void {
    const render = entity.render;
    if (!render) {
        return;
    }
    for (const meshInstance of render.meshInstances) {
        meshInstance.material = material;
    }
}
