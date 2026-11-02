"""Step 3: aggregate CEC tables to county (5-digit code) and town (TOWNCODE) results and write the canonical CSVs:
contests.csv, candidacies.csv, results_area.csv, turnout.csv, parties.csv  (+ crosswalk reports).

    python3 -I etl/03_results.py
"""
import csv
import os
from decimal import Decimal, ROUND_HALF_UP
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

X = common.load_step("01_extract")
P = common.load_step("02_people")

# Pre-2010 / pre-2014 county names that no longer exist -> current 5-digit county code.
# Verified against elbase names (see reports/phase-1/county_crosswalk.csv); other names match geo names directly.
OLD_COUNTY_NAMES = {
    "台北縣": "65000",   # became New Taipei City 2010-12-25
    "桃園縣": "68000",   # became Taoyuan City 2014-12-25
    "台中縣": "66000",   # merged with Taichung City 2010-12-25
    "台南縣": "67000",   # merged with Tainan City 2010-12-25
    "高雄縣": "64000",   # merged with Kaohsiung City 2010-12-25
}
TOWN_SUFFIX = "鄉鎮市區"


class Geo:
    def __init__(self):
        self.counties = common.counties()
        self.towns = common.towns()
        self.county_by_norm = {common.norm(c["COUNTYNAME"]): c["COUNTYCODE"] for c in self.counties}
        self.county_info = {c["COUNTYCODE"]: c for c in self.counties}
        self.towns_by_county = defaultdict(list)
        for t in self.towns:
            self.towns_by_county[t["COUNTYCODE"]].append(t)

    def county_code(self, cec_name):
        n = common.norm(cec_name)
        if n in self.county_by_norm:
            return self.county_by_norm[n], "direct"
        if n in OLD_COUNTY_NAMES:
            return OLD_COUNTY_NAMES[n], "merged-or-renamed"
        return None, "unmatched"

    def town_code(self, county5, cec_name):
        n = common.norm(cec_name)
        cands = self.towns_by_county.get(county5, [])
        for t in cands:
            if common.norm(t["TOWNNAME"]) == n:
                return t["TOWNCODE"], "exact"
        if county5 == "64000" and n == "三民鄉":   # Kaohsiung County 三民鄉 renamed 那瑪夏 (2008); NOT 三民區 (old city)
            hit = [t for t in cands if t["TOWNNAME"] == "那瑪夏區"]
            if hit:
                return hit[0]["TOWNCODE"], "special(三民鄉->那瑪夏區)"
        if county5 == "67000" and n in ("中區", "西區"):  # 2010 merger of Tainan City 中區 + 西區
            hit = [t for t in cands if t["TOWNNAME"] == "中西區"]
            if hit:
                return hit[0]["TOWNCODE"], "special(中區+西區->中西區)"
        if n and n[-1] in TOWN_SUFFIX:
            stem = n[:-1]
            hit = [t for t in cands if common.norm(t["TOWNNAME"])[:-1] == stem]
            if len(hit) == 1:
                return hit[0]["TOWNCODE"], "stem(鄉鎮市->區)"
        return None, "unmatched"


def classify(row):
    """Level of an elctks/elprof row from its area columns: national/county/town/village/station."""
    prv, cty, _d, town, vill, stn = row[0], row[1], row[2], row[3], row[4], int(row[5] or 0)
    if prv == "00":
        return "national"
    if town == "000" and vill == "0000" and stn == 0:
        return "county"
    if town != "000" and vill == "0000" and stn == 0:
        return "town"
    return "lower"


def f_int(s):
    return int(float(s)) if s not in ("", None) else 0


