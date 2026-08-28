"""Build the Galactic Garbage Co. concept truck from the orthographic drawings.

Blender coords: +Z up, nose toward -Y, +X right. Wheels sit on Z=0.
"""
from __future__ import annotations

import math
import random
from math import pi, radians
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

DECAL_DIR = Path("/Users/brianscramlin/LocalWebDev/space-janitor/blender/reference/decals")
BLEND_PATH = "/Users/brianscramlin/LocalWebDev/space-janitor/blender/garbage-truck-concept.blend"
RNG = random.Random(12)

# --- proportions from the ortho sheet (metres) ---
WHEEL_R = 0.36
WHEEL_W = 0.24
TRACK = 1.62
FRONT_AXLE_Y = -0.72
REAR_AXLE_Y = 1.58

CAB_W, CAB_H, CAB_D = 1.48, 1.28, 1.22
CAB_Y = -0.42
CAB_Z = 0.52 + CAB_H * 0.5

HOP_W, HOP_H, HOP_D = 1.72, 1.42, 2.22
HOP_Y = 1.62
HOP_Z = 0.58 + HOP_H * 0.5

DISH_R = 0.72
DISH_DEPTH = 0.28
DISH_Y = -1.72
DISH_Z = 0.78


def mat(name: str) -> bpy.types.Material:
    m = bpy.data.materials.get(name)
    if m is None:
        raise KeyError(name)
    return m


def new_mat(name: str, color, metallic=0.4, roughness=0.5, alpha=1.0, emit=0.0, emit_color=None):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (-280, 0)
    out.location = (40, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    col = (*color, 1.0 if len(color) == 3 else color[3])
    bsdf.inputs["Base Color"].default_value = col
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Alpha"].default_value = alpha
    if emit > 0:
        bsdf.inputs["Emission Color"].default_value = (*(emit_color or color), 1)
        bsdf.inputs["Emission Strength"].default_value = emit
    if alpha < 1:
        m.blend_method = "HASHED"
        try:
            m.surface_render_method = "DITHERED"
        except Exception:
            pass
    return m


def image_mat(name: str, path: Path, metallic=0.05, roughness=0.7):
    m = bpy.data.materials.get(name)
    if m is None:
        m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage")
    img = bpy.data.images.load(str(path), check_existing=True)
    tex.image = img
    bsdf.location = (-200, 0)
    tex.location = (-500, 0)
    out.location = (80, 0)
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def link(obj: bpy.types.Object):
    if obj.name not in bpy.context.collection.objects:
        bpy.context.collection.objects.link(obj)
    return obj


def shade_smooth(obj: bpy.types.Object):
    if obj.type != "MESH":
        return
    mesh = obj.data
    mesh.polygons.foreach_set("use_smooth", [True] * len(mesh.polygons))


def set_mat(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def transform(obj, loc=None, rot=None, scale=None):
    if loc is not None:
        obj.location = loc
    if rot is not None:
        obj.rotation_euler = rot
    if scale is not None:
        obj.scale = scale
    return obj


def box_uv_bmesh(bm):
    """Axis-projected UVs so textured materials export a TEXCOORD_0 set."""
    bm.faces.ensure_lookup_table()
    bm.normal_update()
    uv = bm.loops.layers.uv.new("UVMap") if not bm.loops.layers.uv else bm.loops.layers.uv.active
    for face in bm.faces:
        n = face.normal
        ax = abs(n.x), abs(n.y), abs(n.z)
        for loop in face.loops:
            v = loop.vert.co
            if ax[0] >= ax[1] and ax[0] >= ax[2]:
                loop[uv].uv = (v.y, v.z)
            elif ax[1] >= ax[0] and ax[1] >= ax[2]:
                loop[uv].uv = (v.x, v.z)
            else:
                loop[uv].uv = (v.x, v.y)


def ensure_mesh_uvs(obj: bpy.types.Object):
    if obj.type != "MESH" or obj.data.uv_layers:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    box_uv_bmesh(bm)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def from_bmesh(name, bm, material, loc=(0, 0, 0), rot=(0, 0, 0)):
    box_uv_bmesh(bm)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    transform(obj, loc, rot)
    link(obj)
    set_mat(obj, material)
    shade_smooth(obj)
    return obj


def cube(name, size, loc, material, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    obj = from_bmesh(name, bm, material, loc, rot)
    sx, sy, sz = size if isinstance(size, (list, tuple)) else (size, size, size)
    obj.scale = (sx, sy, sz)
    return obj


def cylinder(name, radius, depth, loc, material, rot=(0, 0, 0), segs=16, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=cap,
        cap_tris=False,
        segments=segs,
        radius1=radius,
        radius2=radius,
        depth=depth,
    )
    return from_bmesh(name, bm, material, loc, rot)


def cone(name, r1, r2, depth, loc, material, rot=(0, 0, 0), segs=24, cap=True):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm,
        cap_ends=cap,
        cap_tris=False,
        segments=segs,
        radius1=r1,
        radius2=r2,
        depth=depth,
    )
    return from_bmesh(name, bm, material, loc, rot)


def uv_sphere(name, radius, loc, material, rot=(0, 0, 0), segs=16, rings=8):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=radius)
    return from_bmesh(name, bm, material, loc, rot)


def ico(name, radius, loc, material, subdiv=1):
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=radius)
    return from_bmesh(name, bm, material, loc)


