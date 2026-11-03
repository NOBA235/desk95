"""blender -b -P blender/make_cassette.py   ->  public/models/cassette_tape.glb"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('Cassette_95')
shell = material('Cassette_Shell', '#3a3d45', 0.0, 0.35)
glass = material('Cassette_Window', '#0b0c10', 0.0, 0.1)
reel = material('Cassette_Reel', '#d8d6cf', 0.0, 0.6)
screw = material('Cassette_Screw', '#9a9da3', 1.0, 0.4)
paper = material('Label_Paper', '#f1efe6', 0.0, 0.85)

W, T, D = 0.100, 0.012, 0.064
box('Cassette_Body', (W, T, D), (0, 0, 0), shell, r, bevel=0.0012)
plane('Label_Plane', (0.080, 0.028), (0, T / 2 + 0.0003, 0.012), paper, r)       # back half of the top face
plane('Window', (0.050, 0.016), (0, T / 2 + 0.0002, -0.016), glass, r)            # front half: see-through window
for name, x in (('Reel_Left', -0.017), ('Reel_Right', 0.017)):
    cylinder(name, 0.0085, 0.002, (x, T / 2 + 0.0004, -0.016), reel, r, vertices=20)
for sx in (-0.042, 0.042):
    for sz in (-0.024, 0.024):
        cylinder(f'Screw_{sx:+.3f}_{sz:+.3f}', 0.0027, 0.0012, (sx, T / 2 + 0.0004, sz), screw, r, vertices=10)
export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'cassette_tape.glb'))
