"""Builds the logo SVGs in frontend/images/brand/ (issue #7).

- logo-mark.svg: Chicky's head, traced from source/chicky/head.png. Every opaque pixel is snapped
  to the nearest brand colour and each colour is traced with potrace as its own layer, stacked in
  paint order: the Ink silhouette first, the fills on top. Ink shows through wherever two fills
  meet, which is the sheet's outline style, and the fills never leave hairline gaps.
- wordmark.svg: "chicky" set in Baloo 2 ExtraBold (800, the app's --font-display) and converted to
  outlines, with the Coral swoosh traced from source/logo/wordmark.png underneath.
- logo-lockup.svg: the two side by side, as at the top centre of the sheet.
- huat-pill.svg: the optional "HUAT TOMORROW" Coral pill.

logo-mark-small.svg, the 16-32px mark, is drawn by hand (no trace) and isn't written here.

    python3 -m venv /tmp/trace
    /tmp/trace/bin/pip install potracer pillow numpy scipy fonttools uharfbuzz
    curl -L -o /tmp/Baloo2.ttf "https://github.com/google/fonts/raw/main/ofl/baloo2/Baloo2%5Bwght%5D.ttf"
    BALOO=/tmp/Baloo2.ttf /tmp/trace/bin/python docs/brand/trace-logo.py
"""
import io
import os
from pathlib import Path

import numpy as np
import potrace
import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "docs" / "brand" / "source"
OUT = ROOT / "frontend" / "images" / "brand"

INK, YOLK, CORAL, SHELL, BEAK = "#103F40", "#FFC629", "#F26350", "#FFFDF5", "#F7941D"
PALETTE = {INK: (16, 63, 64), YOLK: (255, 198, 41), CORAL: (242, 99, 80), SHELL: (255, 253, 245), BEAK: (245, 148, 22)}


def classify(path):
    rgba = np.asarray(Image.open(path).convert("RGBA")).astype(int)
    opaque = rgba[..., 3] > 127
    names = list(PALETTE)
    colours = np.array([PALETTE[n] for n in names])
    nearest = ((rgba[..., None, :3] - colours[None, None]) ** 2).sum(-1).argmin(-1)
    return opaque, {name: opaque & (nearest == i) for i, name in enumerate(names)}


def num(value):
    text = f"{value:.1f}"
    return text[:-2] if text.endswith(".0") else text


def trace(mask, transform):
    """An SVG path for a boolean mask; transform maps pixel (x, y) to output units."""
    # potracer traces the "dark" pixels: values under its blacklevel, so pass the mask inverted.
    curves = potrace.Bitmap(~mask).trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.3)

    def p(point):
        x, y = transform(point.x, point.y)
        return f"{num(x)} {num(y)}"

    parts = []
    for curve in curves:
        parts.append(f"M{p(curve.start_point)}")
        for segment in curve.segments:
            if segment.is_corner:
                parts.append(f"L{p(segment.c)}L{p(segment.end_point)}")
            else:
                parts.append(f"C{p(segment.c1)} {p(segment.c2)} {p(segment.end_point)}")
        parts.append("Z")
    return "".join(parts)


def box(mask, pad=0):
    ys, xs = np.nonzero(mask)
    return xs.min() - pad, ys.min() - pad, xs.max() + 1 + pad, ys.max() + 1 + pad


def paths(layers, indent="  "):
    return "\n".join(f'{indent}<path fill="{colour}" d="{d}"/>' for colour, d in layers if d)


def write(name, width, height, body):
    text = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(width)} {num(height)}" '
            f'width="{num(width)}" height="{num(height)}" role="img" aria-label="Chicky">\n'
            f"  <title>Chicky</title>\n{body}\n</svg>\n")
    (OUT / name).write_text(text)
    print(f"{name}: {num(width)}x{num(height)}, {len(text)} bytes")


def build_mark(size=128):
    opaque, c = classify(SOURCE / "chicky" / "head.png")
    labels, count = ndimage.label(opaque)
    sizes = ndimage.sum(opaque, labels, range(1, count + 1))
    head = ndimage.binary_fill_holes(labels == 1 + int(np.argmax(sizes)))
    burst = opaque & ~head & c[CORAL]          # the burst lines are the coral shapes off the head
    yolk = ndimage.binary_fill_holes(c[YOLK] & head)
    # Eyes and the outlines of the beak and mouth: the non-yolk parts of the face, filled solid in
    # ink so the beak and mouth fills sit on top of them.
    face = ndimage.binary_opening(yolk & ~c[YOLK], iterations=1)
    layers = [(INK, head), (SHELL, c[SHELL] & head), (YOLK, yolk & ~face), (INK, face),
              (CORAL, (c[CORAL] & yolk) | burst), (BEAK, c[BEAK] & yolk)]
    x0, y0, x1, y1 = box(opaque, 6)
    scale = size / max(x1 - x0, y1 - y0)
    traced = [(colour, trace(mask, lambda x, y: ((x - x0) * scale, (y - y0) * scale))) for colour, mask in layers]
    return (x1 - x0) * scale, (y1 - y0) * scale, traced


