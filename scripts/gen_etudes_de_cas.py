# -*- coding: utf-8 -*-
"""Études de cas réelles (/etude-de-cas-<slug>) à partir de gestion/etudes-de-cas/*.json.

Ne produit rien tant qu'aucun fichier .json validé n'existe : les chiffres publiés
sont ceux mesurés sur des biens réellement gérés, avec l'accord du propriétaire
(voir gestion/etudes-de-cas/README.md). Aucune valeur n'est complétée par défaut.
"""
from __future__ import annotations

import json
import pathlib

import seo_article as ART
import seo_common as C

DOSSIER = C.ROOT / "gestion" / "etudes-de-cas"
OBLIGATOIRES = ("slug", "titre", "ville", "type_bien", "depuis", "periode", "chiffres",
                "contexte", "ce_que_nous_avons_fait", "resultat")


def valide(d: dict, f: pathlib.Path) -> bool:
    manquants = [k for k in OBLIGATOIRES if not d.get(k)]
    if manquants:
        print(f"✗ {f.name} : champs manquants {manquants} — page non générée")
        return False
    if any("…" in str(v) for v in d.values()) or any("…" in json.dumps(d["chiffres"])):
        print(f"✗ {f.name} : valeurs « … » non remplies — page non générée")
        return False
    return True


def page(d: dict) -> str:
    slug = "etude-de-cas-" + d["slug"]
    path = "/" + slug
    titre = d["titre"]
    desc = (f"Étude de cas réelle : {d['type_bien']} à {d['ville']}, géré par Label Maison depuis "
            f"{d['depuis']}. Chiffres mesurés sur la période {d['periode']}.")
    trail = [("Accueil", "/"), ("Études de cas", "/blog"), (d["ville"], path)]
    photos = d.get("photos") or []
    chiffres = "".join(f"<div class=\"card\"><h3>{C.esc(x['valeur'])}</h3><p>{C.esc(x['libelle'])}</p></div>"
                       for x in d["chiffres"])
    actions = "".join(f"<li>{C.esc(a)}</li>" for a in d["ce_que_nous_avons_fait"])
    citation = (f"<blockquote><p>« {C.esc(d['citation'])} »</p></blockquote>"
                if d.get("citation") else "")
    galerie = C.galerie("galcas", [(p, f"{d['type_bien']} à {d['ville']}") for p in photos]) if photos else ""
    ld = {
        "@context": "https://schema.org", "@type": "Article",
        "headline": titre, "description": desc,
        "author": {"@type": "Organization", "name": "Label Maison Conciergerie"},
        "publisher": {"@type": "Organization", "name": "Label Maison Conciergerie",
                      "logo": {"@type": "ImageObject", "url": C.LOGO}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": C.SITE + path},
        "inLanguage": "fr-FR",
    }
    parts = [
        C.head(titre, desc, path, [ld, C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{photos[0]}" if photos else C.LOGO),
        C.header(ART.NAV),
        C.crumb(trail),
        f'<section class="wrap"><span class="catpill">Étude de cas</span><h1>{C.esc(titre)}</h1>'
        f'<p class="lead">{C.esc(d["type_bien"])} · {C.esc(d["ville"])} · géré depuis {C.esc(d["depuis"])}</p>'
        f'<h2>Les chiffres, période {C.esc(d["periode"])}</h2>'
        f'<div class="grid g4" style="margin-top:24px">{chiffres}</div></section>',
        C.texte([d["contexte"]], titre="Le point de départ"),
        f'<section class="wrap"><h2>Ce que nous avons fait</h2><ul>{actions}</ul></section>',
        C.texte([d["resultat"]], titre="Le résultat") + citation,
        galerie,
        C.formulaire("Votre logement pourrait-il suivre le même chemin ?",
                     "Décrivez-nous votre bien : nous l'estimons à partir de logements comparables "
                     "réellement loués autour du vôtre.", d["ville"], "Conciergerie Airbnb", titre),
        C.footer(ART.FOOTER, "Des preuves, pas des promesses — "
                 "<span class=\"font-serif-italic\">des biens réels, des chiffres mesurés</span>.",
                 "Essonne · Paris · Île-de-France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts)
    return path


def main() -> list:
    urls = []
    for f in sorted(DOSSIER.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        if valide(d, f):
            urls.append(page(d))
    print(f"Études de cas : {len(urls)} page(s)")
    return urls


if __name__ == "__main__":
    main()
