// Read-only live market feeds for Even Realities G2 (zero custody, zero API keys).
// Sources: Hyperliquid /info, Polymarket Gamma API, Binance public 24h ticker.

export interface PerpQuote {
  coin: string
  markPx: number
  prevDayPx: number
  change24hPct: number
  fundingAprPct: number
  openInterestUsd: number
}

export interface PolyMarketItem {
  title: string
  yesPct: number
  vol24hUsd: number
}

export interface BasisRow {
  coin: string
  perpPx: number
  spotPx: number
  basisBps: number
  alert: string
}

export interface SnapshotState {
  updatedAt: string
  sourceMode: 'live' | 'fallback'
  perps: PerpQuote[]
  polymarket: PolyMarketItem[]
  basis: BasisRow[]
  paperNotionalUsd: number
  paperRiskStatus: 'LOW' | 'ELEVATED' | 'ALERT'
}

const WATCH_COINS = ['BTC', 'ETH', 'SOL', 'HYPE', 'ARB', 'DOGE']

export async function fetchHyperliquidPerps(): Promise<PerpQuote[]> {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  })
  if (!res.ok) throw new Error(`Hyperliquid HTTP ${res.status}`)
  const data = (await res.json()) as [{ universe: { name: string }[] }, Record<string, string>[]]
  const universe = data[0]?.universe ?? []
  const ctxs = data[1] ?? []
  const byName = new Map<string, PerpQuote>()
  for (let i = 0; i < universe.length && i < ctxs.length; i++) {
    const coin = universe[i].name
    if (!WATCH_COINS.includes(coin)) continue
    const c = ctxs[i]
    const markPx = Number(c.markPx || 0)
    const prevDayPx = Number(c.prevDayPx || markPx || 1)
    const change24hPct = prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0
    const fundingHr = Number(c.funding || 0)
    const fundingAprPct = fundingHr * 24 * 365 * 100
    const openInterestUsd = Number(c.openInterest || 0) * markPx
    byName.set(coin, { coin, markPx, prevDayPx, change24hPct, fundingAprPct, openInterestUsd })
  }
  return WATCH_COINS.map(c => byName.get(c)).filter((x): x is PerpQuote => x !== undefined)
}

export async function fetchPolymarketOdds(): Promise<PolyMarketItem[]> {
  const url = 'https://gamma-api.polymarket.com/events?closed=false&limit=6&order=volume24hr&ascending=false'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Polymarket HTTP ${res.status}`)
  const events = (await res.json()) as Array<{
    title?: string
    volume24hr?: number
    markets?: Array<{ outcomePrices?: string }>
  }>
  const out: PolyMarketItem[] = []
  for (const ev of events) {
    const title = (ev.title || 'Event').trim()
    let yesPct = 50
    const first = ev.markets?.[0]
    if (first?.outcomePrices) {
      try {
        const prices = JSON.parse(first.outcomePrices) as string[]
        if (prices.length > 0 && Number.isFinite(Number(prices[0]))) {
          yesPct = Math.round(Number(prices[0]) * 100)
        }
      } catch {
        // keep default 50
      }
    }
    out.push({ title, yesPct, vol24hUsd: Number(ev.volume24hr || 0) })
  }
  return out.slice(0, 5)
}

export async function fetchBinanceSpot(): Promise<Record<string, number>> {
  const symbols = encodeURIComponent(JSON.stringify(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ARBUSDT', 'DOGEUSDT']))
  const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${symbols}`)
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`)
  const rows = (await res.json()) as Array<{ symbol: string; price: string }>
  const map: Record<string, number> = {}
  for (const r of rows) {
    map[r.symbol.replace('USDT', '')] = Number(r.price)
  }
  return map
}

export function computeBasis(perps: PerpQuote[], spot: Record<string, number>): BasisRow[] {
  const out: BasisRow[] = []
  for (const p of perps) {
    const sp = spot[p.coin]
    if (!sp || sp <= 0) continue
    const basisBps = ((p.markPx - sp) / sp) * 10000
    const alert =
      Math.abs(p.fundingAprPct) >= 30 || Math.abs(basisBps) >= 15
        ? 'ALERT'
        : Math.abs(p.fundingAprPct) >= 15 || Math.abs(basisBps) >= 8
          ? 'WATCH'
          : 'CALM'
    out.push({ coin: p.coin, perpPx: p.markPx, spotPx: sp, basisBps, alert })
  }
  return out
}

export async function loadMarketSnapshot(): Promise<SnapshotState> {
  const now = new Date().toISOString().slice(11, 19) + 'Z'
  try {
    const [perps, polymarket, spot] = await Promise.all([
      fetchHyperliquidPerps(),
      fetchPolymarketOdds().catch(() => FALLBACK_POLY),
      fetchBinanceSpot().catch(() => ({} as Record<string, number>)),
    ])
    const basis = computeBasis(perps, spot)
    const maxFunding = Math.max(0, ...perps.map(p => Math.abs(p.fundingAprPct)))
    const risk: SnapshotState['paperRiskStatus'] =
      maxFunding >= 30 ? 'ALERT' : maxFunding >= 15 ? 'ELEVATED' : 'LOW'
    return {
      updatedAt: now,
      sourceMode: 'live',
      perps: perps.length > 0 ? perps : FALLBACK_PERPS,
      polymarket: polymarket.length > 0 ? polymarket : FALLBACK_POLY,
      basis: basis.length > 0 ? basis : FALLBACK_BASIS,
      paperNotionalUsd: 10000,
      paperRiskStatus: risk,
    }
  } catch {
    return {
      updatedAt: now,
      sourceMode: 'fallback',
      perps: FALLBACK_PERPS,
      polymarket: FALLBACK_POLY,
      basis: FALLBACK_BASIS,
      paperNotionalUsd: 10000,
      paperRiskStatus: 'LOW',
    }
  }
}

const FALLBACK_PERPS: PerpQuote[] = [
  { coin: 'BTC', markPx: 94250, prevDayPx: 92800, change24hPct: 1.56, fundingAprPct: 11.4, openInterestUsd: 1850000000 },
  { coin: 'ETH', markPx: 3410, prevDayPx: 3340, change24hPct: 2.1, fundingAprPct: 14.2, openInterestUsd: 920000000 },
  { coin: 'SOL', markPx: 218.5, prevDayPx: 212.0, change24hPct: 3.07, fundingAprPct: 21.8, openInterestUsd: 480000000 },
  { coin: 'HYPE', markPx: 28.4, prevDayPx: 26.9, change24hPct: 5.58, fundingAprPct: 32.1, openInterestUsd: 310000000 },
]

const FALLBACK_POLY: PolyMarketItem[] = [
  { title: 'Fed cuts rates at next FOMC meeting?', yesPct: 62, vol24hUsd: 8400000 },
  { title: 'BTC closes above $100k this month?', yesPct: 48, vol24hUsd: 6100000 },
  { title: 'ETH ETF weekly net inflow > $500M?', yesPct: 55, vol24hUsd: 2900000 },
]

const FALLBACK_BASIS: BasisRow[] = [
  { coin: 'BTC', perpPx: 94250, spotPx: 94210, basisBps: 4.2, alert: 'CALM' },
  { coin: 'ETH', perpPx: 3410, spotPx: 3407.5, basisBps: 7.3, alert: 'CALM' },
  { coin: 'SOL', perpPx: 218.5, spotPx: 218.2, basisBps: 13.7, alert: 'WATCH' },
]
