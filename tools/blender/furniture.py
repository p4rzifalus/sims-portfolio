"""Мебель: сгенерированная модель (models-src/<имя>/4-model/<имя>.glb) → PS1-модель для сайта.

Шаги (всё кодом, пересобирается с нуля одной командой):
  1. импорт, все куски — в один меш, передом к −Y (в glb для сайта это +Z, «юг»);
  2. масштаб и место: по центру своей «клетки-рамки», спинкой к задней стороне, ножками на полу;
  3. упрощение до бюджета треугольников (копия, исходник остаётся для запекания);
  4. новая развёртка и запекание цвета с исходной 4K-текстуры в маленькую (128 px);
  5. палитра 15 бит, как у PS1 (по 32 оттенка на канал);
  6. экспорт glb: одна текстура, фильтрация «ближайший пиксель» → public/models/furniture/<имя>.glb;
  7. превью: исходник и результат рядом → models-src/<имя>/5-ps1/.

Запуск (из папки проекта):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blender/furniture.py -- sofa
"""
import os
import sys
from math import radians

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Настройки каждого предмета.
#   cells   — рамка в клетках, как её получает builder в room.js: w — ширина вдоль «лица», d — глубина
#   scale   — во сколько раз увеличить исходник (подобрано так, чтобы сиденье дивана было на 0.46 — как SEATS.sofa)
#   back    — отступ спинки от задней границы рамки
#   front   — куда смотрит перед исходника в Blender ('-Y', '+Y', '-X', '+X')
#   tris    — бюджет треугольников
#   tex     — размер текстуры
ASSETS = {
    "sofa": dict(cells=(2, 1), scale=1.625, back=0.03, front="-Y", tris=700, tex=128),
}

FRONT_ROT = {"-Y": 0, "+X": 90, "+Y": 180, "-X": -90}  # поворот вокруг Z, чтобы перед смотрел в −Y


def log(*a):
    print("FURNITURE:", *a, flush=True)


