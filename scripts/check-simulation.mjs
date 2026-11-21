import assert from 'node:assert/strict'
import { mkdir, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = process.cwd()
const outDir = path.join(root, '.tmp-sim-check')
const outfile = path.join(outDir, 'simulation-entry.mjs')
const MAX_TICKS = 3000

let passed = 0
let mod

function check(name, fn) {
  fn()
  passed += 1
  console.log(`PASS  ${name}`)
}

function run(dataset, patch = {}) {
  const settings = { ...mod.DEFAULT_SETTINGS, ...patch }
  let state = mod.createInitialState(dataset, settings, 1)
  const phases = [state.phase]
  const seenWorkerStatuses = new Set(['idle'])
  const seenTaskStatuses = new Set()

  for (let tick = 0; tick < MAX_TICKS; tick += 1) {
    if (state.phase === 'completed') break
    state = mod.advance(state)
    if (phases[phases.length - 1] !== state.phase) phases.push(state.phase)
    for (const worker of state.workers) seenWorkerStatuses.add(worker.status)
    for (const task of state.tasks) seenTaskStatuses.add(task.status)
  }

  assert.equal(state.phase, 'completed', `${dataset.shortName} did not complete within ${MAX_TICKS} ticks`)
  return { state, phases, seenWorkerStatuses, seenTaskStatuses }
}

function assertProgress(state) {
  for (const worker of state.workers) {
    assert.ok(worker.progress >= 0 && worker.progress <= 100, `${worker.id} progress out of range`)
    assert.ok(worker.itemsProcessed >= 0, `${worker.id} negative item count`)
    assert.ok(worker.tasksCompleted >= 0, `${worker.id} negative chunk count`)
  }
  for (const task of state.tasks) {
    assert.ok(task.progress >= 0 && task.progress <= 100, `${task.id} progress out of range`)
  }
}

function assertCoverage(state) {
  let cursor = 0
  for (const task of state.tasks) {
    assert.equal(task.startIndex, cursor, `${task.id} range is not contiguous`)
    assert.equal(task.endIndex, task.startIndex + task.itemCount - 1, `${task.id} range mismatch`)
    assert.ok(task.itemCount > 0, `${task.id} has no items`)
    assert.equal(task.values.length, task.itemCount, `${task.id} payload length mismatch`)
    cursor = task.endIndex + 1
  }
  assert.equal(cursor, state.dataset.totalItems, 'chunks must cover the array exactly once')
}

function assertFinalAggregate(state) {
  const { aggregate, baseline } = state
  assert.ok(aggregate, 'aggregate is missing')
  assert.equal(state.queue.length, 0, 'queue must drain')
  assert.ok(state.tasks.every((task) => task.status === 'merged'), 'all chunks must be merged')
  assert.ok(state.tasks.every((task) => task.progress === 100), 'all chunks must reach 100%')
  assert.ok(state.tasks.every((task) => task.sortedValues !== null), 'every task must return sorted values')
  assert.ok(
    state.tasks.every((task) => mod.isSorted(task.sortedValues) && mod.checksum(task.sortedValues) === task.checksum),
    'each returned run must be sorted with a matching checksum',
  )

  assert.equal(aggregate.totalItems, state.dataset.totalItems)
  assert.equal(aggregate.chunkCount, state.tasks.length)
  assert.equal(aggregate.uniqueValues, baseline.uniqueValues)
  assert.equal(aggregate.checksum, baseline.checksum)
  assert.equal(aggregate.min, baseline.min)
  assert.equal(aggregate.max, baseline.max)
  assert.equal(aggregate.median, baseline.median)
  assert.equal(aggregate.sorted, true)
  assert.equal(aggregate.checksumVerified, true)
  assert.equal(aggregate.sortedSample.length, Math.min(48, state.dataset.totalItems))
  assert.ok(aggregate.histogram.length > 0)
  assert.equal(state.master.status, 'completed')
  assert.equal(state.aggregationMerged, state.mergeGroups.length)
  assert.ok(state.mergeGroups.every((group) => group.status === 'merged'))
  assert.equal(
    state.workers.reduce((sum, worker) => sum + worker.itemsProcessed, 0),
    state.dataset.totalItems,
    'worker item totals must add up to the full array',
  )
  assert.equal(state.completedTick, state.tick)
  assert.equal(state.running, false)
}

function verifyRun(name, dataset, patch = {}, expectations = {}) {
  const first = run(dataset, patch)
  const { state, phases, seenWorkerStatuses, seenTaskStatuses } = first

  check(`${name}: completes the eight phases in order`, () => {
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
  })

  check(`${name}: all worker and chunk states are observable`, () => {
    assert.ok(seenWorkerStatuses.has('registered'))
    assert.ok(seenWorkerStatuses.has('receiving'))
    assert.ok(seenWorkerStatuses.has('processing'))
    assert.ok(seenWorkerStatuses.has('merging'))
    assert.ok(seenWorkerStatuses.has('returning'))
    assert.ok(seenWorkerStatuses.has('completed'))
    assert.ok(seenTaskStatuses.has('queued'))
    assert.ok(seenTaskStatuses.has('assigned'))
    assert.ok(seenTaskStatuses.has('processing'))
    assert.ok(seenTaskStatuses.has('returned'))
    assert.ok(seenTaskStatuses.has('merged'))
  })

  check(`${name}: aggregate is sorted, verified, and complete`, () => {
    assertFinalAggregate(state)
    assertProgress(state)
    assertCoverage(state)
  })

  check(`${name}: chunk decomposition matches the schedule`, () => {
    assert.equal(state.tasks.length, expectations.tasks)
    if (state.settings.schedule === 'static') {
      assert.ok(state.tasks.every((task) => task.owner !== null), 'static chunks need an owner')
    } else {
      assert.ok(state.tasks.every((task) => task.owner === null), 'dynamic chunks start unowned')
    }
  })

  check(`${name}: rerunning is deterministic`, () => {
    const second = run(dataset, patch)
    assert.equal(second.state.tick, state.tick)
    assert.equal(second.state.completedTick, state.completedTick)
    assert.deepEqual(second.state.aggregate, state.aggregate)
    assert.deepEqual(second.phases, phases)
    assert.deepEqual(
      second.state.tasks.map((task) => [task.id, task.workerId, task.startedTick, task.finishedTick]),
      state.tasks.map((task) => [task.id, task.workerId, task.startedTick, task.finishedTick]),
    )
    assert.deepEqual(
      second.state.workers.map((worker) => worker.timeline),
      state.workers.map((worker) => worker.timeline),
    )
  })

  return state
}

function checkBenchmarkParser() {
  check('benchmark: parses official columns and computes summary', () => {
    const csv = [
      'timestamp,mode,algo,dtype,size,seed,workers,total_cores,schedule,merge,chunks,repeat,t_total,t_phase1,t_tier,t_merge,throughput_Melem_s,ok,failures,requeued,recovery_max_s,detect_max_s,dataset,unknown',
      't1,seq,timsort,int32,1000000,7,,8,,,1,1,0.8,0.8,0,0,1.25,true,0,0,,,synthetic,x',
      't2,dist,timsort,int32,1000000,7,3,12,dynamic,master,12,1,0.4,0.25,0.05,0.1,2.5,true,1,1,1.2,5,synthetic,y',
      't3,dist,timsort,int32,1000000,7,6,24,dynamic,tiered,24,1,0.3,0.2,0.05,0.05,3.33,false,2,2,2.4,4,synthetic,z',
      't4,local,numpy,int32,1000000,7,,8,,,,1,0.5,0.35,0.1,0.05,2,true,0,0,,,synthetic,w',
      't5,,timsort,int32,1000000,7,,8,,,1,1,0.9,0.9,0,0,1.1,true,0,0,,,synthetic,skip',
    ].join('\n')

    const { rows, warnings } = mod.parseBenchmarkCsv(csv)
    assert.equal(rows.length, 4)
    assert.equal(warnings.length, 1)
    assert.equal(rows[0].mode, 'seq')
    assert.equal(rows[0].tTotal, 0.8)
    assert.equal(rows[0].ok, true)
    assert.equal(rows[1].workers, 3)
    assert.equal(rows[1].raw.dataset, 'synthetic')

    const summary = mod.summarizeBenchmark(rows)
    assert.equal(summary.rowCount, 4)
    assert.deepEqual(summary.modes, ['seq', 'dist', 'local'])
    assert.equal(summary.okCount, 3)
    assert.equal(summary.failCount, 1)
    assert.equal(summary.totalFailures, 3)
    assert.equal(summary.totalRequeued, 3)
    assert.equal(summary.bestThroughput, 3.33)
    assert.equal(summary.medianTTotal, 0.45)
    assert.equal(summary.maxRecoveryS, 2.4)
    assert.deepEqual(summary.scalability.map((point) => point.workers), [3, 6])
    assert.equal(summary.scalability[0].throughput, 2.5)
    assert.equal(summary.scalability[1].medianTTotal, 0.3)
    assert.equal(summary.phaseBreakdown.length, 4)
    assert.equal(summary.byMode[0].rows, 1)
    assert.equal(summary.byMode[1].rows, 2)
    assert.equal(summary.byMode[1].failures, 3)
  })

  check('benchmark: rejects CSVs without required metrics', () => {
    assert.throws(() => mod.parseBenchmarkCsv('mode,workers\nseq,3\n'), /t_total|throughput/i)
    assert.throws(() => mod.parseBenchmarkCsv('mode,t_total\ntext,abc\n'), /valid|Tidak ada/i)
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

mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)

check('settings: worker count clamps to the 3–9 range', () => {
  assert.equal(mod.normalizeSettings({ ...mod.DEFAULT_SETTINGS, workerCount: 1 }).workerCount, 3)
  assert.equal(mod.normalizeSettings({ ...mod.DEFAULT_SETTINGS, workerCount: 42 }).workerCount, 9)
  assert.equal(
    mod.normalizeSettings({ ...mod.DEFAULT_SETTINGS, chunksPerWorker: 99 }).chunksPerWorker,
    4,
  )
})

check('datasets: all presets are deterministic and distinct', () => {
  assert.equal(mod.SORTING_DATASETS.length, 3)
  for (const dataset of mod.SORTING_DATASETS) {
    assert.equal(dataset.totalItems, 8192)
    assert.equal(dataset.values.length, 8192)
    assert.equal(new Set(dataset.values).size, mod.buildBaseline(dataset.values).uniqueValues)
  }
  assert.notDeepEqual(mod.RANDOM_DATASET.values.slice(0, 30), mod.DUPLICATES_DATASET.values.slice(0, 30))
  assert.notDeepEqual(mod.RANDOM_DATASET.values.slice(0, 30), mod.NEARLY_SORTED_DATASET.values.slice(0, 30))
})

check('sorting helpers: merge result is sorted and checksum-preserving', () => {
  const sample = mod.sampleValues(mod.RANDOM_DATASET.values, 200)
  const sorted = mod.sortNumeric(sample)
  assert.equal(mod.isSorted(sorted), true)
  assert.equal(mod.checksum(sorted), mod.checksum(sample))
  assert.deepEqual(sorted, [...sample].sort((left, right) => left - right))
})

verifyRun(
  'random · 9 workers · dynamic',
  mod.RANDOM_DATASET,
  { workerCount: 9, schedule: 'dynamic', mergeMode: 'master', chunksPerWorker: 4, faultInjection: false },
  { tasks: 36 },
)

verifyRun(
  'random · 3 workers · static',
  mod.RANDOM_DATASET,
  { workerCount: 3, schedule: 'static', mergeMode: 'master', faultInjection: false },
  { tasks: 3 },
)

const tiered = verifyRun(
  'duplicates · 9 workers · tiered',
  mod.DUPLICATES_DATASET,
  { workerCount: 9, schedule: 'dynamic', mergeMode: 'tiered', chunksPerWorker: 4, faultInjection: false },
  { tasks: 36 },
)
check('tiered merge: worker-tier groups are produced', () => {
  assert.ok(tiered.aggregate.tieredMerges > 0)
  assert.ok(tiered.mergeGroups.some((group) => group.workerId !== null))
})

verifyRun(
  'nearly sorted · 9 workers · dynamic',
  mod.NEARLY_SORTED_DATASET,
  { workerCount: 9, schedule: 'dynamic', mergeMode: 'master', chunksPerWorker: 4, faultInjection: false },
  { tasks: 36 },
)

const faulted = run(mod.RANDOM_DATASET, {
  workerCount: 9,
  schedule: 'dynamic',
  mergeMode: 'master',
  chunksPerWorker: 4,
  faultInjection: true,
})
check('fault injection: worker fails, chunk is requeued, and the run still verifies', () => {
  assert.equal(faulted.state.faultsInjected, 1)
  assert.ok(faulted.state.requeued >= 1)
  assert.ok(faulted.seenWorkerStatuses.has('failed'))
  assert.ok(faulted.state.events.some((event) => event.kind === 'recovery'))
  assert.notEqual(faulted.state.recoveredAtTick, null)
  assert.ok(faulted.state.tasks.some((task) => task.retries >= 1))
  assertFinalAggregate(faulted.state)
  assertProgress(faulted.state)
  assertCoverage(faulted.state)
})

checkBenchmarkParser()

await rm(outDir, { recursive: true, force: true })
console.log(`\n${passed} checks passed.`)
