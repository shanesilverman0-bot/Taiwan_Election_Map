"""Validate canonical CSVs and exported JSON against the raw CEC tables. Exit non-zero on any failure.
    python3 -I etl/validate.py
Checks (per brief): candidate votes sum to CEC valid votes per area; shares recompute within 0.01; exactly one
elected per single-seat race; every county in counties-10t.json has data or not_contested in each regenerated
file; every exported candidate name matches elcand. Plus raw tie-outs and town-vs-county consistency.
"""
import csv
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

X = common.load_step("01_extract")
R = common.load_step("03_results")

fails = []
passes = defaultdict(int)


def ok(name, cond, msg=""):
    if cond:
        passes[name] += 1
    else:
        fails.append(f"[{name}] {msg}")


def rd(name):
    return list(csv.DictReader(open(os.path.join(common.CANON, name), encoding="utf-8")))


def main():
    elections = common.load_elections()
    geo = R.Geo()
    people = {r["person_id"]: r for r in rd("people.csv")}
    contests = {r["contest_id"]: r for r in rd("contests.csv")}
    cands = rd("candidacies.csv")
    results = rd("results_area.csv")
    turnout = {(t["contest_id"], t["area_level"], t["area_code"]): t for t in rd("turnout.csv")}

    cand_by = defaultdict(list)
    for c in cands:
        cand_by[c["contest_id"]].append(c)
    res = defaultdict(lambda: defaultdict(int))     # (contest, level, code) -> pid -> votes
    for r in results:
        res[(r["contest_id"], r["area_level"], r["area_code"])][r["person_id"]] += int(r["votes"])

    # ---- 1. sums, shares, elected (canonical)
    for key, t in turnout.items():
        cid, lvl, code = key
        if lvl == "national":
            continue
        s = sum(res[key].values())
        ok("votes_sum_equals_valid", s == int(t["valid_votes"]), f"{key}: {s} != {t['valid_votes']}")
        ok("turnout_recomputes", int(t["electorate"]) == 0 or
           abs(float(t["turnout_pct"]) - int(t["total_votes"]) * 100 / int(t["electorate"])) <= 0.0051, f"{key}")
        ok("valid_plus_invalid_eq_total", int(t["valid_votes"]) + int(t["invalid_votes"]) == int(t["total_votes"]),
           f"{key}")
        if t["turnout_pct_cec"] != "":
            ok("turnout_matches_cec", abs(float(t["turnout_pct"]) - float(t["turnout_pct_cec"])) <= 0.011,
               f"{key}: {t['turnout_pct']} vs CEC {t['turnout_pct_cec']}")
    for cid, cl in cand_by.items():
        ok("one_elected_per_contest", sum(1 for c in cl if c["elected"] == "Y") == 1, cid)
        ctest = contests[cid]
        lvl = "national" if ctest["area_code"] == "00000" else "county"
        t = turnout[(cid, lvl, ctest["area_code"])]
        valid = int(t["valid_votes"])
        ok("contest_votes_sum_eq_valid", sum(int(c["votes"]) for c in cl) == valid, cid)
        for c in cl:
            ok("share_recomputes", abs(float(c["vote_pct"]) - c["votes"].__class__(int(c["votes"])) * 100 / valid) <= 0.0051
               if False else abs(float(c["vote_pct"]) - int(c["votes"]) * 100 / valid) <= 0.0051, f"{cid} {c['person_id']}")
            ok("candidate_in_people", c["person_id"] in people, f"{cid} {c['person_id']}")
        # winner has the most votes
        top = max(cl, key=lambda c: int(c["votes"]))
        ok("elected_is_plurality", top["elected"] == "Y", f"{cid}")
        if lvl == "national":
            # national totals equal sum over counties
            for c in cl:
                s = sum(res[(cid, "county", code)].get(c["person_id"], 0)
                        for (cc, l, code) in list(res) if cc == cid and l == "county")
                ok("national_eq_sum_counties", s == int(c["votes"]), f"{cid} {c['person_id']}: {s} vs {c['votes']}")
        else:
            for c in cl:
                ok("county_result_eq_candidacy", res[(cid, "county", ctest["area_code"])].get(c["person_id"], 0)
                   == int(c["votes"]), f"{cid} {c['person_id']}")
        # town sums equal county sums (only meaningful when every town of the county matched)
        tk = [k for k in res if k[0] == cid and k[1] == "town"]
        if tk:
            for c in cl:
                if lvl == "national":
                    continue
                s = sum(res[k].get(c["person_id"], 0) for k in tk)
                ok("towns_sum_eq_county", s == int(c["votes"]), f"{cid} {c['person_id']}: towns {s} vs county {c['votes']}")
    # national-level: town sums equal national too
    for cid, ctest in contests.items():
        if ctest["area_code"] == "00000":
            tk = [k for k in res if k[0] == cid and k[1] == "town"]
            for c in cand_by[cid]:
                s = sum(res[k].get(c["person_id"], 0) for k in tk)
                ok("towns_sum_eq_national", s == int(c["votes"]), f"{cid} {c['person_id']}: {s} vs {c['votes']}")

    # ---- 2. raw tie-out: recompute county valid/electorate and candidate totals straight from the CEC tables
    for e in elections:
        by_code = defaultdict(lambda: defaultdict(int))
        nat_votes = defaultdict(int)
        nat_valid = None
        name_set = set()
        for folder in e["folders"]:
            race = X.load_race(folder)
            for row in race["elcand"]:
                name_set.add(X.parse_cand(row)["name_zh"])
            names = {(b[0], b[1]): b[5] for b in race["elbase"] if b[0] != "00" and b[3] == "000" and b[4] == "0000"}
            code_of = {k: geo.county_code(n)[0] for k, n in names.items()}
            for row in race["elprof"]:
                lv = R.classify(row)
                if lv == "county":
                    code = code_of[(row[0], row[1])]
                    by_code[code]["valid"] += int(row[6]); by_code[code]["electorate"] += int(row[9])
                elif lv == "national":
                    nat_valid = int(row[6])
            for row in race["elctks"]:
                if R.classify(row) == "national":
                    nat_votes[int(row[6])] += int(row[7])
        for code, d in by_code.items():
            if code is None:
                continue
            cid = f"{e['year']}-{e['type']}-{code}" if e["level"] != "national" else f"{e['year']}-{e['type']}-00000"
            lvl = "county"
            t = turnout.get((cid, lvl, code))
            ok("raw_county_valid", t is not None and int(t["valid_votes"]) == d["valid"] and
               int(t["electorate"]) == d["electorate"], f"{e['id']} {code}")
        if e["level"] == "national":
            cid = f"{e['year']}-{e['type']}-00000"
            ok("raw_national_valid", int(turnout[(cid, 'national', '00000')]["valid_votes"]) == nat_valid, e["id"])
            ok("raw_national_votes", sorted(int(c["votes"]) for c in cand_by[cid]) == sorted(nat_votes.values()), e["id"])
        # ---- 3. exported JSON
        fn = f"{e['type']}_{e['year']}.json"
        j = json.load(open(os.path.join(common.REPO, "data/elections", fn), encoding="utf-8"))
        if e.get("rerun"):
            rr = X.load_rerun(e["rerun"]["folder"])
            for _no, nm, _p in rr["cand"]:
                name_set.add(X.split_name(nm)[0])
        for c in geo.counties:
            k = c["COUNTYID"]
            ent = j.get(k)
            ok("county_present_or_not_contested", ent is not None and (ent.get("not_contested") or ent.get("candidates")),
               f"{fn} {k}")
            if not ent or ent.get("not_contested"):
                if ent:
                    ok("not_contested_has_no_contest", f"{e['year']}-{e['type']}-{c['COUNTYCODE']}" not in contests
                       or e["level"] == "national" and False, f"{fn} {k}")
                continue
            code = c["COUNTYCODE"]
            cid = f"{e['year']}-{e['type']}-" + ("00000" if e["level"] == "national" else code)
            t = turnout[(cid, "county", code)]
            valid = int(t["valid_votes"])
            ok("json_electorate_turnout", ent["electorate"] == int(t["electorate"]) and
               abs(ent["turnout"] - float(t["turnout_pct"])) < 0.001, f"{fn} {k}")
            ok("json_votes_sum_valid", sum(x["votes"] for x in ent["candidates"]) == valid, f"{fn} {k}")
            ok("json_one_winner_matches_plurality", ent["winner"]["politician_id"] ==
               max(ent["candidates"], key=lambda x: x["votes"])["politician_id"], f"{fn} {k}")
            if e["level"] != "national":
                ok("json_one_elected_flag", sum(1 for x in ent["candidates"] if x["elected"]) == 1, f"{fn} {k}")
            for x in ent["candidates"]:
                ok("json_share_recomputes", abs(x["vote_pct"] - x["votes"] * 100 / valid) <= 0.0051 + 1e-9, f"{fn} {k} {x['name_zh']}")
                ok("json_name_matches_elcand", x["name_zh"] in name_set, f"{fn} {k} {x['name_zh']}")
                ok("json_name_matches_people", people[x["politician_id"]]["name_zh"] == x["name_zh"], f"{fn} {k}")
        # towns file
        tj = json.load(open(os.path.join(common.REPO, "data/elections/towns", fn), encoding="utf-8"))
        town_codes = {t["TOWNCODE"] for t in geo.towns}
        for k, ent in tj.items():
            if k == "_meta":
                continue
            ok("town_key_in_boundary", k in town_codes, f"{fn} {k}")
            ok("town_votes_sum_valid", sum(x["votes"] for x in ent["candidates"]) == ent["valid_votes"], f"{fn} {k}")
            for x in ent["candidates"]:
                ok("town_share_recomputes", ent["valid_votes"] == 0 or
                   abs(x["vote_pct"] - x["votes"] * 100 / ent["valid_votes"]) <= 0.0051 + 1e-9, f"{fn} {k}")
        if e["level"] == "national":
            ok("town_file_covers_all_towns", len(tj) - 1 == 368, f"{fn} has {len(tj)-1} towns, expected 368")
    chk = os.path.join(common.REPORT_DIR, "etl_checks.txt")
    ok("etl_checks_clean", not os.path.exists(chk) or open(chk, encoding="utf-8").read().strip() == "",
       "reports/phase-1/etl_checks.txt is not empty (unmatched or colliding towns)")
    # registry has no party
    reg = json.load(open(os.path.join(common.REPO, "data/entities/politicians.json"), encoding="utf-8"))
    ok("registry_no_party", all("party" not in v for k, v in reg.items() if k != "_meta"), "party field in registry")

    total_pass = sum(passes.values())
    for k in sorted(passes):
        print(f"  pass {passes[k]:6d}  {k}")
    print(f"PASSED checks: {total_pass}   FAILED checks: {len(fails)}")
    for f in fails[:40]:
        print("FAIL", f)
    if len(fails) > 40:
        print(f"... and {len(fails) - 40} more")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
