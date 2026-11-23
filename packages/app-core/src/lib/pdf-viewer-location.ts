import type { PdfViewLocation } from '@zennotes/bridge-contract/bridge'

/** Chromium links store unzoomed CSS pixels from the page's top-left, not
 * PDF.js XYZ coordinates (PDF points from bottom-left). Keep that contract. */
export function legacyPdfLocation(fragment: string): PdfViewLocation | null {
  const params = new URLSearchParams(fragment.replace(/^#/, ''))
  const page = Number(params.get('page'))
  const parts = params.get('zoom')?.split(',')
  if (!Number.isSafeInteger(page) || page < 1 || parts?.length !== 3 || parts.some(p => !p.trim())) return null
  const [zoom, left, top] = parts.map(Number)
  if (![zoom, left, top].every(Number.isFinite) || zoom <= 0) return null
  return { page, zoom, left: Math.max(0, left), top: Math.max(0, top) }
}

export function legacyPdfScrollDelta(
  location: Pick<PdfViewLocation, 'left' | 'top'>,
  scale: number,
  page: Pick<DOMRect, 'left' | 'top'>,
  container: Pick<DOMRect, 'left' | 'top'>,
  height: number
): { left: number; top: number } {
  return {
    left: page.left - container.left + location.left * scale,
    top: page.top - container.top + location.top * scale - height * 0.2
  }
}
