#!/usr/bin/env node
/** Real Electron/PDF.js smoke against a generated vault; run after npm run build.
 * No user files, profile or installed app are used. No development server. */
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve, join } from 'node:path'
import http from 'node:http'
import net from 'node:net'
import WebSocket from 'ws'
import assert from 'node:assert/strict'
const repoRoot = resolve(import.meta.dirname, '../..')
const requireDesktop = createRequire(join(repoRoot, 'apps/desktop/package.json'))
const electronPath = requireDesktop('electron')
const sleep = ms => new Promise(done => setTimeout(done, ms))
function getFreePort() {
  return new Promise((resolvePromise, rejectPromise) => {
    const server = net.createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => {
        if (address && typeof address === 'object') resolvePromise(address.port)
        else rejectPromise(new Error('Could not allocate a CDP port'))
      })
    })
    server.on('error', rejectPromise)
  })
}

function httpGetJson(url) {
  return new Promise((resolvePromise, rejectPromise) => {
    const request = http.get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => {
        body += chunk
      })
      response.on('end', () => {
        try {
          resolvePromise(JSON.parse(body))
        } catch (error) {
          rejectPromise(error)
        }
      })
    })
    request.on('error', rejectPromise)
    request.setTimeout(1000, () => request.destroy(new Error('CDP request timed out')))
  })
}

class CdpClient {
  constructor(url) {
    this.url = url
    this.id = 1
    this.pending = new Map()
    this.listeners = new Map()
  }

  connect() {
    return new Promise((resolvePromise, rejectPromise) => {
      this.socket = new WebSocket(this.url)
      this.socket.on('open', resolvePromise)
      this.socket.on('error', rejectPromise)
      this.socket.on('message', (raw) => {
        const message = JSON.parse(String(raw))
        if (message.id && this.pending.has(message.id)) {
          const pending = this.pending.get(message.id)
          this.pending.delete(message.id)
          if (message.error) pending.reject(new Error(message.error.message))
          else pending.resolve(message.result ?? {})
          return
        }
        if (message.method) {
          for (const listener of this.listeners.get(message.method) ?? []) {
            listener(message.params ?? {})
          }
        }
      })
    })
  }

  send(method, params = {}) {
    const id = this.id++
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? []
    listeners.push(listener)
    this.listeners.set(method, listeners)
  }

  close() {
    this.socket?.terminate?.()
    this.socket?.close()
  }
}

async function connectPage(port) {
  const deadline = Date.now() + 20_000
  let lastError = null
  while (Date.now() < deadline) {
    try {
      const targets = await httpGetJson(`http://127.0.0.1:${port}/json/list`)
      const page = targets.find(
        (target) =>
          target.type === 'page' &&
          target.webSocketDebuggerUrl &&
          (String(target.url).startsWith('file:') || String(target.url).includes('index.html'))
      )
      if (page) {
        const client = new CdpClient(page.webSocketDebuggerUrl)
        await client.connect()
        return client
      }
    } catch (error) {
      lastError = error
    }
    await sleep(100)
  }
  throw new Error(`No Electron page target: ${lastError?.message ?? 'timeout'}`)
}

async function evaluate(client, expression) {
  const response = await client.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  })
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ?? response.exceptionDetails.text
    )
  }
  return response.result?.value
}

async function until(client, expression, timeoutMs = 5000, intervalMs = 80) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await evaluate(client, expression)
    if (value) return value
    await sleep(intervalMs)
  }
  return null
}