def torus(name, major, minor, loc, material, rot=(0, 0, 0), major_segs=20, minor_segs=8):
    bm = bmesh.new()
    rings = []
    for i in range(major_segs):
        theta = 2 * pi * i / major_segs
        ring = []
        cx = math.cos(theta) * major
        cy = math.sin(theta) * major
        for j in range(minor_segs):
            phi = 2 * pi * j / minor_segs
            x = cx + math.cos(theta) * math.cos(phi) * minor
            y = cy + math.sin(theta) * math.cos(phi) * minor
            z = math.sin(phi) * minor
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)
    bm.verts.ensure_lookup_table()
    for i in range(major_segs):
        i2 = (i + 1) % major_segs
        for j in range(minor_segs):
            j2 = (j + 1) % minor_segs
            bm.faces.new((rings[i][j], rings[i2][j], rings[i2][j2], rings[i][j2]))
    return from_bmesh(name, bm, material, loc, rot)


def plane(name, sx, sy, loc, material, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    obj = from_bmesh(name, bm, material, loc, rot)
    obj.scale = (sx, sy, 1)
    return obj


def side_decal(name, height, length, loc, material, left=True):
    """Image plane facing outward on a truck side. Default grid faces +Z."""
    rot = (0, radians(-90 if left else 90), 0)
    return plane(name, height, length, loc, material, rot=rot)


def apply_scale(obj):
    from mathutils import Matrix

    sx, sy, sz = obj.scale
    if abs(sx - 1) + abs(sy - 1) + abs(sz - 1) < 1e-6:
        return
    obj.data.transform(Matrix.Diagonal((sx, sy, sz, 1.0)))
    obj.scale = (1.0, 1.0, 1.0)


def pipe_curve(name, points, radius, material, cyclic=False, res=6, bevel_res=2):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = radius
    curve.bevel_resolution = bevel_res
    curve.fill_mode = "FULL"
    sp = curve.splines.new("POLY")
    sp.use_cyclic_u = cyclic
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (*p, 1.0)
    tmp = bpy.data.objects.new(name + "_curve", curve)
    link(tmp)
    bpy.context.view_layer.update()
    depsgraph = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(tmp.evaluated_get(depsgraph))
    obj = bpy.data.objects.new(name, mesh)
    link(obj)
    bpy.data.objects.remove(tmp, do_unlink=True)
    bpy.data.curves.remove(curve)
    set_mat(obj, material)
    shade_smooth(obj)
    return obj


def ribbed_hose(name, points, radius, material, ring_mat=None, ring_step=0.12):
    hose = pipe_curve(name, points, radius, material, res=5, bevel_res=1)
    ring_mat = ring_mat or material
    # Place clamp rings along the polyline
    total = 0.0
    segs = []
    for a, b in zip(points, points[1:]):
        va, vb = Vector(a), Vector(b)
        d = (vb - va).length
        segs.append((va, vb, d))
        total += d
    t = ring_step * 0.5
    idx = 0
    while t < total - 0.02:
        acc = 0.0
        for va, vb, d in segs:
            if acc + d >= t:
                u = 0 if d == 0 else (t - acc) / d
                p = va.lerp(vb, u)
                direction = (vb - va).normalized() if d > 0 else Vector((0, 0, 1))
                ring = torus(f"{name}_Ring{idx}", radius + 0.012, 0.014, p, ring_mat, major_segs=12, minor_segs=6)
                # align torus so its axis follows the hose (torus is in XY by default, axis Z)
                quat = Vector((0, 0, 1)).rotation_difference(direction)
                ring.rotation_euler = quat.to_euler()
                idx += 1
                break
            acc += d
        t += ring_step
    return hose


def parent_all(root, objects):
    for o in objects:
        if o == root or o.parent:
            continue
        o.parent = root


def ensure_preview():
    cam = bpy.data.objects.get("PreviewCam")
    if cam is None:
        data = bpy.data.cameras.new("PreviewCam")
        data.lens = 50
        cam = bpy.data.objects.new("PreviewCam", data)
        link(cam)
    cam.location = (4.6, -6.4, 3.1)
    cam.rotation_euler = (radians(68), 0, radians(18))
    bpy.context.scene.camera = cam

    def light(name, type_, loc, energy, size=0.4, color=(1, 0.95, 0.88)):
        obj = bpy.data.objects.get(name)
        if obj is None:
            data = bpy.data.lights.new(name, type_)
            obj = bpy.data.objects.new(name, data)
            link(obj)
        obj.location = loc
        obj.data.energy = energy
        obj.data.color = color
        if hasattr(obj.data, "shadow_soft_size"):
            obj.data.shadow_soft_size = size
        return obj

    sun = light("PreviewSun", "SUN", (5, -4, 8), 4.5, color=(1, 0.97, 0.9))
    sun.rotation_euler = (radians(40), radians(15), radians(35))
    light("PreviewFill", "AREA", (-4, -2, 4.2), 250, size=2.5, color=(0.7, 0.82, 1))
    light("PreviewRim", "AREA", (1.5, 5, 3.2), 180, size=2.0, color=(1, 0.85, 0.7))


def setup_file():
    # Snapshot the old truck to disk, then fork this session into a new file.
    fp = bpy.data.filepath or ""
    if fp.endswith("garbage-truck.blend") and not fp.endswith("garbage-truck-concept.blend"):
        bpy.ops.wm.save_mainfile()
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    elif fp != BLEND_PATH:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    world = bpy.context.scene.world
    if world and world.use_nodes:
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.18, 0.19, 0.21, 1)
            bg.inputs[1].default_value = 0.6


