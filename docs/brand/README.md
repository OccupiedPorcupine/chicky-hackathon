# Chicky and Uncle character assets

The reference is [asset-sheet.png](asset-sheet.png). Chicky represents the product;
Uncle represents the voice assistant. Use the duo only for welcome/sign-in.

- [Cream contact sheet](contact-sheet.png)
- [Shell contact sheet](contact-sheet-shell.png)
- [Interactive local review](review.html): background checks and a fixed-frame voice swap
- [50% voice-state overlays](review/voice-alignment.png)
- [Exact prompts and edit chains](PROMPTS.md)
- [Export validation](review/asset-validation.json)

Serve the repository root (for example `python3 -m http.server 8765`) and open
`http://localhost:8765/docs/brand/review.html` for the interactive review.

## File contract

PNG masters live in `source/chicky/`, `source/uncle/`, and `source/logo/`.
All masters use square RGBA canvases of at least 1024px. The app files live at
`frontend/images/brand/chicky/` and `frontend/images/brand/uncle/`: 512px WebP,
quality 85, under 80,000 bytes each. Uncle also has `avatar-64.webp`.
The logo mark is supplied at `frontend/images/brand/chicky/head.png` (1024px);
it and `source/logo/wordmark.png` remain PNG for the SVG work in #7.

All backgrounds are transparent. Uncle's avatar intentionally has a Cream fill
inside the Ink circle, with transparency outside. The shared voice-state canvas
must be retained: do not crop each state independently. Set explicit `width` and
`height` in the app. Decorative illustrations use `alt=""`; put state and error
messages in accessible UI text.

## Rebuilding exports and checks

With Python, Pillow and numpy installed, run from the repository root:

```sh
python docs/brand/build-assets.py
```

The exporter checks the required masters, canvas size, real transparency, WebP
dimensions and byte budget. It also asserts pixel-identical voice-state alpha,
hair and outer head/shoulder regions, then builds contact sheets and overlays.
It does not call an image-generation API.

For a future voice-state regeneration, first generate `ready.png`, then edit it
for listening, speaking and thinking using the prompts. `lock-voice.py` preserves
the unchanged master pixels and shared alpha while retaining the tool-generated
expressions and thinking hand. It caches unprocessed input in `work/raw-voice/`.
Clear or move that cache before processing a newly generated set. Then rebuild
exports and inspect the 50% overlays and in-place swap again.

The underlying model version and seeds are not exposed by the built-in image tool.
`generation-records.json` preserves the exact prompts, references and edit chains.
The optional `speaking-2` was not generated; all 21 required images are included.
