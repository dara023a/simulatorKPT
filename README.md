# Distributed Sorting — Master–Worker Simulation

Interactive browser-based simulator for a Master–Worker distributed sorting pipeline. One master discovers 3–9 simulated workers, splits an integer array into chunks, dispatches work, workers sort their chunks in parallel per core, results return to the master, and a merge tree produces the final sorted output with checksum verification.

This is a **Simulation Mode** demo. The worker nodes, IP addresses, core counts, ticks, failures, and network links are simulated. The array sorting, local-run merging, checksum, and final verification are real computations performed in the browser on deterministic data. It is not a cluster benchmark.

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev        # http://localhost:5173
```

Production build and preview:

```bash
npm run build
npm run preview    # http://localhost:4173
```

## Verification

```bash
npm run typecheck   # TypeScript, no emit
npm test            # deterministic engine + CSV parser checks (27 checks)
npm run build       # typecheck + production bundle
npm run test:ui     # headless browser interaction check
```

`npm test` runs the real engine over all three datasets and verifies:

- the eight phases execute in order and the run terminates;
- chunk ranges cover the array exactly once;
- every local run and returned chunk is sorted with a matching checksum;
- dynamic and static schedules produce the expected chunk counts;
- master and tiered merge modes both finish with verified checksums;
- fault injection requeues a chunk, recovers the worker, and still verifies;
- rerunning the same configuration is deterministic;
- `results.csv` parsing and benchmark summaries handle official columns, warnings, and invalid input.

`npm run test:ui` serves the production build, drives headless Chrome/Edge through CDP, and checks Start Simulation, speed, completion, results charts, merge tree, node inspector, Reset, Step, Play/Pause, worker-count changes, dataset switching, benchmark import UI, and a clean console. Screenshots are written to the system temp folder. Set `CHROME_PATH` if the browser is not at a default path.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Overview, architecture, current session, Start Simulation |
| `/topology` | Master + configured workers, animated chunk/result packets, clickable inspector |
| `/dataset` | Array presets, array/histogram preview, decomposition plan, `results.csv` import |
| `/tasks` | Chunk queue, worker load, expandable chunk table with local core runs |
| `/simulation` | Controls, run configuration, phase strip, parallel sort view, worker fleet, queue, event log |
| `/results` | Sorted output, verification, charts, merge tree, worker payloads, timeline, Python benchmark analytics |

## Simulation engine

Each tick advances a deterministic state machine in `src/engine/simulation.ts`:

1. **Initialization** — master loads the selected array and computes the baseline checksum.
2. **Node Discovery** — workers register one at a time.
3. **Chunk Decomposition** — master splits the array using the selected schedule.
4. **Task Distribution** — the first batch is dispatched; dynamic mode refills free workers.
5. **Parallel Sorting** — each worker splits its chunk into local runs, sorts per simulated core, then merges locally.
6. **Result Return** — sorted runs and checksums return to the master.
7. **Merge & Verify** — master builds a merge tree (direct or tiered), then verifies sorted order and checksum.
8. **Completed** — final sorted output and analytics are published.

### Run configuration

- **Workers:** 3–9.
- **Schedule:** `dynamic` pull queue (default, 4 chunks per worker) or `static` ownership by core share.
- **Merge:** `master` (all runs merged at the master) or `tiered` (worker-tier merges first).
- **Chunks/worker:** 1–4 in dynamic mode.
- **Fault injection:** deterministic worker failure, heartbeat timeout, requeue, retry, and rejoin.

Changing configuration resets the run so all pages remain consistent.

## Datasets and benchmarks

Built-in arrays are deterministic 8,192-item integer datasets with fixed seeds:

- uniform random;
- many duplicates;
- nearly sorted.

Selecting a dataset resets the baseline and all analytics. Arrays are generated locally; they are not measured device data.

The **Dataset & Benchmarks** page can import `results.csv` produced by the Python reference. Those values are labelled **Measured** and are kept separate from the browser simulation. Recognised columns include `mode`, `algo`, `size`, `workers`, `schedule`, `merge`, `t_total`, `t_phase1`, `t_tier`, `t_merge`, `throughput_Melem_s`, `ok`, `failures`, `requeued`, `recovery_max_s`, and the remaining official `master_sort.py` fields. Unknown columns are ignored.

## Python reference

The distributed sorting reference is in [`python/`](python/README.md):

- `master_sort.py` — sequential/local/distributed modes, UDP discovery, TCP sweep, dynamic pull queue, fault handling, merge modes, benchmark CSV output.
- `worker_sort.py` — TCP task server, `ProcessPoolExecutor`, local per-core sorting and merge, heartbeat.
- `common.py` — TCP framing, sorting/merge helpers, checksum.
- `prepare_dataset.py` — optional OpenStreetMap `.osm.pbf` to `.npy` helper.

The web simulator does not launch or connect to these Python processes. Live Integration Mode is not implemented.

## Project structure

```
src/
  App.tsx, main.tsx, index.css, types.ts
  engine/
    sorting.ts             # datasets, sort/merge/checksum, local runs, merge tree
    simulation.ts          # 8-phase state machine, scheduling, faults, aggregation
    benchmark.ts           # results.csv parser and benchmark summary
    SimulationProvider.tsx # context, controls, import state, interval cleanup
  components/
    layout/AppShell.tsx
    ui/Primitives.tsx
    network/NetworkGraph.tsx
    network/NodeDetailPanel.tsx
    simulation/*           # controls, settings, phases, workers, master summary, log
    charts/                # array bars, histogram, local runs, merge tree, theme
    benchmark/             # import card, charts, table
  pages/
    OverviewPage.tsx
    TopologyPage.tsx
    DatasetPage.tsx
    TasksPage.tsx
    SimulationPage.tsx
    ResultsPage.tsx
  lib/format.ts
python/                    # Python reference implementation
scripts/
  check-simulation.mjs     # engine + benchmark parser checks
  check-ui.mjs             # headless browser checks
  simulation-entry.ts
```

## Implemented vs simulated vs not implemented

Implemented and functional:

- All six pages, routing, responsive layout, shared simulation state.
- Real browser sorting, local merging, checksum verification, and histogram computation.
- 8-phase deterministic simulation with Play, Pause, Step, Reset, and 0.5×/1×/2×/4× speed.
- Configurable workers, dynamic/static scheduling, master/tiered merge, fault injection.
- Animated topology, clickable node inspector, parallel local-run visualisation, merge tree.
- Deterministic array presets and `results.csv` benchmark import.
- Automated engine and browser UI checks.

Simulated, not real infrastructure:

- Worker nodes, hostnames, `10.20.0.x` IPs, simulated core counts, ticks, durations, and bandwidth.
- UDP discovery (9999) and TCP transfer (9998) are represented visually; the browser opens no sockets.
- Faults and recovery are deterministic simulation events.

Not implemented:

- Live Integration Mode with a Python/FastAPI/WebSocket backend.
- Real cluster execution or real CPU/network measurement in the browser.
- Persistence of simulation state in localStorage or the URL.
- Per-user custom upload of integer arrays (only the three presets are available).

## Notes and limitations

- Results must remain deterministic. Do not add `Math.random()` to scheduling, sorting, or analytics.
- One tick is 0.7 simulated seconds; speed only changes the browser interval.
- The production bundle warns about a chunk over 500 kB from React Flow and Recharts; this is not a build failure.
- Metrics are labelled Simulated, Demo Data, Preview, Simulation Result, or Measured (for imported CSV rows).
- No value on screen is presented as a real cluster benchmark.

## Troubleshooting

- **esbuild install script blocked by npm.** Run `npm rebuild esbuild` (or approve the package with `npm approve-scripts` if supported).
- **`npm install` gets killed on a low-memory machine.** Retry with `npm install --no-audit --no-fund`.
- **`npm run test:ui` skips.** No Chrome/Chromium/Edge executable was found. Set `CHROME_PATH` to a Chromium-based browser binary.
- **`results.csv` import fails.** Ensure the header includes `mode` plus at least one of `t_total` or `throughput_Melem_s`, and that data rows contain a timing or worker value.