def extra_materials():
    glass = new_mat("HopperGlass", (0.22, 0.28, 0.32), metallic=0.05, roughness=0.12, alpha=0.22)
    glass.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.9
    cab_glass = new_mat("CabGlass", (0.12, 0.16, 0.2), metallic=0.1, roughness=0.08, alpha=0.72)
    cab_glass.node_tree.nodes["Principled BSDF"].inputs["Transmission Weight"].default_value = 0.35
    new_mat("DarkSteel", (0.08, 0.085, 0.09), metallic=0.85, roughness=0.38)
    new_mat("BoltSteel", (0.35, 0.36, 0.38), metallic=0.9, roughness=0.28)
    new_mat("RubberHose", (0.12, 0.1, 0.09), metallic=0.0, roughness=0.72)
    new_mat("LampEmit", (1.0, 0.92, 0.7), metallic=0.0, roughness=0.2, emit=6.0)
    new_mat("ScreenEmit", (0.35, 0.85, 0.45), metallic=0.0, roughness=0.25, emit=4.0, emit_color=(0.2, 1.0, 0.35))
    new_mat("JunkRust", (0.38, 0.2, 0.1), metallic=0.55, roughness=0.55)
    new_mat("JunkBlue", (0.18, 0.28, 0.45), metallic=0.4, roughness=0.4)
    new_mat("JunkCream", (0.72, 0.68, 0.55), metallic=0.15, roughness=0.55)
    new_mat("TireTread", (0.04, 0.04, 0.04), metallic=0.0, roughness=0.85)
    new_mat("RimSteel", (0.55, 0.56, 0.58), metallic=0.85, roughness=0.32)
    image_mat("DecalDoor", DECAL_DIR / "door.png")
    image_mat("DecalHonk", DECAL_DIR / "honk.png")
    image_mat("DecalCompactor", DECAL_DIR / "compactor.png")
    image_mat("DecalCompany", DECAL_DIR / "company.png")


def build_chassis(M):
    objs = []
    chassis = cube("Chassis", (1.28, 4.15, 0.22), (0, 0.35, 0.42), M["steel"])
    objs.append(chassis)
    # ladder rails
    for x in (-0.48, 0.48):
        objs.append(cube(f"FrameRail_{x}", (0.1, 4.35, 0.12), (x, 0.32, 0.28), M["dark"]))
    for y in (-1.35, -0.35, 0.55, 1.45, 2.25):
        objs.append(cube(f"Cross_{y}", (1.05, 0.08, 0.1), (0, y, 0.28), M["dark"]))
    # bumper / dish mount
    objs.append(cube("FrontBumper", (1.35, 0.22, 0.18), (0, -1.55, 0.38), M["steel"]))
    objs.append(cube("DishArm", (0.18, 0.85, 0.14), (0, -1.78, 0.55), M["steel"], rot=(radians(-18), 0, 0)))
    objs.append(cube("DishArmBraceL", (0.08, 0.7, 0.08), (-0.28, -1.7, 0.48), M["dark"], rot=(radians(-22), 0, radians(8))))
    objs.append(cube("DishArmBraceR", (0.08, 0.7, 0.08), (0.28, -1.7, 0.48), M["dark"], rot=(radians(-22), 0, radians(-8))))
    # rear bumper
    objs.append(cube("RearBumper", (1.5, 0.16, 0.14), (0, 2.72, 0.32), M["steel"]))
    # side tank (left, between axles)
    objs.append(cylinder("SideTank", 0.22, 1.15, (-0.78, 0.45, 0.42), M["steel"], rot=(radians(90), 0, 0), segs=18))
    objs.append(cylinder("SideTankStrapF", 0.235, 0.06, (-0.78, 0.05, 0.42), M["dark"], rot=(radians(90), 0, 0)))
    objs.append(cylinder("SideTankStrapR", 0.235, 0.06, (-0.78, 0.85, 0.42), M["dark"], rot=(radians(90), 0, 0)))
    # mufflers
    objs.append(cylinder("MufflerL", 0.09, 0.7, (-0.32, 0.55, 0.18), M["dark"], rot=(radians(90), 0, 0)))
    objs.append(cylinder("MufflerR", 0.09, 0.7, (0.32, 0.9, 0.18), M["dark"], rot=(radians(90), 0, 0)))
    objs.append(pipe_curve("ExhaustL", [(-0.32, 0.2, 0.18), (-0.32, -0.4, 0.16), (-0.22, -1.1, 0.14)], 0.035, M["dark"]))
    objs.append(pipe_curve("ExhaustR", [(0.32, 1.25, 0.18), (0.4, 1.9, 0.16), (0.42, 2.55, 0.2)], 0.035, M["dark"]))
    # engine / trans
    objs.append(cube("EngineBlock", (0.7, 0.85, 0.42), (0, -0.95, 0.55), M["dark"]))
    objs.append(cube("TransferCase", (0.32, 0.4, 0.22), (0, 0.15, 0.22), M["steel"]))
    objs.append(cylinder("DriveShaft", 0.045, 2.15, (0, 0.45, 0.2), M["bolt"], rot=(radians(90), 0, 0), segs=10))
    # axles
    for name, y in (("AxleF", FRONT_AXLE_Y), ("AxleR", REAR_AXLE_Y)):
        objs.append(cylinder(name, 0.055, TRACK - 0.1, (0, y, WHEEL_R), M["dark"], rot=(0, radians(90), 0), segs=10))
        objs.append(uv_sphere(f"{name}_Diff", 0.12, (0, y, WHEEL_R), M["steel"], segs=12, rings=6))
    return objs


