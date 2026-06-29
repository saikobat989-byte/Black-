const { spawn } = require("child_process");
const log = require("./logger/log.js");

let restartCount = 0;
let lastRestartTime = 0;
let spawnTime = 0;
let consecutiveLoginFails = 0;

const BASE_RESTART_DELAY = 5000;
const MAX_RESTART_DELAY = 120000;
const LOGIN_FAIL_THRESHOLD_MS = 90000;
const LOGIN_FAIL_BACKOFF_BASE = 15 * 60 * 1000;
const LOGIN_FAIL_BACKOFF_MAX  = 35 * 60 * 1000;

function getRestartDelay(isLoginFail) {
  const now = Date.now();
  if (now - lastRestartTime > 10 * 60 * 1000) {
    restartCount = 0;
  }

  if (isLoginFail) {
    consecutiveLoginFails++;
    const jitter = Math.floor(Math.random() * 2 * 60 * 1000);
    const delay = Math.min(
      LOGIN_FAIL_BACKOFF_MAX,
      LOGIN_FAIL_BACKOFF_BASE * Math.min(consecutiveLoginFails, 3)
    ) + jitter;
    return delay;
  }

  consecutiveLoginFails = 0;
  restartCount++;
  return Math.min(MAX_RESTART_DELAY, BASE_RESTART_DELAY * Math.pow(2, Math.max(0, restartCount - 3)));
}

function startProject() {
  lastRestartTime = Date.now();
  spawnTime = Date.now();

  const child = spawn("node", ["--max-old-space-size=512", "--expose-gc", "Black.js"], {
    cwd: __dirname,
    stdio: "inherit",
    shell: false,
    env: { ...process.env }
  });

  child.on("close", (code, signal) => {
    const uptime = Date.now() - spawnTime;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    const isRequested = (code == 2);

    const isLoginFail = !isRequested && uptime < LOGIN_FAIL_THRESHOLD_MS;

    if (isLoginFail) {
      const delay = getRestartDelay(true);
      const mins = Math.round(delay / 60000);
      log.warn(`[SESSION] Login failed fast (${Math.round(uptime/1000)}s uptime). Facebook may have blocked this IP.`);
      log.warn(`[SESSION] Waiting ${mins} min before retry (attempt #${consecutiveLoginFails})…`);
      log.warn(`[SESSION] While waiting: refresh account.txt cookies for faster recovery.`);
      setTimeout(() => startProject(), delay);
      return;
    }

    log.info(`Bot process ended (${reason}).${isRequested ? ' Requested restart.' : ' Unexpected exit.'}`);
    const delay = getRestartDelay(false);
    log.info(`Restarting in ${Math.round(delay / 1000)}s (restart #${restartCount})…`);
    setTimeout(() => startProject(), delay);
  });

  child.on("error", (err) => {
    log.info(`Failed to start bot process: ${err.message}. Retrying in 5s…`);
    setTimeout(() => startProject(), 5000);
  });
}

startProject();

setInterval(() => {
  if (typeof global.gc === "function") {
    try { global.gc(); } catch (_) {}
  }
  const used = process.memoryUsage();
  const mbHeap = Math.round(used.heapUsed / 1024 / 1024);
  if (mbHeap > 450) {
    console.log(`[MEM] Heap ${mbHeap}MB — high usage, triggering GC`);
    if (typeof global.gc === "function") try { global.gc(); } catch (_) {}
  }
}, 60000);

const express = require('express');
const app = express();

app.get('/', (req, res) => {
  const fail = consecutiveLoginFails;
  if (fail > 0) {
    res.status(503).send(`Bot is in session recovery mode (${fail} failed attempt${fail > 1 ? 's' : ''}). Refresh your account.txt cookies.`);
  } else {
    res.send('Bot is running!');
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Uptime server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 3000 already in use, skipping express server start.');
  } else {
    throw err;
  }
});
