# Chicky character art — generation record

Reference: [`asset-sheet.png`](asset-sheet.png). Generated with the built-in `image_gen.imagegen` tool. The tool does not expose the underlying model version or a reproducible seed; no seed is invented here.

Each generation attached the brand reference. Supporting identity images and voice-state edit targets are listed per asset. Prompts below are the exact final strings sent to the tool.

PNG masters are square, at least 1024px, RGBA. WebP exports are 512px, quality 85, with a 64px avatar variant. `head.png` is also supplied at 1024px in the app path. The wordmark remains source art for #7; it is not a production SVG.

Alignment cleanup: `lock-voice.py` preserves ready.png outside the generated expression/hand regions and applies one shared alpha matte. This prevents small generative contour changes from causing movement. Export alpha cleanup sets alpha below 8 to 0 and above 247 to 255, preserving antialiased edges. No RGB palette replacement or hand-drawn replacement art is used.

Export/review workflow: `build-assets.py` (Pillow + numpy); checks in [review/asset-validation.json](review/asset-validation.json). Voice overlays are in [review/voice-alignment.png](review/voice-alignment.png).

## `uncle/ready.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY. The master voice-state portrait. Head and shoulders, facing exactly front, gentle closed-mouth smile, happy relaxed eyes. Both shoulders level and symmetrical; cropped at mid chest. Centre his head on x=512. Hair top around y=150, eye line around y=440, chin around y=660, shoulder line around y=740, bust bottom at y=880. At least 100px empty margin on every side. Cream shirt collar and coral apron straps visible. No hands. No circular frame, no background, no sound waves, no thought bubbles, no dots, no burst lines. This exact head size, position, shoulders, hair, glasses, moustache, collar, apron and crop will be reused unchanged for listening, speaking and thinking states.
Strict flat-colour correction: use ONE uniform tan fill for ALL skin, ONE solid grey for hair with one small flat Shell highlight. ONE solid Coral for apron, ONE solid Cream for shirt. No airbrushing, gradient, glow, noise or highlights on skin. Match the reference's graphic cel drawing. Avoid overly enlarged head relative to reference.
```

## `uncle/listening.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: Edited from uncle/ready.png with image_gen; export cleanup copies only face-expression pixels (plus thinking hand) onto the ready master, retaining its exact outer pixels and shared alpha matte.

```text
Use case: precise-object-edit. Image 1 is the mandatory brand STYLE reference docs/brand/asset-sheet.png. Image 2 is ready.png, the EDIT TARGET and exact layout master. Edit image 2 only: change facial expression to attentive listening, eyebrows raised, eyes open behind the same glasses, mouth a small o beneath unchanged white moustache; a subtle listening head tilt may be suggested by face alone but DO NOT rotate, move or resize the head silhouette. Preserve canvas dimensions, alpha background, head position and size, hair silhouette and every lock, ears, glasses frames, nose, moustache silhouette, shoulder line, shirt collar, apron and crop EXACTLY, pixel aligned with image 2. No props, no hands, no sound waves, no burst lines, no thought bubbles or dots. Same flat fills, thick Ink #103F40 outlines, Cream shirt, Coral apron as sheet. Return one square transparent PNG portrait, identical framing.
```

## `uncle/speaking.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: Edited from uncle/ready.png with image_gen; export cleanup copies only face-expression pixels (plus thinking hand) onto the ready master, retaining its exact outer pixels and shared alpha matte.

```text
Use case: precise-object-edit. Image 1 is mandatory brand STYLE reference docs/brand/asset-sheet.png. Image 2 is ready.png, the EDIT TARGET and exact layout master. Edit image 2 ONLY within the face: friendly laughing/talking expression with open smiling mouth beneath his white moustache, cheerful closed eyes. Preserve EXACT canvas dimensions, transparent alpha, hair outline, head silhouette, head size and position, ears, glasses frames, nose, moustache, neck, shoulders, cream collar, coral apron, crop and all outside-face pixels. No head rotation, no movement, no resize. No hands, no soundwaves, no bursts, no thought bubbles, no dots or background. Same flat palette and thick Ink outlines as sheet. One square transparent PNG portrait aligned exactly to ready.png.
```

