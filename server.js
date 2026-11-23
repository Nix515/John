const express = require("express");
const TradingEngine = require("./trading-engine");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.TWELVE_DATA_API_KEY;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 30_000);
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS || 60_000);

if (!API_KEY) {
  console.error("TWELVE_DATA_API_KEY is required.");
  process.exit(1);
}

const TWELVE_DATA_URL =
  `https://api.twelvedata.com/time_series?apikey=${encodeURIComponent(API_KEY)}&interval=1min&symbol=XAU/USD`;

const engine = new TradingEngine({ positionSize: 0.01 });
let cache = null;
let cacheExpiresAt = 0;
let lastFetchError = null;

async function fetchTwelveData() {
  if (cache && Date.now() < cacheExpiresAt) return cache;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response;
  try {
    response = await fetch(TWELVE_DATA_URL, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Twelve Data returned HTTP ${response.status}`);

  const payload = await response.json();
  if (payload.status === "error" || payload.code) {
    throw new Error(payload.message || "Twelve Data request failed");
  }
  if (!Array.isArray(payload.values)) {
    throw new Error("Twelve Data returned no time-series values");
  }

  const candles = payload.values
    .map((value) => {
      const open = Number(value.open);
      const high = Number(value.high);
      const low = Number(value.low);
      const close = Number(value.close);
      if (![open, high, low, close].every(Number.isFinite)) return null;
      return { datetime: value.datetime, open, high, low, close };
    })
    .filter(Boolean);

  const trading = engine.processCandles(candles);
  const latest = [...candles].sort((a, b) => new Date(b.datetime) - new Date(a.datetime))[0];
  cache = {
    symbol: "XAU/USD",
    interval: "1min",
    currency: "USD",
    meta: payload.meta || null,
    candles,
    latest,
    trading,
    serverTime: new Date().toISOString(),
    tradingDate: latest ? latest.datetime.slice(0, 10) : new Date().toISOString().slice(0, 10)
  };
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
  lastFetchError = null;
  return cache;
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "32kb" }));
app.use("/api", (_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
app.use(express.static(__dirname, {
  extensions: ["html"],
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("/api/xau", async (_request, response) => {
  try {
    const data = await fetchTwelveData();
    response.json(data);
  } catch (error) {
    lastFetchError = error.message;
    if (cache) return response.json({ ...cache, stale: true, error: lastFetchError });
    response.status(502).json({ error: "Unable to fetch XAU/USD data", details: lastFetchError });
  }
});

app.get("/api/xau/candles", async (_request, response) => {
  try {
    const data = await fetchTwelveData();
    response.json({ symbol: data.symbol, candles: data.candles, latest: data.latest });
  } catch (error) {
    response.status(502).json({ error: "Unable to fetch candles", details: error.message });
  }
});

app.get("/api/trading/log", async (_request, response) => {
  try {
    await fetchTwelveData();
  } catch (_error) {
    // The in-memory trading snapshot remains available even if a refresh fails.
  }
  response.json(engine.snapshot());
});

app.get("/api/health", (_request, response) => {
  response.json({
    status: "ok",
    environment: process.env.NODE_ENV || "development",
    cacheAgeSeconds: cache ? Math.max(0, Math.round((cacheExpiresAt - Date.now()) / 1000)) : 0,
    lastFetchError
  });
});

const pollTimer = setInterval(async () => {
  try {
    await fetchTwelveData();
  } catch (error) {
    lastFetchError = error.message;
  }
}, POLL_INTERVAL_MS);
pollTimer.unref();

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`XAU/USD server listening on http://localhost:${PORT}`);
  fetchTwelveData().catch((error) => {
    lastFetchError = error.message;
  });
});

function shutdown(signal) {
  console.log(`${signal} received; closing server.`);
  clearInterval(pollTimer);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
