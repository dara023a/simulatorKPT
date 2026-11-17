PROJECT BRIEF: DISTRIBUTED TEXT ANALYTICS SIMULATOR

1. ROLE AND OBJECTIVE

Bertindaklah sebagai Senior Full-Stack Developer, UI/UX Designer, dan Software Architect yang berpengalaman dalam membangun aplikasi web interaktif untuk visualisasi sistem komputasi terdistribusi.

Saya ingin membangun sebuah website bernama:

Distributed Text Analytics — Master–Worker Simulation

Website ini merupakan bagian dari proyek UAS mata kuliah Komputasi Paralel dan Sistem Terdistribusi.

Tujuan utama website adalah memvisualisasikan cara kerja sistem komputasi paralel dan terdistribusi menggunakan arsitektur Master–Worker.

Website harus mampu memperlihatkan proses:

1. Dataset diterima oleh Master.
2. Master melakukan preprocessing dan membagi dataset menjadi beberapa task.
3. Task didistribusikan ke beberapa Worker.
4. Setiap Worker memproses task secara paralel.
5. Worker mengirimkan hasil pemrosesan kembali ke Master.
6. Master menggabungkan seluruh hasil.
7. Sistem menampilkan hasil akhir analisis teks.

PENTING: Website ini pada tahap pertama merupakan simulator interaktif. Tidak wajib menjalankan komputasi sungguhan pada banyak komputer atau membaca CPU usage secara real-time. Fokus utama adalah simulasi visual yang masuk akal, informatif, interaktif, dan merepresentasikan mekanisme sistem yang sebenarnya.

Jangan membuat klaim bahwa data CPU, waktu pemrosesan, atau benchmark simulasi merupakan hasil pengukuran perangkat sungguhan.

---

2. PROJECT THEME

Tema yang digunakan:

Distributed Text Analytics / Parallel Document Processing

Sistem akan menganalisis kumpulan dokumen teks menggunakan pendekatan Master–Worker.

Contoh proses analisis:

- Menghitung frekuensi kemunculan kata.
- Mengidentifikasi kata yang paling sering muncul.
- Menghitung jumlah kata unik.
- Menghitung jumlah dokumen yang diproses.
- Mengelompokkan dokumen berdasarkan kategori dataset.
- Menggabungkan hasil analisis dari seluruh Worker.

Gunakan algoritma sederhana seperti word frequency counting menggunakan Python Counter. Tidak perlu menggunakan deep learning, GPU, atau model machine learning yang berat.

Dataset

Gunakan dataset publik 20 Newsgroups sebagai dataset utama.

Karakteristik dataset:

- Sekitar 18.846 dokumen.
- Memiliki 20 kategori topik.
- Berupa kumpulan dokumen teks.
- Dapat diperoleh melalui scikit-learn.

Sumber:
https://scikit-learn.org/stable/datasets/real_world.html

Jika dataset belum tersedia, jangan membuat aplikasi gagal. Sediakan dataset sampel lokal sebagai fallback agar seluruh simulasi tetap dapat berjalan tanpa internet.

Pengguna juga sebaiknya dapat memilih dataset bawaan atau mengunggah file teks sendiri jika implementasinya memungkinkan.

---

3. EXISTING REFERENCE CODE

Saya memiliki dua file Python dari dosen:

- "master.py"
- "worker.py"

Sebelum melakukan perubahan, baca dan pahami seluruh isi kedua file tersebut.

Kedua file tersebut merupakan referensi arsitektur Master–Worker yang sudah tersedia.

Karakteristik worker.py

Implementasi saat ini memiliki:

- UDP Discovery Responder.
- Discovery port 9999.
- TCP server port 9998.
- Penerimaan task dari Master.
- Pemecahan task berdasarkan jumlah core CPU lokal.
- Multiprocessing menggunakan ProcessPoolExecutor.
- Pengiriman hasil kembali kepada Master dalam format JSON.

Karakteristik master.py

Implementasi saat ini memiliki:

- Worker discovery menggunakan UDP broadcast.
- TCP sweep sebagai mekanisme fallback.
- Registrasi Master sebagai node komputasi lokal.
- Pemilihan Worker.
- Pembagian tugas berdasarkan jumlah core CPU.
- Pengiriman task secara concurrent menggunakan ThreadPoolExecutor.
- Pengumpulan hasil dari Worker.

Instruksi adaptasi

Jangan langsung menghapus atau mengganti seluruh implementasi dosen.

Lakukan hal berikut:

