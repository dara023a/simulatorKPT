import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = process.cwd()
const outDir = path.join(root, '.tmp-sim-check')
const outfile = path.join(outDir, 'simulation-entry.mjs')
const MAX_TICKS = 2000

let passed = 0

function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function run(dataset) {
  let state = mod.createInitialState(dataset, 1)
  const phases = [state.phase]
  const seenWorkerStatuses = new Set()
  const seenTaskStatuses = new Set()

  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    if (state.phase === 'completed') break
    state = mod.advance(state)
    if (phases[phases.length - 1] !== state.phase) phases.push(state.phase)
    for (const worker of state.workers) seenWorkerStatuses.add(worker.status)
    for (const task of state.tasks) seenTaskStatuses.add(task.status)
    assert.ok(state.tick <= MAX_TICKS, 'simulation did not finish in time')
  }

  return { state, phases, seenWorkerStatuses, seenTaskStatuses }
}

function mergeWorkerFrequencies(workers) {
  const merged = {}
  for (const worker of workers) {
    for (const [word, count] of Object.entries(worker.frequencies)) {
      merged[word] = (merged[word] ?? 0) + count
    }
  }
  return merged
}

function assertNoNegativeProgress(state) {
  for (const worker of state.workers) {
    assert.ok(worker.progress >= 0 && worker.progress <= 100, `${worker.id} progress out of range`)
    assert.ok(worker.docsProcessed >= 0, `${worker.id} negative docs`)
    assert.ok(worker.wordsProcessed >= 0, `${worker.id} negative words`)
  }
  for (const task of state.tasks) {
    assert.ok(task.progress >= 0 && task.progress <= 100, `${task.id} progress out of range`)
  }
}

function assertCoverage(state) {
  const docs = state.dataset.docs.length
  assert.equal(state.tasks.reduce((sum, task) => sum + task.docCount, 0), docs)
  const covered = new Set()
  for (const task of state.tasks) {
    assert.ok(task.docCount > 0, `${task.id} has no documents`)
    assert.ok(task.docCount <= state.dataset.taskSize, `${task.id} exceeds task size`)
    for (let index = task.startDoc; index <= task.endDoc; index += 1) {
      covered.add(index)
    }
  }
  assert.equal(covered.size, docs, 'task ranges must cover every document exactly once')
}

function verifyDataset(name, dataset) {
  const first = run(dataset)
  const second = run(dataset)
  const { state, phases, seenWorkerStatuses, seenTaskStatuses } = first
  const finished = state
  const aggregate = finished.aggregate
  const baseline = finished.baseline

  check(`${name}: completes all eight phases in order`, () => {
    assert.equal(finished.phase, 'completed')
    assert.deepEqual(phases, [
      'ready',
      'initialization',
      'discovery',
      'decomposition',
      'distribution',
      'processing',
      'aggregation',
      'completed',
    ])
    assert.equal(finished.master.status, 'completed')
    assert.equal(finished.aggregationMerged, mod.WORKER_COUNT)
  })

  check(`${name}: every task is aggregated and the queue drains`, () => {
    assert.equal(finished.queue.length, 0)
    assert.ok(finished.tasks.every((task) => task.status === 'aggregated'))
    assert.ok(finished.tasks.every((task) => task.progress === 100))
    assert.ok(finished.tasks.every((task) => task.finishedTick !== null))
    assert.ok(seenTaskStatuses.has('queued'))
    assert.ok(seenTaskStatuses.has('assigned'))
    assert.ok(seenTaskStatuses.has('processing'))
    assert.ok(seenTaskStatuses.has('returned'))
  })

  check(`${name}: result-return and completed states are observable`, () => {
    assert.ok(seenWorkerStatuses.has('registered'))
    assert.ok(seenWorkerStatuses.has('receiving'))
    assert.ok(seenWorkerStatuses.has('processing'))
    assert.ok(seenWorkerStatuses.has('returning'))
    assert.ok(seenWorkerStatuses.has('completed'))
    assert.ok(!seenWorkerStatuses.has('failed'))
  })

  check(`${name}: aggregate matches the deterministic corpus baseline`, () => {
    assert.ok(aggregate)
    assert.equal(aggregate.totalDocs, finished.dataset.docs.length)
    assert.equal(aggregate.totalWords, baseline.totalWords)
    assert.equal(aggregate.uniqueWords, baseline.uniqueWords)
    assert.deepEqual(aggregate.frequencies, baseline.frequencies)
    assert.deepEqual(aggregate.topWords, baseline.topWords)
  })

  check(`${name}: additive worker counters equal the final aggregate`, () => {
    assert.deepEqual(mergeWorkerFrequencies(finished.workers), aggregate.frequencies)
    assert.equal(
      finished.workers.reduce((sum, worker) => sum + worker.docsProcessed, 0),
      finished.dataset.docs.length,
    )
    assert.equal(
      finished.workers.reduce((sum, worker) => sum + worker.wordsProcessed, 0),
      aggregate.totalWords,
    )
  })

  check(`${name}: task ranges cover the corpus exactly once`, () => {
    assertCoverage(finished)
    assertNoNegativeProgress(finished)
  })

  check(`${name}: rerunning produces identical results`, () => {
    assert.equal(second.state.tick, finished.tick)
    assert.equal(second.state.completedTick, finished.completedTick)
    assert.deepEqual(second.state.aggregate, aggregate)
    assert.deepEqual(
      second.state.workers.map((worker) => worker.timeline),
      finished.workers.map((worker) => worker.timeline),
    )
    assert.deepEqual(
      second.state.tasks.map((task) => [task.id, task.workerId, task.startedTick, task.finishedTick]),
      finished.tasks.map((task) => [task.id, task.workerId, task.startedTick, task.finishedTick]),
    )
    assert.deepEqual(second.phases, phases)
  })
}

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })
await build({
  entryPoints: [path.join(root, 'scripts', 'simulation-entry.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  logLevel: 'silent',
})

const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)

verifyDataset('sample dataset', mod.SAMPLE_DATASET)
verifyDataset('mini dataset', mod.MINI_DATASET)
verifyDataset(
  'uploaded dataset',
  mod.createUploadedDataset(
    'check.txt',
    'First document about distributed systems and worker nodes.\n\nSecond document about text analytics and word counters.\n\nThird document about parallel processing.',
  ),
)

check('empty uploaded file is rejected', () => {
  assert.throws(() => mod.createUploadedDataset('empty.txt', '   \n\n  '), /empty/i)
})

await rm(outDir, { recursive: true, force: true })
console.log(`\n${passed} checks passed.`)
