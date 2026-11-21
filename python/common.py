# common.py  -- dipakai oleh master_sort.py DAN worker_sort.py
# Berisi: protokol jaringan (framing), algoritma sorting, merge, checksum.
import json
import struct
from concurrent.futures import ProcessPoolExecutor

import numpy as np

DISCOVERY_PORT = 9999
TCP_PORT = 9998

HEARTBEAT_INTERVAL = 1.0   # worker kirim heartbeat tiap 1 detik saat computing
HEARTBEAT_TIMEOUT = 5.0    # master: tidak ada data/heartbeat > 5 s  -> worker dianggap mati

ALGOS = ("numpy", "timsort", "mergesort")

# ----------------------------------------------------------------------------
# PROTOKOL FRAMING
#   [4 byte: panjang header][header JSON][payload biner sepanjang header["payload_len"]]
# Pengganti recv(65536) pada kode referensi, yang tidak sanggup membawa data besar.
# ----------------------------------------------------------------------------
_HDR = struct.Struct("!I")
_MAX_HEADER = 1 << 20


def _as_bytes_view(payload):
    if payload is None:
        return b""
    if isinstance(payload, np.ndarray):
        if payload.nbytes == 0:
            return b""
        return memoryview(np.ascontiguousarray(payload)).cast("B")
    return memoryview(payload).cast("B")


def send_frame(sock, header, payload=None, lock=None):
    body = _as_bytes_view(payload)
    header = dict(header)
    header["payload_len"] = len(body)
    hb = json.dumps(header).encode("utf-8")
    pre = _HDR.pack(len(hb)) + hb
    if lock is None:
        sock.sendall(pre)
        if len(body):
            sock.sendall(body)
    else:
        with lock:
            sock.sendall(pre)
            if len(body):
                sock.sendall(body)


def recv_exact(sock, n):
    buf = bytearray(n)
    view = memoryview(buf)
    got = 0
    while got < n:
        r = sock.recv_into(view[got:], n - got)
        if r == 0:
            raise ConnectionError("koneksi ditutup oleh peer")
        got += r
    return buf


def recv_frame(sock):
    (hlen,) = _HDR.unpack(recv_exact(sock, _HDR.size))
    if hlen <= 0 or hlen > _MAX_HEADER:
        raise ValueError(f"panjang header tidak valid: {hlen}")
    header = json.loads(bytes(recv_exact(sock, hlen)).decode("utf-8"))
    plen = int(header.get("payload_len", 0))
    payload = recv_exact(sock, plen) if plen else bytearray()
    return header, payload


# ----------------------------------------------------------------------------
# ALGORITMA SORTING (satu bagian data, satu proses)
#   numpy     : np.sort (sangat cepat, C) -> cenderung communication-bound
#   timsort   : sorted() bawaan Python    -> CPU-bound, cocok demo paralelisme
#   mergesort : merge sort Python murni   -> paling berat, untuk analisis algoritma
# ----------------------------------------------------------------------------
def _py_merge_sort(a):
    n = len(a)
    if n <= 16:
        for i in range(1, n):
            x = a[i]
            j = i - 1
            while j >= 0 and a[j] > x:
                a[j + 1] = a[j]
                j -= 1
            a[j + 1] = x
        return a
    mid = n // 2
    left = _py_merge_sort(a[:mid])
    right = _py_merge_sort(a[mid:])
    out = []
    append = out.append
    i = j = 0
    nl, nr = len(left), len(right)
    while i < nl and j < nr:
        if left[i] <= right[j]:
            append(left[i])
            i += 1
        else:
            append(right[j])
            j += 1
    out.extend(left[i:])
    out.extend(right[j:])
    return out


def sort_part(args):
    """Top-level function (picklable) agar bisa dipakai ProcessPoolExecutor."""
    arr, algo = args
    if algo == "numpy":
        return np.sort(arr)
    if algo == "timsort":
        return np.array(sorted(arr.tolist()), dtype=arr.dtype)
    if algo == "mergesort":
        return np.array(_py_merge_sort(arr.tolist()), dtype=arr.dtype)
    raise ValueError(f"algoritma tidak dikenal: {algo}")


def noop(_):
    return 0


# ----------------------------------------------------------------------------
# MERGE (digabung secara vektor dengan NumPy)
# ----------------------------------------------------------------------------
def merge_two(a, b):
    """Merge dua array terurut menjadi satu array terurut (stabil)."""
    if len(a) == 0:
        return b
    if len(b) == 0:
        return a
    out = np.empty(len(a) + len(b), dtype=a.dtype)
    pos_b = np.searchsorted(a, b, side="right") + np.arange(len(b))
    mask = np.ones(len(out), dtype=bool)
    mask[pos_b] = False
    out[pos_b] = b
    out[mask] = a
    return out


def merge_many(runs):
    """k-way merge dengan pohon pairwise: O(n log k)."""
    runs = [r for r in runs if len(r)]
    if not runs:
        return np.empty(0, dtype=np.int32)
    while len(runs) > 1:
        nxt = [merge_two(runs[i], runs[i + 1]) for i in range(0, len(runs) - 1, 2)]
        if len(runs) % 2:
            nxt.append(runs[-1])
        runs = nxt
    return runs[0]


def parallel_sort_local(arr, procs, algo, pool=None):
    """Multiprocessing pada satu komputer: bagi -> sort paralel -> merge."""
    if procs <= 1:
        return sort_part((arr, algo))
    parts = np.array_split(arr, procs)
    own = pool is None
    if own:
        pool = ProcessPoolExecutor(max_workers=procs)
    try:
        runs = list(pool.map(sort_part, [(p, algo) for p in parts]))
    finally:
        if own:
            pool.shutdown()
    return merge_many(runs)


# ----------------------------------------------------------------------------
# VERIFIKASI
# ----------------------------------------------------------------------------
_MASK = (1 << 64) - 1


def checksum(arr, step=1 << 20):
    """(jumlah elemen, sum, sum kuadrat) -> mendeteksi data hilang/duplikat/rusak."""
    s1 = s2 = 0
    for i in range(0, len(arr), step):
        x = arr[i:i + step].astype(np.uint64)
        s1 = (s1 + int(x.sum(dtype=np.uint64))) & _MASK
        s2 = (s2 + int((x * x).sum(dtype=np.uint64))) & _MASK
    return len(arr), s1, s2


def is_sorted(arr, step=1 << 22):
    for i in range(0, len(arr) - 1, step):
        seg = arr[i:i + step + 1]
        if not np.all(seg[:-1] <= seg[1:]):
            return False
    return True