def load_standard(e, geo, xwalk_c, xwalk_t, checks):
    """Return dict with candidates and vote tables for a standard (folder-based) election."""
    cands = []         # parsed candidates (with party_name_zh)
    votes = {"national": defaultdict(int), "county": defaultdict(lambda: defaultdict(int)),
             "town": defaultdict(lambda: defaultdict(int))}
    prof = {"national": None, "county": {}, "town": {}}
    cec_pct = {}
    for folder in e["folders"]:
        race = X.load_race(folder)
        pm = P.party_name_map(race)
        cnames, tnames = {}, {}
        for b in race["elbase"]:
            if b[0] == "00":
                continue
            if b[3] == "000" and b[4] == "0000":
                cnames[(b[0], b[1])] = b[5]
            elif b[4] == "0000":
                tnames[(b[0], b[1], b[3])] = b[5]
        for row in race["elcand"]:
            c = X.parse_cand(row)
            c["party_name_zh"] = pm.get(c["party_code"], "")
            c["folder"] = folder
            c["race_key"] = (c["prv"], c["cty"])
            cands.append(c)
        # county codes for this folder
        c5 = {}
        for k, nm in cnames.items():
            code, how = geo.county_code(nm)
            c5[k] = code
            xwalk_c.append({"election_id": e["id"], "prv": k[0], "cty": k[1], "cec_name": nm, "county_code": code or "",
                            "how": how, "folder": folder})
        t8 = {}
        for k, nm in tnames.items():
            ck = (k[0], k[1])
            code, how = geo.town_code(c5.get(ck), nm) if c5.get(ck) else (None, "county-unmatched")
            t8[k] = code
            xwalk_t.append({"election_id": e["id"], "county_code": c5.get(ck) or "", "cec_town_name": nm,
                            "cec_key": "".join(k), "towncode": code or "", "how": how})
        # guard: two CEC towns of one folder must not silently collapse into one current town
        seen_t = defaultdict(list)
        for k, code in t8.items():
            if code:
                seen_t[code].append((k, tnames[k]))
        for code, lst in seen_t.items():
            if len(lst) > 1 and not (code.startswith("67000") and {n for _k, n in lst} == {"中區", "西區"}):
                checks.append(f"{e['id']}: towns {[n for _k, n in lst]} all mapped to {code}")
        for row in race["elctks"]:
            lvl = classify(row)
            bn, v = int(row[6]), int(row[7])
            if lvl == "national":
                votes["national"][bn] += v
            elif lvl == "county":
                votes["county"][(row[0], row[1], folder)][bn] += v
                cec_pct[(row[0], row[1], folder, bn)] = float(row[8] or 0)
            elif lvl == "town":
                votes["town"][(row[0], row[1], row[3], folder)][bn] += v
        for row in race["elprof"]:
            lvl = classify(row)
            rec = {"valid": f_int(row[6]), "invalid": f_int(row[7]), "total": f_int(row[8]),
                   "electorate": f_int(row[9]), "turnout_cec": float(row[18] or 0)}
            if lvl == "national":
                prof["national"] = rec
            elif lvl == "county":
                prof["county"][(row[0], row[1], folder)] = rec
            elif lvl == "town":
                prof["town"][(row[0], row[1], row[3], folder)] = rec
        # stash lookups
        votes.setdefault("_c5", {}).update({(k[0], k[1], folder): v for k, v in c5.items()})
        votes.setdefault("_t8", {}).update({(k[0], k[1], k[2], folder): v for k, v in t8.items()})
        votes.setdefault("_cname", {}).update({(k[0], k[1], folder): v for k, v in cnames.items()})
        votes.setdefault("_tname", {}).update({(k[0], k[1], k[2], folder): v for k, v in tnames.items()})
    return cands, votes, prof, cec_pct


