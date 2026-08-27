import { Entity } from 'playcanvas';

import { createUnlitMaterial } from './materials.ts';
import { createPrimitive } from './primitives.ts';

const starMat = createUnlitMaterial(0.85, 0.9, 1, 1.4);

export function addStars(root: Entity, count = 48): void {
    const stars = new Entity('Stars');
    root.addChild(stars);
    for (let i = 0; i < count; i++) {
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
