"""Модель персонажа из 3d.tencent.ai → FBX для загрузки в Mixamo (автоскелет и движения).

Рост 1.7 м, лицом к −Y, стопы на полу, текстура цвета упакована в файл
(карты нормалей и металла Mixamo не нужны). Результат: models-src/<имя>/6-mixamo/<имя>.fbx

Запуск:
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blender/mixamo_export.py -- sonya
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HEIGHT = 1.7

name = sys.argv[sys.argv.index("--") + 1]
src = os.path.join(ROOT, "models-src", name, "4-model", name + ".glb")
out_dir = os.path.join(ROOT, "models-src", name, "6-mixamo")
os.makedirs(out_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
ob = next(o for o in bpy.data.objects if o.type == "MESH")
ob.parent = None
for o in list(bpy.data.objects):
    if o is not ob:
        bpy.data.objects.remove(o)
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
ws = np.array([ob.matrix_world @ v.co for v in ob.data.vertices])
lo, hi = ws.min(0), ws.max(0)
ob.scale *= HEIGHT / (hi[2] - lo[2])
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
ws = np.array([ob.matrix_world @ v.co for v in ob.data.vertices])
lo, hi = ws.min(0), ws.max(0)
ob.location += Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
bpy.ops.object.transform_apply(location=True)

# материал: только цвет, текстура 2048
m = ob.data.materials[0]
nt = m.node_tree
bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
img = bsdf.inputs["Base Color"].links[0].from_node.image
for n in list(nt.nodes):
    if n.type == "TEX_IMAGE" and n.image is not img:
        nt.nodes.remove(n)
for n in list(nt.nodes):
    if n.type in ("NORMAL_MAP", "SEPARATE_COLOR"):
        nt.nodes.remove(n)
img.scale(2048, 2048)
img.filepath_raw = os.path.join(out_dir, name + "_color.png")
img.file_format = "PNG"
img.save()
bpy.ops.file.pack_all()

path = os.path.join(out_dir, name + ".fbx")
bpy.ops.export_scene.fbx(filepath=path, use_selection=True, path_mode="COPY", embed_textures=True,
                         apply_scale_options="FBX_SCALE_ALL", object_types={"MESH"})
print("MIXAMO:", path, os.path.getsize(path) // 1024 // 1024, "МБ", "рост", HEIGHT)