1. Pahami struktur dan alur kode yang sudah ada.
2. Identifikasi fungsi yang dapat dipertahankan.
3. Identifikasi bagian yang perlu diadaptasi dari perhitungan bilangan prima menjadi analisis teks.
4. Pertahankan konsep komunikasi Master–Worker.
5. Pertahankan konsep multiprocessing pada setiap Worker.
6. Pisahkan fungsi simulasi website dari fungsi komputasi sebenarnya.
7. Jangan mengklaim fitur sudah terintegrasi jika belum benar-benar terhubung.

Catatan penting:
Pembagian tugas pada kode dosen saat ini dilakukan secara proporsional berdasarkan jumlah core di awal. Itu belum merupakan dynamic load balancing yang sesungguhnya. Jika ditampilkan dalam simulasi, jelaskan bahwa mekanisme antrean task dan pembagian ulang pekerjaan merupakan pengembangan yang direpresentasikan oleh simulator.

---

4. CORE WEBSITE CONCEPT

Website harus berfungsi sebagai Interactive Distributed Computing Simulator.

Pengguna harus bisa memahami bagaimana data bergerak dari Master menuju Worker dan kembali lagi.

Jangan menjadikan website sekadar dashboard monitoring dengan banyak kartu angka.

Inspirasi interaksi:

- Sidebar untuk memilih bagian sistem.
- Visualisasi node dan koneksi jaringan.
- Animasi perpindahan task.
- Panel informasi untuk setiap node.
- Detail proses yang sedang berjalan.
- Kontrol Play, Pause, Step, dan Reset.
- Timeline proses komputasi.
- Log aktivitas sistem.

Prioritaskan visualisasi mekanisme kerja sistem daripada dekorasi.

Pengguna harus bisa mengamati satu per satu proses komputasi yang berlangsung.

---

5. MAIN APPLICATION STRUCTURE

Buat aplikasi dengan halaman atau menu berikut.

A. Overview

Halaman utama yang memberikan gambaran sistem.

Tampilkan:

- Nama sistem.
- Deskripsi singkat.
- Arsitektur Master–Worker.
- Jumlah node dalam simulasi.
- Jumlah dokumen dalam dataset.
- Jumlah task.
- Status simulasi.

Sediakan tombol:

Start Simulation

Ketika ditekan, pengguna diarahkan ke halaman simulasi atau memulai simulasi.

B. Network Topology

Halaman ini merupakan salah satu bagian paling penting.

Buat visualisasi jaringan dengan:

- Satu Master Node.
- Minimal sembilan Worker Node.
- Koneksi antara Master dan setiap Worker.
- Indikator status setiap node.
- Animasi paket/task ketika dikirim.
- Animasi respons ketika hasil dikembalikan.

Gunakan visualisasi jaringan yang rapi dan mudah dipahami.

Contoh struktur:

MASTER
|
|---- WORKER 01
|---- WORKER 02
|---- WORKER 03
|---- WORKER 04
|---- WORKER 05
|---- WORKER 06
|---- WORKER 07
|---- WORKER 08
|---- WORKER 09

Node harus dapat diklik.

Ketika sebuah node dipilih, tampilkan detail:

- Node ID.
- Hostname.
- IP address dummy.
- Jumlah core CPU simulasi.
- Status node.
- Task yang sedang dikerjakan.
- Progress task.
- Hasil pemrosesan.
- Waktu pemrosesan simulasi.

Gunakan label yang jelas untuk membedakan:

- Master Node.
- Worker Node.
- Idle.
- Receiving Task.
- Processing.
- Returning Result.
- Completed.
- Failed.

Alamat IP yang ditampilkan harus berupa data simulasi, bukan alamat perangkat sungguhan.

C. Dataset Explorer

Buat halaman untuk melihat dataset yang akan diproses.

Tampilkan:

- Nama dataset.
- Jumlah dokumen.
- Jumlah kategori.
- Contoh dokumen.
- Jumlah kata.
- Informasi pembagian dataset.

Pengguna dapat memilih:

- Dataset sampel.
- Dataset 20 Newsgroups jika tersedia.
- File teks sendiri jika fitur upload diimplementasikan.

Sediakan preview beberapa dokumen agar pengguna memahami data yang sedang diproses.

D. Task Distribution

Halaman ini memperlihatkan bagaimana Master membagi pekerjaan.

Tampilkan:

- Total dokumen.
- Total task.
- Jumlah Worker aktif.
- Distribusi task per Worker.
- Task queue.
- Status setiap task.

