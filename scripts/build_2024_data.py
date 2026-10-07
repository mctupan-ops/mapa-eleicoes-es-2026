#!/usr/bin/env python3
"""Gera JSON compacto por município com votação por seção no ES - Eleições Municipais 2024."""
from __future__ import annotations
import csv, io, json, re, shutil, tempfile, urllib.request, zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

BU_URLS = {
    1: "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2024/buweb/bweb_1t_ES_091020241636.zip",
    2: "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2024/buweb/bweb_2t_ES_281020241046.zip",
}
CKAN_ELEITORADO = "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=eleitorado-2024"
OUT = Path("data/2024/secoes")
CARGOS = {1: {"11", "13"}, 2: {"11"}}


def urlopen(url, timeout=240):
    req = urllib.request.Request(url, headers={"User-Agent": "mapa-eleicoes-es/2024-data-builder"})
    return urllib.request.urlopen(req, timeout=timeout)


def download(url, dest):
    print("Baixando", url)
    with urlopen(url) as r, dest.open("wb") as f:
        shutil.copyfileobj(r, f, 1024 * 1024)
    print(f"  -> {dest.stat().st_size/1024/1024:.1f} MB")


def resolve_locais_url():
    print("Consultando catálogo oficial do TSE para locais de votação 2024...")
    with urlopen(CKAN_ELEITORADO, 60) as r:
        pkg = json.load(r)
    resources = pkg.get("result", {}).get("resources", [])
    for x in resources:
        name = str(x.get("name") or x.get("description") or "").lower()
        if "eleitorado por local de votação" in name or "eleitorado por local de votacao" in name:
            u = x.get("url")
            if u:
                print("Local de votação:", u)
                return u
    raise RuntimeError("Recurso 'Eleitorado por local de votação - 2024' não encontrado no catálogo do TSE")


def csv_member(z):
    xs = [x for x in z.namelist() if x.lower().endswith(".csv") and not x.startswith("__MACOSX/")]
    if not xs:
        raise RuntimeError("ZIP sem CSV")
    return max(xs, key=lambda n: z.getinfo(n).file_size)


def rows_from_zip(path):
    with zipfile.ZipFile(path) as z:
        member = csv_member(z)
        print("Lendo", member)
        with z.open(member) as raw, io.TextIOWrapper(raw, encoding="latin-1", newline="") as txt:
            for row in csv.DictReader(txt, delimiter=";"):
                yield row


def val(row, *names):
    for n in names:
        if n in row and row[n] is not None:
            return str(row[n]).strip().strip('"')
    return ""


def inum(v):
    s = re.sub(r"[^0-9-]", "", str(v or ""))
    return int(s) if s not in ("", "-") else 0


def code(v, width=None):
    s = re.sub(r"\D", "", str(v or ""))
    if not s:
        return ""
    s = str(int(s))
    return s.zfill(width) if width else s


def norm(s):
    import unicodedata
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9 ]+", " ", s)).strip().lower()


def load_locais(path):
    out = {}
    count = 0
    for r in rows_from_zip(path):
        if val(r, "SG_UF", "UF").upper() != "ES":
            continue
        mun = code(val(r, "CD_MUNICIPIO", "COD_MUNICIPIO", "CD_MUN"), 5)
        z = inum(val(r, "NR_ZONA", "ZONA"))
        l = inum(val(r, "NR_LOCAL_VOTACAO", "CD_LOCAL_VOTACAO", "LOCAL_VOTACAO"))
        if not mun or not z or not l:
            continue
        bairro = val(r, "NM_BAIRRO", "DS_BAIRRO", "BAIRRO") or "Bairro não informado"
        nome = val(r, "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO", "LOCAL_VOTACAO_NOME") or "Local de votação"
        end = val(r, "DS_ENDERECO", "NM_ENDERECO", "ENDERECO")
        if not end:
            logr = val(r, "NM_LOGRADOURO", "DS_LOGRADOURO")
            nro = val(r, "NR_ENDERECO")
            end = (logr + ((", " + nro) if nro else "")).strip(", ")
        out[(mun, z, l)] = {"b": bairro, "n": nome, "e": end}
        count += 1
    print("Locais ES:", count)
    return out


def valid_vote(tipo):
    t = norm(tipo).upper()
    return "BRANCO" not in t and "NULO" not in t


