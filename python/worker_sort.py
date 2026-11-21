# worker_sort.py  (jalankan di setiap PC Worker)
#   python worker_sort.py
#   python worker_sort.py --slowdown 3          # simulasi worker lambat (uji load balancing)
#   python worker_sort.py --crash-after 2       # simulasi crash saat task ke-2 (uji fault tolerance)
import argparse
import json
import os
import socket
import threading
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np

from common import (DISCOVERY_PORT, TCP_PORT, HEARTBEAT_INTERVAL, merge_many,
                    noop, recv_frame, send_frame, sort_part)

try:
    import psutil
except ImportError:  # psutil opsional
    psutil = None


def rss_tree_mb():
    """Memori (RSS) proses worker + seluruh child process, dalam MB."""
    if psutil is None:
        return None
    try:
        p = psutil.Process()
        total = p.memory_info().rss
        for c in p.children(recursive=True):
            try:
                total += c.memory_info().rss
            except Exception:
                pass
        return total / 1048576
    except Exception:
        return None


class Context:
    def __init__(self, args):
        self.procs = args.procs or os.cpu_count() or 2
        self.port = args.port
        self.slowdown = max(1.0, args.slowdown)
        self.crash_after = args.crash_after
        self.crash_delay = args.crash_delay
        self.pool = ProcessPoolExecutor(max_workers=self.procs)
        self.compute_lock = threading.Lock()
        self.task_no = 0

    def info(self):
        return {"host": socket.gethostname(), "cores": self.procs,
                "port": self.port, "status": "ready"}


