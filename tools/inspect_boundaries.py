#!/usr/bin/env python3
"""Audit boundary files referenced in js/config.js (remote URLs or local paths)."""
import json, re, sys, urllib.request, collections, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
cfg = (ROOT / "js" / "config.js").read_text(encoding="utf-8")
urls = re.findall(r"url:\s*'([^']+\.json)'", cfg)
print(f"boundary files in config.js: {len(urls)}")

def load(u):
    if u.startswith("http"):
        with urllib.request.urlopen(u, timeout=60) as r:
            return json.load(r)
    return json.loads((ROOT / u).read_text(encoding="utf-8"))

for u in urls:
    print("\n==", u)
    d = load(u)
    print("type:", d.get("type"), "| objects:", list(d.get("objects", {}).keys()))
    for name, obj in d.get("objects", {}).items():
        geoms = obj.get("geometries", [])
        keys = collections.Counter(k for g in geoms for k in (g.get("properties") or {}))
        print(f"  object {name}: {len(geoms)} features; property keys: {list(keys)}; top-level geometry keys: {sorted({k for g in geoms for k in g})}")
        for g in geoms[:3]:
            print("   ", g.get("id"), json.dumps(g.get("properties"), ensure_ascii=False))
        if "districts" in u and name == "districts":
            c = collections.Counter()
            for g in geoms:
                gid = str(g.get("id") or (g.get("properties") or {}).get("id", ""))
                c[gid.split("-")[0]] += 1
            print("  by county-code prefix:", dict(sorted(c.items())))
            print("  total districts:", sum(c.values()), "| features with no id:", c.get("", 0))
            for g in geoms:
                if not g.get("id"):
                    print("  id-less feature properties:", json.dumps(g.get("properties"), ensure_ascii=False))
            print("  Kaohsiung 64000 =", c.get("64000"), "| Pingtung 10013 =", c.get("10013"))
