# -*- coding: utf-8 -*-
"""Référentiel des communes françaises (source : geo.api.gouv.fr).

Le fichier est mis en cache dans scripts/.cache/communes.json (non versionné).
Toutes les données utilisées dans les pages générées viennent de ce référentiel
officiel — population INSEE, code postal, département, région, coordonnées —
de sorte qu'aucun chiffre n'est inventé.
"""
from __future__ import annotations

import json
import math
import pathlib
import urllib.request

import seo_common as C

API = ("https://geo.api.gouv.fr/communes?fields=nom,code,codesPostaux,population,"
       "centre,departement,region&format=json")
CACHE = pathlib.Path(__file__).resolve().parent / ".cache" / "communes.json"
SEUIL = 10_000  # habitants : le seuil de génération d'une page commune

PARIS = (48.8566, 2.3522)


def charger() -> list:
    if not CACHE.exists():
        CACHE.parent.mkdir(parents=True, exist_ok=True)
        print("Téléchargement du référentiel des communes…")
        with urllib.request.urlopen(API, timeout=120) as r:
            CACHE.write_bytes(r.read())
    return json.loads(CACHE.read_text(encoding="utf-8"))


def dist(a: tuple, b: tuple) -> float:
    """Distance orthodromique en km (formule de haversine)."""
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = (math.sin((la2 - la1) / 2) ** 2
         + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2)
    return 2 * 6371 * math.asin(math.sqrt(h))


class Commune:
    __slots__ = ("nom", "insee", "cp", "pop", "lat", "lon", "dept", "dept_nom",
                 "region", "slug", "voisines", "prefecture")

    def __init__(self, d: dict):
        self.nom = d["nom"]
        self.insee = d["code"]
        self.cp = (d.get("codesPostaux") or [""])[0]
        self.pop = d.get("population") or 0
        c = (d.get("centre") or {}).get("coordinates") or [0, 0]
        self.lon, self.lat = c[0], c[1]
        self.dept = (d.get("departement") or {}).get("code", "")
        self.dept_nom = (d.get("departement") or {}).get("nom", "")
        self.region = (d.get("region") or {}).get("nom", "")
        self.slug = C.slugify(self.nom)
        self.voisines: list = []
        self.prefecture = False

    @property
    def coord(self) -> tuple:
        return (self.lat, self.lon)

    @property
    def km_paris(self) -> int:
        return round(dist(self.coord, PARIS))


def selection(seuil: int = SEUIL) -> tuple:
    """Retourne (communes retenues, plus grande commune par département)."""
    brut = [Commune(d) for d in charger() if (d.get("population") or 0) >= seuil]
    brut.sort(key=lambda c: -c.pop)

    # Chefs-lieux de fait : la commune la plus peuplée de chaque département.
    plus_grande: dict = {}
    for c in brut:
        plus_grande.setdefault(c.dept, c)
    for c in plus_grande.values():
        c.prefecture = True

    # Homonymes : on suffixe par le code du département (Saint-Denis 93 / 974…).
    compte: dict = {}
    for c in brut:
        compte[c.slug] = compte.get(c.slug, 0) + 1
    for c in brut:
        if compte[c.slug] > 1:
            c.slug = f"{c.slug}-{c.dept.lower()}"

    # Communes voisines réelles : les 6 plus proches, même département en priorité.
    par_dept: dict = {}
    for c in brut:
        par_dept.setdefault(c.dept, []).append(c)
    for c in brut:
        pool = [x for x in par_dept[c.dept] if x.insee != c.insee]
        if len(pool) < 6:
            pool += [x for x in brut
                     if x.dept != c.dept and dist(c.coord, x.coord) < 60][:12]
        c.voisines = sorted(pool, key=lambda x: dist(c.coord, x.coord))[:6]

    return brut, plus_grande


def deja_couvertes() -> dict:
    """slug -> URL de la page déjà écrite à la main (silos curés)."""
    out = {}
    for p in C.OUT.glob("*.html"):
        n = p.stem
        if C.MARQUEUR_AUTO in p.read_text(encoding="utf-8")[:200]:
            continue  # page produite par le générateur de masse, pas un silo curé
        for prefixe in ("conciergerie-airbnb-", "conciergerie-"):
            if n.startswith(prefixe):
                out.setdefault(n[len(prefixe):], "/" + n)
                break
    return out


