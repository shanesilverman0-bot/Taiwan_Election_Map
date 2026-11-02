"""Step 2: build the person registry (data/canonical/people.csv).

person_id = sha1(name_zh + "|" + birth_date)[:8], birth_date as ISO YYYY-MM-DD from elcand (empty if absent).
name_en is seeded ONLY from the legacy hand-entered election files (snapshotted in
data/canonical/seed_names_legacy.csv) where name_zh matches exactly and is unambiguous; otherwise null.
No machine romanisation, ever.

    python3 -I etl/02_people.py            # writes people.csv + reports/phase-1/name_conflicts.csv
"""
import csv
import glob
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

X = common.load_step("01_extract")

# Legacy English names known to be machine pinyin / wrong per docs/ROADMAP.md data audit. Never seeded.
BAD_LEGACY_NAME_EN = {"張麗善": "Zhang Li-shan (pinyin; roadmap audit says she uses Chang Li-shan, unsourced in repo)"}

SEED = os.path.join(common.CANON, "seed_names_legacy.csv")

# Name -> birth-date lookup pool for candidates whose source file has no birth date (2022 Chiayi rerun).
LOOKUP_FOLDERS = [
    "2008立委/區域", "2008立委/山原", "2008立委/平原",
    "20120114-總統及立委/區域立委", "20120114-總統及立委/山地立委", "20120114-總統及立委/平地立委",
    "2016總統立委/區域立委", "2016總統立委/山地立委", "2016總統立委/平地立委",
    "2020總統立委/區域立委", "2020總統立委/山地立委", "2020總統立委/平地立委",
    "2024總統立委/區域立委", "2024總統立委/山地立委", "2024總統立委/平地立委",
]


def snapshot_legacy_names():
    """One-off snapshot of (name_zh, name_en, file) pairs in the pre-ETL hand-entered files.
    Run before 05_export overwrites them; afterwards the CSV is the seed source."""
    pairs = []

    def walk(o, fn):
        if isinstance(o, dict):
            if isinstance(o.get("name_zh"), str) and isinstance(o.get("name_en"), str) and o["name_zh"] and o["name_en"]:
                pairs.append((o["name_zh"], o["name_en"], fn))
            for rm in ("running_mate",):
                if isinstance(o.get(rm + "_zh"), str) and isinstance(o.get(rm + "_en"), str):
                    pairs.append((o[rm + "_zh"], o[rm + "_en"], fn))
            for v in o.values():
                walk(v, fn)
        elif isinstance(o, list):
            for v in o:
                walk(v, fn)

    for p in sorted(glob.glob(os.path.join(common.REPO, "data/elections/*.json"))):
        walk(json.load(open(p, encoding="utf-8")), os.path.basename(p))
    seen, rows = set(), []
    for z, e, f in pairs:
        if (z, e, f) not in seen:
            seen.add((z, e, f))
            rows.append((z, e, f))
    with open(SEED, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name_zh", "name_en", "source_file"])
        w.writerows(rows)
    return rows


SEED_WIKI = os.path.join(common.CANON, "seed_wiki_legacy.csv")


def snapshot_legacy_wiki():
    """Snapshot (name_zh, wiki_url) from the pre-ETL data/entities/politicians.json so existing Wikipedia links
    in the popup survive the registry regeneration. Only exact name_zh matches are used (see build())."""
    reg = json.load(open(os.path.join(common.REPO, "data/entities/politicians.json"), encoding="utf-8"))
    rows = [(v["name_zh"], v["wiki_url"], k) for k, v in reg.items()
            if k != "_meta" and v.get("name_zh") and v.get("wiki_url")]
    with open(SEED_WIKI, "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name_zh", "wiki_url", "legacy_politician_id"])
        w.writerows(rows)


def load_wiki():
    if not os.path.exists(SEED_WIKI):
        snapshot_legacy_wiki()
    d = defaultdict(set)
    for r in csv.DictReader(open(SEED_WIKI, encoding="utf-8")):
        d[r["name_zh"]].add(r["wiki_url"])
    return d


def load_seed():
    if not os.path.exists(SEED):
        snapshot_legacy_names()
    d = defaultdict(lambda: defaultdict(list))
    for r in csv.DictReader(open(SEED, encoding="utf-8")):
        d[r["name_zh"]][r["name_en"]].append(r["source_file"])
    return d


def party_name_map(race):
    return {r[0]: r[1] for r in race["elpaty"]}


def iter_election_candidates(e):
    """Yield parsed elcand dicts (with party_name_zh, folder) for an election's standard folders."""
    for f in e["folders"]:
        race = X.load_race(f)
        pm = party_name_map(race)
        for row in race["elcand"]:
            c = X.parse_cand(row)
            c["party_name_zh"] = pm.get(c["party_code"], "")
            c["folder"] = f
            yield c


def lookup_birth_pool():
    pool = defaultdict(set)
    for f in LOOKUP_FOLDERS:
        try:
            race = X.load_race(f)
        except (FileNotFoundError, OSError):
            continue
        for row in race["elcand"]:
            c = X.parse_cand(row)
            if c["birth_date"]:
                pool[c["name_zh"]].add(c["birth_date"])
    return pool


