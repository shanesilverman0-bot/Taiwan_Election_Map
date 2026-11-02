# Taiwan Election Tracker — Code Review & Build Roadmap

Oct 30, 2026 · @Shane

> Exported from the Claude Doc https://claude.ai/artifact/Q1mzde1nNFENnN4p9wXN8M (rev 10) on 2026-11-02. The doc is the master copy; one embedded timeline widget is not reproduced here.

## Bottom line

The tracker can ship a credible public 2026 edition by **Fri Nov 13**, but only if two things change first: you settle which copy of the code is the real one, and you stop hand-entering results from screenshots. Everything below follows from those two decisions.

**There are three copies of this app, and they disagree.**

| Copy | Where | app.js | What it has |
| --- | --- | --- | --- |
| Project files (this chat) | claude.ai project, Apr 17 | ~28 KB | Single map view, hemicycle. Reads `feature.id` for counties, which taiwan-atlas does not set, so county colors break. |
| GitHub `taiwan_election_map` | one commit, "initial commit", Apr 19 | 61 KB | Nav rail, Map/Tables/Compare/Notes tabs, `resolveDistrictName`, COUNTYID fix. Passes `node --check`. |
| `app_v21.js` baseline | your machine (per your Sept notes) | unknown | Adds Trends tab, PNG export, dual-axis charts. Never pushed. |

Action 1: locate `app_v21.js`, commit it to GitHub as-is, and treat that commit as the baseline. Nothing else in this plan should start before that commit exists. The project-file copy should be deleted from the claude.ai project so no future session patches the wrong file.

**Data coverage today (GitHub copy):**

- Presidential 2008–2024: complete at county level (22 units), hand-entered from Wikipedia screenshots. 2008 pre-merger counties combined correctly, with originals kept in `_meta`.
- Magistrate 2018 and 2022: present but **truncated to the top 2–3 candidates**. In 2022 Miaoli the listed candidates sum to 73.9% of the vote; Hsinchu City 80.7%; Penghu 70.0%. That drops major-party nominees, e.g. KMT's 林耕華 in Hsinchu City.
- Legislative: seat totals only, no district results. District keys in `districts.json` don't match the boundary file.
- Magistrate 2009/2010/2014, all council, all township: empty stubs. 2026: empty.

**The unlock is an ETL pipeline, not more screenshots.** The CEC publishes every result since the 1990s as bulk CSV. Your September note says that bulk file "exceeds token limits" — true when pasted into a chat, irrelevant when a Python script reads it on disk. A script run by Sonnet in Claude Code can generate every historical file in this app, complete and with all candidates, in an afternoon.

**What ships Nov 13 (v1.0):** the 22 mayor/magistrate races for 2026 with declared candidates, incumbents and polling; full history 2014–2022 regenerated from CEC data; presidential 2008–2024; town-level vote-share maps for presidential and mayoral races; shareable deep links and a clean figure-export mode for Substack; an About/Methods/Sources page; hosted on GitHub Pages. Election-night results go in on Nov 28–29. Legislative districts, councils, township chiefs and campaign finance follow in v1.1–v2 (Section 6).

## Code review findings

Reviewed against the GitHub copy (61 KB `app.js`, passes `node --check`), with differences from the project copy noted. I could not see `app_v21.js`; re-check items 4 and 8 against it.

