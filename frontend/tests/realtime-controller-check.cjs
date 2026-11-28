// Deterministic Realtime event/lifecycle checks. No network, model or microphone.
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../js/realtime.js"), "utf8");
const flush = async () => { for (let n = 0; n < 12; n++) await new Promise(resolve => setImmediate(resolve)); };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function harness({ available = true, getMedia, tool } = {}) {
  const requests = [], sent = [], peers = [], audios = [], events = [];
  const track = { stopped: false, stop() { this.stopped = true; } };
  class Peer extends EventTarget {
    constructor() { super(); peers.push(this); this.iceGatheringState = "complete"; this.connectionState = "new"; }
    createDataChannel() {
      this.channel = { readyState: "open", send: data => sent.push(JSON.parse(data)), close() { this.readyState = "closed"; } };
      return this.channel;
    }
    addTrack() {}
    async createOffer() { return { type: "offer", sdp: "offer-sdp" }; }
    async setLocalDescription(offer) { this.localDescription = offer; }
    async setRemoteDescription(answer) { this.remoteDescription = answer; }
    close() { this.closed = true; }
  }
  const win = new EventTarget();
  const context = vm.createContext({ window: win, navigator: { mediaDevices: { getUserMedia() {} } }, EventTarget, CustomEvent,
    AbortController, setTimeout, clearTimeout, console, Date });
  vm.runInContext(source, context);
  const request = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    requests.push({ url, method: options.method || "GET", body });
    if (url.endsWith("/status")) return { available, model: "test", voice: "test" };
    if (url.endsWith("/sessions")) return { sessionId: "app-session", sdp: "answer-sdp", expiresAt: new Date(Date.now() + 60000).toISOString() };
    if (url.endsWith("/tools")) return tool ? tool(body) : { output: { pending: true }, proposal: { id: 1, entries: [{ dishId: 10, quantity: 40 }] }, revision: 1 };
    if (url.endsWith("/confirm")) return { saved: { outcome: "CONFIRMED", entries: [{ dishId: 10, quantity: 42 }] }, revision: 2 };
    if (url.endsWith("/cancel")) return { proposal: null, revision: 2 };
    return {};
  };
  const client = new win.ChickyRealtime({ request, Peer, getMedia: getMedia || (async () => ({ getTracks: () => [track] })),
    createAudio: () => { const audio = { paused: true, muted: false, async play() { this.paused = false; }, pause() { this.paused = true; }, setAttribute() {} }; audios.push(audio); return audio; } });
  for (const name of ["status", "transcript", "proposal", "saved", "prep", "error"]) client.addEventListener(name, event => events.push({ name, detail: event.detail }));
  const event = data => peers.at(-1).channel.onmessage({ data: JSON.stringify(data) });
  const user = async (id, text) => { event({ type: "input_audio_buffer.speech_started", item_id: id }); event({ type: "conversation.item.input_audio_transcription.completed", item_id: id, transcript: text }); await flush(); };
  const response = (id, output = []) => { event({ type: "response.created", response: { id } }); event({ type: "response.done", response: { id, status: "completed", output } }); };
  const call = (id = "call-1", name = "propose_sales", args = { entries: [] }) => ({ type: "function_call", call_id: id, name, arguments: JSON.stringify(args) });
  return { client, requests, sent, peers, audios, events, track, event, user, response, call };
}

const requestsTo = (h, suffix) => h.requests.filter(r => r.url.endsWith(suffix));

test("start negotiates SDP, permits no tools before final transcript, disconnect releases resources", async () => {
  const h = harness();
  await h.client.start();
  assert.equal(h.client.state, "listening");
  assert.equal(requestsTo(h, "/sessions")[0].body.sdp, "offer-sdp");
  assert.equal(h.peers[0].remoteDescription.sdp, "answer-sdp");
  h.event({ type: "input_audio_buffer.speech_started", item_id: "turn-1" });
  await flush();
  assert.equal(requestsTo(h, "/turns")[0].body.text, null);
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 0);
  h.event({ type: "conversation.item.input_audio_transcription.completed", item_id: "turn-1", transcript: "今天 chicken forty" });
  await flush();
  assert.equal(requestsTo(h, "/turns")[1].body.text, "今天 chicken forty");
  assert.equal(h.sent.filter(e => e.type === "response.create").length, 1);
  await h.client.disconnect();
  assert.equal(h.track.stopped, true);
  assert.equal(h.peers[0].closed, true);
  assert.equal(h.audios[0].srcObject, null);
  assert.equal(h.requests.at(-1).method, "DELETE");
});

test("duplicate function events execute once and unknown tools never reach application routes", async () => {
  const h = harness(); await h.client.start(); await h.user("turn-1", "chicken forty");
  const call = h.call();
  h.event({ type: "response.function_call_arguments.done", response_id: "r1", ...call });
  h.response("r1", [call]);
  await flush();
  h.event({ type: "response.done", response: { id: "r1", status: "completed", output: [call] } });
  await flush();
  assert.equal(requestsTo(h, "/tools").length, 1);
  assert.equal(h.events.filter(e => e.name === "proposal").length, 1);
  h.response("r2", [h.call("forbidden", "save_sales")]); await flush();
  assert.equal(requestsTo(h, "/tools").length, 1);
  const refused = h.sent.find(e => e.item?.call_id === "forbidden");
  assert.equal(JSON.parse(refused.item.output).error, "UNKNOWN_TOOL");
  await h.client.disconnect();
});

