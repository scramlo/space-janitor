/** Calibrated from `public/models/garbage-truck-concept.glb` via inspect-glb (boundsSource: vertices). */
export const garbageTruckTuning = {
    url: '/models/garbage-truck-concept.glb',
    boundsSource: 'vertices' as const,
    aabb: { min: [-0.8985, 0, -1.718], max: [0.8985, 2.0137, 1.6932] },
    dims: [1.797, 2.0137, 3.4112],
    center: [0, 1.0068, -0.0124],
    groundOffset: 0,
    /** Blender +Y forward → glTF +Z; PlayCanvas forward is -Z — this asset already faces correctly at yaw 0. */
    intended: { dimension: 'length' as const, size: 3.6 },
    scale: 3.6 / 3.4112,
    /** Center the flying truck on the gameplay root (not floor-seated). */
    y: -(1.0068 * (3.6 / 3.4112)),
    yaw: 0
} as const;
