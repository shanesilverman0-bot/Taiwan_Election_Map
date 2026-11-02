# Phase 0: point config.js boundary URLs at vendored local copies (taiwan-atlas@2021.9.20).
import pathlib
p = pathlib.Path(__file__).resolve().parent.parent.parent / "js" / "config.js"
s = p.read_text(encoding="utf-8")
for name in ("counties", "towns", "districts"):
    old = f"'https://cdn.jsdelivr.net/npm/taiwan-atlas/{name}-10t.json'"
    new = f"'data/geo/{name}-10t.json'"
    assert s.count(old) == 1, (name, s.count(old))
    s = s.replace(old, new)
old = "loaded from jsDelivr CDN."
assert s.count(old) == 1
s = s.replace(old, "vendored in data/geo/ (taiwan-atlas@2021.9.20).")
p.write_text(s, encoding="utf-8")
