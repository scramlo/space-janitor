export type ObstacleBox = {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
};

export function boxObstacle(
    cx: number,
    cy: number,
    cz: number,
    sx: number,
    sy: number,
    sz: number,
    padding = 0
): ObstacleBox {
    const hx = sx / 2 + padding;
    const hy = sy / 2 + padding;
    const hz = sz / 2 + padding;
    return {
        min: { x: cx - hx, y: cy - hy, z: cz - hz },
        max: { x: cx + hx, y: cy + hy, z: cz + hz }
    };
}

export function clipRayAgainstObstacles(
    origin: { x: number; y: number; z: number },
    end: { x: number; y: number; z: number },
    obstacles: readonly ObstacleBox[],
    padding: number,
    out: { x: number; y: number; z: number }
): void {
    out.x = end.x;
    out.y = end.y;
    out.z = end.z;
    const dx = end.x - origin.x;
    const dy = end.y - origin.y;
    const dz = end.z - origin.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6 || obstacles.length === 0) {
        return;
    }

    let bestT = 1;
    for (const box of obstacles) {
        const hitT = raySegmentAabb(origin, dx, dy, dz, box);
        if (hitT !== null && hitT < bestT) {
            bestT = hitT;
        }
    }
    if (bestT >= 1) {
        return;
    }

    const t = Math.max(0, bestT - padding / length);
    out.x = origin.x + dx * t;
    out.y = origin.y + dy * t;
    out.z = origin.z + dz * t;
}

function raySegmentAabb(
    origin: { x: number; y: number; z: number },
    dx: number,
    dy: number,
    dz: number,
    box: ObstacleBox
): number | null {
    let tmin = 0;
    let tmax = 1;
    const axes: readonly [number, number, number, number][] = [
        [origin.x, dx, box.min.x, box.max.x],
        [origin.y, dy, box.min.y, box.max.y],
        [origin.z, dz, box.min.z, box.max.z]
    ];
    for (const [start, delta, min, max] of axes) {
        if (Math.abs(delta) < 1e-8) {
            if (start < min || start > max) {
                return null;
            }
            continue;
        }
        let t1 = (min - start) / delta;
        let t2 = (max - start) / delta;
        if (t1 > t2) {
            const swap = t1;
            t1 = t2;
            t2 = swap;
        }
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) {
            return null;
        }
    }
    if (tmin <= 1e-5) {
        return tmax > 1e-5 ? 0 : null;
    }
    return tmin;
}

export function pointInsideObstacle(
    x: number,
    y: number,
    z: number,
    obstacles: readonly ObstacleBox[],
    radius = 0
): boolean {
    for (const box of obstacles) {
        if (
            x + radius >= box.min.x &&
            x - radius <= box.max.x &&
            y + radius >= box.min.y &&
            y - radius <= box.max.y &&
            z + radius >= box.min.z &&
            z - radius <= box.max.z
        ) {
            return true;
        }
    }
    return false;
}

export function resolveSphereObstacles(
    position: { x: number; y: number; z: number },
    velocity: { x: number; y: number; z: number },
    radius: number,
    obstacles: readonly ObstacleBox[]
): boolean {
    let hit = false;
    for (const box of obstacles) {
        const closestX = clamp(position.x, box.min.x, box.max.x);
        const closestY = clamp(position.y, box.min.y, box.max.y);
        const closestZ = clamp(position.z, box.min.z, box.max.z);
        const dx = position.x - closestX;
        const dy = position.y - closestY;
        const dz = position.z - closestZ;
        const distSq = dx * dx + dy * dy + dz * dz;
        if (distSq >= radius * radius) {
            continue;
        }
        hit = true;
        const dist = Math.sqrt(distSq);
        if (dist < 1e-5) {
            const pushX = position.x - (box.min.x + box.max.x) * 0.5;
            const pushZ = position.z - (box.min.z + box.max.z) * 0.5;
            const pushLen = Math.hypot(pushX, pushZ) || 1;
            position.x += (pushX / pushLen) * radius;
            position.z += (pushZ / pushLen) * radius;
            velocity.x *= -0.2;
            velocity.z *= -0.2;
            continue;
        }
        const overlap = radius - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const nz = dz / dist;
        position.x += nx * overlap;
        position.y += ny * overlap;
        position.z += nz * overlap;
        const along = velocity.x * nx + velocity.y * ny + velocity.z * nz;
        if (along < 0) {
            velocity.x -= nx * along * 1.25;
            velocity.y -= ny * along * 1.25;
            velocity.z -= nz * along * 1.25;
        }
    }
    return hit;
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