Gunakan visualisasi tabel atau diagram.

Setiap task memiliki:

- Task ID.
- Rentang atau indeks dokumen.
- Jumlah dokumen.
- Worker tujuan.
- Status.
- Progress.

Simulasikan mekanisme antrean task.

Jika menggunakan dynamic load balancing, tampilkan bahwa Worker yang telah selesai dapat menerima task berikutnya dari antrean.

Jangan menggambarkan mekanisme ini sebagai implementasi aktual kode dosen apabila belum benar-benar diterapkan.

E. Simulation

Ini adalah halaman utama dan bagian paling penting dari website.

Buat visualisasi proses Master–Worker yang interaktif.

Sediakan kontrol:

- Play.
- Pause.
- Step Forward.
- Reset.
- Simulation Speed.

Simulasi harus memiliki tahapan berikut.

PHASE 1 — INITIALIZATION

Master memulai sistem.

Tampilkan:

- Master Node aktif.
- Dataset siap diproses.
- Worker masih dalam keadaan idle.

PHASE 2 — NODE DISCOVERY

Master mencari Worker yang tersedia.

Visualisasikan proses penemuan node.

Tampilkan status:

- Discovering Workers.
- Worker Found.
- Worker Registered.

PHASE 3 — TASK DECOMPOSITION

Master membaca dataset dan membaginya menjadi beberapa task.

Visualisasikan dataset yang dipecah menjadi beberapa kelompok dokumen.

Contoh:

- Task 001: Documents 1–100.
- Task 002: Documents 101–200.
- Task 003: Documents 201–300.

Jumlah dokumen dan task dapat disesuaikan dengan ukuran dataset.

PHASE 4 — TASK DISTRIBUTION

Master mengirimkan task ke Worker.

Tampilkan animasi task bergerak dari Master ke Worker.

Ketika task diterima:

- Status Worker berubah menjadi Receiving Task.
- Kemudian menjadi Processing.
- Progress bar mulai berjalan.

PHASE 5 — PARALLEL PROCESSING

Beberapa Worker memproses task secara bersamaan.

Tampilkan:

- Worker yang sedang aktif.
- Task yang sedang dikerjakan.
- Progress setiap Worker.
- Jumlah dokumen yang selesai diproses.
- Hasil sementara.

Animasi harus memperlihatkan bahwa beberapa Worker bekerja secara paralel, bukan satu per satu secara berurutan.

Setiap Worker melakukan simulasi analisis:

- Word frequency counting.
- Unique word counting.
- Document counting.
- Top keywords extraction.

PHASE 6 — RESULT RETURN

Worker mengirimkan hasil kembali ke Master.

Visualisasikan pergerakan hasil dari Worker menuju Master.

Status Worker berubah menjadi Returning Result, lalu Completed.

PHASE 7 — RESULT AGGREGATION

Master menerima hasil seluruh Worker dan menggabungkannya.

Tampilkan:

- Hasil dari setiap Worker.
- Total dokumen yang diproses.
- Total kata.
- Total kata unik.
- Frekuensi kata gabungan.
- Top keywords.

Gunakan visualisasi yang menjelaskan bahwa hasil akhir merupakan gabungan dari hasil seluruh Worker.

PHASE 8 — COMPLETED

Tampilkan bahwa seluruh proses berhasil diselesaikan.

Berikan ringkasan:

- Total dokumen.
- Total task.
- Total Worker yang berhasil.
- Jumlah kata unik.
- Top keywords.
- Durasi simulasi.

---

6. RESULTS AND ANALYTICS

Buat halaman Results untuk menampilkan hasil akhir analisis teks.

Visualisasi yang diharapkan:

1. Top 10 Most Frequent Words.
2. Word Frequency Chart.
3. Word Cloud.
4. Documents Processed per Worker.
5. Task Completion Distribution.
6. Processing Timeline.

Gunakan data hasil simulasi yang konsisten.

Jangan menggunakan angka acak yang berubah setiap kali halaman dirender.

Jika memungkinkan, sediakan detail hasil dari setiap Worker sebelum digabungkan.

Pastikan hasil agregasi secara logis sesuai dengan hasil masing-masing Worker.

---

7. SIMULATION ENGINE

Buat simulation engine yang mengatur seluruh alur simulasi.

Persyaratan:

