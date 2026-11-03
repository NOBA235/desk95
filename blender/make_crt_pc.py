"""blender -b -P blender/make_crt_pc.py   ->  public/models/crt_pc_combo.glb
A 1995 beige desktop PC with a 14" CRT monitor on top. Origin = bottom centre of the PC case, front faces +z.
Parts the game looks for: Screen_Glass, Power_Button, Degauss_Button, DriveSlot_Anchor, Eject_Button."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('CRT_PC_95')
beige = material('Beige_ABS', '#cfc5aa', 0.0, 0.5)
beige_dark = material('Beige_Dark', '#b3a98f', 0.0, 0.55)
black = material('Black_Plastic', '#0e0f12', 0.0, 0.4)
grey = material('Button_Grey', '#8d8a80', 0.0, 0.45)
glass = material('Screen_Glass_Mat', '#04070a', 0.0, 0.05)
led_g = material('LED_Green', '#1b3b22', 0.0, 0.3, emission_hex='#37ff6a', emission_strength=3.0)
led_a = material('LED_Amber', '#3b2a10', 0.0, 0.3, emission_hex='#ffb000', emission_strength=2.0)

# ---- PC case (desktop style, lies flat) ----
CW, CH, CD = 0.43, 0.12, 0.40
box('PC_Case', (CW, CH, CD), (0, CH / 2, 0), beige, r, bevel=0.003)
front = CD / 2                                             # z of the case front face

# 3.5" floppy bay (left) with the slot, 5.25" CD bay (right)
box('Floppy_Bay', (0.105, 0.030, 0.004), (-0.11, 0.078, front + 0.0015), beige_dark, r, bevel=0.0008)
box('Floppy_Slot', (0.090, 0.0055, 0.003), (-0.11, 0.078, front + 0.0035), black, r)
box('CD_Bay', (0.150, 0.034, 0.004), (0.10, 0.078, front + 0.0015), beige_dark, r, bevel=0.0008)
box('CD_Slot', (0.120, 0.004, 0.003), (0.10, 0.082, front + 0.0035), black, r)
box('Eject_Button', (0.014, 0.008, 0.010), (-0.045, 0.062, front + 0.003), grey, r, bevel=0.0008)   # pushes into -z
box('LED_Power', (0.004, 0.003, 0.002), (0.17, 0.040, front + 0.001), led_g, r)
box('LED_Disk', (0.004, 0.003, 0.002), (0.155, 0.040, front + 0.001), led_a, r)
box('Vent_Strip', (0.20, 0.003, 0.002), (-0.08, 0.030, front + 0.001), beige_dark, r)

# seated floppy pose: flat, rear edge ~1 cm outside the slot. +z of the anchor faces the player.
anchor('DriveSlot_Anchor', (-0.11, 0.078, front - 0.037), r)

# ---- CRT monitor on top ----
base_y = CH + 0.015
cylinder('Monitor_Base', 0.09, 0.015, (0, CH + 0.0075, 0.02), beige_dark, r, vertices=32)
MH, bezel_w = 0.335, 0.37
bezel_depth = 0.065
mon_front = 0.19                                           # z of the monitor front face
mid_y = base_y + MH / 2
box('Monitor_Bezel', (bezel_w, MH, bezel_depth), (0, mid_y, mon_front - bezel_depth / 2), beige, r, bevel=0.006)
box('Monitor_Mid', (0.33, 0.30, 0.08), (0, mid_y - 0.004, mon_front - bezel_depth - 0.04), beige, r, bevel=0.005)
box('Monitor_Rear', (0.26, 0.24, 0.12), (0, mid_y - 0.01, mon_front - bezel_depth - 0.08 - 0.06), beige_dark, r, bevel=0.005)

# glass: 4:3, sits 1.5 mm in front of the bezel face so the bezel stays visible as a frame
GW, GH = 0.28, 0.21
glass_y = base_y + 0.065 + GH / 2
vplane('Screen_Glass', (GW, GH), (0, glass_y, mon_front + 0.0015), glass, r)

# controls on the bezel's bottom strip. Buttons stick out ~8 mm and push into -z.
btn_y = base_y + 0.030
box('Power_Button', (0.016, 0.010, 0.010), (0.140, btn_y, mon_front + 0.003), grey, r, bevel=0.001)
box('Degauss_Button', (0.012, 0.008, 0.010), (0.112, btn_y, mon_front + 0.003), black, r, bevel=0.001)
box('Badge', (0.040, 0.007, 0.002), (-0.130, btn_y, mon_front + 0.001), black, r)
box('Monitor_LED', (0.004, 0.003, 0.002), (0.165, btn_y, mon_front + 0.001), led_g, r)

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'crt_pc_combo.glb'))
