"""blender -b -P blender/make_lamp.py   ->  public/models/desk_lamp.glb
Brass-and-black desk lamp with a swing arm reaching LEFT (-x) over the desk. Origin = base centre.
Lamp_Bulb_Anchor marks where the game puts its warm spotlight."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('Lamp_95')
metal = material('Lamp_Metal', '#25272b', 0.9, 0.35)
brass = material('Lamp_Brass', '#b08a3e', 1.0, 0.3)
shade_m = material('Lamp_Shade', '#1f3b2f', 0.3, 0.45)
bulb_m = material('Lamp_Bulb_Mat', '#6b4a1a', 0.0, 0.3, emission_hex='#ffb86c', emission_strength=6.0)

ARM_Y = 0.32
HEAD_X = -0.26
cylinder('Lamp_Base', 0.085, 0.020, (0, 0.010, 0), metal, r, vertices=36, bevel=0.002)
cylinder('Lamp_Post', 0.008, 0.30, (0, 0.17, 0), brass, r, vertices=16)
cylinder('Lamp_Joint', 0.014, 0.024, (0, ARM_Y, 0), brass, r, vertices=18)
box('Lamp_Arm', (abs(HEAD_X) + 0.02, 0.010, 0.012), (HEAD_X / 2, ARM_Y, 0), brass, r, bevel=0.002)
cylinder('Lamp_Neck', 0.006, 0.030, (HEAD_X, ARM_Y - 0.012, 0), brass, r, vertices=12)
cone('Lamp_Shade', 0.022, 0.075, 0.085, (HEAD_X, ARM_Y - 0.065, 0), shade_m, r)
cylinder('Lamp_Bulb', 0.018, 0.040, (HEAD_X, ARM_Y - 0.092, 0), bulb_m, r, vertices=16)
anchor('Lamp_Bulb_Anchor', (HEAD_X, ARM_Y - 0.115, 0), r)

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'desk_lamp.glb'))
