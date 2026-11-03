"""blender -b -P blender/make_floppy.py   ->  public/models/floppy_disk.glb
Floppy lies flat, label up, shutter end towards -z (the way it slides into the drive)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *

clear_scene()
r = root('Floppy_95')
plastic = material('Floppy_Plastic', '#2b2e36', 0.0, 0.55)
metal = material('Floppy_Shutter', '#c9ccd1', 1.0, 0.28)
paper = material('Label_Paper', '#f1efe6', 0.0, 0.85)

W, T, D = 0.090, 0.0033, 0.094                       # width x, thickness y, depth z
box('Floppy_Body', (W, T, D), (0, 0, 0), plastic, r, bevel=0.0012)
box('Shutter', (0.026, T + 0.0009, 0.026), (0.005, 0, -D / 2 + 0.014), metal, r, bevel=0.0004)
box('Write_Tab', (0.006, T + 0.0004, 0.006), (W / 2 - 0.008, 0, D / 2 - 0.006), plastic, r)
cylinder('Hub', 0.0125, 0.0007, (0, -T / 2 - 0.0002, 0.0), metal, r)
plane('Label_Plane', (0.062, 0.050), (0, T / 2 + 0.0003, 0.018), paper, r)   # the game paints the task sticker here
export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'floppy_disk.glb'))
