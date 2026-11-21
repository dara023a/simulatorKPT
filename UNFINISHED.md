# Status — Distributed Sorting Simulator

This is the continuation log for the Master–Worker sorting simulator.

## Current status

- **Theme conversion: complete.** The website now simulates distributed sorting instead of text analytics.
- **Typecheck: passes.** `npm run typecheck`.
- **Production build: passes.** `npm run build` (Vite production bundle generated).
- **Engine tests: 27/27 pass.** `npm test` (`scripts/check-simulation.mjs`).
- **Browser UI tests: all pass, zero console errors.** `npm run test:ui` (`scripts/check-ui.mjs`), headless Chrome/Edge via CDP.
- **Python reference: included.** Files are under `python/` and were added in commit `9463bc3`; they are not connected to the browser app.
- **README: rewritten.** Setup, pages, simulation flow, configuration, benchmark import, structure, scope, and limitations.

## What works

- Deterministic 8,192-item arrays: random, duplicates, nearly sorted.
- 3–9 configurable simulated workers.
- Dynamic pull scheduling and static core-proportional ownership.
- Per-core local runs, local merge, returned sorted chunks, master/tiered merge tree.
- Checksum and sorted-order verification.
- Deterministic fault injection, requeue, retry, recovery, and rejoin.
- Play, Pause, Step, Reset, and 0.5×/1×/2×/4× speed.
- Overview, topology, dataset, tasks, simulation, and results pages.
- Import of real `results.csv` rows from the Python reference, labelled separately as Measured.
- Engine tests and headless browser tests.

## Honest scope

- Workers, IPs, core counts, ticks, and durations are simulated fixtures.
- No UDP/TCP sockets are opened by the browser.
- The browser sorts the selected array for real, but this is not a cluster benchmark.
- `results.csv` is the only measurement data shown in the UI.
- Live Integration Mode is not implemented.
- The default preset arrays are generated synthetic data; they are not OpenStreetMap data.
- Custom integer-array upload is not implemented.

## Remaining work (optional / future)

1. **Live Integration Mode.** Connect a Python/FastAPI/WebSocket backend to the real `master_sort.py` and `worker_sort.py`. Do not claim it works until implemented and tested.
2. **Recorded benchmark dataset.** Import the sibling `results.csv` directly into a repository fixture or provide a one-click demo file so reviewers without Python can see charts immediately.
3. **Custom array upload.** Accept `.txt`/`.csv` integer arrays with validation and a size cap.
4. **Persistence.** Save settings, imported benchmark rows, and optional run history in localStorage.
5. **Bundle splitting.** Lazy-load routes and chart libraries to reduce the ~1 MB main chunk warning.
6. **More component tests.** Expand beyond the current end-to-end browser smoke test.

## Design/logic notes for future agents

- Keep results deterministic. Do not add `Math.random()` to scheduling, sorting, or analytics. Dataset generation uses a seeded PRNG.
- The baseline is computed at reset. After completion, `state.aggregate` must match the baseline checksum, unique count, min, max, and median; the engine test enforces this.
- Dynamic chunks start with `owner = null`; static chunks carry a worker owner.
- A failed worker requeues its current chunk and rejoins after a fixed recovery delay.
- Tiered merge creates worker-tier groups before the master tree.
- One tick is 0.7 simulated seconds. Speed changes only the browser interval.
- Changing settings or datasets resets the simulation intentionally.
- Never present simulated timings, IPs, or workers as real infrastructure.

## Files to read first

1. `README.md`
2. `src/types.ts`
3. `src/engine/sorting.ts`
4. `src/engine/simulation.ts`
5. `src/engine/SimulationProvider.tsx`
6. `src/pages/SimulationPage.tsx`
7. `src/engine/benchmark.ts`
8. `scripts/check-simulation.mjs` and `scripts/check-ui.mjs`

## Git

Repository: `https://github.com/dara023a/simulatorKPT.git`, branch `main`. The Python reference change (`9463bc3`) was pushed. Later sorting UI/test/documentation changes are recorded in `COMMIT_LOG.md`.