def activate(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def tri_count(ob):
    me = ob.data
    me.calc_loop_triangles()
    return len(me.loop_triangles)


def world_bounds(ob):
    ws = np.array([ob.matrix_world @ v.co for v in ob.data.vertices])
    return ws.min(0), ws.max(0)


# ----------------------------------------------------------------------
def load_source(path, cfg):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    activate(meshes[0])
    for o in meshes:
        o.select_set(True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    src = bpy.context.view_layer.objects.active
    src.parent = None
    src.rotation_euler.z += radians(FRONT_ROT[cfg["front"]])
    src.scale *= cfg["scale"]
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    # место: по центру по X, спинка (+Y) у задней границы рамки, низ на z = 0
    lo, hi = world_bounds(src)
    w, d = cfg["cells"]
    shift = Vector((-(lo[0] + hi[0]) / 2, (d / 2 - cfg["back"]) - hi[1], -lo[2]))
    src.location += shift
    bpy.ops.object.transform_apply(location=True)
    lo, hi = world_bounds(src)
    log("размер", np.round(hi - lo, 3), "рамка", (w, d), "треугольников в исходнике", tri_count(src))
    if hi[0] - lo[0] > w or hi[1] - lo[1] > d:
        log("ВНИМАНИЕ: предмет не влезает в свои клетки")
    src.name = "src"
    return src


def base_color_image(ob):
    m = ob.data.materials[0]
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    link = bsdf.inputs["Base Color"].links[0]
    return link.from_node.image


def make_low(src, cfg):
    activate(src)
    bpy.ops.object.duplicate()
    low = bpy.context.view_layer.objects.active
    low.name = "low"
    # сначала склеить совпадающие вершины (у генератора швы развёртки — разрезы сетки)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")
    mod = low.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    n = tri_count(low)
    mod.ratio = min(1.0, cfg["tris"] / n)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    log("треугольников после упрощения", tri_count(low))
    # своя развёртка
    while low.data.uv_layers:
        low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name="UVMap")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=radians(55), island_margin=0.02, area_weight=0.0)
    bpy.ops.uv.pack_islands(rotate=True, margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()
    low.data.materials.clear()
    return low


def emit_material(name, color_socket_fn):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(color_socket_fn(nt), em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def bake_color(low, src, size):
    tex = base_color_image(src)
    # исходник светится своим цветом: в запечённой текстуре — чистый цвет, без света сцены
    def tex_out(nt):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = tex
        return t.outputs["Color"]
    src.data.materials[0] = emit_material("src_emit", tex_out)

    img = bpy.data.images.new("baked", size, size, alpha=False)
    m = emit_material("low_bake", lambda nt: nt.nodes.new("ShaderNodeRGB").outputs[0])
    node = m.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    m.node_tree.nodes.active = node
    low.data.materials.append(m)

    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 16
    sc.cycles.device = "CPU"
    b = sc.render.bake
    b.use_selected_to_active = True
    b.cage_extrusion = 0.03
    b.max_ray_distance = 0.1
    b.margin = 2
    activate(low)
    src.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type="EMIT")
    log("цвет запечён", size, "px")
    return img


def to_15bit(img):
    a = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    a[:, :3] = np.round(a[:, :3] * 31) / 31  # 32 оттенка на канал — как 15-битный цвет PS1
    img.pixels.foreach_set(a.ravel())
    img.update()


def final_material(low, img, name):
    low.data.materials.clear()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest"
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    low.data.materials.append(m)


def export(low, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    activate(low)
    bpy.ops.export_scene.gltf(
        filepath=path, use_selection=True, export_format="GLB",
        export_image_format="AUTO", export_texcoords=True, export_normals=True,
        export_materials="EXPORT", export_yup=True, export_apply=True,
    )
    log("сохранено", path, os.path.getsize(path) // 1024, "КБ")


def preview(src, low, img, out_dir, name):
    """Два кадра 3/4 спереди: исходник и PS1-модель, ровный свет, как в рабочем окне Blender."""
    os.makedirs(out_dir, exist_ok=True)
    src.data.materials[0] = bpy.data.materials.new("plain")  # исходник — со своей 4K-текстурой
    tex = base_color_image_from_images()
    m = src.data.materials[0]
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    t = m.node_tree.nodes.new("ShaderNodeTexImage")
    t.image = tex
    m.node_tree.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])

    sc = bpy.context.scene
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.color_type = "TEXTURE"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.show_cavity = False
    sc.render.resolution_x, sc.render.resolution_y = 480, 320
    sc.render.film_transparent = False
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    sc.collection.objects.link(cam)
    sc.camera = cam
    cam.data.type = "ORTHO"
    lo, hi = world_bounds(src)
    c = Vector(((lo + hi) / 2).tolist())
    cam.data.ortho_scale = float(max(hi - lo)) * 1.25
    cam.location = c + Vector((-0.6, -1.0, 0.7)).normalized() * 6
    cam.rotation_euler = (c - cam.location).to_track_quat("-Z", "Y").to_euler()
    for ob, tag in ((src, "src"), (low, "ps1")):
        src.hide_render = ob is not src
        low.hide_render = ob is not low
        sc.render.filepath = os.path.join(out_dir, f"{name}_{tag}.png")
        bpy.ops.render.render(write_still=True)
    log("превью", out_dir)


_SRC_TEX = {}


def base_color_image_from_images():
    return _SRC_TEX["img"]


def main():
    name = sys.argv[sys.argv.index("--") + 1]
    cfg = ASSETS[name]
    src_path = os.path.join(ROOT, "models-src", name, "4-model", name + ".glb")
    src = load_source(src_path, cfg)
    _SRC_TEX["img"] = base_color_image(src)
    low = make_low(src, cfg)
    img = bake_color(low, src, cfg["tex"])
    to_15bit(img)
    final_material(low, img, name)
    img.filepath_raw = os.path.join(ROOT, "models-src", name, "5-ps1", name + "_tex.png")
    os.makedirs(os.path.dirname(img.filepath_raw), exist_ok=True)
    img.file_format = "PNG"
    img.save()
    export(low, os.path.join(ROOT, "public", "models", "furniture", name + ".glb"))
    preview(src, low, img, os.path.join(ROOT, "models-src", name, "5-ps1"), name)


main()
