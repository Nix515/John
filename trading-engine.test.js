const test = require("node:test");
const assert = require("node:assert/strict");
const TradingEngine = require("./trading-engine");

test("opens uniform buy and reverses to uniform sell", () => {
  const engine = new TradingEngine({ positionSize: 0.01 });
  engine.processCandles([
    { datetime: "2026-11-23 10:03:00", close: 4003 },
    { datetime: "2026-11-23 10:02:00", close: 4002 },
    { datetime: "2026-11-23 10:01:00", close: 4001 }
  ]);
  const initial = engine.snapshot();

  assert.equal(initial.orders[0].side, "buy");
  assert.equal(initial.orders[0].volume, 0.01);

  engine.processCandles([
    { datetime: "2026-11-23 10:04:00", close: 4002 },
    { datetime: "2026-11-23 10:03:00", close: 4003 },
    { datetime: "2026-11-23 10:02:00", close: 4002 },
    { datetime: "2026-11-23 10:01:00", close: 4001 }
  ]);

  const snapshot = engine.snapshot();
  assert.equal(snapshot.positions[0].side, "sell");
  assert.equal(snapshot.positions[0].volume, 0.01);
  assert.equal(snapshot.deals.length, 1);
});
