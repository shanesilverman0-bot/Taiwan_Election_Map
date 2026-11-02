"""Step 1: read headerless CEC CSV tables into clean Python rows.

Library module (loaded through etl/common.load_step) plus a tiny CLI:
    python3 -I etl/01_extract.py <election_id>     # prints row counts per table
Raw data root: ~/data/db.cec.gov.tw/voteData (never copied into the repo).
"""
import csv
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

RAW_ROOT = os.path.expanduser("~/data/db.cec.gov.tw/voteData")
TABLES = ("elbase", "elcand", "elctks", "elpaty", "elprof")


def read_text(path):
    raw = open(path, "rb").read()
    for enc in ("utf-8-sig", "cp950", "big5hkscs"):
        try:
            return raw.decode(enc), enc
        except UnicodeDecodeError:
            continue
    return raw.decode("utf-8", "replace"), "utf-8-replace"


def clean(cell):
    """Strip whitespace and the leading apostrophe some CEC exports put on codes."""
    c = cell.strip()
    if c.startswith("'"):
        c = c[1:]
    return c.strip()


def read_table(path):
    text, enc = read_text(path)
    rows = []
    for r in csv.reader(io.StringIO(text)):
        if not r or all(not x.strip() for x in r):
            continue
        rows.append([clean(x) for x in r])
    return rows, enc


def roc_to_iso(s):
    """ROC date 0740111 -> 1985-01-11. Returns None when not a full 7-digit date."""
    s = (s or "").strip()
    if not s.isdigit() or len(s) < 6:
        return None
    s = s.zfill(7)
    y, m, d = int(s[:3]) + 1911, int(s[3:5]), int(s[5:7])
    if not (1 <= m <= 12 and 1 <= d <= 31):
        return None
    return f"{y:04d}-{m:02d}-{d:02d}"


def area_key(prv, cty, dist, town, vill):
    """12-digit area key: prv(2) county(3) district(2) town(3) village(4)."""
    return f"{prv.zfill(2)}{cty.zfill(3)}{dist.zfill(2)}{town.zfill(3)}{vill.zfill(4)}"


def find_file(folder, table):
    """Files are elbase.csv, or elbase_P1.csv (2016 presidential)."""
    for f in sorted(os.listdir(folder)):
        if f.startswith(table) and f.endswith(".csv"):
            return os.path.join(folder, f)
    return None


def load_race(folder_rel):
    """Raw tables (lists of cleaned string rows) for one race folder."""
    folder = os.path.join(RAW_ROOT, folder_rel)
    out = {"_folder": folder_rel}
    for t in TABLES:
        p = find_file(folder, t)
        if p is None:
            raise FileNotFoundError(f"{t} not found in {folder}")
        out[t], out[t + "_enc"] = read_table(p)
    return out


# CEC uses private-use code points for a few rare characters. Map them to the standard character.
PUA_MAP = {"\ue018": "聰"}   # 江聰淵 (2022 Yilan DPP nominee); verified: only PUA char in the 13 sources
_LATIN_TAIL = re.compile(r"^(.*[\u4e00-\u9fff．·・])\s+([A-Za-z][A-Za-z .'\-]*)$")


def split_name(raw):
    """-> (name_zh, name_en_from_cec). The CEC ballot name for one candidate carries an English name after a
    space ('谷辣斯．尤達卡 Kolas Yotaka'); that English part is CEC-sourced, not machine romanisation."""
    n = "".join(PUA_MAP.get(ch, ch) for ch in raw)
    m = _LATIN_TAIL.match(n)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    return n, ""


def parse_cand(row):
    """elcand row -> dict. Columns: 0-4 area, 5 ballot_no, 6 name, 7 party code, 8 gender(1 M/2 F),
    9 birth (ROC), 10 age, 11 birthplace, 12 education, 13 incumbent Y/N, 14 elected '*', 15 VP flag 'Y'."""
    row = row + [""] * (16 - len(row))
    name_zh, name_en_cec = split_name(row[6])
    return {
        "area": area_key(*row[0:5]),
        "prv": row[0], "cty": row[1], "dist": row[2],
        "ballot_no": int(row[5]),
        "name_zh": name_zh,
        "name_en_cec": name_en_cec,
        "party_code": row[7],
        "gender": {"1": "M", "2": "F"}.get(row[8], ""),
        "birth_raw": row[9],
        "birth_date": roc_to_iso(row[9]) or "",
        "birthplace": row[11],
        "incumbent": row[13].upper() == "Y",
        "elected": row[14] == "*",
        "is_vp": row[15].upper() == "Y",
    }


def load_rerun(folder_rel):
    """2022 Chiayi City rerun: cand.csv (號次,名字,政黨名稱) and prof.csv (station rows)."""
    folder = os.path.join(RAW_ROOT, folder_rel)
    cand, _ = read_table(os.path.join(folder, "cand.csv"))
    prof, _ = read_table(os.path.join(folder, "prof.csv"))
    return {"cand": cand[1:], "prof": prof[1:], "header": prof[0]}


if __name__ == "__main__":
    import common
    els = {e["id"]: e for e in common.load_elections()}
    e = els[sys.argv[1]]
    for f in e["folders"]:
        r = load_race(f)
        print(f, {t: len(r[t]) for t in TABLES}, r["elbase_enc"], r["elctks_enc"])
