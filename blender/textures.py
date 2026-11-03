"""Procedural textures (numpy) so the models need no image downloads."""
import numpy as np


def _vnoise(h, w, cells, rs):
    g = rs.rand(cells + 2, cells + 2).astype(np.float32)
    ys = np.linspace(0, cells, h, dtype=np.float32)
    xs = np.linspace(0, cells, w, dtype=np.float32)
    y0, x0 = ys.astype(int), xs.astype(int)
    fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b = g[y0][:, x0], g[y0][:, x0 + 1]
    c, d = g[y0 + 1][:, x0], g[y0 + 1][:, x0 + 1]
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy


def wood(size=512, seed=7):
    rs = np.random.RandomState(seed)
    n = 0.5 * _vnoise(size, size, 4, rs) + 0.3 * _vnoise(size, size, 9, rs) + 0.2 * _vnoise(size, size, 20, rs)
    v = np.linspace(0, 1, size, dtype=np.float32)[:, None]
    t = 0.5 + 0.5 * np.sin((v * 22 + n * 5.0) * 2 * np.pi)          # long grain lines
    t = 0.65 * t + 0.35 * _vnoise(size, size, 40, rs)
    dark, light = np.array([0.20, 0.115, 0.06]), np.array([0.42, 0.26, 0.14])   # sRGB-ish walnut
    img = dark[None, None, :] * (1 - t[..., None]) + light[None, None, :] * t[..., None]
    return np.clip(img, 0, 1)


def night_window(w=512, h=512, seed=3):
    rs = np.random.RandomState(seed)
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    top, bot = np.array([0.012, 0.018, 0.04]), np.array([0.05, 0.075, 0.14])
    img = top[None, None, :] * (1 - yy[..., None]) + bot[None, None, :] * yy[..., None]
    img = np.repeat(img, w, axis=1).astype(np.float32)
    Y, X = np.mgrid[0:h, 0:w].astype(np.float32)
    for _ in range(70):                                              # blurry city lights, lower half
        cx, cy, r = rs.rand() * w, h * (0.45 + 0.55 * rs.rand()), 2.5 + rs.rand() * 7
        col = np.array([[1.0, 0.75, 0.4], [1.0, 0.9, 0.7], [0.6, 0.8, 1.0]][rs.randint(3)]) * (0.35 + 0.5 * rs.rand())
        g = np.exp(-((X - cx) ** 2 + (Y - cy) ** 2) / (2 * r * r))[..., None]
        img += g * col
    for _ in range(90):                                              # rain streaks
        x0, y0 = rs.rand() * w, rs.rand() * h
        L = 20 + rs.rand() * 50
        for k in range(int(L)):
            xx, yy2 = int(x0 + k * 0.18) % w, int(y0 + k) % h
            img[yy2, xx] += np.array([0.10, 0.13, 0.18]) * (1 - k / L)
    return np.clip(img, 0, 1)


def poster(w=512, h=640):
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    X = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    sky = np.array([0.10, 0.02, 0.25])[None, None, :] * (1 - yy[..., None]) + np.array([0.95, 0.3, 0.35])[None, None, :] * yy[..., None]
    img = np.repeat(sky, w, axis=1).astype(np.float32)
    cy = 0.52
    sun = ((X - 0.5) ** 2 * (w / h) ** 2 + (yy - cy) ** 2) < 0.045
    stripes = (np.sin(yy * 120) > -0.2) | (yy < cy)
    img[sun & stripes] = np.array([1.0, 0.85, 0.3])
    hor = yy > 0.62                                                  # ground + perspective grid
    img[np.broadcast_to(hor, (h, w))] = np.array([0.06, 0.02, 0.14])
    gx = np.abs(np.sin((X - 0.5) * (yy - 0.58) * -60 * 3.14159)) > 0.97
    gy = np.abs(np.sin(((yy - 0.62) ** 0.6) * 90)) > 0.97
    grid = (gx | gy) & hor
    img[np.broadcast_to(grid, (h, w))] = np.array([0.9, 0.2, 0.8])
    img[:8, :] = img[-8:, :] = 0.95
    img[:, :8] = img[:, -8:] = 0.95
    return np.clip(img, 0, 1)
