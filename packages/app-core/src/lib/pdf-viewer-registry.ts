import type { PdfViewLocation } from '@zennotes/bridge-contract/bridge'

/** Mounted readers expose location without depending on Chromium's private frames.
 * Weak keys never keep a closed PDF or its DOM alive. */
export interface PdfViewerHandle {
  readLocation(): PdfViewLocation | null
}

const readers = new WeakMap<HTMLElement, PdfViewerHandle>()

export function registerPdfViewer(element: HTMLElement, handle: PdfViewerHandle): () => void {
  readers.set(element, handle)
  return () => {
    if (readers.get(element) === handle) readers.delete(element)
  }
}

export function readRegisteredPdfLocation(element: HTMLElement): PdfViewLocation | null | undefined {
  return readers.get(element)?.readLocation()
}