def pct(v, valid):
    """Share of valid votes, 2 decimals, round-half-up (exact integer arithmetic)."""
    if not valid:
        return 0.0
    return float((Decimal(v) * 100 / Decimal(valid)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def add_prof(dst, rec):
    for k in ("valid", "invalid", "total", "electorate"):
        dst[k] = dst.get(k, 0) + rec[k]


def turnout_pct(p):
    return pct(p["total"], p["electorate"]) if p.get("electorate") else 0.0


def main():
    elections = common.load_elections()
    geo = Geo()
    people_rows = list(csv.DictReader(open(os.path.join(common.CANON, "people.csv"), encoding="utf-8")))
    contests, candidacies, results, turnout = [], [], [], []
    xwalk_c, xwalk_t, checks = [], [], []
    party_codes = defaultdict(set)   # (party_key, name_zh) -> {"year:code"}

    for e in elections:
        cands, votes, prof, cec_pct = load_standard(e, geo, xwalk_c, xwalk_t, checks)
        otype, year = e["type"], e["year"]
        # party names/codes
        for c in cands:
            party_codes[(common.party_key(c["party_name_zh"]), c["party_name_zh"])].add(f"{year}:{c['party_code']}")

        def person(c):
            return common.person_id(c["name_zh"], c["birth_date"])

        # ---- aggregate lower levels to current codes
        agg_c = defaultdict(lambda: defaultdict(int))   # (code5, ballot) etc.
        agg_cp = defaultdict(dict)
        agg_t = defaultdict(lambda: defaultdict(int))
        agg_tp = defaultdict(dict)
        t_names = {}
        for k, v in votes["county"].items():
            code = votes["_c5"][k]
            if code is None:      # province-level aggregate rows (臺灣省/福建省) in 2020/2024 elbase
                continue
            for bn, n in v.items():
                agg_c[code][bn] += n
        for k, p in prof["county"].items():
            if votes["_c5"][k] is not None:
                add_prof(agg_cp[votes["_c5"][k]], p)
        for k, v in votes["town"].items():
            code = votes["_t8"].get(k)
            if not code:
                checks.append(f"{e['id']}: UNMATCHED town {votes['_tname'][k]} in {votes['_cname'].get(k[:2]+(k[3],), '?')} "
                              f"(votes {sum(v.values())})")
                continue
            for bn, n in v.items():
                agg_t[code][bn] += n
        for k, p in prof["town"].items():
            code = votes["_t8"].get(k)
            if code:
                add_prof(agg_tp[code], p)

        if e["level"] == "national":
            nat = {}
            for c in cands:
                if c["is_vp"]:
                    continue
                nat[c["ballot_no"]] = c
            vp = {c["ballot_no"]: c for c in cands if c["is_vp"]}
            cid = f"{year}-{otype}-00000"
            contests.append({"contest_id": cid, "election_id": e["id"], "date": e["date"], "office": e["office"],
                             "area_code": "00000", "seats": 1, "boundary_set": "counties_current"})
            valid = prof["national"]["valid"]
            for bn, c in sorted(nat.items()):
                v = votes["national"][bn]
                candidacies.append({
                    "contest_id": cid, "person_id": person(c), "ballot_no": bn,
                    "party_key": common.party_key(c["party_name_zh"]), "party_name_zh": c["party_name_zh"],
                    "endorsed_by": "", "incumbent": "Y" if c["incumbent"] else "N", "status": "registered",
                    "votes": v, "vote_pct": pct(v, valid), "elected": "Y" if c["elected"] else "N",
                    "running_mate_person_id": person(vp[bn]) if bn in vp else ""})
            p = prof["national"]
            turnout.append({"contest_id": cid, "area_level": "national", "area_code": "00000", "valid_votes": p["valid"],
                            "invalid_votes": p["invalid"], "total_votes": p["total"], "electorate": p["electorate"],
                            "turnout_pct": turnout_pct(p), "turnout_pct_cec": p["turnout_cec"]})
            for code, v in sorted(agg_c.items()):
                p = agg_cp[code]
                turnout.append({"contest_id": cid, "area_level": "county", "area_code": code, "valid_votes": p["valid"],
                                "invalid_votes": p["invalid"], "total_votes": p["total"], "electorate": p["electorate"],
                                "turnout_pct": turnout_pct(p), "turnout_pct_cec": ""})
                for bn, n in sorted(v.items()):
                    results.append({"contest_id": cid, "area_level": "county", "area_code": code,
                                    "person_id": person(nat[bn]), "votes": n})
            for code, v in sorted(agg_t.items()):
                p = agg_tp[code]
                turnout.append({"contest_id": cid, "area_level": "town", "area_code": code, "valid_votes": p["valid"],
                                "invalid_votes": p["invalid"], "total_votes": p["total"], "electorate": p["electorate"],
                                "turnout_pct": turnout_pct(p), "turnout_pct_cec": ""})
                for bn, n in sorted(v.items()):
                    results.append({"contest_id": cid, "area_level": "town", "area_code": code,
                                    "person_id": person(nat[bn]), "votes": n})
            # checks: sum of merged counties == national
            for bn in nat:
                s = sum(agg_c[c][bn] for c in agg_c)
                if s != votes["national"][bn]:
                    checks.append(f"{e['id']}: county sum != national for ballot {bn}: {s} vs {votes['national'][bn]}")
        else:
            by_race = defaultdict(list)
            for c in cands:
                by_race[(c["prv"], c["cty"], c["folder"])].append(c)
            for rk, cl in sorted(by_race.items()):
                code = votes["_c5"][rk]
                cid = f"{year}-{otype}-{code}"
                contests.append({"contest_id": cid, "election_id": e["id"], "date": e["date"], "office": e["office"],
                                 "area_code": code, "seats": 1, "boundary_set": "counties_current"})
                p = prof["county"][rk]
                for c in sorted(cl, key=lambda c: c["ballot_no"]):
                    v = votes["county"][rk][c["ballot_no"]]
                    candidacies.append({
                        "contest_id": cid, "person_id": person(c), "ballot_no": c["ballot_no"],
                        "party_key": common.party_key(c["party_name_zh"]), "party_name_zh": c["party_name_zh"],
                        "endorsed_by": "", "incumbent": "Y" if c["incumbent"] else "N", "status": "registered",
                        "votes": v, "vote_pct": pct(v, p["valid"]), "elected": "Y" if c["elected"] else "N",
                        "running_mate_person_id": ""})
                    results.append({"contest_id": cid, "area_level": "county", "area_code": code,
                                    "person_id": person(c), "votes": v})
                    if abs(cec_pct.get((rk[0], rk[1], rk[2], c["ballot_no"]), 0) - pct(v, p["valid"])) > 0.011:
                        checks.append(f"{e['id']}: CEC share differs from recomputed for {c['name_zh']} in {code}")
                turnout.append({"contest_id": cid, "area_level": "county", "area_code": code, "valid_votes": p["valid"],
                                "invalid_votes": p["invalid"], "total_votes": p["total"], "electorate": p["electorate"],
                                "turnout_pct": turnout_pct(p), "turnout_pct_cec": p["turnout_cec"]})
                bn2c = {c["ballot_no"]: c for c in cl}
                # merged towns (several CEC towns -> one code) are summed via agg_t
                for tcode in sorted({votes["_t8"][tk] for tk in votes["town"]
                                     if (tk[0], tk[1], tk[3]) == rk and votes["_t8"].get(tk)}):
                    tp = agg_tp[tcode]
                    turnout.append({"contest_id": cid, "area_level": "town", "area_code": tcode,
                                    "valid_votes": tp["valid"], "invalid_votes": tp["invalid"],
                                    "total_votes": tp["total"], "electorate": tp["electorate"],
                                    "turnout_pct": turnout_pct(tp), "turnout_pct_cec": ""})
                    for bn, c in sorted(bn2c.items()):
                        results.append({"contest_id": cid, "area_level": "town", "area_code": tcode,
                                        "person_id": person(c), "votes": agg_t[tcode].get(bn, 0)})

        # ---- Chiayi City rerun (2022-12-18)
        rr = e.get("rerun")
        if rr:
            data = X.load_rerun(rr["folder"])
            code, _ = geo.county_code(rr["county_name"])
            cid = f"{year}-{otype}-{code}"
            known = defaultdict(set)
            for pr in people_rows:   # same lookup basis as 02_people (birth dates seen in other CEC tables)
                if pr["birth_date"]:
                    known[pr["name_zh"]].add(pr["birth_date"])
            rcs = P.rerun_candidates(e, known)
            nb = len(rcs)
            tot = defaultdict(int)
            per_town = defaultdict(lambda: defaultdict(int))
            tprof = defaultdict(lambda: defaultdict(int))
            for r in data["prof"]:
                dist = r[0]
                tcode, how = geo.town_code(code, dist)
                if not tcode:
                    checks.append(f"{e['id']} rerun: unmatched district {dist}")
                    continue
                for i in range(nb):
                    n = int(r[3 + i])
                    per_town[tcode][i + 1] += n
                    tot[i + 1] += n
                tprof[tcode]["valid"] += int(r[8]); tprof[tcode]["invalid"] += int(r[9])
                tprof[tcode]["total"] += int(r[10]); tprof[tcode]["electorate"] += int(r[14])
                if sum(int(r[3 + i]) for i in range(nb)) != int(r[8]):
                    checks.append(f"{e['id']} rerun: station row candidate sum != valid in {r[:3]}")
            cp = {k: sum(tprof[t][k] for t in tprof) for k in ("valid", "invalid", "total", "electorate")}
            contests.append({"contest_id": cid, "election_id": e["id"], "date": str(rr["date"]), "office": e["office"],
                             "area_code": code, "seats": 1, "boundary_set": "counties_current"})
            win_bn = max(tot, key=lambda b: tot[b])
            # incumbent flag is not in the rerun file: derived = person elected in the previous (2018) Chiayi City race
            prev = {(x["name_zh"], x["birth_date"]) for x in P.iter_election_candidates(
                next(z for z in elections if z["id"] == "magistrate_2018")) if x["elected"] and x["cty"] == "020"
                and x["prv"] == "10"}
            for c in rcs:
                v = tot[c["ballot_no"]]
                pid = common.person_id(c["name_zh"], c["birth_date"])
                inc = (c["name_zh"], c["birth_date"]) in prev
                candidacies.append({
                    "contest_id": cid, "person_id": pid, "ballot_no": c["ballot_no"],
                    "party_key": common.party_key(c["party_name_zh"]), "party_name_zh": c["party_name_zh"],
                    "endorsed_by": "", "incumbent": "Y" if inc else "N", "status": "registered",
                    "votes": v, "vote_pct": pct(v, cp["valid"]), "elected": "Y" if c["ballot_no"] == win_bn else "N",
                    "running_mate_person_id": ""})
                results.append({"contest_id": cid, "area_level": "county", "area_code": code, "person_id": pid, "votes": v})
                for tcode in sorted(per_town):
                    results.append({"contest_id": cid, "area_level": "town", "area_code": tcode, "person_id": pid,
                                    "votes": per_town[tcode][c["ballot_no"]]})
            turnout.append({"contest_id": cid, "area_level": "county", "area_code": code, "valid_votes": cp["valid"],
                            "invalid_votes": cp["invalid"], "total_votes": cp["total"], "electorate": cp["electorate"],
                            "turnout_pct": turnout_pct(cp), "turnout_pct_cec": ""})
            for tcode in sorted(tprof):
                tp = tprof[tcode]
                turnout.append({"contest_id": cid, "area_level": "town", "area_code": tcode, "valid_votes": tp["valid"],
                                "invalid_votes": tp["invalid"], "total_votes": tp["total"], "electorate": tp["electorate"],
                                "turnout_pct": turnout_pct(tp), "turnout_pct_cec": ""})

    # ---- write canonical CSVs
    def write(name, rows, cols):
        with open(os.path.join(common.CANON, name), "w", encoding="utf-8", newline="") as fh:
            w = csv.DictWriter(fh, cols, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)

    write("contests.csv", contests, ["contest_id", "election_id", "date", "office", "area_code", "seats", "boundary_set"])
    write("candidacies.csv", candidacies, ["contest_id", "person_id", "ballot_no", "party_key", "party_name_zh",
                                           "endorsed_by", "incumbent", "status", "votes", "vote_pct", "elected",
                                           "running_mate_person_id"])
    write("results_area.csv", results, ["contest_id", "area_level", "area_code", "person_id", "votes"])
    write("turnout.csv", turnout, ["contest_id", "area_level", "area_code", "valid_votes", "invalid_votes",
                                   "total_votes", "electorate", "turnout_pct", "turnout_pct_cec"])

    # parties.csv
    cfg = common.config_parties()
    prow = []
    by_key = defaultdict(lambda: defaultdict(set))
    for (k, nm), codes in party_codes.items():
        by_key[k][nm] |= codes
    for k in cfg:
        if k == "OTHER":
            continue
        names = by_key.get(k, {})
        codes = sorted({c for s in names.values() for c in s})
        prow.append({"party_key": k, "cec_codes": ";".join(codes), "name_zh": cfg[k]["name_zh"],
                     "name_en": cfg[k]["name_en"],
                     "cec_name_variants": ";".join(sorted(names))})
    for nm, codes in sorted(by_key.get("OTHER", {}).items()):
        prow.append({"party_key": "OTHER", "cec_codes": ";".join(sorted(codes)), "name_zh": nm, "name_en": "",
                     "cec_name_variants": nm})
    write("parties.csv", prow, ["party_key", "cec_codes", "name_zh", "name_en", "cec_name_variants"])

    os.makedirs(common.REPORT_DIR, exist_ok=True)
    seen = set()
    cw = []
    for r in xwalk_c:
        key = (r["election_id"], r["prv"], r["cty"], r["cec_name"])
        if key not in seen:
            seen.add(key); cw.append(r)
    with open(os.path.join(common.REPORT_DIR, "county_crosswalk.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, ["election_id", "prv", "cty", "cec_name", "county_code", "how", "folder"])
        w.writeheader(); w.writerows(cw)
    with open(os.path.join(common.REPORT_DIR, "town_crosswalk.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.DictWriter(fh, ["election_id", "county_code", "cec_town_name", "cec_key", "towncode", "how"])
        w.writeheader(); w.writerows(xwalk_t)
    with open(os.path.join(common.REPORT_DIR, "etl_checks.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(checks) + ("\n" if checks else ""))
    print(f"contests {len(contests)} candidacies {len(candidacies)} results {len(results)} turnout {len(turnout)}")
    print(f"checks flagged: {len(checks)}")
    for c in checks[:15]:
        print("  ", c)


if __name__ == "__main__":
    main()
