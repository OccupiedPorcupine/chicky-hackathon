// Voice assistant, on every signed-in page. Users say or type their sales ("today chicken rice
// 42, char siew 30"); the backend proposes entries, shown on a confirm card the user can edit.
// Nothing is saved until they press Confirm. Needs js/api.js. See backend/README.md.
(() => {
  const PAGE = location.pathname.split("/").pop().replace(/\.html$/, "") || "dashboard";
  const MAX_RECORDING_MS = 60000;
  // Stop recording after this much quiet, once the user has started speaking.
  const SILENCE_MS = 2000;
  const SPEECH_LEVEL = 0.02;
  const CONVERSATION_KEY = "chicky-assistant-conversation";
  const MUTED_KEY = "chicky-assistant-muted";
  // At most this many visible elements are described to the assistant with each message.
  const MAX_PAGE_ELEMENTS = 60;
  // The assistant's name (issue #14). A placeholder until the name is decided; the backend keeps
  // its own copy in AssistantPersona.NAME.
  const ASSISTANT_NAME = "Uncle";
  // Uncle's pictures (issue #6): his round avatar at rest, and one picture for each other voice state.
  const UNCLE_IMAGES = "images/brand/uncle/";
  const VOICE_STATES = ["ready", "listening", "thinking", "speaking"];

  const micIcon = size => `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12h-2Z"/></svg>`;
  const MIC_ICON = micIcon(22);
  const SOUND_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.47 4.47 0 0 0 2.5-4ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z"/></svg>';
  const MUTED_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M16.5 12A4.5 4.5 0 0 0 14 8v2.18l2.45 2.45c.03-.2.05-.41.05-.63Zm2.5 0a6.97 6.97 0 0 1-.54 2.7l1.51 1.51A8.96 8.96 0 0 0 21 12a9 9 0 0 0-7-8.77v2.06A7 7 0 0 1 19 12ZM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25A6.92 6.92 0 0 1 14 18.7v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3ZM12 4 9.91 6.09 12 8.18V4Z"/></svg>';
  // What Uncle is doing, drawn beside his face: ink arcs while listening, coral sound bars while
  // speaking, a "…" bubble while thinking. CSS shows the group for the current data-voice-state.
  const VOICE_FX = `<svg class="assistant-fx" viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" focusable="false">
      <g class="fx-arcs"><path d="M12 14a3 6 0 0 1 0 12"/><path d="M17 9a5 11 0 0 1 0 22"/><path d="M22 4a7 16 0 0 1 0 32"/></g>
      <g class="fx-bars"><rect x="5" y="15" width="4" height="10" rx="2"/><rect x="12" y="10" width="4" height="20" rx="2"/><rect x="19" y="6" width="4" height="28" rx="2"/><rect x="26" y="11" width="4" height="18" rx="2"/><rect x="33" y="15" width="4" height="10" rx="2"/></g>
      <g class="fx-bubble"><circle class="fx-puff" cx="6" cy="35" r="2"/><circle class="fx-puff" cx="11" cy="29" r="3"/><ellipse class="fx-cloud" cx="24" cy="15" rx="14" ry="10"/><circle class="fx-dot" cx="17" cy="15" r="2.2"/><circle class="fx-dot" cx="24" cy="15" r="2.2"/><circle class="fx-dot" cx="31" cy="15" r="2.2"/></g>
    </svg>`;
  // Uncle's face: a round frame whose picture follows the voice state (see setVoiceState).
  // The round avatar at rest: 64px, or the 512px one on sharper screens.
  const AVATAR_SRCSET = `${UNCLE_IMAGES}avatar-64.webp 64w, ${UNCLE_IMAGES}avatar.webp 512w`;
  const FACE = size => `<span class="assistant-face"><img src="${UNCLE_IMAGES}avatar-64.webp" srcset="${AVATAR_SRCSET}" sizes="${size}px" width="${size}" height="${size}" alt=""></span>`;
  const SEND_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M11 20V7.83l-5.59 5.58L4 12l8-8 8 8-1.41 1.41L13 7.83V20h-2Z"/></svg>';

  let status = { available: false, voice: false };
  let muted = readStored(MUTED_KEY, localStorage) === "true";
  let currentAudio = null;
  let speechRequest = 0;
  let conversationId = readStored(CONVERSATION_KEY);
  let recorder = null;
  let fromVoice = false; // the text box holds a transcript
  let stopReason = null; // why the last recording stopped, for the console
  let busy = false;
  // Today's assistant use and allowance (issue #65), from the status and each reply.
  let usage = null;
  let speechLimitShown = false;
  // The forecast on screen ({ dishId, date }), set by js/forecast.js, so "why so high?" refers to it.
  let shownForecast = null;
  // Uncle's voice state, one of VOICE_STATES, on the launcher and panel as data-voice-state.
  let voiceState = "ready";
  const voiceListeners = new Set();
  // The speech request whose audio is still being fetched, so Uncle looks busy until he talks.
  let pendingSpeech = null;
  // Uncle on the panel's stage (issue #37): his pose at rest after a reply ("pointing" at a confirm card,
  // "presenting" an answer with figures), the reply being revealed word by word when there is no audio, the
  // picture shown, and whether his mouth is shut mid-word.
  let stagePose = null;
  let revealing = false;
  let shownPose = "ready";
  let stageTalk = null;
  let greeted = false;
  // The next message comes from an "Ask about this forecast" card, so Uncle presents the answer.
  let askedFromCard = false;
  let closeTimer = 0;
  let talkContext = null;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const bubble = element("button", "assistant-bubble", {
    type: "button",
    "data-guide-id": "assistant-button",
    "aria-label": `Open ${ASSISTANT_NAME}, the voice assistant`,
    "aria-expanded": "false",
    "aria-controls": "assistant-panel",
    "data-voice-state": voiceState
  });
  bubble.innerHTML = `${FACE(56)}<span class="assistant-mic-badge">${micIcon(12)}</span>${VOICE_FX}`;

  const panel = element("section", "assistant-panel", {
    id: "assistant-panel",
    role: "dialog",
    "aria-labelledby": "assistant-title assistant-role",
    "data-voice-state": voiceState,
    hidden: ""
  });
  // A glowing window with Uncle on a stage at the top, breaking out over its edge, and his latest line in a
  // speech bubble. The bubble is a picture of the reply (aria-hidden): screen readers hear each reply once,
  // whole, from the log below, where the line on stage is kept but visually hidden.
  panel.innerHTML = `
    <div class="assistant-glow" aria-hidden="true"></div>
    <div class="assistant-uncle" aria-hidden="true">
      <div class="assistant-uncle-body">
        <img class="assistant-uncle-pose" src="${UNCLE_IMAGES}ready.webp" width="180" height="180" alt="" decoding="async">
        <img class="assistant-uncle-mouth" src="${UNCLE_IMAGES}ready.webp" width="180" height="180" alt="" decoding="async">
      </div>
      ${VOICE_FX}
    </div>
    <div class="assistant-window">
      <header class="assistant-header">
        <div class="assistant-heading">
          <h2 id="assistant-title">${ASSISTANT_NAME}</h2>
          <p id="assistant-role" class="assistant-role">Voice assistant</p>
        </div>
        <button class="assistant-sound" type="button" hidden></button>
        <button class="assistant-close" type="button" aria-label="Close ${ASSISTANT_NAME}">&times;</button>
        <div class="assistant-say" aria-hidden="true"><p class="assistant-say-text"></p></div>
      </header>
      <div class="assistant-log" role="log" aria-live="polite"></div>
      <p class="assistant-usage" hidden></p>
      <p class="assistant-status" role="status" aria-live="polite"></p>
      <form class="assistant-input">
        <textarea rows="2" aria-label="Message to ${ASSISTANT_NAME}" placeholder="Say or type your sales, e.g. &ldquo;chicken rice 42&rdquo;"></textarea>
        <button class="assistant-mic" type="button" aria-pressed="false" aria-label="Start voice input">${MIC_ICON}</button>
        <button class="assistant-send" type="submit" aria-label="Send">${SEND_ICON}</button>
      </form>
    </div>`;

  const log = panel.querySelector(".assistant-log");
  const statusLine = panel.querySelector(".assistant-status");
  const usageLine = panel.querySelector(".assistant-usage");
  const form = panel.querySelector(".assistant-input");
  const input = form.querySelector("textarea");
  const micButton = form.querySelector(".assistant-mic");
  const sendButton = form.querySelector(".assistant-send");
  const soundButton = panel.querySelector(".assistant-sound");
  const uncleBody = panel.querySelector(".assistant-uncle-body");
  const unclePose = panel.querySelector(".assistant-uncle-pose");
  const sayBox = panel.querySelector(".assistant-say");
  const sayText = panel.querySelector(".assistant-say-text");

  // Signed out (the page redirects) or the backend is down: no assistant.
  const statusLoaded = apiRequest("/api/assistant/status")
    .then(result => {
      status = result;
      debug("status", result);
      return true;
    })
    .catch(error => {
      warn("status failed, so the assistant is hidden:", error.status, error.message);
      return false;
    });

  // Used by js/guide.js to read tour steps aloud, by js/forecast.js to say which forecast is on screen,
  // and by js/dashboard.js to play the weekly summary.
  window.chickyAssistant = {
    speak,
    // A Play button the user pressed, so it plays even when spoken replies are muted.
    play: text => speak(text, { evenIfMuted: true }),
    voiceAvailable: async () => await statusLoaded && Boolean(status.voice),
    stopSpeaking,
    setForecast: forecast => { shownForecast = forecast; },
    name: ASSISTANT_NAME,
    // Uncle's voice state ("ready", "listening", "thinking" or "speaking"), for other places that show
    // him (issue #15). The callback gets the current state now and every change after; call the
    // returned function to stop.
    get voiceState() { return voiceState; },
    onVoiceState(callback) {
      voiceListeners.add(callback);
      callback(voiceState);
      return () => voiceListeners.delete(callback);
    },
    follow
  };

  // Shows Uncle's voice state on another element (the dashboard's voice box, "Your week", the forecast's
  // Ask card, the tour bubble): sets its data-voice-state, swaps the picture in an .assistant-face inside
  // it, and fills a [data-voice-fx] slot with the decorations. With once, it stops after Uncle is back to
  // ready, so a "Your week" Play only follows its own speech. Returns a function that stops following and
  // puts the element back to ready.
  function follow(element, { once = false } = {}) {
    const slot = element.querySelector("[data-voice-fx]");
    if (slot && !slot.firstElementChild) slot.innerHTML = VOICE_FX;
    let busySeen = false;
    let started = false;
    let stop = null;
    const show = state => {
      element.dataset.voiceState = state;
      showFace(element, state);
    };
    stop = window.chickyAssistant.onVoiceState(state => {
      show(state);
      // With once, only what happens after following starts counts: Uncle may already be talking (his greeting).
      if (!started) started = true;
      else if (state !== "ready") busySeen = true;
      else if (once && busySeen) stop?.();
    });
    return () => {
      stop();
      show("ready");
    };
  }

  // Uncle's round avatar at rest, or the picture for the current voice state.
  function showFace(element, state) {
    const image = element.querySelector(".assistant-face img");
    if (!image) return;
    const picture = `${UNCLE_IMAGES}${state === "ready" ? "avatar-64" : state}.webp`;
    if (image.getAttribute("src") === picture) return;
    image.srcset = state === "ready" ? AVATAR_SRCSET : "";
    image.src = picture;
  }

  init();

  async function init() {
    if (!await statusLoaded) return;

    document.body.append(bubble, panel);
    addMessage("assistant", status.available
      ? "Tell me what you sold, like “today chicken rice 42, char siew 30”. I’ll show it to you before anything is saved."
      : "The assistant isn’t set up on this server yet.");
    showSaying(log.querySelector(".assistant-message.is-on-stage")?.textContent ?? "");
    if (status.available) showUsage(status.usage);
    updateControls();

    bubble.addEventListener("click", () => setOpen(panel.hidden));
    panel.querySelector(".assistant-close").addEventListener("click", () => setOpen(false));
    panel.addEventListener("keydown", event => {
      if (event.key === "Escape") setOpen(false);
    });
    form.addEventListener("submit", event => {
      event.preventDefault();
      sendFromInput(input);
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendFromInput(input);
      }
    });
    micButton.addEventListener("click", toggleRecording);
    soundButton.hidden = !status.voice;
    soundButton.addEventListener("click", () => setMuted(!muted));
    setMuted(muted);

    connectDashboardChatBox();
    connectAskCards();
    preloadVoicePictures();
  }

  // The dashboard's chat box is the large version of this widget: it sends through the same
  // conversation and opens the panel to show the reply.
  function connectDashboardChatBox() {
    const chatBox = document.querySelector(".chat-box");
    if (!chatBox) return;

    const chatInput = chatBox.querySelector("textarea");
    const chatSend = chatBox.querySelector(".send");
    const chatMic = chatBox.querySelector(".chat-mic");

    // The large version of the widget, so it shows Uncle in the same state, and its mic is pressed
    // while he listens.
    follow(chatBox);
    window.chickyAssistant.onVoiceState(state => chatMic.setAttribute("aria-pressed", String(state === "listening")));

    chatInput.placeholder = "Say your sales, e.g. “chicken rice 42”";
    chatInput.addEventListener("keydown", event => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        setOpen(true);
        sendFromInput(chatInput);
      }
    });

    chatSend.disabled = !status.available;
    chatSend.title = `Send to ${ASSISTANT_NAME}`;
    chatSend.addEventListener("click", () => {
      setOpen(true);
      sendFromInput(chatInput);
    });

    chatMic.disabled = !status.voice;
    chatMic.title = status.voice ? `Speak to ${ASSISTANT_NAME}` : "Voice input isn’t available on this server";
    chatMic.addEventListener("click", () => {
      setOpen(true);
      toggleRecording();
    });
  }

  // Cards marked data-assistant-ask (the forecast page's "Ask about this forecast") send a typed
  // question, or a suggestion button's data-question, through this conversation and open the panel.
  function connectAskCards() {
    document.querySelectorAll("[data-assistant-ask]").forEach(card => {
      // Its answers come from Uncle, so his face there follows his state too.
      follow(card);
      const askForm = card.querySelector("form");
      const askInput = askForm.querySelector("input, textarea");
      card.querySelectorAll("input, textarea, button").forEach(control => {
        control.disabled = !status.available;
      });

      askForm.addEventListener("submit", event => {
        event.preventDefault();
        setOpen(true);
        askedFromCard = true;
        sendFromInput(askInput);
      });
      card.querySelectorAll("[data-question]").forEach(button => {
        button.addEventListener("click", () => {
          if (busy || !status.available) return;
          setOpen(true);
          askedFromCard = true;
          send(button.dataset.question);
        });
      });
    });
  }

  // The panel springs up out of the launcher, and closing plays it backwards (instant with reduced motion).
  function setOpen(open) {
    clearTimeout(closeTimer);
    bubble.setAttribute("aria-expanded", String(open));
    bubble.setAttribute("aria-label", open ? `Close ${ASSISTANT_NAME}` : `Open ${ASSISTANT_NAME}, the voice assistant`);
    if (open) {
      panel.classList.remove("is-closing");
      panel.hidden = false;
      input.focus();
      // The first time he is opened, Uncle says his greeting.
      if (!greeted) {
        greeted = true;
        const greeting = log.querySelector(".assistant-message.is-on-stage")?.textContent;
        if (greeting && !busy && voiceState === "ready") revealTimed(greeting);
      }
    } else {
      bubble.focus();
      if (panel.hidden) return;
      if (reducedMotion.matches) {
        panel.hidden = true;
      } else {
        panel.classList.add("is-closing");
        closeTimer = setTimeout(() => {
          panel.hidden = true;
          panel.classList.remove("is-closing");
        }, 220);
      }
    }
  }

  function updateControls() {
    const usedUp = !messagesLeft();
    input.disabled = !status.available || busy || usedUp;
    sendButton.disabled = !status.available || busy || usedUp;
    micButton.disabled = !status.voice || (busy && !recorder) || usedUp;
    micButton.title = status.voice ? "" : "Voice input isn’t available on this server; please type";
  }

  // ---- Daily allowance ----

  function messagesLeft() {
    return !usage || usage.messagesUsed < usage.messagesPerDay;
  }

  function showUsage(next) {
    if (!next) return;
    usage = next;
    const left = usage.messagesPerDay - usage.messagesUsed;
    usageLine.hidden = false;
    usageLine.textContent = left > 0
      ? `${usage.messagesUsed} of ${usage.messagesPerDay} messages used today`
      : `All ${usage.messagesPerDay} of today’s messages are used. You can still enter sales yourself; the assistant is back at midnight.`;
    usageLine.classList.toggle("is-low", left <= Math.max(1, Math.floor(usage.messagesPerDay / 10)));
    updateControls();
  }

  // The server said today's messages are used up (another tab may have used them).
  function markMessagesUsedUp() {
    if (usage) showUsage({ ...usage, messagesUsed: usage.messagesPerDay });
  }

  function sendFromInput(source) {
    const text = source.value.trim();
    if (!text || busy || !status.available) return;
    source.value = "";
    if (source !== input) input.value = "";
    send(text);
  }

  async function send(text) {
    const inputMode = fromVoice ? "voice" : "text";
    fromVoice = false;
    debug("sending message", { inputMode, characters: text.length, page: PAGE });

    addMessage("user", text);
    const fromCard = askedFromCard;
    askedFromCard = false;
    stagePose = null;
    finishReveal();
    showThinking();
    setBusy(true, "Thinking…");

    try {
      const response = await apiRequest("/api/assistant/messages", {
        method: "POST",
        body: JSON.stringify({ conversationId, text, page: PAGE, inputMode, pageContext: describePage(), forecast: shownForecast })
      });
      conversationId = response.conversationId;
      writeStored(CONVERSATION_KEY, conversationId);
      debug("reply", { proposal: response.proposal?.id ?? null, guideSteps: response.guide?.length ?? 0 });
      showUsage(response.usage);
      addMessage("assistant", response.reply);
      if (response.sources?.length) addSources(response.sources);
      if (response.proposal) addConfirmCard(response.proposal);
      stagePose = poseForReply(response, fromCard);
      if (response.guide?.length && window.chickyGuide) {
        // The tour reads its own steps aloud.
        showSaying(response.reply);
        setOpen(false);
        window.chickyGuide.start(response.guide);
      } else {
        sayReply(response.reply);
      }
    } catch (error) {
      warn("message failed:", error.status, error.code, error.message);
      addMessage("error", errorMessage(error));
      showSaying(errorMessage(error));
      if (error.code === "DAILY_LIMIT") markMessagesUsedUp();
    } finally {
      setBusy(false, "");
    }
  }

  function setBusy(isBusy, message) {
    busy = isBusy;
    statusLine.textContent = message;
    updateControls();
    updateVoiceState();
  }

  // ---- Voice state ----

  // Works out Uncle's state from what the widget is doing: recording beats working, which beats
  // talking. Called whenever one of those changes; the text in .assistant-status is unchanged.
  function updateVoiceState() {
    const playing = currentAudio && !currentAudio.paused && !currentAudio.ended;
    setVoiceState(recorder ? "listening" : busy || pendingSpeech !== null ? "thinking" : playing || revealing ? "speaking" : "ready");
  }

  function setVoiceState(next) {
    if (next === voiceState) return;
    voiceState = next;
    [bubble, panel].forEach(node => {
      node.dataset.voiceState = next;
      showFace(node, next);
    });
    if (next !== "speaking" && next !== "listening") setVoiceLevel(0);
    updateStage();
    debug("voice state", next);
    voiceListeners.forEach(callback => {
      try {
        callback(next);
      } catch (error) {
        warn("voice state listener failed:", error.message);
      }
    });
  }

  // Fetches the three state pictures once the page is idle, so the first change of state doesn't flash.
  function preloadVoicePictures() {
    const later = window.requestIdleCallback || (callback => setTimeout(callback, 2000));
    later(() => [...VOICE_STATES.filter(state => state !== "ready"), "pointing", "presenting"].forEach(state => {
      new Image().src = `${UNCLE_IMAGES}${state}.webp`;
    }));
  }

  // ---- Spoken replies ----

  function setMuted(isMuted) {
    muted = isMuted;
    writeStored(MUTED_KEY, String(muted), localStorage);
    soundButton.innerHTML = muted ? MUTED_ICON : SOUND_ICON;
    soundButton.setAttribute("aria-pressed", String(muted));
    soundButton.setAttribute("aria-label", "Mute spoken replies");
    soundButton.title = muted ? "Spoken replies are off" : "Spoken replies are on";
    if (muted) stopSpeaking();
  }

  // Reads text aloud, resolving to whether it played. Optional: the text is always shown, so failures
  // (no audio support, autoplay blocked after moving page) are ignored.
  async function speak(text, { evenIfMuted = false, reveal = false } = {}) {
    stopSpeaking();
    const request = speechRequest;
    const silenced = () => muted && !evenIfMuted;
    const notSpeaking = () => {
      debug("not speaking:", silenced() ? "muted" : !status?.voice ? "voice unavailable" : "nothing to say");
      return false;
    };
    if (silenced() || !text) return notSpeaking();

    // Marked before the first await, so a reply goes straight from thinking to speaking.
    pendingSpeech = request;
    updateVoiceState();
    try {
      if (!await statusLoaded || silenced() || !status.voice) return notSpeaking();
      const audio = await apiRequest("/api/assistant/speech", {
        method: "POST",
        body: JSON.stringify({ text: text.slice(0, 500) }),
        responseType: "blob"
      });
      if (request !== speechRequest || silenced()) {
        debug("speech arrived after it was stopped; not playing");
        return false;
      }

      const url = URL.createObjectURL(audio);
      currentAudio = new Audio(url);
      currentAudio.addEventListener("ended", () => URL.revokeObjectURL(url));
      ["playing", "pause", "ended"].forEach(type => currentAudio.addEventListener(type, updateVoiceState));
      const talk = await talkWith(currentAudio, reveal ? text : null);
      if (request !== speechRequest) {
        talk?.();
        return false;
      }
      stageTalk = talk;
      await currentAudio.play();
      debug("playing speech", { bytes: audio.size, type: audio.type });
      return true;
    } catch (error) {
      stageTalk?.();
      stageTalk = null;
      // Text only. NotAllowedError means the browser blocked playback without a recent tap.
      warn("speech failed:", error.name, error.status ?? "", error.code ?? "", error.message);
      // Today's spoken replies are used up. Say so once; replies already heard today (cached on
      // the server) still play, and everything else stays as text.
      if (error.code === "SPEECH_LIMIT" && !speechLimitShown) {
        speechLimitShown = true;
        addMessage("assistant", error.message);
      }
      return false;
    } finally {
      if (pendingSpeech === request) pendingSpeech = null;
      updateVoiceState();
    }
  }

  // Stops playback and any reply still being fetched.
  function stopSpeaking() {
    speechRequest++;
    pendingSpeech = null;
    currentAudio?.pause();
    currentAudio = null;
    stageTalk?.();
    stageTalk = null;
    finishReveal();
    updateVoiceState();
  }

  // What's on screen, so the assistant can point at things the app guide doesn't describe yet.
  // Elements with a data-guide-id keep it; others get a temporary data-live-guide-id.
  function describePage() {
    document.querySelectorAll("[data-live-guide-id]").forEach(node => node.removeAttribute("data-live-guide-id"));

    const described = [];
    const candidates = document.querySelectorAll(
      "[data-guide-id], main :is(h1, h2, button, a[href], input, select, textarea), header :is(a[href], button, summary)");
    let liveCount = 0;

    for (const node of candidates) {
      if (described.length >= MAX_PAGE_ELEMENTS) break;
      if (node.closest(".assistant-panel, .guide-layer") || !node.getClientRects().length) continue;

      let id = node.dataset.guideId;
      if (!id) {
        id = `live-${++liveCount}`;
        node.dataset.liveGuideId = id;
      }
      described.push({ id, kind: kindOf(node), label: labelOf(node) });
    }
    return described;
  }

  function kindOf(node) {
    const tag = node.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag)) return "heading";
    if (tag === "a") return "link";
    if (tag === "summary") return "menu";
    return node.dataset.guideId && !["button", "input", "select", "textarea"].includes(tag) ? "section" : tag;
  }

  function labelOf(node) {
    const text = node.getAttribute("aria-label")
      || node.labels?.[0]?.textContent
      || node.querySelector?.("h2, h1")?.textContent
      || node.textContent
      || node.getAttribute("placeholder")
      || "";
    return text.replace(/\s+/g, " ").trim().slice(0, 80);
  }

  // ---- Voice input ----

  async function toggleRecording() {
    if (recorder) {
      debug("mic tapped: stopping");
      stopReason = "tap";
      recorder.stop();
      return;
    }
    if (!status.voice || busy) {
      debug("mic tap ignored:", !status.voice ? "voice unavailable" : "busy");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      warn("this browser can't record here (needs https or localhost, and MediaRecorder)", location.origin);
      addMessage("error", "This browser can’t record audio here. Please type instead.");
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      warn("microphone refused:", error.name, error.message);
      addMessage("error", "I can’t use the microphone. Allow it from the icon in the address bar, or type instead.");
      return;
    }
    const track = stream.getAudioTracks()[0];
    debug("microphone", track?.label, track?.getSettings?.());

    const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
    const chunks = [];
    const started = performance.now();
    stopReason = null;
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.addEventListener("dataavailable", event => {
      if (event.data.size) chunks.push(event.data);
    });
    recorder.addEventListener("error", event => warn("recorder error:", event.error?.name, event.error?.message));

    const stopIfRecording = reason => {
      if (recorder?.state === "recording") {
        stopReason = reason;
        recorder.stop();
      }
    };
    const stopWatching = watchForSilence(stream, () => stopIfRecording("silence"));
    const timer = setTimeout(() => stopIfRecording("time limit"), MAX_RECORDING_MS);

    recorder.addEventListener("stop", () => {
      clearTimeout(timer);
      stopWatching();
      stream.getTracks().forEach(track => track.stop());
      const type = recorder.mimeType || mimeType || "audio/webm";
      recorder = null;
      setListening(false);

      const audio = new Blob(chunks, { type });
      debug("recording stopped", {
        reason: stopReason, seconds: ((performance.now() - started) / 1000).toFixed(1), bytes: audio.size, type
      });
      if (audio.size) {
        transcribe(audio);
      } else {
        warn("the recording is empty");
        addMessage("error", "Nothing was recorded. Check that the right microphone is selected, then try again.");
      }
    });

    recorder.start();
    debug("recording as", recorder.mimeType || "the browser's default format");
    setListening(true);
  }

  function setListening(listening) {
    micButton.classList.toggle("listening", listening);
    micButton.setAttribute("aria-pressed", String(listening));
    micButton.setAttribute("aria-label", listening ? "Stop voice input" : "Start voice input");
    statusLine.textContent = listening ? "Listening… tap the mic again when you’re done." : "";
    updateControls();
    updateVoiceState();
  }

  // Calls onSilence after SILENCE_MS of quiet that follows some speech.
  function watchForSilence(stream, onSilence) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return () => {};

    const context = new AudioContextClass();
    // Created after awaiting the microphone, so browsers may start it suspended; a suspended
    // context reads silence and the recording would never stop on its own.
    debug("silence detector:", context.state);
    if (context.state === "suspended") {
      context.resume()
        .then(() => debug("silence detector resumed:", context.state))
        .catch(error => warn("silence detector can't start; tap the mic to stop:", error.name, error.message));
    }
    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Float32Array(analyser.fftSize);

    const started = performance.now();
    let heardSpeech = false;
    let warnedQuiet = false;
    let loudest = 0;
    let quietSince = started;
    let frame = requestAnimationFrame(check);

    function check(now) {
      analyser.getFloatTimeDomainData(samples);
      const level = Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / samples.length);
      loudest = Math.max(loudest, level);
      setVoiceLevel(level * 12);

      if (level > SPEECH_LEVEL) {
        if (!heardSpeech) debug("speech detected, level", level.toFixed(3));
        heardSpeech = true;
        quietSince = now;
      } else if (heardSpeech && now - quietSince > SILENCE_MS) {
        debug(`quiet for ${SILENCE_MS / 1000} s; stopping`);
        onSilence();
        return;
      } else if (!heardSpeech && !warnedQuiet && now - started > 5000) {
        warnedQuiet = true;
        warn(`no speech after 5 s: loudest level ${loudest.toFixed(3)}, needs ${SPEECH_LEVEL}; detector ${context.state}`);
      }
      frame = requestAnimationFrame(check);
    }

    return () => {
      cancelAnimationFrame(frame);
      context.close();
    };
  }

  async function transcribe(audio) {
    setBusy(true, "Working out what you said…");
    try {
      const extension = audio.type.includes("mp4") ? "m4a" : "webm";
      const body = new FormData();
      body.append("audio", audio, `speech.${extension}`);
      debug("transcribing", { bytes: audio.size, type: audio.type });
      const result = await apiRequest("/api/assistant/transcribe", { method: "POST", body });
      debug("transcript", { characters: result.text.length, languages: result.languages });

      if (!result.text.trim()) {
        addMessage("error", "I didn’t catch that. Please try again.");
        return;
      }
      input.value = result.text;
      fromVoice = true;
      setBusy(false, "Check the text, then press Send.");
      input.focus();
      return;
    } catch (error) {
      warn("transcription failed:", error.status, error.code, error.message);
      addMessage("error", errorMessage(error));
      if (error.code === "DAILY_LIMIT") markMessagesUsedUp();
    }
    setBusy(false, "");
  }

  // ---- Confirm card ----

  function addConfirmCard(proposal) {
    if (proposal.type === "PRICE") {
      addPriceCard(proposal);
      return;
    }
    if (proposal.type === "NOTE") {
      addNoteCard(proposal);
      return;
    }
    const closures = proposal.closures || [];
    const card = element("div", "assistant-card");
    const heading = element("p", "assistant-card-title");
    heading.textContent = closures.length === 0 ? "Save these sales?"
      : proposal.entries.length === 0 ? "Save these opening days?"
      : "Save these sales and opening days?";

    const table = element("table", "assistant-entries");
    table.innerHTML = `<thead><tr><th scope="col">Date</th><th scope="col">Dish</th><th scope="col">Portions</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr></thead>`;
    const rows = element("tbody");
    table.append(rows);
    table.hidden = proposal.entries.length === 0;

    proposal.entries.forEach(entry => rows.append(entryRow(entry)));

    // Closed days aren't editable on the card: confirm them as they are, or cancel.
    const closureList = element("ul", "assistant-closures");
    closureList.hidden = closures.length === 0;
    closures.forEach(closure => {
      const item = element("li");
      item.textContent = describeClosure(closure);
      closureList.append(item);
    });

    const actions = element("div", "assistant-card-actions");
    const cancel = element("button", "assistant-secondary", { type: "button" });
    cancel.textContent = "Cancel";
    const confirm = element("button", "assistant-primary", { type: "button" });
    confirm.textContent = "Confirm";
    actions.append(cancel, confirm);

    // A card that repeats one number on many days or replaces many saved days gets a warning,
    // and Confirm isn't focused, so a quick Enter doesn't save it.
    const warnings = cardWarnings(proposal.entries);
    const warning = element("p", "assistant-card-warning", { role: "note" });
    warning.textContent = warnings.join(" ");
    warning.hidden = warnings.length === 0;

    card.append(heading, warning, table, closureList, actions);
    log.append(card);
    log.scrollTop = log.scrollHeight;
    if (warnings.length === 0) confirm.focus();

    confirm.addEventListener("click", async () => {
      const entries = [...rows.querySelectorAll("tr")].map(readRow);
      if (entries.length === 0 && closures.length === 0) {
        cancel.click();
        return;
      }
      setCardEnabled(card, false);
      try {
        const result = await apiRequest(`/api/assistant/proposals/${proposal.id}/confirm`, {
          method: "POST",
          body: JSON.stringify({ entries })
        });
        const savedClosures = result.closures || [];
        const parts = [];
        if (result.saved.length) parts.push(`${result.saved.length} ${result.saved.length === 1 ? "entry" : "entries"}`);
        if (savedClosures.length) parts.push(`${savedClosures.length} ${savedClosures.length === 1 ? "opening day" : "opening days"}`);
        closeCard(card, `Saved ${parts.join(" and ")}.`);
        window.dispatchEvent(new CustomEvent("chicky:sales-saved", { detail: result.saved }));
        celebrate();
        if (savedClosures.length) {
          window.dispatchEvent(new CustomEvent("chicky:closures-saved", { detail: savedClosures }));
        }
      } catch (error) {
        addMessage("error", errorMessage(error));
        if (error.status === 409 || error.status === 404) {
          closeCard(card, "Not saved.");
        } else {
          setCardEnabled(card, true);
        }
      }
    });

    cancel.addEventListener("click", async () => {
      setCardEnabled(card, false);
      try {
        await apiRequest(`/api/assistant/proposals/${proposal.id}/cancel`, { method: "POST" });
      } catch (error) {
        // Unsaved either way; an expired proposal can't be cancelled or saved.
      }
      closeCard(card, "Cancelled. Nothing was saved.");
    });
  }

  // A dish's new price (and maybe cost), editable before confirming. Earlier sales keep the old price.
  function addPriceCard(proposal) {
    const change = proposal.priceChange;
    const money = new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD", currencyDisplay: "narrowSymbol" });
    const shown = amount => amount === null ? "Not set" : money.format(Number(amount));
    const when = change.effectiveFrom === localToday() ? "today"
      : new Date(`${change.effectiveFrom}T00:00:00`).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });

    const card = element("div", "assistant-card");
    const heading = element("p", "assistant-card-title");
    heading.textContent = `Change the price of ${change.dishName}?`;

    const table = element("table", "assistant-entries assistant-prices");
    table.innerHTML = `<thead><tr><th scope="col"><span class="visually-hidden">Amount</span></th><th scope="col">Now</th><th scope="col">New (S$)</th></tr></thead>`;
    const rows = element("tbody");
    const priceInput = amountInput(change.price, "New price in S$");
    const costInput = amountInput(change.unitCost, "New cost in S$", change.currentUnitCost === null ? "Not set" : "Keep");
    rows.append(priceRow("Price", shown(change.currentPrice), priceInput), priceRow("Cost", shown(change.currentUnitCost), costInput));
    table.append(rows);

    const note = element("p", "assistant-previous");
    note.textContent = `From ${when}. Earlier sales keep the price they had.`;

    const actions = element("div", "assistant-card-actions");
    const cancel = element("button", "assistant-secondary", { type: "button" });
    cancel.textContent = "Cancel";
    const confirm = element("button", "assistant-primary", { type: "button" });
    confirm.textContent = "Confirm";
    actions.append(cancel, confirm);

    card.append(heading, table, note, actions);
    log.append(card);
    log.scrollTop = log.scrollHeight;
    confirm.focus();

    confirm.addEventListener("click", async () => {
      if (!priceInput.reportValidity() || !costInput.reportValidity()) return;
      setCardEnabled(card, false);
      try {
        const result = await apiRequest(`/api/assistant/proposals/${proposal.id}/confirm`, {
          method: "POST",
          body: JSON.stringify({
            price: Number(priceInput.value),
            unitCost: costInput.value === "" ? null : Number(costInput.value)
          })
        });
        const saved = result.priceChange;
        closeCard(card, `Saved: ${saved.dishName} is ${money.format(Number(saved.price))} from ${when}.`);
        window.dispatchEvent(new CustomEvent("chicky:prices-saved", { detail: saved }));
        celebrate();
      } catch (error) {
        addMessage("error", errorMessage(error));
        if (error.status === 409 || error.status === 404) {
          closeCard(card, "Not saved.");
        } else {
          setCardEnabled(card, true);
        }
      }
    });

    cancel.addEventListener("click", async () => {
      setCardEnabled(card, false);
      try {
        await apiRequest(`/api/assistant/proposals/${proposal.id}/cancel`, { method: "POST" });
      } catch (error) {
        // Unchanged either way; an expired proposal can't be cancelled or saved.
      }
      closeCard(card, "Cancelled. The price is unchanged.");
    });

    function priceRow(label, current, input) {
      const row = element("tr");
      const name = element("td");
      name.textContent = label;
      const now = element("td");
      now.textContent = current;
      const edit = element("td");
      edit.append(input);
      row.append(name, now, edit);
      return row;
    }
  }

  // "Save this note?" with the title and text editable before confirming (issue #154).
  function addNoteCard(proposal) {
    const card = element("div", "assistant-card");
    const heading = element("p", "assistant-card-title");
    heading.textContent = "Save this note?";

    const titleLabel = element("label", "assistant-note-field");
    titleLabel.append("Title");
    const title = element("input", "", { type: "text", maxlength: "120", required: "" });
    title.value = proposal.note.title;
    titleLabel.append(title);

    const textLabel = element("label", "assistant-note-field");
    textLabel.append("Note");
    const text = element("textarea", "", { rows: "3", maxlength: "2000", required: "" });
    text.value = proposal.note.text;
    textLabel.append(text);

    const hint = element("p", "assistant-previous");
    hint.textContent = "Saved to your Documents, where you can edit or delete it.";

    const actions = element("div", "assistant-card-actions");
    const cancel = element("button", "assistant-secondary", { type: "button" });
    cancel.textContent = "Cancel";
    const confirm = element("button", "assistant-primary", { type: "button" });
    confirm.textContent = "Confirm";
    actions.append(cancel, confirm);

    card.append(heading, titleLabel, textLabel, hint, actions);
    log.append(card);
    log.scrollTop = log.scrollHeight;
    confirm.focus();

    confirm.addEventListener("click", async () => {
      if (!title.value.trim()) return title.reportValidity();
      if (!text.value.trim()) return text.reportValidity();
      setCardEnabled(card, false);
      try {
        const result = await apiRequest(`/api/assistant/proposals/${proposal.id}/confirm`, {
          method: "POST",
          body: JSON.stringify({ noteTitle: title.value, noteText: text.value })
        });
        closeCard(card, "");
        const saved = card.querySelector(".assistant-card-note");
        saved.append("Saved as a note: ");
        const link = element("a", "", { href: `documents.html#document-${result.note.documentId}` });
        link.textContent = result.note.title;
        saved.append(link, ".");
        window.dispatchEvent(new CustomEvent("chicky:documents-saved", { detail: result.note }));
        celebrate();
      } catch (error) {
        addMessage("error", errorMessage(error));
        if (error.status === 409 || error.status === 404) {
          closeCard(card, "Not saved.");
        } else {
          setCardEnabled(card, true);
        }
      }
    });

    cancel.addEventListener("click", async () => {
      setCardEnabled(card, false);
      try {
        await apiRequest(`/api/assistant/proposals/${proposal.id}/cancel`, { method: "POST" });
      } catch (error) {
        // Unsaved either way; an expired proposal can't be cancelled or saved.
      }
      closeCard(card, "Cancelled. Nothing was saved.");
    });
  }

  function amountInput(value, label, placeholder = "") {
    const input = element("input", "", { type: "number", min: "0", max: "10000", step: "0.01", inputmode: "decimal", "aria-label": label });
    input.placeholder = placeholder;
    input.value = value === null ? "" : Number(value).toFixed(2);
    return input;
  }

  // "Closed · Thu 5 Nov · Centre cleaning" or "Open again · Thu 5 Nov".
  function describeClosure(closure) {
    const day = new Date(`${closure.date}T00:00:00Z`).toLocaleDateString("en-SG", {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC"
    });
    return closure.closed
      ? ["Closed", day, closure.reason].filter(Boolean).join(" · ")
      : `Open again · ${day}`;
  }

  // The same checks as the server (ProposalValidator): one dish with the same quantity on more
  // than 3 days, or more than 3 days that already have sales and would change.
  function cardWarnings(entries) {
    const warnings = [];
    const groups = new Map();
    entries.forEach(entry => {
      const key = `${entry.dishId ?? entry.dishName}|${entry.quantity}`;
      groups.set(key, [...(groups.get(key) || []), entry]);
    });
    groups.forEach(group => {
      const days = new Set(group.map(entry => entry.date)).size;
      if (days > 3) warnings.push(`${group[0].dishName} is ${group[0].quantity} on all ${days} days. Check each day is right.`);
    });
    const replaced = entries.filter(entry => entry.previousQuantity !== null && entry.previousQuantity !== undefined
      && entry.previousQuantity !== entry.quantity).length;
    if (replaced > 3) warnings.push(`This replaces ${replaced} days you already saved.`);
    return warnings;
  }

  function entryRow(entry) {
    const row = element("tr");
    row.dataset.dishId = entry.dishId ?? "";
    row.dataset.newDishName = entry.newDishName ?? "";
    row.dataset.spokenName = entry.spokenName ?? "";

    const dateCell = element("td");
    const date = element("input", "", { type: "date", value: entry.date, max: localToday(), "aria-label": `Date for ${entry.dishName}` });
    dateCell.append(date);

    const dishCell = element("td", "assistant-dish");
    dishCell.textContent = entry.dishName;
    if (entry.newDish) {
      const tag = element("span", "assistant-tag");
      tag.textContent = "New dish";
      dishCell.append(" ", tag);
    }
    if (entry.spokenName && entry.spokenName.toLowerCase() !== entry.dishName.toLowerCase()) {
      const heard = element("span", "assistant-heard");
      heard.textContent = `heard “${entry.spokenName}”`;
      dishCell.append(heard);
    }
    // Shown only when the assistant heard one; clearing the field saves the day without it.
    if (entry.soldOutAt) {
      const soldOut = element("label", "assistant-outcome");
      soldOut.append("Sold out at ", element("input", "assistant-sold-out", { type: "time", value: entry.soldOutAt }));
      dishCell.append(soldOut);
    }
    if (entry.leftoverQuantity !== null && entry.leftoverQuantity !== undefined) {
      const leftover = element("label", "assistant-outcome");
      leftover.append("Left over ", element("input", "assistant-leftover", {
        type: "number", min: "0", max: "9999", value: entry.leftoverQuantity, inputmode: "numeric"
      }));
      dishCell.append(leftover);
    }

    const quantityCell = element("td");
    const quantity = element("input", "assistant-quantity", { type: "number", min: "0", max: "9999", value: entry.quantity, "aria-label": `Portions of ${entry.dishName}` });
    quantityCell.append(quantity);
    if (entry.previousQuantity !== null && entry.previousQuantity !== undefined) {
      const previous = element("span", "assistant-previous");
      previous.textContent = `was ${entry.previousQuantity}`;
      quantityCell.append(previous);
    }

    const removeCell = element("td");
    const remove = element("button", "assistant-remove", { type: "button", "aria-label": `Remove ${entry.dishName}` });
    remove.innerHTML = "&times;";
    remove.addEventListener("click", () => row.remove());
    removeCell.append(remove);

    row.append(dateCell, dishCell, quantityCell, removeCell);
    return row;
  }

  function readRow(row) {
    const value = selector => row.querySelector(selector)?.value || null;
    const leftover = value(".assistant-leftover");
    return {
      dishId: row.dataset.dishId ? Number(row.dataset.dishId) : null,
      newDishName: row.dataset.newDishName || null,
      spokenName: row.dataset.spokenName || null,
      date: value('input[type="date"]'),
      quantity: value(".assistant-quantity") === null ? null : Number(value(".assistant-quantity")),
      soldOutAt: value(".assistant-sold-out"),
      leftoverQuantity: leftover === null ? null : Number(leftover)
    };
  }

  function setCardEnabled(card, enabled) {
    card.querySelectorAll("input, textarea, button").forEach(control => {
      control.disabled = !enabled;
    });
  }

  function closeCard(card, message) {
    if (stagePose === "pointing") {
      stagePose = null;
      updateStage();
    }
    setCardEnabled(card, false);
    card.querySelector(".assistant-card-actions").remove();
    card.querySelectorAll(".assistant-remove").forEach(button => button.remove());
    const note = element("p", "assistant-card-note");
    note.textContent = message;
    card.append(note);
  }

  // ---- Uncle's stage (issue #37) ----

  // Points at a confirm card; presents an answer from an Ask card, from documents, or with figures in it.
  function poseForReply(response, fromCard) {
    if (response.proposal) return "pointing";
    const figures = /\d/.test(response.reply) && /portion|forecast|revenue|sold|sales|week|expect|\$/i.test(response.reply);
    return fromCard || response.sources?.length || figures ? "presenting" : null;
  }

  // His picture: the voice state's, or at rest the pose the last reply asked for. A change of picture is a
  // little hop (CSS; none with reduced motion).
  function updateStage() {
    const pose = voiceState === "ready" ? stagePose || "ready" : voiceState;
    panel.dataset.stagePose = pose;
    if (pose === shownPose) return;
    shownPose = pose;
    unclePose.src = `${UNCLE_IMAGES}${pose}.webp`;
    if (!reducedMotion.matches) {
      uncleBody.classList.remove("is-hopping");
      void uncleBody.offsetWidth;
      uncleBody.classList.add("is-hopping");
    }
    if (voiceState !== "speaking") setMouth(true);
  }

  // Saved: Uncle hops and a little burst of Yolk and Coral pops off his counter. Nothing with reduced motion.
  function celebrate() {
    if (reducedMotion.matches || panel.hidden) return;
    uncleBody.classList.remove("is-hopping");
    void uncleBody.offsetWidth;
    uncleBody.classList.add("is-hopping");
    const burst = element("div", "assistant-confetti", { "aria-hidden": "true" });
    for (let i = 0; i < 14; i++) {
      const bit = element("span");
      const angle = (-165 + Math.random() * 150) * Math.PI / 180;
      const distance = 70 + Math.random() * 80;
      bit.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
      bit.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
      bit.style.setProperty("--spin", `${Math.round(Math.random() * 540 - 270)}deg`);
      bit.style.animationDelay = `${Math.round(Math.random() * 80)}ms`;
      burst.append(bit);
    }
    panel.append(burst);
    setTimeout(() => burst.remove(), 1300);
  }

  // Mouth open shows speaking.webp; shut lays ready.webp over it (they share one canvas).
  function setMouth(open) {
    panel.classList.toggle("is-mouth-shut", !open);
  }

  // How loud Uncle (or the user, while listening) is, 0–1, for the glow. Still with reduced motion.
  function setVoiceLevel(level) {
    if (reducedMotion.matches) return;
    panel.style.setProperty("--voice-level", Math.min(1, Math.max(0, level)).toFixed(2));
  }

  function showSaying(text) {
    finishReveal();
    sayBox.classList.remove("is-thinking");
    sayText.textContent = text;
  }

  function showThinking() {
    sayBox.classList.add("is-thinking");
    sayText.textContent = "";
  }

  // A reply: read aloud when voice is on, the words appearing in step with the audio; otherwise revealed word
  // by word with his mouth flapping. With reduced motion the whole reply appears at once.
  function sayReply(text) {
    sayBox.classList.remove("is-thinking");
    if (muted || !status.voice) {
      revealTimed(text);
      return;
    }
    showThinking();
    speak(text, { reveal: true }).then(played => {
      if (!played) revealTimed(text);
    });
  }

  // Word by word, with the mouth open for each word and shut between them.
  function revealTimed(text) {
    stopReveal();
    sayBox.classList.remove("is-thinking");
    if (reducedMotion.matches || !text) {
      sayText.textContent = text;
      return;
    }
    const words = text.split(/(\s+)/);
    let shown = 0;
    let timer = 0;
    revealing = true;
    updateVoiceState();
    const step = () => {
      if (shown >= words.length) {
        finishReveal();
        return;
      }
      const word = words[shown];
      shown += 2;
      sayText.textContent = words.slice(0, shown).join("");
      sayText.scrollTop = sayText.scrollHeight;
      const length = Math.min(260, Math.max(110, 50 + word.length * 32));
      setMouth(true);
      setVoiceLevel(0.55 + Math.random() * 0.35);
      timer = setTimeout(() => {
        setMouth(false);
        setVoiceLevel(0.2);
        timer = setTimeout(step, length * 0.4);
      }, length * 0.6);
    };
    stopReveal = () => {
      clearTimeout(timer);
      stopReveal = () => {};
    };
    finishReveal = () => {
      stopReveal();
      sayText.textContent = text;
      revealing = false;
      setMouth(true);
      setVoiceLevel(0);
      updateVoiceState();
      finishReveal = () => {};
    };
    step();
  }
  let stopReveal = () => {};
  let finishReveal = () => {};

  // While audio plays: the glow and the mouth follow its loudness through an AnalyserNode, and the words of the
  // pending reply appear in step with the playback. If the browser won't run the audio context (it can start
  // suspended), the mouth flaps on a timer instead, so the audio is never routed through a silent graph.
  // Returns a function that stops it.
  async function talkWith(audio, text) {
    const words = text ? text.split(/(\s+)/) : null;
    if (reducedMotion.matches) {
      if (text) showSaying(text);
      return null;
    }
    if (text) {
      sayBox.classList.remove("is-thinking");
      sayText.textContent = "";
    }
    let analyser = null;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      talkContext ??= new Context();
      if (talkContext.state !== "running") {
        await Promise.race([talkContext.resume(), new Promise(resolve => setTimeout(resolve, 300))]);
      }
      if (talkContext.state === "running") {
        analyser = talkContext.createAnalyser();
        analyser.fftSize = 1024;
        const source = talkContext.createMediaElementSource(audio);
        source.connect(analyser);
        analyser.connect(talkContext.destination);
      }
    } catch (error) {
      warn("talking animation without the analyser:", error.name, error.message);
      analyser = null;
    }
    debug("talking with", analyser ? "the analyser" : "a timer");
    const samples = analyser ? new Float32Array(analyser.fftSize) : null;
    let open = false;
    let frame = 0;
    let flipAt = 0;
    const tick = now => {
      let loudness;
      if (analyser) {
        analyser.getFloatTimeDomainData(samples);
        loudness = Math.sqrt(samples.reduce((total, sample) => total + sample * sample, 0) / samples.length);
        // Open above one level and shut below a lower one, so it flaps rather than flickers.
        open = open ? loudness > 0.02 : loudness > 0.04;
        setVoiceLevel(loudness * 6);
      } else if (!audio.paused && now >= flipAt) {
        open = !open;
        flipAt = now + (open ? 120 + Math.random() * 90 : 70 + Math.random() * 60);
        setVoiceLevel(open ? 0.7 : 0.25);
      }
      setMouth(audio.paused || open);
      if (words && audio.duration > 0) {
        const count = Math.ceil((audio.currentTime / audio.duration) * words.length);
        sayText.textContent = words.slice(0, count).join("");
        sayText.scrollTop = sayText.scrollHeight;
      }
      if (!audio.ended) frame = requestAnimationFrame(tick);
      else stop();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      if (text) sayText.textContent = text;
      setMouth(true);
      setVoiceLevel(0);
    };
    frame = requestAnimationFrame(tick);
    return stop;
  }

  // ---- Helpers ----

  // What the widget is doing, in the browser console. Filter on "[assistant]".
  function debug(...details) {
    console.info("[assistant]", ...details);
  }

  function warn(...details) {
    console.warn("[assistant]", ...details);
  }

  // Uncle's latest line is the one on stage: it stays in the log for screen readers (read once, whole) but is
  // only seen in the speech bubble; earlier lines show in the log as history.
  function addMessage(kind, text) {
    const message = element("p", `assistant-message ${kind}`);
    message.textContent = text;
    if (kind === "assistant") {
      log.querySelectorAll(".is-on-stage").forEach(line => line.classList.remove("is-on-stage"));
      message.classList.add("is-on-stage");
    }
    log.append(message);
    log.scrollTop = log.scrollHeight;
  }

  // "From: Ah Huat Poultry", linking to each document the reply came from (issue #153).
  function addSources(sources) {
    const line = element("p", "assistant-sources");
    line.append("From: ");
    sources.forEach((source, index) => {
      if (index) line.append(", ");
      const link = element("a", "", { href: `documents.html#document-${source.documentId}` });
      link.textContent = source.title;
      line.append(link);
    });
    log.append(line);
    log.scrollTop = log.scrollHeight;
  }

  function errorMessage(error) {
    if (error.status === 401) return "Please sign in again.";
    return error.message || "Something went wrong. Please try again.";
  }

  function element(tag, className = "", attributes = {}) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
    return node;
  }

  function localToday() {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  // Storage can be unavailable (private windows, blocked cookies); the assistant works without it.
  // The conversation is per tab (sessionStorage); the mute setting is per browser (localStorage).
  function readStored(key, storage = sessionStorage) {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStored(key, value, storage = sessionStorage) {
    try {
      storage.setItem(key, value);
    } catch (error) {
      // Not remembered; defaults apply next time.
    }
  }
})();
