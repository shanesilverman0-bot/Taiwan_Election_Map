# Phase 1 report: ETL core

Branch `phase-1` (from main). Nothing pushed or merged. js/, index.html, css/ untouched. validate.py passes (output below).

## Setup
* Raw data: `git clone --depth 1 --filter=blob:none --sparse https://github.com/kiang/db.cec.gov.tw ~/data/db.cec.gov.tw`, then `git sparse-checkout set voteData`. GitHub API repo size 581,578 KB (so sparse was used). On disk: 936 MB total, `voteData/` 805 MB. Outside the repo.
* Python: system Anaconda python 3.11.4 already has pandas/openpyxl/pyyaml. No venv created. Pipeline uses stdlib + pyyaml (openpyxl only to read the 2022 race-code xlsx by hand). All scripts run as `python3 -I etl/<script>.py`.

## Commands run (in order)
`python3 -I etl/02_people.py` ; `python3 -I etl/03_results.py` ; `python3 -I etl/05_export.py` ; `python3 -I etl/compare_legacy.py` ; `python3 -I etl/validate.py` (01_extract is a library, `python3 -I etl/01_extract.py <election_id>` prints row counts).

## Files changed / added
* `etl/`: SCHEMA.md, elections.yaml, common.py, 01_extract.py, 02_people.py, 03_results.py, 05_export.py, validate.py, compare_legacy.py (04_geo.py not in this brief).
* `data/canonical/`: people.csv (270), parties.csv, contests.csv (93), candidacies.csv (353), results_area.csv (10,929), turnout.csv (3,515; elprof valid/invalid/total/electorate/turnout, plus CEC's own turnout for tie-out), plus two seed snapshots `seed_names_legacy.csv` / `seed_wiki_legacy.csv` taken from the old hand-entered files before they were overwritten.
* `data/elections/`: regenerated presidential_{2008,2012,2016,2020,2024}.json, magistrate_{2018,2022}.json; NEW magistrate_{2009,2010,2014}.json; NEW `towns/{same 10 names}.json` keyed by TOWNCODE.
* `data/entities/politicians.json`: regenerated (270 people keyed by person_id, no party; name_zh, name_en, birth_year, wikidata_qid, wiki_url, photo).
* `reports/phase-1/`: REPORT.md, validate_output.txt, changed_figures.csv, party_label_changes.csv, old_vs_new.md, county_crosswalk.csv, town_crosswalk.csv, name_conflicts.csv, name_en_seed_unresolved.csv, etl_checks.txt (empty).
* Not touched: legislative_*, council_*, township_chief_*, *_2026, districts.json, js/, css/, index.html.

## validate.py
`reports/phase-1/validate_output.txt`: **PASSED checks: 32,293, FAILED checks: 0** (exit 0). Covers: per area (county and town) candidate votes = elprof valid votes; shares recompute within 0.01; exactly one elected per race and elected = plurality; JSON winner = plurality; every county in counties-10t has candidates or `not_contested`; every exported name_zh occurs in elcand (and in people.csv); raw tie-out of county valid/electorate and national totals straight from elprof/elctks; towns sum to county, and (presidential) to national; town keys exist in towns-10t.json (all 368 present for each presidential file); CEC's own turnout column agrees within 0.01 (87 non-merged county rows); registry has no party field.

## Person registry dependency check
Grepped data/elections/*.json, data/entities/districts.json, js/app.js, js/config.js, index.html for politician IDs. Only the 7 regenerated files (presidential x5, magistrate_2018/2022) used `politician_id`; legislative_*, council_*, township_chief_*, *_2026 do not. So `politicians.json` was overwritten (no `people.json` fallback needed). `politician_id` in the new files = person_id (8 hex). Each candidate entry also carries name_zh, name_en, party (as on the ballot), ballot_no, incumbent, elected. `party_name_zh` is added only when party = OTHER.

## County crosswalk (derived from elbase names, not assumed)
Only these CEC names differ from the current county names (everything else matches counties-10t directly after 臺/台 normalisation):
臺北縣 (03/001) -> 65000; 桃園縣 (03/003 in 2008, 06/002 in 2012, 03/003 in 2009) -> 68000; 臺中縣 (03/006) + 臺中市 (03/019) -> 66000; 臺南縣 (03/011) + 臺南市 (03/021) -> 67000; 高雄縣 (03/012) + 高雄市 (02/000) -> 64000; 臺北市 (01/000) -> 63000. The brief's list was correct; only 2008 needed county merging (2012 already used 新北市 etc.; 桃園縣 voted as a county until 2014). Full per-election table: `county_crosswalk.csv`. The 4 "unmatched" rows there are the 臺灣省/福建省 province aggregate rows in 2020/2024 elbase (no votes attached; ignored).

## Unmatched towns
None. Each presidential file has all 368 towns; 2009 has 223 (17 counties), 2010 145, 2014/2018 368, 2022 368 (incl. Chiayi City 東區/西區 from the rerun). Pre-2010 鄉/鎮/市 -> 區 handled by exact name, then unique name-stem match (123 in 2008, 15 in 2012, 15 in 2009, 2 in 2014; list in `town_crosswalk.csv`). Two special cases coded: 高雄縣三民鄉 -> 那瑪夏區 (a plain stem match wrongly hit old Kaohsiung City 三民區; caught by a collision guard) and 臺南市 中區+西區 -> 中西區 (not actually triggered: CEC 2008 elbase already uses 中西區). A collision guard writes to `etl_checks.txt`, and validate.py fails if it is non-empty.

## Per-file tables (old vs new candidate entries; per-county detail in old_vs_new.md)
| file | old | new | note |
|---|---|---|---|
| presidential_2008 | 44 (22x2) | 44 | same candidates |
| presidential_2012 | 66 | 66 | Soong label changed PFP -> IND (see below) |
| presidential_2016 | 66 | 66 | |
| presidential_2020 | 66 | 66 | |
| presidential_2024 | 66 | 66 | |
| magistrate_2009 | n/a (new) | 54 | 17 contested; 5 municipalities `not_contested` |
| magistrate_2010 | n/a (new) | 14 | 5 contested; 17 counties `not_contested` |
| magistrate_2014 | n/a (new) | 84 | 22 contested |
| magistrate_2018 | 46 (top-2/3 only) | 93 | added candidates |
| magistrate_2022 | 45 | 94 | added candidates; Chiayi City from rerun (2022-12-18) |

Schema decision: counties not voting that year are written as `{name_zh, name_en, not_contested: true, candidates: []}` (the schema allows it; app code reads `d.candidates||[]`/`d.winner?` safely by inspection, but I did not run the app; note `app.js` line ~1151 counts all keys, so a "N counties" label will count not_contested ones). 2010 files: `magistrate_2009.json` = 17 counties, `magistrate_2010.json` = 5 municipalities (as config.js requests).

## Changed vs old hand-entered files (OWNER MUST APPROVE; all in `changed_figures.csv`, 68 rows, + `party_label_changes.csv`, 27 rows)
Counts: vote totals changed 5 entries; vote_pct changed in 27 entries (18 are exactly +-0.01, rounding, 2012 and 2016); turnout changed in 27 entries; electorate changed in 2; unmatched old candidates 7 (old file named the wrong person or a spelling variant); party labels 27 rows.
Substantive (not rounding):
* presidential_2008 (merged counties; old pcts did not match the old merge): B Taichung Ma 59.59 -> 60.03, Hsieh 39.69 -> 39.97; D Tainan Ma 47.26 -> 46.66, Hsieh 53.01 -> 53.34 (old pair summed to 100.27); E Kaohsiung Ma 49.73 -> 50.25, Hsieh 49.23 -> 49.75; D electorate 2,432,406 -> 1,432,399 (typo in old file); turnout B 76.96 -> 76.99, D 75.18 -> 75.43, E 78.18 -> 77.93. (Vote counts for these counties are identical to the old file; only the old percentages/electorate/turnout were wrong or differently based. The 2008 merged sums match the old `pre_merger_data` block.)
* presidential_2024: Taipei (A) Lai votes 587,897 -> 587,899 (+2); turnout C 70.57 -> 70.58, J 73.45 -> 73.46.
* magistrate_2018 Taipei (A): Ko 580,820 -> 580,663 (-157), Ting 577,566 -> 577,096 (-470), Yao 244,302 -> 244,342 (+40); turnout 65.37 -> 65.95. Likely the post-recount CEC figures, unverified. Kinmen (W) Yang Chen-wu pct 47.48 -> 47.78. Turnout differs in all 22 counties by +0.6 to +4.2 points (old file used a different base; new = votes cast / electorate and matches CEC's own turnout column).
* magistrate_2022 Taipei (A): Huang Shan-shan 347,589 -> 342,141 (25.54 -> 25.14%); Chiayi (I) electorate 93,813 (was the valid-vote count) -> 214,130.
* Old-file rows with no CEC match: 2018 Tainan 許添財 153,699 (CEC has 林義豐, 許忠信, 陳永和, 蘇煥智 as independents, none with that total); 2018 Chiayi City 塗醒哲 = CEC spelling 涂醒哲 (same votes); 2018 Hsinchu County old "許欣盈 DPP 91,190" = CEC 徐欣瑩 (party OTHER) 91,190, with DPP's 鄭朝方 78,170 absent from the old file; 2018 Taitung 劉曉薇 (DPP) 44,264 = CEC 劉櫂豪; 2022 Yilan 江聰淵 spelled with a private-use char in CEC (I normalised to 聰); 2022 Taitung 劉照好 -> CEC 劉櫂豪; 2022 Lienchiang old 曹爾忠 -> CEC 曹爾元. All other old figures for matched candidates are identical.
* Party labels (CEC ballot label wins): Soong 2012 PFP -> IND (CEC lists him as 無黨籍及未經政黨推薦; this changes his map colour; owner decision), 2018 Miaoli 徐定禎 DPP -> IND, 2018 Lienchiang 朱秀珍 DPP -> IND, 2022 Taipei 黃珊珊 TPP -> IND, 2022 Kinmen 陳福海 TPP -> IND. Note the new ballot data have more independents (e.g. 2022 Kinmen). Party for NSU: 無黨團結聯盟 maps to the existing config key NSU (not in the brief's list).
* legacy `_meta.notes` moved to `_meta.legacy_notes` verbatim; remaining old `_meta` text (source, ballot_order, boundary_note, `pre_merger_data`, hand-entered candidate list) kept verbatim in `_meta.legacy_meta`.

## Decisions and judgement calls (flag for review)
1. name_en: seeded only from exact name_zh matches in the pre-ETL election files (snapshot in `seed_names_legacy.csv`): 91 of 270 people have one. 6 names with conflicting legacy spellings are left null (`name_en_seed_unresolved.csv`). I additionally blocked 張麗善 -> "Zhang Li-shan" (pinyin per the roadmap audit). One English name comes from the CEC ballot itself (Kolas Yotaka). Legacy seeds are hand-entered, not independently sourced; owner may want to audit.
2. wiki_url (outside the brief): 27 people keep the Wikipedia link from the old registry by exact name match (otherwise the popup would lose its "Wikipedia" links). No photos.
3. person_id uses ISO birth date (always a full date in all 13 sources). 0 same-name/different-birthdate conflicts (name_conflicts.csv is header-only). Running mates are people rows too (candidacies.csv `running_mate_person_id`).
4. 2022 Chiayi City rerun: candidates 陳泰山, 黃宏成..., 李俊俋, 黃敏惠 matched to birth dates by exact name in other CEC tables (unique match); this is name-only, so verify 陳泰山 and 黃宏成. 鄭凱升 has no birth date (person_id from name only). Incumbent flag derived from the 2018 winner; elected from highest votes.
5. Two folders for 2008 president; `20080322-總統` used, `2008 12任總統` differs only in ~110 polling-station village codes (votes identical).
6. CEC race codes: only the 2022 folder ships the code xlsx; other years' codes (P1, C1) are by analogy. `etl/elections.yaml` records this.
7. vote_pct is recomputed (votes / valid, half-up, 2 dp) and agrees with CEC shares within 0.01 everywhere. Pre-2010 turnout and electorate are sums over merged areas.
8. `_meta.races`, `valid_votes`, `registered`, `turnout_national` added (computed from CEC); `date_chiayi_city` kept.
9. Nothing skipped.

## Scout: legislative district membership (village -> district) for the next phase
Folders: `2008立委/{區域,山原,平原}`, `20120114-總統及立委/區域立委`, `2016總統立委/區域立委` (files suffixed `_T1`; an `old/` copy exists), `2020總統立委/區域立委`, `2024總統立委/區域立委` (the elbase file is misspelled `elbese.csv`).
* Yes, elbase carries the district code: column 2 (選區) is non-00 on every village row; 73 districts each year (2008/2012/2016: 7,807/7,807/7,825 villages; 2020: 7,737; 2024: 7,877). Each file also has the 73 `...第NN選區` rows. 12 towns (41 in 2024) are split across districts, so assignment must be done at village level, which the file allows.
* Village codes: 2016+ elbase uses MOI codes, so 12-digit key -> 11-digit VILLCODE is `prv+county+town+village[1:]` (e.g. 63 000 110 0027 -> 63000110027); ~25-130 polling-station rows per year use letter-prefixed custom codes for multi-village stations (see 投票所跨村里表). 2008 and 2012 use CEC private town/village codes (e.g. 北投區 = 001, not 120), so they must be joined to a village boundary file by county+town+village NAME (7,807 villages; my name join to current towns resolved all 2008/2012 towns, villages not yet tested). 2008 uses pre-merger county numbering.
* There is no village boundary file in the repo (only counties, towns, and districts-10t.json, which has one stray village polygon); taiwan-atlas villages (VILLCODE) would be needed, plus the CEC's rare-character mismatches noted by Kiang (~10 villages).
* Cross-year: 2012 vs 2016 memberships agree on every village that matches by name (0 differences on 7,608; ~200 villages unmatched each way from renames/splits); 2008 vs 2012 differ mainly because the municipalities were renumbered after the 2010 mergers. 2008-2016 on one "2008 map" is therefore feasible from 2012/2016 elbase for the 22 counties, with 2008 needing a crosswalk. Difficulty: moderate (name join for 2008/2012, MOI-code join for 2016+), with a few hundred villages needing manual review.
