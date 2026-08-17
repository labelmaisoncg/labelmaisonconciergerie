# -*- coding: utf-8 -*-
"""Gabarit d'article de blog, calé sur celui des articles existants.

Reprend les classes de /css/seo-silo.css déjà utilisées par
/fiscalite-airbnb-ile-de-france : .article, .catpill, .artmeta, .lead, .tip,
.related. Ajoute le balisage Article + FAQPage + BreadcrumbList.
"""
from __future__ import annotations

import seo_common as C

NAV = [("Blog", "/blog"), ("Propriétaires", "/proprietaires"),
       ("Estimation gratuite", "/estimation-rentabilite-airbnb"),
       ("Nos villes", "/conciergerie-airbnb-france")]

FOOTER = [("Propriétaires", [("Estimer mes revenus", "/estimation-rentabilite-airbnb"),
                             ("Simulateur de revenus", "/simulateur-revenus-airbnb"),
                             ("Notre offre de gestion", "/proprietaires"),
                             ("Gestion locative", "/gestion-locative-france"),
                             ("Investissement locatif", "/investissement-locatif-paris")]),
          ("Nos territoires", [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                               ("Banlieue parisienne", "/conciergerie-airbnb-banlieue-parisienne"),
                               ("Essonne (91)", "/conciergerie-airbnb-essonne"),
                               ("Côte d'Azur", "/conciergerie-cote-d-azur"),
                               ("Toute la France", "/conciergerie-airbnb-france")])]

# Le blog s'adresse aux propriétaires : le CTA est toujours l'estimation.
CTA = ("Recevez une estimation gratuite de vos revenus",
       "Décrivez-nous votre logement en trois lignes. Nous étudions des biens comparables "
       "réellement loués autour du vôtre et nous vous répondons avec une fourchette argumentée, "
       "charges déduites.")


def page(a: dict) -> str:
    slug = a["slug"]
    path = "/" + slug
    url = C.SITE + path
    photo = a.get("photo") or C.photo(len(slug))
    trail = [("Accueil", "/"), ("Blog", "/blog"), (a["crumb"], path)]

    corps = []
    for titre, blocs in a["sections"]:
        corps.append(f"<h2>{titre}</h2>")
        corps.extend(blocs)

    ld_article = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": a["h1"],
        "description": a["desc"],
        "image": f"{C.SITE}/images/{photo[0]}",
        "datePublished": a["date"],
        "dateModified": a.get("maj", a["date"]),
        "author": {"@type": "Organization", "name": "Label Maison Conciergerie",
                   "url": C.SITE + "/"},
        "publisher": {"@type": "Organization", "name": "Label Maison Conciergerie",
                      "logo": {"@type": "ImageObject", "url": C.LOGO}},
        "mainEntityOfPage": {"@type": "WebPage", "@id": url},
        "articleSection": a["cat"],
        "inLanguage": "fr-FR",
    }

    lus = "".join(f'<a href="{u}">{C.esc(n)}</a>' for n, u in a["related"])
    tip = f'<div class="tip">{a["tip"]}</div>' if a.get("tip") else ""

    parts = [
        C.head(a["title"], a["desc"], path,
               [ld_article, C.ld_faq(a["faq"]), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{photo[0]}"),
        C.header(NAV),
        C.crumb(trail),
        f'<article class="article"><span class="catpill">{C.esc(a["cat"])}</span>'
        f'<h1>{a["h1"]}</h1>'
        f'<p class="artmeta">Publié le {a["date_txt"]} · {a["lecture"]} min de lecture '
        f'· par Label Maison Conciergerie</p>'
        f'<p class="lead">{a["lead"]}</p>{tip}'
        + "\n".join(corps)
        + f'<div class="related"><h3>À lire aussi</h3>{lus}</div></article>',
        C.formulaire(CTA[0], CTA[1], a.get("ville", ""), "Estimation de revenus", a["title"]),
        C.faq("Questions fréquentes", a["faq"]),
        C.footer(FOOTER,
                 "Le blog des propriétaires — réglementation, rentabilité et "
                 "<span class=\"font-serif-italic\">gestion locative</span>.",
                 "Paris · Île-de-France · France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts)
    return path
