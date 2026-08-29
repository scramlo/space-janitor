import {
    ADDRESS_CLAMP_TO_EDGE,
    BLEND_ADDITIVE,
    Color,
    CULLFACE_NONE,
    Curve,
    CurveSet,
    EMITTERSHAPE_SPHERE,
    Entity,
    FILTER_LINEAR,
    PARTICLEORIENTATION_WORLD,
    PIXELFORMAT_RGBA8,
    StandardMaterial,
    Texture,
    Vec3,
    type AppBase
} from 'playcanvas';
import type { LightComponent } from 'playcanvas';

import { createUnlitMaterial } from '../world/materials.ts';
import { createPrimitive } from '../world/primitives.ts';

import { garbageTruckTuning } from './garbageTruckTuning.ts';

/** Flat emissive portal disc at the throat, or particles-only (no solid ball/disc). */
export type IntakePortalStyle = 'disc' | 'particles-only';

const GLOW_INTENSITY = 3.2;
const PORTAL_STYLE: IntakePortalStyle = 'disc';

const PARTICLE_TEX_VERSION = 2;
let sharedParticleTexture: Texture | null = null;
let sharedParticleTextureVersion = 0;

function softParticleTexture(app: AppBase): Texture {
    if (sharedParticleTexture && sharedParticleTextureVersion === PARTICLE_TEX_VERSION) {
        return sharedParticleTexture;
    }

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not create intake particle texture.');
    }

    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.35, 'rgba(220,250,255,1)');
    gradient.addColorStop(0.65, 'rgba(180,120,255,0.75)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    sharedParticleTexture = new Texture(app.graphicsDevice, {
        width: size,
        height: size,
        format: PIXELFORMAT_RGBA8,
        mipmaps: false,
        minFilter: FILTER_LINEAR,
        magFilter: FILTER_LINEAR,
        addressU: ADDRESS_CLAMP_TO_EDGE,
        addressV: ADDRESS_CLAMP_TO_EDGE
    });
    sharedParticleTexture.setSource(canvas);
    sharedParticleTextureVersion = PARTICLE_TEX_VERSION;
    return sharedParticleTexture;
}

function resolveThroatLocal(modelRoot: Entity): Vec3 {
    const collar = modelRoot.findByName('SuctionCollar') as Entity | null;
    if (collar) {
        return collar.getLocalPosition().clone();
    }
    const [x, y, z] = garbageTruckTuning.intakeThroat;
    return new Vec3(x, y, z);
}

function createPortalDiscMaterial(): StandardMaterial {
    const material = createUnlitMaterial(0.5, 0.35, 1, 3.8);
    material.blendType = BLEND_ADDITIVE;
    material.depthWrite = false;
    material.cull = CULLFACE_NONE;
    material.update();
    return material;
}

export class IntakePortalEffect {
    private mount: Entity | null = null;
    private disc: Entity | null = null;
    private glowLight: LightComponent | null = null;
    private time = 0;

    attach(modelRoot: Entity, app: AppBase): void {
        this.detach();

        const suctionRoot = modelRoot.findByName('SuctionRoot') as Entity | null;
        if (!suctionRoot) {
            return;
        }

        const throat = resolveThroatLocal(modelRoot);
        this.mount = new Entity('IntakePortal');
        suctionRoot.addChild(this.mount);
        this.mount.setLocalPosition(throat);

        if (PORTAL_STYLE === 'disc') {
            this.disc = createPrimitive('IntakePortalDisc', 'cylinder', createPortalDiscMaterial(), {
                castShadows: false,
                receiveShadows: false
            });
            // Cylinder caps lie in XY after pitching forward — portal faces down the intake (-Z).
            this.disc.setLocalEulerAngles(90, 0, 0);
            this.disc.setLocalScale(0.27, 0.27, 0.012);
            this.mount.addChild(this.disc);
        }

        const motes = new Entity('IntakePortalMotes');
        this.mount.addChild(motes);
        motes.addComponent('particlesystem', {
            numParticles: 112,
            lifetime: 1.1,
            rate: 0.045,
            loop: true,
            preWarm: true,
            intensity: 1.6,
            localSpace: true,
            orientation: PARTICLEORIENTATION_WORLD,
            emitterShape: EMITTERSHAPE_SPHERE,
            emitterRadius: 0.12,
            emitterRadiusInner: 0.02,
            initialVelocity: 0.08,
            depthWrite: false,
            blendType: BLEND_ADDITIVE,
            colorMap: softParticleTexture(app),
            scaleGraph: new Curve([0, 0.06, 0.35, 0.14, 0.75, 0.09, 1, 0]),
            alphaGraph: new Curve([0, 0, 0.12, 1, 0.7, 0.75, 1, 0]),
            colorGraph: new CurveSet(
                [0, 0.45, 0.4, 1, 0.75, 0.7, 1, 0.35],
                [0, 0.95, 0.45, 1, 0.75, 0.55, 1, 0.25],
                [0, 1, 0.5, 1, 0.75, 1, 1, 0.5]
            ),
            localVelocityGraph: new CurveSet(
                [0, 0, 0.5, 0.12, 1, 0],
                [0, 0, 0.5, 0.08, 1, 0],
                [0, 0, 0.5, -0.12, 1, 0]
            ),
            localVelocityGraph2: new CurveSet(
                [0, 0, 0.5, -0.12, 1, 0],
                [0, 0, 0.5, 0.08, 1, 0],
                [0, 0, 0.5, 0.12, 1, 0]
            ),
            radialSpeedGraph: new Curve([0, 0.05, 0.5, 0.18, 1, 0.02]),
            rotationSpeedGraph: new Curve([0, 120])
        });

        const glow = new Entity('IntakePortalGlow');
        glow.addComponent('light', {
            type: 'omni',
            color: new Color(0.45, 0.88, 1),
            intensity: GLOW_INTENSITY,
            range: 1.35,
            castShadows: false
        });
        this.mount.addChild(glow);
        this.glowLight = glow.light ?? null;
    }

    update(dt: number): void {
        if (!this.mount) {
            return;
        }
        this.time += dt;
        if (this.disc) {
            this.disc.rotateLocal(0, 0, 95 * dt);
        }

        if (this.glowLight) {
            const pulse = 0.82 + 0.18 * Math.sin(this.time * 7);
            this.glowLight.intensity = GLOW_INTENSITY * pulse;
        }
    }

    detach(): void {
        this.mount?.destroy();
        this.mount = null;
        this.disc = null;
        this.glowLight = null;
        this.time = 0;
    }
}
