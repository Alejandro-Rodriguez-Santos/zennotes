import { describe, expect, it } from 'vitest'
import { legacyPdfLocation, legacyPdfScrollDelta } from './pdf-viewer-location'

describe('Chromium location compatibility', () => {
  it('keeps unzoomed CSS offsets, not PDF bottom-left XYZ points', () => {
    const location = legacyPdfLocation('#page=3&zoom=150,20,600')!
    expect(location).toEqual({ page: 3, zoom: 150, left: 20, top: 600 })
    expect(legacyPdfScrollDelta(location, 1.5, { left: 40, top: 500 }, { left: 10, top: 100 }, 800)).toEqual({ left: 60, top: 1140 })
  })
  it('round-trips the visible focus line at different scales (including rotated page geometry)', () => {
    for (const scale of [0.5, 1, 2.5]) {
      const savedTop = 180
      const height = 600
      const delta = legacyPdfScrollDelta({ left: 0, top: savedTop }, scale, { left: 0, top: 80 }, { left: 0, top: 0 }, height)
      const newPageTop = 80 - delta.top
      expect((height * 0.2 - newPageTop) / scale).toBeCloseTo(savedTop)
    }
  })
  it.each(['#page=0&zoom=150,0,1', '#page=2&zoom=NaN,0,1', '#page=2&zoom=0,0,1', '#page=2&zoom=150,,1', '#page=2', '#nameddest=Intro', '#page=2&zoom=page-width'])('leaves non-numeric/full locations to PDF.js: %s', hash => {
    expect(legacyPdfLocation(hash)).toBeNull()
  })
})
