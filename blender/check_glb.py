"""python3 blender/check_glb.py [public/models]
Checks every .glb: required part names, triangle count and file size. Pure Python, tiny memory."""
import json, os, struct, sys

PARTS = {
    'crt_pc_combo.glb': ['Screen_Glass', 'Power_Button', 'Degauss_Button', 'DriveSlot_Anchor', 'Eject_Button'],
    'boombox_95.glb': ['Btn_Play', 'Btn_Stop', 'Btn_Eject', 'Cassette_Door', 'Spool_Left', 'Spool_Right'],
    'floppy_disk.glb': ['Label_Plane'],
    'cassette_tape.glb': ['Label_Plane'],
    'vhs_tape.glb': ['Label_Plane'],
    'vcr_deck.glb': ['VHS_Slot_Anchor', 'Btn_Eject'],
    'room_1995.glb': [], 'pager_95.glb': [], 'desk_lamp.glb': [],
}
TRI_BUDGET = 20000


def read_glb(path):
    with open(path, 'rb') as f:
        magic, _ver, _len = struct.unpack('<4sII', f.read(12))
        if magic != b'glTF':
            raise ValueError('not a GLB file')
        clen, ctype = struct.unpack('<II', f.read(8))
        return json.loads(f.read(clen))


def triangles(g):
    total = 0
    for m in g.get('meshes', []):
        for p in m.get('primitives', []):
            acc = p.get('indices')
            count = g['accessors'][acc]['count'] if acc is not None else g['accessors'][p['attributes']['POSITION']]['count']
            total += count // 3
    return total


def main(folder):
    ok = True
    for name, need in PARTS.items():
        path = os.path.join(folder, name)
        if not os.path.exists(path):
            print(f'  MISSING FILE  {name}')
            ok = False
            continue
        g = read_glb(path)
        names = {n.get('name', '') for n in g.get('nodes', [])}
        miss = [p for p in need if not any(n == p or n.startswith(p) for n in names)]
        tris = triangles(g)
        kb = os.path.getsize(path) / 1024
        imgs = len(g.get('images', []))
        flags = []
        if miss:
            flags.append('missing parts: ' + ', '.join(miss))
        if tris > TRI_BUDGET:
            flags.append(f'{tris} triangles is a lot for Quest')
        print(f"  {'OK  ' if not flags else 'FIX '} {name:20s} {tris:6d} tris  {kb:7.0f} KB  {imgs} image(s)  {'; '.join(flags)}")
        if miss:
            print(f"        node names found: {', '.join(sorted(n for n in names if n))}")
        ok = ok and not flags
    print('ALL GOOD' if ok else 'Some models need attention (files that do not exist yet are listed as MISSING FILE)')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'public', 'models'))