function fixturePdf() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>', '',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Rotate 90 /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ]
  for (const [i, text] of [[3, 'Alpha PDF.js selectable needle'], [5, 'Beta rotated page needle']]) {
    const stream = `BT /F1 18 Tf 72 700 Td (${text}) Tj ET`
    objects[i] = `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  }
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((obj, i) => { offsets.push(Buffer.byteLength(body)); body += `${i + 1} 0 obj\n${obj}\nendobj\n` })
  const xref = Buffer.byteLength(body)
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return body
}
async function press(client, key, ctrl = false, shift = false) {
  const code = key === ' ' ? 'Space' : key.length === 1 ? `Key${key.toUpperCase()}` : key
  await client.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, modifiers: (ctrl ? 2 : 0) | (shift ? 8 : 0), ...(key.length === 1 && !ctrl ? { text: key } : {}) })
  await client.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, modifiers: (ctrl ? 2 : 0) | (shift ? 8 : 0) })
}
async function setInput(client, selector, value) {
  await evaluate(client, `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) throw Error('Missing input'); el.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', {bubbles:true})); })()`)
}

const temp = await mkdtemp(join(tmpdir(), 'zennotes-pdfjs-smoke-'))
let child, client, originalClipboard
let log = ''
const errors = []
try {
  const vaultRoot = join(temp, 'vault'), userData = join(temp, 'profile'), config = join(temp, 'config')
  for (const dir of ['inbox', 'quick', 'archive', 'trash', 'assets']) await mkdir(join(vaultRoot, dir), { recursive: true })
  await mkdir(userData); await mkdir(config)
  await writeFile(join(vaultRoot, 'assets/study sample.pdf'), fixturePdf())
  await writeFile(join(vaultRoot, 'inbox/Study.md'), '# PDF smoke\n\n[Study reference](assets/study%20sample.pdf#page=2&zoom=150,0,220)\n\nBody after PDF.\n')
  await writeFile(join(userData, 'zennotes.config.json'), JSON.stringify({ workspaceMode: 'local', vaultRoot, remoteWorkspace: null, remoteWorkspaceProfiles: [], zoomFactor: 1, quickCaptureHotkey: '', windowState: {x:60,y:60,width:1180,height:780,isMaximized:false} }))
  await writeFile(join(config, 'config.toml'), '[vim]\nenabled = true\n[editor]\nlive_preview = true\npdf_embed_in_edit_mode = "compact"\n')
  const port = await getFreePort()
  child = spawn(electronPath, [`--remote-debugging-port=${port}`, join(repoRoot, 'apps/desktop/out/main/index.js')], {
    cwd: repoRoot,
    env: { ...process.env, ZENNOTES_USER_DATA_PATH: userData, ZENNOTES_CONFIG_DIR: config, ELECTRON_RUN_AS_NODE: '', NODE_OPTIONS: `--require ${join(repoRoot, 'tooling/scripts/test-window-inactive.cjs')}` },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  child.stdout.on('data', data => { log = (log + data).slice(-18000) })
  child.stderr.on('data', data => { log = (log + data).slice(-18000) })
  client = await connectPage(port)
  await client.send('Runtime.enable')
  client.on('Runtime.exceptionThrown', event => errors.push(event.exceptionDetails?.exception?.description || event.exceptionDetails?.text))
  await client.send('Emulation.setFocusEmulationEnabled', {enabled:true})
  // Exercise the real file-backed renderer before opening any document.
  assert.ok(await until(client, `(() => { const note=document.querySelector('[data-sidebar-path="inbox/Study.md"]'); if(note) return true; const folder=document.querySelector('[data-sidebar-type="folder"][data-sidebar-folder="inbox"]'); if(folder?.getAttribute('data-sidebar-collapsed')==='true') folder.click(); return false; })()`, 30000), 'temporary vault indexed')
  await until(client, `!!document.querySelector('[data-whats-new-close]')`, 4000)
  await evaluate(client, `document.querySelector('[data-whats-new-close]')?.click()`)
  originalClipboard = await evaluate(client, `window.zen.clipboardReadText()`)
  await evaluate(client, `document.querySelector('[data-sidebar-path="inbox/Study.md"]').click()`)
  assert.ok(await until(client, `!!document.querySelector('.cm-editor')`, 10000), 'note opens')
  await evaluate(client, `(() => { const NativeWorker=window.Worker; window.__pdfSmokeWorkers=[]; window.Worker=class extends NativeWorker { constructor(...args) {super(...args); this.stopped=false;window.__pdfSmokeWorkers.push(this)} terminate() {this.stopped=true;return super.terminate()} }; })()`)
  await press(client, 'Escape')
  await press(client, ' '); await press(client, 'f')
  assert.ok(await until(client, `!!document.querySelector('input[placeholder^="Search files"]')`), 'Space f opens file search')
  await setInput(client, 'input[placeholder^="Search files"]', 'study sample.pdf')
  assert.ok(await until(client, `!!document.querySelector('[data-search-pdf="assets/study sample.pdf"]')`), 'PDF listed in Space f')
  await press(client, 'Enter')
  assert.ok(await until(client, `document.querySelector('.zen-pdf')?.dataset.pdfState === 'ready'`, 15000), `PDF.js ready: ${await evaluate(client, `document.querySelector('.zen-pdf')?.textContent`)}`)
  assert.ok(await until(client, `!!document.querySelector('.zen-pdf canvas') && document.querySelector('.zen-pdf .textLayer')?.textContent.includes('Alpha')`, 10000), 'real canvas and selectable text layer')
  assert.equal(await evaluate(client, `document.querySelector('.zen-pdf iframe')`), null, 'not a native iframe')
  console.log('PASS Space f → PDF.js canvas and text layer')
  // Actual built font/cmap/wasm delivery under file:// CSP, with no CDN.
  const assets = await evaluate(client, `(async () => { const urls=['zen-pdfjs://asset/cmaps/Adobe-Japan1-UCS2.bcmap','zen-pdfjs://asset/standard_fonts/LiberationSans-Regular.ttf','zen-pdfjs://asset/wasm/qcms_bg.wasm']; return Promise.all(urls.map(async url => {const r=await fetch(url);return {ok:r.ok,length:(await r.arrayBuffer()).byteLength}})); })()`)
  assert.ok(assets.every(x => x.ok && x.length > 0), JSON.stringify(assets))
  console.log('PASS offline cmap, font and wasm delivery')
  await setInput(client, '.zen-pdf input[aria-label="Page"]', '2')
  assert.ok(await until(client, `document.querySelector('.zen-pdf input[aria-label="Page"]').value === '2'`), 'page navigation')
  await evaluate(client, `document.querySelector('.zen-pdf').focus()`)
  await press(client, 'f', true)
  assert.ok(await until(client, `!!document.querySelector('.zen-pdf input[aria-label="Find in PDF"]')`), 'local Ctrl+F')
  await setInput(client, '.zen-pdf input[aria-label="Find in PDF"]', 'needle')
  await press(client, 'Enter')
  assert.ok(await until(client, `!!document.querySelector('.zen-pdf .highlight')`, 10000), 'find highlights text')
  await press(client, 'Escape')
  assert.equal(await evaluate(client, `document.activeElement.classList.contains('zen-pdf')`), true, 'Escape restores reader focus')
  console.log('PASS page navigation and local find')
  await evaluate(client, `document.querySelector('.zen-pdf [aria-label="Rotate clockwise"]').click()`)
  const copied = await evaluate(client, `(async () => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim()==='Copy link');button.click();await new Promise(r=>setTimeout(r,150));return window.zen.clipboardReadText(); })()`)
  assert.ok(copied.includes('assets/study%20sample.pdf#page='), 'copy location uses native registry')
  console.log('PASS rotate and copy source link')
  // Return to note and use its real compact reference action.
  await evaluate(client, `document.querySelector('[data-sidebar-path="inbox/Study.md"]').click()`)
  assert.ok(await until(client, `!!document.querySelector('[title="Open this PDF in the reference pane"], [title="Pin this PDF in the reference pane"]')`, 10000), 'reference card available')
  const refWorkerStart = await evaluate(client, `window.__pdfSmokeWorkers.length`)
  await evaluate(client, `document.querySelector('[title="Open this PDF in the reference pane"], [title="Pin this PDF in the reference pane"]').click()`)
  assert.ok(await until(client, `document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf')?.dataset.pdfState==='ready'`, 15000), 'reference PDF.js ready')
  assert.ok(await until(client, `window.__pdfSmokeWorkers.length>${refWorkerStart}`, 5000), 'reference creates a real worker')
  assert.ok(await until(client, `document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf [aria-label="Page"]').value==='2'`, 10000), 'legacy link page')
  await evaluate(client, `document.querySelector('[aria-label="Copy link to PDF location"]').click()`)
  const referenceLink = await evaluate(client, `window.zen.clipboardReadText()`)
  const top = Number(referenceLink.match(/zoom=[^,]+,[^,]+,([\d.]+)/)?.[1])
  assert.ok(Math.abs(top-220) < 2, `legacy top offset restored: ${referenceLink}`)
  await setInput(client, '[data-pane-id="pinned-ref"] .zen-pdf [aria-label="Page"]', '1')
  await evaluate(client, `document.querySelector('[title="Hide reference pane (pin stays)"]').click()`)
  assert.ok(await until(client, `!document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf')`), 'hidden reference unmounts reader')
  assert.ok(await until(client, `window.__pdfSmokeWorkers.slice(${refWorkerStart}).every(worker=>worker.stopped)`, 5000), 'reference worker terminates when hidden')
  await press(client, 'P', true, true)
  assert.ok(await until(client, `!!document.querySelector('input[placeholder="Type a command…"]')`), 'command palette opens')
  await setInput(client, 'input[placeholder="Type a command…"]', 'Show Reference Pane')
  assert.ok(await until(client, `[...document.querySelectorAll('[data-cmd-idx]')].some(el=>el.textContent.includes('Show Reference Pane'))`), 'show reference command available')
  await press(client, 'Enter')
  assert.ok(await until(client, `document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf')?.dataset.pdfState==='ready'`, 15000), 'reference resumes')
  assert.ok(await until(client, `document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf [aria-label="Page"]').value==='1'`, 5000), 'reference restores reading position')
  // Following the original card is a new explicit request, so it must jump
  // back even though the same PDF and fragment are already pinned.
  await evaluate(client, `document.querySelector('[title="Showing in the reference pane (click to focus)"]')?.click()`)
  assert.ok(await until(client, `document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf [aria-label="Page"]').value==='2'`, 5000), 'repeated source link returns to page 2')
  console.log('PASS reference link navigation, unmount and resume')
  assert.ok(!errors.some(e => /pdf|worker|CSP|Content Security/i.test(e)), errors.join('\n'))
  console.log('PDF.js smoke passed. Temporary vault only.')
} catch (error) {
  console.error(error)
  console.error('Renderer exceptions:', errors)
  if (client) console.error('Geometry:', await evaluate(client, `(() => {const s=document.querySelector('[data-pane-id="pinned-ref"] .zen-pdf-scroll');return s? {scroll:s.scrollTop,h:s.clientHeight,box:s.getBoundingClientRect().toJSON(),pages:[...s.querySelectorAll('.page')].map(p=>({n:p.dataset.pageNumber,box:p.getBoundingClientRect().toJSON(),scale:p.style.cssText}))}:null})()`).catch(()=>null))
  if (client) console.error('DOM:', await evaluate(client, `document.body.innerText.slice(-4000)`).catch(() => 'unavailable'))
  console.error(log.slice(-8000))
  process.exitCode = 1
} finally {
  if (client && typeof originalClipboard === 'string') {
    await evaluate(client, `window.zen.clipboardWriteText(${JSON.stringify(originalClipboard)})`).catch(() => {})
  }
  client?.close()
  if (child && child.exitCode === null) {
    child.kill('SIGTERM')
    await Promise.race([new Promise(done => child.once('exit', done)), sleep(3000)])
    if (child.exitCode === null) child.kill('SIGKILL')
  }
  await rm(temp, {recursive:true,force:true})
}