- Memiliki state simulasi.
- Memiliki daftar node.
- Memiliki daftar task.
- Memiliki status setiap task.
- Memiliki progress setiap Worker.
- Memiliki event timeline.
- Mendukung Play, Pause, Step, dan Reset.
- Mendukung perubahan kecepatan simulasi.
- Mendukung pemilihan node untuk melihat detail.
- Tidak menggunakan setTimeout atau interval yang tidak dibersihkan sehingga menyebabkan memory leak.
- Tidak membuat animasi yang mengubah status secara tidak konsisten.

Gunakan data simulasi yang deterministik agar hasil mudah diuji dan dijelaskan ketika presentasi.

Contoh struktur status:

- idle
- discovering
- distributing
- processing
- returning
- aggregating
- completed
- failed

Simulasi harus dapat dijalankan berulang kali menggunakan tombol Reset.

---

8. USER INTERFACE AND DESIGN DIRECTION

Buat desain dengan karakteristik:

- Modern.
- Professional.
- Minimalist.
- Academic.
- Technical.
- Clean.
- Informative.
- Responsive.

Gunakan pendekatan visual seperti aplikasi developer tools atau network monitoring platform modern.

Rekomendasi warna:

- Primary: Navy / Deep Blue.
- Secondary: Blue.
- Background: Dark Navy atau Light Neutral.
- Accent: Cyan.
- Success: Green.
- Warning: Amber.
- Error: Red.

Pilih salah satu pendekatan tema yang paling konsisten. Jangan mencampur terlalu banyak warna.

Layout

Gunakan:

- Sidebar navigasi.
- Top navigation bar.
- Main content area.
- Detail panel jika diperlukan.
- Modal atau drawer untuk informasi node dan task.

Typography

Gunakan font modern dan mudah dibaca seperti Inter.

Visual Elements

Gunakan:

- Node cards.
- Network connections.
- Progress bars.
- Timeline.
- Charts.
- Tables.
- Status indicators.
- Animated data packets.

Hindari:

- Terlalu banyak gradient.
- Terlalu banyak card yang tidak diperlukan.
- Efek glow berlebihan.
- Animasi dekoratif yang tidak menjelaskan proses.
- Layout yang terlalu padat.
- Angka statistik yang tidak memiliki makna.

Prioritaskan visualisasi jaringan dan aliran data sebagai pusat perhatian.

---

9. TECHNICAL IMPLEMENTATION

Sebelum memulai implementasi:

1. Periksa seluruh struktur project.
2. Identifikasi framework dan dependency yang sudah digunakan.
3. Periksa file yang sudah tersedia.
4. Jangan mengganti framework tanpa alasan kuat.
5. Gunakan teknologi yang sudah tersedia apabila memungkinkan.

Jika project masih kosong, gunakan stack sederhana yang stabil.

Rekomendasi:

- Frontend: React + TypeScript.
- Styling: Tailwind CSS.
- Visualization: React Flow atau library visualisasi jaringan yang sesuai.
- Charts: Recharts.
- Icons: Lucide.
- Backend opsional: Python FastAPI.

Jangan menambahkan dependency yang tidak diperlukan.

Pisahkan kode menjadi beberapa bagian:

- Components.
- Pages.
- Simulation Engine.
- Data.
- Types.
- Utilities.
- Styles.

Pastikan kode mudah dikembangkan dan dipelihara.

Simulation Mode dan Live Mode

Buat pemisahan konsep:

Simulation Mode

- Menggunakan data simulasi.
- Tidak membutuhkan komputer Worker sungguhan.
- Tidak membutuhkan koneksi jaringan antarperangkat.
- Digunakan untuk demonstrasi dan presentasi.

Live Integration Mode

- Disiapkan sebagai pengembangan lanjutan.
- Nantinya dapat terhubung dengan backend Python dan Worker sungguhan.
- Jangan mengklaim sudah berfungsi jika belum diimplementasikan.

Untuk tahap pertama, prioritaskan Simulation Mode sepenuhnya.

---

10. PERFORMANCE AND RESPONSIVENESS

Website harus:

- Berjalan lancar di laptop.
- Tidak membutuhkan GPU.
- Tidak membutuhkan dataset berukuran besar untuk demo.
- Tidak menjalankan proses komputasi berat di browser.
- Memiliki fallback dataset lokal.
- Memiliki animasi yang ringan.
- Responsive untuk ukuran desktop dan tablet.
- Tidak mengalami error ketika simulasi di-reset atau dijalankan berulang kali.

Gunakan dataset simulasi berukuran kecil jika diperlukan.

---

11. EDUCATIONAL VALUE

Website bukan hanya harus terlihat menarik, tetapi juga harus membantu pengguna memahami konsep komputasi terdistribusi.

