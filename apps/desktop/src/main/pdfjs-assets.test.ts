import { describe, expect, it } from 'vitest'
import path from 'node:path'
import { pdfjsAssetFile } from './pdfjs-assets'

describe('packaged PDF.js resources', () => {
  const root = path.resolve('/renderer/pdfjs-assets')
  it('serves font, cmap, wasm and fallback scripts with useful types', () => {
    expect(pdfjsAssetFile(root, 'zen-pdfjs://asset/wasm/qcms_bg.wasm')).toEqual({ file: path.join(root, 'wasm/qcms_bg.wasm'), contentType: 'application/wasm' })
    expect(pdfjsAssetFile(root, 'zen-pdfjs://asset/cmaps/Adobe-Japan1-UCS2.bcmap')?.file).toBe(path.join(root, 'cmaps/Adobe-Japan1-UCS2.bcmap'))
    expect(pdfjsAssetFile(root, 'zen-pdfjs://asset/standard_fonts/LiberationSans-Regular.ttf')?.contentType).toBe('font/ttf')
    expect(pdfjsAssetFile(root, 'zen-pdfjs://asset/wasm/openjpeg_nowasm_fallback.js')?.contentType).toBe('text/javascript')
  })
  it.each(['file:///etc/passwd', 'zen-pdfjs://other/wasm/x.wasm', 'zen-pdfjs://asset/wasm/%2e%2e%2f%2e%2e%2fmain/index.js', 'zen-pdfjs://asset/other/x.js', 'zen-pdfjs://asset/wasm/%zz', 'zen-pdfjs://asset/wasm/x.html'])('refuses paths outside the resource set: %s', href => {
    expect(pdfjsAssetFile(root, href)).toBeNull()
  })
})
