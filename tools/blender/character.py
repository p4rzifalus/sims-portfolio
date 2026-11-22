"""Персонаж: модель со скелетом из Mixamo + движения из Mixamo → PS1-персонаж для сайта.

Берёт:
  models-src/<имя>/6-mixamo/<имя>_rigged.fbx   — модель со скелетом (скачана из Mixamo «With Skin», T-pose)
  models-src/<имя>/6-mixamo/anim/*.fbx          — движения (имена файлов — по-русски, см. MOVES)

Шаги (всё кодом, пересобирается с нуля одной командой):
  1. рост 1.5 клетки, лицом к −Y (на сайте это +Z), стопы на полу;
  2. кости без приставки «mixamorig:» (three.js не любит двоеточия в именах);
  3. упрощение до бюджета треугольников (лицу — больше), по 2 кости на вершину;
  4. новая развёртка, запекание цвета с исходной 4K-текстуры в атлас 256 px, цвет 15 бит;
  5. движения: таз не уезжает по горизонтали (персонажа по комнате двигает сайт);
  6. замеры для сайта (скорость шага, высота посадки) → печать и models-src/<имя>/5-ps1/<имя>_rig.json;
  7. экспорт glb со всеми движениями (ключ на каждый второй кадр) → public/models/people/<имя>.glb
     и замеры → public/models/people/<имя>.json.

Запуск (из папки проекта):
  /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P tools/blender/character.py -- sonya
"""
import json
import os
import sys
from math import radians

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
HEIGHT = 1.5        # рост в клетках сайта
TRIS = 2000         # бюджет треугольников
ATLAS = 256
HEAD_TEXELS = 2.0   # во сколько раз плотнее текстура на голове

# файл движения → имя на сайте; loop — повторяется или проигрывается один раз
MOVES = {
    "стоит": ("idle", True),
    "идёт": ("walk", True),
    "садится": ("sitDown", False),
    "сидит": ("sit", True),
    "встаёт": ("standUp", False),
    "печатает": ("type", True),
    "машет": ("wave", False),
    # бэклог: если файл появится, движение попадёт в glb само, но сайт его пока не использует
    "говорит": ("talk", True),
    "танцует": ("dance", True),
    "смеётся": ("laugh", True),
    "протягивает": ("give", False),
    "достаёт с полки": ("reach", False),
}


def log(*a):
    print("CHARACTER:", *a, flush=True)


def activate(ob):
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob


def fcurves(action):
    """F-кривые действия (в Blender 5 они лежат в слоях и «слотах»)."""
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


def tri_count(ob):
    ob.data.calc_loop_triangles()
    return len(ob.data.loop_triangles)