Berikan penjelasan singkat pada setiap tahapan:

- Apa yang sedang dilakukan Master?
- Mengapa task perlu dibagi?
- Apa yang dilakukan Worker?
- Bagaimana proses paralel berlangsung?
- Mengapa hasil perlu dikumpulkan kembali?
- Apa perbedaan pemrosesan paralel dan terdistribusi?

Tambahkan panel informasi atau tooltip untuk menjelaskan istilah teknis.

Gunakan bahasa yang sederhana dan tetap akurat secara teknis.

---

12. IMPORTANT LIMITATIONS AND HONESTY

Jangan:

- Mengklaim simulasi sebagai benchmark nyata.
- Menampilkan CPU usage palsu seolah berasal dari perangkat.
- Mengklaim sembilan Worker sungguhan telah terhubung jika hanya berupa node simulasi.
- Mengklaim dynamic load balancing sudah diterapkan pada backend jika hanya berupa visualisasi.
- Menggunakan angka acak yang tidak konsisten.
- Membuat fitur yang tidak berfungsi hanya demi tampilan.
- Mengubah kode dosen secara keseluruhan tanpa memahami implementasinya.

Setiap data yang berasal dari simulasi harus diberi label seperti:

- Simulated.
- Demo Data.
- Estimated.
- Simulation Result.

---

13. DEVELOPMENT WORKFLOW

Kerjakan secara bertahap.

Stage 1 — Project Inspection

- Periksa struktur project.
- Baca seluruh file yang tersedia.
- Identifikasi framework.
- Identifikasi dependency.
- Buat rencana implementasi.

Stage 2 — Architecture

- Tentukan struktur halaman.
- Tentukan komponen.
- Tentukan data model.
- Tentukan simulation state.
- Tentukan alur interaksi.

Stage 3 — UI Implementation

- Bangun layout utama.
- Buat sidebar.
- Buat overview.
- Buat network topology.
- Buat dataset explorer.
- Buat task distribution.
- Buat simulation page.
- Buat results page.

Stage 4 — Simulation Engine

- Implementasikan tahapan simulasi.
- Implementasikan task distribution.
- Implementasikan parallel processing simulation.
- Implementasikan result aggregation.
- Implementasikan Play, Pause, Step, dan Reset.

Stage 5 — Integration

- Hubungkan seluruh halaman.
- Pastikan data konsisten.
- Pastikan navigasi bekerja.
- Pastikan setiap tombol memiliki fungsi.

Stage 6 — Testing

Uji:

- Simulasi pertama kali.
- Play dan Pause.
- Step Forward.
- Reset.
- Pergantian kecepatan.
- Pemilihan node.
- Detail task.
- Hasil agregasi.
- Responsive layout.
- Tidak ada error di console.

Stage 7 — Finalization

Berikan:

- Source code lengkap.
- Struktur folder.
- Cara menjalankan aplikasi.
- Dependency yang digunakan.
- Penjelasan arsitektur.
- Penjelasan alur simulasi.
- Daftar fitur yang sudah berfungsi.
- Daftar fitur yang masih berupa simulasi.
- Rekomendasi pengembangan selanjutnya.

---

14. EXPECTED FINAL RESULT

Saya menginginkan sebuah website simulator yang ketika dibuka langsung memberikan gambaran sistem komputasi terdistribusi.

Pengguna dapat:

1. Melihat Master dan sembilan Worker.
2. Memilih dataset.
3. Melihat bagaimana Master membagi task.
4. Menekan Play untuk memulai simulasi.
5. Melihat task bergerak menuju Worker.
6. Mengamati Worker memproses dokumen secara paralel.
7. Melihat hasil kembali ke Master.
8. Mengamati proses agregasi.
9. Melihat hasil analisis teks akhir.
10. Mengulang simulasi dari awal.

Hasil akhir harus terlihat seperti produk software yang benar-benar dirancang, bukan sekadar tugas praktikum sederhana.

Prioritas utama:

1. Visualisasi interaktif yang jelas.
2. Alur Master–Worker yang akurat.
3. Simulasi yang berfungsi.
4. Desain profesional dan konsisten.
5. Struktur kode yang mudah dikembangkan.

Mulailah dengan memeriksa project dan file yang tersedia. Setelah itu, jelaskan secara singkat rencana implementasi dan lanjutkan membangun aplikasi secara bertahap.

Jangan hanya memberikan contoh kode atau tutorial. Saya menginginkan implementasi langsung pada project yang sedang dibuka.
