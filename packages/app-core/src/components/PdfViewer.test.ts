// @vitest-environment jsdom
import { createElement } from 'react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ getDocument: vi.fn(), views: [] as any[], buses: [] as any[], links: [] as any[], external: vi.fn() }))
vi.mock('../store', () => ({ useStore: (select: (s: { vimMode: boolean }) => unknown) => select({ vimMode: false }) }))
vi.mock('../lib/pdfjs-assets', () => ({ pdfjsAssetUrls: () => ({ workerSrc: '/worker', cMapUrl: '/cmaps/', standardFontDataUrl: '/fonts/', wasmUrl: '/wasm/' }) }))
vi.mock('../lib/external-file-link', () => ({ openVaultAssetExternally: mock.external }))
vi.mock('pdfjs-dist', () => ({ GlobalWorkerOptions: {}, getDocument: mock.getDocument }))
vi.mock('pdfjs-dist/web/pdf_viewer.css', () => ({}))
vi.mock('pdfjs-dist/web/pdf_viewer.mjs', () => ({
  EventBus: class {
    handlers = new Map<string, Set<(value: any) => void>>()
    constructor() { mock.buses.push(this) }
    on(name: string, fn: (value: any) => void) { if (!this.handlers.has(name)) this.handlers.set(name, new Set()); this.handlers.get(name)!.add(fn) }
    off(name: string, fn: (value: any) => void) { this.handlers.get(name)?.delete(fn) }
    dispatch(name: string, value = {}) { this.handlers.get(name)?.forEach(fn => fn(value)) }
  },
  PDFLinkService: class {
    setViewer = vi.fn(); setDocument = vi.fn(); setHash = vi.fn()
    constructor() { mock.links.push(this) }
  },
  PDFFindController: class {},
  PDFViewer: class {
    pdfDocument: any = null
    pagesCount = 8; currentPageNumber = 1; currentScale = 1; currentScaleValue = ''; pagesRotation = 0
    update = vi.fn()
    setDocument = vi.fn((doc: any) => { this.pdfDocument = doc })
    getPageView = () => ({ pdfPage: {}, div: document.createElement('div') })
    constructor(public options: any) { mock.views.push(this) }
  }
}))
import { PdfViewer } from './PdfViewer'
let host: HTMLDivElement, root: Root
let resolve: (doc: any) => void, reject: (error: Error) => void
let task: { promise: Promise<any>; destroy: ReturnType<typeof vi.fn>; onPassword?: () => void }
const render = async (props = {}) => { await act(async () => { root.render(createElement(PdfViewer, { url: '/sample.pdf', assetPath: 'sample.pdf', ...props })) }) }
const ready = async () => { await act(async () => { resolve({ numPages: 8 }) }); await act(async () => { mock.buses[0].dispatch('pagesinit') }) }
const state = () => host.querySelector('[data-pdf-state]')!.getAttribute('data-pdf-state')
beforeEach(() => {
  vi.clearAllMocks(); mock.views.length = 0; mock.buses.length = 0; mock.links.length = 0
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => { fn(0); return 1 })
  task = { promise: new Promise((yes, no) => { resolve = yes; reject = no }), destroy: vi.fn().mockResolvedValue(undefined) }
  mock.getDocument.mockReturnValue(task)
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })

it('loads lazily and remains loading until pagesinit', async () => {
  expect(mock.getDocument).not.toHaveBeenCalled()
  await render()
  expect(state()).toBe('loading')
  expect(mock.getDocument).toHaveBeenCalledWith(expect.objectContaining({ url: '/sample.pdf', cMapPacked: true, wasmUrl: '/wasm/' }))
  await act(async () => resolve({ numPages: 8 }))
  expect(state()).toBe('loading')
  await act(async () => mock.buses[0].dispatch('pagesinit'))
  expect(state()).toBe('ready')
  expect(mock.views[0].currentScaleValue).toBe('page-width')
})
it('applies numeric legacy coordinates and repeats jumps without reloading', async () => {
  const props = { fragment: '#page=3&zoom=150,12,24', jumpKey: 1 }
  await render(props); await ready()
  const view = mock.views[0], scroll = host.querySelector('.zen-pdf-scroll')!
  expect(view.currentPageNumber).toBe(3); expect(view.currentScale).toBe(1.5)
  expect(scroll.scrollLeft).toBe(18); expect(scroll.scrollTop).toBe(36)
  view.currentPageNumber = 7
  await render({ ...props, jumpKey: 2 })
  expect(view.currentPageNumber).toBe(3); expect(view.update).toHaveBeenCalledTimes(2)
  expect(mock.getDocument).toHaveBeenCalledTimes(1)
})
it('destroys the pending task and aborts viewer listeners on unmount', async () => {
  await render()
  const view = mock.views[0], bus = mock.buses[0]
  expect(view.options.abortSignal.aborted).toBe(false)
  await act(async () => root.unmount())
  expect(task.destroy).toHaveBeenCalledTimes(1)
  expect(view.options.abortSignal.aborted).toBe(true)
  expect(view.setDocument).toHaveBeenCalledWith(null)
  expect([...bus.handlers.values()].every((listeners: any) => listeners.size === 0)).toBe(true)
  await act(async () => resolve({ numPages: 8 }))
  expect(view.setDocument).toHaveBeenCalledTimes(1)
})
it.each(['password', 'error'])('shows %s fallback and opens externally', async kind => {
  await render()
  await act(async () => { if (kind === 'password') task.onPassword!(); else reject(new Error('Broken PDF')) })
  expect(state()).toBe('error')
  expect(host.querySelector('[role=alert]')!.textContent).toContain(kind === 'password' ? 'requires a password' : 'Broken PDF')
  const button = [...host.querySelectorAll('button')].find(b => b.textContent === 'Open externally')!
  await act(async () => button.click())
  expect(mock.external).toHaveBeenCalledWith('sample.pdf', { confirm: false })
  expect(task.destroy).toHaveBeenCalled()
})
it('handles Ctrl+F and Escape locally and returns focus to the viewer', async () => {
  await render(); await ready()
  const bubble = vi.fn(); document.addEventListener('keydown', bubble)
  const viewer = host.querySelector<HTMLElement>('[data-pdf-state]')!
  const key = new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true, cancelable: true })
  await act(async () => { viewer.dispatchEvent(key) })
  expect(key.defaultPrevented).toBe(true); expect(bubble).not.toHaveBeenCalled()
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Find in PDF"]')!
  expect(input).not.toBeNull()
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  await act(async () => { input.dispatchEvent(escape) })
  expect(escape.defaultPrevented).toBe(true); expect(bubble).not.toHaveBeenCalled()
  expect(host.querySelector('[role=search]')).toBeNull(); expect(document.activeElement).toBe(viewer)
  document.removeEventListener('keydown', bubble)
})
