import sys
p = 'js/config.js'
s = open(p, encoding='utf-8').read()
BASE = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
REF = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}'
old = """    tileURL: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    labelTileURL: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    labelTileURL_en: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
"""
new = """    // CARTO basemaps now require an API key (carto.com/basemaps/apikey); switched to
    // Esri Light Gray Canvas 2026-11-02. Esri labels are English only, so the zh label
    // toggle shows English until a CARTO key is added. Old CARTO URLs, to restore:
    //   tileURL: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
    //   labelTileURL: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png'
    //   labelTileURL_en: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png'
    tileURL: '%s',
    tileAttribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    labelTileURL: '%s',
    labelTileURL_en: '%s',
""" % (BASE, REF, REF)
assert s.count(old) == 1, 'old block not found exactly once'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
print('patched')
