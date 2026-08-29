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
import type { AppBase, Asset, Keyboard, LightComponent } from 'playcanvas';

import { gameConfig } from '../config/gameConfig.ts';
import type { JobBounds, JobStart } from '../config/jobs.ts';
import { createLitMaterial } from '../world/materials.ts';
import { containerResource } from '../world/loadContainer.ts';
import { resolveSphereObstacles } from '../world/obstacles.ts';
import type { ObstacleBox } from '../world/obstacles.ts';
import { createPrimitive } from '../world/primitives.ts';
import type { WorldTextures } from '../world/textures.ts';

import { garbageTruckTuning } from './garbageTruckTuning.ts';
import { IntakePortalEffect } from './intakePortalEffect.ts';
import { purgeAtomizerLeaks } from './purgeAtomizerLeaks.ts';

const fallbackMat = createLitMaterial(0.42, 0.38, 0.34, { metalness: 0.55, gloss: 0.35 });
const orangeMat = createLitMaterial(0.85, 0.35, 0.08, { metalness: 0.2, gloss: 0.4 });
const hopperMat = createLitMaterial(0.32, 0.36, 0.38, { metalness: 0.4, gloss: 0.3 });

const STEER_WHEEL_NODES = ['WheelFL', 'WheelFR'] as const;
const ROLL_WHEEL_NODES = ['WheelFL', 'WheelFR', 'WheelRL', 'WheelRR'] as const;
/** Blender tire radius (m) before `garbageTruckTuning.scale`. */
const WHEEL_RADIUS = 0.255;

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
    private visual!: Entity;
    private modelRoot: Entity | null = null;
    private showcasePaused = false;
    private readonly steerPivots: Entity[] = [];
    private readonly rollPivots: Entity[] = [];
    private readonly intakePortal = new IntakePortalEffect();
    private wheelRoll = 0;

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

    setTextures(_textures: WorldTextures): void {
        // GLB materials are authored in Blender; primitive fallback keeps its lit mats.
    }

    setTruckAsset(asset: Asset): void {
        if (this.modelRoot) {
            this.modelRoot.destroy();
            this.modelRoot = null;
        }
        for (const child of [...this.visual.children]) {
            if (child.name === 'ShipFill' || child.name === 'Headlight' || child.name === 'Headlamp') {
                continue;
            }
            child.destroy();
        }
        this.steerPivots.length = 0;
        this.rollPivots.length = 0;
        purgeAtomizerLeaks(this.app.root);
        this.intakePortal.detach();
        this.wheelRoll = 0;

        const t = garbageTruckTuning;
        const yaw = new Entity('TruckYaw');
        yaw.setLocalEulerAngles(0, t.yaw, 0);
        const model = containerResource(asset).instantiateRenderEntity({ castShadows: true });
        model.name = 'GarbageTruckModel';
        model.setLocalScale(t.scale, t.scale, t.scale);
        model.setLocalPosition(-t.center[0] * t.scale, t.y, -t.center[2] * t.scale);
        yaw.addChild(model);
        this.visual.addChild(yaw);
        this.modelRoot = yaw;

        this.bindSteerWheels(model);
        this.bindRollWheels(model);
        purgeAtomizerLeaks(model);
        this.intakePortal.attach(model, this.app);

        this.applySteerPose();
        this.applyRollPose();
    }

    setMultipliers(thrust: number, maxSpeed: number): void {
        this.thrustMul = thrust;
        this.speedMul = maxSpeed;
    }

    /**
     * Current speed as 0..1 of reachable cruise speed.
     * Uses min(configured max, thrust/damping terminal) so full throttle
     * actually hits ~1 — damping often keeps you below raw maxSpeed.
     */
    speedNorm(): number {
        const maxSpeed = gameConfig.ship.maxSpeed * this.speedMul;
        const terminal =
            (gameConfig.ship.thrust * this.thrustMul) / gameConfig.ship.linearDamping;
        const ref = Math.min(maxSpeed, terminal);
        if (ref <= 0) {
            return 0;
        }
        return Math.min(1, this.velocity.length() / ref);
    }

    /** True while holding reverse thrust (S without W). */
    isReversing(): boolean {
        const keyboard = this.app.keyboard;
        if (!keyboard) {
            return false;
        }
        return keyboard.isPressed(KEY_S) && !keyboard.isPressed(KEY_W);
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
        this.wheelRoll = 0;
        this.velocity.set(0, 0, 0);
        this.applySteerPose();
        this.applyRollPose();
        this.hits = 0;
        this.overlapping = false;
        this.visual.setLocalEulerAngles(0, 0, 0);
        this.entity.setPosition(this.start.x, this.start.y, this.start.z);
        this.entity.setEulerAngles(this.pitch, this.yaw, 0);
    }

    setShowcase(active: boolean): void {
        if (active) {
            return;
        }
        this.showcasePaused = false;
        this.visual.setLocalEulerAngles(0, 0, 0);
    }

    isShowcasePaused(): boolean {
        return this.showcasePaused;
    }

    setShowcasePaused(paused: boolean): void {
        this.showcasePaused = paused;
    }

    updateShowcase(dt: number): void {
        this.intakePortal.update(dt);
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
        this.applyWheelRoll(dt);
        this.intakePortal.update(dt);
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
        for (const pivot of this.steerPivots) {
            pivot.setLocalEulerAngles(0, this.steer, 0);
        }
    }

    private applyRollPose(): void {
        for (const pivot of this.rollPivots) {
            // Roll around local X (axle through the hub after glTF Y-up export).
            pivot.setLocalEulerAngles(this.wheelRoll, 0, 0);
        }
    }

    private applyWheelRoll(dt: number): void {
        if (this.rollPivots.length === 0) {
            return;
        }
        this.forward.copy(this.entity.forward);
        const forwardSpeed = this.velocity.dot(this.forward);
        const radius = WHEEL_RADIUS * garbageTruckTuning.scale;
        if (radius <= 0) {
            return;
        }
        // Positive forward speed → wheels spin as if rolling under the truck.
        this.wheelRoll -= (forwardSpeed / radius) * (180 / Math.PI) * dt;
        this.applyRollPose();
    }

    private bindSteerWheels(modelRoot: Entity): void {
        for (const name of STEER_WHEEL_NODES) {
            const wheel = modelRoot.findByName(name);
            const parent = wheel?.parent;
            if (!wheel || !parent) {
                continue;
            }

            const localPos = wheel.getLocalPosition().clone();
            const localRot = wheel.getLocalRotation().clone();

            const pivot = new Entity(`${name}_Steer`);
            parent.addChild(pivot);
            pivot.setLocalPosition(localPos);
            pivot.addChild(wheel);
            wheel.setLocalPosition(0, 0, 0);
            wheel.setLocalRotation(localRot);

            this.steerPivots.push(pivot);
        }
    }

    private bindRollWheels(modelRoot: Entity): void {
        for (const name of ROLL_WHEEL_NODES) {
            const wheel = modelRoot.findByName(name);
            if (!wheel) {
                continue;
            }
            // Front wheels sit under a steer pivot; rears are still on TruckRoot.
            const parent = wheel.parent;
            if (!parent) {
                continue;
            }

            const localPos = wheel.getLocalPosition().clone();
            const localRot = wheel.getLocalRotation().clone();

            const pivot = new Entity(`${name}_Roll`);
            parent.addChild(pivot);
            pivot.setLocalPosition(localPos);
            pivot.addChild(wheel);
            wheel.setLocalPosition(0, 0, 0);
            wheel.setLocalRotation(localRot);

            this.rollPivots.push(pivot);
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
        if (!this.headlight) {
            return;
        }
        this.headlightOn = !this.headlightOn;
        this.headlight.enabled = this.headlightOn;
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
        this.buildPrimitiveFallback();
        this.attachLights();
    }

    private buildPrimitiveFallback(): void {
        const visual = this.visual;
        const cab = createPrimitive('Cab', 'box', fallbackMat);
        cab.setLocalScale(1.1, 0.85, 1.0);
        cab.setLocalPosition(0, 0.15, -0.2);
        visual.addChild(cab);

        const hopper = createPrimitive('Hopper', 'box', hopperMat);
        hopper.setLocalScale(1.25, 1.1, 1.5);
        hopper.setLocalPosition(0, 0.35, 1.15);
        visual.addChild(hopper);

        const intake = createPrimitive('Intake', 'cone', orangeMat);
        intake.setLocalScale(1.1, 1.0, 1.1);
        intake.setLocalPosition(0, 0.1, -1.35);
        intake.setLocalEulerAngles(90, 0, 0);
        visual.addChild(intake);
    }

    private attachLights(): void {
        const visual = this.visual;

        const fill = new Entity('ShipFill');
        fill.addComponent('light', {
            type: 'omni',
            color: new Color(1, 0.92, 0.55),
            intensity: 0.4,
            range: 10,
            castShadows: false
        });
        fill.setLocalPosition(0, 0.9, 0.2);
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
        headlight.setLocalPosition(0, 0.25, -1.9);
        headlight.setLocalEulerAngles(82, 0, 0);
        visual.addChild(headlight);
        this.headlight = headlight.light ?? null;
    }
}

