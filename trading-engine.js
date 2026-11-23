class TradingEngine {
  constructor({ positionSize = 0.01 } = {}) {
    this.positionSize = positionSize;
    this.orders = [];
    this.deals = [];
    this.history = [];
    this.positions = [];
    this.nextTicket = 100000;
    this.lastProcessedDatetime = null;
  }

  processCandles(candles) {
    const chronological = [...candles].reverse();
    const lastProcessedTime = this.lastProcessedDatetime
      ? new Date(this.lastProcessedDatetime).getTime()
      : null;

    for (let i = 1; i < chronological.length; i += 1) {
      const previous = chronological[i - 1];
      const candle = chronological[i];
      if (!candle.datetime) continue;
      const candleTime = new Date(candle.datetime).getTime();
      if (lastProcessedTime && candleTime <= lastProcessedTime) continue;

      if (candle.close > previous.close) {
        this.openOrReverse(candle, "buy");
      } else if (candle.close < previous.close) {
        this.openOrReverse(candle, "sell");
      }

      this.lastProcessedDatetime = candle.datetime;
    }

    this.markToMarket(chronological.at(-1)?.close);
    return this.snapshot();
  }

  openOrReverse(candle, side) {
    const opposing = this.positions.find((position) => position.side !== side);
    if (opposing) this.closePosition(opposing, candle, "reversal");

    const existing = this.positions.find((position) => position.side === side);
    if (existing) return;

    const ticket = ++this.nextTicket;
    const position = {
      ticket,
      symbol: "XAU/USD",
      side,
      volume: this.positionSize,
      openPrice: candle.close,
      markPrice: candle.close,
      openedAt: candle.datetime,
      profit: 0
    };
    this.positions.push(position);
    this.orders.push({
      ticket,
      symbol: position.symbol,
      side,
      volume: this.positionSize,
      price: candle.close,
      datetime: candle.datetime,
      status: "filled"
    });
    this.history.push({
      type: "order",
      ticket,
      symbol: position.symbol,
      side,
      volume: this.positionSize,
      price: candle.close,
      datetime: candle.datetime
    });
  }

  closePosition(position, candle, reason) {
    const direction = position.side === "buy" ? 1 : -1;
    const profit = (candle.close - position.openPrice) * direction * this.positionSize;
    const deal = {
      ticket: position.ticket,
      symbol: position.symbol,
      side: position.side,
      volume: position.volume,
      openPrice: position.openPrice,
      closePrice: candle.close,
      profit: Number(profit.toFixed(2)),
      datetime: candle.datetime,
      reason
    };
    this.deals.push(deal);
    this.history.push({ type: "deal", ...deal });
    this.positions = this.positions.filter((item) => item.ticket !== position.ticket);
  }

  markToMarket(price) {
    if (!Number.isFinite(price)) return;
    for (const position of this.positions) {
      const direction = position.side === "buy" ? 1 : -1;
      position.markPrice = price;
      position.profit = Number(((price - position.openPrice) * direction * this.positionSize).toFixed(2));
    }
  }

  snapshot() {
    const realizedProfit = this.deals.reduce((sum, deal) => sum + deal.profit, 0);
    const floatingProfit = this.positions.reduce((sum, position) => sum + position.profit, 0);
    return {
      positionSize: this.positionSize,
      positions: this.positions,
      orders: this.orders,
      deals: this.deals,
      history: this.history,
      realizedProfit: Number(realizedProfit.toFixed(2)),
      floatingProfit: Number(floatingProfit.toFixed(2)),
      lastProcessedDatetime: this.lastProcessedDatetime
    };
  }
}

module.exports = TradingEngine;
