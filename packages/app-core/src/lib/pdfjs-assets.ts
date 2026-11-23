import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url&no-inline'
// The host's pdfjsAssets Vite plugin supplies this directory URL.
// @ts-expect-error Virtual module supplied by the build plugin.
import assetBase from 'virtual:zennotes-pdfjs-assets'

export function pdfjsAssetUrls(): {
  workerSrc: string
  cMapUrl: string
  standardFontDataUrl: string
  wasmUrl: string
} {
  const bundled = new URL(assetBase, window.location.href)
  // file:// has an opaque origin under Electron's CSP, so data fetches use
  // the read-only packaged-resource protocol. HTTP dev/web stays same-origin.
  const base = bundled.protocol === 'file:' ? new URL('zen-pdfjs://asset/') : bundled
  return {
    workerSrc: new URL(workerUrl, window.location.href).href,
    cMapUrl: new URL('cmaps/', base).href,
    standardFontDataUrl: new URL('standard_fonts/', base).href,
    wasmUrl: new URL('wasm/', base).href
  }
}
