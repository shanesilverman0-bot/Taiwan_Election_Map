# Taiwan Election Map 臺灣選舉地圖

**The Formosa Dispatch** · 宋山明

An interactive geospatial visualization of Taiwan's elections — presidential, legislative, and all nine-in-one (九合一) local races — from 2016 to the current cycle.

---

## Quick Start

### 1. Install VS Code + Live Server

If you don't have it already:
- Install [VS Code](https://code.visualstudio.com/)
- Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel

### 2. Get the GeoJSON Boundary Files

The map needs geographic boundary files to draw Taiwan's districts. These are not included in the repo (they're large), but are freely available:

#### County/City Boundaries (for Presidential + Magistrate layers)

**Source:** Taiwan government open data — Ministry of the Interior (MOI)

1. Go to: https://data.gov.tw/dataset/7442
   - Or search for "直轄市、縣市界線" on data.gov.tw
2. Download the **GeoJSON** or **SHP** file for county/city boundaries
3. If SHP, convert to GeoJSON using [mapshaper.org](https://mapshaper.org) (drag and drop, export as GeoJSON)
4. Save as: `data/geo/counties.geojson`

**Required properties in the GeoJSON:**
- `COUNTYNAME` — Chinese name (e.g. "臺北市")
- `COUNTYCODE` — Single-letter code (e.g. "A" for Taipei)

#### Township/District Boundaries (for Council + Township Chief layers)

**Source:** Same MOI dataset

1. Go to: https://data.gov.tw/dataset/7441
   - Or search for "鄉鎮市區界線"
2. Download and convert to GeoJSON
3. Save as: `data/geo/townships.geojson`

**Required properties:**
- `TOWNNAME` — Chinese name (e.g. "大安區")
- `TOWNCODE` — Code (e.g. "A01")

#### Legislative District Boundaries

These are harder to find in clean GeoJSON. Options:

1. **Taiwan CEC (Central Election Commission):** https://www.cec.gov.tw
   - Check for 立委選區 map data
2. **Community sources:**
   - g0v (Taiwan civic tech community) may have redistricted boundaries
   - Search GitHub for "taiwan legislative district geojson"
3. **Manual creation:** Use [geojson.io](https://geojson.io) to trace districts from CEC maps

Save as: `data/geo/legislative_districts.geojson`

**Required properties:**
- `DISTRICT_NAME` — e.g. "臺北市第一選舉區"
- `DISTRICT_ID` — e.g. "TPE-1"

#### Outlying Islands

Make sure your county GeoJSON includes:
- 金門縣 Kinmen (COUNTYCODE: W)
- 連江縣 Lienchiang/Matsu (COUNTYCODE: X)
- 澎湖縣 Penghu (COUNTYCODE: V)
- 蘭嶼 Orchid Island and 綠島 Green Island (part of 臺東縣)

Most MOI datasets include these by default.

### 3. Run It

1. Open the `taiwan-election-map` folder in VS Code
2. Right-click `index.html` → **Open with Live Server**
3. The map opens in your browser at `localhost:5500` (or similar)

---

## Adding Election Data

Election data lives in `data/elections/` as JSON files. Each file covers one election type for one year.

### File Naming Convention

```
{election_type}_{year}.json

Examples:
  presidential_2024.json
  magistrate_2022.json
  legislative_2020.json
  council_2022.json
  township_chief_2022.json
```

### Data Format

Each JSON file is an object where **keys are district IDs** (matching the GeoJSON `idProperty` in config.js):

```json
{
  "_meta": {
    "election": "County/City Magistrate",
    "year": 2022,
    "date": "2022-11-26",
    "notes": "Optional notes about this dataset"
  },

  "A": {
    "name": "臺北市 Taipei City",
    "turnout": 64.5,
    "winner": {
      "name_en": "Chiang Wan-an",
      "party": "KMT"
    },
    "candidates": [
      {
        "name_en": "Chiang Wan-an",
        "name_zh": "蔣萬安",
        "party": "KMT",
        "vote_pct": 42.3,
        "votes": 575590,
        "photo": "data/photos/chiang_wanan.jpg",
        "wiki_url": "https://en.wikipedia.org/wiki/Chiang_Wan-an"
      },
      {
        "name_en": "Chen Shih-chung",
        "name_zh": "陳時中",
        "party": "DPP",
        "vote_pct": 31.9,
        "votes": 434558,
        "photo": null,
        "wiki_url": "https://en.wikipedia.org/wiki/Chen_Shih-chung_(physician)"
      }
    ]
  }
}
```

### Candidate Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name_en` | Yes | English name |
| `name_zh` | No | Chinese name (Traditional) |
| `party` | Yes | Party key from config.js: `KMT`, `DPP`, `TPP`, `NPP`, `PFP`, `TSP`, `IND`, `OTHER` |
| `vote_pct` | No | Percentage of vote (e.g. 42.3) |
| `votes` | No | Raw vote count |
| `photo` | No | Relative path to candidate photo |
| `wiki_url` | No | Link to Wikipedia biography |

### Adding a New Party

Edit `js/config.js` → `CONFIG.parties` and add a new key:

```js
NEW_PARTY: {
  color: '#FF00FF',
  accent: '#CC00CC',
  name_en: 'New Party',
  name_zh: '新黨名',
  logo: 'data/logos/new_party.png'
}
```

### Current Cycle (2026) Tracking

The `magistrate_2026.json` (and similar) files serve as tracking documents. You can:
- Add candidates as they declare
- Use `vote_pct` for polling averages before the election
- Update with actual results after election day
- The year tab will show a gold dot indicator for current-cycle files

---

## Customization Guide

### Colors

- **Party colors:** `js/config.js` → `CONFIG.parties`
- **UI theme:** `css/style.css` → `:root` CSS variables
- **Map polygon opacity:** `js/config.js` → `CONFIG.style`

### Typography

The app uses Google Fonts loaded in `index.html`:
- **Noto Serif TC** — headers, district names (supports Chinese)
- **Noto Sans TC** — body text (supports Chinese)
- **JetBrains Mono** — year tabs, status bar, data display

Change fonts in `css/style.css` → `--fd-font-display`, `--fd-font-body`, `--fd-font-mono`

### Map Tiles

Default: CartoDB Positron (light, clean, good for overlays).

To change, edit `js/config.js` → `CONFIG.map.tileURL`. Options:
- CartoDB Dark: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- OpenStreetMap: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- Stadia Alidade: `https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png`

### Adding New Election Layers

1. Add a GeoJSON file to `data/geo/`
2. Add a layer definition in `js/config.js` → `CONFIG.layers`
3. Add election file paths in `CONFIG.elections`
4. Create JSON data files in `data/elections/`

---

## Data Sources for Historical Results

### Central Election Commission (CEC)
- Website: https://www.cec.gov.tw
- Database: https://db.cec.gov.tw
- Best source for official vote counts per district

### Wikipedia
- [2024 ROC presidential election](https://en.wikipedia.org/wiki/2024_Taiwanese_presidential_election)
- [2022 local elections](https://en.wikipedia.org/wiki/2022_Taiwanese_local_elections)
- [2020 ROC presidential election](https://en.wikipedia.org/wiki/2020_Taiwanese_presidential_election)
- [2018 local elections](https://en.wikipedia.org/wiki/2018_Taiwanese_local_elections)
- [2016 ROC presidential election](https://en.wikipedia.org/wiki/2016_Taiwanese_presidential_election)

### Open Data
- https://data.gov.tw — government open data portal
- https://vote.ly.gov.tw — Legislative Yuan voting records

---

## Publishing Online

This project is ready to deploy as a static site:

### GitHub Pages (free)
1. Push the folder to a GitHub repo
2. Go to Settings → Pages → Source: main branch
3. Your map will be live at `https://yourusername.github.io/taiwan-election-map`

### Netlify (free)
1. Drag and drop the folder at https://app.netlify.com/drop
2. Live instantly with a custom URL

### Custom Domain
Both GitHub Pages and Netlify support custom domains if you want to host it under your Formosa Dispatch domain.

---

## Project Structure

```
taiwan-election-map/
├── index.html                  ← Main app (open this)
├── css/
│   └── style.css               ← All styles, CSS variables at top
├── js/
│   ├── config.js               ← Party colors, layers, file paths
│   └── app.js                  ← Application logic
├── data/
│   ├── geo/                    ← GeoJSON boundary files (you add these)
│   │   ├── counties.geojson
│   │   ├── townships.geojson
│   │   └── legislative_districts.geojson
│   ├── elections/              ← Election data JSON (one per year/type)
│   │   ├── presidential_2024.json
│   │   ├── magistrate_2022.json
│   │   ├── magistrate_2026.json   ← current cycle tracker
│   │   └── ...
│   ├── logos/                  ← Party logo images (fallback for photos)
│   └── photos/                 ← Candidate headshot images
└── README.md                   ← This file
```

---

*Built for The Formosa Dispatch · 臺灣選舉地圖 · April 2026*
