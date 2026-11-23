import path from 'node:path'

/** Only PDF.js's packaged data files are served, never arbitrary vault files. */
export function pdfjsAssetFile(root: string, href: string): { file: string; contentType: string } | null {
  try {
    const url = new URL(href)
    if (url.protocol !== 'zen-pdfjs:' || url.hostname !== 'asset') return null
    const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    if (!/^(cmaps|standard_fonts|wasm)\/[A-Za-z0-9_.-]+\.(bcmap|ttf|pfb|wasm|js)$/.test(rel)) return null
    const file = path.resolve(root, rel)
    if (!file.startsWith(path.resolve(root) + path.sep)) return null
    const contentType = file.endsWith('.wasm') ? 'application/wasm'
      : file.endsWith('.js') ? 'text/javascript'
      : file.endsWith('.ttf') ? 'font/ttf'
      : 'application/octet-stream'
    return { file, contentType }
  } catch { return null }
}