def rerun_candidates(e, all_known):
    """Candidates of the Chiayi rerun: names/parties from cand.csv; birth dates resolved from CEC tables by
    exact name (unique birth date across all CEC candidate tables used), else empty."""
    rr = e.get("rerun")
    if not rr:
        return []
    data = X.load_rerun(rr["folder"])
    pool = lookup_birth_pool()
    out = []
    for no, name, party in data["cand"]:
        name, _en = X.split_name(name)
        births = set(all_known.get(name, set())) | pool.get(name, set())
        bd = next(iter(births)) if len(births) == 1 else ""
        out.append({"ballot_no": int(no), "name_zh": name, "party_name_zh": party, "birth_date": bd,
                    "birth_candidates": sorted(births), "gender": "", "folder": rr["folder"], "is_vp": False})
    return out


def build():
    elections = common.load_elections()
    seed = load_seed()
    wiki = load_wiki()
    people = {}          # person_id -> record
    by_name = defaultdict(set)   # name_zh -> {birth_date}
    appearances = defaultdict(list)
    for e in elections:
        for c in iter_election_candidates(e):
            pid = common.person_id(c["name_zh"], c["birth_date"])
            rec = people.setdefault(pid, {"person_id": pid, "name_zh": c["name_zh"], "birth_date": c["birth_date"],
                                          "gender": c["gender"], "birthplace": c["birthplace"],
                                          "name_en_cec": c["name_en_cec"]})
            if not rec["gender"]:
                rec["gender"] = c["gender"]
            by_name[c["name_zh"]].add(c["birth_date"])
            appearances[pid].append(e["id"])
    known_births = defaultdict(set)
    for n, bs in by_name.items():
        known_births[n] = {b for b in bs if b}
    rerun_log = []
    for e in elections:
        for c in rerun_candidates(e, known_births):
            pid = common.person_id(c["name_zh"], c["birth_date"])
            rec = people.setdefault(pid, {"person_id": pid, "name_zh": c["name_zh"], "birth_date": c["birth_date"],
                                          "gender": "", "birthplace": ""})
            by_name[c["name_zh"]].add(c["birth_date"])
            appearances[pid].append(e["id"] + "-rerun")
            rerun_log.append((c["name_zh"], c["birth_date"], c["birth_candidates"]))

    # name conflicts: same name_zh, different birth dates (incl. empty vs filled)
    conflicts = []
    for n, bs in sorted(by_name.items()):
        if len(bs) > 1:
            for b in sorted(bs):
                pid = common.person_id(n, b)
                conflicts.append({"name_zh": n, "birth_date": b, "person_id": pid,
                                  "elections": ";".join(sorted(set(appearances[pid])))})
    conflict_names = {c["name_zh"] for c in conflicts}

    # name_en seeds: exact name_zh match, a single unambiguous legacy English name, and the Chinese name
    # maps to exactly one person in our data.
    seed_conflicts = []
    for pid, rec in people.items():
        n = rec["name_zh"]
        rec["name_en"], rec["name_en_source"] = "", ""
        if rec.get("name_en_cec"):
            rec["name_en"], rec["name_en_source"] = rec["name_en_cec"], "CEC elcand (ballot name)"
            continue_seed = False
        else:
            continue_seed = True
        if continue_seed and n in seed:
            ens = seed[n]
            if n in BAD_LEGACY_NAME_EN:
                seed_conflicts.append((n, "|".join(sorted(ens)), "excluded: " + BAD_LEGACY_NAME_EN[n]))
            elif len(ens) == 1 and n not in conflict_names:
                en = next(iter(ens))
                rec["name_en"] = en
                rec["name_en_source"] = "legacy:" + ";".join(sorted(set(ens[en])))
            else:
                seed_conflicts.append((n, "|".join(sorted(ens)), n in conflict_names))
        w = wiki.get(n, set())
        wiki_url = next(iter(w)) if len(w) == 1 and n not in conflict_names else ""
        rec.update({"wikidata_qid": "", "wiki_url": wiki_url, "photo_url": "", "photo_license": ""})
    return people, conflicts, seed_conflicts, rerun_log, appearances


COLS = ["person_id", "name_zh", "name_en", "name_en_source", "birth_date", "gender",
        "wikidata_qid", "wiki_url", "photo_url", "photo_license"]


def main():
    people, conflicts, seed_conflicts, rerun_log, appearances = build()
    os.makedirs(common.CANON, exist_ok=True)
    os.makedirs(common.REPORT_DIR, exist_ok=True)
    with open(os.path.join(common.CANON, "people.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, COLS, extrasaction="ignore")
        w.writeheader()
        for rec in sorted(people.values(), key=lambda r: (r["name_zh"], r["birth_date"])):
            w.writerow(rec)
    with open(os.path.join(common.REPORT_DIR, "name_conflicts.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, ["name_zh", "birth_date", "person_id", "elections"])
        w.writeheader()
        w.writerows(conflicts)
    with open(os.path.join(common.REPORT_DIR, "name_en_seed_unresolved.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["name_zh", "legacy_name_en_variants", "name_has_multiple_birthdates"])
        w.writerows(seed_conflicts)
    n_en = sum(1 for r in people.values() if r["name_en"])
    print(f"people: {len(people)}  with name_en: {n_en}  name conflicts: {len(conflicts)} rows  "
          f"seed ambiguities: {len(seed_conflicts)}")
    for r in rerun_log:
        print("rerun candidate", r)


if __name__ == "__main__":
    main()
