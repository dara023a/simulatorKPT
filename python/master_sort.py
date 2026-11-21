# master_sort.py  (jalankan di PC Master)
#
#   python master_sort.py seq   --size 10m
#   python master_sort.py local --size 10m --procs 1,2,4,8
#   python master_sort.py dist  --size 10m                      # auto-discovery
#   python master_sort.py dist  --size 10m --hosts 192.168.1.11,192.168.1.12
#   python master_sort.py dist  --size 10m --schedule static    # tanpa load balancing dinamis
#   python master_sort.py dist  --size 10m --merge tiered       # merge bertingkat di worker
#   python master_sort.py bench --suite scalability --workers-list 1,2,4,6,9 --repeat 3
#   python master_sort.py bench --suite schedule
#   python master_sort.py bench --suite merge
#   python master_sort.py bench --suite granularity --cpw-list 1,2,4,8,16
#   python master_sort.py dist  --dataset osm_java_lat.npy --timeout 2   # dataset publik + timeout failure detector
import argparse
import copy
import csv
import json
import os
import socket
import statistics
import threading
import time
from collections import deque
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from datetime import datetime

import numpy as np

from common import (ALGOS, DISCOVERY_PORT, HEARTBEAT_TIMEOUT, TCP_PORT, checksum,
                    is_sorted, merge_many, noop, parallel_sort_local, recv_frame,
                    send_frame, sort_part)

try:
    import psutil
except ImportError:
    psutil = None

HB_TIMEOUT = HEARTBEAT_TIMEOUT   # dapat diubah lewat --timeout (uji false positive/recovery speed)
CONNECT_TIMEOUT = 3.0      # batas waktu connect ke worker
SEND_TIMEOUT = 60.0        # batas waktu kirim payload besar
TASK_DEADLINE = 900.0      # batas total satu task (jaga-jaga worker "hang" tapi heartbeat hidup)
REJOIN_INTERVAL = 1.0      # worker mati dicoba dihubungi lagi tiap 1 detik
ALL_DEAD_GRACE = 30.0      # semua worker mati > 30 s -> job dibatalkan

CSV_FIELDS = ["timestamp", "mode", "algo", "dtype", "size", "seed", "workers", "total_cores",
              "schedule", "merge", "chunks", "repeat", "t_total", "t_phase1", "t_tier",
              "t_merge", "throughput_Melem_s", "ok", "failures", "requeued",
              "recovery_max_s", "detect_max_s", "imbalance", "idle_pct", "cpu_master_avg",
              "mem_master_peak_mb", "cpu_worker_avg", "mem_worker_peak_mb",
              "sent_mb", "recv_mb", "dataset", "timeout_s", "cpw"]


# =============================================================================
# UTILITAS
# =============================================================================
def parse_size(s):
    s = str(s).lower().replace("_", "").replace(",", "")
    mult = {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}
    if s[-1] in mult:
        return int(float(s[:-1]) * mult[s[-1]])
    return int(s)


def parse_int_list(s):
    return [int(x) for x in str(s).replace(" ", "").split(",") if x]


def make_dataset(n, dtype, seed):
    rng = np.random.default_rng(seed)           # NumPy Generator (PCG64), reproducible
    hi = 2**31 - 1 if dtype == "int32" else 2**62
    return rng.integers(0, hi, size=n, dtype=dtype)


