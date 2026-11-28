# Hackathon demo and acceptance checklist

Use this checklist on the exact deployment and commit intended for the demo.
The original manual test issues live in
[CS203-Vincent-s-Disciples](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues?q=is%3Aissue%20is%3Aopen%20label%3Atesting).
They are references, not evidence that this fork or its current deployment passed.

## Five-minute demo

Use a dedicated account populated with `scripts/seed_demo_data.py`. The generated
sales are fictional. Local setup and credentials are in the [root README](../README.md).

1. Show the Dashboard's latest sales, revenue, waste and actions.
2. Ask Uncle: `today char siew rice 30`. Edit the proposed quantity to 32 and
   confirm. Show the saved record. Make a second proposal and cancel it.
3. Generate tomorrow's forecast for Char siew rice. Show the method, likely range
   and real inputs. Ask `why this number?`; weather must not be presented as a
   model input.
4. Open tomorrow's Prep list. Explain portions, recipes and purchased versus
   cooked quantities. Show how price and cost affect the preparation rule.
5. With the OpenAI integration configured, ask about an uploaded supplier document
   and show its citation. On a real phone, record a mixed-language sale and inspect
   the transcription and card before confirming.

When using offline mode, demonstrate supported typed sales, prep and guide flows.
Document answers use a rule-based stand-in in that mode. Demonstrate voice and
multilingual retrieval only with the configured integrations.

## Manual acceptance record

Record tester, date, deployment URL, deployed commit, device/browser, result and
evidence for each row. Leave untested checks pending; automated checks do not
establish that an external integration works.

| Area | Required evidence | Original test |
| --- | --- | --- |
| Test account | Dedicated account has sales, prices, costs and recipes | [#170](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/170) |
| Authentication | Email/password and configured Google login work; reset link arrives and works once; verification and session duration work | [#171](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/171) |
| Upload and opening days | CSV/XLSX preview, name mapping, import and overwrite choices; rest days and closures reflected in prep | [#172](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/172) |
| Prices and costs | Changes persist and affect revenue and preparation correctly | [#173](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/173) |
| Dashboard and sales | Record, edit and cancel; totals and actions update | [#174](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/174) |
| Forecast | MODEL with sufficient history and live ML; documented fallback without it; explanations quote actual inputs | [#175](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/175) |
| Prep and ingredients | Recipe quantities, yields, margin rule and sharing work | [#176](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/176) |
| Uncle | Text, edits, cancellation, closures, prices, tours, microphone and spoken replies; no save before Confirm | [#177](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/177) |
| Documents | Upload, cited answers, follow-ups, absent information and confirmed notes | [#178](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/178) |
| Telegram | Link/unlink, text and voice, confirm/cancel, commands and an actual scheduled reminder | [#179](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/179) |
| Phones | Safari and Android mic permission, layout, home-screen launch, tours and native sharing | [#180](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/180) |

## External work still needed

- Record approximately 15 consented voice clips in English, Singlish, Mandarin and
  mixed speech, including background noise. Follow [audio instructions](../assistant-eval/audio/README.md)
  and rerun the evaluation. Typed tests do not measure transcription quality.
- Review Uncle's chosen speaking voice and update the Telegram bot picture,
  description and about text in BotFather; see [PR #18](https://github.com/OccupiedPorcupine/chicky-hackathon/pull/18).
- Complete deployment setup and confirm the installed EC2 updater reads this
  repository's releases. Check both hosts and integration setup checks using the
  [deployment guide](../deploy/README.md).
- Verify Vercel production origins, `supabase,prod`, forwarded headers and email
  delivery. [Upstream #109](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/109)
  describes the required order; its historical state must be checked against the
  current environment before changing settings.
- Gather pilot stall data before making real-world improvement claims. See
  [upstream #88](https://github.com/OccupiedPorcupine/CS203-Vincent-s-Disciples/issues/88).

Never use a real owner's account for a destructive test or enable test reminders
for real users. A green image-publishing run establishes that images were
published; verify the running deployment separately.