def udp_discovery_responder(ctx):
    """Menjawab broadcast discovery dari Master (UDP 9999)."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind(("", DISCOVERY_PORT))
            while True:
                try:
                    data, addr = s.recvfrom(1024)
                    if data == b"DISCOVER_WORKERS":
                        s.sendto(json.dumps(ctx.info()).encode("utf-8"), addr)
                except Exception:
                    pass
    except OSError as e:
        print(f"[!] UDP discovery tidak aktif ({e}); master tetap bisa memakai TCP sweep / --hosts")


def heartbeat_loop(conn, lock, stop, cpu_samples, mem_samples):
    if psutil:
        psutil.cpu_percent(None)  # prime
    while not stop.wait(HEARTBEAT_INTERVAL):
        cpu = psutil.cpu_percent(None) if psutil else None
        mem = rss_tree_mb()
        if cpu is not None:
            cpu_samples.append(cpu)
        if mem is not None:
            mem_samples.append(mem)
        try:
            send_frame(conn, {"type": "heartbeat", "cpu": cpu, "mem_mb": mem}, lock=lock)
        except Exception:
            return


def do_sort(ctx, arr, algo):
    """Bagi chunk ke seluruh core -> sort paralel -> merge lokal."""
    if ctx.procs <= 1 or len(arr) < 50_000:
        return sort_part((arr, algo))
    parts = np.array_split(arr, ctx.procs)
    futs = [ctx.pool.submit(sort_part, (p, algo)) for p in parts]
    return merge_many([f.result() for f in futs])


def handle_connection(conn, addr, ctx):
    with conn:
        conn.settimeout(30)
        try:
            hdr, payload = recv_frame(conn)
        except Exception:
            return

        action = hdr.get("action")
        if action == "info":
            try:
                send_frame(conn, dict(ctx.info(), type="info"))
            except Exception:
                pass
            return

        task_id = hdr.get("task_id", "?")
        send_lock = threading.Lock()
        stop = threading.Event()
        cpu_samples, mem_samples = [], []
        hb = None
        try:
            if action not in ("sort", "merge"):
                raise ValueError(f"action tidak dikenal: {action}")
            algo = hdr.get("algo", "timsort")
            arr = np.frombuffer(payload, dtype=np.dtype(hdr["dtype"]))

            with ctx.compute_lock:
                ctx.task_no += 1
                no = ctx.task_no
                print(f"[+] TASK {task_id} ({action}) dari {addr[0]} | "
                      f"{len(arr):,} elemen | {ctx.procs} proses | algo={algo}")

                if ctx.crash_after and no == ctx.crash_after:
                    print(f"[!!] SIMULASI CRASH: proses akan mati dalam {ctx.crash_delay}s "
                          f"(t={time.strftime('%H:%M:%S')})")
                    threading.Timer(ctx.crash_delay, lambda: os._exit(1)).start()

                hb = threading.Thread(target=heartbeat_loop,
                                      args=(conn, send_lock, stop, cpu_samples, mem_samples),
                                      daemon=True)
                hb.start()

                t0 = time.perf_counter()
                if action == "sort":
                    out = do_sort(ctx, arr, algo)
                else:
                    lengths = hdr["lengths"]
                    runs, off = [], 0
                    for n in lengths:
                        runs.append(arr[off:off + n])
                        off += n
                    out = merge_many(runs)
                dur = time.perf_counter() - t0
                if psutil:  # sampel terakhir (task pendek mungkin belum sempat kena heartbeat)
                    cpu_samples.append(psutil.cpu_percent(None))
                    m = rss_tree_mb()
                    if m is not None:
                        mem_samples.append(m)

                if ctx.slowdown > 1.0:  # simulasi node lambat (heartbeat tetap berjalan)
                    time.sleep(dur * (ctx.slowdown - 1.0))

            stop.set()
            hb.join()
            result = {
                "type": "result", "task_id": task_id, "dtype": str(out.dtype),
                "count": int(len(out)), "compute_time": dur,
                "cores_used": ctx.procs, "host": socket.gethostname(),
                "cpu_avg": (sum(cpu_samples) / len(cpu_samples)) if cpu_samples else None,
                "mem_peak_mb": max(mem_samples) if mem_samples else rss_tree_mb(),
            }
            send_frame(conn, result, out, lock=send_lock)
            print(f"[OK] TASK {task_id} selesai | compute={dur:.2f}s")
        except Exception as e:
            stop.set()
            print(f"[-] TASK {task_id} gagal: {e}")
            try:
                send_frame(conn, {"type": "error", "task_id": task_id, "error": str(e)},
                           lock=send_lock)
            except Exception:
                pass


def main():
    ap = argparse.ArgumentParser(description="Worker node Distributed Sorting")
    ap.add_argument("--port", type=int, default=TCP_PORT)
    ap.add_argument("--procs", type=int, default=0, help="jumlah proses (default: semua core)")
    ap.add_argument("--slowdown", type=float, default=1.0,
                    help="faktor perlambatan (3 = 3x lebih lambat) untuk uji load balancing")
    ap.add_argument("--crash-after", type=int, default=0,
                    help="matikan worker saat task ke-N untuk uji fault tolerance")
    ap.add_argument("--crash-delay", type=float, default=1.5)
    args = ap.parse_args()

    ctx = Context(args)
    list(ctx.pool.map(noop, range(ctx.procs)))  # warm-up pool agar task pertama tidak lebih lambat

    threading.Thread(target=udp_discovery_responder, args=(ctx,), daemon=True).start()

    print("=" * 62)
    print("      WORKER NODE - DISTRIBUTED SORTING")
    print("=" * 62)
    print(f"[*] Hostname : {socket.gethostname()}")
    print(f"[*] Proses   : {ctx.procs} (multiprocessing)")
    print(f"[*] Port TCP : {ctx.port} | Port UDP discovery: {DISCOVERY_PORT}")
    if ctx.slowdown > 1:
        print(f"[*] MODE UJI : slowdown x{ctx.slowdown}")
    if ctx.crash_after:
        print(f"[*] MODE UJI : crash pada task ke-{ctx.crash_after}")
    print("=" * 62)

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as srv:
        srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        srv.bind(("", ctx.port))
        srv.listen(16)
        while True:
            conn, addr = srv.accept()
            conn.setsockopt(socket.IPPROTO_TCP, socket.TCP_NODELAY, 1)
            threading.Thread(target=handle_connection, args=(conn, addr, ctx),
                             daemon=True).start()


if __name__ == "__main__":
    main()
