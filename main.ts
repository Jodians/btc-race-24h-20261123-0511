// BTC Race Bot: Golden cross entry + trailing stop.
// Strategy:
// - EMA(12) / EMA(26) golden cross for entry (buy once)
// - Trailing stop: sell if price drops 5% from peak after entry
// - Hard stop-loss: -10% from entry
// - Position: 100% equity
// - Max slippage: 100 bps
// Different from ema-cross baseline which trades both cross directions.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const FAST_EMA = 12;
const SLOW_EMA = 26;
const TRAILING_STOP_PCT = 0.05;  // 5% trailing stop
const HARD_STOP_PCT = 0.10;      // 10% hard stop from entry
const POSITION_SIZE_BPS = 10000; // 100%
const MAX_SLIPPAGE_BPS = 100;

interface Series {
    emaFast: EMA;
    emaSlow: EMA;
    prevFast: number | null;
    prevSlow: number | null;
    entryPrice: number | null;
    peakPrice: number | null;
    hasTraded: boolean;
}

class EMA {
    span: number;
    alpha: number;
    value: number | null;
    warmup: number[];

    constructor(span: number) {
        this.span = span;
        this.alpha = 2.0 / (span + 1);
        this.value = null;
        this.warmup = [];
    }

    update(close: number): number | null {
        if (this.value === null) {
            this.warmup.push(close);
            if (this.warmup.length >= this.span) {
                this.value = this.warmup.reduce((a, x) => a + x, 0) / this.span;
            }
            return null;
        }
        this.value = this.alpha * close + (1 - this.alpha) * this.value;
        return this.value;
    }
}

const series = new Map<string, Series>();

function getSeries(symbol: string): Series {
    let s = series.get(symbol);
    if (s === undefined) {
        s = {
            emaFast: new EMA(FAST_EMA),
            emaSlow: new EMA(SLOW_EMA),
            prevFast: null,
            prevSlow: null,
            entryPrice: null,
            peakPrice: null,
            hasTraded: false,
        };
        series.set(symbol, s);
    }
    return s;
}

await runBars({
    onBatch(state: BarsState, batch) {
        const orders: (BuyInput | SellInput)[] = [];

        for (const bar of batch.bars) {
            if (bar.symbol !== "CBBTC") continue;

            const s = getSeries(bar.symbol);
            const close = Number(bar.c);

            const fast = s.emaFast.update(close);
            const slow = s.emaSlow.update(close);

            if (fast === null || slow === null) continue;

            const crossUp = s.prevFast !== null && s.prevSlow !== null &&
                s.prevFast <= s.prevSlow && fast > slow;

            s.prevFast = fast;
            s.prevSlow = slow;

            if (state.warmingUp) continue;

            const held = state.positions.get("CBBTC");

            if (held !== undefined && held.qty > 0n) {
                // Update peak
                if (s.peakPrice === null || close > s.peakPrice) {
                    s.peakPrice = close;
                }

                let shouldSell = false;

                // Hard stop-loss from entry
                if (s.entryPrice !== null) {
                    const pnlPct = (close - s.entryPrice) / s.entryPrice;
                    if (pnlPct <= -HARD_STOP_PCT) {
                        shouldSell = true;
                    }
                }

                // Trailing stop from peak
                if (!shouldSell && s.peakPrice !== null) {
                    const drawdown = (s.peakPrice - close) / s.peakPrice;
                    if (drawdown >= TRAILING_STOP_PCT) {
                        shouldSell = true;
                    }
                }

                if (shouldSell) {
                    orders.push({
                        side: "sell",
                        symbol: "CBBTC",
                        qty: held.qty,
                        max_slippage_bps: MAX_SLIPPAGE_BPS,
                    });
                    s.entryPrice = null;
                    s.peakPrice = null;
                }
            }
            // Entry: only on FIRST golden cross
            else if (!s.hasTraded && crossUp) {
                const maxSpend = (state.equity * BigInt(POSITION_SIZE_BPS)) / BPS;
                const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
                const spend = maxSpend < byWeight ? maxSpend : byWeight;
                const finalSpend = spend < state.cash ? spend : state.cash;

                if (finalSpend >= BigInt(state.hello.fees.min_notional_quote_units) && finalSpend > 0n) {
                    orders.push({
                        side: "buy",
                        symbol: "CBBTC",
                        notional_quote_units: finalSpend,
                        max_slippage_bps: MAX_SLIPPAGE_BPS,
                    });
                    s.entryPrice = close;
                    s.peakPrice = close;
                    s.hasTraded = true;
                }
            }
        }

        return orders.slice(0, state.hello.caps.max_orders_per_bar);
    },
});
