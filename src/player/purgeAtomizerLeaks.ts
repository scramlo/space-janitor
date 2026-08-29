import { Entity } from 'playcanvas';

/** Runtime portal rings + GLB atomizer discs from the BlendKit neon experiment. */
const ATOMIZER_LEAK = /^(Atomizer|SuctionAtomizer)/;

export function purgeAtomizerLeaks(root: Entity): void {
    const stale: Entity[] = [];
    root.find((node): boolean => {
        if (node instanceof Entity && ATOMIZER_LEAK.test(node.name)) {
            stale.push(node);
        }
        return false;
    });
    for (const entity of stale) {
        entity.destroy();
    }
}