## `uncle/thinking.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: Edited from uncle/ready.png with image_gen; export cleanup copies only face-expression pixels (plus thinking hand) onto the ready master, retaining its exact outer pixels and shared alpha matte.

```text
Use case: precise-object-edit. Image 1 is mandatory brand STYLE reference docs/brand/asset-sheet.png. Image 2 is ready.png, the EDIT TARGET and exact layout master. Edit image 2 only: thoughtful gentle expression, eyes looking upward within SAME glasses, small closed thoughtful smile, one hand resting naturally on chin. Change only face expression and add that hand/forearm over existing torso. Preserve EXACT canvas dimensions, transparent alpha, head size and position, hair silhouette, ears, glasses frames, nose, white moustache identity, neck, shoulders and shoulder baseline, cream collar, coral apron and waist crop. Do not move, rotate or resize the head or shoulders. No sound waves, no bursts, no thought bubble, no dots or other decorations. Same flat colours/thick Ink outlines as sheet. Return one square transparent PNG portrait exactly aligned with ready.png.
```

## `chicky/front.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body. Standing facing exactly front, happy smiling open orange beak, left wing giving thumbs up on viewer's right, other wing on hip. Two short feet on same baseline. Shell, white towel over viewer's left shoulder, coral apron and front pocket exactly as model sheet. No props or burst lines.
```

## `chicky/three-quarter.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body. Same standing thumbs-up and other-wing-on-hip pose as the sheet, but clear three-quarter view turned slightly toward viewer's right. Same body proportions, eggshell cap shape, towel and apron as sheet. No props, no burst lines.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/view as requested. Keep fills flat and simple.
```

## `chicky/side.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body. Strict side profile facing right, standing, small smiling orange beak seen in profile, closed happy eye. Same eggshell cap, white shoulder towel, coral pocket apron. Wings relaxed at sides. No props or burst lines.
```

## `chicky/head.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY HEAD ONLY, facing front: the bold simple logo mark from top centre of the sheet. Round yolk-yellow chick face in its white cracked eggshell, closed happy upturned eyes, coral cheek marks, orange smiling beak. Exactly THREE small coral burst lines above the upper right of head. No neck, no body, no apron, no towel, no lettering or swoosh. Large simple silhouette that remains readable at 32px. All three burst lines included with clear padding.
```

## `chicky/spot-receipt.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body, happily holding up one long Shell-coloured paper receipt in left wing on viewer's right. Receipt contains only simple short Ink strokes representing entries, absolutely no letters or numbers. Other wing on hip. Same shell cap, white towel, coral pocket apron and model proportions. No extra decorations.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/view as requested. Keep fills flat and simple.
```

## `chicky/spot-prep.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`, `docs/brand/source/chicky/spot-prep.png`
- Edit chain: Edited initial spot-prep to remove unwanted glow and recompose as square.

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body, pointing to a small suspended wall-style calendar on viewer's right with simple blank grid and ONE coral red check mark, beside three low wooden crates containing leafy greens, tomatoes and eggs. No actual wall or scenery: all objects form a clean isolated spot illustration on transparent. Same shell cap, towel, coral pocket apron, proportions and face. No numbers or lettering on calendar. Keep chick prominent and all crates/props fully visible.
CORRECT IMAGE 3, the edit target: REMOVE every green glow, bloom, halo and soft background pixel. Remove the coral burst decorations. Only hard-edged isolated character/calendar/crates remain on genuine clean transparent alpha. Recompose to a SQUARE 1:1 canvas, not a landscape. Match IMAGE 2 chick proportions and squeezed happy eyes exactly. No lighting, no glow, no blur, no ground shadow, no outer aura. Completely flat graphic spot illustration. Plenty of even transparent margin around all sides.
```

## `chicky/duo-wave.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

