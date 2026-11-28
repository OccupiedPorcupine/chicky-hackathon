// UI integration checks with a mocked Realtime EventTarget; no microphone/provider needed.
// Start frontend/server.mjs, then: node frontend/tests/close-shift-check.cjs
const { chromium } = require(process.env.PW || "playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs/promises");

const controller = `
window.ChickyRealtime = class extends EventTarget {
  constructor() { super(); window.__voice = this; this.failConfirm = false; }
  emit(type, detail) { this.dispatchEvent(new CustomEvent(type, { detail })); }
  async start() { this.emit('status', {state:'listening'}); }
  async disconnect() { this.emit('status', {state:'disconnected'}); }
  setMuted(value) { this.muted = value; }
  async confirm() {
    if(this.failConfirm) throw new Error('Couldn’t save. Try again.');
    this.emit('saved', {revision:2, proposal:window.__proposal,
      saved:{outcome:'CONFIRMED', saved:window.__proposal.entries}});
  }
  async cancel() { this.emit('proposal', {proposal:null, revision:3}); }
};`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const base = process.env.BASE || "http://127.0.0.1:5500";
  const screenshots = path.resolve(__dirname, "../../backend/target/browser-checks");
  await fs.mkdir(screenshots, { recursive: true });
  try {
    for (const width of [360, 393, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: "reduce" });
      await context.route("**/js/realtime.js", route => route.fulfill({ contentType: "application/javascript", body: controller }));
      await context.route("**/api/**", route => {
        const pathname = new URL(route.request().url()).pathname;
        const body = pathname === "/api/profile" ? { name: "Demo owner", email: "owner@example.test", emailVerified: true }
          : pathname === "/api/assistant/realtime/status" ? { available: true, model: "mock", voice: "mock" }
            : { headerName: "X-CSRF", token: "test" };
        return route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(`${base}/close-shift.html?sample=1`);
      await page.waitForFunction(() => !document.getElementById("shift-start").disabled);
      await page.getByText("Demo stall · sample data").waitFor();
      assert.equal(await page.isVisible("#shift-confirm"), false);
      assert.equal(await page.isVisible("#shift-sales-list li"), false);
      await page.click("#shift-start");
      await page.getByText("Listening", { exact: true }).waitFor();
      await page.evaluate(() => {
        window.__proposal = { id: 10, type: "SALES", entries: [
          { dishId: 1, dishName: "Roasted chicken rice", date: "2026-11-28", quantity: 40 },
          { dishId: 2, dishName: "Char siew rice", date: "2026-11-28", quantity: 30, leftoverQuantity: 5 }
        ] };
        window.__voice.emit("transcript", { role: "user", text: "今天 roast chicken rice 四十份，char siew 三十，剩五份。", final: true, turnId: "turn-1" });
        window.__voice.emit("proposal", { proposal: window.__proposal, revision: 1 });
      });
      await page.getByText("Awaiting confirmation", { exact: true }).waitFor();
      assert.equal(await page.locator("#shift-sales-list li").count(), 2);
      await page.getByText("5 left over", { exact: false }).waitFor();
      assert.equal(await page.isEnabled("#shift-confirm-button"), true);
      // A late older revision cannot erase a corrected card.
      await page.evaluate(() => {
        window.__proposal = { ...window.__proposal, entries: window.__proposal.entries.map(e => e.dishId === 1 ? { ...e, quantity: 42 } : e) };
        window.__voice.emit("proposal", { proposal: window.__proposal, revision: 2 });
        window.__voice.emit("proposal", { proposal: null, revision: 1 });
      });
      await page.getByText("Roasted chicken rice: 40 → 42", { exact: true }).waitFor();
      assert.equal(await page.locator("#shift-sales-list li").first().getByLabel("42 portions").count(), 1);
      await page.evaluate(() => { window.__voice.failConfirm = true; });
      await page.click("#shift-confirm-button");
      await page.getByText("Couldn’t save. Try again.", { exact: true }).waitFor();
      assert.equal(await page.textContent("#shift-sales-state"), "Awaiting confirmation");
      await page.evaluate(() => { window.__voice.failConfirm = false; });
      await page.click("#shift-confirm-button");
      await page.getByText("Saved", { exact: true }).waitFor();
      assert.equal(await page.isVisible("#shift-confirm"), false);
      await page.evaluate(() => window.__voice.emit("prep", { prep: {
        date: "2026-11-29", dishes: [
          { dishId: 1, dish: "Roasted chicken rice", portions: 46, low: 38, high: 52, method: "MODEL" },
          { dishId: 2, dish: "Char siew rice", portions: 28, low: 23, high: 34, method: "BASELINE" }
        ], ingredients: [
          { ingredient: "Chicken", toBuy: 6900, unit: "g", perishable: true },
          { ingredient: "Rice", toBuy: 5920, unit: "g", perishable: false }
        ], skipped: []
      } }));
      await page.getByText("6,900 g", { exact: true }).waitFor();
      assert.equal(await page.locator("#shift-portions-list li").count(), 2);
      await page.getByText("Model forecast · 38–52 likely demand", { exact: true }).waitFor();
      await page.getByText("Past-sales baseline · 23–34 likely demand", { exact: true }).waitFor();
      await page.click("#shift-mute");
      assert.equal(await page.getAttribute("#shift-mute", "aria-pressed"), "true");
      assert.equal(await page.evaluate(() => window.__voice.muted), true);
      assert.equal(await page.evaluate(() => document.scrollingElement.scrollWidth > innerWidth), false);
      const smallButtons = await page.locator(".close-shift button").evaluateAll(buttons => buttons.filter(button => {
        const r = button.getBoundingClientRect(); return r.width && (r.width < 44 || r.height < 44);
      }).map(button => button.id));
      assert.deepEqual(smallButtons, []);
      await page.screenshot({ path: path.join(screenshots, `close-shift-${width}.png`), fullPage: true });
      await page.click("#shift-end");
      assert.equal(await page.isEnabled("#shift-start"), true);
      assert.equal(await page.isDisabled("#shift-end"), true);
      await page.click("#shift-start");
      await page.evaluate(() => window.__voice.emit("proposal", { proposal: window.__proposal, revision: 1 }));
      await page.getByText("Awaiting confirmation", { exact: true }).waitFor();
      assert.equal(await page.isEnabled("#shift-confirm-button"), true, "A new session's revision one must not be discarded");
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`Passed closing-shift UI: ${width}px`);
    }
    // Unconfigured integration is honest and never shows synthetic sales or a sample-data label.
    const context = await browser.newContext();
    await context.route("**/js/realtime.js", route => route.fulfill({ contentType: "application/javascript", body: controller }));
    await context.route("**/api/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify(
      new URL(route.request().url()).pathname === "/api/profile" ? { name: "Owner" } : { available: false }
    ) }));
    const page = await context.newPage();
    await page.goto(`${base}/close-shift.html`);
    await page.getByText("Live voice unavailable", { exact: true }).waitFor();
    assert.equal(await page.isDisabled("#shift-start"), true);
    assert.equal(await page.isVisible("#shift-sample"), false);
    assert.equal(await page.locator("#shift-sales-list li").count(), 0);
    assert.equal(await page.locator(".shift-fallback").getAttribute("href"), "dashboard.html");
    await context.close();
    console.log("Passed closing-shift unavailable integration");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
