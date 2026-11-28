// A view over authoritative Realtime events. Sales only become "Saved" after a backend result.
(() => {
  const byId = id => document.getElementById(id);
  const start = byId("shift-start");
  const mute = byId("shift-mute");
  const end = byId("shift-end");
  const message = byId("shift-message");
  const confirm = byId("shift-confirm-button");
  const cancel = byId("shift-cancel-button");
  const captions = byId("shift-captions");
  let controller;
  let active = false;
  let available = false;
  let muted = false;
  let busy = false;
  let pending = null;
  let revision = 0;
  let captionRows = new Map();
  const number = new Intl.NumberFormat("en-SG", { maximumFractionDigits: 3 });
  const stateLabels = {
    connecting: "Connecting…", listening: "Listening", thinking: "Thinking…",
    speaking: "Uncle is speaking", disconnected: "Ready when you are", error: "Connection needs attention"
  };

  byId("shift-date").textContent = new Intl.DateTimeFormat("en-SG", {
    timeZone: "Asia/Singapore", weekday: "long", day: "numeric", month: "long"
  }).format(new Date());
  byId("shift-sample").hidden = new URLSearchParams(location.search).get("sample") !== "1";
  mute.textContent = "Mute Uncle";

  function note(text, error = false) {
    message.textContent = text;
    message.classList.toggle("is-error", error);
  }

  function buttons() {
    start.disabled = !available || active || busy;
    mute.disabled = !active || busy;
    end.disabled = !active || busy;
    confirm.disabled = !pending || !active || busy;
    cancel.disabled = !pending || !active || busy;
    start.textContent = active ? "Conversation started" : "Talk to Uncle";
  }

  function setState(state) {
    const known = Object.hasOwn(stateLabels, state) ? state : "disconnected";
    byId("shift-state").textContent = stateLabels[known];
    document.querySelector(".shift-voice").dataset.state = known;
    const pose = ["listening", "thinking", "speaking"].includes(known) ? known : "ready";
    byId("shift-uncle").src = `images/brand/uncle/${pose}.webp`;
    active = !["disconnected", "error"].includes(known);
    buttons();
  }

  function transcript(detail) {
    if (!detail || typeof detail.text !== "string" || !detail.text.trim()) return;
    if (captions.querySelector(".shift-caption-empty")) captions.replaceChildren();
    const role = detail.role === "user" ? "user" : "assistant";
    const key = `${role}:${detail.turnId || "current"}`;
    let row = captionRows.get(key);
    if (!row) {
      const element = document.createElement("p");
      const label = document.createElement("span");
      label.className = "shift-caption-label";
      label.textContent = role === "user" ? "You" : "Uncle";
      const text = document.createElement("span");
      element.append(label, text);
      captions.append(element);
      row = { element, text };
      captionRows.set(key, row);
      while (captionRows.size > 6) {
        const oldest = captionRows.keys().next().value;
        captionRows.get(oldest).element.remove();
        captionRows.delete(oldest);
      }
    }
    row.text.textContent = detail.text;
    captions.scrollTop = captions.scrollHeight;
  }

  function entryKey(entry) { return `${entry.dishId ?? entry.newDishName ?? entry.dishName}:${entry.date}`; }

  function dateText(value) {
    if (!value) return "";
    const date = new Date(`${value}T12:00:00+08:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-SG", {
      timeZone: "Asia/Singapore", day: "numeric", month: "short"
    }).format(date);
  }

  function renderSales(entries, previous = []) {
    const list = byId("shift-sales-list");
    list.replaceChildren();
    const oldEntries = new Map(previous.map(entry => [entryKey(entry), entry]));
    const changes = [];
    for (const entry of entries) {
      const row = document.createElement("li");
      const copy = document.createElement("div");
      copy.className = "shift-entry-copy";
      const name = document.createElement("span");
      name.textContent = entry.dishName || entry.newDishName || "Dish";
      const details = document.createElement("small");
      details.textContent = [dateText(entry.date), entry.leftoverQuantity != null ? `${entry.leftoverQuantity} left over` : null,
        entry.soldOutAt ? `Sold out ${entry.soldOutAt}` : null].filter(Boolean).join(" · ");
      copy.append(name, details);
      const quantity = document.createElement("span");
      quantity.className = "shift-quantity";
      quantity.setAttribute("aria-label", `${entry.quantity} portions`);
      const old = oldEntries.get(entryKey(entry));
      if (old && old.quantity !== entry.quantity) {
        const before = document.createElement("del");
        before.textContent = old.quantity;
        before.setAttribute("aria-label", `previously ${old.quantity}`);
        quantity.append(before);
        quantity.classList.add("is-corrected");
        changes.push(`${name.textContent}: ${old.quantity} → ${entry.quantity}`);
      }
      quantity.append(document.createTextNode(String(entry.quantity)));
      row.append(copy, quantity);
      list.append(row);
    }
    byId("shift-sales-empty").hidden = entries.length > 0;
    if (changes.length) {
      byId("shift-change").textContent = changes.join(" · ");
      byId("shift-change").hidden = false;
    }
  }

  function proposal(detail) {
    if (!detail || (typeof detail.revision === "number" && detail.revision < revision)) return;
    revision = detail.revision ?? revision;
    const previous = pending?.entries || [];
    pending = detail.proposal || null;
    byId("shift-confirm").hidden = !pending;
    const state = byId("shift-sales-state");
    state.dataset.saved = "false";
    state.textContent = pending ? "Awaiting confirmation" : "Nothing saved";
    if (pending) {
      renderSales(pending.entries || [], previous);
      note("Check Uncle’s readback, then say “yes, save” or press Confirm.");
    } else {
      byId("shift-sales-list").replaceChildren();
      byId("shift-sales-empty").hidden = false;
      byId("shift-change").hidden = true;
      note("Cancelled. Nothing was saved.");
    }
    buttons();
  }

  function saved(detail) {
    if (!detail || (typeof detail.revision === "number" && detail.revision < revision)) return;
    if (!["CONFIRMED", "EDITED"].includes(detail.saved?.outcome)) {
      note("Couldn’t verify that the sales were saved. Check the sales card before trying again.", true);
      return;
    }
    revision = detail.revision ?? revision;
    renderSales(detail.saved.saved || detail.proposal?.entries || []);
    pending = null;
    byId("shift-confirm").hidden = true;
    byId("shift-sales-state").textContent = "Saved";
    byId("shift-sales-state").dataset.saved = "true";
    byId("shift-prompt").textContent = "“明天准备多少？” — What should I prepare tomorrow?";
    note("Sales saved. Ask Uncle what to prepare tomorrow.");
    buttons();
  }

  function renderPrep(detail) {
    const prep = detail?.prep;
    if (!prep || !Array.isArray(prep.dishes) || !Array.isArray(prep.ingredients)) return;
    byId("shift-portions-list").replaceChildren();
    byId("shift-ingredients-list").replaceChildren();
    byId("shift-plan-date").textContent = dateText(prep.date);
    byId("shift-plan-date").hidden = !prep.date;
    byId("shift-prep-empty").hidden = prep.dishes.length > 0;
    byId("shift-ingredients-empty").hidden = prep.ingredients.length > 0;
    byId("shift-prep-empty").textContent = prep.closed ? `The stall is closed: ${prep.closed}` : "No portions are available yet. Add sales history to generate a plan.";
    byId("shift-ingredients-empty").textContent = prep.closed ? "No ingredients needed for a closed day." : "No ingredient quantities yet. Add recipes on the full Prep list.";
    for (const dish of prep.dishes) {
      const row = document.createElement("li");
      const copy = document.createElement("div");
      copy.className = "shift-entry-copy";
      const name = document.createElement("span");
      name.textContent = dish.dish;
      const basis = document.createElement("small");
      basis.textContent = `${dish.method === "MODEL" ? "Model forecast" : "Past-sales baseline"} · ${dish.low}–${dish.high} likely demand`;
      basis.title = dish.basis || "";
      copy.append(name, basis);
      const amount = document.createElement("span");
      amount.className = "shift-quantity";
      amount.textContent = number.format(dish.portions);
      amount.setAttribute("aria-label", `${dish.portions} portions`);
      row.append(copy, amount);
      byId("shift-portions-list").append(row);
    }
    for (const ingredient of prep.ingredients) {
      const row = document.createElement("li");
      const copy = document.createElement("div");
      copy.className = "shift-entry-copy";
      const name = document.createElement("span");
      name.textContent = ingredient.ingredient;
      const source = document.createElement("small");
      source.textContent = ingredient.perishable ? "Buy for the day" : "Take from stock";
      copy.append(name, source);
      const amount = document.createElement("span");
      amount.className = "shift-ingredient-quantity";
      amount.textContent = `${number.format(ingredient.toBuy)} ${ingredient.unit}`;
      row.append(copy, amount);
      byId("shift-ingredients-list").append(row);
    }
    const skipped = prep.skipped || [];
    byId("shift-plan-note").textContent = skipped.map(dish => `${dish.dish}: ${dish.reason}`).join(" · ");
    byId("shift-plan-note").hidden = skipped.length === 0;
  }

  async function action(callback) {
    busy = true;
    buttons();
    try { await callback(); }
    catch (error) { note(error.message || "Couldn’t complete that action. Try again.", true); }
    finally { busy = false; buttons(); }
  }

  start.addEventListener("click", () => action(async () => {
    // A new live session begins at revision zero, independent of the previous take.
    revision = 0;
    pending = null;
    captionRows.clear();
    captions.replaceChildren();
    byId("shift-sales-list").replaceChildren();
    byId("shift-sales-empty").hidden = false;
    byId("shift-change").hidden = true;
    byId("shift-confirm").hidden = true;
    byId("shift-sales-state").textContent = "Ready to record";
    byId("shift-sales-state").dataset.saved = "false";
    byId("shift-portions-list").replaceChildren();
    byId("shift-ingredients-list").replaceChildren();
    byId("shift-prep-empty").hidden = false;
    byId("shift-ingredients-empty").hidden = false;
    byId("shift-plan-date").hidden = true;
    byId("shift-plan-note").hidden = true;
    note("Connecting your microphone…");
    await controller.start();
  }));
  mute.addEventListener("click", () => {
    muted = !muted;
    controller.setMuted(muted);
    mute.setAttribute("aria-pressed", String(muted));
    mute.textContent = muted ? "Unmute Uncle" : "Mute Uncle";
    note(muted ? "Uncle is muted. Your microphone is still listening." : "Uncle’s voice is on.");
  });
  end.addEventListener("click", () => action(async () => {
    await controller.disconnect();
    setState("disconnected");
    note("Conversation ended. Your microphone is off.");
  }));
  confirm.addEventListener("click", () => action(() => controller.confirm()));
  cancel.addEventListener("click", () => action(() => controller.cancel()));

  async function init() {
    try {
      await apiRequest("/api/profile");
      const status = await apiRequest("/api/assistant/realtime/status");
      available = Boolean(status.available && typeof window.ChickyRealtime === "function");
      if (!available) {
        setState("disconnected");
        byId("shift-state").textContent = "Live voice unavailable";
        note("Live voice isn’t set up on this server. You can still record sales with the regular assistant on Dashboard.");
        return;
      }
      controller = new window.ChickyRealtime();
      controller.addEventListener("status", event => setState(event.detail?.state));
      controller.addEventListener("transcript", event => transcript(event.detail));
      controller.addEventListener("proposal", event => proposal(event.detail));
      controller.addEventListener("saved", event => saved(event.detail));
      controller.addEventListener("prep", event => renderPrep(event.detail));
      controller.addEventListener("error", event => note(event.detail?.message || "Voice connection interrupted. End the conversation and try again.", true));
      setState("disconnected");
      note("Start once, then speak naturally. Nothing saves until you confirm.");
    } catch (error) {
      if (error.status === 401) { location.href = "index.html"; return; }
      available = false;
      setState("error");
      note(error.message || "Couldn’t load your account or voice connection. Reload to try again.", true);
    }
  }
  init();
})();
