# Closing-shift Realtime contract

Implementation contract for issues #41–#45. All routes require the application
session; mutations require CSRF. Provider keys and session instructions stay on
the server. The transport is OpenAI Realtime WebRTC (`/v1/realtime/calls`), not
the distinct GPT-Live session/event API. Verify live account access separately.

## HTTP interface

Base: `/api/assistant/realtime`.

- `GET /status` -> `{available, model, voice}`. Missing key means unavailable.
- `POST /sessions` `{sdp}` -> `{sessionId, sdp, expiresAt}`. The server exchanges
  SDP with OpenAI using server-configured instructions/tools.
- `POST /sessions/{id}/turns` `{turnId, sequence, text}` registers a user turn.
  `sequence` is a positive, monotonically increasing integer. On speech start send
  null text; on final transcription send the same ID/sequence and finalized text.
  Starting a newer turn invalidates old in-flight tool work. Repeated finalization
  is idempotent only for identical text. Tools wait for final transcription.
- `POST /sessions/{id}/tools` `{callId, turnId, expectedRevision, name, arguments}`
  -> `{output, proposal, revision, saved, prep}`; unused fields may be null.
  `output` is the authoritative JSON object returned as function_call_output.
- `POST /sessions/{id}/readback` `{revision, turnId}` acknowledges completed
  audible readback of this proposal, never partial/interrupted audio.
- `POST /sessions/{id}/confirm` `{revision, turnId, mode}` ->
  `{saved, proposal, revision}`. `mode` is `voice` or `button`. Voice requires an
  explicit allowlisted latest finalized affirmation after readback, bound to the
  latest proposal. Button is an intentional authenticated UI action. Reuse the
  existing confirmation service; the model has no confirm/save tool.
- `POST /sessions/{id}/cancel` `{revision}` cancels pending sales.
- `DELETE /sessions/{id}` expires application state and cancels pending sales;
  client also closes audio/media/peer resources.

Tool names: `propose_sales`, `revise_sales`, `get_prep_list`.
`propose_sales` takes `{entries:[ProposalEntryInput...]}` using existing field names.
`revise_sales` takes `{changes:[{dishId,quantity}]}` and preserves other fields.
`get_prep_list` takes `{date}` (ISO Singapore date; null means tomorrow).
Initial revision is 0. Proposal creation/revision/cancellation advances it;
stale revisions and turns return 409 without writes. Cache identical call IDs;
reject reuse with different payloads. Owners and expiration are checked throughout.

`proposal` uses the existing assistant proposal view (`id`, `type`, `entries`,
`expiresAt`, etc.). `saved` uses ConfirmProposalResponse. `prep` uses PrepListResponse.
Agent adjustments to this contract must be agreed with the other owners before use.

## Browser controller

`window.ChickyRealtime` is an EventTarget class in `js/realtime.js`.
Public methods: `start()`, `disconnect()`, `setMuted(boolean)`, `confirm()`, `cancel()`.
It owns WebRTC, transcript/turn sequencing, tool transport and acknowledgement.
It dispatches CustomEvents:

- `status`: `{state}`: connecting/listening/thinking/speaking/disconnected/error.
- `transcript`: `{role,text,final,turnId}`.
- `proposal`: `{proposal,revision}`.
- `saved`: `{saved,proposal,revision}`.
- `prep`: `{prep}`.
- `error`: `{message,code}` (no secrets).

The demo page owns rendering and deliberate Confirm/Cancel controls. It must not
invent provider events, model output or successful backend results. An unavailable
integration is shown honestly and links to the existing assistant fallback.

The client connects via the existing `apiRequest` helper. It may bridge completed
tool calls to the backend, but must not execute model-supplied arbitrary routes.
Use input_audio_buffer events, finalized input transcription, completed function
call arguments, audio transcript and output playback events from official Realtime
docs; do not mix GPT-Live event names into this controller.