def build_wheels(M):
    objs = []
    for side, x in (("L", -TRACK / 2), ("R", TRACK / 2)):
        for axle, y in (("F", FRONT_AXLE_Y), ("R", REAR_AXLE_Y)):
            tag = f"{axle}{side}"
            tire = cylinder(f"Tire{tag}", WHEEL_R, WHEEL_W, (x, y, WHEEL_R), M["tire"], rot=(0, radians(90), 0), segs=22)
            rim = cylinder(f"Rim{tag}", WHEEL_R * 0.58, WHEEL_W * 0.55, (x, y, WHEEL_R), M["rim"], rot=(0, radians(90), 0), segs=16)
            hub = cylinder(f"Hub{tag}", 0.1, WHEEL_W * 0.7, (x, y, WHEEL_R), M["bolt"], rot=(0, radians(90), 0), segs=10)
            # hub cap dish
            cap_x = x + (0.11 if x > 0 else -0.11)
            cap = cylinder(f"HubCap{tag}", 0.13, 0.04, (cap_x, y, WHEEL_R), M["rim"], rot=(0, radians(90), 0), segs=12)
            # fender
            fy = y
            fender = cube(f"Fender{tag}", (0.28, 0.7, 0.08), (x + (0.08 if x > 0 else -0.08), fy, WHEEL_R + 0.34), M["body"])
            objs += [tire, rim, hub, cap, fender]
    return objs


def build_cab(M):
    objs = []
    cab = cube("Cab", (CAB_W, CAB_D, CAB_H), (0, CAB_Y, CAB_Z), M["body"])
    objs.append(cab)
    # roof slab
    objs.append(cube("CabRoof", (CAB_W + 0.06, CAB_D + 0.04, 0.08), (0, CAB_Y, CAB_Z + CAB_H / 2 + 0.02), M["body"]))
    # windshield frame + glass
    objs.append(cube("WindshieldFrame", (CAB_W * 0.92, 0.06, 0.52), (0, CAB_Y - CAB_D / 2 + 0.02, CAB_Z + 0.22), M["dark"]))
    glass = cube("Windshield", (CAB_W * 0.84, 0.03, 0.42), (0, CAB_Y - CAB_D / 2 - 0.01, CAB_Z + 0.24), M["cab_glass"])
    objs.append(glass)
    # split pillar
    objs.append(cube("WindshieldMullion", (0.05, 0.05, 0.46), (0, CAB_Y - CAB_D / 2 - 0.005, CAB_Z + 0.24), M["dark"]))
    # side windows
    for side, x in (("L", -CAB_W / 2 - 0.01), ("R", CAB_W / 2 + 0.01)):
        objs.append(cube(f"SideWindow{side}", (0.03, 0.42, 0.32), (x, CAB_Y - 0.08, CAB_Z + 0.22), M["cab_glass"]))
        objs.append(cube(f"DoorPanel{side}", (0.04, 0.7, 0.7), (x, CAB_Y - 0.05, CAB_Z - 0.12), M["white"]))
    # door decal (left)
    objs.append(side_decal("DoorDecal", 0.16, 0.55, (-CAB_W / 2 - 0.035, CAB_Y - 0.05, CAB_Z - 0.02), M["decal_door"], left=True))
    # interior seats
    objs.append(cube("SeatL", (0.32, 0.32, 0.28), (-0.32, CAB_Y - 0.1, CAB_Z - 0.35), M["dark"]))
    objs.append(cube("SeatR", (0.32, 0.32, 0.28), (0.32, CAB_Y - 0.1, CAB_Z - 0.35), M["dark"]))
    # headlights under frame
    for side, x in (("L", -0.42), ("R", 0.42)):
        lamp = cylinder(f"Headlamp{side}", 0.07, 0.06, (x, CAB_Y - CAB_D / 2 - 0.08, 0.55), M["lamp"], rot=(radians(90), 0, 0), segs=12)
        bezel = cylinder(f"HeadlampBezel{side}", 0.085, 0.03, (x, CAB_Y - CAB_D / 2 - 0.05, 0.55), M["dark"], rot=(radians(90), 0, 0), segs=12)
        objs += [lamp, bezel]
    # searchlight on front pillar
    objs.append(cylinder("SearchStem", 0.03, 0.28, (-0.55, CAB_Y - 0.52, CAB_Z + 0.55), M["dark"], segs=8))
    objs.append(cylinder("SearchLamp", 0.11, 0.14, (-0.55, CAB_Y - 0.62, CAB_Z + 0.72), M["lamp"], rot=(radians(75), 0, 0), segs=14))
    objs.append(cone("SearchHood", 0.13, 0.08, 0.08, (-0.55, CAB_Y - 0.7, CAB_Z + 0.76), M["dark"], rot=(radians(75), 0, 0), segs=14, cap=False))
    # light bar above windshield
    objs.append(cube("LightBar", (0.7, 0.08, 0.06), (0, CAB_Y - CAB_D / 2 + 0.08, CAB_Z + CAB_H / 2 + 0.02), M["dark"]))
    for i, x in enumerate((-0.22, 0, 0.22)):
        objs.append(cube(f"LightBarLens_{i}", (0.14, 0.04, 0.04), (x, CAB_Y - CAB_D / 2 + 0.04, CAB_Z + CAB_H / 2 + 0.02), M["lamp"]))
    return objs


