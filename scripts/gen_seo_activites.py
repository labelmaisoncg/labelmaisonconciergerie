# -*- coding: utf-8 -*-
"""Silo SEO « activités » : apporteur d'affaires, Chine, personal shopping,
horlogerie, transport et voyage (36 pages).

Chaque page est construite par gen_seo_services.build, donc avec le même
gabarit que le reste du site et le formulaire de contact (/api/contact) en bas
de page, sans exception. Le script maille aussi les pages existantes
(personal shopper, montres, Dubaï, Marrakech, conciergerie privée) vers les
nouvelles.

Lancer ensuite build_seo_index.py puis check_seo.py.
"""
from __future__ import annotations

import pathlib
import re

import seo_common as C
from gen_seo_services import build
from activites import apporteur, chine, montres, shopping, transport
from activites import commun as K

FAMILLES = [("Apporteur d'affaires", apporteur.PAGES), ("Chine", chine.PAGES),
            ("Personal shopping", shopping.PAGES), ("Horlogerie", montres.PAGES),
            ("Transport & voyage", transport.PAGES)]

# page existante -> liens à ajouter dans son bloc « zones »
PATCHS = {
    "personal-shopper-paris.html": [("Sacs de luxe", "/personal-shopper-sac-de-luxe-paris"),
                                    ("Joaillerie", "/personal-shopper-joaillerie-paris"),
                                    ("Mode homme", "/personal-shopper-mode-homme-paris"),
                                    ("Cadeaux d'affaires", "/cadeaux-d-affaires-luxe"),
                                    ("À distance", "/personal-shopper-a-distance"),
                                    ("Détaxe à Paris", "/detaxe-shopping-paris"),
                                    ("Personal shopper Dubaï", "/personal-shopper-dubai"),
                                    ("Apporteur d'affaires", K.HUB_APPORTEUR)],
    "achat-vente-montres-de-luxe.html": [("Patek Philippe", "/acheter-une-patek-philippe-paris"),
                                         ("Audemars Piguet", "/acheter-une-audemars-piguet-paris"),
                                         ("Richard Mille", "/acheter-une-richard-mille-paris"),
                                         ("Occasion vérifiée", "/montre-de-luxe-occasion-certifiee"),
                                         ("Authentification", "/authentification-montre-de-luxe"),
                                         ("Offrir une montre", "/montre-cadeau-luxe"),
                                         ("Hong Kong", "/montres-de-luxe-hong-kong"),
                                         ("Apporteur d'affaires horlogerie", "/apporteur-d-affaires-montres-de-luxe")],
    "conciergerie-dubai.html": [("Personal shopper Dubaï", "/personal-shopper-dubai"),
                                ("Voitures de luxe à Dubaï", "/location-voiture-de-luxe-dubai"),
                                ("Apporteur d'affaires Dubaï", "/apporteur-d-affaires-dubai")],
    "conciergerie-marrakech.html": [("Personal shopper Marrakech", "/personal-shopper-marrakech"),
                                    ("Apporteur d'affaires Maroc", "/apporteur-d-affaires-maroc")],
    "conciergerie-privee-paris.html": [("Voitures de luxe", K.HUB_TRANSPORT),
                                       ("Tables et restaurants", "/reservation-restaurant-paris-conciergerie"),
                                       ("Événement privé", "/organisation-evenement-prive-paris"),
                                       ("Vols business et première", "/billets-d-avion-business-class"),
                                       ("Conciergerie Chine", K.HUB_CHINE),
                                       ("Apporteur d'affaires", K.HUB_APPORTEUR)],
    "chauffeur-prive-paris.html": [("Voitures de luxe à Paris", K.HUB_TRANSPORT),
                                   ("Jet privé", "/jet-prive-location")],
    "conciergerie-airbnb-expatrie-chine.html": [("Conciergerie Chine", K.HUB_CHINE),
                                                ("Clientèle chinoise à Paris", "/clientele-chinoise-paris")],
}


def patch_existantes() -> int:
    n = 0
    for fichier, liens in PATCHS.items():
        p = C.OUT / fichier
        if not p.exists():
            continue
        s = p.read_text(encoding="utf-8")
        ajout = "".join(f'<a href="{u}">{C.esc(l)}</a>' for l, u in liens if f'href="{u}"' not in s)
        if not ajout:
            continue
        s2, k = re.subn(r'(<div class="zones"[^>]*>)(.*?)(</div>)',
                        lambda m: m.group(1) + m.group(2) + ajout + m.group(3), s, count=1, flags=re.S)
        if k:
            p.write_text(s2, encoding="utf-8")
            n += 1
    return n


def main() -> list:
    urls = []
    for nom, pages in FAMILLES:
        for s in pages:
            # Les titres longs perdent le suffixe de marque : les mots-clés passent avant.
            if len(s["title"]) > 75 and s["title"].endswith(" | Label Maison"):
                s["title"] = s["title"][: -len(" | Label Maison")]
            urls.append(build(s))
        print(f"  {nom} : {len(pages)} pages")
    n = patch_existantes()
    print(f"Activités : {len(urls)} pages, {n} pages existantes maillées")
    return urls


if __name__ == "__main__":
    main()
