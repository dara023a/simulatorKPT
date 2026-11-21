# Distributed Text Analytics — Master–Worker Simulation

Interactive browser-based simulator for a Master–Worker distributed text analytics pipeline. It visualises how one master discovers workers, decomposes a document corpus into tasks, dispatches them to nine simulated workers, collects word-frequency results, and merges them into one deterministic aggregate.

This is a **Simulation Mode** demo. It does not connect to real worker machines, does not measure CPU or network usage, and is not a benchmark. All node addresses, timings, and results are simulated or computed locally from the selected corpus.

## Quick start

Requirements: Node.js 22+ (the UI check uses the built-in WebSocket client) and npm.

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
npm test            # headless simulation-engine checks (22 checks)
npm run test:ui     # real browser interaction smoke test via Chrome DevTools Protocol
```

`npm test` runs the real engine over the sample, mini, and uploaded datasets and verifies:

- the eight phases execute in order and the run terminates;
- every document is covered exactly once and every task is aggregated;
- `Returning Result`, `Completed`, `Receiving Task`, and `Processing` states occur;
- worker Counters merge additively into exactly the full-corpus baseline;
- rerunning the same dataset produces identical aggregates, timelines, and assignments;
- empty uploads are rejected.

`npm run test:ui` serves the production build, drives a headless Chromium browser, and verifies start/play/pause/step/reset, completion, results charts, node inspector payloads, dataset switching, and a clean browser console. It looks for Chrome/Edge at common paths; set `CHROME_PATH` if needed. Screenshots are written to the system temp folder.

## Stack

- React 19 + TypeScript 5.7
- Vite 7
- Tailwind CSS v4 (`@tailwindcss/vite`)
- React Flow (`@xyflow/react`) for the network topology
- Recharts 3 for result charts
- React Router 7
- Lucide React icons

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Overview, architecture summary, current session, Start Simulation |
| `/topology` | 1 master + 9 simulated workers, animated task/result links, clickable node inspector |
| `/dataset` | Dataset selection, upload, category distribution, document preview |
| `/tasks` | Task queue, per-worker load, full task table with expandable details |
| `/simulation` | Play/Pause/Step/Reset, speed control, phase strip, worker fleet, queue, event log, master summary |
| `/results` | Top-10 words, word cloud, docs per worker, task distribution, per-worker payloads, timeline |

## Simulation flow

Each tick advances a deterministic state machine (`src/engine/simulation.ts`):

1. **Initialization** — master starts with the selected corpus; workers are idle.
2. **Node Discovery** — workers register one per tick.
3. **Task Decomposition** — documents are split into fixed-size tasks.
4. **Task Distribution** — the first batch is dispatched from the master queue.
5. **Parallel Processing** — workers process tasks concurrently; simulated core counts affect task duration.
6. **Result Return** — a finished worker enters `returning` for one tick, then `completed`; its Counter and metadata are returned to the master.
7. **Result Aggregation** — the master merges worker Counters in batches of three.
8. **Completed** — the final aggregate is published and results pages switch from Preview to Simulation Result.

The scheduler keeps refilling free workers from the queue. This dynamic refill is a simulator enhancement; it is not a claim that the original course Python code performs the same dynamic load balancing.

## Data and analytics

- Built-in corpora: 240 documents / 20 categories (24 tasks) and 90 documents / 20 categories (15 tasks).
- Uploaded corpora: `.txt` or `.md`, documents separated by blank lines, capped at 250 documents. Parsing happens locally in the browser.
- Analysis: tokenization, stopword filtering, word frequency counting, unique word counting, document counting, top keywords.
- The corpus generator is seeded, and all analytics are computed from the actual local text. There is no `Math.random()` in the analysis or result path.
- Worker results are accumulated as Counters. During aggregation the master merges them additively; the final aggregate is checked against the full-corpus baseline by the automated engine test.

## Project structure

```
src/
  App.tsx, main.tsx, index.css, types.ts
  engine/
    analyzer.ts            # tokenizer, stopwords, Word Counter merge/summary
    simulation.ts          # 8-phase state machine, scheduler, aggregation
    SimulationProvider.tsx # context, interval cleanup, controls, reducer
  data/
    corpus.ts              # seeded synthetic corpus generator
    datasets.ts            # built-in datasets + local upload parser
  components/
    layout/AppShell.tsx
    ui/Primitives.tsx
    network/NetworkGraph.tsx
    network/NodeDetailPanel.tsx
    simulation/*
    charts/WordCloud.tsx
  pages/
    OverviewPage.tsx
    TopologyPage.tsx
    DatasetPage.tsx
    TasksPage.tsx
    SimulationPage.tsx
    ResultsPage.tsx
  lib/format.ts
scripts/
  check-simulation.mjs     # engine checks (bundled with esbuild)
  check-ui.mjs             # headless browser checks
  simulation-entry.ts
```

## Implemented vs simulated vs not implemented

Implemented and functional:

- All six pages, routing, responsive layout, shared simulation state.
- Master–Worker visualisation with nine simulated workers and animated links.
- 8-phase deterministic simulation with Play, Pause, Step, Reset, and 0.5×/1×/2×/4× speed.
- Deterministic dynamic task queue and batch aggregation.
- Real local text analytics for the selected/generated/uploaded corpus.
- Dataset upload with validation, dataset switching, previews, and charts.
- Automated engine and browser UI checks.

Simulated, not real infrastructure:

- The nine workers, their hostnames, `10.20.0.x` IP addresses, core counts, and timings.
- UDP discovery on port 9999 and TCP transfer on port 9998 are described in the UI but no sockets are opened.
- Simulated seconds per tick are a presentation clock, not wall-clock or benchmark measurements.

Not implemented:

- Live Integration Mode with a real Python FastAPI/WebSocket backend.
- Automatic download of the real 20 Newsgroups corpus through scikit-learn.
- Triggerable worker-failure scenarios (the `failed` state exists in the UI type model but is not emitted).
- State persistence in localStorage or URL.
- Adaptation of the lecturer's `master.py` / `worker.py`.

## Python reference code

The original `master.py` and `worker.py` referenced in the project brief are **not present in this repository**, so they were not modified. The simulator is inspired by the same architecture:

- master discovery and task dispatch;
- worker task reception and local multiprocessing;
- JSON-style result payloads returned to the master.

When the reference files are provided, put them in `python/master.py` and `python/worker.py`. Read them first, keep the UDP discovery / TCP server and multiprocessing mechanisms where possible, replace prime-number work with the text-analysis functions, and add a separate Live Mode API rather than mixing it into the simulation engine.

## Notes and limitations

- Results must remain deterministic. Do not add random values to scheduling, assignment, or analytics.
- One tick is 0.7 simulated seconds; speed changes only the browser interval, not the simulated result.
- Selecting a dataset resets the simulation intentionally so all pages stay consistent.
- The production bundle warns about a chunk over 500 kB. This comes from React Flow and Recharts and is not a build failure. Route-level code splitting can reduce it later.
- Metrics on screen are labelled Demo Data, Simulated, Preview, or Simulation Result. Nothing is presented as a real cluster benchmark.

## Troubleshooting

- **esbuild install script blocked by npm.** If Vite or `npm test` reports a missing esbuild binary, run `npm rebuild esbuild` (or approve the package with `npm approve-scripts` if your npm version asks). Verify with `node -e "console.log(require('esbuild').version)"`.
- **`npm install` gets killed on a low-memory machine.** Retry with `npm install --no-audit --no-fund`; alternatively use a package manager with lower peak memory or install on a machine with more RAM.
- **`npm run test:ui` skips.** No Chrome/Chromium/Edge executable was found. Set `CHROME_PATH` to a Chromium-based browser binary.

