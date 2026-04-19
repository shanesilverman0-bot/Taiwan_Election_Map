# Taiwan's Electoral System Since 2008 — A Briefing

*Prepared for The Formosa Dispatch / 宋山明*

## Executive Summary

Taiwan's modern electoral system took shape with constitutional amendments passed by the Legislative Yuan in August 2004, ratified by the National Assembly in June 2005, and first implemented in the **January 2008 legislative elections**. The reforms were radical: they halved the number of legislators, abandoned the decades-old SNTV multi-member district system, extended terms from three to four years, and created the parallel two-vote system Taiwan uses today.

For your project, starting from 2008 is the right call. The pre-2008 system is a fundamentally different animal — comparing it to current results would be misleading.

---

## Three Types of Elections, Four-Year Cycles

Taiwan consolidated its elections into two main categories, each on its own four-year cycle, staggered two years apart:

**National elections** (every four years, January):
- Presidential & Vice-Presidential (jointly elected, first-past-the-post)
- Legislative Yuan (113 members, mixed system — see below)

**Local elections** — the 九合一 "nine-in-one" (every four years, late November):
- Six special-municipality mayors (直轄市長)
- Sixteen county magistrates and city mayors (縣市長)
- Six special-municipality councilors (直轄市議員)
- Sixteen county/city councilors (縣市議員)
- Township/district mayors (鄉鎮市長)
- Township/district councilors (鄉鎮市民代表)
- Village/borough chiefs (村里長)
- Indigenous district chiefs (山地原住民區長)
- Indigenous district councilors (山地原住民區民代表)

---

## Legislative Yuan: The 2008 Reform

### Pre-2008 System (ended January 2008)
- **225 seats total**
- Single non-transferable vote in multi-member districts (SNTV-MMD)
- Three-year terms
- Each district elected several legislators; voters cast one vote for one candidate; top vote-getters won
- Encouraged intra-party competition and clientelist "vote allocation" strategies

### Current System (from January 2008 onward)
- **113 seats total**
- Four-year terms
- **Parallel voting (mixed-member majoritarian, MMM)** — voters cast TWO ballots:

  1. **District ballot (區域立委)** — elects **73 legislators** by first-past-the-post in single-member districts. Winner is simply whoever gets the most votes.

  2. **Party ballot (不分區立委)** — elects **34 at-large legislators** by proportional representation from closed party lists. A **5% national threshold** applies. Half the list seats must be women (gender quota).

- **6 Indigenous seats** — elected separately by single non-transferable vote in two three-member constituencies (3 lowland 平地原住民, 3 highland 山地原住民). Indigenous citizens choose which roll to vote on.

### Why the System Matters
- The 73 district seats reward geographical strongholds; the 34 list seats reward vote share and are the path for small parties (TPP, NPP) to enter the legislature.
- The parallel nature of the list — not compensatory — "rewards large parties such as the KMT and the DPP"; small parties struggle unless they clear 5%.
- Legislator behavior changed measurably after the reform: research shows SMD legislators make fewer geographically-targeted parliamentary questions than their SNTV predecessors.

---

## District Maps: Two Different Boundaries

Article 37 of the Civil Servants Election and Recall Act requires boundaries to be revised **every 10 years** based on population.

### Map 1: Used for 2008, 2012, 2016 legislative elections
- Boundaries drawn in 2007 by the Central Election Commission
- 73 single-member districts + 6 indigenous seats
- Held for three cycles

### Map 2: Used from 2020 onward (includes 2024)
- Redrawn in 2019 after negotiations between the presidents of the Executive and Legislative Yuans
- Still 73 single-member districts, but with these seat reallocations:
  - **Kaohsiung** lost one seat (from 9 to 8)
  - **Pingtung** lost one seat (from 3 to 2)
  - **Tainan** gained one seat (from 5 to 6)
  - **Hsinchu County** gained one seat (from 1 to 2)
  - The boundary between **Taichung II and Taichung VII** was adjusted