test("new speech discards delayed earlier tool results and stops output audio", async () => {
  const pending = deferred(); const h = harness({ tool: () => pending.promise });
  await h.client.start(); await h.user("turn-1", "chicken forty");
  h.response("r1", [h.call()]); await flush();
  h.event({ type: "output_audio_buffer.started", response_id: "r1" }); await flush();
  h.event({ type: "input_audio_buffer.speech_started", item_id: "turn-2" });
  assert.equal(h.audios[0].paused, true);
  assert.ok(h.sent.some(e => e.type === "output_audio_buffer.clear"));
  pending.resolve({ output: { pending: true }, proposal: { id: 1, entries: [] }, revision: 1 });
  await flush();
  assert.equal(h.events.filter(e => e.name === "proposal").length, 0);
  assert.equal(h.sent.filter(e => e.item?.call_id === "call-1").length, 0);
  await h.client.disconnect();
});

test("readback needs completed audible playback; interrupted or muted speech never acknowledges", async () => {
  const h = harness(); await h.client.start(); await h.user("turn-1", "chicken forty");
  h.response("tool", [h.call()]); await flush();
  h.event({ type: "response.created", response: { id: "readback" } });
  h.event({ type: "output_audio_buffer.started", response_id: "readback" }); await flush();
  h.event({ type: "response.done", response: { id: "readback", status: "completed", output: [] } });
  assert.equal(requestsTo(h, "/readback").length, 0, "generation completion is not audible completion");
  h.event({ type: "output_audio_buffer.stopped", response_id: "readback" }); await flush();
  assert.equal(requestsTo(h, "/readback").length, 1);
  h.client.pendingReadback = { revision: 1, turnId: "turn-1" };
  h.client.setMuted(true);
  h.response("muted"); h.event({ type: "output_audio_buffer.started", response_id: "muted" });
  h.event({ type: "output_audio_buffer.stopped", response_id: "muted" }); await flush();
  assert.equal(requestsTo(h, "/readback").length, 1);
  h.client.setMuted(false);
  h.event({ type: "response.created", response: { id: "interrupted" } });
  h.event({ type: "output_audio_buffer.started", response_id: "interrupted" }); await flush();
  h.event({ type: "input_audio_buffer.speech_started", item_id: "turn-2" });
  h.event({ type: "response.done", response: { id: "interrupted", status: "completed", output: [] } });
  h.event({ type: "output_audio_buffer.stopped", response_id: "interrupted" }); await flush();
  assert.equal(requestsTo(h, "/readback").length, 1);
  await h.client.disconnect();
});

test("affirmation calls confirmation gate after finalized turn; negation cannot confirm", async () => {
  const h = harness(); await h.client.start(); await h.user("turn-1", "chicken forty");
  h.response("tool", [h.call()]); await flush();
  await h.user("turn-2", "don't save");
  assert.equal(requestsTo(h, "/confirm").length, 0);
  await h.user("turn-3", "对，save。");
  const confirm = requestsTo(h, "/confirm")[0];
  assert.equal(confirm.body.mode, "voice"); assert.equal(confirm.body.turnId, "turn-3");
  const turnIndex = h.requests.findIndex(r => r.url.endsWith("/turns") && r.body.text === "对，save。");
  assert.ok(h.requests.indexOf(confirm) > turnIndex);
  assert.equal(h.events.filter(e => e.name === "saved").length, 1);
  assert.ok(h.sent.some(e => e.item?.role === "system" && e.item.content[0].text.includes("CONFIRMED")));
  await h.client.disconnect();
});

test("button confirmation and cancellation use current revision and emit authoritative results", async () => {
  const h = harness(); await h.client.start(); await h.user("turn-1", "chicken forty");
  h.response("tool", [h.call()]); await flush();
  await h.client.cancel();
  assert.equal(requestsTo(h, "/cancel")[0].body.revision, 1);
  assert.equal(h.events.filter(e => e.name === "proposal").at(-1).detail.proposal, null);
  h.client.proposal = { id: 2 }; h.client.revision = 3;
  await h.client.confirm();
  assert.equal(requestsTo(h, "/confirm")[0].body.mode, "button");
  assert.equal(requestsTo(h, "/confirm")[0].body.revision, 3);
  await h.client.disconnect();
});

test("missing configuration and denied microphone fail clearly without leaking resources", async () => {
  const absent = harness({ available: false });
  await assert.rejects(absent.client.start(), /not configured/);
  assert.equal(absent.client.state, "error"); assert.equal(absent.peers.length, 0);
  const denied = harness({ getMedia: async () => { throw new Error("Microphone permission denied"); } });
  await assert.rejects(denied.client.start(), /permission denied/);
  assert.equal(denied.client.state, "error"); assert.equal(denied.peers.length, 0);
});

test("late microphone grant after disconnect stops that stream and cannot revive session", async () => {
  const pending = deferred(); const h = harness({ getMedia: () => pending.promise });
  const starting = h.client.start(); await flush(); await h.client.disconnect();
  pending.resolve({ getTracks: () => [h.track] }); await starting;
  assert.equal(h.track.stopped, true); assert.equal(h.peers.length, 0); assert.equal(h.client.state, "disconnected");
});
