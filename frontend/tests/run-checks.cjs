// Runs the mocked browser checks against an isolated local frontend. No backend is needed.
const { spawn } = require("node:child_process");
const path = require("node:path");
const { once } = require("node:events");

(async () => {
  const port = process.env.FRONTEND_TEST_PORT || "5517";
  const base = `http://127.0.0.1:${port}`;
  const root = path.resolve(__dirname, "../..");
  const server = spawn(process.execPath, ["frontend/server.mjs"], {
    cwd: root, env: { ...process.env, FRONTEND_PORT: port }, stdio: ["ignore", "pipe", "inherit"]
  });
  let serverError;
  let listening = false;
  let serverOutput = "";
  server.stdout.on("data", chunk => {
    process.stdout.write(chunk);
    serverOutput += chunk;
    // Only trust a server that we started, rather than an existing process on this port.
    listening = serverOutput.includes("Chicky frontend:");
  });
  server.on("error", error => { serverError = error; });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      if (serverError) throw serverError;
      if (server.exitCode !== null) throw new Error("Frontend server exited before the checks started");
      try {
        const response = listening && await fetch(`${base}/index.html`, { signal: AbortSignal.timeout(1000) });
        if (response && response.ok) { ready = true; break; }
      } catch { /* Wait for the server to listen. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw new Error("Frontend server did not start within five seconds");
    for (const script of ["realtime-controller-check.cjs", "phone-check.cjs", "session-settings-check.cjs", "close-shift-check.cjs"]) {
      const check = spawn(process.execPath, [path.join(__dirname, script)], {
        cwd: root, env: { ...process.env, BASE: base }, stdio: "inherit"
      });
      const [code, signal] = await once(check, "exit");
      if (code !== 0) throw new Error(`${script} failed (${signal || code})`);
    }
  } finally {
    if (server.exitCode === null) {
      server.kill();
      await once(server, "exit");
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