def build_front_dish(M):
    objs = []
    # Open shallow dish: wide rim at the nose (-Y), hub toward the cab.
    objs.append(
        cone(
            "FrontDish",
            DISH_R,
            0.16,
            DISH_DEPTH,
            (0, DISH_Y, DISH_Z),
            M["white"],
            rot=(radians(-90), 0, 0),
            segs=36,
            cap=False,
        )
    )
    objs.append(
        cone(
            "FrontDishBack",
            0.22,
            0.16,
            0.06,
            (0, DISH_Y + DISH_DEPTH * 0.42, DISH_Z),
            M["steel"],
            rot=(radians(-90), 0, 0),
            segs=20,
            cap=True,
        )
    )
    objs.append(
        cylinder(
            "FrontDishHub",
            0.18,
            0.1,
            (0, DISH_Y - DISH_DEPTH * 0.05, DISH_Z),
            M["steel"],
            rot=(radians(90), 0, 0),
            segs=16,
        )
    )
    for i, t in enumerate((0.22, 0.48, 0.72)):
        r = 0.16 + (DISH_R - 0.16) * t
        y = DISH_Y - DISH_DEPTH * 0.5 + DISH_DEPTH * t
        objs.append(
            torus(
                f"FrontDishRing_{i}",
                r,
                0.018,
                (0, y, DISH_Z),
                M["dark"],
                rot=(radians(90), 0, 0),
                major_segs=28,
                minor_segs=6,
            )
        )
    for i in range(8):
        ang = i * (pi / 4)
        x = math.cos(ang) * 0.38
        zoff = math.sin(ang) * 0.38
        objs.append(
            cube(
                f"FrontDishRib_{i}",
                (0.025, 0.28, 0.025),
                (x, DISH_Y + 0.02, DISH_Z + zoff),
                M["dark"],
                rot=(radians(-8), 0, ang),
            )
        )
    objs.append(
        cylinder(
            "DishCollar",
            0.26,
            0.14,
            (0, DISH_Y + 0.38, DISH_Z),
            M["steel"],
            rot=(radians(90), 0, 0),
            segs=16,
        )
    )
    objs.append(cube("DishMountPlate", (0.72, 0.1, 0.5), (0, DISH_Y + 0.5, DISH_Z - 0.08), M["body"]))
    return objs


def build_hopper(M):
    """Open bin with a frame and skirt so packed junk stays visible."""
    objs = []
    floor_z = 0.7
    objs.append(cube("HopperFloor", (HOP_W * 0.96, HOP_D * 0.92, 0.1), (0, HOP_Y, floor_z), M["hopper"]))
    objs.append(cube("HopperBase", (HOP_W + 0.06, HOP_D * 0.96, 0.26), (0, HOP_Y, 0.52), M["hopper"]))
    # half-height bin walls so it reads as a dumpster, junk still piles over the rim
    wall_h = 0.58
    wall_z = 0.7 + wall_h * 0.5
    for side, x in (("L", -HOP_W / 2 + 0.03), ("R", HOP_W / 2 - 0.03)):
        objs.append(cube(f"HopperWall{side}", (0.05, HOP_D * 0.86, wall_h), (x, HOP_Y - 0.04, wall_z), M["hopper"]))
    objs.append(cube("HopperWallF", (HOP_W * 0.9, 0.05, wall_h * 0.85), (0, HOP_Y - HOP_D / 2 + 0.1, wall_z), M["hopper"]))
    post_h = HOP_H * 0.95
    post_z = floor_z + post_h * 0.5
    corners = [
        ("FL", -HOP_W / 2 + 0.05, HOP_Y - HOP_D / 2 + 0.08),
        ("FR", HOP_W / 2 - 0.05, HOP_Y - HOP_D / 2 + 0.08),
        ("RL", -HOP_W / 2 + 0.16, HOP_Y + HOP_D / 2 - 0.22),
        ("RR", HOP_W / 2 - 0.16, HOP_Y + HOP_D / 2 - 0.22),
    ]
    for tag, x, y in corners:
        objs.append(cube(f"HopperPost{tag}", (0.08, 0.08, post_h), (x, y, post_z), M["steel"]))
    top_z = floor_z + post_h
    objs.append(cube("HopperRimF", (HOP_W * 0.98, 0.07, 0.07), (0, HOP_Y - HOP_D / 2 + 0.08, top_z), M["steel"]))
    objs.append(cube("HopperRimB", (HOP_W * 0.72, 0.07, 0.07), (0, HOP_Y + HOP_D / 2 - 0.22, top_z - 0.22), M["steel"]))
    for side, x in (("L", -HOP_W / 2 + 0.05), ("R", HOP_W / 2 - 0.05)):
        objs.append(cube(f"HopperRim{side}", (0.07, HOP_D * 0.88, 0.07), (x, HOP_Y - 0.04, top_z), M["steel"]))
    for side, x in (("L", -HOP_W / 2 + 0.02), ("R", HOP_W / 2 - 0.02)):
        objs.append(
            cube(
                f"HopperGlass{side}",
                (0.012, HOP_D * 0.72, HOP_H * 0.62),
                (x, HOP_Y - 0.04, floor_z + HOP_H * 0.38),
                M["glass"],
            )
        )
    objs.append(
        cube(
            "HopperRearL",
            (0.7, 0.06, HOP_H * 0.7),
            (-0.38, HOP_Y + HOP_D / 2 - 0.18, floor_z + HOP_H * 0.28),
            M["hopper"],
            rot=(radians(18), 0, radians(12)),
        )
    )
    objs.append(
        cube(
            "HopperRearR",
            (0.7, 0.06, HOP_H * 0.7),
            (0.38, HOP_Y + HOP_D / 2 - 0.18, floor_z + HOP_H * 0.28),
            M["hopper"],
            rot=(radians(18), 0, radians(-12)),
        )
    )
    objs.append(side_decal("CompanyDecal", 0.16, 1.5, (-HOP_W / 2 - 0.045, HOP_Y + 0.1, 0.54), M["decal_company"], left=True))
    for i, x in enumerate((-0.28, 0.28)):
        objs.append(
            cylinder(
                f"RearPort_{i}",
                0.07,
                0.08,
                (x, HOP_Y + HOP_D / 2 - 0.08, 0.7),
                M["dark"],
                rot=(radians(90), 0, 0),
                segs=10,
            )
        )
    return objs


