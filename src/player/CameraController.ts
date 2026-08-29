import { Color, Entity, Vec3 } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import { gameConfig } from '../config/gameConfig.ts';
import { clipRayAgainstObstacles } from '../world/obstacles.ts';
import type { ObstacleBox } from '../world/obstacles.ts';

export class CameraController {
    readonly entity: Entity;

    private readonly target: Entity;
    private readonly position = new Vec3();
    private readonly desired = new Vec3();
    private readonly look = new Vec3();
    private readonly offset = new Vec3();
    private readonly forward = new Vec3();
    private readonly pivot = new Vec3();
    private obstacles: readonly ObstacleBox[] = [];
    private snapped = false;
    private showcasing = false;
    private showcasePaused = false;
    private showcaseOrbitYaw = 0;

    constructor(app: AppBase, target: Entity) {
        this.target = target;
        this.entity = new Entity('Camera');
        this.entity.addComponent('camera', {
            fov: gameConfig.camera.fov,
            nearClip: 0.15,
            clearColor: new Color(0.02, 0.03, 0.05)
        });
        app.root.addChild(this.entity);
        this.snap();
    }

    setObstacles(obstacles: readonly ObstacleBox[]): void {
        this.obstacles = obstacles;
    }

    setShowcase(active: boolean): void {
        this.showcasing = active;
        this.snapped = false;
        if (!active) {
            this.showcasePaused = false;
            this.showcaseOrbitYaw = 0;
        }
    }

    setShowcasePaused(paused: boolean): void {
        this.showcasePaused = paused;
    }

    snap(): void {
        if (this.showcasing) {
            this.placeShowcase();
        } else {
            this.placeDesired();
        }
        this.position.copy(this.desired);
        this.entity.setPosition(this.position);
        this.entity.lookAt(this.look);
        this.snapped = true;
    }

    update(dt: number): void {
        if (this.showcasing) {
            if (!this.showcasePaused) {
                this.showcaseOrbitYaw =
                    (this.showcaseOrbitYaw + gameConfig.camera.showcase.spinSpeed * dt) % 360;
            }
            this.placeShowcase();
            this.position.copy(this.desired);
            this.entity.setPosition(this.position);
            this.entity.lookAt(this.look);
            return;
        }

        this.placeDesired();
        if (!this.snapped) {
            this.position.copy(this.desired);
            this.snapped = true;
        } else {
            const alpha = 1 - Math.exp(-gameConfig.camera.lerp * dt);
            this.position.lerp(this.position, this.desired, alpha);
        }
        this.clipToObstacles(this.position);
        this.entity.setPosition(this.position);
        this.entity.lookAt(this.look);
    }

    private placeDesired(): void {
        this.pivot.copy(this.target.getPosition());
        this.forward.copy(this.target.forward);
        this.offset.copy(this.forward).mulScalar(-gameConfig.camera.distance);
        this.desired.copy(this.pivot).add(this.offset);
        this.desired.y += gameConfig.camera.height;
        this.look.copy(this.forward).mulScalar(gameConfig.camera.lookAhead).add(this.pivot);
        this.clipToObstacles(this.desired);
    }

    private placeShowcase(): void {
        const cfg = gameConfig.camera.showcase;
        this.pivot.copy(this.target.getPosition());
        const yaw = ((cfg.yaw + this.showcaseOrbitYaw) * Math.PI) / 180;
        this.desired.set(
            this.pivot.x + Math.sin(yaw) * cfg.distance,
            this.pivot.y + cfg.height,
            this.pivot.z + Math.cos(yaw) * cfg.distance
        );
        this.entity.setPosition(this.desired);
        this.entity.lookAt(this.pivot);
        this.offset.copy(this.entity.right).mulScalar(-cfg.frameShift);
        this.look.copy(this.pivot).add(this.offset);
    }

    private clipToObstacles(point: Vec3): void {
        clipRayAgainstObstacles(
            this.pivot,
            point,
            this.obstacles,
            gameConfig.camera.collisionPadding,
            point
        );
    }
}
