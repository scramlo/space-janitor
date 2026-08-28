/** Calibrated from `public/models/garbage-truck-concept.glb` via inspect-glb (boundsSource: vertices). */
export const garbageTruckTuning = {
    url: '/models/garbage-truck-concept.glb',
    boundsSource: 'vertices' as const,
    aabb: { min: [-1.03, 0.0037, -3.22], max: [1.03, 2.5467, 2.2058] },
    dims: [2.06, 2.5431, 5.4258],
    center: [0, 1.2752, -0.5071],
    groundOffset: -0.0037,
    /** Blender nose is -Y → glTF +Z; PlayCanvas forward is -Z. */
    intended: { dimension: 'length' as const, size: 3.6 },
    scale: 3.6 / 5.4258,
    /** Center the flying truck on the gameplay root (not floor-seated). */
    y: -(1.2752 * (3.6 / 5.4258)),
    yaw: 180
} as const;