| # | Severity | Area | Finding | Fix |
| --- | --- | --- | --- | --- |
| 1 | Blocker | Repo | Three divergent copies (Section 1). GitHub also contains junk folders `{css,js,data` and `elections,data` from a `mkdir -p {css,js,data/...}` run in a shell that didn't expand braces, plus `.DS_Store` and a `.textClipping` file. | Commit v21; delete junk; add `.gitignore`. |
| 2 | Blocker | Legislative | `districts.json` keys (`TPE-01`) don't match boundary keys (`63000-1`, per your notes). File has 75 entries for 73 seats: Kaohsiung 9 and Pingtung 3 are the **pre-2020** counts. Most `area` strings are wrong (Taipei 6th is Da'an, not Wenshan/Beitou). Nobody has confirmed whether `districts-10t.json` is the 2019 map or the 2008 map; the config itself says it may be the old one. | Regenerate the registry from CEC district definitions; verify boundary vintage by counting `64000-*` keys (8 = new map, 9 = old). |
| 3 | High | Data model | Party lives on the **person** in `politicians.json`. Wrong for switchers: Ko Wen-je ran IND in 2018, Chung Tung-chin IND in 2022, Kao Hung-an TPP in 2022 then left the party in 2023. `resolveWinnerParty` falls back to the registry party, so any winner entered with only `politician_id` gets the wrong color. | Party goes on each candidacy record; the person record carries no party. |
| 4 | High | Hemicycle | Seats are filled ring by ring, so each party becomes a concentric band (inner ring all DPP) instead of a wedge. The fallback count of district winners gives 73 seats labeled as the chamber. | Compute all seat positions, sort by angle, then assign parties. Label the fallback "district seats only". |
| 5 | High | 2026 mode | The app opens on magistrate 2026, which is empty, so first load is a grey map. There is no concept of incumbent, declared candidate, poll, or "too early to call"; the card badge always says WINNER. | Add a pre-election render mode: color by incumbent party (hatched), candidate cards with ballot number, polling with source and date. |
| 6 | High | Council, township | Council seats are multi-member SNTV constituencies spanning several towns; a per-town "winner" does not exist. Districts inside the six special municipalities have no elected chief (only the 6 indigenous districts do). Both layers will mislead as designed. | Council: dissolve towns into constituencies, show seats won by party. Township: grey out non-elected districts. |
| 7 | Medium | Magistrate years | 2009 covered 17 counties; 2010 only the 5 new municipalities. As separate tabs, each shows a mostly-grey map. 2014 is missing. | Merge into one "2009/10" cycle, or hatch "not contested this year". |
| 8 | Medium | Publishing | No URL state, so no figure can be linked or reproduced; no Open Graph tags for Substack link previews; no About/Methods/Sources page; no map-level figure export (Trends has PNG export per your notes). | `?layer=&year=&district=` deep links; a `?figure=1` mode that hides chrome and adds title, source line and logo. |
| 9 | Medium | Data integrity | All results are hand-typed from screenshots with no automated check. Found: truncated candidate lists (Section 1), 2008 Taichung/Kaohsiung shares summing to 99.0–99.3% after the merge, and 2022 Taitung DPP nominee entered as 劉照好 (likely 劉櫂豪). | Generate from CEC; add a `validate.py` that checks sums, winner = max votes, and names against the CEC candidate file. |
| 10 | Medium | Colors | NP `#FFD700` and NPP `#FBBE01` are near-identical; DPP green vs Green Party green vs TPP teal is risky for red-green colorblind readers. | Run a colorblind simulation; separate NP/NPP; use pattern or label for minor parties. |
| 11 | Low | Dependencies | `taiwan-atlas` loaded from jsDelivr with no version pin; a package update could silently change IDs. Leaflet loaded without SRI. | Pin versions, or vendor the boundary files into `data/geo/` for the published site. |
| 12 | Low | README | Out of date: says coverage starts 2016, tells users to download local GeoJSON the app never reads, and lists wrong county codes (Penghu is X, Taitung V, Lienchiang Z). | Rewrite after v1.0. |
| 13 | Low | Labels | 2008 results display as 新北市/臺中市 etc. Accurate after the merge, anachronistic for 2008. | Show "臺北縣 (now 新北市)" in pre-2010 views. |
| 14 | Low | Safety | Candidate strings go into `innerHTML` unescaped. Harmless while you author all data; not once you ingest third-party files. | Add an `esc()` helper at ingestion time. |

## Data audit: the two registries

The election files are mostly right; `politicians.json` is not. Cross-checking the registry against the inline names in `magistrate_2018/2022.json` shows the 2xxx block was filled with plausible-looking but wrong losing candidates, and several English names don't match their characters. Do not hand-repair it: regenerate it from the CEC candidate file (Section 4). The list below is what to expect the regeneration to change.

