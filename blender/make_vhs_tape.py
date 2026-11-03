"""blender -b -P blender/make_vhs_tape.py   ->  public/models/vhs_tape.glb
VHS cassette lying flat, label up, tape flap towards -z. Origin = centre."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('VHS_95')
shell = material('VHS_Shell', '#17181c', 0.0, 0.4)
flap = material('VHS_Flap', '#2b2d33', 0.0, 0.35)
glass = material('VHS_Window', '#06080b', 0.0, 0.1, alpha=0.85)
reel = material('VHS_Reel', '#d8d6cf', 0.0, 0.6)
paper = material('Label_Paper', '#f1efe6', 0.0, 0.85)

W, T, D = 0.188, 0.025, 0.104
box('VHS_Body', (W, T, D), (0, 0, 0), shell, r, bevel=0.002)
box('VHS_Flap', (0.172, T - 0.003, 0.006), (0, 0, -D / 2 + 0.001), flap, r)             # the lid that opens in the VCR
plane('Label_Plane', (0.120, 0.046), (0, T / 2 + 0.0003, 0.020), paper, r)               # the game paints the title here
plane('VHS_Window', (0.100, 0.020), (0, T / 2 + 0.0002, -0.026), glass, r)
for name, x in (('VHS_Reel_Left', -0.027), ('VHS_Reel_Right', 0.027)):
    cylinder(name, 0.0105, 0.002, (x, T / 2 + 0.0006, -0.026), reel, r, vertices=18)
export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'vhs_tape.glb'))
