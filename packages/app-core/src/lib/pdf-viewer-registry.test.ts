// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { registerPdfViewer, readRegisteredPdfLocation } from './pdf-viewer-registry'
import { copyPdfLocationLink, pdfFrameForCommand } from './pdf-location-link'

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks() })

function reader() {
  const root = document.createElement('div')
  root.dataset.zenPdfPath = 'assets/paper.pdf'
  root.tabIndex = 0
  root.getClientRects = () => [{ width: 200 }] as unknown as DOMRectList
  document.body.append(root)
  return root
}

describe('PDF reader command routing', () => {
  it('selects the reader containing the focused search input', () => {
    reader()
    const focused = reader()
    const input = document.createElement('input')
    focused.append(input); input.focus()
    expect(pdfFrameForCommand()).toBe(focused)
  })
  it('ignores hidden readers and prefers the active pane', () => {
    const first = reader(); first.getClientRects = () => [] as unknown as DOMRectList
    reader()
    const pane = document.createElement('section'); pane.dataset.activePane = 'true'
    const active = reader(); pane.append(active); document.body.append(pane)
    expect(pdfFrameForCommand()).toBe(active)
  })
  it('copies native PDF.js positions without requiring a Chromium host API', async () => {
    const root = reader()
    const clipboardWriteText = vi.fn()
    Object.defineProperty(window, 'zen', { configurable: true, value: { clipboardWriteText } })
    const unregister = registerPdfViewer(root, { readLocation: () => ({ page: 2, zoom: 150, left: 0, top: 200 }) })
    await copyPdfLocationLink(root)
    expect(clipboardWriteText).toHaveBeenCalledWith('[paper.pdf, p. 2](assets/paper.pdf#page=2&zoom=150,0,200)')
    unregister()
    expect(readRegisteredPdfLocation(root)).toBeUndefined()
  })
  it('does not let an older unmount remove a replacement handle', () => {
    const root = reader()
    const unregister = registerPdfViewer(root, { readLocation: () => null })
    registerPdfViewer(root, { readLocation: () => ({ page: 3, zoom: 100, left: 0, top: 0 }) })
    unregister()
    expect(readRegisteredPdfLocation(root)?.page).toBe(3)
  })
})
