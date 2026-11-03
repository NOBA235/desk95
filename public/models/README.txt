Put your .glb models here. File names must match exactly:

  room_1995.glb       crt_pc_combo.glb    floppy_disk.glb
  boombox_95.glb      vcr_deck.glb        vhs_tape.glb
  pager_95.glb        desk_lamp.glb       cassette_tape.glb

Sub-mesh (child node) names the code looks for are listed in src/scene/AssetRegistry.ts (the PARTS table):
  crt_pc_combo : Screen_Glass, Power_Button, Degauss_Button, DriveSlot_Anchor, Eject_Button
  boombox_95   : Btn_Play, Btn_Stop, Btn_Eject, Cassette_Door, Spool_Left, Spool_Right
  floppy_disk  : Label_Plane          cassette_tape : Label_Plane
  vhs_tape     : Label_Plane
  vcr_deck     : VHS_Slot_Anchor, Btn_Eject
Anything missing is printed in the browser console with the names that DO exist in the file.
