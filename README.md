# GlanceBook G2

**Zero-Custody Live Crypto Perps, Prediction Odds & Cross-Exchange Basis HUD for Even Realities G2 Smart Glasses**

- **Hackathon Tracks:** Track 02 (*Crypto & DeFi*) & Track 03 (*Exchanges*)
- **Live Browser Lens Demo:** https://lexuantamle8-tech.github.io/glancebook-g2/
- **Package ID:** `com.lexuantamle.glancebookg2` (`.ehpk` included)
- **Security Posture:** Strictly **read-only**, zero wallet keys, zero private API keys, zero order signing, zero custody.

---

## 1. The Problem

Active DeFi and perpetual-futures traders constantly lose situational awareness when away from multi-monitor desks:
- Pulling out a phone every 5 minutes during funding spikes, Polymarket macro catalysts, or perp-vs-spot basis blowouts breaks focus and creates social friction.
- Desktop terminals pack dozens of noisy widgets that are unreadable on a `576×288` monochrome-green smart-glasses display.
- Connecting exchange trade keys to experimental wearable apps creates unacceptable custody risk.

## 2. The Solution — GlanceBook G2

**GlanceBook G2** condenses three high-signal public market feeds into a glanceable, high-contrast `576×288` monochrome HUD built directly on `@evenrealities/even_hub_sdk` (`v0.0.10`):

1. **`PERPS` View (Hyperliquid `/info` `metaAndAssetCtxs`):**
   - Live Mark Price, 24h %, annualized Funding APR (`!` alert flag when `|APR| >= 25%`), and Open Interest across `BTC`, `ETH`, `SOL`, `HYPE`, `ARB`, `DOGE`.
2. **`POLYMARKET` View (Polymarket Gamma API):**
   - Top live high-volume prediction markets ranked by 24h volume with compact `YES %` probabilities.
3. **`BASIS` View (Hyperliquid Perp vs. Binance Spot):**
   - Live cross-venue basis spread in basis points (`bp`), tiered risk tags (`CALM` / `WATCH` / `ALERT`), and a read-only `$10,000` Paper Guard risk banner.

### Hands-Free G2 Interaction Model
- **Single Tap (`CLICK_EVENT`):** Cycle between `PERPS` -> `POLYMARKET` -> `BASIS`.
- **Scroll (`SCROLL_TOP_EVENT` / `SCROLL_BOTTOM_EVENT`):** Pan through watchlist rows inside the active view.
- **Double Tap (`DOUBLE_CLICK_EVENT`):** Cleanly close via `bridge.shutDownPageContainer(1)`.
- **Auto-Refresh:** Background polling every 20 seconds with automatic fallback snapshot if offline/rate-limited.

---

## 3. Architecture & Even Hub SDK Integration

- **Canvas Layout (`576×288`, 3 containers):**
  - `header` (`id=1`, `576×42`, bordered): Active view tag, `LIVE`/`SIM` source indicator, UTC timestamp.
  - `body` (`id=2`, `576×200`, `isEventCapture=1`): Fixed-width ASCII table (max 44 chars/line) tuned for G2 micro-OLED legibility.
  - `footer` (`id=3`, `576×42`, bordered): Persistent gesture hints.
- **Network Whitelist (`app.json`):**
  - `api.hyperliquid.xyz`
  - `gamma-api.polymarket.com`
  - `api.binance.com`
- **Dual-Mode Execution:** Automatically binds to `waitForEvenAppBridge()` inside Even Hub / Even Hub Simulator, and gracefully falls back to a built-in `576×288` Browser Lens Emulator for instant desktop/judge review.

---

## 4. Quick Start & Packaging

```bash
npm install
npm run dev        # Launch local Browser Lens Emulator (http://localhost:5173)
npm run build      # Type-check (tsc --noEmit) and bundle to dist/
npm run pack       # Package dist/ + app.json into Even Hub .ehpk archive
npm run simulate   # Preview inside evenhub-simulator
```

---

## 5. Even Hub SDK Feedback & Feature Requests (Developer Notes)

During development on `@evenrealities/even_hub_sdk@0.0.10`, five platform additions would unlock even stronger real-time finance HUDs:
1. **Native WebSocket permission scope in `app.json`** for sub-second orderbook/ticker streams without 20s HTTP polling overhead.
2. **Container-level partial line diffing** (`updateLine`) to lower BLE bandwidth when only 1 price row changes.
3. **Configurable haptic/visual pulse alert primitive** when funding APR or basis exceeds a user-defined threshold.
4. **Built-in monochrome sparkline / 1-bit mini-chart container** (`height: 32px`) for 1h price trajectories without custom BMP encoding.
5. **Headless simulator screenshot CLI flag** (`evenhub-simulator --screenshot`) for automated visual regression testing in CI.
