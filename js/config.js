/**
 * ============================================================
 *  TAIWAN ELECTION MAP — CONFIGURATION
 * ============================================================
 *  Edit this file to change party colors, add election cycles,
 *  adjust map settings, or swap boundary data sources.
 * ============================================================
 *
 *  IMPORTANT BACKGROUND:
 *  Taiwan redistricted its legislative boundaries in 2019, so
 *  there are TWO different legislative district maps:
 *    • 2008, 2012, 2016 elections → 2007-drawn boundaries
 *    • 2020, 2024 elections → 2019-redrawn boundaries
 *  Key changes: Kaohsiung −1 seat, Pingtung −1, Tainan +1,
 *  Hsinchu County +1, Taichung II/VII adjusted.
 *
 *  The architecture below supports multiple topo sources per
 *  layer, with year ranges mapped to each source. Swap in
 *  better boundary files as they become available.
 * ============================================================
 */

const CONFIG = {

  /* ----------------------------------------------------------
   *  MAP DEFAULTS
   * ---------------------------------------------------------- */
  map: {
    center: [23.7, 120.96],
    zoom: 7.5,
    minZoom: 6,
    maxZoom: 14,
    tileURL: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    tileAttribution: '&copy; <a href="https://www.openstreetmap.org/">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    labelTileURL: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    labelTileURL_en: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
  },

  /* ----------------------------------------------------------
   *  TOPOJSON / GEOJSON BOUNDARY SOURCES
   *
   *  Each key here is a named boundary dataset. The `layers`
   *  section below references these by name and specifies which
   *  years use which dataset.
   *
   *  Taiwan Atlas (dkaoster) files are loaded from jsDelivr CDN.
   *  g0v/twgeojson files are loaded from GitHub raw content.
   *
   *  format: 'topojson' → needs topojson.feature() conversion
   *  format: 'geojson'  → used directly
   * ---------------------------------------------------------- */
  boundarySources: {
    // Counties — same boundaries throughout this era (2010 merge)
    counties_current: {
      url: 'https://cdn.jsdelivr.net/npm/taiwan-atlas/counties-10t.json',
      format: 'topojson',
      topoObject: 'counties',
    },

    // Towns/districts (鄉鎮市區) — boundaries have been stable since 2010 merge
    towns_current: {
      url: 'https://cdn.jsdelivr.net/npm/taiwan-atlas/towns-10t.json',
      format: 'topojson',
      topoObject: 'towns',
    },

    // Legislative districts — CURRENT boundaries (from 2019 redistricting; used 2020+)
    // Note: taiwan-atlas's districts file may reflect pre-2019 boundaries;
    // verify against CEC data when populating 2020/2024 legislative races.
    legislative_2020: {
      url: 'https://cdn.jsdelivr.net/npm/taiwan-atlas/districts-10t.json',
      format: 'topojson',
      topoObject: 'districts',
      notes: 'Post-2019 redistricting — used for 2020, 2024 elections.',
    },

    // Legislative districts — LEGACY boundaries (2007 CEC drawing; used 2008-2016)
    // Source: g0v/twgeojson. File contains boundaries valid for the
    // first three elections under the 113-seat system.
    legislative_2008: {
      url: 'https://raw.githubusercontent.com/g0v/twgeojson/master/json/twVote2010.geo.json',
      format: 'geojson',
      notes: 'Pre-2019 boundaries — used for 2008, 2012, 2016 elections.',
    },
  },

  /* ----------------------------------------------------------
   *  COUNTY CODE MAPPING
   *  Election data uses single-letter IDs (A, B, C…).
   *  Counties TopoJSON uses numeric codes (63000, 66000…).
   * ---------------------------------------------------------- */
  countyIdToCode: {
    'A': '63000',   // 臺北市 Taipei
    'B': '66000',   // 臺中市 Taichung
    'C': '10017',   // 基隆市 Keelung
    'D': '67000',   // 臺南市 Tainan
    'E': '64000',   // 高雄市 Kaohsiung
    'F': '65000',   // 新北市 New Taipei
    'G': '10002',   // 宜蘭縣 Yilan
    'H': '68000',   // 桃園市 Taoyuan
    'I': '10020',   // 嘉義市 Chiayi City
    'J': '10004',   // 新竹縣 Hsinchu County
    'K': '10005',   // 苗栗縣 Miaoli
    'M': '10008',   // 南投縣 Nantou
    'N': '10007',   // 彰化縣 Changhua
    'O': '10018',   // 新竹市 Hsinchu City
    'P': '10009',   // 雲林縣 Yunlin
    'Q': '10010',   // 嘉義縣 Chiayi County
    'T': '10013',   // 屏東縣 Pingtung
    'U': '10015',   // 花蓮縣 Hualien
    'V': '10014',   // 臺東縣 Taitung
    'W': '09020',   // 金門縣 Kinmen
    'X': '10016',   // 澎湖縣 Penghu
    'Z': '09007',   // 連江縣 Lienchiang (Matsu)
  },
  codeToCountyId: {},  // built at runtime below

  /* ----------------------------------------------------------
   *  PARTY COLORS
   * ---------------------------------------------------------- */
  parties: {
    KMT:   { color: '#0047AB', accent: '#003580', name_en: 'KMT',                   name_zh: '中國國民黨' },
    DPP:   { color: '#1B9431', accent: '#0F6B21', name_en: 'DPP',                   name_zh: '民主進步黨' },
    TPP:   { color: '#28C8C8', accent: '#1A9E9E', name_en: 'TPP',                   name_zh: '台灣民眾黨' },
    NPP:   { color: '#FBBE01', accent: '#D4A000', name_en: 'NPP',                   name_zh: '時代力量' },
    PFP:   { color: '#FF6310', accent: '#CC4F0D', name_en: 'PFP',                   name_zh: '親民黨' },
    TSP:   { color: '#C90F3B', accent: '#A00C2F', name_en: 'TSP',                   name_zh: '台灣基進' },
    NSU:   { color: '#E32F1A', accent: '#B5231A', name_en: 'NSU',                   name_zh: '非政黨聯盟' },
    TSU:   { color: '#C3A73B', accent: '#9B842D', name_en: 'TSU',                   name_zh: '台灣團結聯盟' },
    NP:    { color: '#FFD700', accent: '#CCAA00', name_en: 'New Party',             name_zh: '新黨' },
    GP:    { color: '#88B04B', accent: '#6D8C3C', name_en: 'Green Party',           name_zh: '綠黨' },
    IND:   { color: '#888888', accent: '#666666', name_en: 'Independent',           name_zh: '無黨籍' },
    OTHER: { color: '#AAAAAA', accent: '#777777', name_en: 'Other',                 name_zh: '其他' },
  },

  /* ----------------------------------------------------------
   *  LAYER DEFINITIONS
   *
   *  Each layer can use DIFFERENT boundary data for different
   *  years. The `boundaryByYear` function resolves which dataset
   *  to use for a given year.
   *
   *  idType: how feature IDs match election data keys:
   *    'countyCode' — features use numeric county codes
   *    'townCode'   — features use 8-digit town codes
   *    'districtId' — features use legislative district IDs
   * ---------------------------------------------------------- */
  layers: {
    presidential: {
      label: 'Presidential 總統',
      type: 'presidential',
      idType: 'countyCode',
      years: [2008, 2012, 2016, 2020, 2024],
      boundaryByYear: (year) => 'counties_current',
    },
    legislative: {
      label: 'Legislative 立法委員',
      type: 'legislative',
      idType: 'districtId',
      years: [2008, 2012, 2016, 2020, 2024],
      boundaryByYear: (year) => {
        // 2019 redistricting took effect for 2020+ elections
        if (year >= 2020) return 'legislative_2020';
        return 'legislative_2008';
      },
    },
    magistrate: {
      label: 'County/City Magistrate 縣市首長',
      type: 'magistrate',
      idType: 'countyCode',
      // Note: 2010-2014 had a 5-in-1 structure; 2014 onward is 9-in-1
      years: [2009, 2010, 2014, 2018, 2022, 2026],
      boundaryByYear: (year) => 'counties_current',
    },
    council: {
      label: 'City/County Council 議員',
      type: 'council',
      idType: 'townCode',
      years: [2009, 2010, 2014, 2018, 2022, 2026],
      boundaryByYear: (year) => 'towns_current',
    },
    township: {
      label: 'Township/District Chief 鄉鎮市區長',
      type: 'township_chief',
      idType: 'townCode',
      years: [2009, 2010, 2014, 2018, 2022, 2026],
      boundaryByYear: (year) => 'towns_current',
    },
  },

  /* ----------------------------------------------------------
   *  ELECTION DATA FILE PATHS
   * ---------------------------------------------------------- */
  elections: {
    presidential: {
      2008: 'data/elections/presidential_2008.json',
      2012: 'data/elections/presidential_2012.json',
      2016: 'data/elections/presidential_2016.json',
      2020: 'data/elections/presidential_2020.json',
      2024: 'data/elections/presidential_2024.json',
    },
    legislative: {
      2008: 'data/elections/legislative_2008.json',
      2012: 'data/elections/legislative_2012.json',
      2016: 'data/elections/legislative_2016.json',
      2020: 'data/elections/legislative_2020.json',
      2024: 'data/elections/legislative_2024.json',
    },
    magistrate: {
      2009: 'data/elections/magistrate_2009.json',
      2010: 'data/elections/magistrate_2010.json',  // 5-in-1 special municipalities
      2014: 'data/elections/magistrate_2014.json',
      2018: 'data/elections/magistrate_2018.json',
      2022: 'data/elections/magistrate_2022.json',
      2026: 'data/elections/magistrate_2026.json',
    },
    council: {
      2009: 'data/elections/council_2009.json',
      2010: 'data/elections/council_2010.json',
      2014: 'data/elections/council_2014.json',
      2018: 'data/elections/council_2018.json',
      2022: 'data/elections/council_2022.json',
      2026: 'data/elections/council_2026.json',
    },
    township_chief: {
      2009: 'data/elections/township_chief_2009.json',
      2010: 'data/elections/township_chief_2010.json',
      2014: 'data/elections/township_chief_2014.json',
      2018: 'data/elections/township_chief_2018.json',
      2022: 'data/elections/township_chief_2022.json',
      2026: 'data/elections/township_chief_2026.json',
    },
  },

  /* ----------------------------------------------------------
   *  POLYGON STYLE
   * ---------------------------------------------------------- */
  style: {
    default:  { weight: 1.2, color: '#444444', fillOpacity: 0.15, fillColor: '#cccccc' },
    hover:    { weight: 2.5, color: '#222222', fillOpacity: 0.35 },
    selected: { weight: 3,   color: '#000000', fillOpacity: 0.45 },
    winnerFillOpacity: 0.45,
    winnerHoverOpacity: 0.6,
  },

  /* ----------------------------------------------------------
   *  CURRENT CYCLE FLAGS
   *  These tabs get a gold-dot indicator in the UI.
   * ---------------------------------------------------------- */
  currentCycleYears: {
    magistrate: 2026,
    council: 2026,
    township_chief: 2026,
    presidential: null,
    legislative: null,
  },
};

// Build reverse county code mapping
Object.entries(CONFIG.countyIdToCode).forEach(([id, code]) => {
  CONFIG.codeToCountyId[code] = id;
});
