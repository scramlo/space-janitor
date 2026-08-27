import { Entity  } from 'playcanvas';
import type { StandardMaterial } from 'playcanvas';

type PrimitiveType = 'box' | 'sphere' | 'capsule' | 'cylinder' | 'cone';

export function createPrimitive(
    name: string,
    type: PrimitiveType,
    material: StandardMaterial,
    options?: { castShadows?: boolean; receiveShadows?: boolean }
): Entity {
    const entity = new Entity(name);
    entity.addComponent('render', {
        type,
        material,
        castShadows: options?.castShadows ?? true,
        receiveShadows: options?.receiveShadows ?? true
    });
    return entity;
}
