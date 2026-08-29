import bpy
import bmesh
from mathutils import Vector
from math import radians

# Clear prior attempt
for n in list(bpy.data.objects.keys()):
    if n.startswith("FuelTank"):
        o = bpy.data.objects[n]
        mesh = o.data if o.type == "MESH" else None
        bpy.data.objects.remove(o, do_unlink=True)
        if mesh and mesh.users == 0:
            bpy.data.meshes.remove(mesh)

truck = bpy.data.objects["TruckRoot"]
mat_tank = bpy.data.materials["FuelTankPaint"]
mat_strap = bpy.data.materials["FuelTankStrap"]
mat_steel = bpy.data.materials.get("FrameSteel") or mat_strap

CY = 0.28
LENGTH = 0.62
RADIUS = 0.125
CHASSIS_ZMIN = 0.39
CZ = CHASSIS_ZMIN - RADIUS + 0.012


def link_empty(obj, parent):
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent


def assign(obj, mat):
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)


def shade_smooth(obj):
    for p in obj.data.polygons:
        p.use_smooth = True


def bevel_all(obj, offset=0.012, segments=3):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.bevel(
        bm,
        geom=list(bm.edges),
        offset=offset,
        segments=segments,
        profile=0.5,
        affect="EDGES",
    )
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def attach(obj, parent, local_loc=(0, 0, 0), local_rot=(0, 0, 0)):
    """Parent and place in parent's local space."""
    obj.parent = parent
    obj.location = local_loc
    obj.rotation_euler = local_rot


root = bpy.data.objects.new("FuelTankRoot", None)
root.empty_display_size = 0.1
link_empty(root, truck)
root.location = (0.0, CY, CZ)

# Body — cylinder along Y
bpy.ops.mesh.primitive_cylinder_add(
    vertices=28, radius=RADIUS, depth=LENGTH * 0.72, location=(0, 0, 0)
)
body = bpy.context.active_object
body.name = "FuelTankBody"
# Rotate in local space after parenting
assign(body, mat_tank)
shade_smooth(body)
attach(body, root, (0, 0, 0), (radians(90), 0, 0))

# Domed end caps
cap_r = RADIUS * 1.02
for name, y_sign in (("FuelTankCapF", 1), ("FuelTankCapR", -1)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=24, ring_count=12, radius=cap_r, location=(0, 0, 0)
    )
    cap = bpy.context.active_object
    cap.name = name
    assign(cap, mat_tank)
    shade_smooth(cap)
    attach(cap, root, (0, y_sign * (LENGTH * 0.36), 0))
    cap.scale = (1.0, 0.72, 1.0)

# Straps
strap_ys = (-0.16, 0.16)
for i, sy in enumerate(strap_ys):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=RADIUS + 0.008,
        minor_radius=0.014,
        major_segments=28,
        minor_segments=10,
        location=(0, 0, 0),
    )
    strap = bpy.context.active_object
    strap.name = f"FuelTankStrap_{i}"
    assign(strap, mat_strap)
    shade_smooth(strap)
    attach(strap, root, (0, sy, 0), (radians(90), 0, 0))
    strap.scale = (1.0, 0.55, 1.0)

# Hanger pads
for i, sy in enumerate(strap_ys):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
    pad = bpy.context.active_object
    pad.name = f"FuelTankHanger_{i}"
    pad.scale = (0.10, 0.045, 0.035)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel_all(pad, offset=0.008, segments=2)
    assign(pad, mat_steel)
    shade_smooth(pad)
    attach(pad, root, (0, sy, RADIUS + 0.01))

# Filler neck + cap
bpy.ops.mesh.primitive_cylinder_add(
    vertices=16, radius=0.028, depth=0.055, location=(0, 0, 0)
)
neck = bpy.context.active_object
neck.name = "FuelTankFillerNeck"
assign(neck, mat_steel)
shade_smooth(neck)
attach(neck, root, (-RADIUS * 0.35, 0.12, RADIUS * 0.55))

bpy.ops.mesh.primitive_cylinder_add(
    vertices=16, radius=0.034, depth=0.018, location=(0, 0, 0)
)
filler = bpy.context.active_object
filler.name = "FuelTankFillerCap"
assign(filler, mat_strap)
shade_smooth(filler)
bevel_all(filler, offset=0.004, segments=2)
attach(filler, root, (-RADIUS * 0.35, 0.12, RADIUS * 0.55 + 0.032))

# Apply scale on caps/straps so export is clean (keep as visual for now)
bpy.context.view_layer.update()

parts = [o for o in bpy.data.objects if o.name.startswith("FuelTank") and o.type == "MESH"]
xs, ys, zs = [], [], []
for o in parts:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        xs.append(w.x)
        ys.append(w.y)
        zs.append(w.z)

print(
    {
        "parts": sorted(o.name for o in parts),
        "world_bounds": {
            "xmin": round(min(xs), 4),
            "xmax": round(max(xs), 4),
            "ymin": round(min(ys), 4),
            "ymax": round(max(ys), 4),
            "zmin": round(min(zs), 4),
            "zmax": round(max(zs), 4),
        },
        "hatch_y": [-0.105, 0.72],
        "chassis_zmin": 0.39,
        "root_loc": [round(v, 4) for v in root.location],
    }
)
