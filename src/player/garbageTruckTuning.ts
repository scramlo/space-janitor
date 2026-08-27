/** Calibrated from `public/models/garbage-truck.glb` via inspect-glb (boundsSource: vertices). */
export const garbageTruckTuning = {
    url: '/models/garbage-truck.glb',
    boundsSource: 'vertices' as const,
    aabb: { min: [-1.11, -0.16, -2.21], max: [1.11, 2.21, 2.46] },
    dims: [2.22, 2.37, 4.67],
    center: [0, 1.025, 0.125],
    groundOffset: 0.16,
    /** Blender nose is -Y → glTF +Z; PlayCanvas forward is -Z. */
    intended: { dimension: 'length' as const, size: 3.6 },
    scale: 3.6 / 4.67,
    /** Center the flying truck on the gameplay root (not floor-seated). */
    y: -(1.025 * (3.6 / 4.67)),
    yaw: 180
} as const;
