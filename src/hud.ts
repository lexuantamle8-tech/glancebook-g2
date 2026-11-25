// Monochrome 576x288 HUD text formatter optimized for Even Realities G2 glanceability.
// Short, high-contrast ASCII lines: max ~44 chars/line, 6-7 lines per viewport.

import type { SnapshotState } from './feeds'

export type HudView = 'PERPS' | 'POLYMARKET' | 'BASIS'
export const VIEWS: HudView[] = ['PERPS', 'POLYMARKET', 'BASIS']

function fmtPx(n: number): string {
  if (n >= 1000) return `$${n.toFixed(0)}`
  if (n >= 10) return `$${n.toFixed(2)}`
  return `$${n.toFixed(4)}`
}

function fmtCompactUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function padR(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

function padL(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : ' '.repeat(len - s.length) + s
}

export function renderHudText(state: SnapshotState, view: HudView, offset: number): {
  header: string
  body: string
  footer: string
} {
  const modeTag = state.sourceMode === 'live' ? 'LIVE' : 'SIM'
  const header = `GLANCEBOOK G2 [${view}] ${modeTag} ${state.updatedAt}`

  let lines: string[] = []
  if (view === 'PERPS') {
    lines.push('COIN   MARK      24H%    FUND/YR   OI')
    const slice = state.perps.slice(offset, offset + 5)
    for (const p of slice) {
      const chg = `${p.change24hPct >= 0 ? '+' : ''}${p.change24hPct.toFixed(1)}%`
      const fnd = `${p.fundingAprPct >= 0 ? '+' : ''}${p.fundingAprPct.toFixed(0)}%`
      const flag = Math.abs(p.fundingAprPct) >= 25 ? '!' : ' '
      lines.push(
        `${padR(p.coin, 5)} ${padL(fmtPx(p.markPx), 8)} ${padL(chg, 7)} ${padL(fnd, 6)}${flag} ${padL(fmtCompactUsd(p.openInterestUsd), 6)}`
      )
    }
  } else if (view === 'POLYMARKET') {
    lines.push('POLYMARKET TOP ODDS (READ-ONLY)')
    const slice = state.polymarket.slice(offset, offset + 4)
    for (const m of slice) {
      const shortTitle = m.title.length > 30 ? m.title.slice(0, 29) + '..' : m.title
      lines.push(`${padR(shortTitle, 32)} YES ${padL(String(m.yesPct), 2)}%`)
    }
  } else {
    lines.push(`HYPERLIQUID vs BINANCE | RISK: ${state.paperRiskStatus}`)
    const slice = state.basis.slice(offset, offset + 4)
    for (const b of slice) {
      const bps = `${b.basisBps >= 0 ? '+' : ''}${b.basisBps.toFixed(1)}bp`
      lines.push(
        `${padR(b.coin, 5)} PERP ${padL(fmtPx(b.perpPx), 8)} ${padL(bps, 8)} [${b.alert}]`
      )
    }
    lines.push(`PAPER GUARD $${state.paperNotionalUsd.toLocaleString()} (NO CUSTODY)`)
  }

  const footer = 'TAP: Next View | SCROLL: Rows | 2xTAP: Exit'
  return { header, body: lines.join('\n'), footer }
}
