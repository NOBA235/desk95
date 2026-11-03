"""blender -b -P blender/make_room.py   ->  public/models/room_1995.glb
A small 1995 study at night. Origin = floor, at the player's seat (x 0, z 0). Desk top is at y = 0.75.
U-shaped desk: the player sits in the gap in the middle. Window on the LEFT wall (the moonlight comes from there)."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import *
import textures

clear_scene()
r = root('Room_95')
wood = image_material('Desk_Wood', textures.wood(), roughness=0.55)
night = image_material('Window_Night', textures.night_window(), roughness=1.0, emissive=1.1)
poster_m = image_material('Poster', textures.poster(), roughness=0.8)
carpet = material('Carpet', '#1d2a30', 0.0, 0.95)
wall_m = material('Wallpaper', '#4b4a56', 0.0, 0.85)
ceil_m = material('Ceiling', '#9d9aa3', 0.0, 0.9)
trim = material('Trim_White', '#c9c6bf', 0.0, 0.6)
frame_m = material('Window_Frame_Mat', '#d4d0c6', 0.0, 0.5)
glass = material('Window_Glass', '#9fb6d8', 0.0, 0.05, alpha=0.12)
mat_m = material('Desk_Mat', '#1c2b26', 0.0, 0.85)

# ---- room shell: x -1.8..1.8, z -1.5..1.5, height 2.6 ----
RX, RZ, RH, T = 1.8, 1.5, 2.6, 0.05
box('Floor', (2 * RX, 0.02, 2 * RZ), (0, -0.01, 0), carpet, r)
box('Ceiling', (2 * RX, 0.02, 2 * RZ), (0, RH + 0.01, 0), ceil_m, r)
box('Wall_Back', (2 * RX, RH, T), (0, RH / 2, -RZ - T / 2), wall_m, r)
box('Wall_Front', (2 * RX, RH, T), (0, RH / 2, RZ + T / 2), wall_m, r)
box('Wall_Right', (T, RH, 2 * RZ), (RX + T / 2, RH / 2, 0), wall_m, r)
# left wall with a 1.2 x 1.3 m window opening centred at z -0.6, y 0.9..2.2
WZ0, WZ1, WY0, WY1 = -1.2, 0.0, 0.9, 2.2
box('Wall_Left_A', (T, RH, WZ0 + RZ), (-RX - T / 2, RH / 2, (-RZ + WZ0) / 2), wall_m, r)
box('Wall_Left_B', (T, RH, RZ - WZ1), (-RX - T / 2, RH / 2, (WZ1 + RZ) / 2), wall_m, r)
box('Wall_Left_Below', (T, WY0, WZ1 - WZ0), (-RX - T / 2, WY0 / 2, (WZ0 + WZ1) / 2), wall_m, r)
box('Wall_Left_Above', (T, RH - WY1, WZ1 - WZ0), (-RX - T / 2, (WY1 + RH) / 2, (WZ0 + WZ1) / 2), wall_m, r)
box('Baseboard_Back', (2 * RX, 0.10, 0.02), (0, 0.05, -RZ + 0.01), trim, r)

# window: frame, cross bars, sill, glass, and the glowing rainy-night picture behind it
cz, cy = (WZ0 + WZ1) / 2, (WY0 + WY1) / 2
box('Window_Frame_Top', (0.07, 0.05, 1.3), (-RX + 0.02, WY1 - 0.025, cz), frame_m, r)
box('Window_Frame_Bottom', (0.07, 0.05, 1.3), (-RX + 0.02, WY0 + 0.025, cz), frame_m, r)
box('Window_Frame_Front', (0.07, 1.3, 0.05), (-RX + 0.02, cy, WZ1 - 0.025), frame_m, r)
box('Window_Frame_Back', (0.07, 1.3, 0.05), (-RX + 0.02, cy, WZ0 + 0.025), frame_m, r)
box('Window_Bar_V', (0.04, 1.2, 0.03), (-RX + 0.02, cy, cz), frame_m, r)
box('Window_Bar_H', (0.04, 0.03, 1.1), (-RX + 0.02, cy, cz), frame_m, r)
box('Window_Sill', (0.14, 0.03, 1.32), (-RX + 0.07, WY0 - 0.005, cz), frame_m, r)
vplane('Window_Glass', (1.2, 1.3), (-RX + 0.005, cy, cz), glass, r, rot=(0, 90, 0))
vplane('Window_Night', (1.9, 1.9), (-RX - 0.20, cy, cz), night, r, rot=(0, 90, 0))

# poster on the back wall
vplane('Poster', (0.55, 0.69), (1.0, 1.55, -RZ + 0.004), poster_m, r)

# ---- U-shaped desk, top surface at y = 0.75 ----
TOP, TH = 0.75, 0.04
CY = TOP - TH / 2
UV = 0.8
box('Desk_Top_Back', (1.90, TH, 0.82), (0, CY, -0.49), wood, r, bevel=0.002, uv_scale=UV)          # z -0.90..-0.08
box('Desk_Top_Left', (0.40, TH, 0.53), (-0.75, CY, 0.185), wood, r, bevel=0.002, uv_scale=UV)       # wing, z -0.08..0.45
box('Desk_Top_Right', (0.40, TH, 0.53), (0.75, CY, 0.185), wood, r, bevel=0.002, uv_scale=UV)
box('Desk_Panel_Left', (0.04, TOP - TH, 0.74), (-0.91, (TOP - TH) / 2, -0.50), wood, r, uv_scale=UV)
box('Desk_Panel_Right', (0.04, TOP - TH, 0.74), (0.91, (TOP - TH) / 2, -0.50), wood, r, uv_scale=UV)
box('Desk_Panel_Back', (1.78, 0.45, 0.02), (0, 0.45, -0.86), wood, r, uv_scale=UV)
box('Desk_Wing_Panel_Left', (0.04, TOP - TH, 0.45), (-0.93, (TOP - TH) / 2, 0.20), wood, r, uv_scale=UV)
box('Desk_Wing_Panel_Right', (0.04, TOP - TH, 0.45), (0.93, (TOP - TH) / 2, 0.20), wood, r, uv_scale=UV)
box('Desk_Mat', (0.90, 0.001, 0.46), (0, TOP + 0.0005, -0.38), mat_m, r)                          # leather pad the items sit on

export(os.path.join(os.path.dirname(__file__), '..', 'public', 'models', 'room_1995.glb'))
