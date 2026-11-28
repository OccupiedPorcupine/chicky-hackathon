# Closing-shift voice demo

Tracked implementation and rehearsal guide for [epic #41](https://github.com/OccupiedPorcupine/chicky-hackathon/issues/41).
The full working plan remains local in `.local-data/hackathon-demo-plan.md`.

## Start a local rehearsal

Build the backend:

```sh
cd backend
./mvnw verify
cd ..
python3 scripts/run_voice_demo.py
```

The launcher starts a fresh in-memory H2 database. It reads only `OPENAI_API_KEY`
from your environment or `backend/.env`; it ignores production database, mail,
Telegram and profile settings. Restarting clears this local dataset. Without a
key, the backend runs and the page honestly reports live voice unavailable.

In another terminal, from the repository root:

```sh
node frontend/server.mjs
python3 scripts/prepare_voice_demo.py
```

The preparation script creates a new account with Roasted chicken rice and Char
siew rice, 120 days of invented history ending yesterday, prices, costs, recipes
and ingredient yields. It never signs into or resets an existing account. Its
random credentials are saved to the ignored `.local-data/voice-demo.json` file.

Sign in at `http://localhost:5500`, then open
`http://localhost:5500/close-shift.html?sample=1`. The query parameter explicitly
labels the recording's fictional dataset; it does not seed or simulate the app.
For a new take, run preparation again and sign into the new account. Set `--api`
on the preparation script and `--port` on the launcher together if changing ports;
the frontend's `BACKEND_URL` must match too.

The default ML URL is `http://localhost:8000`. If it is absent, prep uses the
historical-sales fallback and the page labels it as such. For a Chronos-2 recording,
run the ML service first using [the ML guide](../ml/README.md). A key by itself does
not prove that the account has access to the chosen Realtime and transcription models.

## What was implemented

- A server-mediated Realtime WebRTC session; the browser receives SDP, never the
  project API key. Only allowlisted sales-proposal, correction and prep tools exist.
- Per-owner application sessions, finalized user turns, proposal revisions,
  idempotent tool calls and a confirmation gate. Corrections cancel the older
  persisted proposal. Sales still write through the existing confirmation service.
- Spoken affirmation is accepted only after an audible readback of the current
  proposal and the next complete affirmative user turn. Negation, ambiguous speech,
  muted/interrupted readbacks and old revisions do not authorize a save.
- Deliberate Confirm and Cancel buttons remain available. They are the fallback
  when the microphone, playback or spoken affirmation cannot be established.
- A single page for captions, sales, tomorrow's portions and ingredient quantities.
  New sessions reset their revision state; live captions accumulate streamed text.

The [HTTP/event contract](realtime-contract.md) documents the integration. Existing
recorded-clip/text assistant pages are unchanged.

## Rehearse the scene

1. Say: `Uncle，今天 roast chicken rice 四十份，char siew 三十，剩五份。`
2. Interrupt Uncle's readback: `Wait，roast chicken 四十二。`
3. Check that only roast chicken changed: 42; char siew remains 30 with 5 left over.
4. Let Uncle finish the revised readback, then say: `对，save。`
5. Wait for an actual Saved result, then ask: `明天准备多少？`
6. Check that spoken numbers agree with the actual prep cards and recipe quantities.

Repeat successfully three times before capture. Also try `don't save`, denied mic
permission, muting part of a readback, ending/restarting, and a correction during
tool work. Automated mocks establish event/state behavior, not real voice accuracy.

## One-minute video and architecture insert

| Time | Shot |
| --- | --- |
| 0–4s | Owner closing the stall: sales to record, tomorrow to plan |
| 4–13s | Mixed-language sales fill the real pending card |
| 13–25s | Interrupt Uncle; visually change 40 to 42 |
| 25–31s | Explicit confirmation, actual Saved result |
| 31–44s | Ask tomorrow prep; actual portions and ingredient quantities appear |
| 44–53s | Brief architecture pan, owner → backend → forecasting → prep list |
| 53–60s | Outcome/end card: “One conversation. Today recorded. Tomorrow prepared. Chicky—Huat tomorrow.” |

Use [the SVG](diagrams/chicky-backend.svg) for sharp motion graphics, or
[the PNG](diagrams/chicky-backend.png) for direct video import. The
[Excalidraw source](diagrams/chicky-backend.excalidraw) is editable and the
[HTML preview](diagrams/chicky-backend.html) is convenient for inspection.
Highlight Supabase and Uncle as supporting services while panning through the main flow.

Suggested short architecture voice-over for the 9-second insert:

> Web or Telegram to Spring Boot. Supabase stores sales; Chronos forecasts demand.
> Forecasts and recipes become tomorrow's prep.

Use a small “Production architecture” caption: the isolated local rehearsal uses
H2, while the production architecture uses Supabase. Speak at a natural pace; if
the complete conversation takes longer, shorten the narration or use architecture
labels over the prep result rather than speeding up assistant audio.

Full architecture narration for the two-minute finalist demo or a longer version:

> Owners record sales through the web app or Telegram. Our Spring Boot backend
> stores the data in Supabase, while Uncle handles text and voice, with confirmation
> before saving changes. Chronos-2 forecasts demand from sales history and public
> holidays. The backend turns those forecasts and recipes into portions to cook
> and ingredients to buy.

If mentioning resilience, explain that unavailable ML causes a historical-sales
fallback. Weather insights are separate from the forecasting model.

Record real user and assistant audio, subtitle both languages, label sample data,
and keep the central interaction at normal speed. Use actual forecast numbers;
the illustrative script numbers are not expected model outputs. Do not claim
measured waste savings or pilot adoption from the invented dataset.

## Runtime limits and remaining live checks

- Application sessions last 15 minutes, allow two per owner, and are held in one
  backend process. A restart invalidates them. Multi-instance production needs a
  shared session store or affinity; a serverless instance switch can lose state.
- Bootstrap and finalized turns use the existing assistant message allowance and
  rate limit. Realtime audio tokens/provider billing are not yet imported into the
  app's existing text/TTS cost report. Client expiry/disconnect closes WebRTC;
  application expiry is not a server-side provider hangup guarantee against a
  modified client. Use a bounded demo project and inspect actual provider usage.
- `REALTIME_ENABLED`, `REALTIME_MODEL`, `REALTIME_VOICE`, and
  `REALTIME_TRANSCRIPTION_MODEL` configure normal backend runs. The isolated
  launcher intentionally imports only the API key and uses repository defaults.
- Confirm actual key/model access, microphone and speaker behavior, interruption,
  readback, bilingual transcription, and end-to-end timing on the recording device.
  Those checks and the final video/submission remain open until performed.
