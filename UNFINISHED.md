# Status — Distributed Text Analytics Simulator

This document is the continuation log for the Master–Worker simulator. The previous pass was stopped before dependencies or runtime could be verified. That work is now complete and verified; this file records what was fixed and what remains optional.

## Current status

- **Dependencies: resolved.** `npm install --no-audit --no-fund` succeeds in this environment. `package-lock.json` now exists and `node_modules` is installed.
- **Typecheck: passes.** `npm run typecheck`.
- **Production build: passes.** `npm run build` (Vite 7, 2038 modules, `dist/` generated).
- **Preview server: verified.** `npm run preview` serves the app, favicon, and assets with HTTP 200.
- **Engine tests: 22/22 pass.** `npm test` (`scripts/check-simulation.mjs`).
- **Browser UI tests: all pass, zero console errors.** `npm run test:ui` (`scripts/check-ui.mjs`), using headless Chrome via CDP.
- **README: written.** Setup, architecture, feature matrix, limitations, testing instructions.

## Critical bugs found and fixed

1. **Scheduler deadlock (blocker).** After discovery, workers had status `registered`, but `assignQueuedTasks` only accepted `idle`/`completed`. No task was ever dispatched, so the simulation stayed in `processing` forever. Registered workers are now eligible.
2. **Result-return state was invisible.** A worker was set to `returning` and then to `completed` in the same tick, so the amber result animation, `Returning Result` badge, and phase strip stage never appeared. A worker now stays in `returning` for one tick, then enters `completed` for one tick before accepting re-dispatch.
3. **Results bar chart rendered empty groups.** Recharts bar animation could leave an empty first frame in headless/automated rendering. Bar and pie animations are now disabled so charts render deterministically.
4. **Topology was unreadably small.** A single vertical worker column forced fit-zoom down to roughly 0.45. The graph now uses a master at top plus a 3×3 worker grid, which increases zoom and readability.
5. **Preview aggregate was inaccurate.** `getAggregatePreview` only used `masterFrequencies`, which is populated late. It now merges all worker Counters already returned, so master-summary previews match the note text.
6. **Locale-dependent ordering.** Top-word tie-breaking used `localeCompare`; it now uses a locale-independent comparison for cross-environment determinism.
7. **Start Simulation after completion did nothing.** Overview now resets the completed state before playing again.

Smaller fixes: dataset-honesty copy covers both built-in corpora, choosing a dataset clears the upload success message, and the controls show `Ready` instead of `Paused` before the first tick.

## Testing added

- `scripts/check-simulation.mjs` bundles the real engine with esbuild and checks:
  phase order, completion, all tasks aggregated, queue drain, observable `receiving`/`processing`/`returning`/`completed` states, aggregate equal to the corpus baseline, additive worker Counter merge, exact document coverage, deterministic reruns, and empty-upload rejection. It runs on the sample, mini, and uploaded datasets.
- `scripts/check-ui.mjs` starts `vite preview`, launches headless Chrome/Edge via the DevTools Protocol, and checks:
  Overview → Start Simulation, 4× run to completion, all tasks and counters returned, result labels/charts, worker inspector payload, Reset, Step semantics, Play/Pause, dataset switching, and no console errors. Screenshots go to the OS temp folder. Set `CHROME_PATH` if the browser is not at a default path.

## Remaining work (optional / future)

1. **Lecturer Python reference.** `master.py` and `worker.py` are still not in the repository, so no adaptation was possible. If provided, place them under `python/`, preserve UDP discovery (9999), TCP task serving (9998), and multiprocessing, then add a separate Live Integration backend. Do not claim Live Mode works until it is implemented and tested.
2. **Real 20 Newsgroups loader.** The built-in corpora are generated simulations inspired by the category list, not the actual 18,846-document archive. Loading real data requires a backend or a bundled offline extract.
3. **Worker failure scenarios.** The `failed` status exists in the type/badge model but is never emitted. A deterministic failure mode would need careful aggregate semantics.
4. **Persistence.** Simulation state is in memory only; reloading resets it.
5. **Bundle size.** The main bundle is ~981 kB (295 kB gzip) because of React Flow + Recharts. The build warns about the 500 kB threshold; route-level `lazy()` splitting can address it.
6. **More component-level tests.** The current UI test is end-to-end smoke coverage, not unit coverage of every component state.

## Design/logic notes for future agents

- **Results must remain deterministic.** Do not add `Math.random()` to analysis, scheduling, or aggregation. The corpus uses a seeded PRNG.
- The full-corpus baseline is computed at reset. After completion, `state.aggregate` must equal `state.baseline` (counts, unique words, top words); the engine test enforces this.
- Workers accumulate Counters when tasks finish. The master merges workers during aggregation in batches of three.
- A registered worker is schedulable. A completed worker waits one tick before re-dispatch so `Completed` is visible.
- If there are fewer tasks than workers, remaining workers stay registered and are still merged with empty Counters.
- One tick is 0.7 simulated seconds. Speed only changes the wall-clock interval.
- Step is disabled while running or completed; Play is disabled after completion.
- Selecting/uploading a dataset intentionally resets the simulation.
- Never claim real workers, real UDP/TCP, real CPU usage, or benchmark numbers.

## Files to read first

1. `README.md`
2. `src/types.ts`
3. `src/engine/simulation.ts`
4. `src/engine/SimulationProvider.tsx`
5. `src/pages/SimulationPage.tsx`
6. `src/components/network/NetworkGraph.tsx`
7. `scripts/check-simulation.mjs` and `scripts/check-ui.mjs`

## Git

Previous work was committed locally. No push was made to `origin` (https://github.com/dara023a/simulatorKPT.git). `node_modules`, `dist`, and `package-lock.json` are not committed by default; the lockfile should now be available for reproducible installs if the team chooses to commit it.
