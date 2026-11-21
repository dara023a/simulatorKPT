import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = process.cwd()
const temp = path.join(os.tmpdir(), 'kpt-ui-check')
const profile = path.join(temp, 'chrome-profile')
const shots = path.join(temp, 'shots')
const previewPort = '4173'
const debugPort = 9333
const previewUrl = `http://localhost:${previewPort}`

const browserCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean)
const browserPath = browserCandidates.find((candidate) => existsSync(candidate))

if (!browserPath) {
  console.log('Skipping UI check: no Chrome/Chromium/Edge executable found.')
  console.log('Set CHROME_PATH to a Chromium-based browser to run this check.')
  process.exit(0)
}

const failures = []
const consoleErrors = []

function log(ok, message) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${message}`)
  if (!ok) failures.push(message)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function waitForHttp(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // server not ready yet
    }
    await sleep(300)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function waitForJson(url, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url)
      if (response.ok) return await response.json()
    } catch {
      // Chrome not ready yet
    }
    await sleep(300)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl)
    const pending = new Map()
    const listeners = []
    let nextId = 1

    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const id = nextId++
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((resolveSend, rejectSend) => {
            pending.set(id, { resolve: resolveSend, reject: rejectSend })
          })
        },
        on(listener) {
          listeners.push(listener)
        },
        close() {
          socket.close()
        },
      })
    })
    socket.addEventListener('error', reject)
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id) {
        const entry = pending.get(message.id)
        if (!entry) return
        pending.delete(message.id)
        if (message.error) entry.reject(new Error(message.error.message))
        else entry.resolve(message.result)
        return
      }
      for (const listener of listeners) listener(message)
    })
  })
}

await rm(temp, { recursive: true, force: true })
await mkdir(shots, { recursive: true })

const preview = spawn(
  process.execPath,
  [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', previewPort, '--strictPort'],
  { cwd: root, stdio: 'ignore' },
)

let browser
let cdp

try {
  await waitForHttp(previewUrl)

  browser = spawn(
    browserPath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--remote-allow-origins=*',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      '--window-size=1500,1400',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const targets = await waitForJson(`http://127.0.0.1:${debugPort}/json/list`)
  const target = targets.find((entry) => entry.type === 'page')
  if (!target) throw new Error('Could not find a browser page target')

  cdp = await connectCdp(target.webSocketDebuggerUrl)
  cdp.on((message) => {
    if (message.method === 'Runtime.exceptionThrown') {
      const detail = message.params.exceptionDetails
      consoleErrors.push(detail.exception?.description ?? detail.text ?? 'Runtime exception')
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      consoleErrors.push(message.params.entry.text)
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '))
    }
  })

  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('Log.enable')

  async function evaluate(expression) {
    const result = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    }
    return result.result.value
  }

  async function bodyText() {
    return evaluate('document.body.innerText')
  }

  async function waitUntil(label, expression, timeout = 20000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return true
      await sleep(250)
    }
    throw new Error(`Timed out waiting for ${label}`)
  }

  async function click(expression, label) {
    const clicked = await evaluate(
      `(() => { const element = ${expression}; if (!element) return false; element.click(); return true })()`,
    )
    log(clicked, `clicked ${label}`)
    return clicked
  }

  const buttonContains = (text) =>
    `[...document.querySelectorAll('button')].find((element) => element.textContent.trim().includes(${JSON.stringify(text)}))`
  const exactButton = (text) =>
    `[...document.querySelectorAll('button')].find((element) => element.textContent.trim() === ${JSON.stringify(text)})`

  const tickExpression = `Number(((document.body.innerText.match(/tick (\\d+) ·/) || [])[1]) ?? -1)`
  const checksumExpression = `((document.body.innerText.match(/checksum ([0-9,]+)/) || [])[1] ?? '')`

  async function screenshot(name) {
    const result = await cdp.send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(shots, `${name}.png`), Buffer.from(result.data, 'base64'))
  }

  await cdp.send('Page.navigate', { url: previewUrl })
  await waitUntil('overview render', `document.body.innerText.includes('Distributed Sorting')`)

  const overviewText = await bodyText()
  log(overviewText.includes('Start Simulation'), 'overview shows Start Simulation')
  log(overviewText.includes('8,192') && overviewText.includes('36'), 'overview shows item and chunk counts')
  log(overviewText.toLowerCase().includes('simulation mode'), 'overview labels the simulation scope')
  log(
    (await evaluate(`document.querySelectorAll('.recharts-wrapper').length`)) === 0,
    'overview renders cleanly before charts mount',
  )

  await click(buttonContains('Start Simulation'), 'Start Simulation')
  await waitUntil('simulation route', `location.pathname === '/simulation'`)
  await waitUntil('simulation running', `document.body.innerText.includes('Running')`)
  log(true, 'Start Simulation navigates and starts the run')

  await click(exactButton('4×'), '4× speed')
  await waitUntil('completed state', `document.body.innerText.includes('Finished')`, 50000)

  const completedText = await bodyText()
  log(completedText.includes('36 / 36'), 'all 36 chunks returned to the master')
  log(completedText.includes('checksum verified') || completedText.includes('Simulation completed'), 'completion and verification are logged')
  await screenshot('simulation-completed')

  await click(`document.querySelector('a[href="/results"]')`, 'Results navigation')
  await waitUntil('results route', `location.pathname === '/results'`)
  await waitUntil('results rendered', `document.body.innerText.includes('Worker result payloads')`)
  await sleep(800)
  const resultsText = (await bodyText()).toLowerCase()
  log(resultsText.includes('monotonic non-decreasing'), 'results page reports a sorted output')
  log(resultsText.includes('checksum verified'), 'results page reports checksum verification')
  log(resultsText.includes('merge tree'), 'results page renders the merge tree section')
  log(resultsText.includes('measured'), 'results page labels imported benchmark data')
  const barRects = await evaluate(
    `document.querySelectorAll('.recharts-bar-rectangle .recharts-rectangle').length`,
  )
  log(barRects >= 9, `worker contribution chart rendered ${barRects} bars`)
  const pieSlices = await evaluate(`document.querySelectorAll('.recharts-pie-sector').length`)
  log(pieSlices > 0, `chunk distribution pie rendered ${pieSlices} slices`)
  log(resultsText.includes('processing timeline'), 'results page renders the processing timeline section')
  await screenshot('results-completed')

  await click(`document.querySelector('a[href="/topology"]')`, 'Topology navigation')
  await waitUntil('topology route', `location.pathname === '/topology'`)
  await waitUntil('topology rendered', `document.querySelector('.react-flow__node[data-id="w-01"]') !== null`)
  await click(`document.querySelector('.react-flow__node[data-id="w-01"]')`, 'worker node w-01')
  await waitUntil(
    'worker inspector',
    `document.body.innerText.toLowerCase().includes('simulated cores')`,
  )
  const inspectorText = (await bodyText()).toLowerCase()
  log(inspectorText.includes('worker 01 · w-01'), 'worker inspector opens for the clicked node')
  log(inspectorText.includes('last returned run'), 'worker inspector shows the returned payload')
  await screenshot('topology-inspector')

  await click(`document.querySelector('a[href="/simulation"]')`, 'Simulation navigation')
  await waitUntil('simulation route again', `location.pathname === '/simulation'`)
  await click(buttonContains('Reset'), 'Reset')
  await waitUntil('reset ready', `document.body.innerText.includes('Ready') && document.body.innerText.includes('tick 0')`)
  const resetText = await bodyText()
  log(resetText.includes('0 / 36'), 'Reset clears returned chunks')
  log(/1 events?/.test(resetText), 'Reset restores the initial event log')

  const startTick = await evaluate(tickExpression)
  await click(buttonContains('Step'), 'Step')
  await waitUntil('step advances', `${tickExpression} > ${startTick}`)
  const steppedTick = await evaluate(tickExpression)
  log(steppedTick === startTick + 1, 'Step advances exactly one tick')
  await click(buttonContains('Step'), 'Step again')
  await waitUntil('second step advances', `${tickExpression} > ${steppedTick}`)

  await click(buttonContains('Play'), 'Play after stepping')
  await waitUntil('play resumes', `document.body.innerText.includes('Running')`)
  await sleep(900)
  await click(buttonContains('Pause'), 'Pause')
  await waitUntil('pause state', `document.body.innerText.includes('Paused')`)
  const pausedTick = await evaluate(tickExpression)
  log(pausedTick > steppedTick, 'Play advances the clock and Pause stops the run')
  await click(buttonContains('Reset'), 'Reset again')
  await waitUntil('reset after controls', `document.body.innerText.includes('Ready') && document.body.innerText.includes('tick 0')`)

  await click(exactButton('3'), '3 worker setting')
  await waitUntil('3 workers configured', `document.body.innerText.includes('3 workers') && document.body.innerText.includes('12 chunks')`)
  log(true, 'worker count setting regenerates the run with 12 chunks')
  await click(`document.querySelector('a[href="/topology"]')`, 'Topology navigation after settings')
  await waitUntil('topology route after settings', `location.pathname === '/topology'`)
  await waitUntil('3-worker topology rendered', `document.querySelectorAll('.react-flow__node').length === 4`)
  log(true, 'topology reflects the configured 3 workers plus master')

  await click(`document.querySelector('a[href="/dataset"]')`, 'Dataset navigation')
  await waitUntil('dataset route', `location.pathname === '/dataset'`)
  await waitUntil('dataset rendered', `document.body.innerText.includes('Value distribution')`)
  const checksumBefore = await evaluate(checksumExpression)
  await click(buttonContains('Duplicates 8k'), 'duplicates dataset')
  await waitUntil('duplicates selected', `${checksumExpression} !== ${JSON.stringify(checksumBefore)}`)
  const checksumAfterDuplicates = await evaluate(checksumExpression)
  log(checksumAfterDuplicates !== checksumBefore, 'switching dataset regenerates a different checksum')
  await click(buttonContains('Nearly sorted'), 'nearly-sorted dataset')
  await waitUntil('nearly sorted selected', `${checksumExpression} !== ${JSON.stringify(checksumAfterDuplicates)}`)
  log(true, 'switching to nearly-sorted regenerates the baseline')
  log((await bodyText()).toLowerCase().includes('import results.csv'), 'dataset page exposes results.csv import')
  await screenshot('dataset-page')

  await sleep(500)
  log(consoleErrors.length === 0, `no browser console errors (${consoleErrors.length})`)
  if (consoleErrors.length > 0) {
    for (const error of consoleErrors.slice(0, 10)) console.log(`  console: ${error}`)
  }
} finally {
  cdp?.close()
  browser?.kill()
  preview.kill()
  await sleep(500)
}

console.log(`\nScreenshots: ${shots}`)
if (failures.length > 0) {
  console.error(`\n${failures.length} UI check(s) failed.`)
  process.exitCode = 1
} else {
  console.log(`\nAll UI checks passed.`)
}
