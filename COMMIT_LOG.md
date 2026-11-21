# Commit Log & Workflow

## Aturan kerja permanen

Mulai 2026-11-21, setiap perubahan pada repository ini harus:

1. Dipecah menjadi **satu commit per perubahan logis** (jangan menggabungkan beberapa fitur/perbaikan sekaligus).
2. Langsung di-push ke GitHub pada branch `main` setelah commit dibuat.
3. Dicatat di file ini (`COMMIT_LOG.md`) dengan tanggal, hash commit, dan deskripsi singkat.

Untuk perubahan berikutnya, tambahkan entri baru di bagian **Riwayat perubahan**. Jika hash belum tersedia saat menulis entri, gunakan deskripsi perubahan lalu lengkapi hash setelah commit (boleh lewat commit dokumentasi terpisah).

Repository: https://github.com/dara023a/simulatorKPT.git

## Riwayat perubahan

Semua commit di bawah ini sudah di-push ke `origin/main`.

| Tanggal | Commit | Perubahan |
| --- | --- | --- |
| 2026-11-21 | `8db36be` | Menulis ulang test engine (sorting, scheduling, merge, fault tolerance, determinisme), test parser `results.csv`, dan smoke test browser untuk alur sorting. |
| 2026-11-21 | `719ce7c` | Mengubah seluruh simulator dari text analytics menjadi distributed sorting: engine deterministik, 3–9 worker, dynamic/static queue, master/tiered merge, fault recovery, visual array/core run/merge tree, serta import benchmark. |
| 2026-11-21 | `9463bc3` | Menambahkan referensi Python distributed sorting (`master_sort.py`, `worker_sort.py`, `common.py`, `prepare_dataset.py`) ke folder `python/`. |
| 2026-11-21 | `225b2bf` | Menambahkan aturan workflow commit dan file changelog permanen. |
| 2026-11-21 | `1c6fcd5` | Memperbaiki scheduler yang macet: worker `registered` kini dapat menerima task, status `returning`/`completed` terlihat minimal satu tick, dan preview agregat memakai Counter worker yang sudah kembali. |
| 2026-11-21 | `2b683ae` | Membuat urutan kata teratas independen dari locale agar hasil deterministik lintas environment. |
| 2026-11-21 | `e2f4b20` | Menonaktifkan animasi Recharts pada grafik hasil agar bar dan pie langsung dirender konsisten. |
| 2026-11-21 | `1637f17` | Mengubah layout topology menjadi master di atas + grid worker 3×3 agar zoom dan teks node lebih terbaca. |
| 2026-11-21 | `1664073` | Tombol Start Simulation dari Overview kini me-reset simulasi yang sudah selesai sebelum memutar ulang. |
| 2026-11-21 | `4a9415f` | Menstabilkan indikator fase agar tidak berkedip antara Parallel Processing dan Result Return. |
| 2026-11-21 | `8ac18b8` | Kontrol simulasi menampilkan status `Ready` sebelum tick pertama, bukan `Paused`. |
| 2026-11-21 | `a6adae2` | Memperbaiki umpan balik pemilihan dataset dan teks honesty untuk kedua korpus bawaan. |
| 2026-11-21 | `cf54f07` | Menambahkan pengecekan engine deterministik (22 check) dan smoke test browser headless, beserta lockfile dan dependency esbuild. |
| 2026-11-21 | `dc72e60` | Menambahkan README final: cara menjalankan, arsitektur, verifikasi, daftar fitur nyata vs simulasi, dan batasan. |
| 2026-11-21 | `35b913c` | Memperbarui UNFINISHED.md dengan status terkini, bug yang diperbaiki, hasil pengujian, dan sisa pekerjaan opsional. |

## Status verifikasi terakhir

- `npm run typecheck` — lulus.
- `npm run build` — lulus (hanya warning ukuran bundle).
- `npm test` — 27/27 check lulus.
- `npm run test:ui` — seluruh check browser lulus, 0 console error.
- `npm run preview` — halaman, favicon, dan asset merespons HTTP 200.

## Sisa pekerjaan

Lihat bagian **Remaining work** di `UNFINISHED.md`. Fokus utama berikutnya adalah Live Integration Mode dengan backend Python, import benchmark satu klik, upload array kustom, persistence, dan route-level code splitting.