**Implication for your project:** You need two different legislative district GeoJSONs — one for 2008/2012/2016, and one for 2020/2024. The 2028 election will use the same map as 2020/2024 unless the CEC revises before then.

---

## Election Timeline (2008 onward)

| Year | Date | Election | Notes |
|------|------|----------|-------|
| 2008 | Jan 12 | Legislative | First under new 113-seat system. KMT supermajority (86 seats). |
| 2008 | Mar 22 | Presidential | Ma Ying-jeou (KMT) defeats Frank Hsieh. |
| 2009 | Dec 5 | Local (3-in-1) | Magistrates, councilors, township chiefs. |
| 2010 | Nov 27 | Special municipality | Mayors of Taipei, New Taipei, Taichung, Tainan, Kaohsiung. |
| 2012 | Jan 14 | Presidential + Legislative | First time held together. Ma re-elected. |
| 2014 | Nov 29 | **First 九合一 (nine-in-one)** | All local elections consolidated onto one day. DPP landslide. |
| 2016 | Jan 16 | Presidential + Legislative | Tsai Ing-wen wins; DPP takes LY majority for first time. |
| 2018 | Nov 24 | 九合一 | KMT rebound; DPP defeated. Held with 10 referendums. |
| 2020 | Jan 11 | Presidential + Legislative | Tsai re-elected. **First use of new district map.** |
| 2022 | Nov 26 | 九合一 | DPP's worst-ever local performance; Tsai resigns party chair. |
| 2024 | Jan 13 | Presidential + Legislative | Lai wins; **no party majority in LY** — KMT 52, DPP 51, TPP 8, IND 2. |
| 2026 | Nov 28 (est.) | 九合一 | **Upcoming.** |
| 2028 | Jan (est.) | Presidential + Legislative | **Upcoming.** |

---

## Presidential Elections

Simplest system on the ballot: **first-past-the-post, direct popular vote**. President and Vice President run on a joint ticket; whichever ticket wins the most votes wins, no runoff, no majority requirement. Four-year terms, maximum of two consecutive terms (the "8-year rule").

Candidates must be at least 40, have 15 years of ROC domicile, and either (a) be nominated by a party that cleared 5% in the last national election, or (b) gather petition signatures from at least 1.5% of the voters in the last legislative election.

---

## Local Elections: A Quick Anatomy

The 九合一 is ballot-heavy — citizens vote in up to nine separate races depending on where they live. Key things to know:

- **Special municipality mayors (直轄市長):** Taipei, New Taipei, Taichung, Tainan, Kaohsiung, Taoyuan (elevated to special municipality status in 2014). These are the most politically significant local races — a stepping stone to the presidency (Lai, Tsai, Chen Chu, Han Kuo-yu, Hou Yu-ih all came through this route).
- **County magistrates / city mayors (縣市長):** 16 jurisdictions outside the six special municipalities.
- **Councilors:** Elected by **SNTV in multi-member districts** — this is the one holdover of the pre-2008 system. The council constituencies (議員選區) are drawn separately from legislative districts and cover multiple towns each.
- **Town/district mayors (鄉鎮市長):** Elected in all ordinary counties but NOT in the six special municipalities (where districts are administrative, not self-governing).
- **Village/borough chiefs (村里長):** Smallest elected unit; ~7,700 of them nationwide.

---

## Key References for the Project

1. **Central Election Commission official site** — https://www.cec.gov.tw (data portal at https://db.cec.gov.tw)
2. **Taiwan government open data portal** — https://data.gov.tw/dataset/13119 (CEC candidate & district data, CSV format, free license)
3. **Wikipedia election articles** — Generally accurate, well-sourced, good for quick lookups
4. **Legislative Yuan elections** — https://en.wikipedia.org/wiki/Legislative_Yuan_elections
5. **Elections in Taiwan overview** — https://en.wikipedia.org/wiki/Elections_in_Taiwan

---

*Last updated: April 2026. This document is meant as a working reference for the Taiwan Election Map project and The Formosa Dispatch; corrections welcome.*
