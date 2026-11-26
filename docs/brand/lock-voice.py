"""Lock unchanged portrait pixels after tool edits, as required for state swapping.

Keeps all generated expressions; the ready master supplies the untouched hair,
ears, head silhouette and shoulders. This is alignment/edge export cleanup,
not a new illustration. Original tool outputs are kept in work/raw-voice/.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import json

root=Path(__file__).resolve().parents[2]
folder=root/'docs/brand/source/uncle'
raw=root/'work/raw-voice'
raw.mkdir(exist_ok=True)
for name in ['ready','listening','speaking','thinking']:
    target=raw/f'{name}.png'
    if not target.exists():
        target.write_bytes((folder/f'{name}.png').read_bytes())
base=Image.open(raw/'ready.png').convert('RGBA')
w,h=base.size
# Very faint alpha noise outside the subject is not part of the art.
ba=np.array(base)
ba[:,:,3][ba[:,:,3]<8]=0
ba[:,:,3][ba[:,:,3]>247]=255
ba[ba[:,:,3]==0,:3]=0
base=Image.fromarray(ba)
base.save(folder/'ready.png',optimize=True)
for name in ['listening','speaking','thinking']:
    edit=Image.open(raw/f'{name}.png').convert('RGBA')
    assert edit.size==base.size
    mask=Image.new('L',base.size,0)
    d=ImageDraw.Draw(mask)
    # Brow/eye expression zone. Excludes hair, ears and outer head contour.
    d.rounded_rectangle((int(.337*w),int(.275*h),int(.654*w),int(.465*h)),radius=12,fill=255)
    # Mouth below moustache, wholly inside face.
    d.rounded_rectangle((int(.405*w),int(.528*h),int(.590*w),int(.620*h)),radius=12,fill=255)
    if name=='thinking':
        d.polygon([(int(x*w),int(y*h)) for x,y in [(.43,.60),(.43,.69),(.51,.75),(.58,.82),(.64,.89),(.76,.89),(.79,.85),(.71,.75),(.59,.66),(.59,.57),(.52,.57)]],fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(3))
    result=Image.composite(edit,base,mask)
    # A single shared alpha matte makes all head/shoulder contours identical.
    result.putalpha(base.getchannel('A'))
    result.save(folder/f'{name}.png',optimize=True)
    record_path=root/'work'/f'uncle-{name}.json'
    record=json.loads(record_path.read_text())
    record['editChain']='Edited from uncle/ready.png with image_gen; export cleanup copies only face-expression pixels (plus thinking hand) onto the ready master, retaining its exact outer pixels and shared alpha matte.'
    record_path.write_text(json.dumps(record))
print('Locked voice-state hair, ears, silhouette and shoulders to ready.png; expressions retained.')
