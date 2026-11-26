#!/usr/bin/env python3
"""Export approved PNGs, assemble review sheets, and check the asset contract.

Run from repository root with Python + Pillow + numpy installed.
Generation and voice edits are performed with image_gen, not this exporter.
"""
from pathlib import Path
import hashlib
import json
import math
from PIL import Image, ImageDraw, ImageFont
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BRAND = ROOT / 'docs/brand'
SOURCE = BRAND / 'source'
APP = ROOT / 'frontend/images/brand'
CREAM = '#FFF4DD'
SHELL = '#FFFDF5'
INK = '#103F40'
CORAL = '#F26350'
STATES = ['ready', 'listening', 'speaking', 'thinking']
CHICKY = ['front', 'three-quarter', 'side', 'head', 'spot-receipt', 'spot-prep',
          'duo-wave', 'empty-egg', 'empty-cheer', 'state-oops', 'state-cooking']
UNCLE = ['avatar', *STATES, 'front', 'three-quarter', 'presenting', 'pointing']
IDS = [f'uncle/{n}' for n in STATES] + [f'chicky/{n}' for n in CHICKY] + [
    f'uncle/{n}' for n in UNCLE if n not in STATES] + ['logo/wordmark']


def font(size=20):
    for p in ['/System/Library/Fonts/Supplemental/Arial.ttf',
              '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size=size)


def rgba(path):
    return Image.open(path).convert('RGBA')


def clean_alpha(im):
    a = np.array(im)
    a[:, :, 3][a[:, :, 3] < 8] = 0
    a[:, :, 3][a[:, :, 3] > 247] = 255
    a[a[:, :, 3] == 0, :3] = 0
    return Image.fromarray(a)


def flatten(im, colour):
    bg = Image.new('RGBA', im.size, colour)
    return Image.alpha_composite(bg, im).convert('RGB')


def label(draw, xy, text, size=20, fill=INK):
    draw.text(xy, text, fill=fill, font=font(size))


def thumb_on(canvas, im, box):
    x, y, w, h = box
    im = im.copy()
    im.thumbnail((w, h), Image.Resampling.LANCZOS)
    canvas.paste(im, (x + (w-im.width)//2, y + (h-im.height)//2), im)


def export():
    entries = []
    for id in IDS:
        src = SOURCE / f'{id}.png'
        im = clean_alpha(rgba(src))
        im.save(src, optimize=True)
        assert im.width == im.height and im.width >= 1024, (id, im.size)
        alpha = np.asarray(im)[:, :, 3]
        assert np.count_nonzero(alpha == 0) > alpha.size * .08, f'{id}: no real alpha'
        assert alpha[0, 0] == alpha[-1, -1] == 0, f'{id}: nontransparent corners'
        if id == 'logo/wordmark':
            continue
        group, name = id.split('/')
        folder = APP / group
        folder.mkdir(parents=True, exist_ok=True)
        if name == 'head':
            # Source art for the logo only: trace-logo.py reads the master in source/chicky/.
            continue
        sizes = [(name, 512)]
        if id == 'uncle/avatar':
            sizes += [('avatar-64', 64)]
        for filename, size in sizes:
            dst = folder / f'{filename}.webp'
            small = im.resize((size, size), Image.Resampling.LANCZOS)
            small.save(dst, 'WEBP', quality=85, method=6, exact=True)
            assert dst.stat().st_size < 80_000, (dst, dst.stat().st_size)
            out = rgba(dst)
            assert out.size == (size, size)
            assert out.getextrema()[3][0] == 0
            entries.append({'path': str(dst.relative_to(ROOT)), 'dimensions': list(out.size),
                            'bytes': dst.stat().st_size,
                            'sha256': hashlib.sha256(dst.read_bytes()).hexdigest()})
    return entries


def contact_sheet(background, filename):
    # Four voice states occupy a dedicated first row, before the remaining assets.
    width, pad, cell, gap = 1440, 36, 256, 18
    rest = [id for id in IDS if id not in [f'uncle/{n}' for n in STATES]]
    rows = math.ceil(len(rest) / 5)
    height = 540 + 330 + rows * 306 + 40
    sheet = Image.new('RGB', (width, height), background)
    draw = ImageDraw.Draw(sheet)
    label(draw, (pad, 24), 'CHICKY / HUAT TOMORROW — CHARACTER ART', 30)
    label(draw, (pad, 72), f'Review surface: {background}  |  PNG masters + transparent WebP exports', 18)
    thumb_on(sheet, rgba(BRAND / 'asset-sheet.png'), (pad, 114, 600, 394))
    label(draw, (680, 136), 'Original brand reference', 25)
    label(draw, (680, 186), 'Chicky is the brand. Uncle is the voice.', 22)
    label(draw, (680, 225), 'Identical framing for the four voice states.', 20)
    colours = [('Ink', INK), ('Yolk', '#FFC629'), ('Coral', CORAL), ('Cream', CREAM), ('Shell', SHELL)]
    for i, (name, colour) in enumerate(colours):
        x = 680 + i*136
        draw.rounded_rectangle((x, 290, x+112, 374), radius=18, fill=colour, outline=INK)
        label(draw, (x, 392), name, 18)
        label(draw, (x, 420), colour, 16)
    label(draw, (pad, 523), 'VOICE STATES — same canvas and shoulder line', 23)
    for i, name in enumerate(STATES):
        x = pad + i*342
        thumb_on(sheet, rgba(SOURCE/f'uncle/{name}.png'), (x, 566, 280, 256))
        label(draw, (x+16, 827), f'uncle/{name}.png', 19)
    for i, id in enumerate(rest):
        x = pad + (i % 5)*(cell+gap)
        y = 892 + (i//5)*306
        thumb_on(sheet, rgba(SOURCE/f'{id}.png'), (x, y, cell, 250))
        label(draw, (x+3, y+258), f'{id}.png', 17)
    sheet.save(BRAND/filename, optimize=True)


def voice_review():
    out = BRAND/'review'
    out.mkdir(exist_ok=True)
    base = rgba(SOURCE/'uncle/ready.png')
    ba = np.array(base)
    app_base = np.array(rgba(APP/'uncle/ready.webp'))
    report = {'canvas': list(base.size), 'states': {}}
    review = Image.new('RGB', (1536, 850), CREAM)
    d = ImageDraw.Draw(review)
    label(d, (24, 16), 'Uncle voice states — top: 50% overlay with ready; bottom: final state', 24)
    for i, name in enumerate(STATES):
        im = rgba(SOURCE/f'uncle/{name}.png')
        assert im.size == base.size
        a = np.array(im)
        solid = a[:, :, 3] > 128
        bounds = Image.fromarray(solid.astype('uint8')*255).getbbox()
        # Voice cleanup uses the ready master's exact alpha and untouched outer pixels.
        alpha_equal = np.array_equal(a[:, :, 3], ba[:, :, 3])
        hair_equal = np.array_equal(a[:int(.26*im.height)], ba[:int(.26*im.height)])
        left_edge_equal = np.array_equal(a[:, :int(.30*im.width)], ba[:, :int(.30*im.width)])
        right_edge_equal = np.array_equal(a[:, int(.82*im.width):], ba[:, int(.82*im.width):])
        assert alpha_equal and hair_equal and left_edge_equal and right_edge_equal, name
        app_state = np.array(rgba(APP/f'uncle/{name}.webp'))
        app_alpha_equal = app_state.shape == app_base.shape and np.array_equal(app_state[:, :, 3], app_base[:, :, 3])
        assert app_alpha_equal, f'{name}: WebP alpha differs from ready'
        report['states'][name] = {'alpha_bbox_at_128': list(bounds),
            'shared_alpha_matte_pixel_identical': alpha_equal,
            'hair_pixels_identical': hair_equal,
            'left_outer_head_and_shoulder_pixels_identical': left_edge_equal,
            'right_outer_head_and_shoulder_pixels_identical': right_edge_equal}
        report['states'][name]['webp_canvas_and_alpha_identical'] = app_alpha_equal
        blend = Image.blend(flatten(base, CREAM), flatten(im, CREAM), .5).convert('RGBA')
        thumb_on(review, blend, (i*384+10, 72, 364, 330))
        thumb_on(review, im, (i*384+10, 460, 364, 330))
        label(d, (i*384+30, 413), name + ' + ready @ 50%', 19)
        label(d, (i*384+30, 806), name, 20)
    review.save(out/'voice-alignment.png', optimize=True)
    (out/'voice-alignment.json').write_text(json.dumps(report, indent=2)+'\n')


def prompt_log():
    records = json.loads((BRAND/'generation-records.json').read_text())
    lines = ['# Chicky character art — generation record', '',
        'Reference: [`asset-sheet.png`](asset-sheet.png). Generated with the built-in '
        '`image_gen.imagegen` tool. The tool does not expose the underlying model version '
        'or a reproducible seed; no seed is invented here.', '',
        'Each generation attached the brand reference. Supporting identity images and '
        'voice-state edit targets are listed per asset. Prompts below are the exact final '
        'strings sent to the tool.', '',
        'PNG masters are square, at least 1024px, RGBA. WebP exports are 512px, quality 85, '
        'with a 64px avatar variant. `head.png` stays a master only, for trace-logo.py. '
        'The wordmark remains source art for #7; it is not a production SVG.', '',
        'Alignment cleanup: `lock-voice.py` preserves ready.png outside the generated '
        'expression/hand regions and applies one shared alpha matte. This prevents '
        'small generative contour changes from causing movement. Export alpha cleanup '
        'sets alpha below 8 to 0 and above 247 to 255, preserving antialiased edges. '
        'No RGB palette replacement or hand-drawn replacement art is used.', '',
        'Export/review workflow: `build-assets.py` (Pillow + numpy); checks in '
        '[review/asset-validation.json](review/asset-validation.json). Voice overlays are in '
        '[review/voice-alignment.png](review/voice-alignment.png).', '']
    for id in IDS:
        record = records[id]
        lines += [f'## `{id}.png`', '', '- Tool: '+record['tool'], '- Seed: not exposed',
                  '- References: '+', '.join('`'+p.split('chicky-hackathon-art/')[-1]+'`' for p in record['refs']),
                  '- Edit chain: '+record.get('editChain', 'New generation using the attached references'),
                  '', '```text', record['prompt'], '```', '']
        if record.get('previous'):
            lines += ['### Earlier attempt (rejected)', '',
                      record.get('editChain', ''), '', '```text',
                      record['previous']['prompt'], '```', '']
    (BRAND/'PROMPTS.md').write_text('\n'.join(lines))


if __name__ == '__main__':
    entries = export()
    contact_sheet(CREAM, 'contact-sheet.png')
    contact_sheet(SHELL, 'contact-sheet-shell.png')
    voice_review()
    prompt_log()
    report = {'png_masters': len(IDS), 'webp_exports': len(entries), 'webp_limit_bytes': 80000,
              'largest_webp_bytes': max(e['bytes'] for e in entries), 'exports': entries}
    (BRAND/'review/asset-validation.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k != 'exports'}, indent=2))