def build_junk(M):
    objs = []
    mats = [M["junk_rust"], M["junk_blue"], M["junk_cream"], M["steel"], M["dark"], M["white"], M["bolt"]]
    # fill hopper interior
    xmin, xmax = -0.68, 0.68
    ymin, ymax = HOP_Y - 0.88, HOP_Y + 0.88
    zmin, zmax = 0.82, 1.88
    n = 0
    for i in range(64):
        kind = RNG.choice(("box", "box", "cyl", "cyl", "ico"))
        loc = (
            RNG.uniform(xmin, xmax),
            RNG.uniform(ymin, ymax),
            RNG.uniform(zmin, zmax),
        )
        mm = RNG.choice(mats)
        rot = (radians(RNG.uniform(-30, 30)), radians(RNG.uniform(-40, 40)), radians(RNG.uniform(0, 180)))
        if kind == "box":
            s = (RNG.uniform(0.12, 0.38), RNG.uniform(0.1, 0.32), RNG.uniform(0.08, 0.28))
            objs.append(cube(f"JunkBox_{i}", s, loc, mm, rot))
        elif kind == "cyl":
            objs.append(cylinder(f"JunkCyl_{i}", RNG.uniform(0.05, 0.12), RNG.uniform(0.15, 0.4), loc, mm, rot, segs=10))
        else:
            objs.append(ico(f"JunkIco_{i}", RNG.uniform(0.07, 0.14), loc, mm, subdiv=1))
        n += 1
    # a few larger hero pieces
    objs.append(cube("JunkCrate", (0.42, 0.32, 0.28), (-0.25, HOP_Y - 0.2, 1.05), M["junk_cream"], rot=(0, 0, radians(18))))
    objs.append(cylinder("JunkDrum", 0.16, 0.38, (0.28, HOP_Y + 0.35, 1.0), M["junk_rust"], segs=12))
    objs.append(torus("JunkTire", 0.16, 0.04, (0.05, HOP_Y + 0.55, 1.35), M["tire"], rot=(radians(70), 0, radians(20)), major_segs=14, minor_segs=6))
    return objs


