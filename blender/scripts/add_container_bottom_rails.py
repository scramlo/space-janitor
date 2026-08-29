import bpy
import bmesh
from mathutils import Vector

# Remove prior bottom rails if re-running
for n in list(bpy.data.objects.keys()):
    if n.startswith("ContainerFrameBottom"):
        o = bpy.data.objects[n]
        mesh = o.data
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)

root = bpy.data.objects["ContainerRoot"]
mat = bpy.data.materials.get("ContainerFrame")

# Match thickened end-frame bottom bar cross-section
BAR_W = 0.09  # X / lateral
BAR_H = 0.0957  # Z
BAR_D = 0.09  # Y thickness of end bars (for reference)

# End bottom bar centers / extents (connected overlap)
F = bpy.data.objects["ContainerFrameF_5"]
B = bpy.data.objects["ContainerFrameB_5"]


def world_bounds(obj):
    cs = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in cs]
    ys = [c.y for c in cs]
    zs = [c.z for c in cs]
    return {
        "xmin": min(xs),
        "xmax": max(xs),
        "ymin": min(ys),
        "ymax": max(ys),
        "zmin": min(zs),
        "zmax": max(zs),
        "cx": 0.5 * (min(xs) + max(xs)),
        "cy": 0.5 * (min(ys) + max(ys)),
        "cz": 0.5 * (min(zs) + max(zs)),
    }


fb = world_bounds(F)
bb = world_bounds(B)

# Full perimeter Y so rails bury into front/back bars
y_front = fb["ymax"]  # outer front of front bar
y_back = bb["ymin"]  # outer back of back bar
cz = fb["cz"]
# Corner X aligns with vertical posts
x_left = -0.57
x_right = 0.57


def make_box(name, xmin, xmax, ymin, ymax, zmin, zmax):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = root

    bm = bmesh.new()
    verts = [
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
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    for f in faces:
        bm.faces.new([verts[i] for i in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    if mat:
        mesh.materials.append(mat)
    return obj


zmin = cz - BAR_H * 0.5
zmax = cz + BAR_H * 0.5

# Left & right longitudinal rails (overlap end bars for a welded look)
rails = []
for name, cx in (("ContainerFrameBottomL", x_left), ("ContainerFrameBottomR", x_right)):
    rails.append(
        make_box(
            name,
            cx - BAR_W * 0.5,
            cx + BAR_W * 0.5,
            y_back,
            y_front,
            zmin,
            zmax,
        )
    )

# Center bottom rail — more lettering space + ties the span together
rails.append(
    make_box(
        "ContainerFrameBottomC",
        -BAR_W * 0.5,
        BAR_W * 0.5,
        y_back,
        y_front,
        zmin,
        zmax,
    )
)

# Short cross ties between L/C and C/R so the bottom reads as one lattice
# Place two ties along the length (not at ends — ends already have F_5/B_5)
span_y = y_front - y_back
tie_ys = (y_back + span_y * 0.33, y_back + span_y * 0.67)
for i, ty in enumerate(tie_ys):
    rails.append(
        make_box(
            f"ContainerFrameBottomTie_{i}",
            x_left,
            x_right,
            ty - BAR_D * 0.5,
            ty + BAR_D * 0.5,
            zmin,
            zmax,
        )
    )

bpy.context.view_layer.update()

created = {}
for o in rails:
    b = world_bounds(o)
    created[o.name] = {
        "dx": round(b["xmax"] - b["xmin"], 4),
        "dy": round(b["ymax"] - b["ymin"], 4),
        "dz": round(b["zmax"] - b["zmin"], 4),
        "cx": round(b["cx"], 4),
        "cy": round(b["cy"], 4),
    }

print(
    {
        "created": created,
        "y_span": [round(y_back, 4), round(y_front, 4)],
        "connects_posts_x": [x_left, x_right],
    }
)