| ID | Registry says | Problem | Correct per your own 2022 data / record |
| --- | --- | --- | --- |
| 2006 | 鄭寶清, DPP, Taoyuan | Wrong person | DPP nominee 鄭運鵬 (Cheng Yun-peng) |
| 2021 | 鍾東錦, KMT | Wrong party for 2022 | Ran and won as IND after KMT expulsion |
| 2024 | 陳歐珀, DPP | 2018 nominee, not 2022 | 2022 nominee 江聰淵 |
| 2028 | "Chen Zheng-yang" 陳正昇 | Wrong person; English ≠ characters | DPP nominee 蔡培慧 (Tsai Pei-hui) |
| 2030 | 蔡志宏, DPP | Wrong person | DPP nominee 黃秀芳 |
| 2031 | "Zhang Li-shan" | Pinyin, not her own romanization | Chang Li-shan 張麗善 |
| 2034 | 蘇德清, KMT | Wrong person | KMT nominee 王育敏 |
| 2036 | "Cheng Li-ta" 鄭麗鈕 | Wrong person; English ≠ characters | KMT nominee 蘇清泉 |
| 2038 | 蕭碧玲, DPP | Wrong person | DPP nominee Kolas Yotaka 谷辣斯·尤達卡 |
| 2040 | 劉慶國, DPP | Wrong person | DPP nominee 劉櫂豪 (data file has 劉照好 — also wrong) |
| 2041 | 陳福海, KMT | Wrong party | IND on the 2022 ballot. Your data file says TPP ("secret member"); publish the ballot label and note later claims separately. |
| 2043 | 陳建名, KMT | Runner-up mislabeled | 2022 KMT incumbent was 賴峰偉; 陳建名 was Kinmen's KMT candidate |
| 2003, 2016 | 黃珊珊, 高虹安 = TPP | Static party | 黃 ran as IND in 2022; 高 left TPP in 2023 |

