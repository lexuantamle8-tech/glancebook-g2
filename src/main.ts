import {
  waitForEvenAppBridge,
  TextContainerProperty,
  CreateStartUpPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
} from '@evenrealities/even_hub_sdk'
import { loadMarketSnapshot, type SnapshotState } from './feeds'
import { renderHudText, VIEWS } from './hud'

function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

let viewIdx = 0
let scrollOffset = 0
let state: SnapshotState

function updateWebPreview() {
  const view = VIEWS[viewIdx]
  const hud = renderHudText(state, view, scrollOffset)
  const hEl = document.getElementById('g2-header')
  const bEl = document.getElementById('g2-body')
  const fEl = document.getElementById('g2-footer')
  if (hEl) hEl.textContent = hud.header
  if (bEl) bEl.textContent = hud.body
  if (fEl) fEl.textContent = hud.footer
}

async function initApp() {
  state = await loadMarketSnapshot()
  updateWebPreview()

  // Browser lens preview buttons (works standalone on GitHub Pages / desktop review)
  document.getElementById('btn-tap')?.addEventListener('click', () => {
    viewIdx = (viewIdx + 1) % VIEWS.length
    scrollOffset = 0
    updateWebPreview()
    syncGlasses()
  })
  document.getElementById('btn-scroll')?.addEventListener('click', () => {
    scrollOffset = (scrollOffset + 1) % 3
    updateWebPreview()
    syncGlasses()
  })
  document.getElementById('btn-refresh')?.addEventListener('click', async () => {
    state = await loadMarketSnapshot()
    updateWebPreview()
    syncGlasses()
  })

  // Periodic background refresh every 20s
  setInterval(async () => {
    state = await loadMarketSnapshot()
    updateWebPreview()
    syncGlasses()
  }, 20_000)

  // Connect to Even Realities G2 bridge when running inside Even Hub / Simulator
  let bridge: Awaited<ReturnType<typeof waitForEvenAppBridge>> | null = null
  try {
    bridge = await Promise.race([
      waitForEvenAppBridge(),
      new Promise<null>(resolve => setTimeout(() => resolve(null), 1500)),
    ])
  } catch {
    bridge = null
  }

  function syncGlasses() {
    if (!bridge) return
    const hud = renderHudText(state, VIEWS[viewIdx], scrollOffset)
    bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: 1, containerName: 'header', content: hud.header }),
    )
    bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: 2, containerName: 'body', content: hud.body }),
    )
    bridge.textContainerUpgrade(
      new TextContainerUpgrade({ containerID: 3, containerName: 'footer', content: hud.footer }),
    )
  }

  if (!bridge) {
    const st = document.getElementById('bridge-status')
    if (st) st.textContent = 'Browser Lens Emulator Mode (Run in Even Hub Simulator or G2 for native bridge)'
    return
  }

  const st = document.getElementById('bridge-status')
  if (st) st.textContent = 'Connected to Even Realities G2 Bridge'

  const hud = renderHudText(state, VIEWS[viewIdx], scrollOffset)
  await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: 3,
      textObject: [
        new TextContainerProperty({
          xPosition: 0, yPosition: 0, width: 576, height: 42,
          borderWidth: 1, borderColor: 6, paddingLength: 4,
          containerID: 1, containerName: 'header', content: hud.header, isEventCapture: 0,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 44, width: 576, height: 200,
          borderWidth: 0, borderColor: 5, paddingLength: 6,
          containerID: 2, containerName: 'body', content: hud.body, isEventCapture: 1,
        }),
        new TextContainerProperty({
          xPosition: 0, yPosition: 246, width: 576, height: 42,
          borderWidth: 1, borderColor: 4, paddingLength: 4,
          containerID: 3, containerName: 'footer', content: hud.footer, isEventCapture: 0,
        }),
      ],
    }),
  )

  const unsubscribe = bridge.onEvenHubEvent(async event => {
    const sysType = eventTypeOf(event.sysEvent)
    const textType = eventTypeOf(event.textEvent)

    if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      bridge!.shutDownPageContainer(1)
      return
    }
    if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
      viewIdx = (viewIdx + 1) % VIEWS.length
      scrollOffset = 0
      updateWebPreview()
      syncGlasses()
      return
    }
    if (textType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      scrollOffset = Math.min(scrollOffset + 1, 2)
      updateWebPreview()
      syncGlasses()
      return
    }
    if (textType === OsEventTypeList.SCROLL_TOP_EVENT) {
      scrollOffset = Math.max(scrollOffset - 1, 0)
      updateWebPreview()
      syncGlasses()
      return
    }
    if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
      unsubscribe()
    }
  })
}

initApp()
