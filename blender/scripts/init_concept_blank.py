"""Create a blank metric scene for procedural concept modeling."""
from __future__ import annotations

from pathlib import Path

import bpy

BLEND_PATH = str(Path(__file__).resolve().parent.parent / "garbage-truck-concept3.blend")


def init_blank() -> None:
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)

    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0

    world = scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.86, 0.88, 0.91, 1.0)
        bg.inputs[1].default_value = 1.0

    bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)


if __name__ == "__main__":
    init_blank()
    print({"blend": BLEND_PATH, "objects": len(bpy.data.objects)})
