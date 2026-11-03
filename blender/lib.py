"""
Tiny helpers for building Desk '95 models with Blender's Python API (works headless, no GUI).

COORDINATES: every position/size you pass in is in glTF / three.js space, the same space the game code uses:
    x = right, y = UP, z = towards the player (a model's front faces +z).  Units are metres.
The helpers convert to Blender's Z-up space for you.
"""
import math
import os
import bpy
from mathutils import Vector


def hexc(h):
    """'#rrggbb' -> linear RGB tuple for Blender."""
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (0, 2, 4))


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def material(name, color_hex, metallic=0.0, roughness=0.5, alpha=1.0, emission_hex=None, emission_strength=2.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hexc(color_hex), 1.0)
    b.inputs['Metallic'].default_value = metallic
    b.inputs['Roughness'].default_value = roughness
    if emission_hex:
        for sock in ('Emission Color', 'Emission'):          # name differs between Blender 3.x and 4.x
            if sock in b.inputs:
                b.inputs[sock].default_value = (*hexc(emission_hex), 1.0)
                break
        if 'Emission Strength' in b.inputs:
            b.inputs['Emission Strength'].default_value = emission_strength
    if alpha < 1.0:
        b.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    return m


def _rot(rot):
    """Degrees about glTF x/y/z -> Blender Euler. Use one axis at a time."""
    rx, ry, rz = (math.radians(a) for a in rot)
    return (rx, -rz, ry)


def _g(v):
    """glTF (x, y_up, z_front) -> Blender (x, -z, y)."""
    return Vector((v[0], -v[2], v[1]))


def _finish(obj, name, mat, parent, bevel):
    obj.name = name
    obj.data.name = name
    if mat:
        obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth()
    if parent:
        bpy.context.view_layer.update()
        obj.parent = parent
        obj.matrix_parent_inverse = parent.matrix_world.inverted()   # keep the world position even if the parent's origin moved
    return obj


def root(name):
    """Empty at the origin that every part is parented to (becomes the top glTF node)."""
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    return o


def box(name, size, loc, mat=None, parent=None, bevel=0.0, rot=None, uv_scale=None):
    """size = (width x, height y, depth z), loc = centre. Both in glTF space. rot = degrees (rx, ry, rz).
    uv_scale: metres per texture repeat (box-projects UVs so textures keep their real-world size)."""
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.scale = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(scale=True)
    if uv_scale:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.cube_project(cube_size=uv_scale)
        bpy.ops.object.mode_set(mode='OBJECT')
    if rot:
        o.rotation_euler = _rot(rot)
        bpy.ops.object.transform_apply(rotation=True)
    o.location = _g(loc)
    return _finish(o, name, mat, parent, bevel)


def cylinder(name, radius, height, loc, mat=None, parent=None, bevel=0.0, vertices=24, axis='y', rot=None):
    """Cylinder along glTF y (upright, default) or z (pointing at the player, e.g. a speaker)."""
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=height, vertices=vertices)
    o = bpy.context.active_object
    if axis == 'z':
        o.rotation_euler = (math.radians(90), 0, 0)
        bpy.ops.object.transform_apply(rotation=True)
    if rot:
        o.rotation_euler = _rot(rot)
        bpy.ops.object.transform_apply(rotation=True)
    o.location = _g(loc)
    return _finish(o, name, mat, parent, bevel)


def cone(name, r_top, r_bottom, height, loc, mat=None, parent=None, vertices=32):
    """Upright truncated cone (a lamp shade). r_bottom is the wide, open end at the bottom."""
    bpy.ops.mesh.primitive_cone_add(radius1=r_bottom, radius2=r_top, depth=height, vertices=vertices)
    o = bpy.context.active_object
    o.location = _g(loc)
    return _finish(o, name, mat, parent, 0.0)


def plane(name, size, loc, mat=None, parent=None):
    """Flat plane lying in the x/z plane, facing UP (+y). UVs cover 0..1; v grows towards -z (away from player)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    o.location = _g(loc)
    return _finish(o, name, mat, parent, 0.0)


def set_origin(obj, loc):
    """Move an object's pivot to loc (glTF space) without moving its shape. Use it for hinges: the game rotates around the pivot."""
    cur = bpy.context.scene.cursor.location.copy()
    bpy.context.scene.cursor.location = _g(loc)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.context.scene.cursor.location = cur


def anchor(name, loc, parent=None):
    """Invisible marker node (an Empty) the game reads a position/rotation from. +z of the anchor faces the player."""
    o = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(o)
    o.location = _g(loc)
    if parent:
        o.parent = parent
    return o


def vplane(name, size, loc, mat=None, parent=None, rot=None):
    """Upright plane facing the player (+z). UVs cover 0..1, u grows to the right, v grows upwards.
    rot=(0, 90, 0) turns it to face +x (a left-wall window)."""
    bpy.ops.mesh.primitive_plane_add(size=1)
    o = bpy.context.active_object
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(scale=True)
    o.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    if rot:
        o.rotation_euler = _rot(rot)
        bpy.ops.object.transform_apply(rotation=True)
    o.location = _g(loc)
    return _finish(o, name, mat, parent, 0.0)


def image_material(name, pixels, roughness=0.6, metallic=0.0, emissive=0.0, alpha=None):
    """pixels = numpy float array (H, W, 3) in 0..1 sRGB. Packed into the .glb. emissive>0 makes it glow by itself."""
    import numpy as np
    h, w = pixels.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=True)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[..., :3] = pixels
    img.pixels.foreach_set(rgba.ravel())
    img.colorspace_settings.name = 'sRGB'
    img.pack()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = roughness
    b.inputs['Metallic'].default_value = metallic
    if emissive > 0:
        for sock in ('Emission Color', 'Emission'):
            if sock in b.inputs:
                nt.links.new(tex.outputs['Color'], b.inputs[sock])
                break
        b.inputs['Emission Strength'].default_value = emissive
    return m


def export(path):
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_yup=True,
        export_apply=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
    )
    print(f'exported {path}')
