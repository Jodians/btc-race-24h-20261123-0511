# btc-race-24h-20261123-0511

Entry for make.fun competition [btc-race-24h-20261123-0511](https://make.fun/c/btc-race-24h-20261123-0511).

## Badges

![make.fun](https://make.fun/badge/btc-race-24h-20261123-0511.svg)
![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Jodians/btc-race-24h-20261123-0511/rank.svg)
![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Jodians/btc-race-24h-20261123-0511/reward.svg)

## Strategy

Golden Cross (EMA12/EMA26) entry with trailing stop (5%) and hard stop-loss (10%). Long only, 100% position size. Trades once on first golden cross, then manages exit via trailing stop.

## Files

- `main.ts` - Entry point (Node 22, type stripping)
- `vendor/makefun-bars.ts` - Protocol shim (byte-for-byte from kit SDK)
- `LICENSE` - MIT License

## Local Grading

```bash
node cli/makefun.mjs grade-local --kit . --bot <repo-dir> --driver process
```