"""blender -b -P blender/make_vcr.py   ->  public/models/vcr_deck.glb
Top-loading VCR: a tape drops into the well on top. Origin = bottom centre, front faces +z.
Parts the game looks for: VHS_Slot_Anchor (tape centre when seated), Btn_Eject (pressed down)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('VCR_95')
body_m = material('VCR_Body', '#1d1e22', 0.0, 0.45)
frame_m = material('VCR_Frame', '#26282d', 0.0, 0.5)
trim = material('VCR_Trim', '#8f9298', 1.0, 0.35)
well = material('VCR_Well', '#08090b', 0.0, 0.8)
disp = material('VCR_Display', '#0b1a0d', 0.0, 0.3, emission_hex='#39ff6a', emission_strength=1.4)
led = material('VCR_LED', '#3b1010', 0.0, 0.3, emission_hex='#ff3b3b', emission_strength=2.0)
eject_m = material('Btn_Eject_Mat', '#cfcfc8', 0.0, 0.4)
btn = material('VCR_Button', '#3a3c42', 0.0, 0.45)

W, D = 0.32, 0.25
BASE, FRAME = 0.060, 0.025                       # base block height, height of the walls around the tape well
H = BASE + FRAME
front = D / 2
box('VCR_Base', (W, BASE, D), (0, BASE / 2, 0), body_m, r, bevel=0.003)

# the well: walls around an opening of 0.202 x 0.112 (a VHS tape is 0.188 x 0.104)
WX, WZ = 0.202, 0.112
side_w = (W - WX) / 2
front_w = (D - WZ) / 2
fy = BASE + FRAME / 2
box('Wall_Left', (side_w, FRAME, D), (-(WX / 2 + side_w / 2), fy, 0), frame_m, r, bevel=0.002)
box('Wall_Right', (side_w, FRAME, D), (WX / 2 + side_w / 2, fy, 0), frame_m, r, bevel=0.002)
box('Wall_Front', (WX, FRAME, front_w), (0, fy, WZ / 2 + front_w / 2), frame_m, r, bevel=0.002)
box('Wall_Back', (WX, FRAME, front_w), (0, fy, -(WZ / 2 + front_w / 2)), frame_m, r, bevel=0.002)
box('Well_Floor', (WX, 0.002, WZ), (0, BASE + 0.001, 0), well, r)
cylinder('Well_Hub_Left', 0.009, 0.006, (-0.027, BASE + 0.005, -0.004), trim, r, vertices=6)
cylinder('Well_Hub_Right', 0.009, 0.006, (0.027, BASE + 0.005, -0.004), trim, r, vertices=6)

# a tape seated here has its centre 5 mm above the frame top minus half its thickness: sits sunk in the well
anchor('VHS_Slot_Anchor', (0, BASE + 0.0185, 0), r)

# eject button on the front wall's top surface, pushed DOWN (-y)
box('Btn_Eject', (0.026, 0.010, 0.018), (0.105, H + 0.003, WZ / 2 + front_w / 2), eject_m, r, bevel=0.001)

# front panel: display, LED, transport buttons
box('Front_Panel', (0.30, 0.040, 0.002), (0, 0.032, front + 0.0005), frame_m, r)
box('Display', (0.060, 0.014, 0.002), (-0.080, 0.040, front + 0.0015), disp, r)
box('LED_Rec', (0.004, 0.004, 0.002), (-0.030, 0.040, front + 0.0015), led, r)
for i, x in enumerate((0.020, 0.050, 0.080, 0.110)):
    box(f'Front_Btn_{i}', (0.020, 0.008, 0.004), (x, 0.040, front + 0.0015), btn, r, bevel=0.0006)
for sx in (-0.13, 0.13):
    for sz in (-0.09, 0.09):
        cylinder(f'Foot_{sx:+.2f}_{sz:+.2f}', 0.008, 0.004, (sx, -0.0, sz), body_m, r, vertices=10)

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'vcr_deck.glb'))
