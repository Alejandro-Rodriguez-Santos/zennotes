import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pdfjsAssetUrls } from '../lib/pdfjs-assets'
import { registerPdfViewer } from '../lib/pdf-viewer-registry'
import { legacyPdfLocation, legacyPdfScrollDelta } from '../lib/pdf-viewer-location'
import { openVaultAssetExternally } from '../lib/external-file-link'
import { useStore } from '../store'
import './PdfViewer.css'

interface Props {
  url: string
  assetPath: string
  title?: string
  fragment?: string | null
  jumpKey?: string | number
  stateKey?: string
  className?: string
}
type Viewer = InstanceType<typeof import('pdfjs-dist/web/pdf_viewer.mjs').PDFViewer>
// Retain only positions, not documents, canvases, workers or DOM references.
const positions = new Map<string, { position: string; request: string; rotation: number }>()

export function PdfViewer({ url, assetPath, title, fragment, jumpKey, stateKey, className = '' }: Props): JSX.Element {
  const vimMode = useStore(s => s.vimMode)
  const firstG = useRef(0)
  const root = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const pages = useRef<HTMLDivElement>(null)
  const viewer = useRef<Viewer | null>(null)
  const jump = useRef<(hash: string) => void>(() => {})
  const request = useRef({ fragment, key: `${jumpKey ?? ''}:${fragment ?? ''}` })
  request.current = { fragment, key: `${jumpKey ?? ''}:${fragment ?? ''}` }
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [retry, setRetry] = useState(0)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [findStatus, setFindStatus] = useState('')
  const searchInput = useRef<HTMLInputElement>(null)
  const find = useRef<(previous: boolean) => void>(() => {})

  // Capture the last viewport before React removes its DOM on hide/switch.
  useLayoutEffect(() => {
    let cancelled = false
    let dispose = () => {}
    setLoading(true)
    setError('')
    setCount(0)
    setPage(1)
    setFindStatus('')
    void (async () => {
      // web/pdf_viewer reads globalThis.pdfjsLib at module evaluation time.
      // Load core first; concurrent imports can race in split production chunks.
      const pdfjs = await import('pdfjs-dist')
      const [web] = await Promise.all([
        import('pdfjs-dist/web/pdf_viewer.mjs'),
        import('pdfjs-dist/web/pdf_viewer.css')
      ])
      if (cancelled) return
      const rootEl = root.current!
      const scroll = container.current!
      const assets = pdfjsAssetUrls()
      pdfjs.GlobalWorkerOptions.workerSrc = assets.workerSrc
      const bus = new web.EventBus()
      const links = new web.PDFLinkService({ eventBus: bus })
      const finder = new web.PDFFindController({ eventBus: bus, linkService: links })
      const lifecycle = new AbortController()
      dispose = () => lifecycle.abort()
      // v6 supports abortSignal for scroll handlers/ResizeObserver even though
      // its generated PDFViewerOptions declaration omits the field.
      const viewerOptions = {
        container: scroll, viewer: pages.current!, eventBus: bus,
        linkService: links, findController: finder, maxCanvasPixels: 16_777_216,
        abortSignal: lifecycle.signal
      }
      const view = new web.PDFViewer(viewerOptions)
      viewer.current = view
      links.setViewer(view)
      const resize = () => {
        // Leave enough trailing space to position even the end of the last
        // page at the same 20% focus line used by source links.
        scroll.style.setProperty('--zen-pdf-tail', `${Math.ceil(scroll.clientHeight * 0.8)}px`)
        if (view.pdfDocument && view.currentScaleValue === 'page-width') view.currentScaleValue = 'page-width'
      }
      resize()
      const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
      resizeObserver?.observe(scroll)
      const readLocation = () => {
        if (!view.pdfDocument || !view.pagesCount) return null
        const visible = view.getPageView(view.currentPageNumber - 1)
        if (!visible) return null
        const box = visible.div.getBoundingClientRect()
        const frame = scroll.getBoundingClientRect()
        return {
          page: view.currentPageNumber, zoom: view.currentScale * 100,
          left: Math.max(0, (frame.left - box.left) / view.currentScale),
          top: Math.max(0, (frame.top + scroll.clientHeight * 0.2 - box.top) / view.currentScale)
        }
      }
      const unregister = registerPdfViewer(rootEl, { readLocation })
      let ready = false
      let jumpId = 0
      jump.current = hash => {
        if (!ready) return
        const id = ++jumpId
        const location = legacyPdfLocation(hash)
        if (!location) {
          links.setHash(hash.replace(/^#/, ''))
          return
        }
        void (async () => {
          const pageNumber = Math.min(location.page, view.pagesCount)
          const pv = view.getPageView(pageNumber - 1)
          // Placeholder pages initially have page 1's dimensions. Resolve the
          // destination before scrolling: its rotation/size can be different.
          if (!pv.pdfPage) {
            const pdfPage = await view.pdfDocument!.getPage(pageNumber)
            if (cancelled || id !== jumpId) return
            if (!pv.pdfPage) pv.setPdfPage(pdfPage)
          }
          if (cancelled || id !== jumpId) return
          view.currentScale = Math.min(10, Math.max(0.1, location.zoom / 100))
          view.currentPageNumber = pageNumber
          const delta = legacyPdfScrollDelta(location, view.currentScale,
            pv.div.getBoundingClientRect(), scroll.getBoundingClientRect(), scroll.clientHeight)
          scroll.scrollLeft += delta.left
          scroll.scrollTop += delta.top
          view.update()
        })().catch(reason => {
          if (!cancelled && id === jumpId) setError(`Unable to navigate to this page: ${String(reason)}`)
        })
      }
      find.current = previous => bus.dispatch('find', {
        source: rootEl, type: 'again', query: searchInput.current?.value ?? '',
        phraseSearch: true, caseSensitive: false, entireWord: false,
        highlightAll: true, findPrevious: previous
      })
      const onPage = ({ pageNumber }: { pageNumber: number }) => setPage(pageNumber)
      const onMatches = ({ matchesCount }: { matchesCount: { current: number; total: number } }) => {
        if (!cancelled) setFindStatus(`${matchesCount.current} / ${matchesCount.total}`)
      }
      const onFindState = ({ state }: { state: number }) => {
        if (!cancelled && state === 1) setFindStatus('No matches')
      }
      const onReady = () => {
        if (cancelled) return
        ready = true
        view.currentScaleValue = 'page-width'
        setLoading(false)
        const saved = stateKey ? positions.get(stateKey) : undefined
        // Hiding/showing the same reference resumes reading. An explicit new
        // follow has a new nonce and must return to the requested fragment.
        if (saved && saved.request === request.current.key) {
          view.pagesRotation = saved.rotation
          jump.current(saved.position)
        } else if (request.current.fragment) {
          jump.current(request.current.fragment)
        }
      }
      bus.on('pagechanging', onPage)
      bus.on('pagesinit', onReady)
      bus.on('updatefindmatchescount', onMatches)
      bus.on('updatefindcontrolstate', onFindState)
      const task = pdfjs.getDocument({
        url, cMapUrl: assets.cMapUrl, cMapPacked: true,
        standardFontDataUrl: assets.standardFontDataUrl, wasmUrl: assets.wasmUrl
      })
      const destroyTask = () => { void task.destroy().catch(() => {}) }
      task.onPassword = () => {
        if (!cancelled) {
          setError('This PDF requires a password. Open it in another application.')
          setLoading(false)
        }
        destroyTask()
      }
      dispose = () => {
        const location = readLocation()
        if (stateKey && location) {
          positions.delete(stateKey)
          positions.set(stateKey, {
            position: `page=${location.page}&zoom=${location.zoom},${location.left},${location.top}`,
            request: request.current.key, rotation: view.pagesRotation
          })
          if (positions.size > 32) positions.delete(positions.keys().next().value!)
        }
        unregister()
        jump.current = () => {}
        find.current = () => {}
        viewer.current = null
        bus.off('pagechanging', onPage)
        bus.off('pagesinit', onReady)
        bus.off('updatefindmatchescount', onMatches)
        bus.off('updatefindcontrolstate', onFindState)
        view.setDocument(null)
        links.setDocument(null)
        lifecycle.abort()
        resizeObserver?.disconnect()
        destroyTask()
      }
      const document = await task.promise
      if (cancelled) return
      setCount(document.numPages)
      links.setDocument(document)
      view.setDocument(document)
    })().catch(reason => {
      if (!cancelled) {
        dispose()
        dispose = () => {}
        setError(previous => previous || (reason instanceof Error ? reason.message : 'Unable to open PDF'))
        setLoading(false)
      }
    })
    return () => { cancelled = true; dispose() }
  }, [url, stateKey, retry])

  useEffect(() => { if (fragment) jump.current(fragment) }, [fragment, jumpKey])
  const beginFind = () => {
    setSearching(true)
    requestAnimationFrame(() => searchInput.current?.focus())
  }
  const zoom = (factor: number) => {
    if (viewer.current?.pdfDocument) viewer.current.currentScale = Math.min(10, Math.max(0.1, viewer.current.currentScale * factor))
  }

  return (
    <div ref={root} data-zen-pdf-path={assetPath} data-pdf-state={error ? 'error' : loading ? 'loading' : 'ready'}
      tabIndex={0} aria-label={title || 'PDF viewer'} className={`zen-pdf ${className}`}
      onKeyDown={event => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
          event.preventDefault(); event.stopPropagation(); beginFind()
        } else if (event.key === 'Escape' && searching) {
          event.preventDefault(); event.stopPropagation(); setSearching(false); root.current?.focus()
        } else if ((event.ctrlKey || event.metaKey) && ['+', '=', '-'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation(); zoom(event.key === '-' ? 1 / 1.2 : 1.2)
        } else if (vimMode && !event.ctrlKey && !event.metaKey && !event.altKey &&
          !(event.target instanceof HTMLInputElement) && !(event.target instanceof HTMLTextAreaElement) &&
          !(event.target as Element).closest('button')) {
          const scroll = container.current
          if (!scroll) return
          if (['j', 'k', 'h', 'l'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation()
            scroll.scrollBy({ top: event.key === 'j' ? 40 : event.key === 'k' ? -40 : 0,
              left: event.key === 'l' ? 40 : event.key === 'h' ? -40 : 0 })
          } else if (event.key === 'G' || (event.key === 'g' && Date.now() - firstG.current < 600)) {
            event.preventDefault(); event.stopPropagation()
            scroll.scrollTop = event.key === 'G' ? scroll.scrollHeight : 0
            firstG.current = 0
          } else if (event.key === 'g') {
            event.preventDefault(); event.stopPropagation(); firstG.current = Date.now()
          }
        }
      }}
      onClickCapture={event => {
        const anchor = (event.target as Element).closest('a[href]') as HTMLAnchorElement | null
        if (anchor && /^(https?:|mailto:)/i.test(anchor.href)) {
          event.preventDefault(); event.stopPropagation()
          void window.zen.openExternalUrl(anchor.href)
        }
      }}>
      <div className="zen-pdf-toolbar" role="toolbar" aria-label="PDF navigation">
        <button disabled={loading || !!error || page <= 1} onClick={() => { if (viewer.current) viewer.current.currentPageNumber-- }}>Previous</button>
        <input aria-label="Page" type="number" min={1} max={count || 1} value={page} disabled={loading || !!error}
          onChange={e => { const n = Number(e.target.value); if (viewer.current && Number.isInteger(n) && n >= 1 && n <= count) viewer.current.currentPageNumber = n }} />
        <span>/ {count}</span>
        <button disabled={loading || !!error || page >= count} onClick={() => { if (viewer.current) viewer.current.currentPageNumber++ }}>Next</button>
        <button aria-label="Zoom out" disabled={loading || !!error} onClick={() => zoom(1 / 1.2)}>−</button>
        <button aria-label="Zoom in" disabled={loading || !!error} onClick={() => zoom(1.2)}>+</button>
        <button disabled={loading || !!error} onClick={() => { if (viewer.current) viewer.current.currentScaleValue = 'page-width' }}>Fit width</button>
        <button aria-label="Rotate clockwise" disabled={loading || !!error} onClick={() => { if (viewer.current) viewer.current.pagesRotation = (viewer.current.pagesRotation + 90) % 360 }}>Rotate</button>
        <button disabled={loading || !!error} onClick={beginFind}>Find</button>
      </div>
      {searching && <div className="zen-pdf-toolbar" role="search" aria-label="Find in PDF">
        <input ref={searchInput} aria-label="Find in PDF" value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); find.current(e.shiftKey) } }} />
        <button onClick={() => find.current(true)}>Previous match</button>
        <button onClick={() => find.current(false)}>Next match</button>
        <span role="status">{findStatus}</span>
      </div>}
      {loading && <div role="status">Loading PDF…</div>}
      {error && <div role="alert" className="zen-pdf-error">
        <p>{error}</p>
        <button onClick={() => setRetry(n => n + 1)}>Retry</button>
        <button onClick={() => void openVaultAssetExternally(assetPath, { confirm: false })}>Open externally</button>
      </div>}
      <div className="zen-pdf-body"><div ref={container} className="zen-pdf-scroll"><div ref={pages} className="pdfViewer" /></div></div>
    </div>
  )
}