BOTH CHARACTERS together, full body welcome pose: Chicky on viewer's left, Uncle on viewer's right. BOTH wave at viewer with their outer free arm; Uncle's other hand gently rests on Chicky's shoulder. Chicky about waist high to Uncle. Same exact character models as sheet: chick shell/towel/pocket apron, Uncle swept grey hair/round glasses/white moustache/cream collared shirt/coral apron/Ink shorts/brown sandals. Warm big smiles. No extra characters, no scenery, no extra hands, no decoration.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/view as requested. Keep fills flat and simple.
```

## `chicky/empty-egg.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY, curled up peacefully asleep inside a larger cracked eggshell bottom. Keep its signature matching white eggshell cap ON its head, closed sleepy eyes, tiny beak, rosy cheeks and coral apron/towel glimpsed above shell rim. Tiny curled wings tucked in. Add two tiny dark-green lowercase z sleep marks above head, the only lettering allowed. Simple cosy isolated illustration, no ground, no shadow.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/expression as requested. Flat solid fills.
```

## `chicky/empty-cheer.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body, jumping joyfully with both wings raised high in celebration, feet tucked slightly up, closed happy eyes and open smiling orange beak. Same shell cap, towel, coral apron and pocket. Two or three small coral burst lines beside raised wings. No confetti, no ground, no shadow.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/expression as requested. Flat solid fills.
```

## `chicky/state-oops.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY full body, flustered but friendly expression, eyes squeezed into small concerned curves and tiny apologetic open beak. One small teal sweat drop by temple; one wing touching cheek. A small cream rice bowl tipped over beside feet on viewer's right, with just a few grains spilled. Same shell cap, white towel and coral pocket apron. No ground or shadow, no warning symbols, no text.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/expression as requested. Flat solid fills.
```

## `chicky/state-cooking.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/chicky/front.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

