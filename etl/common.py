"""Shared helpers for the ETL pipeline (stdlib + pyyaml only)."""
import hashlib
import importlib.util
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
CANON = os.path.join(REPO, "data", "canonical")
REPORT_DIR = os.path.join(REPO, "reports", "phase-1")


def load_step(filename):
    """Import a numerically-prefixed step script, e.g. load_step('01_extract')."""
    spec = importlib.util.spec_from_file_location("etl_" + filename, os.path.join(HERE, filename + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def norm(s):
    """Normalise name variants for matching (臺/台, 稱 variants, spaces)."""
    s = (s or "").strip().replace("臺", "台").replace(" ", "").replace("　", "")
    s = s.replace("峯", "峰").replace("羣", "群").replace("裏", "里")
    return s


def load_elections():
    import yaml
    with open(os.path.join(HERE, "elections.yaml"), encoding="utf-8") as f:
        return yaml.safe_load(f)["elections"]


def person_id(name_zh, birth_date):
    return hashlib.sha1(f"{name_zh}|{birth_date or ''}".encode("utf-8")).hexdigest()[:8]


def topo_props(path, obj):
    d = json.load(open(path, encoding="utf-8"))
    return [g["properties"] for g in d["objects"][obj]["geometries"]]


def counties():
    """Current counties: list of dicts COUNTYID, COUNTYCODE, COUNTYNAME, COUNTYENG."""
    return topo_props(os.path.join(REPO, "data/geo/counties-10t.json"), "counties")


def towns():
    return topo_props(os.path.join(REPO, "data/geo/towns-10t.json"), "towns")


def config_parties():
    """Read-only parse of CONFIG.parties keys + name_en from js/config.js."""
    txt = open(os.path.join(REPO, "js/config.js"), encoding="utf-8").read()
    block = txt[txt.index("parties:"):]
    block = block[: block.index("},\n\n")]
    out = {}
    for m in re.finditer(r"^\s{4}(\w+):\s*\{[^}]*name_en:\s*'([^']*)'[^}]*name_zh:\s*'([^']*)'", block, re.M):
        out[m.group(1)] = {"name_en": m.group(2), "name_zh": m.group(3)}
    return out


def config_county_letters():
    txt = open(os.path.join(REPO, "js/config.js"), encoding="utf-8").read()
    block = txt[txt.index("countyIdToCode:"):]
    block = block[: block.index("},")]
    return {m.group(1): m.group(2) for m in re.finditer(r"'(\w)':\s*'(\d+)'", block)}


# CEC party name (normalised) -> CONFIG.parties key. Everything else -> OTHER.
PARTY_KEYS = {
    "中國國民黨": "KMT",
    "民主進步黨": "DPP",
    "台灣民眾黨": "TPP",
    "時代力量": "NPP",
    "親民黨": "PFP",
    "台灣基進": "TSP",
    "台灣基進黨": "TSP",
    "新黨": "NP",
    "綠黨": "GP",
    "台灣團結聯盟": "TSU",
    "無黨籍及未經政黨推薦": "IND",
    "無黨團結聯盟": "NSU",  # key exists in CONFIG.parties; not in the brief's list (flagged in report)
    "無": "IND",            # 2022 Chiayi rerun file writes 無 for non-partisan
}


def party_key(name_zh):
    return PARTY_KEYS.get(norm(name_zh), "OTHER")
