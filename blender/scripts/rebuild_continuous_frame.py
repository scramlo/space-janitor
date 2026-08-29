import bpy
import bmesh
from mathutils import Vector, geometry

# ---------------------------------------------------------------------------
# Remove old segmented end frames + corner fillers (keep bottom L/R for now)
# ---------------------------------------------------------------------------
remove_prefixes = (
    "ContainerFrameF_",
    "ContainerFrameB_",
    "ContainerFrameCorner",
    "ContainerFrameFront",
    "ContainerFrameBack",
)
for n in list(bpy.data.objects.keys()):
    if any(n.startswith(p) for p in remove_prefixes):
        o = bpy.data.objects[n]
        mesh = o.data if o.type == "MESH" else None
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)

root = bpy.data.objects["ContainerRoot"]
mat = bpy.data.materials.get("ContainerFrame")

# Glass hex silhouette corners (XZ), clockwise from bottom-left
# Matches current glass: verticals + top slants + flat roof + flat bottom
GLASS = [
    Vector((-0.556, 0.547)),  # 0 bottom-left
    Vector((-0.556, 1.545)),  # 1 left eave (vertical→slant)
    Vector((-0.278, 1.807)),  # 2 left roof
    Vector((0.278, 1.807)),  # 3 right roof
    Vector((0.556, 1.545)),  # 4 right eave
    Vector((0.556, 0.547)),  # 5 bottom-right
]

BAR_W = 0.095  # face width of side/top/slant bars (lettering-friendly)
BOTTOM_H = 0.155  # thicker bottom for text like the reference
DEPTH = 0.092  # extrusion in Y (end-frame thickness)

# Front / back glass Y — frame straddles each end face
Y_FRONT_GLASS = -0.1515
Y_BACK_GLASS = -1.6567
Y_FRONT = (Y_FRONT_GLASS - DEPTH * 0.5, Y_FRONT_GLASS + DEPTH * 0.5)
Y_BACK = (Y_BACK_GLASS - DEPTH * 0.5, Y_BACK_GLASS + DEPTH * 0.5)


def offset_polygon(poly, dist):
    """Offset a closed 2D polygon (list of Vector x,z) outward by dist (positive = out)."""
    n = len(poly)
    out = []
    for i in range(n):
        prev = poly[(i - 1) % n]
        curr = poly[i]
        nxt = poly[(i + 1) % n]
        e1 = (curr - prev).normalized()
        e2 = (nxt - curr).normalized()
        # Outward normal for clockwise XZ polygon (X right, Z up): left of edge = (-dz, dx)
        n1 = Vector((-e1.y, e1.x))
        n2 = Vector((-e2.y, e2.x))
        # Average normal at vertex
        nrm = (n1 + n2)
        if nrm.length < 1e-8:
            nrm = n1
        nrm.normalize()
        # Miter: move along angle bisector scaled so offset distance is correct
        # bisector of outward normals
        m = n1 + n2
        if m.length < 1e-8:
            m = nrm
        m.normalize()
        # Scale miter: dist / cos(half-angle) ≈ dist / dot(m, n1)
        denom = m.dot(n1)
        if abs(denom) < 0.2:
            denom = 0.2 if denom >= 0 else -0.2
        out.append(curr + m * (dist / denom))
    return out


