#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Gera JSONs compactos de votação por seção para as Eleições Municipais de 2024 no ES.

Fontes oficiais do TSE:
- Boletim de Urna 2024 (1º e 2º turnos, ES)
- Eleitorado por local de votação 2024

Saída:
  data/2024/secoes/1/<codigo_tse>.json
  data/2024/secoes/2/<codigo_tse>.json
"""

from __future__ import annotations

import csv
import io
import json
import os
import re
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict

BU_URLS = {
    "1": "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2024/buweb/bweb_1t_ES_091020241636.zip",
    "2": "https://cdn.tse.jus.br/estatistica/sead/eleicoes/eleicoes2024/buweb/bweb_2t_ES_281020241046.zip",
}
LOCAL_URL = "https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2024.zip"

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
OUT_ROOT = os.path.join(ROOT, "data", "2024", "secoes")


def norm_text(value: object) -> str:
    s = str(value or "")
    s = unicodedata.normalize("NFD", s)
    s = "".join(ch for ch in s if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def clean_key(key: object) -> str:
    return str(key or "").replace("\ufeff", "").strip().upper()


def clean_row(row: dict) -> dict:
    return {clean_key(k): (v.strip() if isinstance(v, str) else v) for k, v in row.items()}


def field(row: dict, *names: str, default: str = "") -> str:
    for name in names:
        v = row.get(name)
        if v not in (None, ""):
            return str(v).strip()
    return default


def as_int(value: object, default: int = 0) -> int:
    s = re.sub(r"[^0-9-]", "", str(value or ""))
    try:
        return int(s) if s else default
    except ValueError:
        return default


def code5(value: object) -> str:
    s = re.sub(r"\D", "", str(value or ""))
    return s.zfill(5) if s else ""


def download(url: str) -> bytes:
    print(f"Baixando: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 TSE-data-builder/1.0"})
    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()
    print(f"  {len(data) / 1024 / 1024:.1f} MB")
    return data


def csv_reader_from_zip(data: bytes):
    zf = zipfile.ZipFile(io.BytesIO(data))
    csv_names = [n for n in zf.namelist() if n.lower().endswith(".csv")]
    if not csv_names:
        raise RuntimeError("ZIP sem arquivo CSV")
    # Em alguns pacotes há mais de um CSV. O principal é normalmente o maior.
    name = max(csv_names, key=lambda n: zf.getinfo(n).file_size)
    print(f"  CSV: {name}")
    raw = zf.open(name)
    text = io.TextIOWrapper(raw, encoding="latin-1", errors="replace", newline="")
    return zf, raw, text, csv.DictReader(text, delimiter=";")


def load_locations() -> dict:
    """Mapeia (município, zona, seção) -> local/bairro/endereço."""
    payload = download(LOCAL_URL)
    zf, raw, text, reader = csv_reader_from_zip(payload)
    locations = {}
    count = 0
    try:
        for original in reader:
            row = clean_row(original)
            if field(row, "SG_UF").upper() != "ES":
                continue
            cd = code5(field(row, "CD_MUNICIPIO"))
            zona = as_int(field(row, "NR_ZONA"))
            secao = as_int(field(row, "NR_SECAO"))
            if not cd or not zona or not secao:
                continue
            locations[(cd, zona, secao)] = {
                "l": as_int(field(row, "NR_LOCAL_VOTACAO")),
                "n": field(row, "NM_LOCAL_VOTACAO", "DS_LOCAL_VOTACAO", default="Local de votação"),
                "b": field(row, "DS_BAIRRO", "NM_BAIRRO", default="Bairro não informado"),
                "e": field(row, "DS_ENDERECO", "DS_ENDERECO_LOCAL", default=""),
            }
            count += 1
    finally:
        text.close()
        raw.close()
        zf.close()
    print(f"Locais/seções do ES carregados: {count}")
    return locations


def vote_kind(row: dict) -> tuple[bool, bool]:
    """Retorna (é voto válido, é voto nominal de candidato)."""
    ds = norm_text(field(row, "DS_TIPO_VOTAVEL", "NM_TIPO_VOTAVEL"))
    if ds:
        nominal = "nominal" in ds or "candidato" in ds
        legenda = "legenda" in ds
        return nominal or legenda, nominal

    # Fallback para eventuais arquivos sem descrição de tipo de votável.
    nm = norm_text(field(row, "NM_VOTAVEL"))
    invalid = any(x in nm for x in ("branco", "nulo", "anulado"))
    return not invalid, not invalid


def build_turn(turn: str, locations: dict) -> None:
    payload = download(BU_URLS[turn])
    zf, raw, text, reader = csv_reader_from_zip(payload)

    sections = {}
    candidate_meta = {"11": defaultdict(dict), "13": defaultdict(dict)}

    try:
        for original in reader:
            row = clean_row(original)
            if field(row, "SG_UF").upper() != "ES":
                continue
            row_turn = str(as_int(field(row, "NR_TURNO"), 0))
            if row_turn and row_turn != turn:
                continue

            cargo = str(as_int(field(row, "CD_CARGO_PERGUNTA", "CD_CARGO"), 0))
            if cargo not in ("11", "13"):
                continue

            cd = code5(field(row, "CD_MUNICIPIO"))
            zona = as_int(field(row, "NR_ZONA"))
            secao = as_int(field(row, "NR_SECAO"))
            if not cd or not zona or not secao:
                continue

            key = (cd, zona, secao)
            s = sections.get(key)
            if s is None:
                loc = locations.get(key, {})
                s = {
                    "m": field(row, "NM_MUNICIPIO", default=cd),
                    "cd": cd,
                    "z": zona,
                    "s": secao,
                    "l": loc.get("l") or as_int(field(row, "NR_LOCAL_VOTACAO")),
                    "b": loc.get("b") or "Bairro não informado",
                    "n": loc.get("n") or "Local de votação",
                    "e": loc.get("e") or "",
                    "a": as_int(field(row, "QT_APTOS")),
                    "c": as_int(field(row, "QT_COMPARECIMENTO")),
                    "ab": as_int(field(row, "QT_ABSTENCOES")),
                    "vv": {"11": 0, "13": 0},
                    "v": {"11": defaultdict(int), "13": defaultdict(int)},
                }
                sections[key] = s
            else:
                # Esses totais se repetem nas linhas de candidatos; guardamos o maior valor não zero.
                s["a"] = max(s["a"], as_int(field(row, "QT_APTOS")))
                s["c"] = max(s["c"], as_int(field(row, "QT_COMPARECIMENTO")))
                s["ab"] = max(s["ab"], as_int(field(row, "QT_ABSTENCOES")))

            votes = as_int(field(row, "QT_VOTOS"))
            if votes < 0:
                votes = 0
            is_valid, is_nominal = vote_kind(row)
            if is_valid:
                s["vv"][cargo] += votes

            if is_nominal:
                number = re.sub(r"\D", "", field(row, "NR_VOTAVEL", "NR_CANDIDATO"))
                if not number:
                    continue
                number = str(int(number))
                s["v"][cargo][number] += votes
                meta = candidate_meta[cargo][(cd, number)]
                name = field(row, "NM_VOTAVEL", "NM_CANDIDATO", default="Sem nome")
                party = field(row, "SG_PARTIDO", default="")
                if name and (not meta.get("u") or meta.get("u") == "Sem nome"):
                    meta["u"] = name
                if party and not meta.get("p"):
                    meta["p"] = party
    finally:
        text.close()
        raw.close()
        zf.close()

    by_city = defaultdict(list)
    for s in sections.values():
        by_city[s["cd"]].append(s)

    out_dir = os.path.join(OUT_ROOT, turn)
    os.makedirs(out_dir, exist_ok=True)

    written = 0
    for cd, city_sections in by_city.items():
        city_sections.sort(key=lambda x: (x["z"], x["s"]))
        city_name = city_sections[0]["m"] if city_sections else cd
        index_by_key = {(s["z"], s["s"]): i for i, s in enumerate(city_sections)}

        out_sections = []
        vv = {"11": [], "13": []}
        v = {"11": defaultdict(list), "13": defaultdict(list)}
        totals = {"11": defaultdict(int), "13": defaultdict(int)}

        for i, s in enumerate(city_sections):
            out_sections.append({
                "z": s["z"], "s": s["s"], "l": s["l"], "b": s["b"], "n": s["n"], "e": s["e"],
                "a": s["a"], "c": s["c"], "ab": s["ab"],
            })
            for cargo in ("11", "13"):
                if s["vv"][cargo]:
                    vv[cargo].append([i, s["vv"][cargo]])
                for number, votes in s["v"][cargo].items():
                    if votes:
                        v[cargo][number].append([i, votes])
                        totals[cargo][number] += votes

        candidates = {"11": [], "13": []}
        for cargo in ("11", "13"):
            for number, total in totals[cargo].items():
                meta = candidate_meta[cargo].get((cd, number), {})
                candidates[cargo].append({
                    "n": number,
                    "u": meta.get("u") or f"Nº {number}",
                    "p": meta.get("p") or "",
                    "v": total,
                })
            candidates[cargo].sort(key=lambda x: (-x["v"], x["u"]))

        payload_out = {
            "m": city_name,
            "cd": cd,
            "t": int(turn),
            "s": out_sections,
            "vv": vv,
            "v": {cargo: dict(values) for cargo, values in v.items()},
            "cand": candidates,
            "src": "TSE - Boletim de Urna 2024 / Eleitorado por local de votação 2024",
        }
        path = os.path.join(out_dir, f"{cd}.json")
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload_out, f, ensure_ascii=False, separators=(",", ":"))
        written += 1

    print(f"Turno {turn}: {written} municípios gravados em {out_dir}")


def main() -> None:
    os.makedirs(OUT_ROOT, exist_ok=True)
    locations = load_locations()
    build_turn("1", locations)
    build_turn("2", locations)
    print("Concluído.")


if __name__ == "__main__":
    main()
