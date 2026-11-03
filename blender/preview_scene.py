"""Renders the whole Desk '95 scene from the player's eye, using the positions in src/scene/*.ts.
    blender -b -P blender/preview_scene.py -- out.png [width height samples]
Blender's own lights stand in for the game's (lamp spot, CRT glow, moonlight), so it is a rough guide, not a screenshot."""
import math, os, re, sys
import bpy
from mathutils import Vector

HERE = os.path.dirname(__file__)
argv = sys.argv[sys.argv.index('--') + 1:]
out = argv[0]
W, H, SAMPLES = (int(argv[1]), int(argv[2]), int(argv[3])) if len(argv) >= 4 else (960, 540, 24)
env = open(os.path.join(HERE, '..', 'src', 'scene', 'DeskEnvironment.ts')).read()
props = open(os.path.join(HERE, '..', 'src', 'scene', 'DeskProps.ts')).read()
DEG = math.pi / 180


def lay(k):
    m = re.search(rf'{k}: \{{ pos: \[([^\]]+)\], rotY: (-?[\d.]+)( \* DEG)?', env)
    return [float(v) for v in m.group(1).split(',')], float(m.group(2)) * (DEG if m.group(3) else 1)


bpy.ops.wm.read_factory_settings(use_empty=True)
MODELS = os.path.join(HERE, '..', 'public', 'models')


def put(file, pos, rot_y, tag):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.join(MODELS, file))
    new = [o for o in bpy.data.objects if o not in before]
    holder = bpy.data.objects.new('H_' + tag, None)
    bpy.context.scene.collection.objects.link(holder)
    holder.location = (pos[0], -pos[2], pos[1])        # glTF (x, y up, z) -> Blender (x, -z, y)
    holder.rotation_euler = (0, 0, rot_y)
    for o in new:
        if o.parent is None:
            o.parent = holder
    return holder


put('room_1995.glb', *lay('room'), 'room')
lamp = put('desk_lamp.glb', *lay('lamp'), 'lamp')
put('crt_pc_combo.glb', *lay('center'), 'crt')
put('boombox_95.glb', *lay('right'), 'boombox')
put('vcr_deck.glb', *lay('left'), 'vcr')
put('pager_95.glb', *lay('pager'), 'pager')
# props, same spots as DeskProps.ts
fl = re.search(r'floppyDrop: \(i: number\) => new Vector3\(([-\d.]+) \+ i \* ([\d.]+), ([\d.]+), ([-\d.]+)\)', props)
for i in range(3):
    put('floppy_disk.glb', (float(fl.group(1)) + i * float(fl.group(2)), float(fl.group(3)), float(fl.group(4))), 0.15 * (1 if i % 2 else -1), f'floppy{i}')
cas = re.findall(r'new Vector3\(([\d.]+), (0\.75\d*), (-[\d.]+)\)', props)
for i, (x, y, z) in enumerate(cas[:2]):
    put('cassette_tape.glb', (float(x), float(y), float(z)), (0.2, -0.3)[i], f'cassette{i}')
vh = re.search(r'vhsShelf: \(i: number\) => new Vector3\(([-\d.]+), [^,]+, ([-\d.]+)\)', props)
put('vhs_tape.glb', (float(vh.group(1)), 0.7625, float(vh.group(2))), 0.1, 'vhs')

bpy.context.view_layer.update()
bulb = bpy.data.objects.get('Lamp_Bulb_Anchor')
bulb_pos = bulb.matrix_world.translation.copy() if bulb else Vector((0.3, -0.6, 1.0))


def light(kind, name, loc, color, energy, **kw):
    d = bpy.data.lights.new(name, kind)
    d.color, d.energy = color, energy
    for k, v in kw.items():
        setattr(d, k, v)
    o = bpy.data.objects.new(name, d)
    o.location = loc
    bpy.context.scene.collection.objects.link(o)
    return o


def aim(o, target):
    o.rotation_euler = (Vector(target) - o.location).to_track_quat('-Z', 'Y').to_euler()


sp = light('SPOT', 'lamp', bulb_pos, (1.0, 0.72, 0.42), 35, spot_size=math.radians(85), spot_blend=0.8)
aim(sp, (0, 0.5, 0.75))
light('POINT', 'crt_glow', (0, 0.34, 1.0), (0.2, 1.0, 0.4), 3.0)
moon = light('AREA', 'moon', (-1.6, 0.6, 1.55), (0.25, 0.4, 0.9), 90, shape='RECTANGLE', size=1.2, size_y=1.3)
aim(moon, (0, 0.5, 0.8))
light('POINT', 'bounce', (0, 0.3, 2.0), (0.3, 0.3, 0.45), 6.0)

w = bpy.data.worlds.new('w')
w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.02, 0.025, 0.05, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.0
bpy.context.scene.world = w

cam = bpy.data.objects.new('eye', bpy.data.cameras.new('eye'))
bpy.context.scene.collection.objects.link(cam)
cam.location = (0, 0.0, 1.15)                       # seated eye height at the player's spot
aim(cam, (0, 0.5, 0.82))
cam.data.angle = math.radians(105)                   # a Quest sees roughly this much
bpy.context.scene.camera = cam

s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = SAMPLES
s.cycles.use_denoising = False
s.cycles.max_bounces = 3
s.cycles.sample_clamp_indirect = 3.0
s.view_settings.view_transform = 'Filmic' if 'Filmic' in [t.identifier for t in s.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
s.render.resolution_x, s.render.resolution_y = W, H
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