# --------------------------------------------------------------------------- #
#  Prépositions : « en Gironde » mais « dans l'Ain », « dans les Yvelines »…
#  Table figée : les 101 départements et les collectivités, pas de devinette.
# --------------------------------------------------------------------------- #
LOC_DEPT = {
    "01": "dans l'Ain", "02": "dans l'Aisne", "03": "dans l'Allier",
    "04": "dans les Alpes-de-Haute-Provence", "05": "dans les Hautes-Alpes",
    "06": "dans les Alpes-Maritimes", "07": "en Ardèche", "08": "dans les Ardennes",
    "09": "en Ariège", "10": "dans l'Aube", "11": "dans l'Aude", "12": "dans l'Aveyron",
    "13": "dans les Bouches-du-Rhône", "14": "dans le Calvados", "15": "dans le Cantal",
    "16": "en Charente", "17": "en Charente-Maritime", "18": "dans le Cher",
    "19": "en Corrèze", "2A": "en Corse-du-Sud", "2B": "en Haute-Corse",
    "21": "en Côte-d'Or", "22": "dans les Côtes-d'Armor", "23": "dans la Creuse",
    "24": "en Dordogne", "25": "dans le Doubs", "26": "dans la Drôme", "27": "dans l'Eure",
    "28": "en Eure-et-Loir", "29": "dans le Finistère", "30": "dans le Gard",
    "31": "en Haute-Garonne", "32": "dans le Gers", "33": "en Gironde",
    "34": "dans l'Hérault", "35": "en Ille-et-Vilaine", "36": "dans l'Indre",
    "37": "en Indre-et-Loire", "38": "en Isère", "39": "dans le Jura",
    "40": "dans les Landes", "41": "en Loir-et-Cher", "42": "dans la Loire",
    "43": "en Haute-Loire", "44": "en Loire-Atlantique", "45": "dans le Loiret",
    "46": "dans le Lot", "47": "en Lot-et-Garonne", "48": "en Lozère",
    "49": "en Maine-et-Loire", "50": "dans la Manche", "51": "dans la Marne",
    "52": "en Haute-Marne", "53": "en Mayenne", "54": "en Meurthe-et-Moselle",
    "55": "dans la Meuse", "56": "dans le Morbihan", "57": "en Moselle",
    "58": "dans la Nièvre", "59": "dans le Nord", "60": "dans l'Oise", "61": "dans l'Orne",
    "62": "dans le Pas-de-Calais", "63": "dans le Puy-de-Dôme",
    "64": "dans les Pyrénées-Atlantiques", "65": "dans les Hautes-Pyrénées",
    "66": "dans les Pyrénées-Orientales", "67": "dans le Bas-Rhin",
    "68": "dans le Haut-Rhin", "69": "dans le Rhône", "70": "en Haute-Saône",
    "71": "en Saône-et-Loire", "72": "dans la Sarthe", "73": "en Savoie",
    "74": "en Haute-Savoie", "75": "à Paris", "76": "en Seine-Maritime",
    "77": "en Seine-et-Marne", "78": "dans les Yvelines", "79": "dans les Deux-Sèvres",
    "80": "dans la Somme", "81": "dans le Tarn", "82": "en Tarn-et-Garonne",
    "83": "dans le Var", "84": "dans le Vaucluse", "85": "en Vendée",
    "86": "dans la Vienne", "87": "en Haute-Vienne", "88": "dans les Vosges",
    "89": "dans l'Yonne", "90": "dans le Territoire de Belfort", "91": "dans l'Essonne",
    "92": "dans les Hauts-de-Seine", "93": "en Seine-Saint-Denis",
    "94": "dans le Val-de-Marne", "95": "dans le Val-d'Oise",
    "971": "en Guadeloupe", "972": "en Martinique", "973": "en Guyane",
    "974": "à La Réunion", "975": "à Saint-Pierre-et-Miquelon", "976": "à Mayotte",
    "977": "à Saint-Barthélemy", "978": "à Saint-Martin",
    "984": "dans les Terres australes", "986": "à Wallis-et-Futuna",
    "987": "en Polynésie française", "988": "en Nouvelle-Calédonie",
}

LOC_REGION = {
    "Grand Est": "dans le Grand Est", "Hauts-de-France": "dans les Hauts-de-France",
    "Pays de la Loire": "dans les Pays de la Loire",
}


def loc_dept(code: str, nom: str) -> str:
    return LOC_DEPT.get(code, f"en {nom}")


def loc_region(nom: str) -> str:
    return LOC_REGION.get(nom, f"en {nom}")
