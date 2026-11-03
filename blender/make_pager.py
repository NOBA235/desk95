"""blender -b -P blender/make_pager.py   ->  public/models/pager_95.glb
A translucent 1995 pager lying on a small dot-matrix printer dock. Origin = bottom centre, front faces +z.
Poke Btn_Page to ask the agent for tasks; floppies come out of the dock slot at Receipt_Slot_Anchor."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('Pager_95')
dock_m = material('Dock_Body', '#3a3c42', 0.0, 0.5)
dark = material('Dock_Dark', '#0d0e11', 0.0, 0.5)
paper = material('Receipt_Paper', '#f4f1e8', 0.0, 0.9)
stripe = material('Dock_Stripe', '#c2343f', 0.0, 0.5)
shell = material('Pager_Shell', '#3f66b8', 0.0, 0.15, alpha=0.5)       # translucent blue plastic
pcb = material('Pager_PCB', '#1f5b3a', 0.0, 0.5)
chip = material('Pager_Chip', '#15161a', 0.0, 0.4)
gold = material('Pager_Gold', '#c9a24a', 1.0, 0.3)
lcd = material('Pager_LCD', '#6f8f72', 0.0, 0.3, emission_hex='#86c48c', emission_strength=0.9)
pad = material('Btn_Page_Mat', '#e8e3d6', 0.0, 0.45)
small = material('Pager_SmallBtn', '#22252b', 0.0, 0.4)

# dock (the "dot-matrix printer")
DW, DH, DD = 0.13, 0.040, 0.10
box('Printer_Dock', (DW, DH, DD), (0, DH / 2, 0), dock_m, r, bevel=0.003)
box('Receipt_Slot', (0.100, 0.005, 0.004), (0, 0.022, DD / 2 + 0.0005), dark, r)
box('Receipt_Paper', (0.085, 0.0008, 0.030), (0, 0.0245, DD / 2 + 0.014), paper, r)
box('Dock_Stripe', (0.110, 0.004, 0.002), (0, 0.010, DD / 2 + 0.0005), stripe, r)
cylinder('Dock_LED', 0.0025, 0.002, (0.052, 0.032, DD / 2 + 0.0008), lcd, r, vertices=10, axis='z')
anchor('Receipt_Slot_Anchor', (0, 0.030, DD / 2 + 0.030), r)           # where new floppies appear

# pager lying flat on top of the dock
PY = DH + 0.010                                                          # centre height of the pager body
box('Pager_Body', (0.066, 0.020, 0.052), (0, PY, -0.004), shell, r, bevel=0.003)
box('Pager_PCB', (0.058, 0.002, 0.044), (0, PY - 0.003, -0.004), pcb, r)
box('Pager_Chip_A', (0.014, 0.003, 0.014), (-0.014, PY, -0.008), chip, r)
box('Pager_Chip_B', (0.010, 0.003, 0.008), (0.012, PY, -0.012), chip, r)
box('Pager_Battery', (0.040, 0.006, 0.012), (0, PY + 0.003, 0.010), gold, r)
TOP = PY + 0.010
plane('Pager_Screen', (0.040, 0.014), (0, TOP + 0.0004, -0.016), lcd, r)  # the game could paint text here
box('Btn_Page', (0.030, 0.005, 0.012), (0, TOP + 0.0015, 0.014), pad, r, bevel=0.001)
for x in (-0.022, 0.022):
    box(f'Pager_Btn_{x:+.3f}', (0.008, 0.003, 0.006), (x, TOP + 0.001, 0.014), small, r)

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'pager_95.glb'))
