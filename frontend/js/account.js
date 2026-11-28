// Account page: who is signed in, linking Google sign-in, and linking chat apps such as Telegram (issue #99). Needs
// js/api.js; the QR code needs qrcode-generator, and the page works without it.

const chatList = document.getElementById("chat-list");
const chatStatus = document.getElementById("chat-status");
const time = new Intl.DateTimeFormat("en-SG", { hour: "numeric", minute: "2-digit" });
const day = new Intl.DateTimeFormat("en-SG", { day: "numeric", month: "short", year: "numeric" });
// Reminder times the backend accepts: on the hour from 12 pm to 11 pm, when its hourly job runs (#101).
const REMINDER_HOURS = Array.from({ length: 12 }, (_, index) => index + 12);
const DEFAULT_REMINDER = "21:00";
// While a code is showing, check every few seconds whether the phone has used it.
const POLL_MS = 3000;
let polling = null;

function showStatus(message, type) {
  chatStatus.textContent = message;
  chatStatus.className = `status-text${type ? ` is-${type}` : ""}`;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function loadProfile() {
  try {
    const profile = await apiRequest("/api/profile");
    document.getElementById("details-name").textContent = profile.name || "Stall owner";
    document.getElementById("details-email").textContent = profile.email || "";
    showGoogleLink(profile);
  } catch (error) {
    if (error.status === 401) window.location.href = "index.html";
  }
}

// Google sign-in for an account made with email and password. Signing in with Google alone is refused
// for such an account (ACCOUNT_LINKING_REQUIRED); linking it here, while signed in, allows it.
const googleLink = document.getElementById("google-link");
const googleLinkState = document.getElementById("google-link-state");
const googleLinkButton = document.getElementById("google-link-button");
const googleLinkStatus = document.getElementById("google-link-status");
let googleScript = null;

function showGoogleLinkStatus(message, type) {
  googleLinkStatus.textContent = message;
  googleLinkStatus.className = `status-text${type ? ` is-${type}` : ""}`;
}

let profileForGoogle = {};

async function showGoogleLink(profile) {
  profileForGoogle = profile;
  if (profile.googleLinked) {
    googleLinkButton.replaceChildren();
    if (profile.hasPassword) {
      googleLinkState.textContent = "Linked. You can sign in with Google or with your email and password.";
      const disconnect = element("button", "secondary-button", "Disconnect");
      disconnect.type = "button";
      disconnect.addEventListener("click", () => unlinkGoogle(profile, disconnect));
      googleLinkButton.append(disconnect);
    } else {
      // Disconnecting would leave no way to sign in (the backend refuses it too).
      googleLinkState.textContent = "Linked. Google is how you sign in. To disconnect it, first set a password: "
        + "sign out, then use “Forgot password” on the sign-in page.";
    }
    googleLink.hidden = false;
    return;
  }
  let clientId = "";
  try {
    clientId = ((await apiRequest("/api/config")).googleClientId || "").trim();
  } catch (error) {
    // Without the config there's no button to show.
  }
  // Google sign-in is off on this server: nothing to link.
  if (!clientId) return;

  googleLinkState.textContent = `Not linked. Link the Google account for ${profile.email} to sign in with Google too.`;
  googleLink.hidden = false;
  googleScript ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  try {
    await googleScript;
  } catch (error) {
    showGoogleLinkStatus("Google sign-in could not be loaded. Reload the page to try again.", "error");
    return;
  }
  google.accounts.id.initialize({ client_id: clientId, callback: linkGoogle });
  googleLinkButton.replaceChildren();
  google.accounts.id.renderButton(googleLinkButton, {
    type: "standard",
    theme: "outline",
    size: "large",
    shape: "rectangular",
    text: "continue_with"
  });
}

async function unlinkGoogle(profile, button) {
  if (!window.confirm("Disconnect Google? You’ll sign in with your email and password only.")) return;
  button.disabled = true;
  showGoogleLinkStatus("");
  try {
    await apiRequest("/api/account/google-link", { method: "DELETE" });
    await showGoogleLink({ ...profile, googleLinked: false });
    showGoogleLinkStatus("Google is disconnected. Sign in with your email and password.", "success");
  } catch (error) {
    if (error.status === 401) { window.location.href = "index.html"; return; }
    button.disabled = false;
    showGoogleLinkStatus(error.message || "Couldn’t disconnect Google. Try again.", "error");
  }
}

async function linkGoogle({ credential }) {
  showGoogleLinkStatus("Linking Google…");
  try {
    await apiRequest("/api/account/google-link", { method: "POST", body: JSON.stringify({ credential }) });
    showGoogleLinkStatus("Google is linked. Next time, you can sign in with Google.", "success");
    // Linking needs a signed-in account with a password (a Google-only account is linked already).
    showGoogleLink({ ...profileForGoogle, googleLinked: true, hasPassword: true });
  } catch (error) {
    if (error.status === 401 && error.code === "AUTHENTICATION_REQUIRED") { window.location.href = "index.html"; return; }
    showGoogleLinkStatus(error.message || "Couldn’t link Google. Try again.", "error");
  }
}

async function loadChats() {
  try {
    renderChats((await apiRequest("/api/chat-links")).channels);
  } catch (error) {
    if (error.status === 401) window.location.href = "index.html";
    else showStatus("Chat apps could not be loaded.", "error");
  }
}

function renderChats(channels) {
  chatList.replaceChildren();
  if (!channels.length) {
    // Plain text, not Chicky's state: this card is Uncle's (the chat bot speaks as him), and Chicky and Uncle appear
    // together only to welcome people (#3).
    chatList.append(element("li", "empty-state", "No chat apps are set up on this server yet."));
    return;
  }
  channels.forEach(channel => chatList.append(chatRow(channel)));
}

function chatRow(channel) {
  const row = element("li", "chat-app");
  const text = element("div", "chat-app-text");
  text.append(element("p", "chat-app-name", channel.label));
  const linked = channel.linked;
  text.append(element("p", "muted-text", linked
    ? `Linked${linked.displayName ? ` to ${linked.displayName}` : ""} since ${day.format(new Date(linked.linkedAt))}`
    : "Not linked"));

  const button = element("button", linked ? "secondary-button" : "primary-button", linked ? "Disconnect" : "Connect");
  button.type = "button";
  const connect = element("div", "chat-connect");
  connect.hidden = true;
  button.addEventListener("click", () => linked ? disconnect(channel, button) : startLink(channel, button, connect));

  row.append(text, button, connect);
  if (linked) row.append(reminderControls(linked));
  return row;
}

// The evening messages a linked chat can get (#101): each on or off, at an hour.
function reminderControls(linked) {
  const box = element("div", "chat-reminders");
  box.append(element("p", "chat-reminders-title", "Evening messages"));
  const sales = reminderRow("Remind me to send the day’s sales", "sales reminder", linked.salesReminderAt);
  const prep = reminderRow("Send tomorrow’s prep list", "prep list", linked.prepListAt);
  box.append(sales.row, prep.row,
    element("p", "muted-text", "The reminder isn’t sent once your sales are in, or when the stall is closed."));

  const save = async () => {
    showStatus("");
    try {
      await apiRequest(`/api/chat-links/${linked.id}/reminders`, {
        method: "PUT",
        body: JSON.stringify({ salesReminderAt: sales.value(), prepListAt: prep.value() })
      });
      showStatus("Saved.", "success");
    } catch (error) {
      showStatus(error.message || "Couldn’t save. Try again.", "error");
      loadChats();
    }
  };
  sales.onChange(save);
  prep.onChange(save);
  return box;
}

function reminderRow(label, name, at) {
  const row = element("div", "chat-reminder");
  const toggle = element("label", "chat-reminder-toggle");
  const checkbox = element("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(at);
  toggle.append(checkbox, ` ${label}`);

  const wrap = element("div", "select-wrap");
  const select = element("select", "input");
  select.setAttribute("aria-label", `Time for the ${name}`);
  REMINDER_HOURS.forEach(hour => {
    const option = element("option", null, `${hour % 12 || 12} pm`);
    option.value = `${hour}:00`;
    select.append(option);
  });
  select.value = at || DEFAULT_REMINDER;
  select.disabled = !at;
  wrap.append(select);
  checkbox.addEventListener("change", () => { select.disabled = !checkbox.checked; });
  row.append(toggle, wrap);

  return {
    row,
    value: () => (checkbox.checked ? select.value : null),
    onChange: handler => {
      checkbox.addEventListener("change", handler);
      select.addEventListener("change", handler);
    }
  };
}

async function startLink(channel, button, connect) {
  button.disabled = true;
  showStatus("");
  try {
    const code = await apiRequest(`/api/chat-links/${channel.channel.toLowerCase()}`, { method: "POST" });
    showCode(channel, code, connect);
    button.hidden = true;
    waitForLink(channel.channel, new Date(code.expiresAt));
  } catch (error) {
    button.disabled = false;
    showStatus(error.message || `Couldn’t connect ${channel.label}. Try again.`, "error");
  }
}

// The link opens the chat app with the code. On a computer, a QR code lets the phone open it.
function showCode(channel, code, connect) {
  const open = element("a", "primary-button", `Open ${channel.label}`);
  open.href = code.link;
  open.target = "_blank";
  open.rel = "noopener";
  const start = channel.channel === "TELEGRAM" ? "tap Start" : "send the message it opens with";
  // css/account.css hides the QR code at this width.
  const onPhone = window.matchMedia("(max-width: 760px)").matches;
  const help = element("p", "muted-text", (onPhone
    ? `Tap Open ${channel.label}, then ${start}.`
    : `On your phone, scan the code (or open the link), then ${start}.`)
    + ` It works until ${time.format(new Date(code.expiresAt))}.`);
  connect.replaceChildren(open, help);

  if (window.qrcode) {
    const qr = window.qrcode(0, "M");
    qr.addData(code.link);
    qr.make();
    const picture = element("div", "chat-qr");
    picture.setAttribute("role", "img");
    picture.setAttribute("aria-label", `QR code that opens ${channel.label}`);
    picture.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    connect.append(picture);
  }
  connect.hidden = false;
}

function waitForLink(channelName, expiresAt) {
  clearInterval(polling);
  polling = setInterval(async () => {
    if (new Date() > expiresAt) {
      clearInterval(polling);
      showStatus("The code has expired. Tap Connect for a new one.");
      loadChats();
      return;
    }
    try {
      const { channels } = await apiRequest("/api/chat-links");
      const channel = channels.find(candidate => candidate.channel === channelName);
      if (channel?.linked) {
        clearInterval(polling);
        renderChats(channels);
        showStatus(`${channel.label} is linked. Send it your sales any time.`, "success");
      }
    } catch (error) {
      // Try again on the next tick.
    }
  }, POLL_MS);
}

async function disconnect(channel, button) {
  if (!window.confirm(`Disconnect ${channel.label}? That chat won’t be able to record sales any more.`)) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/chat-links/${channel.linked.id}`, { method: "DELETE" });
    showStatus(`${channel.label} is disconnected.`, "success");
    loadChats();
  } catch (error) {
    button.disabled = false;
    showStatus(error.message || "Couldn’t disconnect. Try again.", "error");
  }
}

loadProfile();
loadChats();

const sessionForm = document.getElementById("session-settings-form");
const idleInput = document.getElementById("session-idle");
const absoluteInput = document.getElementById("session-absolute");
const sessionSave = document.getElementById("session-save");
const sessionDefaults = document.getElementById("session-defaults");
const sessionStatus = document.getElementById("session-status");
let savedSessionSettings = null;
let savingSessionSettings = false;

function sessionValues() {
  return { idleMinutes: Number(idleInput.value), absoluteMinutes: Number(absoluteInput.value) * 60 };
}

function updateSessionForm() {
  const values = sessionValues();
  idleInput.setCustomValidity(values.idleMinutes > values.absoluteMinutes
    ? "Inactivity must not exceed the maximum sign-in duration." : "");
  sessionSave.disabled = savingSessionSettings || !savedSessionSettings || !sessionForm.checkValidity()
    || (values.idleMinutes === savedSessionSettings.idleMinutes
      && values.absoluteMinutes === savedSessionSettings.absoluteMinutes);
}

sessionForm.addEventListener("input", updateSessionForm);
sessionDefaults.addEventListener("click", () => {
  idleInput.value = 60;
  absoluteInput.value = 8;
  updateSessionForm();
});

sessionForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (sessionSave.disabled || !sessionForm.reportValidity()) return;
  const values = sessionValues();
  savingSessionSettings = true;
  idleInput.disabled = absoluteInput.disabled = sessionDefaults.disabled = true;
  updateSessionForm();
  sessionStatus.className = "status-text";
  sessionStatus.textContent = "Saving…";
  try {
    savedSessionSettings = await apiRequest("/api/account/session-settings", {
      method: "PUT", body: JSON.stringify(values)
    });
    sessionStatus.className = "status-text is-success";
    sessionStatus.textContent = "Saved. These durations apply next time you sign in.";
  } catch (error) {
    if (error.status === 401) { window.location.href = "index.html"; return; }
    sessionStatus.className = "status-text is-error";
    sessionStatus.textContent = error.message || "Couldn’t save settings. Try again.";
  } finally {
    savingSessionSettings = false;
    idleInput.disabled = absoluteInput.disabled = sessionDefaults.disabled = false;
    updateSessionForm();
  }
});

async function loadSessionSettings() {
  try {
    savedSessionSettings = await apiRequest("/api/account/session-settings");
    idleInput.value = savedSessionSettings.idleMinutes;
    absoluteInput.value = savedSessionSettings.absoluteMinutes / 60;
    idleInput.disabled = absoluteInput.disabled = sessionDefaults.disabled = false;
    sessionStatus.textContent = "";
    updateSessionForm();
  } catch (error) {
    if (error.status === 401) { window.location.href = "index.html"; return; }
    sessionStatus.className = "status-text is-error";
    sessionStatus.textContent = "Couldn’t load sign-in settings. Reload the page to try again.";
  }
}
loadSessionSettings();
