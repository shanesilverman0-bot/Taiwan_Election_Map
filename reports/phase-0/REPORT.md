# Phase 0 Report

Branch: phase-0 (from main, dirty tree carried over). Nothing pushed or merged.

## Commits
1. 3093b21 "Baseline: v21 working tree as-is": js/app.js, js/config.js, index.html, css/style.css, data/elections/legislative_2008/2012/2016/2020/2024.json (9 files, no content edits; `node --check` passed first).
2. a840c39 "Add orchestration docs": CLAUDE.md, .claude/agents/phase-executor.md, docs/ROADMAP.md.
3. Hygiene: git rm of junk dir `{css,js,data` (contained `{css,js,data/elections,data/.DS_Store` etc.; empty leftover dirs also removed from disk), tracked .DS_Store (root, data/, data/elections/), electoral_system_briefing.textClipping; untracked .DS_Store deleted (incl. News Letter/.DS_Store); .gitignore added.
4. Vendor boundaries: data/geo/{counties,towns,districts}-10t.json from taiwan-atlas@2021.9.20 (npm latest); config.js URLs now relative `data/geo/...` via tools/patches/phase0_localize_boundaries_taiwan-atlas_2021.9.20.py; tools/inspect_boundaries.py; reports/phase-0/boundary_audit.txt.
5. This report.

## Commands (main)
git checkout -b phase-0; node --check js/app.js js/config.js; git add/commit; git rm; npm view taiwan-atlas version (2021.9.20); curl of three files at pinned version; python3 -I patch and audit scripts; python3 -m http.server 8765 + curl (stopped).

## Boundary audit (full output: reports/phase-0/boundary_audit.txt)
- config.js lists 3 boundary files (counties-10t, towns-10t, districts-10t); no other boundary URLs.
- counties-10t: objects counties(22), nation(1). Keys COUNTYID/COUNTYCODE/COUNTYNAME/COUNTYENG; no feature ids.
- towns-10t: objects towns(368), counties(22), nation(1). Keys TOWNID/TOWNCODE/COUNTYNAME/TOWNNAME/TOWNENG/COUNTYID/COUNTYCODE/COUNTYENG.
- districts-10t: objects districts(74), counties(22), nation(1). Feature id = DISTRICTCODE, e.g. 64000-4.
- districts by prefix: 63000=8, 64000=8, 65000=12, 66000=8, 67000=6, 68000=6, 09007=1, 09020=1, 10002=1, 10004=2, 10005=2, 10007=4, 10008=2, 10009=2, 10010=2, 10013=2, 10014..10020 = 1 each (10014,10015,10016,10017,10018,10020), plus 1 id-less feature.
- Kaohsiung 64000 = 8 and Pingtung 10013 = 2 => the 2019/2020 map (not the 2008 map).
- Total: 73 id'd districts as expected, plus 1 stray id-less feature in the districts object (a Zhongli, Taoyuan village polygon, 自強里 VILLCODE 68000020009). Reviewer/Shane to decide; app may need to skip it.
- Pinned 2021.9.20 files give identical counts to the unpinned CDN ones.
- No legislative changes made.

## Smoke test (http.server 8765)
All 200: css/style.css, js/app.js, js/config.js, data/geo/* (3), legislative_2008/12/16/20/24, presidential_2008/12/16/20/24, magistrate_2018/22/26, council_2018/22/26, township_chief_2018/22/26.
404 (config references files that do not exist): magistrate_2009/2010/2014, council_2009/2010/2014, township_chief_2009/2010/2014 (9 files).
app.js: no hard-coded remote boundary URLs (no jsdelivr/githubusercontent hits).
Remaining remote deps in index.html (not changed): Google Fonts, unpkg leaflet@1.9.4 (css+js), unpkg topojson-client@3 (unpinned major), CARTO tiles in config.js.
In-browser console check: not done (reviewer).

## Skipped / Shane's steps
- GitHub Pages deploy needs a push: Shane's step.
- etl/validate.py n/a.
- No election data files edited.

## Open questions for Shane (left untracked, untouched)
- Keep or ignore: five "* Taiwanese legislative election - Wikipedia.pdf", "News Letter/", "~$rmosa_Dispatch_Newsletter_Plan.docx" (Office lock file; already matched by .gitignore ~$*), vote_data_fetcher.html, fetch_votes_v2.js, fetch_votes_v3.js.
- fetch_votes_v2.js vs v3.js are NOT byte-identical (cmp: differ at byte 5740, line 126).
- Confirm the working tree (commit 1) is the intended v21 baseline; no ~/Desktop/v21 exists.
- Pin topojson-client@3 to an exact version?
- Pre-2019 legislative years display on the post-2019 map (existing config note).
