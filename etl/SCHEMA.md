# CEC bulk-table schema (as verified in Phase 1)

Source: `~/data/db.cec.gov.tw/voteData/` (clone of kiang/db.cec.gov.tw; CEC `votedata.zip`). Format doc:
`voteData/選舉資料庫格式.odt` (v4, 2012). All files are headerless CSV, UTF-8 (with BOM on some); every file
read in Phase 1 decoded as UTF-8, `01_extract.py` falls back to cp950/big5hkscs. Some files (2008-2012) wrap codes
as `"'01"`; the loader strips whitespace and a leading apostrophe.

## Area key

`prv(2) county(3) district(2) town(3) village(4)` = 12 digits (`01_extract.area_key`). elprof/elctks add a
6th column, polling station (4 digits; `0`/`0000` = aggregate row).

* Special municipalities (and Taipei/Kaohsiung in 2008) carry `county = 000`; the city is identified by `prv`.
* Aggregation level of a row (identical in elctks and elprof):
  `prv=00` national; `town=000,village=0000,station=0` county; `town!=000,village=0000,station=0` town;
  anything else is village/station. The files already contain the county and town aggregate rows; Phase 1 uses
  them and cross-checks (sum of towns = county; sum of counties = national).
* `district` (選區) is 00 for mayor/president aggregate rows in most years but 01 in some rows of the 2008 file;
  it is ignored for president and mayor races (legislative races need it).
* Codes are NOT stable across years. 2016+ uses MOI household-registry codes (prv 63/64/65/66/67/68/10/09);
  2008-2012 uses CEC private codes (prv 01 Taipei, 02 Kaohsiung, 03 Taiwan Province counties, 04 Fujian ...; 2012
  prv 01-05 municipalities, 06 counties, 07 Fujian). **Areas are therefore joined by name via elbase**, never by
  raw code (`03_results.Geo`).

## Tables

| File | Cols (0-based) | Meaning |
|---|---|---|
| `elbase.csv` | 0 prv, 1 county, 2 district, 3 town, 4 village, 5 name | one row per area incl. aggregate rows (`town=000,village=0000` = county/city; `prv=00` = nation; district rows e.g. `臺北市第01選區` for legislative) |
| `elcand.csv` | 0-4 area key of the race, 5 ballot_no, 6 name, 7 party code, 8 gender (1 M, 2 F), 9 birth (ROC `YYYMMDD`), 10 age, 11 birthplace, 12 education, 13 incumbent (Y/N), 14 elected (`*`), 15 VP flag (`Y` = running mate row) | President: two rows per ticket (president row + VP row sharing ballot_no); the VP row has col 15 = `Y`, elected `*` is on the president row. Mayor: area key = county/city of the race. |
| `elctks.csv` | 0-4 area key, 5 station, 6 ballot_no, 7 votes, 8 share %, 9 elected (`*`) | candidate x area |
| `elpaty.csv` | 0 party code, 1 party name | codes differ by year (e.g. DPP=16 always, PFP=90, TPP=350 in 2022/2024, KMT=1); join by name |
| `elprof.csv` | 0-4 area key, 5 station, 6 valid, 7 invalid, 8 votes cast, 9 electorate, 10 population, 11 candidates, 12 elected, 13 cand male, 14 cand female, 15 elected male, 16 elected female, 17 electorate/population %, 18 turnout %, 19 elected/candidates % | share and turnout columns are percentages with 2 decimals |

Name quirks handled in `01_extract.py`: private-use code point U+E018 (江聰淵) is mapped to 聰; ballot names that
carry an English name after a space (`谷辣斯．尤達卡 Kolas Yotaka`) are split into name_zh and a CEC-sourced name_en.
2008-era names are as printed (e.g. 涂醒哲 vs the old file's 塗醒哲).

## Folder / race-code map used

`選舉種類代碼.xlsx` exists only in `2022-111年地方公職人員選舉` (C1 縣(市)長 with `city/` = 縣市 and `prv/` =
直轄市 subfolders; D1 鄉鎮市長; D2 直轄市原住民區長; R1-R3 民代表; T1-T3 議員; V1 村里長). All other folders are
named by office; codes below are assigned by analogy and are the only unclear mapping (see REPORT).

| election_id | folder(s) under voteData | office | CEC code |
|---|---|---|---|
| presidential_2008 | `20080322-總統` (a near-duplicate `2008 12任總統` exists; only polling-station village codes differ in ~110 rows, votes identical) | 總統副總統 | P1 (by analogy) |
| presidential_2012 | `20120114-總統及立委/總統` | 總統副總統 | P1 |
| presidential_2016 | `2016總統立委/總統` (files carry `_P1` suffix; `old/` subfolder not used) | 總統副總統 | P1 |
| presidential_2020 | `2020總統立委/總統` | 總統副總統 | P1 |
| presidential_2024 | `2024總統立委/總統` | 總統副總統 | P1 |
| magistrate_2009 | `20091205-縣市長縣市議員及鄉鎮長/縣市長` (17 counties/cities) | 縣市長 | C1 |
| magistrate_2010 | `20101127-五都市長議員及里長/市長` (5 municipalities) | 直轄市長 | C1 |
| magistrate_2014 | `2014-103年地方公職人員選舉/縣市市長` + `/直轄市市長` | 縣市長 + 直轄市長 | C1 |
| magistrate_2018 | `2018-107年地方公職人員選舉/縣市市長` + `/直轄市市長` | same | C1 |
| magistrate_2022 | `2022-111年地方公職人員選舉/C1/city` + `/C1/prv`; plus `2022年_嘉義市長重行選舉` (rerun, 2022-12-18) | same | C1 |

The Chiayi City rerun folder is NOT in the standard format: `cand.csv` (header: 號次,名字,政黨名稱) and `prof.csv`
(header row; one row per polling station: 行政區別 (東區/西區), 村里別, 投開票所別, candidate columns 號次1..5, 有效票數 A, 無效票數 B,
投票數 C, 已領未投票數 D, 發出票數 E, 用餘票數 F, 選舉人數 G, 投票率 H). It has no birth dates, incumbent or elected flags:
birth dates are resolved by exact name against other CEC candidate tables (unique match only), incumbent is derived
from the 2018 Chiayi City winner, elected from the highest vote count.
