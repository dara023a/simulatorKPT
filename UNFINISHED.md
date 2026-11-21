# UNFINISHED — Distributed Text Analytics Simulator

Dokumen ini merangkum pekerjaan yang sudah dibuat, yang belum selesai, dan langkah lanjutan untuk AI agent berikutnya. Pekerjaan dihentikan atas permintaan pemilik project.

## Status singkat

- **Stage 1 (inspection): selesai.** Repo awalnya hanya berisi `CONTEXT.md` + `README.md`. Tidak ada `master.py`/`worker.py` di repo.
- **Stage 2–5 (arsitektur, UI, engine, integrasi): ditulis di source code, BELUM diverifikasi runtime.**
- **Stage 6–7 (testing, finalisasi): belum dikerjakan.**
- **BLOCKER utama:** `npm install` gagal di environment ini dengan exit code **137 (SIGKILL)**, sehingga `node_modules` parsial (91 entri) dan `package-lock.json` tidak terbentuk. `npm run build` belum pernah selesai dengan sukses.

## Stack yang dipilih

React 19 + TypeScript + Vite 7, Tailwind CSS v4 (`@tailwindcss/vite`), React Flow (`@xyflow/react`), Recharts 3, Lucide React, React Router 7. Semua sesuai rekomendasi `CONTEXT.md`.

## Yang sudah dibuat (source code)

Struktur:

```
src/
  App.tsx, main.tsx, index.css, types.ts
  engine/
    analyzer.ts            # tokenizer, stopword filter, word frequency, merge Counter
    simulation.ts          # state machine 8 fase, queue dinamis, agregasi, event log
    SimulationProvider.tsx # context + interval cleanup + play/pause/step/reset/speed
  data/
    corpus.ts              # generator korpus deterministik (seeded PRNG, 20 kategori)
    datasets.ts            # 2 dataset bawaan + parser upload .txt
  components/
    layout/AppShell.tsx
    ui/Primitives.tsx
    network/NetworkGraph.tsx       # React Flow + packet edge (SMIL animateMotion)
    network/NodeDetailPanel.tsx
    simulation/SimulationControls.tsx
    simulation/PhaseStrip.tsx
    simulation/WorkerGrid.tsx
    simulation/EventLog.tsx
    simulation/MasterSummary.tsx
    charts/WordCloud.tsx
  pages/
    OverviewPage.tsx
    TopologyPage.tsx
    DatasetPage.tsx
    TasksPage.tsx
    SimulationPage.tsx
    ResultsPage.tsx
  lib/format.ts
```

Fitur yang sudah diimplementasikan secara kode:

- Dataset simulasi deterministik 240 dokumen / 20 kategori (sample) dan 90 dokumen (mini), plus upload file lokal (dokumen dipisah baris kosong, maks 250 dokumen).
- Analisis teks nyata di browser untuk korpus lokal: word frequency, unique words, document count, top keywords, stopword filtering.
- Simulation engine 8 fase: initialization, discovery (9 worker satu per tick), decomposition, distribution, processing, result return, aggregation (3 worker per tick), completed.
- Dynamic queue simulasi: worker selesai mengambil task berikutnya dari queue (dilabeli sebagai enhancement simulator, bukan klaim kode dosen).
- Play, Pause, Step, Reset, kecepatan 0.5×/1×/2×/4×. Interval dibersihkan di `useEffect`; state deterministik; reset membangun ulang state awal.
- Network topology 1 master + 9 worker dengan IP dummy `10.20.0.1` dan `10.20.0.11–19`, edge animasi task/result, klik node untuk detail.
- Halaman: Overview, Network Topology, Dataset Explorer, Task Distribution (tabel + queue + ekspansi detail), Simulation (kontrol, phase strip, worker grid, queue, event log, master summary, inspector), Results (top-10 chart, word cloud, docs per worker, task pie, tabel per-worker, timeline Gantt).
- Label kejujuran: "Simulated", "Demo Data", "Preview", "Simulation result"; disclaimer bahwa bukan benchmark, bukan jaringan nyata, bukan CPU usage nyata.

## Yang belum selesai / perlu dikerjakan berikutnya

### 1. Blocker dependency & build (prioritas tertinggi)

`npm install` di environment ini berhenti dengan exit 137 (proses di-kill). `node_modules` parsial, tidak ada lockfile. Build/typecheck belum terverifikasi.

Langkah yang disarankan:

```bash
rm -rf node_modules package-lock.json
npm install --no-audit --no-fund
npm run build
npm run dev
```

Jika exit 137 berulang (kemungkinan OOM/limit sandbox):

- Jalankan di environment dengan memori lebih besar.
- Atau gunakan `pnpm install` / `yarn install` (lockfile baru; jangan commit `node_modules`).
- Atau kurangi dependency (Recharts/React Flow adalah yang paling berat) dan install bertahap.
- npm 11.17 di environment ini memblokir postinstall `esbuild`. Jika Vite gagal karena binary esbuild, jalankan `npm approve-scripts` atau `npm rebuild esbuild` (sesuai pesan npm), lalu cek `node -e "console.log(require('esbuild').version)"` dan build ulang.