def load_dataset(path, column, n, shuffle, seed):
    """Muat dataset publik (hasil prepare_dataset.py atau file CSV/Parquet) menjadi array 1-D numerik."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".npy":
        arr = np.load(path, mmap_mode="r")
    elif ext in (".csv", ".parquet"):
        if not column:
            raise SystemExit("[-] File CSV/Parquet butuh --column NAMA_KOLOM")
        try:
            import pandas as pd
        except ImportError:
            raise SystemExit("[-] pandas belum terpasang: pip install pandas pyarrow")
        df = (pd.read_parquet(path, columns=[column]) if ext == ".parquet"
              else pd.read_csv(path, usecols=[column]))
        arr = df[column].dropna().to_numpy()
    else:
        raise SystemExit(f"[-] Format dataset tidak didukung: {ext} (pakai .npy, .csv, .parquet)")
    if arr.ndim != 1:
        raise SystemExit("[-] Dataset harus 1 dimensi")
    if arr.dtype.kind == "f":      # float -> int64 (skala 1e6) agar bisa disortir dan dijumlah checksum
        arr = np.round(np.asarray(arr, dtype=np.float64) * 1e6).astype(np.int64)
    elif arr.dtype.kind not in "iu":
        raise SystemExit(f"[-] dtype dataset tidak didukung: {arr.dtype}")
    if n and n > len(arr):
        raise SystemExit(f"[-] --size {n:,} melebihi isi dataset ({len(arr):,} elemen)")
    if n:
        arr = arr[:n]
    arr = np.ascontiguousarray(arr)
    if arr.dtype.kind == "u":
        arr = arr.astype(np.int64)
    if shuffle:                      # hilangkan keteraturan urutan asli (mis. urut ID)
        arr = np.random.default_rng(seed).permutation(arr)
    return arr


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def fmt(x, f=".3f"):
    return "-" if x is None else format(x, f)


class Monitor(threading.Thread):
    """Sampling CPU (system-wide) dan memori proses Master selama eksperimen."""

    def __init__(self):
        super().__init__(daemon=True)
        self.stop_evt = threading.Event()
        self.cpu, self.rss_peak = [], 0.0

    def run(self):
        if psutil is None:
            return
        proc = psutil.Process()
        psutil.cpu_percent(None)
        while not self.stop_evt.wait(0.5):
            self.cpu.append(psutil.cpu_percent(None))
            try:
                self.rss_peak = max(self.rss_peak, proc.memory_info().rss / 1048576)
            except Exception:
                pass

    def finish(self):
        self.stop_evt.set()
        self.join(timeout=2)
        avg = sum(self.cpu) / len(self.cpu) if self.cpu else None
        return avg, (self.rss_peak or None)


# =============================================================================
# DISCOVERY  (UDP broadcast + TCP sweep, seperti kode referensi)
# =============================================================================
class Worker:
    def __init__(self, info):
        self.host = info.get("host", "worker")
        self.ip = info["ip"]
        self.port = int(info.get("port", TCP_PORT))
        self.cores = int(info.get("cores", 1))
        self.alive = True
        self.dead_since = None

    @property
    def key(self):
        return f"{self.ip}:{self.port}"

    def label(self):
        return f"{self.host}@{self.key}"


def probe(ip, port, timeout=0.5):
    """Tanya info worker via TCP (juga dipakai untuk mendeteksi worker yang kembali hidup)."""
    try:
        with socket.create_connection((ip, port), timeout=timeout) as s:
            s.settimeout(max(timeout, 1.0))
            send_frame(s, {"action": "info"})
            hdr, _ = recv_frame(s)
            hdr["ip"] = ip
            hdr["port"] = port
            return hdr
    except Exception:
        return None


def get_local_subnets():
    ips = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            ips.append(s.getsockname()[0])
    except Exception:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith(("127.", "169.254.")) and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    subnets = []
    for ip in ips:
        parts = ip.split(".")
        if len(parts) == 4:
            prefix = ".".join(parts[:3])
            if prefix not in [x[0] for x in subnets]:
                subnets.append((prefix, f"{prefix}.255", ip))
    return subnets or [("192.168.0", "192.168.0.255", "127.0.0.1")]


def discover_workers(timeout=1.5):
    found = {}
    subnets = get_local_subnets()
    print(f"[*] IP Master terdeteksi: {', '.join(s[2] for s in subnets)}")

    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.settimeout(0.2)
        for b in ["255.255.255.255"] + [x[1] for x in subnets]:
            try:
                s.sendto(b"DISCOVER_WORKERS", (b, DISCOVERY_PORT))
            except Exception:
                pass
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                data, addr = s.recvfrom(4096)
                info = json.loads(data.decode("utf-8"))
                info["ip"] = addr[0]
                found[(addr[0], int(info.get("port", TCP_PORT)))] = info
            except socket.timeout:
                continue
            except Exception:
                pass

    targets = [f"{p}.{i}" for p, _, my in subnets for i in range(1, 255) if f"{p}.{i}" != my]
    targets = [t for t in targets if (t, TCP_PORT) not in found]
    with ThreadPoolExecutor(max_workers=100) as ex:
        for info in ex.map(lambda ip: probe(ip, TCP_PORT, 0.3), targets):
            if info:
                found[(info["ip"], info["port"])] = info
    return list(found.values())


def get_workers(args):
    if args.hosts:
        infos = []
        for h in args.hosts.split(","):
            h = h.strip()
            ip, _, port = h.partition(":")
            port = int(port) if port else TCP_PORT
            info = probe(ip, port, 2.0)
            if info:
                infos.append(info)
            else:
                print(f"[-] {h} tidak merespons, dilewati")
    else:
        print("[*] Memindai Worker di jaringan LAN (UDP broadcast + TCP sweep)...")
        infos = discover_workers()
    ws = [Worker(i) for i in infos]
    ws.sort(key=lambda w: (tuple(int(x) for x in w.ip.split(".")), w.port))
    return ws


# =============================================================================
# SCHEDULER: pull-based dynamic / static + heartbeat + requeue + rejoin
# =============================================================================
def new_stats():
    return {"tasks": 0, "busy": 0.0, "compute": 0.0, "sent": 0, "recv": 0,
            "last_finish": 0.0, "cpu": [], "mem": 0.0, "failures": 0}


def exchange(w, task, algo):
    """Kirim satu task, baca heartbeat/hasil. Return (status, header, array, error).
    status: ok | worker_down | task_error"""
    try:
        with socket.create_connection((w.ip, w.port), timeout=CONNECT_TIMEOUT) as s:
            s.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            if task["kind"] == "sort":
                payload = task["array"]
                hdr = {"action": "sort"}
                expected = len(payload)
            else:
                runs = task["runs"]
                payload = np.concatenate(runs)
                hdr = {"action": "merge", "lengths": [len(r) for r in runs]}
                expected = len(payload)
            hdr.update(task_id=task["id"], algo=algo, dtype=str(payload.dtype))

            s.settimeout(SEND_TIMEOUT)
            send_frame(s, hdr, payload)
            task["sent_bytes"] = payload.nbytes

            s.settimeout(HB_TIMEOUT)             # tidak ada heartbeat/data > timeout -> mati
            deadline = time.time() + TASK_DEADLINE
            while True:
                h, p = recv_frame(s)
                typ = h.get("type")
                if typ == "heartbeat":
                    if time.time() > deadline:
                        raise TimeoutError("melewati TASK_DEADLINE")
                    continue
                if typ == "error":
                    return "task_error", h, None, h.get("error", "error di worker")
                if typ == "result":
                    out = np.frombuffer(p, dtype=np.dtype(h["dtype"]))
                    if h.get("task_id") != task["id"] or len(out) != expected:
                        return "task_error", h, None, "hasil tidak cocok (task_id/jumlah elemen)"
                    return "ok", h, out, None
                return "task_error", h, None, f"pesan tidak dikenal: {typ}"
    except (OSError, ConnectionError, ValueError, json.JSONDecodeError, TimeoutError) as e:
        return "worker_down", None, None, f"{type(e).__name__}: {e}"


class Runner:
    def __init__(self, workers, algo, max_retries=3, verbose=True):
        self.workers = workers
        self.algo = algo
        self.max_retries = max_retries
        self.log = print if verbose else (lambda *a, **k: None)
        self.stats = {w.key: new_stats() for w in workers}
        self.recoveries, self.detects = [], []
        self.n_failures = 0
        self.n_requeued = 0
        self.fail_first = {}

    # ---------------------------------------------------------------- run
    def run(self, tasks, label="SORT"):
        self.cond = threading.Condition()
        self.pending = deque()
        self.own = {w.key: deque() for w in self.workers}
        for t in tasks:
            (self.own[t["owner"]] if t.get("owner") in self.own else self.pending).append(t)
        self.remaining = len(tasks)
        self.results = {}
        self.abort = None
        self.t0 = time.perf_counter()
        self.label = label

        threads = [threading.Thread(target=self._loop, args=(w,), daemon=True)
                   for w in self.workers]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        wall = time.perf_counter() - self.t0
        if self.abort:
            raise RuntimeError(self.abort)
        return self.results, wall

    def _loop(self, w):
        while True:
            with self.cond:
                if self.remaining <= 0 or self.abort:
                    return
                task = None
                if w.alive:
                    if self.own[w.key]:
                        task = self.own[w.key].popleft()
                    elif self.pending:
                        task = self.pending.popleft()
                    else:
                        self.cond.wait(0.2)
                        continue
            if task is None:                         # worker mati -> coba bergabung lagi
                if probe(w.ip, w.port, 1.0):
                    with self.cond:
                        w.alive, w.dead_since = True, None
                    self.log(f"[REJOIN] {w.label()} aktif kembali dan bergabung ke cluster")
                    continue
                self._check_all_dead()
                time.sleep(REJOIN_INTERVAL)
                continue
            self._execute(w, task)

    def _check_all_dead(self):
        with self.cond:
            if self.abort or any(x.alive for x in self.workers):
                return
            newest = max(x.dead_since or 0 for x in self.workers)
            if time.time() - newest > ALL_DEAD_GRACE:
                self.abort = (f"Semua worker mati > {ALL_DEAD_GRACE:.0f}s, "
                              f"{self.remaining} task belum selesai.")
                self.cond.notify_all()

    def _execute(self, w, task):
        st = self.stats[w.key]
        size = len(task["array"]) if task["kind"] == "sort" else sum(len(r) for r in task["runs"])
        self.log(f"[DISPATCH] {task['id']} -> {w.label()} ({size:,} elemen)")
        t_disp = time.perf_counter()
        status, h, out, err = exchange(w, task, self.algo)
        t_done = time.perf_counter()
        rtt = t_done - t_disp

        with self.cond:
            if status == "ok":
                if task["id"] not in self.results:          # cegah hasil ganda
                    self.results[task["id"]] = out
                    self.remaining -= 1
                st["tasks"] += 1
                st["busy"] += rtt
                st["compute"] += h.get("compute_time", 0.0)
                st["sent"] += task.get("sent_bytes", 0)
                st["recv"] += out.nbytes
                st["last_finish"] = t_done - self.t0
                if h.get("cpu_avg") is not None:
                    st["cpu"].append(h["cpu_avg"])
                if h.get("mem_peak_mb"):
                    st["mem"] = max(st["mem"], h["mem_peak_mb"])
                msg = (f"[OK] {task['id']} <- {w.label()} | rtt={rtt:.2f}s "
                       f"compute={h.get('compute_time', 0):.2f}s")
                if task["id"] in self.fail_first:
                    rec = time.perf_counter() - self.fail_first[task["id"]]
                    self.recoveries.append(rec)
                    msg += f" | RECOVERED dalam {rec:.2f}s sejak kegagalan terdeteksi"
                self.log(msg)
            else:
                self.n_failures += 1
                st["failures"] += 1
                self.fail_first.setdefault(task["id"], time.perf_counter())
                if status == "worker_down":
                    w.alive, w.dead_since = False, time.time()
                    self.detects.append(rtt)
                    self.log(f"[DOWN] {w.label()} terdeteksi mati setelah {rtt:.2f}s "
                             f"({err}) -> requeue {task['id']}")
                    while self.own[w.key]:                    # tugas statis worker ini -> pool bersama
                        self.pending.appendleft(self.own[w.key].pop())
                else:
                    self.log(f"[TASK-ERROR] {task['id']} di {w.label()}: {err}")
                task["retry"] += 1
                if task["retry"] > self.max_retries:
                    self.abort = f"Task {task['id']} gagal > {self.max_retries} kali: {err}"
                else:
                    self.n_requeued += 1
                    self.pending.appendleft(task)
                    self.log(f"[REQUEUE] {task['id']} percobaan {task['retry']}/{self.max_retries}")
            self.cond.notify_all()


# =============================================================================
# EKSEKUSI DISTRIBUTED
# =============================================================================
def build_sort_tasks(data, workers, schedule, cpw):
    n = len(data)
    tasks = []
    if schedule == "static":
        # Pembagian tetap di awal, proporsional dengan jumlah core (tanpa pull dinamis).
        total_cores = sum(w.cores for w in workers)
        start = 0
        for i, w in enumerate(workers):
            end = n if i == len(workers) - 1 else start + int(n * w.cores / total_cores)
            tasks.append({"id": f"S{i:04d}", "kind": "sort", "array": data[start:end],
                          "owner": w.key, "retry": 0})
            start = end
    else:
        n_chunks = max(1, len(workers) * cpw)
        size = max(100_000, -(-n // n_chunks))
        start, i = 0, 0
        while start < n:
            end = min(start + size, n)
            tasks.append({"id": f"S{i:04d}", "kind": "sort", "array": data[start:end],
                          "owner": None, "retry": 0})
            start, i = end, i + 1
    return tasks


def run_dist(data, workers, ref_ck, algo, schedule, merge, cpw, max_retries, verbose):
    for w in workers:
        w.alive, w.dead_since = True, None
    runner = Runner(workers, algo, max_retries, verbose)
    mon = Monitor()
    mon.start()
    t_all = time.perf_counter()

    tasks = build_sort_tasks(data, workers, schedule, cpw)
    res1, t_p1 = runner.run(tasks, "SORT")
    snap1 = copy.deepcopy(runner.stats)
    runs = [res1[t["id"]] for t in tasks]

    t_tier = 0.0
    if merge == "tiered" and len(runs) > len(workers):
        k = len(workers)
        per = -(-len(runs) // k)
        groups = [runs[i:i + per] for i in range(0, len(runs), per)]
        mtasks = [{"id": f"M{i:04d}", "kind": "merge", "runs": g, "owner": None, "retry": 0}
                  for i, g in enumerate(groups)]
        res2, t_tier = runner.run(mtasks, "MERGE")
        runs = [res2[t["id"]] for t in mtasks]

    t_m0 = time.perf_counter()
    final = merge_many(runs)                       # merge terakhir di Master (bagian serial)
    t_merge = time.perf_counter() - t_m0
    total = time.perf_counter() - t_all
    cpu_m, mem_m = mon.finish()

    ok = is_sorted(final) and checksum(final) == ref_ck

    busy = [snap1[w.key]["busy"] for w in workers]
    mean_busy = sum(busy) / len(busy) if busy else 0
    imbalance = (max(busy) / mean_busy) if mean_busy else None
    idle_pct = (100 * sum(max(0.0, t_p1 - b) for b in busy) / (t_p1 * len(busy))) if t_p1 else None
    cpu_w = [c for s in runner.stats.values() for c in s["cpu"]]
    mem_w = [s["mem"] for s in runner.stats.values() if s["mem"]]

    rec = {
        "mode": "dist", "workers": len(workers), "total_cores": sum(w.cores for w in workers),
        "schedule": schedule, "merge": merge, "chunks": len(tasks), "cpw": cpw,
        "t_total": total, "t_phase1": t_p1, "t_tier": t_tier, "t_merge": t_merge,
        "ok": ok, "failures": runner.n_failures, "requeued": runner.n_requeued,
        "recovery_max_s": max(runner.recoveries) if runner.recoveries else None,
        "detect_max_s": max(runner.detects) if runner.detects else None,
        "imbalance": imbalance, "idle_pct": idle_pct,
        "cpu_master_avg": cpu_m, "mem_master_peak_mb": mem_m,
        "cpu_worker_avg": (sum(cpu_w) / len(cpu_w)) if cpu_w else None,
        "mem_worker_peak_mb": max(mem_w) if mem_w else None,
        "sent_mb": sum(s["sent"] for s in runner.stats.values()) / 1048576,
        "recv_mb": sum(s["recv"] for s in runner.stats.values()) / 1048576,
    }
    return rec, snap1, t_p1


# =============================================================================
# OUTPUT
# =============================================================================
def print_dist_summary(rec, snap1, t_p1, workers, n):
    print("\n" + "=" * 70)
    print("   HASIL DISTRIBUTED SORTING")
    print("=" * 70)
    print(f"  Konfigurasi : {rec['workers']} worker ({rec['total_cores']} core) | "
          f"schedule={rec['schedule']} | merge={rec['merge']} | chunk={rec['chunks']}")
    print("  Per worker (fase sort):")
    print(f"    {'worker':<34}{'task':>5}{'busy(s)':>9}{'compute':>9}{'selesai@':>10}{'CPU%':>7}")
    for w in workers:
        s = snap1[w.key]
        cpu = sum(s["cpu"]) / len(s["cpu"]) if s["cpu"] else None
        print(f"    {w.label():<34}{s['tasks']:>5}{s['busy']:>9.2f}{s['compute']:>9.2f}"
              f"{s['last_finish']:>10.2f}{fmt(cpu, '.0f'):>7}")
    print("-" * 70)
    print(f"  Fase sort+transfer   : {t_p1:.3f} s")
    if rec["merge"] == "tiered":
        print(f"  Fase merge di worker : {rec['t_tier']:.3f} s")
    print(f"  Merge akhir (Master) : {rec['t_merge']:.3f} s  <- bagian serial (Amdahl)")
    print(f"  TOTAL EXECUTION TIME : {rec['t_total']:.3f} s")
    print(f"  Throughput           : {n / rec['t_total'] / 1e6:.2f} juta elemen/detik")
    print(f"  Data dikirim/diterima: {rec['sent_mb']:.0f} MB / {rec['recv_mb']:.0f} MB")
    print(f"  Imbalance (max/mean) : {fmt(rec['imbalance'], '.2f')}   (1.00 = seimbang) | "
          f"idle rata-rata {fmt(rec['idle_pct'], '.1f')}%")
    print(f"  CPU Master / Worker  : {fmt(rec['cpu_master_avg'], '.0f')}% / "
          f"{fmt(rec['cpu_worker_avg'], '.0f')}%   | Mem Master puncak "
          f"{fmt(rec['mem_master_peak_mb'], '.0f')} MB")
    if rec["failures"]:
        print(f"  FAULT TOLERANCE      : {rec['failures']} kegagalan, {rec['requeued']} task di-requeue, "
              f"deteksi maks {fmt(rec['detect_max_s'], '.2f')}s, "
              f"recovery maks {fmt(rec['recovery_max_s'], '.2f')}s")
    print(f"  VERIFIKASI           : {'LULUS (terurut, jumlah & checksum sama)' if rec['ok'] else '*** GAGAL ***'}")
    print("=" * 70)


def write_csv(path, rec, args, idx):
    if not path:
        return
    row = {k: "" for k in CSV_FIELDS}
    row.update(rec)
    row.update(timestamp=datetime.now().isoformat(timespec="seconds"), algo=args.algo,
               dtype=args.dtype, size=args.n, seed=args.seed, repeat=idx,
               dataset=args.dataset_name, timeout_s=HB_TIMEOUT)
    if rec.get("t_total"):
        row["throughput_Melem_s"] = round(args.n / rec["t_total"] / 1e6, 4)
    new = not os.path.exists(path)
    with open(path, "a", newline="") as f:
        wr = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        if new:
            wr.writeheader()
        wr.writerow(row)


# =============================================================================
# MODE: seq / local / dist / bench
# =============================================================================
def cmd_seq(args, data, ref_ck):
    print(f"[SEQUENTIAL] 1 proses | algo={args.algo} | N={args.n:,}")
    times = []
    for r in range(args.repeat):
        mon = Monitor(); mon.start()
        t0 = time.perf_counter()
        out = sort_part((data, args.algo))
        t = time.perf_counter() - t0
        cpu, mem = mon.finish()
        ok = is_sorted(out) and checksum(out) == ref_ck
        times.append(t)
        print(f"  run {r + 1}: {t:.3f}s | ok={ok}")
        write_csv(args.csv, {"mode": "seq", "workers": 0, "t_total": t, "ok": ok,
                             "cpu_master_avg": cpu, "mem_master_peak_mb": mem}, args, r + 1)
    print(f"[SEQUENTIAL] median = {statistics.median(times):.3f}s")
    return statistics.median(times)


def cmd_local(args, data, ref_ck):
    print(f"[LOCAL PARALLEL] multiprocessing satu komputer | algo={args.algo} | N={args.n:,}")
    base = None
    for p in parse_int_list(args.procs):
        times = []
        with ProcessPoolExecutor(max_workers=p) as pool:
            list(pool.map(noop, range(p)))            # warm-up pool (di luar pengukuran)
            for r in range(args.repeat):
                mon = Monitor(); mon.start()
                t0 = time.perf_counter()
                out = parallel_sort_local(data, p, args.algo, pool)
                t = time.perf_counter() - t0
                cpu, mem = mon.finish()
                ok = is_sorted(out) and checksum(out) == ref_ck
                times.append(t)
                write_csv(args.csv, {"mode": "local", "workers": p, "t_total": t, "ok": ok,
                                     "cpu_master_avg": cpu, "mem_master_peak_mb": mem}, args, r + 1)
        m = statistics.median(times)
        base = base or m
        print(f"  p={p:<3} T={m:8.3f}s | S={base / m:5.2f} | E={base / m / p:5.2f} | ok={ok}")


def cmd_dist(args, data, ref_ck):
    ws = get_workers(args)
    if not ws:
        print("[-] Tidak ada worker. Jalankan worker_sort.py di PC worker, atau pakai --hosts.")
        return
    if args.workers:
        ws = ws[:args.workers]
    print(f"\n[+] {len(ws)} worker dipakai:")
    for i, w in enumerate(ws):
        print(f"   [{i}] {w.label():<40} {w.cores} core")
    for r in range(args.repeat):
        print(f"\n--- RUN {r + 1}/{args.repeat} ---")
        rec, snap1, t_p1 = run_dist(data, ws, ref_ck, args.algo, args.schedule, args.merge,
                                    args.chunks_per_worker, args.max_retries, True)
        print_dist_summary(rec, snap1, t_p1, ws, args.n)
        if args.seq_time:
            s = args.seq_time / rec["t_total"]
            print(f"  Speedup vs sequential ({args.seq_time:.2f}s): {s:.2f}x | "
                  f"Efficiency (S/worker): {s / len(ws):.2f}")
        write_csv(args.csv, rec, args, r + 1)


def one_run(data, ws, ref_ck, args, schedule, merge, cpw=None):
    rec, _, _ = run_dist(data, ws, ref_ck, args.algo, schedule, merge,
                         cpw or args.chunks_per_worker, args.max_retries, False)
    return rec


def cmd_bench(args, data, ref_ck):
    ws_all = get_workers(args)
    if not ws_all:
        print("[-] Tidak ada worker.")
        return
    print(f"[+] {len(ws_all)} worker tersedia | suite={args.suite} | repeat={args.repeat}")
    idx = 0

    def collect(ws, schedule, merge, cpw=None):
        nonlocal idx
        recs = []
        for r in range(args.repeat):
            rec = one_run(data, ws, ref_ck, args, schedule, merge, cpw)
            idx += 1
            write_csv(args.csv, rec, args, r + 1)
            recs.append(rec)
            print(f"    run {r + 1}: {rec['t_total']:.3f}s ok={rec['ok']}")
        return recs

    if args.suite == "scalability":
        seq_t = None
        if not args.skip_seq:
            print("\n[baseline] sequential di Master ...")
            seq_t = cmd_seq(args, data, ref_ck)
        rows = []
        for W in parse_int_list(args.workers_list):
            if W > len(ws_all):
                print(f"[!] Lewati W={W}: hanya {len(ws_all)} worker tersedia")
                continue
            print(f"\n[scalability] W={W}")
            recs = collect(ws_all[:W], "dynamic", args.merge)
            rows.append((W, sum(w.cores for w in ws_all[:W]), recs))
        t1 = next((med([r["t_total"] for r in recs]) for W, _, recs in rows if W == 1), None)
        print("\n" + "=" * 92)
        print(f"{'W':>3}{'core':>6}{'T(s)':>9}{'S vs seq':>10}{'S vs 1W':>9}{'Eff':>7}"
              f"{'Mjuta/s':>9}{'merge%':>8}{'CPU-w%':>8}{'imb':>6}{'ok':>5}")
        print("-" * 92)
        for W, cores, recs in rows:
            T = med([r["t_total"] for r in recs])
            s_seq = (seq_t / T) if seq_t else None
            s1 = (t1 / T) if t1 else None
            eff = (s1 / W) if s1 else None
            mp = 100 * med([r["t_merge"] for r in recs]) / T
            print(f"{W:>3}{cores:>6}{T:>9.3f}{fmt(s_seq, '.2f'):>10}{fmt(s1, '.2f'):>9}"
                  f"{fmt(eff, '.2f'):>7}{args.n / T / 1e6:>9.2f}{mp:>8.1f}"
                  f"{fmt(med([r['cpu_worker_avg'] for r in recs]), '.0f'):>8}"
                  f"{fmt(med([r['imbalance'] for r in recs]), '.2f'):>6}"
                  f"{'Y' if all(r['ok'] for r in recs) else 'N':>5}")
        print("=" * 92)
        print("S vs seq = T_seq / T(W) | S vs 1W = T(1 worker)/T(W) | Eff = (S vs 1W)/W | "
              "merge% = porsi merge serial di Master")

    elif args.suite == "schedule":
        ws = ws_all[:args.workers] if args.workers else ws_all
        print(f"\n[load balancing] {len(ws)} worker: STATIC vs DYNAMIC")
        print("Tip: jalankan salah satu worker dengan --slowdown 3 agar perbedaannya terlihat.")
        out = {}
        for sch in ("static", "dynamic"):
            print(f"  -> {sch}")
            out[sch] = collect(ws, sch, args.merge)
        print("\n" + "=" * 66)
        print(f"{'schedule':<10}{'T(s)':>9}{'imbalance':>11}{'idle%':>8}{'chunk':>7}{'ok':>5}")
        for sch, recs in out.items():
            print(f"{sch:<10}{med([r['t_total'] for r in recs]):>9.3f}"
                  f"{fmt(med([r['imbalance'] for r in recs]), '.2f'):>11}"
                  f"{fmt(med([r['idle_pct'] for r in recs]), '.1f'):>8}"
                  f"{recs[0]['chunks']:>7}{'Y' if all(r['ok'] for r in recs) else 'N':>5}")
        print("=" * 66)

    elif args.suite == "granularity":
        ws = ws_all[:args.workers] if args.workers else ws_all
        print(f"\n[granularity] {len(ws)} worker: chunk per worker = {args.cpw_list}")
        out = {}
        for c in parse_int_list(args.cpw_list):
            print(f"  -> {c} chunk/worker")
            out[c] = collect(ws, "dynamic", args.merge, c)
        print("\n" + "=" * 78)
        print(f"{'chunk/w':>8}{'chunk':>7}{'T(s)':>9}{'fase1':>9}{'merge@M':>9}"
              f"{'imbalance':>11}{'idle%':>8}{'sent MB':>9}{'ok':>5}")
        for c, recs in out.items():
            print(f"{c:>8}{recs[0]['chunks']:>7}{med([r['t_total'] for r in recs]):>9.3f}"
                  f"{med([r['t_phase1'] for r in recs]):>9.3f}"
                  f"{med([r['t_merge'] for r in recs]):>9.3f}"
                  f"{fmt(med([r['imbalance'] for r in recs]), '.2f'):>11}"
                  f"{fmt(med([r['idle_pct'] for r in recs]), '.1f'):>8}"
                  f"{med([r['sent_mb'] for r in recs]):>9.0f}"
                  f"{'Y' if all(r['ok'] for r in recs) else 'N':>5}")
        print("=" * 78)
        print("Chunk kecil: balancing lebih baik tapi overhead scheduling/komunikasi naik; "
              "chunk besar sebaliknya (Pertemuan 3 slide 16, Pertemuan 12 slide 16).")

    elif args.suite == "merge":
        ws = ws_all[:args.workers] if args.workers else ws_all
        print(f"\n[merge] {len(ws)} worker: merge di Master vs merge bertingkat di worker")
        out = {}
        for mg in ("master", "tiered"):
            print(f"  -> {mg}")
            out[mg] = collect(ws, "dynamic", mg)
        print("\n" + "=" * 66)
        print(f"{'merge':<10}{'T(s)':>9}{'fase1':>9}{'tier':>8}{'merge@M':>9}{'ok':>5}")
        for mg, recs in out.items():
            print(f"{mg:<10}{med([r['t_total'] for r in recs]):>9.3f}"
                  f"{med([r['t_phase1'] for r in recs]):>9.3f}"
                  f"{med([r['t_tier'] for r in recs]):>8.3f}"
                  f"{med([r['t_merge'] for r in recs]):>9.3f}"
                  f"{'Y' if all(r['ok'] for r in recs) else 'N':>5}")
        print("=" * 66)


# =============================================================================
def main():
    ap = argparse.ArgumentParser(description="Master Distributed Sorting")
    ap.add_argument("cmd", choices=["seq", "local", "dist", "bench"])
    ap.add_argument("--size", default=None,
                    help="jumlah elemen, mis. 10m, 50000000 (default: 10m data sintetis / seluruh dataset)")
    ap.add_argument("--dataset", default="",
                    help="file dataset publik (.npy hasil prepare_dataset.py, atau .csv/.parquet + --column)")
    ap.add_argument("--column", default="", help="nama kolom untuk .csv/.parquet")
    ap.add_argument("--shuffle", action="store_true", help="acak urutan dataset (seed = --seed)")
    ap.add_argument("--timeout", type=float, default=HEARTBEAT_TIMEOUT,
                    help="detik tanpa heartbeat sebelum worker dianggap mati (default 5; minimal 2)")
    ap.add_argument("--cpw-list", default="1,2,4,8,16", help="[granularity] daftar chunk per worker")
    ap.add_argument("--dtype", choices=["int32", "int64"], default="int32")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--algo", choices=ALGOS, default="timsort")
    ap.add_argument("--repeat", type=int, default=3)
    ap.add_argument("--csv", default="results.csv", help="file CSV hasil ('' = tidak menyimpan)")
    ap.add_argument("--procs", default="1,2,4,8", help="[local] daftar jumlah proses")
    ap.add_argument("--hosts", default="", help="[dist/bench] ip[:port],ip[:port],... (lewati discovery)")
    ap.add_argument("--workers", type=int, default=0, help="[dist] pakai N worker pertama")
    ap.add_argument("--schedule", choices=["dynamic", "static"], default="dynamic")
    ap.add_argument("--merge", choices=["master", "tiered"], default="master")
    ap.add_argument("--chunks-per-worker", type=int, default=4)
    ap.add_argument("--max-retries", type=int, default=3)
    ap.add_argument("--seq-time", type=float, default=0.0, help="[dist] T sequential untuk hitung speedup")
    ap.add_argument("--suite", choices=["scalability", "schedule", "merge", "granularity"], default="scalability")
    ap.add_argument("--workers-list", default="1,2,4,6,9")
    ap.add_argument("--skip-seq", action="store_true")
    args = ap.parse_args()

    global HB_TIMEOUT
    if args.timeout < 2.0:
        ap.error("--timeout minimal 2 detik (heartbeat worker dikirim tiap 1 detik)")
    HB_TIMEOUT = args.timeout
    if args.cmd == "dist" and args.repeat == 3:
        args.repeat = 1

    print("=" * 70)
    print("      DISTRIBUTED SORTING - MASTER NODE")
    print("=" * 70)
    if args.dataset:
        n_req = parse_size(args.size) if args.size else 0
        print(f"[*] Memuat dataset publik: {args.dataset} (kolom={args.column or '-'})...")
        data = load_dataset(args.dataset, args.column, n_req, args.shuffle, args.seed)
        args.n = len(data)
        args.dtype = str(data.dtype)
        args.dataset_name = os.path.basename(args.dataset)
        print(f"[*] {args.n:,} elemen {data.dtype} | min={data.min()} max={data.max()} | "
              f"unik={len(np.unique(data[:min(args.n, 2_000_000)])):,} (dari sampel 2 juta)")
    else:
        args.n = parse_size(args.size or "10m")
        args.dataset_name = f"synthetic:default_rng(seed={args.seed})"
        print(f"[*] Membangkitkan {args.n:,} {args.dtype} (NumPy default_rng, seed={args.seed})...")
        data = make_dataset(args.n, args.dtype, args.seed)
    ref_ck = checksum(data)
    print(f"[*] Dataset {data.nbytes / 1048576:.0f} MB | algo={args.algo} | timeout={HB_TIMEOUT:g}s")

    {"seq": cmd_seq, "local": cmd_local, "dist": cmd_dist, "bench": cmd_bench}[args.cmd](
        args, data, ref_ck)


if __name__ == "__main__":
    main()