def build_roof(M):
    objs = []
    z_roof = CAB_Z + CAB_H / 2 + 0.06
    # hatches / boxes
    objs.append(cube("RoofBoxA", (0.38, 0.32, 0.16), (-0.15, CAB_Y + 0.15, z_roof + 0.08), M["dark"]))
    objs.append(cube("RoofBoxB", (0.22, 0.28, 0.12), (0.42, CAB_Y - 0.15, z_roof + 0.06), M["steel"]))
    objs.append(cube("RoofScreenBody", (0.28, 0.08, 0.16), (0.12, CAB_Y - 0.48, z_roof + 0.12), M["dark"]))
    objs.append(plane("RoofScreen", 0.12, 0.07, (0.12, CAB_Y - 0.525, z_roof + 0.12), M["screen"], rot=(radians(80), 0, 0)))
    # dishes
    def sat(tag, loc, r, tilt, yaw):
        stem = cylinder(f"{tag}_Stem", 0.035, 0.28, (loc[0], loc[1], loc[2] - 0.08), M["dark"], segs=8)
        joint = uv_sphere(f"{tag}_Joint", 0.05, loc, M["bolt"], segs=10, rings=6)
        dish = cone(f"{tag}", r, 0.04, 0.12, (loc[0], loc[1], loc[2] + 0.12), M["white"], rot=(radians(tilt), 0, radians(yaw)), segs=20, cap=True)
        feed = cylinder(f"{tag}_Feed", 0.012, 0.14, (loc[0], loc[1], loc[2] + 0.18), M["dark"], rot=(radians(tilt - 8), 0, radians(yaw)), segs=6)
        rim = torus(f"{tag}_Rim", r * 0.95, 0.012, (loc[0], loc[1], loc[2] + 0.12), M["dark"], rot=(radians(tilt), 0, radians(yaw)), major_segs=18, minor_segs=5)
        return [stem, joint, dish, feed, rim]

    objs += sat("DishL", (-0.42, CAB_Y - 0.05, z_roof + 0.28), 0.28, 55, -25)
    objs += sat("DishR", (0.38, CAB_Y + 0.22, z_roof + 0.32), 0.34, 48, 30)
    # whip antennas
    for i, (x, y, lean) in enumerate(((-0.55, CAB_Y + 0.35, 12), (0.15, CAB_Y + 0.4, -8), (0.55, CAB_Y + 0.1, 18))):
        objs.append(cylinder(f"Antenna_{i}", 0.012, 0.55, (x, y, z_roof + 0.32), M["dark"], rot=(radians(lean), 0, radians(i * 20)), segs=6))
        objs.append(uv_sphere(f"AntennaTip_{i}", 0.02, (x, y, z_roof + 0.58), M["bolt"], segs=8, rings=4))
    return objs


def build_side_greebles(M):
    objs = []
    # signs on left mid panel
    objs.append(cube("SignPanelTop", (0.04, 0.72, 0.22), (-0.78, 0.42, 1.42), M["white"]))
    objs.append(side_decal("HonkDecal", 0.1, 0.55, (-0.81, 0.42, 1.42), M["decal_honk"], left=True))
    objs.append(cube("SignPanelBot", (0.04, 0.78, 0.28), (-0.78, 0.48, 1.08), M["white"]))
    objs.append(side_decal("CompactorDecal", 0.11, 0.58, (-0.81, 0.48, 1.08), M["decal_compactor"], left=True))
    # mid body mechanical stack
    objs.append(cube("MidStack", (1.52, 0.85, 1.15), (0, 0.45, 1.05), M["body"]))
    objs.append(cube("CompactorHousing", (1.2, 0.55, 0.7), (0, 0.85, 0.95), M["dark"]))
    # right side lockers
    objs.append(cube("LockerR", (0.18, 0.7, 0.55), (0.86, 0.55, 0.95), M["steel"]))
    for i in range(4):
        objs.append(cube(f"LockerRivet_{i}", (0.03, 0.03, 0.03), (0.96, 0.3 + i * 0.16, 1.15), M["bolt"]))
    # small greeble boxes
    for i, (loc, s) in enumerate((
        ((0.82, -0.15, 0.85), (0.16, 0.22, 0.18)),
        ((-0.82, 0.05, 0.72), (0.14, 0.28, 0.16)),
        ((0.7, 1.15, 1.35), (0.2, 0.18, 0.14)),
        ((-0.7, 1.05, 1.55), (0.12, 0.2, 0.1)),
        ((0.55, -0.85, 0.7), (0.14, 0.12, 0.12)),
    )):
        objs.append(cube(f"Greeble_{i}", s, loc, M["dark"] if i % 2 else M["steel"]))
    # bolts along cab lower
    for i in range(6):
        y = CAB_Y - 0.4 + i * 0.16
        objs.append(cylinder(f"CabBoltL_{i}", 0.018, 0.03, (-CAB_W / 2 - 0.02, y, 0.7), M["bolt"], rot=(0, radians(90), 0), segs=6))
        objs.append(cylinder(f"CabBoltR_{i}", 0.018, 0.03, (CAB_W / 2 + 0.02, y, 0.7), M["bolt"], rot=(0, radians(90), 0), segs=6))
    return objs