### 2. Verifikasi TypeScript / runtime

Perbaikan terakhir yang **belum diverifikasi**:

- `src/components/layout/AppShell.tsx`: import relatif sudah diperbaiki (`../ui/Primitives`, `../../lib/format`, `../../engine/SimulationProvider`).
- `src/engine/simulation.ts`: case `'completed'` yang unreachable sudah dihapus (switch sudah early-return).
- `src/pages/TasksPage.tsx`: fragment tabel sudah memakai `<Fragment key=...>`.

Kemungkinan error yang masih muncul saat build pertama yang sukses:

- Typing `@xyflow/react` (`NodeProps`, `EdgeProps`, custom edge) — casting `data` sudah dilakukan, tetapi belum diuji compiler.
- `animateMotion` SMIL di JSX — perlu dicek apakah `@types/react` 19 menerima intrinsic element ini.
- Recharts 3 (`Pie`, `Tooltip` props) — perlu dicek typing-nya.
- `lucide-react` sebelumnya error "Could not find declaration file" karena instalasi parsial; seharusnya hilang setelah install bersih.

### 3. Testing manual (Stage 6)

Belum dijalankan sama sekali di browser:

- Simulasi pertama kali, Play/Pause, Step, Reset berulang, ganti speed.
- Klik node master & worker, cek detail dan payload.
- Cek queue dinamis: worker selesai → mengambil task berikutnya.
- Cek agregasi: total kata/unique words konsisten dengan baseline dataset; top keywords konsisten.
- Cek navigasi semua halaman dan tombol Start Simulation dari Overview.
- Cek responsive desktop/tablet, tidak ada error console, tidak ada memory leak interval.
- Cek upload `.txt` (termasuk file kosong → error message).

### 4. Referensi Python belum diadaptasi

`master.py` dan `worker.py` **tidak ada di repository**. Akibatnya:

- Adaptasi dari perhitungan bilangan prima ke analisis teks belum bisa dilakukan.
- Live Integration Mode (FastAPI/WebSocket + worker Python nyata) belum ada; jangan diklaim berfungsi.
- Bila file dosen diberikan, letakkan di repo (mis. `python/master.py`, `python/worker.py`), baca dulu, lalu adaptasi fungsi analisis teks tanpa menghapus mekanisme UDP discovery port 9999 / TCP port 9998 / multiprocessing.

### 5. Fitur opsional yang belum dibuat

- Loader dataset 20 Newsgroups asli via scikit-learn/FastAPI (saat ini hanya sample simulasi).
- Mode Live Integration dan indikator koneksi backend.
- Simulasi kegagalan worker (status `failed` sudah ada di tipe/badge, belum pernah dipicu).
- Persistensi state ke localStorage atau URL.
- Unit test / E2E test.
- Build produksi dan verifikasi `vite preview`.
- README final (cara menjalankan, arsitektur, daftar fitur nyata vs simulasi).

## Catatan desain/logika untuk agent berikutnya

- HASIL HARUS DETERMINISTIK. Jangan menambahkan `Math.random()` pada analysis/queue/hasil. Korpus memakai PRNG seeded.
- Baseline hasil dihitung dari seluruh korpus saat reset; ini dipakai untuk preview Results sebelum simulasi selesai. Setelah selesai, `state.aggregate` dipakai dan nilainya harus sama dengan baseline.
- Worker mengakumulasi Counter saat task selesai; master baru menggabungkan saat fase aggregation (batch 3 worker/tick).
- Task yang belum sempat dikerjakan jika jumlah task < jumlah worker tetap aman (worker tanpa task ikut di-merge dengan Counter kosong).
- Satu tick = 0,7 detik waktu simulasi; kecepatan hanya mengubah interval wall-clock.
- `Step` dinonaktifkan saat running/completed; `Play` dinonaktifkan saat completed.
- Upload dataset mereset simulasi (perilaku disengaja) dan tidak dikirim ke server.
- Jangan mengklaim sembilan worker nyata, UDP/TCP nyata, CPU usage nyata, atau benchmark.

## File yang perlu dibaca lebih dulu

1. `CONTEXT.md` — brief lengkap.
2. `src/types.ts` — model data.
3. `src/engine/simulation.ts` — state machine.
4. `src/engine/SimulationProvider.tsx` — kontrol dan timer.
5. `src/pages/SimulationPage.tsx` dan `src/components/network/NetworkGraph.tsx` — bagian inti visualisasi.

## Git

Pekerjaan ini di-commit **secara lokal** (sesuai permintaan). Tidak ada push ke remote `origin` (https://github.com/dara023a/simulatorKPT.git). `node_modules`, `dist`, dan `package-lock.json` tidak ikut di-commit (lockfile memang belum berhasil dibuat).
