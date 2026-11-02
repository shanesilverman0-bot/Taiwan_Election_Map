# Phase 0b report: Esri basemap

## Files changed
- js/config.js (CONFIG.map tile URLs, attribution, comment) via tools/patches/phase0b_esri_basemap.py
- tools/patches/phase0b_esri_basemap.py (new)

## Commands run
- python3 -I tools/patches/phase0b_esri_basemap.py (asserts old block occurs exactly once)
- node --check js/app.js; node --check js/config.js: both pass
- curl Esri Base z8/y109/x214: HTTP 200 image/jpeg 3950 bytes
- curl Esri Reference z8/y109/x214: HTTP 200 image/png 5109 bytes

## app.js grep
No cartocdn, {s} or {r} in js/app.js or index.html. app.js only passes CONFIG.map.tileURL/labelTileURL/labelTileURL_en/tileAttribution to L.tileLayer (lines ~139-170). No app.js change needed. maxZoom left at 14.

## Open questions
- Esri has no Chinese labels: zh and en toggles both show English until a CARTO key is added (old URLs kept in a config.js comment).
- Owner may want to confirm Esri terms of use for site traffic.
- etl/validate.py not applicable (no data touched).