def make_hex_ring(name, y0, y1, bottom_extra=0.0):
    """
    Continuous hex frame ring: outer/inner loops from glass silhouette.
    Bottom segment gets extra outer drop for a taller lettering bar.
    """
    # Centerline ≈ glass edge; outer/inner = ± half bar
    half = BAR_W * 0.5
    outer = offset_polygon(GLASS, half)
    inner = offset_polygon(GLASS, -half)

    # Thicken bottom: drop outer bottom corners and raise inner bottom corners
    # Bottom edge is between verts 5 and 0
    drop = (BOTTOM_H - BAR_W) * 0.5 + bottom_extra
    # Outer bottom lower
    for i in (0, 5):
        outer[i] = Vector((outer[i].x, outer[i].y - drop))
    # Inner bottom higher so bottom bar is BOTTOM_H tall
    target_bottom_h = BOTTOM_H
    # Set inner bottom z from outer bottom + target height
    # Keep inner x from offset; adjust z
    mid_outer_z = 0.5 * (outer[0].y + outer[5].y)
    for i in (0, 5):
        inner[i] = Vector((inner[i].x, mid_outer_z + target_bottom_h))

    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    # Build as prism: front loop y0, back loop y1 for both outer and inner
    # Order: outer[0..5], inner[0..5] at y0 and y1
    vo0 = [bm.verts.new((p.x, y0, p.y)) for p in outer]
    vi0 = [bm.verts.new((p.x, y0, p.y)) for p in inner]
    vo1 = [bm.verts.new((p.x, y1, p.y)) for p in outer]
    vi1 = [bm.verts.new((p.x, y1, p.y)) for p in inner]
    bm.verts.ensure_lookup_table()

    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        # Outer wall
        bm.faces.new([vo0[i], vo0[j], vo1[j], vo1[i]])
        # Inner wall (reversed winding)
        bm.faces.new([vi0[j], vi0[i], vi1[i], vi1[j]])
        # Front annulus (y0)
        bm.faces.new([vo0[i], vi0[i], vi0[j], vo0[j]])
        # Back annulus (y1)
        bm.faces.new([vo1[j], vi1[j], vi1[i], vo1[i]])

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Soften slightly for cartoon join look
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=0.008,
        segments=2,
        profile=0.5,
        affect="EDGES",
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True
    if mat:
        mesh.materials.append(mat)
    return obj


front = make_hex_ring("ContainerFrameFront", Y_FRONT[0], Y_FRONT[1])
back = make_hex_ring("ContainerFrameBack", Y_BACK[0], Y_BACK[1])

# ---------------------------------------------------------------------------
# Rebuild bottom longitudinal rails — thicker for side lettering, flush into ends
# ---------------------------------------------------------------------------
for n in list(bpy.data.objects.keys()):
    if n.startswith("ContainerFrameBottom"):
        o = bpy.data.objects[n]
        mesh = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)


def make_box(name, xmin, xmax, ymin, ymax, zmin, zmax):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root
    bm = bmesh.new()
    vs = [
        bm.verts.new((xmin, ymin, zmin)),
        bm.verts.new((xmax, ymin, zmin)),
        bm.verts.new((xmax, ymax, zmin)),
        bm.verts.new((xmin, ymax, zmin)),
        bm.verts.new((xmin, ymin, zmax)),
        bm.verts.new((xmax, ymin, zmax)),
        bm.verts.new((xmax, ymax, zmax)),
        bm.verts.new((xmin, ymax, zmax)),
    ]
    bm.verts.ensure_lookup_table()
    for f in (
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ):
        bm.faces.new([vs[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.bevel(
        bm, geom=list(bm.edges), offset=0.01, segments=2, profile=0.5, affect="EDGES"
    )
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for p in mesh.polygons:
        p.use_smooth = True
    if mat:
        mesh.materials.append(mat)
    return obj


# Rails bury into continuous end rings
y_min = Y_BACK[0]
y_max = Y_FRONT[1]
# Align with glass sides; thick like reference bottom lettering bar
rail_h = BOTTOM_H
rail_w = BAR_W
z_bottom = 0.532 - (rail_h - 0.095) * 0.35  # sit under glass floor a touch
z_top = z_bottom + rail_h
x_l = -0.556
x_r = 0.556

make_box(
    "ContainerFrameBottomL",
    x_l - rail_w * 0.55,
    x_l + rail_w * 0.45,
    y_min,
    y_max,
    z_bottom,
    z_top,
)
make_box(
    "ContainerFrameBottomR",
    x_r - rail_w * 0.45,
    x_r + rail_w * 0.55,
    y_min,
    y_max,
    z_bottom,
    z_top,
)

bpy.context.view_layer.update()

# Report
def wb(obj):
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in cs]
    ys = [c.y for c in cs]
    zs = [c.z for c in cs]
    return {
        "dx": round(max(xs) - min(xs), 4),
        "dy": round(max(ys) - min(ys), 4),
        "dz": round(max(zs) - min(zs), 4),
        "zmin": round(min(zs), 4),
        "zmax": round(max(zs), 4),
    }


print(
    {
        "front": wb(front),
        "back": wb(back),
        "bottomL": wb(bpy.data.objects["ContainerFrameBottomL"]),
        "parts": sorted(
            o.name
            for o in bpy.data.objects
            if o.name.startswith("ContainerFrame")
        ),
    }
)
