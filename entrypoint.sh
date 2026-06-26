#!/bin/sh
node -e '
var fs = require("fs");
var path = require("path");
var cwd = process.cwd();

// ── Write account.txt from APPSTATE env var ──────────────────────────────────
var appstate = process.env.APPSTATE;
var accountPath = path.join(cwd, "account.txt");
if (appstate) {
  fs.writeFileSync(accountPath, appstate);
  console.log("✅ account.txt written from APPSTATE env var");
} else if (!fs.existsSync(accountPath)) {
  console.error("❌ ERROR: APPSTATE env var is not set and account.txt not found!");
  console.error("   Please set the APPSTATE variable in your Railway environment.");
  process.exit(1);
} else {
  console.log("✅ account.txt already exists — using it as-is");
}

// ── Inject Facebook credentials into config.json ─────────────────────────────
var configPath = path.join(cwd, "config.json");
try {
  var config = JSON.parse(fs.readFileSync(configPath, "utf8"));

  if (process.env.FB_EMAIL)    config.facebookAccount.email    = process.env.FB_EMAIL;
  if (process.env.FB_PASSWORD) config.facebookAccount.password = process.env.FB_PASSWORD;
  if (process.env.FB_2FA)      config.facebookAccount["2FASecret"] = process.env.FB_2FA;
  if (process.env.FB_ADMIN_ID) config.adminBot = [process.env.FB_ADMIN_ID];
  if (process.env.GROQ_API_KEY)   config.apiKeys.groq     = process.env.GROQ_API_KEY;
  if (process.env.GEMINI_API_KEY) config.GEMINI_API_KEY   = process.env.GEMINI_API_KEY;
  if (process.env.MONGODB_URI)    config.database.uriMongodb = process.env.MONGODB_URI;
  if (process.env.DB_TYPE)        config.database.type     = process.env.DB_TYPE;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log("✅ config.json updated from environment variables");
} catch (e) {
  console.warn("⚠️  Could not patch config.json:", e.message);
}

// ── Write fca-config.json from env vars ──────────────────────────────────────
var fcaPath = path.join(cwd, "fca-config.json");
if (!fs.existsSync(fcaPath)) {
  var fcaConfig = {
    autoUpdate: true,
    autoLogin: true,
    mqtt: { enabled: true, reconnectInterval: 3600 },
    credentials: {
      email:       process.env.FB_EMAIL    || "",
      password:    process.env.FB_PASSWORD || "",
      twofactor:   process.env.FB_2FA      || ""
    }
  };
  fs.writeFileSync(fcaPath, JSON.stringify(fcaConfig, null, 2));
  console.log("✅ fca-config.json created from environment variables");
} else {
  console.log("✅ fca-config.json already exists");
}
'

exec node index.js
