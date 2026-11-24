"""Запекание света комнаты (этап 14): мягкий свет и тени ламп и окна → «карты света» пола и стен.

Как на PS1-играх с пре-рендером: свет считается заранее, сайт его только показывает.
Персонажи и мебель на сайте по-прежнему освещаются живыми лампами.

Шаги:
  1. В браузере (npm run dev) в консоли: await __app.exportForBake()
     → models-src/bake/scene.glb (комната без персонажей) и lights.json (лампы, свет, раскладка).
  2. /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blender/bake.py
     → public/textures/bake/floor.png, north.png, west.png (~10 с … 1 мин).
  3. Подвинули мебель или лампы в data.js — повторить оба шага.

Что делает скрипт:
  - импортирует комнату, прячет её пол и стены и ставит на их место плоскости с той же развёрткой,
    что у граней на сайте (u, v считаются так же, как в BoxGeometry three.js);
  - лампы — точечные источники там же, где на сайте; окно — светящийся прямоугольник у стекла
    (свет ночи); общий свет — цвет «неба» вокруг;
  - абажуры не отбрасывают тень (иначе лампа внутри абажура никого не освещает);
  - запекает в каждую плоскость только свет, без цвета поверхности (Cycles, Diffuse: direct + indirect),
    чуть размывает шум и сохраняет PNG; значения делятся на EXPOSURE, чтобы яркие места не обрезались
    (сайт умножает обратно: lighting.baked.intensity в data.js).
"""
import json
import os
from math import radians

import bpy
import bmesh
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "models-src", "bake")
OUT = os.path.join(ROOT, "public", "textures", "bake")

WALL_T = 0.12  # толщина стен — как в room.js
SLAB = 0.3  # толщина пола — как в room.js
PX = 24  # пикселей карты света на клетку
EXPOSURE = 2.0  # по умолчанию; берётся из lighting.baked.exposure в data.js
SAMPLES = 384

# Перевод мощности: на сайте intensity лампы (three.js) → ватты в Blender. Подобрано на глаз.
LAMP_W = 18.0
WINDOW_W = 120.0  # ватты на единицу lighting.moon.intensity для окна
WORLD = 0.3  # сила общего света на единицу lighting.ambient.intensity


def v3(x, y, z):
    """Точка из координат сайта (y — вверх) в координаты Blender (z — вверх)."""
    return (x, -z, y)


def hex_rgb(h):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]


