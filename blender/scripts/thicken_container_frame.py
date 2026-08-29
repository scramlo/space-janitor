import bpy
from mathutils import Vector

FACTOR = 2.0
frames = [
    o
    for o in bpy.data.objects
    if o.name.startswith("ContainerFrame") and o.type == "MESH"
]


def unique_xz(points, eps=1e-4):
    out = []
    for p in points:
        if not any(abs(p.x - q.x) < eps and abs(p.z - q.z) < eps for q in out):
            out.append(Vector((p.x, 0.0, p.z)))
    return out


def thicken(obj, factor=FACTOR):
    mesh = obj.data
    mw = obj.matrix_world
    imw = mw.inverted()
    world = [mw @ v.co for v in mesh.vertices]

    ys = [p.y for p in world]
    cy = 0.5 * (min(ys) + max(ys))

    xz = unique_xz(world)
    if len(xz) < 4:
        # Fallback: scale the two smaller AABB axes
        xs = [p.x for p in world]
        zs = [p.z for p in world]
        cx = 0.5 * (min(xs) + max(xs))
        cz = 0.5 * (min(zs) + max(zs))
        dx = max(xs) - min(xs)
        dz = max(zs) - min(zs)
        sx = factor if dx <= dz else 1.0
        sz = factor if dz <= dx else 1.0
        # If nearly equal (post), scale both cross axes
        if abs(dx - dz) < 0.02:
            sx = sz = factor
        for i, v in enumerate(mesh.vertices):
            p = world[i].copy()
            p.x = cx + (p.x - cx) * sx
            p.y = cy + (p.y - cy) * factor
            p.z = cz + (p.z - cz) * sz
            v.co = imw @ p
        mesh.update()
        return {"mode": "aabb", "sx": sx, "sz": sz}

    # Order profile corners and find shortest edge (= bar width in face plane)
    # Use convex-ish pairing: compare all edge lengths between points
    best = None
    for i in range(len(xz)):
        for j in range(i + 1, len(xz)):
            d = (xz[j] - xz[i]).length
            if best is None or d < best[0]:
                best = (d, xz[j] - xz[i])
    short = best[1]
    if short.length < 1e-8:
        return {"mode": "skip"}
    short_dir = short.normalized()

    # Center of profile
    cx = sum(p.x for p in xz) / len(xz)
    cz = sum(p.z for p in xz) / len(xz)
    c = Vector((cx, 0.0, cz))

    for i, v in enumerate(mesh.vertices):
        p = world[i].copy()
        # Expand Y thickness about center
        p.y = cy + (p.y - cy) * factor
        # Expand along short axis in XZ about center; keep long-axis component
        rel = Vector((p.x - c.x, 0.0, p.z - c.z))
        along_short = rel.dot(short_dir)
        along_long = rel - short_dir * along_short
        rel2 = along_long + short_dir * (along_short * factor)
        p.x = c.x + rel2.x
        p.z = c.z + rel2.z
        v.co = imw @ p
    mesh.update()
    return {"mode": "short_axis", "width_before": round(best[0], 4)}


report = {}
for obj in frames:
    report[obj.name] = thicken(obj)

bpy.context.view_layer.update()

# Summarize new cross-sections
summary = {}
for obj in frames:
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in cs]
    ys = [c.y for c in cs]
    zs = [c.z for c in cs]
    summary[obj.name] = {
        "dx": round(max(xs) - min(xs), 4),
        "dy": round(max(ys) - min(ys), 4),
        "dz": round(max(zs) - min(zs), 4),
    }

print({"thicken": report, "dims": summary})
