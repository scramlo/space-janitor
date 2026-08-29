/** Calibrated from `public/models/garbage-truck-concept.glb` via inspect-glb (boundsSource: vertices). */
export const garbageTruckTuning = {
    url: '/models/garbage-truck-concept.glb?v=7',
    boundsSource: 'vertices' as const,
    aabb: { min: [-1.2803, 0, -1.718], max: [1.2803, 2.3371, 1.7147] },
    dims: [2.5605, 2.3371, 3.4327],
    center: [0, 1.1685, -0.0016],
    groundOffset: 0,
    /** Blender +Y forward → glTF +Z; PlayCanvas forward is -Z — this asset already faces correctly at yaw 0. */
    intended: { dimension: 'length' as const, size: 3.6 },
    scale: 3.6 / 3.4327,
    /** Center the flying truck on the gameplay root (not floor-seated). */
    y: -(1.1685 * (3.6 / 3.4327)),
    yaw: 0,
    /** SuctionRoot-local throat fallback when `SuctionCollar` is missing. */
    intakeThroat: [0, 0.945, -1.341] as const
} as const;