def process_turn(turno, bu_path, locais):
    target = OUT / str(turno)
    target.mkdir(parents=True, exist_ok=True)
    cities = {}
    secidx = {}
    processed = 0

    def city(mun, name):
        if mun not in cities:
            cities[mun] = {
                "m": name,
                "cd": mun,
                "s": [],
                "vv": defaultdict(lambda: defaultdict(int)),
                "v": defaultdict(lambda: defaultdict(lambda: defaultdict(int))),
            }
            secidx[mun] = {}
        return cities[mun]

    for r in rows_from_zip(bu_path):
        if val(r, "SG_UF", "UF").upper() != "ES":
            continue
        t = inum(val(r, "NR_TURNO", "TURNO"))
        if t and t != turno:
            continue
        cargo = code(val(r, "CD_CARGO_PERGUNTA", "CD_CARGO", "NR_CARGO"))
        if cargo not in CARGOS[turno]:
            continue
        mun = code(val(r, "CD_MUNICIPIO", "COD_MUNICIPIO", "CD_MUN"), 5)
        if not mun:
            continue
        z = inum(val(r, "NR_ZONA", "ZONA"))
        s = inum(val(r, "NR_SECAO", "SECAO"))
        l = inum(val(r, "NR_LOCAL_VOTACAO", "CD_LOCAL_VOTACAO", "LOCAL_VOTACAO"))
        if not z or not s:
            continue
        co = city(mun, val(r, "NM_MUNICIPIO", "MUNICIPIO"))
        key = (z, s)
        idx = secidx[mun].get(key)
        if idx is None:
            lm = locais.get((mun, z, l), {})
            idx = len(co["s"])
            secidx[mun][key] = idx
            co["s"].append({
                "z": z,
                "s": s,
                "l": l,
                "b": lm.get("b", "Bairro não informado"),
                "n": lm.get("n", "Local de votação"),
                "e": lm.get("e", ""),
                "a": inum(val(r, "QT_APTOS", "QT_ELEITORES_APTOS")),
                "c": inum(val(r, "QT_COMPARECIMENTO", "QT_COMPARECIMENTO_SECAO")),
                "ab": inum(val(r, "QT_ABSTENCOES", "QT_ABSTENCAO")),
            })
        else:
            sm = co["s"][idx]
            sm["a"] = max(sm.get("a", 0), inum(val(r, "QT_APTOS", "QT_ELEITORES_APTOS")))
            sm["c"] = max(sm.get("c", 0), inum(val(r, "QT_COMPARECIMENTO", "QT_COMPARECIMENTO_SECAO")))
            sm["ab"] = max(sm.get("ab", 0), inum(val(r, "QT_ABSTENCOES", "QT_ABSTENCAO")))

        votos = inum(val(r, "QT_VOTOS", "QT_VOTO"))
        tipo = val(r, "DS_TIPO_VOTAVEL", "NM_TIPO_VOTAVEL", "TP_VOTO")
        if valid_vote(tipo):
            co["vv"][cargo][idx] += votos
        nr = code(val(r, "NR_VOTAVEL", "NR_CANDIDATO", "NUMERO_VOTAVEL"))
        if nr and votos > 0 and valid_vote(tipo):
            co["v"][cargo][nr][idx] += votos
        processed += 1

    print("Turno", turno, "linhas:", processed, "municípios:", len(cities))
    index = []
    for mun, co in sorted(cities.items()):
        vv = {c: [[i, v] for i, v in sorted(mp.items()) if v] for c, mp in co["vv"].items()}
        votes = {
            c: {nr: [[i, v] for i, v in sorted(mp.items()) if v] for nr, mp in cmap.items()}
            for c, cmap in co["v"].items()
        }
        data = {
            "m": co["m"], "cd": mun, "ano": 2024, "turno": turno,
            "s": co["s"], "vv": vv, "v": votes,
            "src": "TSE - Boletim de Urna 2024 / Eleitorado por local de votação 2024",
        }
        p = target / f"{mun}.json"
        p.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        index.append({"cd": mun, "m": co["m"], "secoes": len(co["s"]), "bytes": p.stat().st_size})
        print(turno, mun, co["m"], len(co["s"]), f"{p.stat().st_size/1024:.1f} KB")

    (target / "index.json").write_text(json.dumps({
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "turno": turno,
        "source_bu": BU_URLS[turno],
        "municipios": index,
    }, ensure_ascii=False, indent=2), encoding="utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as td:
        td = Path(td)
        locais_zip = td / "locais2024.zip"
        download(resolve_locais_url(), locais_zip)
        locais = load_locais(locais_zip)
        for turno, url in BU_URLS.items():
            bu = td / f"bu{turno}.zip"
            download(url, bu)
            process_turn(turno, bu, locais)


if __name__ == "__main__":
    main()
