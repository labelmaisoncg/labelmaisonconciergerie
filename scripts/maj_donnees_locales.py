# -*- coding: utf-8 -*-
"""Reconstruit scripts/data_locales.json à partir des données ouvertes (data.gouv.fr).

Sources (licence ouverte Etalab) :
  1. DGFiP, « Tarifs taxe de séjour – Delta à partir de 2024 » : tarifs par
     collectivité et catégorie d'hébergement, avec les communes couvertes.
  2. Emet Expertise (d'après DGFiP/SIRENE), « Taxe de séjour : la collectivité qui
     la perçoit, commune par commune ».
  3. INSEE, « Capacités d'hébergements touristiques » (DS_TOUR_CAP, millésime 2026).
  4. Naistor, « Règles locales des meublés de tourisme, commune par commune »
     (78 communes, chacune avec sa source officielle).

Les fichiers sont téléchargés dans scripts/.cache/opendata/ (non versionné), puis
réduits aux communes du maillage (data_communes.selection). À relancer une fois
par an, ou quand un jeu est mis à jour :  python3 scripts/maj_donnees_locales.py
"""
from __future__ import annotations

import collections
import csv
import io
import json
import pathlib
import urllib.request
import zipfile

import data_communes as D

CACHE = pathlib.Path(__file__).with_name(".cache") / "opendata"
SORTIE = pathlib.Path(__file__).with_name("data_locales.json")

SOURCES = {
    "ts_tarifs.csv": "https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets/"
                     "delta_deliberation_ts_tarif0/exports/csv?use_labels=true",
    "ts_collectivites.csv": "https://emetexpertise.fr/observatoire/taxe-de-sejour-collectivites.csv",
    "regles_communes.csv": "https://naistor.fr/donnees/communes-meubles-de-tourisme.csv",
    "insee_tour_cap.zip": "https://api.insee.fr/melodi/file/DS_TOUR_CAP/DS_TOUR_CAP_2026_CSV_FR",
}
HEBERGEMENTS = {
    "Hébergements sans classement ou en attente de classement": "nc",
    "Meublés de tourisme 1 étoile": "m1", "Meublés de tourisme 2 étoiles": "m2",
    "Meublés de tourisme 3 étoiles": "m3", "Meublés de tourisme 4 étoiles": "m4",
    "Meublés de tourisme 5 étoiles": "m5", "Palaces": "palace",
}


def telecharger() -> None:
    CACHE.mkdir(parents=True, exist_ok=True)
    for nom, url in SOURCES.items():
        cible = CACHE / nom
        if cible.exists():
            continue
        print(f"Téléchargement {nom}…")
        with urllib.request.urlopen(url, timeout=600) as r:
            cible.write_bytes(r.read())


def main() -> None:
    telecharger()
    communes, _ = D.selection()
    cibles = {c.insee: c for c in communes}

    # 2. collectivité bénéficiaire
    coll = {}
    with open(CACHE / "ts_collectivites.csv", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            if r["code_insee"] in cibles:
                coll[r["code_insee"]] = {
                    "collectivite": r["collectivite_beneficiaire"], "type": r["type_beneficiaire"],
                    "regime": r["regime"], "millesime": r["millesime_deliberation"],
                    "siren": r["siren_beneficiaire"]}

    # 1. tarifs (clé DGFiP : département + numéro de commune sur 3 chiffres)
    cle = {}
    for insee in cibles:
        dep, com = (insee[:3], insee[3:]) if insee[:2] in ("97", "98") else (insee[:2], insee[2:])
        for d in {dep, dep.lstrip("0") or dep}:
            for c in {com, com.lstrip("0") or com}:
                cle[(d, c)] = insee
    tarifs = collections.defaultdict(dict)
    with open(CACHE / "ts_tarifs.csv", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f, delimiter=";"):
            cat = HEBERGEMENTS.get(r["HEBERGEMENT"])
            if not cat or r["DATE FIN"].strip() or r["DEF/PROV"] != "DEFINITIF":
                continue
            insee = cle.get((r["DEPARTEMENT"].strip(), r["COMMUNE"].strip()))
            if not insee:
                continue
            eff = r["DATE EFFET"].strip()
            prev = tarifs[insee].get(cat)
            if prev is None or eff > prev["effet"]:
                tarifs[insee][cat] = {"tarif": r["TARIF"], "unite": r["UNITE"], "effet": eff,
                                      "regime": r["REGIME"], "add_dep": r.get("TAXE ADD.DEP %", "")}

    # 4. règles locales
    regles = {}
    with open(CACHE / "regles_communes.csv", encoding="utf-8", newline="") as f:
        for r in csv.DictReader(f):
            if r["code_insee"] in cibles:
                regles[r["code_insee"]] = {k: r[k] for k in (
                    "changement_usage", "compensation", "autorisation_temporaire",
                    "enregistrement_numero", "plafond_residence_principale_jours",
                    "quotas_ou_zonage", "date_deliberation", "collectivite", "source_libelle",
                    "source_url", "source_type", "verifie_le") if k in r}

    # 3. INSEE : niveau commune, total toutes catégories, séjour total
    cap = collections.defaultdict(dict)
    with zipfile.ZipFile(CACHE / "insee_tour_cap.zip") as z:
        nom = next(n for n in z.namelist() if n.endswith("_data.csv"))
        with z.open(nom) as raw:
            for r in csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig"), delimiter=";"):
                if (r["GEO_OBJECT"] == "COM" and r["GEO"] in cibles
                        and r["UNIT_LOC_RANKING"] == "_T" and r["L_STAY"] == "_T"):
                    cap[r["GEO"]][(r["ACTIVITY"], r["TOUR_MEASURE"])] = r["OBS_VALUE"]

    out = {}
    for insee in cibles:
        d = {}
        if insee in coll:
            d["taxe_sejour"] = coll[insee]
        if insee in tarifs:
            d["tarifs"] = tarifs[insee]
        if insee in regles:
            d["regles"] = regles[insee]
        if insee in cap:
            g = lambda a, m: int(float(cap[insee].get((a, m), 0) or 0))
            d["hebergement"] = {"hotels": g("I551", "UNIT_LOC"), "chambres": g("I551", "PLACE"),
                                "campings": g("I553", "UNIT_LOC"), "emplacements": g("I553", "PLACE"),
                                "residences": g("I552B", "UNIT_LOC"), "autres": g("I552", "UNIT_LOC")}
        out[insee] = d
    SORTIE.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":"), sort_keys=True),
                      encoding="utf-8")
    print(f"{SORTIE.name} : {len(out)} communes — taxe {len(coll)}, tarifs {len(tarifs)}, "
          f"règles {len(regles)}, INSEE {len(cap)}")


if __name__ == "__main__":
    main()