def plane(name, corners, uvs):
    """Плоскость из четырёх углов (координаты сайта) с заданной развёрткой."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new(v3(*c)) for c in corners]
    face = bm.faces.new(verts)
    uv = bm.loops.layers.uv.new("UVMap")
    for loop, t in zip(face.loops, uvs):
        loop[uv].uv = t
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def main():
    info = json.load(open(os.path.join(SRC, "lights.json")))
    room, lighting = info["room"], info["lighting"]
    C, R, H = room["columns"], room["rows"], room["wallHeight"]
    exposure = (lighting.get("baked") or {}).get("exposure", EXPOSURE)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(SRC, "scene.glb"))
    scene = bpy.context.scene

    for obj in list(scene.objects):
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj)
            continue
        if obj.type != "MESH":
            continue
        if obj.name.startswith("shaft"):
            obj.hide_render = True  # лучи из окна — только картинка на сайте
            continue
        if obj.name.startswith("floor") or obj.name.startswith("wall"):
            obj.hide_render = True  # вместо них — плоскости ниже
        # светящиеся детали (абажур, экраны, вид из окна) не загораживают свет
        for slot in obj.material_slots:
            m = slot.material
            if not m or not m.use_nodes:
                continue
            bsdf = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            emissive = bsdf is None or (
                bsdf.inputs["Emission Strength"].default_value > 0
                and any(c > 0 for c in bsdf.inputs["Emission Color"].default_value[:3])
            )
            if emissive:
                obj.visible_shadow = False

    # Плоскости для запекания. Развёртка — как у граней BoxGeometry на сайте:
    # пол (верх плиты): u = x / C, v = 1 − z / R;
    # задняя стена (грань +Z): u = (x + WALL_T) / (C + WALL_T), v = (y + SLAB) / (H + SLAB);
    # левая стена (грань +X): u = (R − z) / R, v — так же.
    targets = {
        "floor": (plane("bake_floor", [(0, 0, R), (C, 0, R), (C, 0, 0), (0, 0, 0)],
                        [(0, 0), (1, 0), (1, 1), (0, 1)]), C, R),
        "north": (plane("bake_north", [(-WALL_T, -SLAB, 0.001), (C, -SLAB, 0.001), (C, H, 0.001), (-WALL_T, H, 0.001)],
                        [(0, 0), (1, 0), (1, 1), (0, 1)]), C + WALL_T, H + SLAB),
        "west": (plane("bake_west", [(0.001, -SLAB, R), (0.001, -SLAB, 0), (0.001, H, 0), (0.001, H, R)],
                       [(0, 0), (1, 0), (1, 1), (0, 1)]), R, H + SLAB),
    }

    # Лампы
    for i, lamp in enumerate(info["lamps"]):
        data = bpy.data.lights.new(f"lamp{i}", "POINT")
        data.energy = lamp["intensity"] * LAMP_W
        data.color = hex_rgb(lamp["color"])
        data.shadow_soft_size = 0.06
        obj = bpy.data.objects.new(f"lamp{i}", data)
        obj.location = v3(*lamp["position"])
        scene.collection.objects.link(obj)

    # Окно: светящийся прямоугольник у стекла, светит в комнату
    moon = lighting["moon"]
    for item in info["furniture"]:
        if item.get("type") != "mansionWindow":
            continue
        xs = [c[0] for c in item["cells"]]
        x0, x1 = min(xs) + 0.05, max(xs) + 1 - 0.05
        y0, y1 = item.get("sill", 0.95), item.get("top", 2.3)
        data = bpy.data.lights.new("window", "AREA")
        data.shape = "RECTANGLE"
        data.size, data.size_y = x1 - x0, y1 - y0
        data.energy = moon["intensity"] * WINDOW_W
        data.color = hex_rgb(moon["color"])
        obj = bpy.data.objects.new("window", data)
        obj.location = v3((x0 + x1) / 2, (y0 + y1) / 2, 0.02)
        obj.rotation_euler = (radians(-90), 0, 0)  # светит в комнату (на сайте +Z)
        scene.collection.objects.link(obj)

    # Общий свет — цвет «неба»
    amb = lighting["ambient"]
    world = bpy.data.worlds.new("world")
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    sky, ground = hex_rgb(amb["sky"]), hex_rgb(amb["ground"])
    bg.inputs["Color"].default_value = [(a + b) / 2 for a, b in zip(sky, ground)] + [1]
    bg.inputs["Strength"].default_value = amb["intensity"] * WORLD
    scene.world = world

    try:
        scene.render.engine = "CYCLES"
    except TypeError as e:
        raise SystemExit(f"Нет Cycles: {e}")
    scene.cycles.samples = SAMPLES
    scene.cycles.device = "CPU"
    bake = scene.render.bake
    bake.use_pass_direct = True
    bake.use_pass_indirect = True
    bake.use_pass_color = False
    bake.margin = 4

    os.makedirs(OUT, exist_ok=True)
    for name, (obj, w, h) in targets.items():
        W, Hpx = max(8, round(w * PX)), max(8, round(h * PX))
        img = bpy.data.images.new(f"bake_{name}", W, Hpx, float_buffer=True)
        img.colorspace_settings.name = "Non-Color"
        mat = bpy.data.materials.new(f"bake_{name}")
        mat.use_nodes = True
        nodes = mat.node_tree.nodes
        bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
        bsdf.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1)
        bsdf.inputs["Roughness"].default_value = 1.0
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        nodes.active = tex
        obj.data.materials.append(mat)

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"})

        px = np.array(img.pixels[:], dtype=np.float32).reshape(Hpx, W, 4)
        rgb = px[..., :3]
        # лёгкое размытие 3×3 — убрать шум Cycles
        pad = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode="edge")
        rgb = sum(pad[dy:dy + Hpx, dx:dx + W] for dy in range(3) for dx in range(3)) / 9
        # в лампочке «сила света», а не цвет: обратно к гамме, чтобы тени не слиплись в 8 битах
        rgb = np.clip(rgb / exposure, 0, 1) ** (1 / 2.2)
        px[..., :3] = rgb
        px[..., 3] = 1
        out = bpy.data.images.new(f"out_{name}", W, Hpx)
        out.colorspace_settings.name = "Non-Color"
        out.pixels[:] = px.ravel()
        out.filepath_raw = os.path.join(OUT, f"{name}.png")
        out.file_format = "PNG"
        out.save()
        print(f"запечено: {name}.png {W}×{Hpx}, средняя яркость {rgb.mean():.3f}")


main()