def build_pipes(M):
    objs = []
    hose = M["hose"]
    dark = M["dark"]
    # big corrugated loop: roof -> down behind door -> under truck (left)
    objs.append(
        ribbed_hose(
            "HoseMainL",
            [
                (-0.35, CAB_Y + 0.2, 1.95),
                (-0.72, CAB_Y + 0.15, 1.85),
                (-0.78, 0.15, 1.55),
                (-0.82, 0.25, 0.85),
                (-0.78, 0.35, 0.35),
                (-0.4, 0.45, 0.22),
            ],
            0.07,
            hose,
            ring_mat=dark,
            ring_step=0.11,
        )
    )
    # matching but offset right bundle
    objs.append(
        ribbed_hose(
            "HoseMainR",
            [
                (0.4, CAB_Y + 0.05, 1.92),
                (0.75, CAB_Y, 1.7),
                (0.82, 0.35, 1.35),
                (0.8, 0.55, 0.7),
                (0.55, 0.7, 0.28),
            ],
            0.055,
            hose,
            ring_mat=dark,
            ring_step=0.12,
        )
    )
    # vertical cab wraps (front corners)
    objs.append(
        ribbed_hose(
            "HoseCabL",
            [
                (-0.62, CAB_Y - 0.55, 1.85),
                (-0.7, CAB_Y - 0.62, 1.35),
                (-0.72, CAB_Y - 0.55, 0.75),
                (-0.65, CAB_Y - 0.4, 0.45),
            ],
            0.045,
            hose,
            ring_mat=dark,
            ring_step=0.1,
        )
    )
    objs.append(
        ribbed_hose(
            "HoseCabR",
            [
                (0.62, CAB_Y - 0.55, 1.85),
                (0.7, CAB_Y - 0.62, 1.35),
                (0.72, CAB_Y - 0.55, 0.75),
                (0.65, CAB_Y - 0.4, 0.45),
            ],
            0.045,
            hose,
            ring_mat=dark,
            ring_step=0.1,
        )
    )
    # extra vertical bundles wrapping the cab front corners (front-view silhouette)
    for side, sx in (("L", -1), ("R", 1)):
        x = sx * 0.68
        objs.append(
            cylinder(
                f"CabWrapA_{side}",
                0.04,
                1.15,
                (x, CAB_Y - 0.58, 1.15),
                hose,
                segs=10,
            )
        )
        objs.append(
            cylinder(
                f"CabWrapB_{side}",
                0.03,
                1.05,
                (x + sx * 0.07, CAB_Y - 0.5, 1.1),
                M["steel"],
                segs=10,
            )
        )
    # extra roof conduit
    objs.append(
        pipe_curve(
            "RoofConduit",
            [
                (-0.5, CAB_Y - 0.3, 1.98),
                (0.0, CAB_Y - 0.1, 2.02),
                (0.45, CAB_Y + 0.15, 1.98),
                (0.55, 0.4, 1.85),
            ],
            0.028,
            dark,
        )
    )
    # small pipes along mid
    objs.append(cylinder("MidPipeA", 0.04, 0.9, (0.78, 0.2, 1.15), M["steel"], rot=(radians(90), 0, radians(8)), segs=10))
    objs.append(cylinder("MidPipeB", 0.03, 0.7, (-0.78, 0.7, 0.85), M["steel"], rot=(radians(90), 0, 0), segs=10))
    return objs


def add_reference_images():
    views = Path("/Users/brianscramlin/LocalWebDev/space-janitor/blender/reference/views")
    # keep full sheet nearby as a modeling aid, not exported
    img_path = "/Users/brianscramlin/LocalWebDev/space-janitor/blender/reference/garbage-truck-ortho.jpg"
    img = bpy.data.images.load(img_path, check_existing=True)
    empty = bpy.data.objects.new("Ref_OrthoSheet", None)
    empty.empty_display_type = "IMAGE"
    empty.data = img
    empty.empty_display_size = 6.0
    empty.location = (0, -8.5, 2.2)
    empty.rotation_euler = (radians(90), 0, 0)
    empty.hide_render = True
    link(empty)
    return [empty]


def build():
    setup_file()
    extra_materials()
    M = {
        "body": mat("Grey painted metal"),
        "steel": mat("Brushed Steel Metal"),
        "hopper": mat("Steel container"),
        "white": mat("Painted metal white"),
        "tire": mat("Matte Tire Rubber"),
        "hose": bpy.data.materials.get("Hose") or mat("Grey painted metal"),
        "dark": mat("DarkSteel"),
        "bolt": mat("BoltSteel"),
        "glass": mat("HopperGlass"),
        "cab_glass": mat("CabGlass"),
        "lamp": mat("LampEmit"),
        "screen": mat("ScreenEmit"),
        "rim": mat("RimSteel"),
        "junk_rust": mat("JunkRust"),
        "junk_blue": mat("JunkBlue"),
        "junk_cream": mat("JunkCream"),
        "decal_door": mat("DecalDoor"),
        "decal_honk": mat("DecalHonk"),
        "decal_compactor": mat("DecalCompactor"),
        "decal_company": mat("DecalCompany"),
    }
    # prefer rusted body if present
    if bpy.data.materials.get("TruckFrontRust"):
        M["body"] = mat("TruckFrontRust")
    if bpy.data.materials.get("TruckBackRust"):
        M["hopper"] = mat("TruckBackRust")
    if bpy.data.materials.get("DishWhite"):
        M["white"] = mat("DishWhite")

    root = bpy.data.objects.new("GarbageTruck", None)
    root.empty_display_type = "ARROWS"
    root.empty_display_size = 0.5
    link(root)

    parts = []
    parts += build_chassis(M)
    parts += build_wheels(M)
    parts += build_cab(M)
    parts += build_front_dish(M)
    parts += build_hopper(M)
    parts += build_junk(M)
    parts += build_roof(M)
    parts += build_side_greebles(M)
    parts += build_pipes(M)

    # apply scales on mesh objects so GLB bounds are honest
    for o in parts:
        if o.type == "MESH":
            # skip if already identity-ish
            apply_scale(o)

    parent_all(root, parts)
    ensure_preview()
    refs = add_reference_images()

    bpy.ops.wm.save_mainfile()

    mesh_count = sum(1 for o in bpy.data.objects if o.type == "MESH")
    return {
        "blend": BLEND_PATH,
        "objects": len(bpy.data.objects),
        "meshes": mesh_count,
        "root_children": len(root.children),
        "refs": [r.name for r in refs],
    }


RESULT = build()
