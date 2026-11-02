"""Compare regenerated election files against the hand-entered versions on branch main (git show).
Writes reports/phase-1/changed_figures.csv, party_label_changes.csv and old_vs_new.md.
    python3 -I etl/compare_legacy.py
"""
import csv
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common

BASE = "main"


def git_show(rel):
    try:
        out = subprocess.run(["git", "-C", common.REPO, "show", f"{BASE}:{rel}"], capture_output=True, check=True)
    except subprocess.CalledProcessError:
        return None
    return json.loads(out.stdout.decode("utf-8"))


def main():
    elections = common.load_elections()
    old_reg = git_show("data/entities/politicians.json") or {}
    changed, party_changes, md = [], [], []
    for e in elections:
        fn = f"{e['type']}_{e['year']}.json"
        old = git_show(f"data/elections/{fn}")
        new = json.load(open(os.path.join(common.REPO, "data/elections", fn), encoding="utf-8"))
        if old is None:
            md.append(f"### {fn}\nNo previous file on main (new in Phase 1). New: "
                      f"{sum(1 for k,v in new.items() if k!='_meta' and not v.get('not_contested'))} contested counties, "
                      f"{sum(len(v['candidates']) for k,v in new.items() if k!='_meta')} candidate entries.\n")
            continue

        def name_of(c):
            nm = c.get("name_zh") or old_reg.get(str(c.get("politician_id")), {}).get("name_zh")
            return nm.replace("·", "．") if nm else nm

        def party_of(c):
            return c.get("party") or old_reg.get(str(c.get("politician_id")), {}).get("party")

        rows_md = []
        tot_old = tot_new = 0
        for k in sorted(set(old) | set(new)):
            if k == "_meta":
                continue
            o, n = old.get(k), new.get(k)
            if o is None or n is None:
                changed.append([fn, k, "", "county_presence", "present" if o else "absent", "present" if n else "absent", ""])
                continue
            if n.get("not_contested"):
                changed.append([fn, k, "", "not_contested", "had data", "not_contested", ""])
                continue
            oc, nc = o.get("candidates", []), n["candidates"]
            tot_old += len(oc); tot_new += len(nc)
            rows_md.append((k, n["name_zh"], len(oc), len(nc)))
            for fld in ("electorate", "turnout"):
                if o.get(fld) != n.get(fld):
                    changed.append([fn, k, "", fld, o.get(fld), n.get(fld), ""])
            nby = {c["name_zh"]: c for c in nc}
            npar = {}
            for c in nc:
                npar.setdefault(c["party"], []).append(c)
            for c in oc:
                nm = name_of(c)
                m = nby.get(nm)
                if m is None and nm is None:
                    cand = npar.get(party_of(c), [])
                    m = cand[0] if len(cand) == 1 else None
                if m is None:
                    changed.append([fn, k, nm or f"({party_of(c)})", "candidate_unmatched", c.get("votes"), "", ""])
                    continue
                for fld in ("votes", "vote_pct"):
                    if c.get(fld) != m.get(fld):
                        d = (m[fld] - c[fld]) if c.get(fld) is not None else ""
                        changed.append([fn, k, m["name_zh"], fld, c.get(fld), m.get(fld), round(d, 2) if d != "" else ""])
                if party_of(c) != m["party"]:
                    party_changes.append([fn, k, m["name_zh"], party_of(c), m["party"]])
            ow = (o.get("winner") or {})
            ow_name = name_of(ow) or ow.get("name_zh")
            nw = next((c for c in nc if c["politician_id"] == n["winner"]["politician_id"]), None)
            if nw and ow_name and ow_name != nw["name_zh"]:
                changed.append([fn, k, "", "winner", ow_name, nw["name_zh"], ""])
        # national candidate totals in _meta
        for oc in old.get("_meta", {}).get("candidates", []):
            m = next((c for c in new["_meta"].get("candidates", []) if c["name_zh"] == oc.get("name_zh")), None)
            if not m:
                continue
            for a, b in (("total_votes", "total_votes"), ("total_pct", "total_pct")):
                if oc.get(a) != m.get(b):
                    changed.append([fn, "_meta", oc["name_zh"], a, oc.get(a), m.get(b), ""])
            if oc.get("party") != m["party"]:
                party_changes.append([fn, "_meta", oc["name_zh"], oc.get("party"), m["party"]])
        if old["_meta"].get("turnout") != new["_meta"].get("turnout") and "turnout" in old["_meta"]:
            changed.append([fn, "_meta", "", "national_turnout", old["_meta"].get("turnout"), new["_meta"].get("turnout"), ""])
        md.append(f"### {fn}\nCandidate entries across contested counties: old {tot_old}, new {tot_new}.\n\n"
                  "| county | name | old cands | new cands |\n|---|---|---|---|\n" +
                  "\n".join(f"| {a} | {b} | {c} | {d} |" for a, b, c, d in rows_md) + "\n")
    os.makedirs(common.REPORT_DIR, exist_ok=True)
    with open(os.path.join(common.REPORT_DIR, "changed_figures.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "county_key", "candidate", "field", "old", "new", "delta"])
        w.writerows(changed)
    with open(os.path.join(common.REPORT_DIR, "party_label_changes.csv"), "w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["file", "county_key", "candidate", "old_party", "new_party"])
        w.writerows(party_changes)
    open(os.path.join(common.REPORT_DIR, "old_vs_new.md"), "w", encoding="utf-8").write("\n".join(md))
    from collections import Counter
    c = Counter((r[0], r[3]) for r in changed)
    for k, v in sorted(c.items()):
        print(k, v)
    print("party label changes:", len(party_changes))


if __name__ == "__main__":
    main()
