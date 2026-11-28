// OpenAI Realtime WebRTC transport for the closing-shift view. Business writes stay
// behind the application's authenticated, revision-aware confirmation gate.
(() => {
  const BASE = "/api/assistant/realtime";
  const TOOLS = new Set(["propose_sales", "revise_sales", "get_prep_list"]);
  const AFFIRMATIONS = new Set(["yes", "yessave", "yessaveit", "save", "saveit", "confirm", "confirmit", "对", "对save", "确认", "确认保存", "保存", "可以保存"]);
  const normalize = text => text.normalize("NFKC").toLowerCase().replace(/[\p{P}\p{Z}\s]/gu, "");

  class ChickyRealtime extends EventTarget {
    constructor(options = {}) {
      super();
      this.request = options.request || ((path, settings) => apiRequest(path, settings));
      this.Peer = options.Peer || window.RTCPeerConnection;
      this.getMedia = options.getMedia || (settings => navigator.mediaDevices.getUserMedia(settings));
      this.createAudio = options.createAudio || (() => new Audio());
      this.state = "disconnected";
      this.muted = false;
      this.revision = 0;
      this.proposal = null;
      this.generation = 0;
      this._pageHide = () => { void this.disconnect(); };
    }

    _emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }
    _state(state) { this.state = state; this._emit("status", { state }); }
    _current(generation, turn) {
      return generation === this.generation && this.sessionId && (!turn || this.turn === turn);
    }
    _send(event) {
      if (this.channel?.readyState === "open") this.channel.send(JSON.stringify(event));
    }
    _post(suffix, body, options = {}) {
      return this.request(`${BASE}/sessions/${encodeURIComponent(this.sessionId)}${suffix}`, {
        method: "POST", body: JSON.stringify(body), signal: this.abort.signal, ...options
      });
    }
    _notify(error, fallback = "The live conversation could not continue.") {
      this._emit("error", { message: error?.message || fallback, code: error?.code || "REALTIME_ERROR" });
    }

    async start() {
      if (this.starting) return this.starting;
      if (this.sessionId) return;
      const operation = this._start();
      this.starting = operation;
      try { return await operation; } finally { if (this.starting === operation) this.starting = null; }
    }

    async _start() {
      const generation = ++this.generation;
      this.abort = new AbortController();
      this.turnSequence = 0;
      this.turn = null;
      this.turns = new Map();
      this.responses = new Map();
      this.calls = new Map();
      this.callArguments = new Map();
      this.revision = 0;
      this.proposal = null;
      this.pendingReadback = null;
      this.playbackAllowed = false;
      this.outputActive = false;
      this.readbackPromise = null;
      this.toolQueue = Promise.resolve();
      this._state("connecting");
      window.addEventListener("pagehide", this._pageHide);
      try {
        if (!this.Peer || !navigator.mediaDevices?.getUserMedia && !this.getMedia) {
          throw new Error("Live voice needs a browser with WebRTC and microphone access on HTTPS or localhost.");
        }
        const available = await this.request(`${BASE}/status`, { signal: this.abort.signal });
        if (!available.available) throw Object.assign(new Error("Live voice is not configured on this server. You can use the existing assistant instead."), { code: "REALTIME_UNAVAILABLE" });
        const stream = await this.getMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
        if (generation !== this.generation) { stream.getTracks().forEach(track => track.stop()); return; }
        this.stream = stream;
        this.audio = this.createAudio();
        this.audio.autoplay = true;
        this.audio.muted = this.muted;
        this.audio.setAttribute?.("playsinline", "");
        this.peer = new this.Peer();
        this.peer.ontrack = event => {
          if (generation !== this.generation) return;
          this.audio.srcObject = event.streams[0];
          void this._play();
        };
        this.peer.onconnectionstatechange = () => {
          if (generation !== this.generation) return;
          if (["failed", "closed", "disconnected"].includes(this.peer.connectionState)) {
            void this._fail(new Error("The live voice connection ended. Start a new conversation to reconnect."));
          }
        };
        stream.getTracks().forEach(track => this.peer.addTrack(track, stream));
        this.channel = this.peer.createDataChannel("oai-events");
        this.channel.onopen = () => { if (generation === this.generation) this._state("listening"); };
        this.channel.onclose = () => { if (generation === this.generation) void this._fail(new Error("The live voice channel closed. Start again to reconnect.")); };
        this.channel.onerror = () => { if (generation === this.generation) void this._fail(new Error("The live voice channel failed.")); };
        this.channel.onmessage = event => {
          if (generation !== this.generation) return;
          try { this._event(JSON.parse(event.data)); } catch { this._notify(new Error("An invalid live voice event was received.")); }
        };
        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);
        await this._gatherIce(this.peer);
        if (generation !== this.generation) return;
        const result = await this.request(`${BASE}/sessions`, {
          method: "POST", body: JSON.stringify({ sdp: this.peer.localDescription.sdp }), signal: this.abort.signal
        });
        if (generation !== this.generation) {
          void this.request(`${BASE}/sessions/${encodeURIComponent(result.sessionId)}`, { method: "DELETE" }).catch(() => {});
          return;
        }
        this.sessionId = result.sessionId;
        await this.peer.setRemoteDescription({ type: "answer", sdp: result.sdp });
        this.expiryTimer = setTimeout(() => { void this._fail(new Error("This live conversation expired. Start a new session.")); }, Math.max(1, Date.parse(result.expiresAt) - Date.now()) || 15 * 60 * 1000);
        if (this.channel.readyState === "open") this._state("listening");
      } catch (error) {
        if (generation === this.generation) { await this._fail(error); throw error; }
      }
    }

    _gatherIce(peer) {
      if (peer.iceGatheringState === "complete") return Promise.resolve();
      return new Promise((resolve, reject) => {
        const finish = error => {
          clearTimeout(timeout);
          peer.removeEventListener("icegatheringstatechange", changed);
          this.abort.signal.removeEventListener("abort", aborted);
          error ? reject(error) : resolve();
        };
        const changed = () => { if (peer.iceGatheringState === "complete") finish(); };
        const aborted = () => finish(new Error("Connection cancelled."));
        const timeout = setTimeout(() => finish(new Error("Could not establish the voice connection. Check your network and try again.")), 10000);
        peer.addEventListener("icegatheringstatechange", changed);
        this.abort.signal.addEventListener("abort", aborted, { once: true });
      });
    }

    async _play() {
      if (!this.audio) return;
      try { await this.audio.play(); this.playbackAllowed = true; }
      catch { this.playbackAllowed = false; this._notify(new Error("Your browser blocked Uncle's audio. Unmute Uncle to retry playback, or use the Confirm button.")); }
    }

    _beginTurn(id) {
      if (!id) return null;
      if (this.turns.has(id)) return this.turns.get(id);
      const turn = { id, sequence: ++this.turnSequence, text: null, finalized: false };
      this.turns.set(id, turn);
      this.turn = turn;
      this.pendingReadback = null;
      for (const response of this.responses.values()) response.interrupted = true;
      this.audio?.pause();
      if (this.outputActive) this._send({ type: "output_audio_buffer.clear" });
      this.outputActive = false;
      this._state("listening");
      const generation = this.generation;
      // Complete an already-finished readback acknowledgement before advancing the
      // server turn. An interruption during speech never creates that acknowledgement.
      turn.ready = Promise.resolve(this.readbackPromise).catch(() => {}).then(() => {
        if (!this._current(generation, turn)) return;
        return this._post("/turns", { turnId: id, sequence: turn.sequence, text: null });
      });
      turn.ready.catch(error => { if (this._current(generation, turn)) this._notify(error); });
      return turn;
    }

    async _finalize(event) {
      const turn = this.turns.get(event.item_id) || this._beginTurn(event.item_id);
      if (!turn || turn !== this.turn || turn.finalized) return;
      turn.finalized = true;
      turn.text = event.transcript || "";
      this._emit("transcript", { role: "user", text: turn.text, final: true, turnId: turn.id });
      const generation = this.generation;
      try {
        await turn.ready;
        if (!this._current(generation, turn)) return;
        await this._post("/turns", { turnId: turn.id, sequence: turn.sequence, text: turn.text });
        if (!this._current(generation, turn)) return;
        if (this.proposal && AFFIRMATIONS.has(normalize(turn.text))) {
          try { await this._confirm("voice", turn); }
          catch (error) {
            if (!this._current(generation, turn)) return;
            this._notify(error);
            this._context({ confirmation: "not_saved", reason: "Confirmation was not accepted. Ask the owner to review the current card and use Confirm if needed." });
          }
        }
        if (!this._current(generation, turn)) return;
        this._state("thinking");
        this._send({ type: "response.create" });
      } catch (error) { if (this._current(generation, turn)) this._notify(error); }
    }

    _context(result) {
      this._send({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: `Authoritative application result: ${JSON.stringify(result)}` }] } });
    }

    _event(event) {
      const generation = this.generation;
      switch (event.type) {
        case "input_audio_buffer.speech_started": this._beginTurn(event.item_id); break;
        case "input_audio_buffer.speech_stopped": this._state("thinking"); break;
        case "conversation.item.input_audio_transcription.delta":
          if (event.item_id === this.turn?.id) this._emit("transcript", { role: "user", text: event.delta || "", final: false, turnId: event.item_id });
          break;
        case "conversation.item.input_audio_transcription.completed": void this._finalize(event); break;
        case "conversation.item.input_audio_transcription.failed":
          this._notify(new Error("I couldn't transcribe that. Please say it again or use the existing assistant.")); this._state("listening"); break;
        case "response.created": {
          const id = event.response?.id;
          if (!id || !this.turn) break;
          this.responses.set(id, { id, turn: this.turn, generation, revision: this.revision, completed: false, stopped: false, interrupted: false,
            readback: this.pendingReadback && this.pendingReadback.turnId === this.turn.id ? { ...this.pendingReadback } : null });
          break;
        }
        case "response.function_call_arguments.done":
          if (event.call_id) this.callArguments.set(event.call_id, { type: "function_call", call_id: event.call_id, name: event.name, arguments: event.arguments, response_id: event.response_id });
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta": {
          const response = this.responses.get(event.response_id);
          if (this._validResponse(response)) this._emit("transcript", { role: "assistant", text: event.delta || "", final: false, turnId: response.turn.id });
          break;
        }
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const response = this.responses.get(event.response_id);
          if (this._validResponse(response)) this._emit("transcript", { role: "assistant", text: event.transcript || "", final: true, turnId: response.turn.id });
          break;
        }
        case "output_audio_buffer.started": {
          const response = this.responses.get(event.response_id);
          if (this._validResponse(response)) { this.outputActive = true; this._state("speaking"); void this._play(); }
          break;
        }
        case "output_audio_buffer.stopped": {
          const response = this.responses.get(event.response_id);
          this.outputActive = false;
          if (response) { response.stopped = true; this._ackReadback(response); }
          if (this._validResponse(response)) this._state("listening");
          break;
        }
        case "output_audio_buffer.cleared": {
          const response = this.responses.get(event.response_id);
          this.outputActive = false;
          if (response) response.interrupted = true;
          break;
        }
        case "response.done": {
          const response = this.responses.get(event.response?.id);
          if (!response || !this._validResponse(response) || response.processed) break;
          response.processed = true;
          response.completed = event.response.status === "completed";
          if (!response.completed) { response.interrupted = true; break; }
          const calls = (event.response.output || []).filter(item => item.type === "function_call");
          if (!calls.length) calls.push(...[...this.callArguments.values()].filter(call => call.response_id === response.id));
          if (calls.length) {
            this.toolQueue = this.toolQueue.catch(() => {}).then(() => this._tools(calls, response));
            this.toolQueue.catch(error => { if (this._validResponse(response)) this._notify(error); });
          }
          this._ackReadback(response);
          break;
        }
        case "error": this._notify(new Error("The voice provider could not complete this turn. Please try again.")); break;
      }
    }

    _validResponse(response) {
      return response && !response.interrupted && this._current(response.generation, response.turn);
    }

    async _tools(calls, response) {
      if (!this._validResponse(response)) return;
      for (const call of calls) {
        if (!this._validResponse(response)) return;
        const fingerprint = JSON.stringify([call.name, call.arguments]);
        if (this.calls.has(call.call_id)) {
          if (this.calls.get(call.call_id) !== fingerprint) this._notify(new Error("A repeated voice action had conflicting details. Please say the request again."));
          continue;
        }
        this.calls.set(call.call_id, fingerprint);
        let output;
        if (!TOOLS.has(call.name)) {
          output = { error: "UNKNOWN_TOOL", message: "This action is not available. Only propose/revise sales or read prep; saving needs the owner's explicit confirmation." };
        } else {
          try {
            const args = typeof call.arguments === "string" ? JSON.parse(call.arguments) : call.arguments;
            if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Invalid voice action arguments.");
            const result = await this._post("/tools", { callId: call.call_id, turnId: response.turn.id, expectedRevision: this.revision, name: call.name, arguments: args });
            if (!this._validResponse(response)) return;
            this._apply(result, response.turn);
            output = result.output;
          } catch (error) {
            if (!this._validResponse(response)) return;
            output = { error: error.code || "TOOL_FAILED", message: "The application did not complete that action. Nothing should be described as saved." };
            this._notify(error);
          }
        }
        if (!this._validResponse(response)) return;
        this._send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: call.call_id, output: JSON.stringify(output) } });
      }
      if (this._validResponse(response)) this._send({ type: "response.create" });
    }

    _apply(result, turn) {
      if (Number.isInteger(result.revision)) this.revision = result.revision;
      if (result.proposal) {
        this.proposal = result.proposal;
        this.pendingReadback = { revision: this.revision, turnId: turn.id };
        this._emit("proposal", { proposal: result.proposal, revision: this.revision });
      }
      if (result.saved) {
        const proposal = this.proposal;
        this.proposal = null;
        this.pendingReadback = null;
        this._emit("saved", { saved: result.saved, proposal, revision: this.revision });
      }
      if (result.prep) this._emit("prep", { prep: result.prep });
    }

    _ackReadback(response) {
      if (!this._validResponse(response) || !response.completed || !response.stopped || response.acknowledged
          || !response.readback || response.readback.revision !== this.revision || !this.proposal
          || this.muted || !this.playbackAllowed || this.audio?.paused) return;
      response.acknowledged = true;
      this.readbackPromise = this._post("/readback", { revision: this.revision, turnId: response.turn.id });
      this.readbackPromise.then(() => {
        if (this.pendingReadback?.revision === response.readback.revision) this.pendingReadback = null;
      }).catch(error => { if (this._validResponse(response)) this._notify(error); });
    }

    async _confirm(mode, turn = this.turn) {
      if (!this.sessionId || !this.proposal || !turn) throw new Error("There is no pending sales card to confirm.");
      const generation = this.generation;
      const result = await this._post("/confirm", { revision: this.revision, turnId: turn.id, mode });
      if (!this._current(generation, turn)) return;
      this._apply(result, turn);
      this._context({ saved: result.saved, revision: result.revision });
      return result;
    }

    async confirm() {
      try { const result = await this._confirm("button"); this._send({ type: "response.create" }); return result; }
      catch (error) { this._notify(error); throw error; }
    }

    async cancel() {
      if (!this.sessionId || !this.proposal) return;
      const generation = this.generation;
      const turn = this.turn;
      const revision = this.revision;
      try {
        const result = await this._post("/cancel", { revision });
        if (!this._current(generation, turn) || this.revision !== revision) return;
        this.revision = result.revision;
        this.proposal = null;
        this.pendingReadback = null;
        this._emit("proposal", { proposal: null, revision: this.revision });
        this._context({ cancelled: true, revision: this.revision });
        this._send({ type: "response.create" });
      } catch (error) { this._notify(error); throw error; }
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      if (this.audio) {
        this.audio.muted = this.muted;
        if (!this.muted) void this._play();
      }
    }

    async _fail(error) {
      await this.disconnect();
      this._state("error");
      this._notify(error);
    }

    async disconnect() {
      const id = this.sessionId;
      ++this.generation;
      this.sessionId = null;
      this.starting = null;
      this.abort?.abort();
      clearTimeout(this.expiryTimer);
      this.peer && (this.peer.onconnectionstatechange = null);
      if (this.channel) { this.channel.onclose = null; this.channel.onerror = null; this.channel.onmessage = null; this.channel.close(); }
      this.peer?.close();
      this.stream?.getTracks().forEach(track => track.stop());
      if (this.audio) { this.audio.pause(); this.audio.srcObject = null; }
      this.peer = null; this.stream = null; this.audio = null; this.channel = null;
      this.proposal = null; this.pendingReadback = null;
      window.removeEventListener("pagehide", this._pageHide);
      this._state("disconnected");
      if (id) { try { await this.request(`${BASE}/sessions/${encodeURIComponent(id)}`, { method: "DELETE" }); } catch { /* Session expires server-side if cleanup cannot reach it. */ } }
    }
  }
  window.ChickyRealtime = ChickyRealtime;
})();