# ----------------------------------------------------------------------
def load_rig(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mesh = next(o for o in bpy.data.objects if o.type == "MESH")
    arm.animation_data_clear()
    for a in list(bpy.data.actions):
        bpy.data.actions.remove(a)
    # имена костей без приставки
    for b in arm.data.bones:
        b.name = b.name.replace("mixamorig:", "")
    for vg in mesh.vertex_groups:
        vg.name = vg.name.replace("mixamorig:", "")
    arm.name, mesh.name = "rig", "body"
    return arm, mesh


def fit_height(arm, mesh):
    """Масштаб всего (скелет вместе с телом) так, чтобы рост был HEIGHT, стопы на z = 0."""
    ws = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
    lo, hi = ws.min(0), ws.max(0)
    k = HEIGHT / (hi[2] - lo[2])
    arm.scale *= k
    total = arm.scale.x  # множитель для сдвигов костей в движениях (Mixamo пишет их в сантиметрах)
    arm.location = (arm.location - Vector((0, 0, 0))) * k
    bpy.context.view_layer.update()
    ws = np.array([mesh.matrix_world @ v.co for v in mesh.data.vertices])
    lo, hi = ws.min(0), ws.max(0)
    arm.location += Vector((-(lo[0] + hi[0]) / 2, -(lo[1] + hi[1]) / 2, -lo[2]))
    bpy.context.view_layer.update()
    # применить масштаб к скелету и телу, чтобы в glb всё было в клетках, без множителей
    activate(arm)
    mesh.select_set(True)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    log("рост", round(HEIGHT, 3), "множитель сдвигов", round(total, 5))
    return total


def import_moves(arm, anim_dir, k):
    """Движения из отдельных файлов → действия нашего скелета (дорожки NLA для экспорта)."""
    arm.animation_data_create()
    found = {}
    for fname, (key, loop) in MOVES.items():
        path = os.path.join(anim_dir, fname + ".fbx")
        if not os.path.exists(path):
            log("нет движения", fname, "— пропускаю")
            continue
        before = set(bpy.data.objects)
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
        new = [o for o in bpy.data.objects if o not in before]
        src_arm = next(o for o in new if o.type == "ARMATURE")
        act = src_arm.animation_data.action
        act.name = key
        for o in new:
            bpy.data.objects.remove(o, do_unlink=True)
        for fc in fcurves(act):
            fc.data_path = fc.data_path.replace("mixamorig:", "")
            # таз: убрать движение по горизонтали, вертикаль — в масштаб нашего роста.
            # У таза Mixamo в системе кости: Y — вверх (вдоль кости), X и Z — по полу.
            if fc.data_path == 'pose.bones["Hips"].location':
                if fc.array_index in (0, 2):
                    for kp in fc.keyframe_points:
                        kp.co.y = 0.0
                        kp.handle_left.y = kp.handle_right.y = 0.0
            if fc.data_path.endswith(".location"):
                for kp in fc.keyframe_points:
                    kp.co.y *= k
                    kp.handle_left.y *= k
                    kp.handle_right.y *= k
        act.use_fake_user = True
        track = arm.animation_data.nla_tracks.new()
        track.name = key
        strip = track.strips.new(key, int(act.frame_range[0]), act)
        strip.name = key
        found[key] = (act, loop)
        log("движение", fname, "→", key, "кадров", int(act.frame_range[1] - act.frame_range[0] + 1))
    return found


def pose_at(arm, act, frame):
    arm.animation_data.action = act
    if hasattr(arm.animation_data, "action_slot") and act.slots:
        arm.animation_data.action_slot = act.slots[0]
    bpy.context.scene.frame_set(int(frame))
    bpy.context.view_layer.update()


def measure(arm, mesh, moves):
    """Замеры, которые нужны сайту, — по самим движениям."""
    out = {"height": HEIGHT}
    dg = bpy.context.evaluated_depsgraph_get()
    if "walk" in moves:
        act, _ = moves["walk"]
        f0, f1 = act.frame_range
        fps = bpy.context.scene.render.fps
        pts = {"LeftFoot": [], "RightFoot": []}
        for f in range(int(f0), int(f1) + 1):
            pose_at(arm, act, f)
            for n in pts:
                pts[n].append((arm.matrix_world @ arm.pose.bones[n].head).copy())
        # стопа, стоящая на полу, едет назад со скоростью шага: берём движение по Y
        # в кадрах, когда стопа ниже всего (на полу)
        speeds = []
        for n, p in pts.items():
            z = np.array([v.z for v in p])
            y = np.array([v.y for v in p])
            low = z < z.min() + 0.02
            for i in range(1, len(p)):
                if low[i] and low[i - 1]:
                    speeds.append(abs(y[i] - y[i - 1]) * fps)
        out["walkSpeed"] = round(float(np.median(speeds)), 3) if speeds else None
        log("скорость шага (клеток/с)", out["walkSpeed"])
    if "sit" in moves:
        act, _ = moves["sit"]
        pose_at(arm, act, act.frame_range[0])
        ev = mesh.evaluated_get(dg)
        ws = np.array([mesh.matrix_world @ v.co for v in ev.data.vertices])
        hips = arm.matrix_world @ arm.pose.bones["Hips"].head
        # сиденье под тазом: самая низкая точка тела в полосе ±15 см вокруг таза (не стопы)
        near = ws[(np.abs(ws[:, 0] - hips.x) < 0.15) & (np.abs(ws[:, 1] - hips.y) < 0.15)]
        seat = float(near[:, 2].min())
        out["sitSeat"] = round(seat, 3)          # высота «попы» над точкой персонажа
        out["sitHipsY"] = round(float(hips.y), 3)  # таз сидя: смещение по глубине (−Y — вперёд)
        log("сидя: попа на высоте", out["sitSeat"], "таз по глубине", out["sitHipsY"])
    for key in ("sitDown", "standUp", "wave"):
        if key in moves:
            act, _ = moves[key]
            out[key + "Time"] = round((act.frame_range[1] - act.frame_range[0]) / bpy.context.scene.render.fps, 3)
    arm.animation_data.action = None
    for pb in arm.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    return out


def limit_weights(ob, n):
    """Оставить у каждой вершины n самых сильных костей, веса в сумме 1."""
    groups = ob.vertex_groups
    for v in ob.data.vertices:
        gs = sorted(((g.weight, g.group) for g in v.groups), reverse=True)
        keep, drop = gs[:n], gs[n:]
        for _, gi in drop:
            groups[gi].remove([v.index])
        total = sum(w for w, _ in keep) or 1.0
        for w, gi in keep:
            groups[gi].add([v.index], w / total, "REPLACE")


def make_low(mesh):
    """Упрощённая копия тела с теми же костями; исходник остаётся для запекания."""
    activate(mesh)
    bpy.ops.object.duplicate()
    low = bpy.context.view_layer.objects.active
    low.name = "low"
    rig = None
    for m in list(low.modifiers):  # скелет снимаем на время упрощения, потом вернём
        if m.type == "ARMATURE":
            rig = m.object
            low.modifiers.remove(m)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=0.002)
    bpy.ops.object.mode_set(mode="OBJECT")
    # лицу — больше треугольников: группа «беречь» = вес головы
    keep = low.vertex_groups.new(name="keep")
    head = low.vertex_groups.get("Head")
    if head:
        for v in low.data.vertices:
            w = next((g.weight for g in v.groups if g.group == head.index), 0.0)
            if w > 0:
                keep.add([v.index], w, "REPLACE")
    mod = low.modifiers.new("dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    # (группа «беречь» для лица пробовалась — модификатор тогда почти не упрощает тело;
    #  лицо всё равно будет отдельной текстурой, как в solara)
    # подобрать долю, чтобы попасть в бюджет
    n0 = tri_count(low)
    ratio = TRIS / n0
    for _ in range(6):
        mod.ratio = min(1.0, ratio)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        ev = low.evaluated_get(dg)
        ev.data.calc_loop_triangles()
        got = len(ev.data.loop_triangles)
        ratio *= TRIS / max(got, 1)
        if abs(got - TRIS) < TRIS * 0.05:
            break
    # результат модификатора — в новую сетку (обычное «применить» спотыкается о группы костей)
    dg = bpy.context.evaluated_depsgraph_get()
    new_me = bpy.data.meshes.new_from_object(low.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    low.modifiers.remove(mod)
    old_me = low.data
    low.data = new_me
    bpy.data.meshes.remove(old_me)
    low.vertex_groups.remove(low.vertex_groups["keep"])
    # по 2 кости на вершину, веса в сумме 1
    limit_weights(low, 2)
    am = low.modifiers.new("rig", "ARMATURE")
    am.object = rig
    log("треугольников", tri_count(low), "из", n0)
    return low


def unwrap(low):
    while low.data.uv_layers:
        low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name="UVMap")
    activate(low)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=radians(60), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    # голове — больше текселей: её острова крупнее до упаковки
    head = low.vertex_groups.get("Head")
    if head:
        uv = low.data.uv_layers.active.data
        for p in low.data.polygons:
            ws = [next((g.weight for g in low.data.vertices[i].groups if g.group == head.index), 0) for i in p.vertices]
            if min(ws) > 0.5:
                for li in p.loop_indices:
                    uv[li].uv *= HEAD_TEXELS
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.pack_islands(rotate=True, margin=0.012)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.shade_smooth()


def emit_material(name, socket_fn):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em = nt.nodes.new("ShaderNodeEmission")
    nt.links.new(socket_fn(nt), em.inputs["Color"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def bake(low, src):
    m = src.data.materials[0]
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    tex = bsdf.inputs["Base Color"].links[0].from_node.image

    def tex_out(nt):
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = tex
        return t.outputs["Color"]
    src.data.materials[0] = emit_material("src_emit", tex_out)
    img = bpy.data.images.new("atlas", ATLAS, ATLAS, alpha=False)
    lm = emit_material("low_bake", lambda nt: nt.nodes.new("ShaderNodeRGB").outputs[0])
    node = lm.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = img
    lm.node_tree.nodes.active = node
    low.data.materials.clear()
    low.data.materials.append(lm)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.samples = 16
    sc.cycles.device = "CPU"
    b = sc.render.bake
    b.use_selected_to_active = True
    b.cage_extrusion = 0.02
    b.max_ray_distance = 0.06
    b.margin = 2
    activate(low)
    src.select_set(True)
    bpy.context.view_layer.objects.active = low
    bpy.ops.object.bake(type="EMIT")
    a = np.array(img.pixels[:], dtype=np.float32).reshape(-1, 4)
    a[:, :3] = np.round(a[:, :3] * 31) / 31   # 15-битный цвет
    img.pixels.foreach_set(a.ravel())
    img.update()
    # итоговый материал
    low.data.materials.clear()
    fm = bpy.data.materials.new("body")
    fm.use_nodes = True
    nt = fm.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 1.0
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = img
    t.interpolation = "Closest"
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    low.data.materials.append(fm)
    log("атлас запечён", ATLAS, "px")
    return img


def main():
    name = sys.argv[sys.argv.index("--") + 1]
    base = os.path.join(ROOT, "models-src", name)
    arm, mesh = load_rig(os.path.join(base, "6-mixamo", name + "_rigged.fbx"))
    k = fit_height(arm, mesh)
    moves = import_moves(arm, os.path.join(base, "6-mixamo", "anim"), k)
    info = measure(arm, mesh, moves)
    info["animations"] = {key: loop for key, (_, loop) in moves.items()}
    low = make_low(mesh)
    unwrap(low)
    img = bake(low, mesh)
    out5 = os.path.join(base, "5-ps1")
    os.makedirs(out5, exist_ok=True)
    img.filepath_raw = os.path.join(out5, name + "_atlas.png")
    img.file_format = "PNG"
    img.save()
    # замеры — рядом с моделью на сайте (characters.js читает их вместе с glb)
    for p in (os.path.join(out5, name + "_rig.json"), os.path.join(ROOT, "public", "models", "people", name + ".json")):
        with open(p, "w") as f:
            json.dump(info, f, ensure_ascii=False, indent=2)
    log("замеры", json.dumps(info, ensure_ascii=False))
    # экспорт: скелет + упрощённое тело, движения — дорожки NLA
    bpy.data.objects.remove(mesh, do_unlink=True)
    low.name = "body"
    arm.animation_data.action = None
    activate(arm)
    low.select_set(True)
    path = os.path.join(ROOT, "public", "models", "people", name + ".glb")
    bpy.ops.export_scene.gltf(
        filepath=path, use_selection=True, export_format="GLB",
        export_animations=True, export_animation_mode="NLA_TRACKS",
        export_force_sampling=True, export_frame_step=2,  # ключ на каждый второй кадр: вдвое легче
        export_skins=True, export_all_influences=False,
        export_yup=True, export_apply=False, export_materials="EXPORT",
    )
    log("сохранено", path, os.path.getsize(path) // 1024, "КБ")


main()
