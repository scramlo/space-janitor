import { Color, Entity, Vec3  } from 'playcanvas';
import type { AppBase } from 'playcanvas';

import { gameConfig } from '../config/gameConfig.ts';

export class CameraController {
    readonly entity: Entity;

    private readonly target: Entity;
    private readonly position = new Vec3();
    private readonly desired = new Vec3();
    private readonly look = new Vec3();
    private readonly offset = new Vec3();
    private readonly forward = new Vec3();
    private snapped = false;

    constructor(app: AppBase, target: Entity) {
        this.target = target;
        this.entity = new Entity('Camera');
        this.entity.addComponent('camera', {
            fov: gameConfig.camera.fov,
            clearColor: new Color(0.02, 0.03, 0.05)
        });
        app.root.addChild(this.entity);
        this.snap();
    }

    snap(): void {
        this.placeDesired();
        this.position.copy(this.desired);
        this.entity.setPosition(this.position);
        this.entity.lookAt(this.look);
        this.snapped = true;
    }

    update(dt: number): void {
        this.placeDesired();
        if (!this.snapped) {
            this.position.copy(this.desired);
            this.snapped = true;
        } else {
            const alpha = 1 - Math.exp(-gameConfig.camera.lerp * dt);
            this.position.lerp(this.position, this.desired, alpha);
        }
        this.entity.setPosition(this.position);
        this.entity.lookAt(this.look);
    }

    private placeDesired(): void {
        const origin = this.target.getPosition();
        this.forward.copy(this.target.forward);
        this.offset.copy(this.forward).mulScalar(-gameConfig.camera.distance);
        this.desired.copy(origin).add(this.offset);
        this.desired.y += gameConfig.camera.height;
        this.look.copy(this.forward).mulScalar(gameConfig.camera.lookAhead).add(origin);
    }
}