def baloo():
    font = TTFont(os.environ.get("BALOO", "/tmp/Baloo2.ttf"))
    font = instantiateVariableFont(font, {"wght": 800})
    data = io.BytesIO()
    font.save(data)
    return font, data.getvalue()


def set_text(text, size, tracking=0.0):
    """Outlines text in Baloo 2 800. Returns (path, width, ascent of x-height... box) in a y-down space
    where the baseline is y = 0."""
    font, data = baloo()
    hb_font = hb.Font(hb.Face(data))
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hb_font, buf, {"kern": True, "liga": True})
    upem = font["head"].unitsPerEm
    k = size / upem
    glyphs = font.getGlyphSet()
    order = font.getGlyphOrder()
    pen = SVGPathPen(glyphs, ntos=num)
    x = 0
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        name = order[info.codepoint]
        glyphs[name].draw(TransformPen(pen, (k, 0, 0, -k, (x + pos.x_offset) * k, -pos.y_offset * k)))
        x += pos.x_advance + tracking * upem
    width = (x - tracking * upem) * k
    return pen.getCommands(), width


def bbox_of(path_d):
    from fontTools.svgLib.path import parse_path
    from fontTools.pens.boundsPen import BoundsPen
    pen = BoundsPen(None)
    parse_path(path_d, pen)
    return pen.bounds


def build_wordmark(size=100):
    d, _ = set_text("chicky", size, tracking=-0.02)
    tx0, ty0, tx1, ty1 = bbox_of(d)

    # The swoosh keeps its shape and its horizontal place on the master (scaled by the width of the
    # word), and hangs just under the baseline (y = 0) so it never touches the letters.
    opaque, c = classify(SOURCE / "logo" / "wordmark.png")
    ix0, _, ix1, _ = box(c[INK])
    _, wy0, _, _ = box(c[CORAL])
    s = (tx1 - tx0) / (ix1 - ix0)
    top = size * 0.07
    swoosh = trace(c[CORAL], lambda x, y: (tx0 + (x - ix0) * s, top + (y - wy0) * s))
    sb = bbox_of(swoosh)

    pad = size * 0.04
    x0, y0 = min(tx0, sb[0]) - pad, min(ty0, sb[1]) - pad
    x1, y1 = max(tx1, sb[2]) + pad, max(ty1, sb[3]) + pad
    body = paths([(INK, d), (CORAL, swoosh)], "    ")
    return x1 - x0, y1 - y0, f'  <g transform="translate({num(-x0)} {num(-y0)})">\n{body}\n  </g>'


def build_pill(size=40):
    d, width = set_text("HUAT TOMORROW", size, tracking=0.02)
    tx0, ty0, tx1, ty1 = bbox_of(d)
    padx, pady = size * 0.55, size * 0.32
    w, h = (tx1 - tx0) + 2 * padx, (ty1 - ty0) + 2 * pady
    body = (f'  <rect width="{num(w)}" height="{num(h)}" rx="{num(h * 0.32)}" fill="{CORAL}"/>\n'
            f'  <path fill="{SHELL}" transform="translate({num(padx - tx0)} {num(pady - ty0)})" d="{d}"/>')
    text = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(w)} {num(h)}" width="{num(w)}" height="{num(h)}" '
            f'role="img" aria-label="Huat tomorrow">\n  <title>Huat tomorrow</title>\n{body}\n</svg>\n')
    (OUT / "huat-pill.svg").write_text(text)
    print(f"huat-pill.svg: {num(w)}x{num(h)}, {len(text)} bytes")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    mw, mh, mark = build_mark()
    write("logo-mark.svg", mw, mh, paths(mark))

    ww, wh, word = build_wordmark()
    write("wordmark.svg", ww, wh, word)

    # Lockup: the mark a little taller than the wordmark, tucked slightly into it, centred vertically.
    height = wh * 1.12
    s = height / mh
    gap = -mw * s * 0.02
    mark_group = f'  <g transform="scale({s:.4f})">\n{paths(mark, "    ")}\n  </g>'
    word_group = f'  <g transform="translate({num(mw * s + gap)} {num((height - wh) / 2)})">\n{word}\n  </g>'
    write("logo-lockup.svg", mw * s + gap + ww, height, f"{mark_group}\n{word_group}")

    build_pill()


if __name__ == "__main__":
    main()
