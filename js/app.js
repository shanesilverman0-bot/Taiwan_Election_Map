/**
 * ============================================================
 *  TAIWAN ELECTION MAP — MAIN APPLICATION v2.1
 *  The Formosa Dispatch · 宋山明
 *
 *  KEY DATA-FLOW NOTES
 *  ───────────────────
 *  County-layer election files use LETTER keys ("A","B"…).
 *  Taiwan-atlas TopoJSON county feature.id values are NUMERIC
 *  codes ("63000", "66000"…).
 *
 *  buildDataLookup() converts letter→numeric so styleFeature /
 *  bindFeatureEvents can look up data by feature.id.
 *  It also stores _letterId on each entry so we can recover the
 *  original letter key for display.
 *
 *  resolveDistrictName(rawId, def) resolves ANY form of ID
 *  (letter, numeric code, or district string like "TPE-01") to
 *  a human-readable name in the current language.  This is the
 *  SINGLE display function used everywhere: map panel, table,
 *  compare results.
 * ============================================================
 */

(function () {
  'use strict';

  /* ==========================================================
   *  SHARED NAME DICTIONARIES
   * ========================================================== */
  const COUNTY_ZH = {
    A:'臺北市', B:'臺中市', C:'基隆市', D:'臺南市', E:'高雄市',
    F:'新北市', G:'宜蘭縣', H:'桃園市', I:'嘉義市', J:'新竹縣',
    K:'苗栗縣', M:'南投縣', N:'彰化縣', O:'新竹市', P:'雲林縣',
    Q:'嘉義縣', T:'屏東縣', U:'花蓮縣', V:'臺東縣', W:'金門縣',
    X:'澎湖縣', Z:'連江縣',
  };
  const COUNTY_EN = {
    A:'Taipei City',     B:'Taichung City',  C:'Keelung City',
    D:'Tainan City',     E:'Kaohsiung City', F:'New Taipei City',
    G:'Yilan County',    H:'Taoyuan City',   I:'Chiayi City',
    J:'Hsinchu County',  K:'Miaoli County',  M:'Nantou County',
    N:'Changhua County', O:'Hsinchu City',   P:'Yunlin County',
    Q:'Chiayi County',   T:'Pingtung County',U:'Hualien County',
    V:'Taitung County',  W:'Kinmen County',  X:'Penghu County',
    Z:'Lienchiang County',
  };

  /* ==========================================================
   *  STATE
   * ========================================================== */
  const state = {
    map: null, activeLayer: null, activeYear: null,
    geoLayers: {}, boundaryCache: {}, electionData: {},
    politiciansRegistry: {}, districtsRegistry: {},
    labelTileLayer: null, selectedFeature: null,
    legend: null, statusBar: null,
    fittedSources: {}, lang: 'zh',
    // UI
    activeNavTab: 'map',
    openTabs: [],        // [{id, type, title}]
    activeTabId: 'map',
    // Persistent
    notes: {},           // id → {id,title,body,updated}
    comparisons: {},     // id → {id,title,elections,metric,scope,updated}
    currentCompareId: null,
    sidebarMinimized: false,
  };

  /* ==========================================================
   *  NAME RESOLUTION  (single source of truth for all display)
   * ========================================================== */

  /**
   * Return a human-readable district name for a raw ID.
   * rawId may be:
   *   – a single letter  "A"         (county election key)
   *   – a numeric string "63000"     (TopoJSON feature.id)
   *   – a district string "TPE-01"   (legislative key)
   */
  function resolveDistrictName(rawId, def) {
    const en = state.lang === 'en';
    if (!rawId) return rawId;

    if (def && def.idType === 'countyCode') {
      // Normalise to letter
      let letter = rawId;
      if (rawId.length > 2) letter = CONFIG.codeToCountyId[rawId] || rawId;
      const zh = COUNTY_ZH[letter];
      const english = COUNTY_EN[letter];
      if (zh) return en ? (english || zh) : zh;
      return rawId;
    }

    if (def && def.idType === 'districtId') {
      const reg = state.districtsRegistry[rawId];
      if (reg) return en ? (reg.name_en || reg.name_zh) : reg.name_zh;
      return rawId;
    }

    // townCode or unknown → raw id
    return rawId;
  }

  /** Name from a GeoJSON feature object during map render. */
  function featureDisplayName(feature, def) {
    const p   = feature.properties || {};
    const fid = String(feature.id ?? '');
    const en  = state.lang === 'en';

    if (def.idType === 'countyCode') {
      // Try resolving the numeric/letter id first
      const resolved = resolveDistrictName(fid, def);
      if (resolved && resolved !== fid) return resolved;
      // Fallback: COUNTYID property is the letter (e.g. "A") in taiwan-atlas
      if (p.COUNTYID) return resolveDistrictName(p.COUNTYID, def);
      // Last resort: use property name strings directly
      return en
        ? (p.COUNTYENG || p.COUNTYNAME || p.name_en || fid)
        : (p.COUNTYNAME || p.COUNTYENG || p.name    || fid);
    }

    if (def.idType === 'districtId') {
      const key = getFeatureKey(feature);
      const reg = state.districtsRegistry[key];
      if (reg) return en ? (reg.name_en || reg.name_zh) : reg.name_zh;
    }

    return en
      ? (p.TOWNENG || p.COUNTYENG || p.name_en || p.TOWNNAME || fid)
      : (p.TOWNNAME || p.COUNTYNAME || p.name   || fid);
  }

  /* ==========================================================
   *  INIT
   * ========================================================== */
  async function init() {
    loadPersistedData();
    initMap();
    buildNavRail();
    buildSidebarControls();
    buildSidebarLayers();
    buildTableSidebar();
    buildCompareSidebar();
    buildNotesSidebar();
    buildLegend();
    buildStatusBar();
    initResizableSidebar();
    await loadRegistries();
    // Permanent tabs
    openTab({ id: 'map',     type: 'map',     title: 'Map' });
    openTab({ id: 'table',   type: 'table',   title: 'Tables' });
    openTab({ id: 'compare', type: 'compare', title: 'Compare' });
    selectTab('map');
    selectLayer('magistrate');
    renderNotesInSidebar();
    renderComparisonsInSidebar();
  }

  /* ----------------------------------------------------------  Persistence  */
  function loadPersistedData() {
    try { const n = localStorage.getItem('fd_notes');       if (n) state.notes       = JSON.parse(n); } catch(_) {}
    try { const c = localStorage.getItem('fd_comparisons'); if (c) state.comparisons = JSON.parse(c); } catch(_) {}
  }
  function saveNotes()       { try { localStorage.setItem('fd_notes',       JSON.stringify(state.notes));       } catch(_) {} }
  function saveComparisons() { try { localStorage.setItem('fd_comparisons', JSON.stringify(state.comparisons)); } catch(_) {} }

  async function loadRegistries() {
    const [r0, r1] = await Promise.allSettled([
      fetch('data/entities/politicians.json'),
      fetch('data/entities/districts.json'),
    ]);
    try { if (r0.status === 'fulfilled' && r0.value.ok) state.politiciansRegistry = await r0.value.json(); } catch(_) {}
    try { if (r1.status === 'fulfilled' && r1.value.ok) state.districtsRegistry   = await r1.value.json(); } catch(_) {}
  }

  /* ==========================================================
   *  MAP
   * ========================================================== */
  function initMap() {
    const c = CONFIG.map;
    state.map = L.map('map', {
      center: c.center, zoom: c.zoom,
      minZoom: c.minZoom, maxZoom: c.maxZoom,
      zoomControl: false, attributionControl: false,
    });
    L.tileLayer(c.tileURL, { attribution: c.tileAttribution }).addTo(state.map);
    L.control.zoom({ position: 'topright' }).addTo(state.map);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution(c.tileAttribution).addTo(state.map);
    state.labelTileLayer = L.tileLayer(c.labelTileURL, { pane: 'overlayPane' });
    buildLangToggle();
  }

  function buildLangToggle() {
    const LangCtrl = L.Control.extend({
      options: { position: 'topright' },
      onAdd() {
        const el = L.DomUtil.create('div', 'lang-toggle');
        el.innerHTML = `<button class="lang-btn active" data-lang="zh">中文</button><button class="lang-btn" data-lang="en">EN</button>`;
        L.DomEvent.disableClickPropagation(el);
        el.querySelectorAll('.lang-btn').forEach(btn => btn.addEventListener('click', () => {
          state.lang = btn.dataset.lang;
          el.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          swapLabelLayer();
          if (state.activeLayer && state.activeYear) renderLayer(state.activeLayer, state.activeYear);
        }));
        return el;
      },
    });
    new LangCtrl().addTo(state.map);
  }

  function swapLabelLayer() {
    if (state.labelTileLayer) state.map.removeLayer(state.labelTileLayer);
    state.labelTileLayer = L.tileLayer(
      state.lang === 'en' ? CONFIG.map.labelTileURL_en : CONFIG.map.labelTileURL,
      { pane: 'overlayPane' }
    );
  }

  /* ==========================================================
   *  NAV RAIL
   * ========================================================== */
  function buildNavRail() {
    document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchNavTab(btn.dataset.tab);
    }));
  }

  function switchNavTab(tabId) {
    state.activeNavTab = tabId;
    document.querySelectorAll('.tab-sidebar').forEach(s => s.classList.remove('active'));
    document.getElementById(`${tabId}-sidebar`)?.classList.add('active');
    const titles = { map:'Election Map', table:'Data Tables', compare:'Compare', notes:'Notes' };
    document.getElementById('sidebar-title').textContent = titles[tabId] || tabId;
    selectTab(tabId);
  }

  /* ==========================================================
   *  TABS
   * ========================================================== */
  function openTab(def) {
    if (state.openTabs.find(t => t.id === def.id)) return;
    state.openTabs.push(def);
    renderTabBar();
  }

  function closeTab(tabId) {
    if (['map','table','compare'].includes(tabId)) return;
    state.openTabs = state.openTabs.filter(t => t.id !== tabId);
    document.getElementById(`tab-content-${tabId}`)?.remove();
    const last = state.openTabs[state.openTabs.length - 1];
    if (last) selectTab(last.id);
    renderTabBar();
  }

  function selectTab(tabId) {
    state.activeTabId = tabId;
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    const c = document.getElementById(`tab-content-${tabId}`);
    if (c) {
      c.classList.add('active');
      if (tabId === 'map' && state.map) setTimeout(() => state.map.invalidateSize(), 10);
    }
    renderTabBar();
    // Sync nav rail
    const navType = tabId === 'map' ? 'map' : tabId === 'table' ? 'table' : tabId === 'compare' ? 'compare'
                  : tabId.startsWith('note_') ? 'notes' : tabId.startsWith('cmp_') ? 'compare' : null;
    if (navType) document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === navType));
  }

  function renderTabBar() {
    const c = document.getElementById('open-tabs');
    c.innerHTML = '';
    state.openTabs.forEach(tab => {
      const perm = ['map','table','compare'].includes(tab.id);
      const pill = document.createElement('button');
      pill.className   = `tab-pill${tab.id === state.activeTabId ? ' active' : ''}`;
      pill.dataset.tabId = tab.id;
      pill.innerHTML   = `<span class="tab-pill-label">${escapeHTML(tab.title)}</span>
        ${!perm ? `<button class="tab-pill-minimize" title="Minimize" data-tab="${tab.id}">─</button>
                   <button class="tab-pill-close"    title="Close"    data-tab="${tab.id}">✕</button>` : ''}`;
      pill.addEventListener('click', e => {
        if (e.target.classList.contains('tab-pill-close'))    { closeTab(tab.id); return; }
        if (e.target.classList.contains('tab-pill-minimize')) { selectTab('map'); return; }
        selectTab(tab.id);
      });
      c.appendChild(pill);
    });
  }

  /* ==========================================================
   *  SIDEBAR CONTROLS + RESIZE
   * ========================================================== */
  function buildSidebarControls() {
    document.getElementById('sidebar-minimize').addEventListener('click', () => {
      state.sidebarMinimized = !state.sidebarMinimized;
      document.getElementById('sidebar').classList.toggle('minimized', state.sidebarMinimized);
      if (state.map) setTimeout(() => state.map.invalidateSize(), 220);
    });
    document.getElementById('sidebar-close').addEventListener('click', () => {
      document.getElementById('sidebar').style.display = 'none';
      if (state.map) setTimeout(() => state.map.invalidateSize(), 10);
    });
  }

  function initResizableSidebar() {
    const handle  = document.getElementById('sidebar-resize-handle');
    const sidebar = document.getElementById('sidebar');
    let dragging = false, startX = 0, startW = 0;
    handle.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cssText += ';user-select:none;cursor:col-resize';
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      sidebar.style.width = Math.max(180, Math.min(520, startW + e.clientX - startX)) + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      handle.classList.remove('dragging');
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (state.map) setTimeout(() => state.map.invalidateSize(), 10);
    });
  }

  /* ==========================================================
   *  MAP LAYER / YEAR
   * ========================================================== */
  function buildSidebarLayers() {
    const ctr = document.getElementById('layer-toggles');
    Object.entries(CONFIG.layers).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'layer-btn'; btn.dataset.layer = key;
      btn.innerHTML = `<span class="layer-icon"></span>${def.label}`;
      btn.addEventListener('click', () => selectLayer(key));
      ctr.appendChild(btn);
    });
  }

  function selectLayer(key) {
    const def = CONFIG.layers[key]; if (!def) return;
    state.activeLayer = key;
    document.querySelectorAll('#layer-toggles .layer-btn').forEach(b => b.classList.toggle('active', b.dataset.layer === key));
    buildYearTabs(def);
    selectYear(def.years[def.years.length - 1]);
  }

  function buildYearTabs(def) {
    const ctr = document.getElementById('year-tabs');
    ctr.innerHTML = '';
    def.years.forEach(year => {
      const tab = document.createElement('button');
      tab.className = 'year-tab'; tab.dataset.year = year; tab.textContent = year;
      const cur = CONFIG.currentCycleYears[def.type];
      if (cur && year === cur) { tab.classList.add('current-cycle'); tab.title = 'Current election cycle'; }
      tab.addEventListener('click', () => selectYear(year));
      ctr.appendChild(tab);
    });
  }

  function selectYear(year) {
    state.activeYear = year;
    document.querySelectorAll('.year-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.year) === year));
    loadLayerAndData();
  }

  /* ==========================================================
   *  DATA LOADING
   * ========================================================== */
  async function loadLayerAndData() {
    const layerKey = state.activeLayer, year = state.activeYear;
    const def      = CONFIG.layers[layerKey];
    showLoading(true); clearInfoPanel();
    try {
      const sourceName = def.boundaryByYear(year);
      const sourceDef  = CONFIG.boundarySources[sourceName];
      if (!sourceDef) throw new Error(`Unknown boundary source: "${sourceName}"`);

      if (!state.boundaryCache[sourceName]) {
        const res = await fetch(sourceDef.url);
        if (!res.ok) throw new Error(`Boundary fetch failed (${res.status}): ${sourceDef.url}`);
        const raw = await res.json();
        if (sourceDef.format === 'topojson') {
          const obj = sourceDef.topoObject;
          if (!raw.objects?.[obj]) throw new Error(`TopoJSON object "${obj}" not found`);
          state.boundaryCache[sourceName] = topojson.feature(raw, raw.objects[obj]);
        } else {
          state.boundaryCache[sourceName] = raw;
        }
      }

      const elKey  = `${def.type}_${year}`;
      const elFile = CONFIG.elections[def.type]?.[year];
      if (elFile && !state.electionData[elKey]) {
        try { const r = await fetch(elFile); if (r.ok) state.electionData[elKey] = await r.json(); } catch(_) {}
      }

      renderLayer(layerKey, year);
      updateLegend();
      updateStatusBar();
      updateSeatChart(layerKey, year);
    } catch(err) {
      console.error('Load error:', err);
      showNoDataMessage(err.message);
    } finally { showLoading(false); }
  }

  /* ==========================================================
   *  DATA LOOKUP
   *
   *  For countyCode layers, election data keys are letters ("A")
   *  but TopoJSON feature IDs are numeric ("63000").
   *  We store lookup by numeric code, AND attach _letterId so
   *  we can resolve the human name in click handlers.
   * ========================================================== */
  function buildDataLookup(def, electionData) {
    const lookup = {};
    Object.entries(electionData).forEach(([key, val]) => {
      if (key === '_meta') return;
      if (def.idType === 'countyCode') {
        const entry = { ...val, _letterId: key };
        // Store by letter "A" — covers features whose id/property IS the letter
        lookup[key] = entry;
        // Store by numeric code "63000" — covers features whose id IS the numeric code
        const numeric = CONFIG.countyIdToCode[key];
        if (numeric) {
          lookup[numeric] = entry;
          // Also cover integer-stringified form (e.g. parseInt("10017") → "10017" same,
          // but for any code where leading zeros were stripped in the TopoJSON)
          const asInt = String(parseInt(numeric, 10));
          if (asInt !== numeric) lookup[asInt] = entry;
        }
      } else {
        lookup[key] = val;
      }
    });
    return lookup;
  }

  function getFeatureKey(feature) {
    // feature.id is primary: may be integer (63000) or string ("A", "63000")
    if (feature.id != null) return String(feature.id);
    // Property fallbacks: taiwan-atlas counties use COUNTYID (letter like "A"),
    // other sources may use COUNTYCODE (numeric string like "63000")
    const p = feature.properties || {};
    return String(
      p.COUNTYID   ??
      p.COUNTYCODE ??
      p.ELECTORAL_DISTRICT ??
      p.districtId ??
      p.DISTRICT_ID ??
      p.TOWNCODE   ??
      p.id         ?? ''
    );
  }

  function resolveWinnerParty(d) {
    if (!d?.winner) return null;
    if (d.winner.party) return d.winner.party;
    if (d.winner.politician_id != null) {
      const reg = state.politiciansRegistry[String(d.winner.politician_id)];
      if (reg?.party) return reg.party;
    }
    return null;
  }

  function resolvePolitician(candidate) {
    if (!candidate) return {};
    if (candidate.politician_id != null) {
      const reg = state.politiciansRegistry[String(candidate.politician_id)];
      if (reg) return { ...reg, ...candidate };
    }
    return candidate;
  }

  /* ==========================================================
   *  MAP RENDERING
   * ========================================================== */
  function renderLayer(layerKey, year) {
    const def        = CONFIG.layers[layerKey];
    const sourceName = def.boundaryByYear(year);
    const geojson    = state.boundaryCache[sourceName];
    if (!geojson) { showNoDataMessage('Boundary data not loaded.'); return; }

    const elData = state.electionData[`${def.type}_${year}`] || {};
    Object.values(state.geoLayers).forEach(l => state.map.removeLayer(l));
    if (state.labelTileLayer) state.map.removeLayer(state.labelTileLayer);

    const lookup   = buildDataLookup(def, elData);

    // ── DEBUG: log first feature so we can verify id/property format ──
    const sampleFeatures = geojson.features || [];
    if (sampleFeatures.length > 0) {
      const sf = sampleFeatures[0];
      console.debug('[FD] sample feature.id:', sf.id,
        '| properties keys:', Object.keys(sf.properties || {}).slice(0,8).join(','),
        '| lookup keys sample:', Object.keys(lookup).slice(0,4).join(','));
    }
    // ─────────────────────────────────────────────────────────────────

    const geoLayer = L.geoJSON(geojson, {
      style:         f => styleFeature(f, lookup),
      onEachFeature: (f, l) => bindFeatureEvents(f, l, def, lookup),
    });
    geoLayer.addTo(state.map);
    state.geoLayers[layerKey] = geoLayer;
    if (state.labelTileLayer) state.labelTileLayer.addTo(state.map);

    if (!state.fittedSources[sourceName] && geoLayer.getBounds().isValid()) {
      state.map.fitBounds(geoLayer.getBounds(), { padding: [20, 20] });
      state.fittedSources[sourceName] = true;
    }
  }

  function styleFeature(feature, lookup) {
    const fkey  = getFeatureKey(feature);
    const entry = lookup[fkey];
    const party = resolveWinnerParty(entry);
    if (party) {
      const color = getPartyColor(party);
      return { ...CONFIG.style.default, fillColor: color, fillOpacity: CONFIG.style.winnerFillOpacity, color, weight: 1.2 };
    }
    return CONFIG.style.default;
  }

  function bindFeatureEvents(feature, layer, def, lookup) {
    const fkey = getFeatureKey(feature);
    const data = lookup[fkey];
    const name = featureDisplayName(feature, def);
    // For display in the panel, use the letter ID (county) or fkey directly
    const panelId = (def.idType === 'countyCode' && data?._letterId) ? data._letterId : fkey;

    layer.bindTooltip(name, { sticky: true, direction: 'top', offset: [0, -10] });

    layer.on('mouseover', () => {
      if (state.selectedFeature === layer) return;
      const s = { ...CONFIG.style.hover };
      const wp = resolveWinnerParty(data);
      if (wp) { s.fillColor = getPartyColor(wp); s.fillOpacity = CONFIG.style.winnerHoverOpacity; }
      layer.setStyle(s); layer.bringToFront();
      if (state.labelTileLayer) state.labelTileLayer.bringToFront();
    });
    layer.on('mouseout', () => {
      if (state.selectedFeature === layer) return;
      state.geoLayers[state.activeLayer]?.resetStyle(layer);
    });
    layer.on('click', () => {
      if (state.selectedFeature) state.geoLayers[state.activeLayer]?.resetStyle(state.selectedFeature);
      state.selectedFeature = layer;
      const s = { ...CONFIG.style.selected };
      const wp = resolveWinnerParty(data);
      if (wp) { s.fillColor = getPartyColor(wp); s.fillOpacity = CONFIG.style.winnerHoverOpacity; }
      layer.setStyle(s); layer.bringToFront();
      if (state.labelTileLayer) state.labelTileLayer.bringToFront();
      showDistrictInfo(name, panelId, data, def);
    });
  }

  /* ==========================================================
   *  INFO PANEL
   * ========================================================== */
  function showDistrictInfo(name, id, data, def) {
    const panel = document.getElementById('info-panel');
    if (!data?.candidates?.length) {
      panel.innerHTML = `
        <div class="district-info">
          <div class="district-name">${name}</div>
          <div class="district-meta">${state.activeYear}</div>
          <div class="no-data-msg">
            <p>No election data loaded for this district.</p>
            <span class="instruction">Add data to the JSON file for ${state.activeYear}</span>
          </div>
        </div>`;
      return;
    }
    const en       = state.lang === 'en';
    const resolved = data.candidates.map(resolvePolitician);
    const sorted   = [...resolved].sort((a,b) => (b.vote_pct||0)-(a.vote_pct||0));
    const winnerR  = data.winner ? resolvePolitician(data.winner) : null;
    const layerLabel = CONFIG.layers[state.activeLayer]?.label || '';

    const cards = sorted.map(c => {
      const party    = CONFIG.parties[c.party] || CONFIG.parties.OTHER;
      const isWinner = winnerR && (
        c.politician_id != null ? String(c.politician_id) === String(winnerR.politician_id)
                                : c.name_en === winnerR.name_en
      );
      const cName = en ? (c.name_en||c.name_zh||'') : (c.name_zh||c.name_en||'');
      const photo = c.photo
        ? `<img class="candidate-photo" src="${c.photo}" alt="${escapeAttr(c.name_en||'')}" onerror="this.style.display='none'">`
        : `<div class="candidate-photo" style="display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--fd-text-light)">?</div>`;
      return `
        <div class="candidate-card ${isWinner?'winner':''}">
          ${photo}
          <div class="candidate-details">
            <div class="candidate-name-row">
              <span class="candidate-name-en">${escapeHTML(c.name_en||'')}</span>
              <span class="candidate-name-zh">${escapeHTML(c.name_zh||'')}</span>
            </div>
            <span class="candidate-party" style="background:${party.color}20;color:${party.color}">${party.name_en} ${party.name_zh}</span>
            <div class="candidate-votes">
              <span class="candidate-pct">${c.vote_pct!=null?c.vote_pct.toFixed(1)+'%':'—'}</span>
              ${c.votes!=null?` · ${c.votes.toLocaleString()} votes`:''}
            </div>
            <div class="vote-bar-container"><div class="vote-bar" style="width:${c.vote_pct||0}%;background:${party.color}"></div></div>
            ${c.wiki_url?`<a class="candidate-link" href="${c.wiki_url}" target="_blank" rel="noopener">Wikipedia →</a>`:''}
          </div>
        </div>`;
    }).join('');

    panel.innerHTML = `
      <div class="district-info">
        <div class="district-name">${name}</div>
        <div class="district-meta">${layerLabel} · ${state.activeYear}${data.turnout?` · Turnout: ${data.turnout}%`:''}</div>
        <div class="candidate-list">${cards}</div>
      </div>`;
  }

  function clearInfoPanel() {
    document.getElementById('info-panel').innerHTML = `
      <div class="info-placeholder">
        <span class="icon">🗺</span>
        <p>Select a district on the map<br>to view election results.</p>
        <p style="font-size:11px;margin-top:8px;color:var(--fd-text-light)">點擊地圖上的選區以查看選舉結果</p>
      </div>`;
    state.selectedFeature = null;
  }

  /* ==========================================================
   *  TABLE VIEW
   * ========================================================== */
  function buildTableSidebar() {
    const ctr = document.getElementById('table-layer-toggles');
    Object.entries(CONFIG.layers).forEach(([key, def]) => {
      const btn = document.createElement('button');
      btn.className = 'layer-btn'; btn.dataset.layer = key;
      btn.innerHTML = `<span class="layer-icon"></span>${def.label}`;
      btn.addEventListener('click', () => {
        ctr.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        buildTableYears(key);
      });
      ctr.appendChild(btn);
    });
  }

  function buildTableYears(layerKey) {
    const def = CONFIG.layers[layerKey];
    const ctr = document.getElementById('table-year-tabs');
    ctr.innerHTML = '';
    def.years.forEach(year => {
      const tab = document.createElement('button');
      tab.className = 'year-tab'; tab.textContent = year;
      tab.addEventListener('click', () => {
        ctr.querySelectorAll('.year-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        loadTableView(layerKey, year);
      });
      ctr.appendChild(tab);
    });
  }

  async function loadTableView(layerKey, year) {
    const def = CONFIG.layers[layerKey];
    const elKey  = `${def.type}_${year}`;
    const elFile = CONFIG.elections[def.type]?.[year];
    selectTab('table');
    const tv = document.getElementById('table-view');
    tv.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:120px;gap:12px;color:var(--fd-text-secondary)"><div class="loading-spinner"></div>Loading…</div>`;
    if (elFile && !state.electionData[elKey]) {
      try { const r = await fetch(elFile); if (r.ok) state.electionData[elKey] = await r.json(); } catch(_) {}
    }
    renderTableView(tv, state.electionData[elKey] || {}, def, year);
  }

  function renderTableView(container, data, def, year) {
    const en = state.lang === 'en';
    const rows = Object.entries(data).filter(([k]) => k !== '_meta');
    if (!rows.length) {
      container.innerHTML = `<div class="table-placeholder"><span class="icon">📭</span><p>No data available for ${def.label} ${year}.</p></div>`;
      return;
    }

    let html = '';
    rows.forEach(([distId, d]) => {
      if (!d) return;
      const party   = resolveWinnerParty(d);
      const color   = party ? getPartyColor(party) : '#ccc';
      const winner  = d.winner ? resolvePolitician(d.winner) : null;
      const wName   = winner ? (en ? (winner.name_en||winner.name_zh||'—') : (winner.name_zh||winner.name_en||'—')) : '—';
      const sorted  = [...(d.candidates||[])].map(resolvePolitician).sort((a,b)=>(b.vote_pct||0)-(a.vote_pct||0));
      const distName = resolveDistrictName(distId, def);
      const others  = sorted.slice(1).map(c => {
        const cp   = getPartyColor(c.party||'OTHER');
        const cName = en ? (c.name_en||c.name_zh||'') : (c.name_zh||c.name_en||'');
        return `<span style="color:${cp};font-weight:600">${escapeHTML(cName)}</span>`+
               (c.vote_pct!=null?`<span style="color:var(--fd-text-light);font-family:var(--fd-font-mono)"> ${c.vote_pct.toFixed(1)}%</span>`:'');
      }).join(' · ');

      html += `<tr>
        <td>
          <strong>${escapeHTML(distName)}</strong>
          <span style="display:block;font-family:var(--fd-font-mono);font-size:10px;color:var(--fd-text-light)">${escapeHTML(distId)}</span>
        </td>
        <td>${party?`<span class="table-party-chip" style="background:${color}20;color:${color}">${party}</span>`:'—'}</td>
        <td>${escapeHTML(wName)}</td>
        <td>${sorted[0]?`<div class="table-pct-bar">
          <div class="table-pct-track"><div class="table-pct-fill" style="width:${sorted[0].vote_pct||0}%;background:${color}"></div></div>
          <span style="font-family:var(--fd-font-mono);font-size:12px;font-weight:700;color:${color}">${sorted[0].vote_pct!=null?sorted[0].vote_pct.toFixed(1)+'%':'—'}</span>
        </div>`:'—'}</td>
        <td style="font-family:var(--fd-font-mono);font-size:12px">${d.turnout!=null?d.turnout+'%':'—'}</td>
        <td style="font-size:11px;color:var(--fd-text-secondary)">${others}</td>
      </tr>`;
    });

    container.innerHTML = `
      <div class="table-header-row">
        <h2>${def.label} — ${year}</h2>
        <span class="table-meta">${rows.length} districts</span>
      </div>
      <div class="table-wrapper">
        <table class="election-table">
          <thead><tr>
            <th>District 選區</th>
            <th>Winner Party 政黨</th>
            <th>Winner 當選人</th>
            <th>Vote Share 得票率</th>
            <th>Turnout 投票率</th>
            <th>Other Candidates 其他候選人</th>
          </tr></thead>
          <tbody>${html}</tbody>
        </table>
      </div>`;
  }

  /* ==========================================================
   *  NOTES
   * ========================================================== */
  function buildNotesSidebar() {
    document.getElementById('new-note-btn').addEventListener('click', createNewNote);
  }

  function createNewNote() {
    const id   = 'note_' + Date.now();
    state.notes[id] = { id, title: 'Untitled Note', body: '', updated: Date.now() };
    saveNotes();
    openNoteTab(id);
    renderNotesInSidebar();
  }

  function openNoteTab(noteId) {
    const note = state.notes[noteId]; if (!note) return;
    const tabId = `note_${noteId}`;
    switchNavTab('notes');
    if (!state.openTabs.find(t => t.id === tabId)) {
      const div = document.createElement('div');
      div.id = `tab-content-${tabId}`; div.className = 'tab-content';
      div.innerHTML = `
        <div class="note-view">
          <div class="note-toolbar">
            <input class="note-title-input" type="text" placeholder="Note title…"
                   value="${escapeAttr(note.title)}" data-note-id="${note.id}">
            <span class="note-save-indicator" id="ns-${note.id}"></span>
            <button class="note-save-btn" data-note-id="${note.id}">Save</button>
          </div>
          <textarea class="note-body" placeholder="Write your notes here…" data-note-id="${note.id}">${escapeText(note.body)}</textarea>
        </div>`;
      document.getElementById('tab-content-area').appendChild(div);
      bindNoteEvents(div, noteId);
      openTab({ id: tabId, type: 'note', title: note.title || 'Note' });
    }
    selectTab(tabId);
  }

  function bindNoteEvents(container, noteId) {
    const ti  = container.querySelector('.note-title-input');
    const ta  = container.querySelector('.note-body');
    const btn = container.querySelector('.note-save-btn');
    const ind = container.querySelector(`#ns-${noteId}`);
    let timer;

    function doSave() {
      if (!state.notes[noteId]) return;
      state.notes[noteId].title   = ti?.value   || 'Untitled Note';
      state.notes[noteId].body    = ta?.value   || '';
      state.notes[noteId].updated = Date.now();
      saveNotes();
      const pill = document.querySelector(`.tab-pill[data-tab-id="note_${noteId}"] .tab-pill-label`);
      if (pill) pill.textContent = state.notes[noteId].title;
      renderNotesInSidebar();
    }

    function autoSave() {
      clearTimeout(timer);
      if (ind) ind.textContent = 'Saving…';
      timer = setTimeout(() => { doSave(); if (ind) { ind.textContent='Saved ✓'; setTimeout(()=>{if(ind)ind.textContent='';},2000); } }, 800);
    }

    ti?.addEventListener('input', autoSave);
    ta?.addEventListener('input', autoSave);
    btn?.addEventListener('click', () => { doSave(); if (ind) { ind.textContent='Saved ✓'; setTimeout(()=>{if(ind)ind.textContent='';},2000); } });
  }

  function renderNotesInSidebar() {
    const list  = document.getElementById('notes-list');
    const notes = Object.values(state.notes).sort((a,b) => b.updated - a.updated);
    if (!notes.length) { list.innerHTML = `<div class="saved-list-empty">No notes yet.</div>`; return; }
    list.innerHTML = notes.map(n => `
      <div class="saved-item ${state.activeTabId==='note_'+n.id?'active':''}" data-note-id="${n.id}">
        <span class="saved-item-icon">📝</span>
        <div class="saved-item-text">
          <div class="saved-item-title">${escapeHTML(n.title)}</div>
          <div class="saved-item-meta">${formatDate(n.updated)}</div>
        </div>
        <button class="saved-item-del" data-note-id="${n.id}">✕</button>
      </div>`).join('');
    list.querySelectorAll('.saved-item').forEach(el => {
      el.addEventListener('click', e => {
        if (e.target.classList.contains('saved-item-del')) {
          const id = e.target.dataset.noteId;
          if (confirm('Delete this note?')) { delete state.notes[id]; saveNotes(); closeTab(`note_${id}`); renderNotesInSidebar(); }
          return;
        }
        openNoteTab(el.dataset.noteId);
      });
    });
  }

  /* ==========================================================
   *  COMPARISON SYSTEM
   * ========================================================== */
  function buildCompareSidebar() {
    document.getElementById('new-comparison-btn').addEventListener('click', createNewComparison);
  }

  function createNewComparison() {
    const id  = 'cmp_' + Date.now();
    state.comparisons[id] = {
      id, title: 'New Comparison',
      elections: [{ type:'magistrate', year:2022 }, { type:'magistrate', year:2018 }],
      metric: 'winner_pct', scope: 'all', updated: Date.now(),
    };
    saveComparisons();
    openCompareTab(id);
    renderComparisonsInSidebar();
  }

  function openCompareTab(cmpId) {
    const cmp = state.comparisons[cmpId]; if (!cmp) return;
    const tabId = `cmp_${cmpId}`;
    switchNavTab('compare');
    state.currentCompareId = cmpId;
    if (!state.openTabs.find(t => t.id === tabId)) {
      const div = document.createElement('div');
      div.id = `tab-content-${tabId}`; div.className = 'tab-content';
      div.innerHTML = buildCompareHTML(cmp);
      document.getElementById('tab-content-area').appendChild(div);
      bindCompareEvents(div, cmpId);
      openTab({ id: tabId, type: 'compare_tab', title: cmp.title });
    }
    selectTab(tabId);
  }

  /* ----------------------------------------------------------
   *  Compare HTML builder
   * ---------------------------------------------------------- */
  function buildCompareHTML(cmp) {
    return `
<div class="compare-view" data-cmp-id="${cmp.id}">
  <div class="compare-toolbar">
    <input class="compare-title-input" type="text" value="${escapeAttr(cmp.title)}" placeholder="Comparison title…">
    <button class="run-compare-btn" id="run-cmp-${cmp.id}">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Run Comparison
    </button>
  </div>
  <div class="compare-body">
    <div class="compare-setup-panel">

      <div class="compare-setup-section">
        <h4>Elections to Compare</h4>
        <div class="compare-election-grid" id="ceg-${cmp.id}">
          ${cmp.elections.map((el,i) => elRowHTML(el,i)).join('')}
        </div>
        <button class="add-election-btn" id="aeb-${cmp.id}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add election
        </button>
      </div>

      <div class="compare-setup-section">
        <h4>What to Compare</h4>
        <div class="compare-metric-select">
          ${[['winner_pct','Winner vote share (%)'],['winner_party','Winning party'],['margin','Margin of victory (pp)'],['turnout','Voter turnout (%)']]
            .map(([v,l])=>`<label class="metric-option ${cmp.metric===v?'selected':''}"><input type="radio" name="metric_${cmp.id}" value="${v}" ${cmp.metric===v?'checked':''}>${l}</label>`).join('')}
        </div>
      </div>

      <div class="compare-setup-section">
        <h4>Districts / Scope</h4>
        <div class="compare-district-select">
          <div class="compare-district-mode">
            <button class="district-mode-btn ${cmp.scope==='all'?'active':''}"    data-scope="all">All</button>
            <button class="district-mode-btn ${cmp.scope==='county'?'active':''}" data-scope="county">County</button>
            <button class="district-mode-btn ${cmp.scope==='custom'?'active':''}" data-scope="custom">Custom</button>
          </div>
          <div class="district-scope-select" id="sd-${cmp.id}">${scopeDetailHTML(cmp)}</div>
        </div>
      </div>

    </div>
    <div class="compare-results-panel" id="cr-${cmp.id}">
      <div class="compare-results-empty">
        <span class="icon">📊</span>
        <p>Configure elections and click <strong>Run Comparison</strong>.</p>
        <p style="font-size:11px;color:var(--fd-text-light)">Compare vote shares, margins, turnout, and winning parties across elections and districts.</p>
      </div>
    </div>
  </div>
</div>`;
  }

  function elRowHTML(el, i) {
    const tOpts = Object.entries(CONFIG.layers).map(([k,d])=>
      `<option value="${k}" ${el.type===k?'selected':''}>${d.label.split(' ')[0]}</option>`).join('');
    const yOpts = (CONFIG.layers[el.type]?.years||[]).map(y=>
      `<option value="${y}" ${el.year===y?'selected':''}>${y}</option>`).join('');
    return `<div class="compare-election-row" data-row-index="${i}">
      <select class="election-type-sel" data-index="${i}">${tOpts}</select>
      <select class="election-year-sel" data-index="${i}">${yOpts}</select>
      <button class="compare-election-remove" data-index="${i}">✕</button>
    </div>`;
  }

  function scopeDetailHTML(cmp) {
    if (cmp.scope === 'county') {
      const opts = Object.keys(CONFIG.countyIdToCode).map(id =>
        `<option value="${id}">${COUNTY_EN[id] || id} / ${COUNTY_ZH[id] || id}</option>`).join('');
      return `<select id="sc-${cmp.id}"><option value="">Select county…</option>${opts}</select>`;
    }
    if (cmp.scope === 'custom') {
      return `<div style="font-size:11px;color:var(--fd-text-secondary);line-height:1.5;margin-bottom:4px">
        Enter district IDs (comma-separated). County: <code style="font-family:var(--fd-font-mono)">A, B, E</code><br>
        Legislative: <code style="font-family:var(--fd-font-mono)">TPE-01, KHH-03</code>
      </div>
      <textarea id="scx-${cmp.id}" placeholder="A, B, E…" rows="2"
        style="width:100%;padding:5px 8px;border:1px solid var(--fd-border);border-radius:4px;font-family:var(--fd-font-mono);font-size:11px;resize:vertical"></textarea>`;
    }
    return '';
  }

  function bindCompareEvents(container, cmpId) {
    const cmp = state.comparisons[cmpId];

    // Title live update
    const ti = container.querySelector('.compare-title-input');
    ti?.addEventListener('input', () => {
      cmp.title = ti.value; saveComparisons();
      const pill = document.querySelector(`.tab-pill[data-tab-id="cmp_${cmpId}"] .tab-pill-label`);
      if (pill) pill.textContent = cmp.title || 'Compare';
      renderComparisonsInSidebar();
    });

    document.getElementById(`run-cmp-${cmpId}`)?.addEventListener('click', () => runComparison(cmpId, container));

    document.getElementById(`aeb-${cmpId}`)?.addEventListener('click', () => {
      cmp.elections.push({ type:'magistrate', year:2022 });
      rebuildElGrid(cmpId, container); saveComparisons();
    });

    bindElGridEvents(cmpId, container);

    container.querySelectorAll(`input[name="metric_${cmpId}"]`).forEach(r => r.addEventListener('change', () => {
      cmp.metric = r.value; saveComparisons();
      container.querySelectorAll('.metric-option').forEach(o => o.classList.remove('selected'));
      r.closest('.metric-option').classList.add('selected');
    }));

    container.querySelectorAll('.district-mode-btn').forEach(btn => btn.addEventListener('click', () => {
      cmp.scope = btn.dataset.scope; saveComparisons();
      container.querySelectorAll('.district-mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sd = document.getElementById(`sd-${cmpId}`); if (sd) sd.innerHTML = scopeDetailHTML(cmp);
    }));
  }

  function bindElGridEvents(cmpId, container) {
    const cmp  = state.comparisons[cmpId];
    const grid = document.getElementById(`ceg-${cmpId}`); if (!grid) return;
    grid.querySelectorAll('.election-type-sel').forEach(sel => sel.addEventListener('change', () => {
      const i = parseInt(sel.dataset.index); cmp.elections[i].type = sel.value;
      const ys = grid.querySelector(`.election-year-sel[data-index="${i}"]`);
      if (ys) { ys.innerHTML = (CONFIG.layers[sel.value]?.years||[]).map(y=>`<option value="${y}">${y}</option>`).join(''); cmp.elections[i].year = parseInt(ys.value); }
      saveComparisons();
    }));
    grid.querySelectorAll('.election-year-sel').forEach(sel => sel.addEventListener('change', () => {
      cmp.elections[parseInt(sel.dataset.index)].year = parseInt(sel.value); saveComparisons();
    }));
    grid.querySelectorAll('.compare-election-remove').forEach(btn => btn.addEventListener('click', () => {
      const i = parseInt(btn.dataset.index); if (cmp.elections.length <= 1) return;
      cmp.elections.splice(i, 1); rebuildElGrid(cmpId, container); saveComparisons();
    }));
  }

  function rebuildElGrid(cmpId, container) {
    const cmp  = state.comparisons[cmpId];
    const grid = document.getElementById(`ceg-${cmpId}`); if (!grid) return;
    grid.innerHTML = cmp.elections.map((el,i) => elRowHTML(el,i)).join('');
    bindElGridEvents(cmpId, container);
  }

  /* ----------------------------------------------------------
   *  Run comparison
   * ---------------------------------------------------------- */
  async function runComparison(cmpId, container) {
    const cmp = state.comparisons[cmpId];
    const res = document.getElementById(`cr-${cmpId}`); if (!res) return;
    res.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100px;gap:12px;color:var(--fd-text-secondary)"><div class="loading-spinner"></div>Running…</div>`;

    // Load all election data
    for (const el of cmp.elections) {
      const def  = CONFIG.layers[el.type]; if (!def) continue;
      const elKey = `${def.type}_${el.year}`;
      const file  = CONFIG.elections[def.type]?.[el.year];
      if (file && !state.electionData[elKey]) {
        try { const r = await fetch(file); if (r.ok) state.electionData[elKey] = await r.json(); } catch(_) {}
      }
    }

    // Determine allowed district IDs
    let allowed = null;
    if (cmp.scope === 'county') {
      const sel = container.querySelector(`#sc-${cmpId}`);
      if (sel?.value) allowed = new Set([sel.value.toUpperCase()]);
    } else if (cmp.scope === 'custom') {
      const ta = container.querySelector(`#scx-${cmpId}`);
      if (ta?.value.trim()) allowed = new Set(ta.value.split(',').map(s=>s.trim().toUpperCase()).filter(Boolean));
    }

    // Collect all district keys that exist in at least one election
    const allIds = new Set();
    cmp.elections.forEach(el => {
      const def = CONFIG.layers[el.type]; if (!def) return;
      const data = state.electionData[`${def.type}_${el.year}`] || {};
      Object.keys(data).filter(k => k !== '_meta')
                       .filter(k => !allowed || allowed.has(k.toUpperCase()))
                       .forEach(k => allIds.add(k));
    });

    if (!allIds.size) {
      res.innerHTML = `<div class="compare-results-empty"><span class="icon">📭</span><p>No data found. Make sure your election JSON files contain data for the selected elections.</p></div>`;
      return;
    }

    renderCompareResults(cmp, [...allIds], res);
    cmp.updated = Date.now(); saveComparisons();
  }

  function renderCompareResults(cmp, distIds, el) {
    const en        = state.lang === 'en';
    const elections = cmp.elections;
    const metric    = cmp.metric;

    // Use first election's layer def for name resolution
    const nameDef = CONFIG.layers[elections[0]?.type];

    const rows = distIds.map(distId => {
      const cells = elections.map(election => {
        const def  = CONFIG.layers[election.type]; if (!def) return null;
        const data = state.electionData[`${def.type}_${election.year}`] || {};
        const d    = data[distId]; if (!d) return null;
        const party = resolveWinnerParty(d) || 'OTHER';
        const color = getPartyColor(party);
        const winner = d.winner ? resolvePolitician(d.winner) : null;
        const sorted = [...(d.candidates||[])].map(resolvePolitician).sort((a,b)=>(b.vote_pct||0)-(a.vote_pct||0));
        let value = null, displayVal = '—';
        if (metric === 'winner_pct')   { value = sorted[0]?.vote_pct ?? null; displayVal = value!=null?value.toFixed(1)+'%':'—'; }
        else if (metric === 'winner_party') { value = party; displayVal = party; }
        else if (metric === 'margin')  { if (sorted.length>=2) { value=(sorted[0].vote_pct||0)-(sorted[1].vote_pct||0); displayVal=(value>=0?'+':'')+value.toFixed(1)+'pp'; } }
        else if (metric === 'turnout') { value = d.turnout??null; displayVal = value!=null?value+'%':'—'; }
        const wName = winner ? (en?winner.name_en||winner.name_zh:winner.name_zh||winner.name_en) || party : party;
        return { election, value, displayVal, color, party, wName, def };
      });
      return { distId, cells };
    });

    function delta(cells) {
      const ns = cells.filter(c => c && typeof c.value === 'number');
      return ns.length >= 2 ? ns[ns.length-1].value - ns[0].value : null;
    }

    let html = `<div style="margin-bottom:12px">
      <span class="compare-section-title">${escapeHTML(cmp.title)}</span>
      <div style="font-size:11px;color:var(--fd-text-secondary);margin-top:4px;font-family:var(--fd-font-mono)">
        Metric: <strong>${metric}</strong> · ${elections.length} elections · ${distIds.length} districts
      </div>
    </div>`;

    rows.forEach(({ distId, cells }) => {
      const d     = delta(cells);
      const name  = resolveDistrictName(distId, nameDef);
      const dHTML = d !== null
        ? `<span class="compare-cell-delta ${d>0.5?'pos':d<-0.5?'neg':'neu'}">${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(1)}pp</span>` : '';

      const cHTML = cells.map((cell, i) => {
        if (!cell) return `<div class="compare-election-cell">
          <div class="compare-cell-year">${elections[i].type.toUpperCase()} ${elections[i].year}</div>
          <div style="color:var(--fd-text-light);font-size:12px">No data</div>
        </div>`;
        return `<div class="compare-election-cell">
          <div class="compare-cell-year">${cell.election.type.toUpperCase()} ${cell.election.year}</div>
          <div class="compare-cell-winner" style="color:${cell.color}">${escapeHTML(cell.wName)}</div>
          <div class="compare-cell-pct" style="color:${cell.color}">${cell.displayVal}</div>
          ${(metric==='winner_pct'||metric==='margin')&&typeof cell.value==='number'?`
            <div class="compare-cell-bar"><div class="compare-cell-bar-fill" style="width:${Math.min(100,Math.abs(cell.value))}%;background:${cell.color}"></div></div>`:''}
          <span class="table-party-chip" style="background:${cell.color}20;color:${cell.color};font-size:10px">${cell.party}</span>
        </div>`;
      }).join('');

      html += `<div class="compare-district-card" style="margin-bottom:12px">
        <div class="compare-district-header">
          <div>
            <span class="compare-district-name">${escapeHTML(name)}</span>
            <span style="font-family:var(--fd-font-mono);font-size:10px;opacity:0.45;margin-left:8px">${escapeHTML(distId)}</span>
          </div>
          ${dHTML}
        </div>
        <div class="compare-elections-strip">${cHTML}</div>
      </div>`;
    });

    // Swing table
    if (metric !== 'winner_party' && rows.length > 1) {
      const swings = rows.map(r => ({
        id:    r.distId,
        name:  resolveDistrictName(r.distId, nameDef),
        d:     delta(r.cells),
        from:  r.cells.find(c => c && c.value !== null),
        to:    [...r.cells].reverse().find(c => c && c.value !== null),
      })).filter(r => r.d !== null).sort((a,b) => b.d - a.d);

      if (swings.length) {
        const y0 = elections[0]?.year, yN = elections[elections.length-1]?.year;
        html += `<div style="margin-top:8px">
          <span class="compare-section-title">Swing Summary ${y0} → ${yN}</span>
          <div class="table-wrapper" style="margin-top:8px;padding:0">
            <table class="election-table" style="font-size:12px">
              <thead><tr><th>District</th><th>${y0}</th><th>${yN}</th><th>Change</th></tr></thead>
              <tbody>${swings.map(r=>`<tr>
                <td><strong>${escapeHTML(r.name)}</strong><span style="display:block;font-family:var(--fd-font-mono);font-size:10px;color:var(--fd-text-light)">${escapeHTML(r.id)}</span></td>
                <td style="font-family:var(--fd-font-mono)">${r.from?.displayVal||'—'}</td>
                <td style="font-family:var(--fd-font-mono)">${r.to?.displayVal||'—'}</td>
                <td><span class="compare-cell-delta ${r.d>0.5?'pos':r.d<-0.5?'neg':'neu'}">${r.d>=0?'▲':'▼'} ${Math.abs(r.d).toFixed(1)}pp</span></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
        </div>`;
      }
    }

    el.innerHTML = html;
  }

  function renderComparisonsInSidebar() {
    const list = document.getElementById('saved-comparisons-list');
    const cmps = Object.values(state.comparisons).sort((a,b) => b.updated - a.updated);
    if (!cmps.length) { list.innerHTML = `<div class="saved-list-empty">No saved comparisons yet.<br>Click "New Comparison" to start.</div>`; return; }

    list.innerHTML = cmps.map(cmp => `
      <div class="saved-item ${state.activeTabId==='cmp_'+cmp.id?'active':''}" data-cmp-id="${cmp.id}">
        <span class="saved-item-icon">📊</span>
        <div class="saved-item-text">
          <div class="saved-item-title" title="Double-click to rename">${escapeHTML(cmp.title)}</div>
          <div class="saved-item-meta">${cmp.elections.map(e=>e.year).join(' vs ')} · ${formatDate(cmp.updated)}</div>
        </div>
        <button class="saved-item-del" data-cmp-id="${cmp.id}">✕</button>
      </div>`).join('');

    list.querySelectorAll('.saved-item').forEach(el => {
      // Double-click to rename
      el.querySelector('.saved-item-title')?.addEventListener('dblclick', e => {
        e.stopPropagation();
        const cmpId   = el.dataset.cmpId;
        const cmp     = state.comparisons[cmpId]; if (!cmp) return;
        const tEl     = e.target;
        const old     = cmp.title;
        tEl.contentEditable = 'true'; tEl.focus();
        const range = document.createRange(); range.selectNodeContents(tEl);
        const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        function commit() {
          tEl.contentEditable = 'false';
          const nv = tEl.textContent.trim() || old;
          tEl.textContent = nv; cmp.title = nv; cmp.updated = Date.now(); saveComparisons();
          const pill = document.querySelector(`.tab-pill[data-tab-id="cmp_${cmpId}"] .tab-pill-label`);
          if (pill) pill.textContent = nv;
          const inp = document.querySelector(`#tab-content-cmp_${cmpId} .compare-title-input`);
          if (inp) inp.value = nv;
          renderComparisonsInSidebar();
        }
        tEl.addEventListener('blur',    commit, { once: true });
        tEl.addEventListener('keydown', ev => { if (ev.key==='Enter') { ev.preventDefault(); tEl.blur(); } }, { once: true });
      });

      el.addEventListener('click', e => {
        if (e.target.classList.contains('saved-item-del')) {
          const id = e.target.dataset.cmpId;
          if (confirm('Delete this comparison?')) { delete state.comparisons[id]; saveComparisons(); closeTab(`cmp_${id}`); renderComparisonsInSidebar(); }
          return;
        }
        if (e.target.contentEditable === 'true') return;
        openCompareTab(el.dataset.cmpId);
      });
    });
  }

  /* ==========================================================
   *  SEAT CHART
   * ========================================================== */
  function updateSeatChart(layerKey, year) {
    const panel = document.getElementById('seat-chart-panel'); if (!panel) return;
    if (layerKey !== 'legislative') { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');
    const data     = state.electionData[`${CONFIG.layers[layerKey].type}_${year}`] || {};
    let seatData   = data._meta?.seats ?? null;
    if (!seatData) {
      const counts = {};
      Object.entries(data).forEach(([k,v]) => {
        if (k === '_meta' || !v?.winner) return;
        const p = resolveWinnerParty(v) || 'OTHER';
        counts[p] = (counts[p]||0)+1;
      });
      if (Object.keys(counts).length) seatData = counts;
    }
    const svgEl    = document.getElementById('seat-chart-hemicycle');
    const totalsEl = document.getElementById('seat-chart-totals');
    if (!seatData) { if (svgEl) svgEl.innerHTML=`<p class="seat-chart-empty">No seat data for ${year}</p>`; if(totalsEl)totalsEl.innerHTML=''; return; }
    renderHemicycle(seatData, svgEl, totalsEl);
  }

  function renderHemicycle(seatData, svgEl, totalsEl) {
    const ORDER = ['DPP','TSP','NPP','GP','TPP','IND','PFP','NP','KMT','OTHER'];
    const total = Object.values(seatData).reduce((s,n)=>s+(n||0),0); if (!total) return;
    const all   = []; ORDER.forEach(p=>{for(let i=0;i<(seatData[p]||0);i++)all.push(p);}); Object.entries(seatData).forEach(([p,n])=>{if(!ORDER.includes(p))for(let i=0;i<n;i++)all.push(p);});
    const R=[50,68,86,104,122], tr=R.reduce((s,r)=>s+r,0); let rem=total;
    const pr=R.map((r,i)=>{if(i===R.length-1)return rem;const n=Math.round(total*r/tr);rem-=n;return n;});
    const W=268,H=148,cx=W/2,cy=H-6,D=3.6; let idx=0; const cc=[];
    pr.forEach((cnt,ri)=>{const r=R[ri];for(let i=0;i<cnt;i++){const t=cnt>1?Math.PI*(1-i/(cnt-1)):Math.PI/2;const x=(cx+r*Math.cos(t)).toFixed(1),y=(cy-r*Math.sin(t)).toFixed(1);const color=(CONFIG.parties[all[idx++]]||CONFIG.parties.OTHER).color;cc.push(`<circle cx="${x}" cy="${y}" r="${D}" fill="${color}" opacity="0.92"/>`);}});
    const half=Math.ceil(total/2),yT=cy-(R[R.length-1]+8),yB=cy-(R[0]-6);
    svgEl.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;margin:0 auto;overflow:visible"><line x1="${cx}" y1="${yT}" x2="${cx}" y2="${yB}" stroke="#aaa" stroke-width="1" stroke-dasharray="3,2" opacity="0.55"/><text x="${cx+3}" y="${yT+10}" font-size="9" fill="#999" font-family="var(--fd-font-mono)">${half}</text>${cc.join('')}</svg>`;
    const shown=ORDER.filter(p=>seatData[p]>0),extra=Object.keys(seatData).filter(p=>!ORDER.includes(p)&&seatData[p]>0);
    totalsEl.innerHTML=`<div class="seat-totals">${[...shown,...extra].map(p=>{const party=CONFIG.parties[p]||CONFIG.parties.OTHER;return `<span class="seat-total-item"><span class="seat-dot" style="background:${party.color}"></span><span class="seat-abbr">${p}</span><strong class="seat-n">${seatData[p]}</strong></span>`;}).join('')}<span class="seat-total-label">${total} seats</span></div>`;
  }

  /* ==========================================================
   *  LEGEND + STATUS BAR
   * ========================================================== */
  function buildLegend() {
    const l = L.control({ position: 'bottomright' }); l.onAdd = () => L.DomUtil.create('div','legend'); l.addTo(state.map); state.legend = l; updateLegend();
  }
  function updateLegend() {
    if (!state.legend) return; const el = state.legend.getContainer(); if (!el) return;
    const data = state.electionData[`${CONFIG.layers[state.activeLayer]?.type}_${state.activeYear}`] || {};
    const ps   = new Set();
    Object.values(data).forEach(d => { if (!d?.candidates) return; d.candidates.forEach(c => { const r=resolvePolitician(c); if(r.party)ps.add(r.party); }); });
    const show = ps.size > 0 ? [...ps] : ['KMT','DPP','TPP','IND'];
    el.innerHTML = `<div class="legend-title">Party Colors</div>`+show.map(k=>{const p=CONFIG.parties[k]||CONFIG.parties.OTHER;return `<div class="legend-item"><span class="legend-color" style="background:${p.color}"></span>${p.name_en} ${p.name_zh}</div>`;}).join('');
  }
  function buildStatusBar() {
    const b = L.control({ position: 'bottomleft' }); b.onAdd = () => L.DomUtil.create('div','status-bar'); b.addTo(state.map); state.statusBar = b;
  }
  function updateStatusBar() {
    if (!state.statusBar) return; const el = state.statusBar.getContainer(); if (!el) return;
    const label = CONFIG.layers[state.activeLayer]?.label || '';
    const data  = state.electionData[`${CONFIG.layers[state.activeLayer]?.type}_${state.activeYear}`];
    const count = data ? Object.keys(data).filter(k=>k!=='_meta').length : 0;
    el.textContent = `${label} · ${state.activeYear} · ${count} district${count!==1?'s':''} with data`;
  }

  /* ==========================================================
   *  UTILITIES
   * ========================================================== */
  function getPartyColor(k) { return (CONFIG.parties[k]||CONFIG.parties.OTHER).color; }
  function showLoading(v)   { document.getElementById('loading-overlay')?.classList.toggle('hidden',!v); }
  function showNoDataMessage(msg) {
    document.getElementById('info-panel').innerHTML=`<div class="no-data-msg"><p>⚠ ${escapeHTML(msg)}</p><span class="instruction">See README.md for setup instructions</span></div>`;
  }
  function escapeHTML(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escapeAttr(s) { return String(s||'').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
  function escapeText(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function formatDate(ts) { if(!ts)return''; return new Date(ts).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}); }

  /* ==========================================================
   *  BOOT
   * ========================================================== */
  document.addEventListener('DOMContentLoaded', init);

})();
