"""Render a PNG of a .glb with no GUI and no GPU (Cycles on CPU), so you can look at models from a cloud IDE.
    blender -b -P blender/preview.py -- public/models/floppy_disk.glb out.png [azimuth_deg] [elevation_deg]
"""
import math, sys
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
az = math.radians(float(argv[2])) if len(argv) > 2 else math.radians(35)
el = math.radians(float(argv[3])) if len(argv) > 3 else math.radians(30)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
centre, size = (lo + hi) / 2, max((hi - lo).length, 0.001)

cam_data = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cam_data)
bpy.context.scene.collection.objects.link(cam)
dist = size * 1.7
cam.location = centre + Vector((math.sin(az) * math.cos(el), -math.cos(az) * math.cos(el), math.sin(el))) * dist
direction = centre - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
bpy.context.scene.camera = cam

for loc, energy in (((1, -1, 2), 3.0), ((-2, 1, 1), 1.2)):
    ld = bpy.data.lights.new('l', 'SUN')
    ld.energy = energy
    lo_ = bpy.data.objects.new('l', ld)
    lo_.rotation_euler = (math.radians(50), 0, math.radians(30 if energy > 2 else 200))
    bpy.context.scene.collection.objects.link(lo_)

world = bpy.data.worlds.new('w')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.05, 0.06, 0.09, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.6
bpy.context.scene.world = world

s = bpy.context.scene
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = 24
s.cycles.use_denoising = False  # some distro builds of Blender have no denoiser
s.render.resolution_x, s.render.resolution_y = 800, 600
s.render.filepath = out
bpy.ops.render.render(write_still=True)
print('rendered', out)
