import bpy
from mathutils import Vector

HATCH_ZMAX = 1.807
Z_BOTTOM = 0.532  # container floor / frame sit on chassis

root = bpy.data.objects["ContainerRoot"]
parts = [o for o in root.children if o.type == "MESH"]

# Current top across all parts
zmax = max(
    (o.matrix_world @ Vector(c)).z
    for o in parts
    for c in o.bound_box
)
scale = (HATCH_ZMAX - Z_BOTTOM) / (zmax - Z_BOTTOM)

for obj in parts:
    mesh = obj.data
    mw = obj.matrix_world
    imw = mw.inverted()
    for v in mesh.vertices:
        w = mw @ v.co
        w.z = Z_BOTTOM + (w.z - Z_BOTTOM) * scale
        v.co = imw @ w
    mesh.update()

bpy.context.view_layer.update()

zmin = min((o.matrix_world @ Vector(c)).z for o in parts for c in o.bound_box)
zmax2 = max((o.matrix_world @ Vector(c)).z for o in parts for c in o.bound_box)
roof = bpy.data.objects.get("ContainerGlassRoof")
roof_z = None
if roof:
    roof_z = (roof.matrix_world @ Vector(roof.bound_box[0])).z

print(
    {
        "scale": round(scale, 5),
        "before_zmax": round(zmax, 4),
        "after_zmin": round(zmin, 4),
        "after_zmax": round(zmax2, 4),
        "hatch_zmax": HATCH_ZMAX,
        "roof_z": round(roof_z, 4) if roof_z is not None else None,
    }
)