Two rules for the regenerated registry. First, a person record holds identity only (`name_zh`, `name_en`, birth year, Wikidata QID, photo); party sits on each candidacy. Second, English names come from a source (the person's own usage, Wikipedia, the LY or city government site), never from automatic romanization: Taiwan mixes Wade-Giles, Tongyong and personal spellings, and machine pinyin produces names like "Zhang Li-shan" that no one uses.

**`districts.json`**: 75 entries for 73 seats, with the old-map counts for Kaohsiung (9) and Pingtung (3), a typo ("Tainan 5nd"), and `area` strings that are mostly wrong. Replace it with two generated files, `legislative_districts_2008.json` and `legislative_districts_2020.json`, keyed to the boundary file's IDs and listing member towns/villages from the CEC's official district definitions.

## Data sources to acquire

One source covers most of the historical work: the CEC's election database, already mirrored and organized on GitHub by g0v developer Finjon Kiang in [kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) (data CC BY 4.0, maintained through May 2026). Its `voteData/` folder holds the raw CEC tables for every election from 1994 to 2024, including the 2008 legislative vote, the 2009/2010 split cycle, all three nine-in-one cycles, the 2022 Chiayi City rerun and post-2019 by-elections. Kiang's script pulls them from the CEC's own bulk file, `data.cec.gov.tw/選舉資料庫/votedata.zip`. Cite the CEC as source and Kiang's repo as the processing route.

**What the CEC tables look like** (verified on the 2022 county magistrate files). Every race type is five headerless CSVs:

| File | One row per | Key fields | Processing needed |
| --- | --- | --- | --- |
| `elbase.csv` | area, down to village (里) | prv, county, district, town, village codes; name | Concatenate codes into a 12-digit area key; crosswalk to the 11-digit village code in boundary files (Kiang documents ~10 villages with rare-character mismatches) |
| `elcand.csv` | candidate per race | ballot no., name, party code, gender, birth date (ROC calendar, e.g. `0740111`), age, birthplace, education, incumbent flag, elected flag (`*`) | Convert ROC dates; build person IDs from name + birth date; map party codes |
| `elctks.csv` | candidate × area | votes, vote share, elected flag | Pivot to per-area results; aggregate village → town → county |
| `elpaty.csv` | party | code → party name (e.g. `16` = 民主進步黨) | Map to your `CONFIG.parties` keys; everything unmapped → OTHER |
| `elprof.csv` | area | valid, invalid, total votes, electorate, turnout % | Turnout per area |

Some older years are Big-5 encoded, and each election folder uses CEC race-type codes (C1, D1, T1, R1, V1…) defined in an included `選舉種類代碼.xlsx`.

**Full source list**

| Need | Source | Coverage | Processing |
| --- | --- | --- | --- |
| All historical results | CEC `votedata.zip` via [kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) `voteData/` | 1994–2024, every race type, village level | ETL script (Section 5) |
| Already-processed shortcuts | Same repo: `data/2014`, `data/2018`, `data/2022` (one CSV per office), `report1.csv` (all candidates with birth year, party, incumbent flag) | 2014–2022 locals | Usable directly for the person registry |
| County, town, village shapes | taiwan-atlas (current) or MOI boundary data on data.gov.tw; village shapes keyed by 11-digit `VILLCODE` | Current boundaries | Pin and vendor into `data/geo/` |
| Legislative districts 2008 and 2020 | **Derive, don't download.** The CEC `elbase` for each legislative race assigns every village to a district; dissolve village polygons by that assignment (mapshaper) | Exact for both maps | Replaces the unverified taiwan-atlas and g0v files |
| Council constituencies | Same dissolve from council `elbase`; Kiang already built zones for 2014, 2018, 2022 and 2026, including the 2026 Hsinchu County redistricting that split Zhubei (10 → 11 zones) | 2014–2026 | Dissolve; seats by party per zone |
| 2026 candidates | CEC official candidate list with ballot numbers; [Wikipedia: 2026 Taiwanese local elections](https://en.wikipedia.org/wiki/2026_Taiwanese_local_elections) for English names | 22 executive races + Zhubei | Hand-curated JSON, ~110 rows |
| Polling | Per-race poll tables on Wikipedia (cite the pollster, not Wikipedia); My-Formosa monthly national poll; TVBS; TPOF | 2026 | Hand entry with pollster, field dates, n, house lean. **Publishing polls is banned from 10 days before the vote, Nov 18–28**; the tracker must freeze its polling display then |
| Election night | CEC live results site on Nov 28; full tables land in `votedata.zip` weeks later | 2026 | Hand-enter 22 executive totals that night; ETL later |
| Campaign finance | Control Yuan political donations platform (ardata.cy.gov.tw) | 2018 onward online | Candidates report within 3 months; the CY publishes within 6 months after that. **2026 data arrives mid-to-late 2027**, so the finance piece uses 2022 |
| English names, photos | Wikidata (QIDs, Commons image P18 with license), English Wikipedia, LY and city government sites | Notable people only | Never machine-romanize; minor candidates display in Chinese only |
| Legislative behavior (later) | Legislative Yuan open data (data.ly.gov.tw) | Bills, votes | v2 |

Photos: use only Wikimedia Commons images with attribution, or an initials-on-party-color placeholder. Do not lift photos from the CEC election bulletin (選舉公報); the candidate holds those rights.

## Target data model and ETL pipeline

Keep the app static (vanilla JS, Leaflet, JSON files, GitHub Pages). Put all data work in a Python pipeline whose final step writes JSON **in the shape `app.js` already reads**. That respects your no-rewrites rule: the front end gains fields, it doesn't change contracts.

**Layers**

1. `raw` — Kiang's repo cloned outside your project folder (`~/data/db.cec.gov.tw`). Never committed to your repo.
2. `etl/` — Python scripts, one per step: `01_extract.py` (read the five CEC tables per race, fix encoding and ROC dates), `02_people.py` (deduplicate people), `03_results.py` (aggregate village → town → county), `04_geo.py` (dissolve districts and constituencies), `05_export.py` (write app JSON), `validate.py`.
3. `data/canonical/` — six CSVs that are the single source of truth, committed to the repo so every published number is traceable.
4. `data/elections/`, `data/geo/`, `data/entities/` — generated. Never hand-edited again, except `data/curated/2026/*.json` (candidates, endorsements, polls) which `05_export.py` merges in.

**Canonical tables**

| Table | Columns | Notes |
| --- | --- | --- |
| `people.csv` | person_id, name_zh, name_en, name_en_source, birth_date, gender, wikidata_qid, wiki_url, photo_url, photo_license | person_id = first 8 hex of sha1(name_zh + birth_date). No party column. |
| `parties.csv` | party_key, cec_codes, name_zh, name_en | One key can map several CEC codes across years |
| `contests.csv` | contest_id, date, office, area_code, seats, boundary_set | e.g. `2022-magistrate-10004`; `boundary_set` drives `boundaryByYear` |
| `candidacies.csv` | contest_id, person_id, ballot_no, party_key (as on ballot), endorsed_by, incumbent, status, votes, vote_pct, elected | status: declared, registered, withdrawn, disqualified. Party lives here. |
| `results_area.csv` | contest_id, area_level, area_code, person_id, votes | Plus a turnout sibling from `elprof` |
| `polls.csv` (2026 only) | contest_id, pollster, field_start, field_end, n, mode, sponsor, person_id, share, source_url | House effects are analysis, not data; keep them in notes |

**Exports the app reads**

- `data/elections/{type}_{year}.json` — current shape, plus `ballot_no`, `incumbent`, `elected`, `status`, `endorsed_by` on each candidate and `seats` on council entries.
- `data/elections/towns/{type}_{year}.json` — new: town-level results for presidential and mayoral races (368 towns). This powers the swing and vote-share maps your analysis pieces need, and it is the single biggest upgrade over the current county-only view.
- `data/entities/politicians.json` — regenerated from `people.csv`, keyed by person_id, no party.
- `data/geo/legislative_2008.topo.json`, `legislative_2020.topo.json`, `council_{year}.topo.json` — dissolved boundaries.

**`validate.py` must pass before any commit:** listed votes sum to the CEC valid-vote total for each area; recomputed shares match within 0.01; exactly one `elected` per single-seat contest and the right count per council zone; every boundary feature has data or an explicit not-contested flag; every exported name matches `elcand`.

## Phased roadmap

v1.0 goes live **Fri Nov 13**, five days before the poll blackout begins on Nov 18, so the polling view is public while it is still legal to update. Election-night results go in Nov 28–29. Each phase ends at a gate Opus checks before the next starts.

[embedded content: build roadmap · Oct 31 to Nov 28, 2026]

Phases 1–3 overlap by a day each so Sonnet can start the next brief while Opus reviews the last.

1. **Phase 0 — Baseline and hygiene (Oct 31–Nov 1).** Commit `app_v21.js` and its matching `index.html`/`style.css`; delete junk folders, `.DS_Store`, the `.textClipping`; add `.gitignore`; turn on GitHub Pages. *Gate:* the live Pages URL loads the v21 build with no console errors.
2. **Phase 1 — ETL core (Nov 1–4).** Extract, people, results and export for presidential 2008–2024 and mayor/magistrate 2014, 2018, 2022, at county and town level. *Gate:* `validate.py` passes; Opus reviews a diff of regenerated vs hand-entered files (expect the missing third-place candidates to appear, nothing else to move).
3. **Phase 2 — 2026 tracker (Nov 3–7).** Curated 2026 file for the 22 executive races plus Zhubei mayor (candidates, ballot numbers, incumbents, endorsements, polls). Pre-election render mode: hatched incumbent-party fill, candidate cards without WINNER badges, a poll strip per race with pollster and field dates. Default landing view switches to 2026. *Gate:* all 23 races render; every poll has a source URL.
4. **Phase 3 — Publishing layer (Nov 6–11).** Deep links, `?figure=1` export mode, Open Graph tags, About/Methods/Sources page, town-level vote-share and swing maps, hemicycle fix, colorblind-safe palette, phone layout. *Gate:* Opus review plus you click every view on your phone.
5. **Launch v1.0 (Fri Nov 13).** Announce with the first Substack piece that uses it.
6. **Phase 4 — Legislative and councils (Nov 14–25).** Dissolve 2008 and 2020 district maps; legislative results 2008–2024 with the full 113-seat hemicycle; 2022 council seats by constituency. Build the election-night entry template and a results-mode toggle. Freeze poll display on Nov 18. *Gate:* v1.1 live by Nov 25.
7. **Election night (Nov 28–29).** Enter 22 executive results and Zhubei by hand from the CEC live site; switch 2026 to results mode; publish the first results figures.
8. **Phase 5 — Depth (Dec–Feb).** Full 2026 ETL once the CEC posts tables; 2026 councils and township chiefs; 2022 campaign finance from the Control Yuan platform; a partisan-lean index per town from presidential results; LY voting records.

Cut list if time runs short, in order: swing maps (keep vote-share), Open Graph tags, colorblind pass. Never cut `validate.py` or the Sources page: a public data project that gets a number wrong in its first week loses the portfolio value it was built for.

## Opus/Sonnet operating model

Opus plans and reviews in this claude.ai project; Sonnet executes in Claude Code inside the repo on your Mac, one phase per branch. Opus never reads whole files: it reads Sonnet's `REPORT.md`, `git diff --stat`, and the specific hunks it asks for. That keeps the expensive model on judgment and the cheap model on volume.

**The loop, per phase**

1. Paste the phase brief below into Claude Code running Sonnet, from the repo root.
2. Sonnet works on branch `phase-N`, ends by writing `reports/phase-N/REPORT.md`.
3. You paste `REPORT.md` and `git diff --stat main...phase-N` into this project chat.
4. Opus approves (you merge, Pages redeploys), or writes a fix brief, or asks for specific hunks.
5. Opus writes the next brief against what actually happened, not this plan.

**One deliberate change to your working rules.** "No rewrites, surgical patches, `node --check`" stays for `app.js`, `index.html`, `style.css` and `config.js`. "One data file per turn, Shane says next" retires: it existed because data was hand-entered, and scripts plus `validate.py` now catch errors faster than turn-by-turn review.

## 7. Phase briefs

### Brief 0: `CLAUDE.md` (commit once; Claude Code reads it every session)

```markdown
# Taiwan Election Map — standing rules
Static site (vanilla JS, Leaflet, JSON, GitHub Pages) for The Formosa Dispatch. Owner: Shane.
Opus (claude.ai) plans and reviews. You execute one phase brief at a time.

1. Work on branch phase-<n>. Never commit to main.
2. app.js, index.html, style.css, config.js: surgical patches only, never rewrite a file.
   Write each patch as a Python string-replacement script in tools/patches/, run it,
   then `node --check` every JS file. If a check fails, revert and report.
3. Never type election numbers by hand. Results come only from CEC tables via etl/.
   Hand-curated 2026 data lives only in data/curated/2026/.
4. Never machine-romanize a name. No sourced English name -> name_en = null.
5. Once etl/validate.py exists, run it before every commit; never commit on failure.
6. Never paste raw CSV or large JSON into your output. Summarize counts.
7. If a brief is ambiguous, write the question in REPORT.md and stop that task.
8. End each phase with reports/phase-<n>/REPORT.md: files changed, commands run,
   validate output, screenshots of changed views, open questions, anything skipped.
Raw CEC data lives at ~/data/db.cec.gov.tw. Never copy it into this repo.
```

(Superseded by the repo's `CLAUDE.md` and `.claude/agents/phase-executor.md`.)

### Brief 1: Phase 0 — baseline, hygiene, boundary check

```markdown
Phase 0. Branch: phase-0.
Context: three copies of the app exist. Shane has placed the canonical v21 files in
~/Desktop/v21/ (app_v21.js plus its index.html, style.css, config.js if they differ).

Tasks
1. Copy v21 files over js/app.js, index.html, css/style.css, js/config.js. This is a
   baseline restore, not a rewrite. `node --check` both JS files.
2. Delete the junk directories whose names start with "{css,js,data" and "elections,data",
   every .DS_Store, and electoral_system_briefing.textClipping. Add a .gitignore
   (.DS_Store, __pycache__/, .venv/, reports/**/scratch/).
3. Boundary audit. Write tools/inspect_boundaries.py that downloads the four boundary
   URLs in config.js and prints, per file: object names, feature count, property keys,
   the first 3 features' id + properties. For districts-10t.json also count keys by
   county prefix. Kaohsiung (64000) = 8 and Pingtung (10013) = 2 means the 2019 map;
   9 and 3 means the 2008 map. Put the output in REPORT.md.
4. Run `npm view taiwan-atlas version`. Download the counties and towns files at that
   version into data/geo/ and patch config.js to load them locally.
5. Serve with `python3 -m http.server`, load every layer/year, record console errors.

Done when: v21 loads from local files with zero console errors, junk is gone,
REPORT.md contains the boundary audit.
```

### Brief 2: Phase 1 — ETL core

```markdown
Phase 1. Branch: phase-1. Prereq: `git clone --depth 1 https://github.com/kiang/db.cec.gov.tw ~/data/db.cec.gov.tw`
Goal: regenerate presidential 2008-2024 and mayor/magistrate 2009/10, 2014, 2018, 2022
(incl. the 2022 Chiayi City rerun) from CEC tables, at county AND town level.

1. Read ~/data/db.cec.gov.tw/voteData/選舉資料庫格式.odt and each folder's
   選舉種類代碼.xlsx. Write etl/SCHEMA.md: column positions for elbase, elcand, elctks,
   elpaty, elprof, and which folder/code is which office. Write etl/elections.yaml mapping
   election_id -> folder, race code, office, date. Ask in REPORT.md if any mapping is unclear.
2. etl/01_extract.py: read headerless CSVs (try utf-8, fall back to cp950), strip
   whitespace, convert ROC dates (0740111 -> 1985-01-11), build 12-digit area keys.
3. etl/02_people.py: person_id = sha1(name_zh + "|" + birth_date)[:8]. Seed name_en ONLY
   from the current data/elections/*.json where name_zh matches exactly; else null.
   Log same-name/different-birthdate pairs to reports/phase-1/name_conflicts.csv.
4. data/canonical/parties.csv: map CEC party names to config keys (中國國民黨 KMT,
   民主進步黨 DPP, 台灣民眾黨 TPP, 時代力量 NPP, 親民黨 PFP, 台灣基進 TSP, 新黨 NP, 綠黨 GP,
   台灣團結聯盟 TSU, 無黨籍及未經政黨推薦 IND); everything else OTHER with name_zh kept.
5. etl/03_results.py: aggregate to county (5-digit code) and town. Pre-2010 elections:
   merge 臺北縣->65000, 桃園縣->68000, 臺中縣+臺中市->66000, 臺南縣+臺南市->67000,
   高雄縣+高雄市->64000. Derive the old codes from elbase names and print the crosswalk
   in REPORT.md; do not trust this list blindly. Town crosswalk by name; report unmatched.
6. etl/05_export.py: write data/elections/{type}_{year}.json in the CURRENT schema
   (keys = county letters per CONFIG.countyIdToCode), ALL candidates, plus ballot_no,
   incumbent, elected. Write data/elections/towns/{type}_{year}.json keyed by TOWNCODE.
   Regenerate data/entities/politicians.json from people.csv with no party field.
   Move each old file's _meta.notes to _meta.legacy_notes untouched; Opus will edit them.
7. etl/validate.py: per area, candidate votes sum to elprof valid votes; shares
   recompute within 0.01; exactly one elected per single-seat race; every county in
   the boundary file has an entry or `not_contested: true`.

Do not edit app.js. Do not touch legislative_*.json, council_*, township_*.
REPORT.md must include a table per regenerated file: old vs new candidate count,
and ANY vote figure that changed (expected: none, only added candidates).
```

### Brief 3: Phase 2 — 2026 tracker

```markdown
Phase 2. Branch: phase-2. Inputs: data/curated/2026/candidates_seed.csv and
polls_seed.csv (Shane provides). Zhubei City mayor is office township_chief, TOWNCODE
for 竹北市 from the towns file.

Data
1. etl/06_curated_2026.py: validate the seeds (each row has contest, name_zh, party_key,
   status, source_url), match people to people.csv by name_zh (+ birth year if given),
   write magistrate_2026.json and township_chief_2026.json with _meta.status =
   "pre-election", and polls into each race entry. Incumbents come from the 2022 export.

App patches (surgical, via tools/patches/, node --check after each)
2. Pre-election fill: if _meta.status === "pre-election", fill each area in the
   incumbent's party color at 0.18 opacity with a dashed border; legend row
   "Incumbent party (pre-election)".
3. Candidate cards: show ballot_no, an INCUMBENT tag, "Backed by X" from endorsed_by,
   status badge for withdrawn/disqualified. Show the WINNER badge only when
   elected === true. Pre-election sort = ballot number.
4. Poll strip under the cards: last 5 polls, pollster, field dates, n, shares,
   source link. From 2026-11-18 add the line: "Taiwanese law bars publishing new polls
   in the 10 days before the vote. Showing the last polls released before Nov 18."
5. Default landing view: magistrate 2026.
6. If an entry has fd_rating, show it as "Formosa Dispatch rating: Leans DPP".

Done when: 22 counties + Zhubei render in pre-election mode, every poll links to a
source, validate.py passes, screenshots of Taipei, New Taipei, Hsinchu County, Zhubei.
```

### Brief 4: Phase 3 — publishing layer

```markdown
Phase 3. Branch: phase-3.
1. URL state: read and write ?layer=&year=&area=&level=county|town&lang=&figure=
   with history.replaceState; apply on load. Every view must be reachable by URL.
2. Figure mode (?figure=1&title=...): hide nav rail, sidebar, tab bar, zoom controls;
   show title, legend and the source line "Data: Central Election Commission via
   kiang/db.cec.gov.tw · The Formosa Dispatch". Add an Export PNG button using
   html-to-image from cdnjs; if map tiles block export, report it.
3. Town level: add level=town for presidential and magistrate, reading
   data/elections/towns/. Modes: winner (party color, opacity by margin), party share
   (sequential scale), swing between two chosen years (diverging scale, white at 0).
4. Hemicycle: compute every seat position, sort by angle from left to right, then
   assign parties in order, so parties form wedges. Label a fallback count
   "district seats only".
5. index.html: meta description, Open Graph and Twitter tags, favicon.
6. about.html (new file): Opus supplies the text; you format it in the site style.
7. Palette: simulate deuteranopia/protanopia for CONFIG.parties; separate NP and NPP;
   propose any other change in REPORT.md without applying it.
8. Test at 390 px width; list layout bugs; fix only overflow and unreadable text.

Done when: five sample URLs from Shane reproduce the same view on a fresh load,
PNG export works or the failure is documented, validate.py passes.
```

Phase 4 (legislative districts and councils) gets its brief after Phase 0 reports the boundary audit and Phase 1 shows how the ETL behaves; writing it now would be guessing.

## Sources

- [kiang/db.cec.gov.tw](https://github.com/kiang/db.cec.gov.tw) — CEC raw tables 1994–2024 and processed council zones; inspected directly (file tree, 2022 magistrate tables, `votedata.py`, data license)
- [shanesilverman0-bot/taiwan_election_map](https://github.com/shanesilverman0-bot/taiwan_election_map) — GitHub copy reviewed
- [The Reporter: political donations data analysis](https://www.twreporter.org/a/data-reporter-2024-election-political-donations) — Control Yuan disclosure timelines
- [Wikipedia: 2026 Taiwanese local elections](https://en.wikipedia.org/wiki/2026_Taiwanese_local_elections) — 2026 candidate list
- Project files: `app.js`, `config.js`, `districts.json`, `politicians.json`, `README.md` (claude.ai project copy)