CHICKY ONLY, full body standing behind one simple small dark-green wok, happily stirring it with a ladle held by one wing; other wing steadying wok handle safely. Wok floats as isolated prop at waist height, no stove, no scenery. Two small cream steam curls with Ink outlines. Same exact shell cap, white shoulder towel, coral pocket apron, happy face and short orange feet. All anatomy and wok completely visible.
Image 2 is the approved Chicky front pose identity master. Keep exactly that chick's face, shell-cap silhouette, towel, apron, contour weight and body/head ratio; only change pose/props/expression as requested. Flat solid fills.
```

## `uncle/avatar.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY circular head-and-shoulders avatar, EXACT portrait identity and facial proportions from sheet's upper-right circle. Facing front, cheerful warm smile, grey swept-back hair, round dark-rimmed glasses, white moustache, cream collar and coral apron straps. Inside a thick Ink circle outline filled solid Cream #FFF4DD; outside the circle genuinely transparent. Complete perfect circle evenly padded on all sides. No decorative bursts, no lettering.
Image 2 is Uncle's approved identity master. Preserve that EXACT grey hair shape, round glasses, white moustache, tan skin, eyebrow shape and facial proportions in requested pose. Flat solid fills.
```

## `uncle/front.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY full body, standing facing exactly front, both hands on hips, warm big smile. Match sheet's front Uncle precisely: swept grey hair, round Ink glasses, white moustache, cream collared short sleeve shirt, coral pocket apron, dark green knee-length shorts, brown sandals. Complete feet and head with even padding.
Image 2 is Uncle's approved identity master. Preserve that EXACT grey hair shape, round glasses, white moustache, tan skin, eyebrow shape and facial proportions in requested pose. Flat solid fills.
```

## `uncle/three-quarter.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY full body in three-quarter view toward viewer's left, one hand giving thumbs up and other on hip, big warm smile. Exact sheet Uncle model and proportions, grey swept hair/round glasses/white moustache/cream collared shirt/coral pocket apron/dark green shorts/brown sandals. Complete feet and head visible.
Image 2 is Uncle's approved identity master. Preserve that EXACT grey hair shape, round glasses, white moustache, tan skin, eyebrow shape and facial proportions in requested pose. Flat solid fills.
```

## `uncle/presenting.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY waist-up spot portrait, body three-quarter toward viewer's right, one hand extended palm-up as if explaining and other hand resting against apron/chest, mouth open talking with warm smile. Exact sheet model, swept grey hair, round Ink glasses, white moustache, cream collared shirt and coral pocket apron. Crop cleanly at waist. No sound waves, no decorations or speech bubbles.
Image 2 is Uncle's approved identity master. Preserve that EXACT grey hair shape, round glasses, white moustache, tan skin, eyebrow shape and facial proportions in requested pose. Flat solid fills.
```

## `uncle/pointing.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`, `docs/brand/source/uncle/ready.png`
- Edit chain: New generation using the attached references

```text
Use case: illustration-story. Production website asset for Chicky. Image 1 is docs/brand/asset-sheet.png, the mandatory authoritative STYLE AND IDENTITY reference. Reproduce its exact character identity, thick dark-green contour weight, compact proportions and facial style, simplified flat fills with very little shading. Palette: Ink #103F40, Yolk #FFC629, Coral #F26350, Cream #FFF4DD, Shell #FFFDF5; warm orange beak/feet and tan skin/brown sandals as in sheet. NO gradients, texture, realistic rendering, lighting effects or ground shadows. Square 1024x1024 or larger canvas. Genuine transparent alpha background; no checkerboard painted into image. Centre the entire subject with generous even padding, every contour completely visible. No scene, no labels, no lettering, no badges, no border or decorations except those explicitly requested. Chicky: round yolk-yellow chick, SAME white cracked eggshell cap silhouette as sheet, closed happy upturned eyes, coral rosy cheeks, orange triangular beak and feet, coral apron with one rounded rectangular front pocket, white towel draped over its right shoulder (viewer's left when frontal), thick Ink outlines. Uncle: SAME cheerful Singapore hawker character as sheet: grey swept-back hair with same side part, thick grey brows, round dark Ink-rimmed glasses, white moustache, broad warm rounded nose and warm tan skin, cream short-sleeved collared shirt, coral apron with one rounded rectangular pocket, dark green knee-length shorts and brown sandals. Maintain identical model proportions, shell/hair outline, face landmarks, clothing and outline weight across this series. No new costume or accessories.

UNCLE ONLY waist-up spot portrait, friendly smiling face looking toward viewer, one arm pointing to HIS LEFT (VIEWER'S RIGHT) with extended index finger; other hand relaxed on hip. Exact sheet model, swept grey hair, round glasses, white moustache, cream collared shirt and coral pocket apron. Clear single pointing finger, clean waist crop, all head and extended hand fully inside canvas. No decorations or speech bubbles.
Image 2 is Uncle's approved identity master. Preserve that EXACT grey hair shape, round glasses, white moustache, tan skin, eyebrow shape and facial proportions in requested pose. Flat solid fills.
```

## `logo/wordmark.png`

- Tool: Built-in image_gen.imagegen (model and seed not exposed)
- Seed: not exposed
- References: `docs/brand/asset-sheet.png`
- Edit chain: Second generation; initial wordmark rejected for glow and landscape framing.

```text
Use case: logo-brand. Image 1 is docs/brand/asset-sheet.png, the mandatory reference. Generate ONLY its top-centre text-only wordmark, removing the chick head. A SQUARE 1:1 transparent PNG canvas at least 1024px. The exact word "chicky", all lowercase, spelled c-h-i-c-k-y, heavy rounded friendly sans letters. Uniform solid Ink #103F40 letter fill. One uniform solid Coral #F26350 tapered swoosh underline. The wordmark is centred, occupies approximately 80% of square canvas width, with generous even transparent margins. Razor-sharp clean flat vector-like edges. Absolutely NO glow, NO blur, NO shadows, NO halos, NO lighting, NO grain, NO gradients, NO backdrop or opaque background. No additional words, symbols, chicks or tagline. Only six clean letter shapes and one swoosh, everything else 100% transparent. Check spelling individually c h i c k y.
```
