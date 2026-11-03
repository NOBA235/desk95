"""blender -b -P blender/make_boombox.py   ->  public/models/boombox_95.glb
Compact 90s boombox. Origin = bottom centre, front faces +z. A cassette lies flat in the top deck under a hinged lid.
Parts the game looks for: Btn_Play, Btn_Stop, Btn_Eject, Cassette_Door, Spool_Left, Spool_Right (+ optional Cassette_Anchor)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('Boombox_95')
body_m = material('Boombox_Body', '#26282d', 0.0, 0.45)
trim = material('Boombox_Trim', '#8f9298', 1.0, 0.35)
grille = material('Speaker_Grille', '#121317', 0.0, 0.7)
cone = material('Speaker_Cone', '#2e3037', 0.0, 0.5)
plate = material('Deck_Plate', '#1a1b1f', 0.0, 0.5)
smoke = material('Door_Smoke', '#20242b', 0.0, 0.12, alpha=0.45)
dial = material('Dial_Glow', '#1f1608', 0.0, 0.3, emission_hex='#ffb000', emission_strength=1.6)
b_play = material('Btn_Play_Mat', '#a9d9b2', 0.0, 0.4)
b_stop = material('Btn_Stop_Mat', '#dba3a3', 0.0, 0.4)
b_eject = material('Btn_Eject_Mat', '#cfcfc8', 0.0, 0.4)
spool_m = material('Spindle', '#b9b9b3', 0.6, 0.4)

W, H, D = 0.36, 0.17, 0.13
front = D / 2
TOP = H
box('Boombox_Body', (W, H, D), (0, H / 2, 0), body_m, r, bevel=0.004)

# speakers
for side, x in (('Left', -0.125), ('Right', 0.125)):
    cylinder(f'Speaker_{side}', 0.050, 0.004, (x, 0.085, front + 0.001), grille, r, vertices=36, axis='z')
    cylinder(f'Speaker_Cone_{side}', 0.026, 0.006, (x, 0.085, front + 0.003), cone, r, vertices=28, axis='z')
    cylinder(f'Speaker_Cap_{side}', 0.009, 0.007, (x, 0.085, front + 0.004), trim, r, vertices=16, axis='z')

# front: tuner dial + second (decorative) deck
box('Dial_Window', (0.10, 0.022, 0.002), (0, 0.128, front + 0.001), dial, r)
box('Deck_B_Door', (0.100, 0.044, 0.003), (0, 0.066, front + 0.0015), smoke, r)

# top deck: plate, the two spindles, hinged lid
box('Deck_Plate', (0.112, 0.0008, 0.074), (0, TOP + 0.0004, -0.002), plate, r)
for name, x in (('Spool_Left', -0.017), ('Spool_Right', 0.017)):
    cylinder(name, 0.0075, 0.005, (x, TOP + 0.0025, -0.018), spool_m, r, vertices=6)   # hex spindle so the spin is visible
anchor('Cassette_Anchor', (0, TOP + 0.0069, -0.002), r)                                 # where a cassette's centre sits

HINGE = (0, TOP + 0.017, -0.036)                                                       # lid pivots along its rear edge
door = box('Cassette_Door', (0.108, 0.004, 0.072), (0, TOP + 0.017, 0.0), smoke, r, bevel=0.0006)
set_origin(door, HINGE)
box('Door_Tab', (0.030, 0.004, 0.008), (0, TOP + 0.017, 0.040), trim, door)            # child of the lid, moves with it

# buttons on the front strip. They stick out ~9 mm and are pushed DOWN (-y).
for name, x, m in (('Btn_Play', -0.026, b_play), ('Btn_Stop', 0.0, b_stop), ('Btn_Eject', 0.026, b_eject)):
    box(name, (0.020, 0.010, 0.018), (x, TOP + 0.004, 0.050), m, r, bevel=0.0008)

# carry handle + antenna
box('Handle_Bar', (0.20, 0.010, 0.016), (0, TOP + 0.045, -0.05), trim, r, bevel=0.002)
for x in (-0.10, 0.10):
    box(f'Handle_Post_{x:+.2f}', (0.012, 0.040, 0.016), (x, TOP + 0.020, -0.05), trim, r)
cylinder('Antenna', 0.0025, 0.17, (0.14, TOP + 0.085, -0.045), trim, r, vertices=8)
cylinder('Antenna_Tip', 0.005, 0.008, (0.14, TOP + 0.174, -0.045), trim, r, vertices=10)

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'boombox_95.glb'))
