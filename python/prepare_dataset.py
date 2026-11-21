# prepare_dataset.py  (dijalankan SEKALI di PC Master, bukan di Worker)
#
# Mengubah file OpenStreetMap (.osm.pbf) Indonesia dari Geofabrik menjadi array numerik .npy
# yang dipakai master_sort.py:  python master_sort.py dist --dataset osm_java_lat.npy
#
# Sumber data  : OpenStreetMap contributors, diunduh dari Geofabrik
#                https://download.geofabrik.de/asia/indonesia.html
#                (lisensi ODbL; cantumkan "(c) OpenStreetMap contributors" di laporan)
# Instalasi    : pip install osmium numpy
#
# Contoh:
#   python prepare_dataset.py --pbf java-latest.osm.pbf --key lat --out osm_java_lat.npy
#   python prepare_dataset.py --pbf java-latest.osm.pbf --key lat --limit 1000000 --out tes.npy   # uji kecil dulu
#
# --key:
#   lat : latitude  x 1e7 (int32)   <- kunci sort yang disarankan
#   lon : longitude x 1e7 (int32)
#   id  : OSM node id    (int64)
import argparse
import array
import sys
import time

import numpy as np

try:
    import osmium
except ImportError:
    sys.exit("[-] Modul osmium belum terpasang. Jalankan:  pip install osmium")


def location_xy(loc):
    """Koordinat fixed-point OSM (derajat x 1e7). Memakai .x/.y bila tersedia."""
    try:
        return loc.x, loc.y            # x = lon*1e7, y = lat*1e7
    except AttributeError:
        return int(round(loc.lon * 1e7)), int(round(loc.lat * 1e7))


def iter_nodes(path):
    """Iterasi seluruh node: kompatibel dengan pyosmium 4.x (FileProcessor) maupun 3.x (SimpleHandler)."""
    if hasattr(osmium, "FileProcessor"):
        for n in osmium.FileProcessor(path, osmium.osm.NODE):
            yield n
    else:
        buf = []

        class H(osmium.SimpleHandler):
            def node(self, n):
                buf.append((n.id, n.location, n.location.valid()))

        # SimpleHandler tidak bisa menjadi generator; kumpulkan lalu kembalikan
        H().apply_file(path)
        for nid, loc, valid in buf:
            class N:  # objek ringan
                pass
            o = N()
            o.id, o.location = nid, loc
            o.valid = valid
            yield o


def main():
    ap = argparse.ArgumentParser(description="OSM .pbf -> dataset numerik .npy")
    ap.add_argument("--pbf", required=True)
    ap.add_argument("--key", choices=["lat", "lon", "id"], default="lat")
    ap.add_argument("--out", required=True)
    ap.add_argument("--limit", type=int, default=0, help="berhenti setelah N node (0 = semua)")
    args = ap.parse_args()

    typecode = "q" if args.key == "id" else "i"
    vals = array.array(typecode)
    t0 = time.time()
    seen = 0
    for n in iter_nodes(args.pbf):
        seen += 1
        if args.key == "id":
            vals.append(int(n.id))
        else:
            loc = n.location
            try:
                if not loc.valid():
                    continue
            except (AttributeError, TypeError):
                pass
            x, y = location_xy(loc)
            vals.append(y if args.key == "lat" else x)
        if seen % 5_000_000 == 0:
            print(f"  {seen:,} node dibaca ({time.time() - t0:.0f}s)...", flush=True)
        if args.limit and len(vals) >= args.limit:
            break

    arr = np.frombuffer(vals, dtype=np.int64 if args.key == "id" else np.int32).copy()
    np.save(args.out, arr)
    print(f"[OK] {len(arr):,} nilai ({args.key}) disimpan ke {args.out} "
          f"({arr.nbytes / 1048576:.0f} MB) dalam {time.time() - t0:.0f}s")
    print(f"     min={arr.min()} max={arr.max()}")


if __name__ == "__main__":
    main()
