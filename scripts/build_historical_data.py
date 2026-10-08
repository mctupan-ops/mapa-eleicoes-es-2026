#!/usr/bin/env python3
"""Build compact historical rankings for the static GitHub Pages app.

Source: TSE Open Data ZIPs (votacao_candidato_munzona). The output keeps only
aggregated, public candidate totals and the top N candidates per cargo/UF/turn.
"""
from __future__ import annotations
import csv, io, json, os, re, sys, unicodedata, urllib.request, zipfile
from collections import defaultdict
from pathlib import Path

YEARS = [2012, 2014, 2016, 2018, 2020, 2022, 2024]
TOP_N = int(os.environ.get("HISTORY_TOP_N", "300"))
OUT = Path(os.environ.get("HISTORY_OUT", "data/history"))
BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_{year}.zip"

CANON = {
    "presidente":"Presidente", "governador":"Governador", "senador":"Senador",
    "deputado federal":"Deputado Federal", "deputado estadual":"Deputado Estadual",
    "deputado distrital":"Deputado Distrital", "prefeito":"Prefeito", "vereador":"Vereador",
}

def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", str(s or ""))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower().strip())

def to_int(v) -> int:
    try:
        return int(float(str(v or "0").replace(",", ".")))
    except Exception:
        return 0

def download(year: int) -> Path:
    cache = Path(".cache-history")
    cache.mkdir(exist_ok=True)
    dst = cache / f"votacao_candidato_munzona_{year}.zip"
    if dst.exists() and dst.stat().st_size > 1024:
        return dst
    url = BASE.format(year=year)
    print(f"Downloading {url}", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent":"Mozilla/5.0 history-builder"})
    with urllib.request.urlopen(req, timeout=180) as r, open(dst, "wb") as f:
        while True:
            b = r.read(1024 * 1024)
            if not b: break
            f.write(b)
    return dst

def rowget(row, *names):
    for n in names:
        if n in row and row[n] not in (None, ""):
            return row[n]
    return ""

def process_year(year: int, zpath: Path):
    agg = defaultdict(lambda: defaultdict(lambda: defaultdict(dict)))
    br_pres = defaultdict(dict)
    with zipfile.ZipFile(zpath) as z:
        members = [n for n in z.namelist() if n.lower().endswith('.csv') and '__macosx' not in n.lower()]
        print(f"{year}: {len(members)} CSV files", flush=True)
        for mi, member in enumerate(members,1):
            print(f"  [{mi}/{len(members)}] {member}", flush=True)
            with z.open(member) as raw:
                txt = io.TextIOWrapper(raw, encoding='latin-1', errors='replace', newline='')
                reader = csv.DictReader(txt, delimiter=';', quotechar='"')
                if not reader.fieldnames: continue
                reader.fieldnames = [h.replace('\ufeff','').strip() for h in reader.fieldnames]
                for row in reader:
                    uf = rowget(row,'SG_UF').strip().upper()
                    if len(uf) != 2 or uf == 'ZZ':
                        continue
                    turno = str(rowget(row,'NR_TURNO') or '1').strip()
                    cargo_raw = rowget(row,'DS_CARGO')
                    cargo = CANON.get(norm(cargo_raw))
                    if not cargo:
                        continue
                    votos = to_int(rowget(row,'QT_VOTOS_NOMINAIS','QT_VOTOS'))
                    if votos < 0:
                        continue
                    seq = str(rowget(row,'SQ_CANDIDATO')).strip()
                    nr = str(rowget(row,'NR_CANDIDATO')).strip()
                    nome = rowget(row,'NM_URNA_CANDIDATO','NM_CANDIDATO').strip()
                    partido = rowget(row,'SG_PARTIDO').strip()
                    municipio = rowget(row,'NM_MUNICIPIO').strip()
                    situacao = rowget(row,'DS_SIT_TOT_TURNO').strip()
                    if not seq:
                        seq = f"{uf}|{municipio}|{cargo}|{nr}|{nome}"
                    bucket = agg[uf][turno][cargo]
                    rec = bucket.get(seq)
                    if rec is None:
                        rec = bucket[seq] = {"seq":seq,"number":nr,"name":nome,"party":partido,"votes":0,"municipio":municipio,"status":situacao}
                    rec["votes"] += votos
                    if situacao and not rec.get("status"): rec["status"] = situacao
                    if cargo == 'Presidente':
                        brec = br_pres[turno].get(seq)
                        if brec is None:
                            brec = br_pres[turno][seq] = {"seq":seq,"number":nr,"name":nome,"party":partido,"votes":0,"municipio":"Brasil","status":situacao}
                        brec["votes"] += votos

    year_dir = OUT / str(year)
    year_dir.mkdir(parents=True, exist_ok=True)
    meta = {"year":year,"source":"TSE Dados Abertos · votacao_candidato_munzona","top_n":TOP_N,"ufs":[]}
    for uf in sorted(agg):
        payload = {"year":year,"uf":uf,"source":meta["source"],"top_n":TOP_N,"turns":{}}
        for turno in sorted(agg[uf], key=lambda x:int(x) if x.isdigit() else 99):
            cargos = {}
            for cargo, recs in agg[uf][turno].items():
                arr = sorted(recs.values(), key=lambda r:(-r['votes'], norm(r['name'])))[:TOP_N]
                for i,r in enumerate(arr,1): r['rank'] = i
                cargos[cargo] = arr
            payload["turns"][turno] = cargos
        (year_dir / f"{uf.lower()}.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
        meta["ufs"].append(uf)
    if br_pres:
        payload = {"year":year,"uf":"BR","source":meta["source"],"top_n":TOP_N,"turns":{}}
        for turno,recs in br_pres.items():
            arr = sorted(recs.values(), key=lambda r:(-r['votes'], norm(r['name'])))[:TOP_N]
            for i,r in enumerate(arr,1): r['rank'] = i
            payload["turns"][turno] = {"Presidente":arr}
        (year_dir / "br.json").write_text(json.dumps(payload, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
        meta["ufs"].append("BR")
    (year_dir / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(',',':')), encoding='utf-8')
    print(f"{year}: wrote {len(meta['ufs'])} UF files", flush=True)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    years = [int(x) for x in sys.argv[1:]] if len(sys.argv) > 1 else YEARS
    index = {"years":[],"source":"TSE Dados Abertos"}
    for y in years:
        try:
            process_year(y, download(y))
            index["years"].append(y)
        except Exception as e:
            print(f"ERROR {y}: {e}", file=sys.stderr, flush=True)
            raise
    (OUT / "index.json").write_text(json.dumps(index, ensure_ascii=False, separators=(',',':')), encoding='utf-8')

if __name__ == '__main__':
    main()
