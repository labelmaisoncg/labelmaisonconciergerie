# -*- coding: utf-8 -*-
"""Génère les articles de blog et reconstruit le hub /blog.

Corrige aussi une anomalie des articles existants : cinq d'entre eux étaient
datés dans le futur (jusqu'à janvier 2027). Une date de publication postérieure
à la date du jour nuit à la crédibilité et brouille la fraîcheur perçue par les
moteurs ; on les repositionne sur des dates passées cohérentes.
"""
from __future__ import annotations

import re

import blog_articles_a as A
import blog_articles_b as B
import seo_article as ART
import seo_common as C

ARTICLES = A.ARTICLES + B.ARTICLES

# Articles antérieurs, conservés tels quels et intégrés au sommaire du blog.
EXISTANTS = [
    ("fiscalite-airbnb-ile-de-france", "Fiscalité",
     "Fiscalité Airbnb en Île-de-France : ce qu'il faut savoir",
     "Statut LMNP, micro-BIC ou réel, abattements après la loi Le Meur, taxe de séjour et CFE : "
     "les repères pour un propriétaire francilien.", "2026-01-15"),
    ("combien-rapporte-airbnb-91", "Rentabilité",
     "Combien rapporte un Airbnb dans le 91 (Essonne) ?",
     "La méthode de calcul appliquée au marché essonnien : revenu brut, taux d'occupation, "
     "charges et revenu net.", "2026-07-15"),
    ("comment-rentabiliser-airbnb-essonne", "Rentabilité",
     "Comment rentabiliser un Airbnb en Essonne ?",
     "Les leviers concrets pour améliorer le revenu d'un logement en location courte durée dans "
     "le département.", "2026-08-15"),
    ("airbnb-massy-rentabilite-2026", "Rentabilité",
     "Airbnb à Massy : quelle rentabilité en 2026 ?",
     "Le cas d'une ville de gare TGV et de pôle d'affaires : demande, saisonnalité et arbitrages "
     "de gestion.", "2026-07-30"),
    ("airbnb-evry-guide-proprietaire", "Guides villes",
     "Airbnb à Évry-Courcouronnes : le guide du propriétaire",
     "Marché local, réglementation, type de clientèle : le guide complet pour louer à "
     "Évry-Courcouronnes.", "2025-11-15"),
    ("erreurs-proprietaires-airbnb", "Exploitation",
     "Les 8 erreurs des propriétaires Airbnb (et comment les éviter)",
     "Photos bâclées, tarif figé, réponses tardives, réglementation ignorée : les fautes qui "
     "coûtent le plus cher.", "2025-12-15"),
    ("gestion-airbnb-ou-gestion-classique", "Choisir une conciergerie",
     "Gestion Airbnb ou gestion classique : que choisir ?",
     "Comparaison des deux modèles de gestion locative, charges et contraintes comprises.",
     "2025-10-15"),
    ("pourquoi-conciergerie-airbnb", "Choisir une conciergerie",
     "Pourquoi passer par une conciergerie Airbnb ?",
     "Ce qu'apporte réellement une gestion déléguée, et dans quels cas elle ne s'impose pas.",
     "2025-09-15"),
]

# Dates à corriger : slug -> (ancien texte affiché, nouveau texte, ancienne ISO, nouvelle ISO)
DATES_A_CORRIGER = {
    "fiscalite-airbnb-ile-de-france": ("15 janvier 2027", "15 janvier 2026", "2027-01-15", "2026-01-15"),
    "erreurs-proprietaires-airbnb": ("15 décembre 2026", "15 décembre 2025", "2026-12-15", "2025-12-15"),
    "airbnb-evry-guide-proprietaire": ("15 novembre 2026", "15 novembre 2025", "2026-11-15", "2025-11-15"),
    "gestion-airbnb-ou-gestion-classique": ("15 octobre 2026", "15 octobre 2025", "2026-10-15", "2025-10-15"),
    "pourquoi-conciergerie-airbnb": ("15 septembre 2026", "15 septembre 2025", "2026-09-15", "2025-09-15"),
}

ORDRE_CAT = ["Réglementation", "Fiscalité", "Rentabilité", "Exploitation",
             "Choisir une conciergerie", "Guides villes"]

INTRO_CAT = {
    "Réglementation": "Déclaration, plafond de nuitées, changement d'usage, copropriété : ce que "
                      "vous avez le droit de faire, commune par commune.",
    "Fiscalité": "Micro-BIC, régime réel, amortissement : les arbitrages qui changent votre "
                 "revenu net.",
    "Rentabilité": "Calculer, comparer, décider — avec des méthodes plutôt que des promesses.",
    "Exploitation": "Photos, équipements, prix, avis, incidents : le travail quotidien qui fait "
                    "la différence entre deux logements identiques.",
    "Choisir une conciergerie": "Coûts, contrats, pièges et vrai calcul de la délégation.",
    "Guides villes": "Le marché local vu de près, ville par ville.",
}


def corriger_dates() -> int:
    """Repositionne les articles datés dans le futur sur des dates passées."""
    n = 0
    for slug, (vieux, neuf, iso_v, iso_n) in DATES_A_CORRIGER.items():
        p = C.OUT / f"{slug}.html"
        if not p.exists():
            continue
        s = p.read_text(encoding="utf-8")
        avant = s
        s = s.replace(vieux, neuf).replace(iso_v, iso_n)
        if s != avant:
            p.write_text(s, encoding="utf-8")
            n += 1
    return n


def hub(tous: list) -> str:
    path = "/blog"
    url = C.SITE + path
    titre = "Le blog des propriétaires — location courte durée, fiscalité et gestion"
    desc = ("Guides pour propriétaires : réglementation des meublés de tourisme, fiscalité LMNP, "
            "calcul de rentabilité, tarification, avis voyageurs et choix d'une conciergerie. "
            "Des méthodes, pas des promesses.")
    trail = [("Accueil", "/"), ("Blog", path)]

    par_cat: dict = {}
    for a in tous:
        par_cat.setdefault(a["cat"], []).append(a)

    sections = []
    sommaire = "".join(
        f'<a href="#{C.slugify(c)}">{C.esc(c)}</a>'
        for c in ORDRE_CAT if c in par_cat)
    for cat in ORDRE_CAT:
        arts = sorted(par_cat.get(cat, []), key=lambda x: x["date"], reverse=True)
        if not arts:
            continue
        cartes = "".join(
            '<div class="pcard"><div class="body">'
            f'<span class="cat">{C.esc(cat)}</span>'
            f'<h3><a href="/{a["slug"]}">{C.esc(a["titre_court"])}</a></h3>'
            f'<p>{C.esc(a["resume"])}</p>'
            f'<a class="more" href="/{a["slug"]}">Lire l\'article →</a>'
            "</div></div>" for a in arts)
        sections.append(
            f'<section class="wrap" id="{C.slugify(cat)}"><h2>{C.esc(cat)}</h2>'
            f'<p class="lead">{C.esc(INTRO_CAT.get(cat, ""))}</p>'
            f'<div class="cards" style="margin-top:24px">{cartes}</div></section>')

    ld_blog = {
        "@context": "https://schema.org", "@type": "Blog",
        "name": "Le blog des propriétaires — Label Maison Conciergerie",
        "url": url, "inLanguage": "fr-FR",
        "publisher": {"@type": "Organization", "name": "Label Maison Conciergerie",
                      "logo": {"@type": "ImageObject", "url": C.LOGO}},
        "blogPost": [{"@type": "BlogPosting", "headline": a["titre_court"],
                      "url": f"{C.SITE}/{a['slug']}", "datePublished": a["date"]}
                     for a in sorted(tous, key=lambda x: x["date"], reverse=True)],
    }
    p = C.photo(2)
    parts = [
        C.head(titre, desc, path, [ld_blog, C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{p[0]}"),
        C.header(ART.NAV),
        C.crumb(trail),
        C.hero("📚 Le blog des propriétaires",
               "Louer mieux, <span class=\"font-serif-italic\">sans y passer ses soirées</span>",
               "Réglementation, fiscalité, rentabilité, exploitation : ce que nous appliquons "
               "réellement sur les logements que nous gérons, expliqué sans jargon et sans "
               "chiffres inventés.",
               p[0], "Logement géré par Label Maison Conciergerie",
               [f"<b>{len(tous)}</b> articles", "Sources <b>citées</b>",
                "Aucun <b>rendement promis</b>", "Mise à jour <b>régulière</b>"],
               cta1="Estimer mes revenus"),
        f'<section class="wrap"><div class="zones">{sommaire}</div></section>',
        *sections,
        C.formulaire("Une question sur votre logement ?",
                     "Nos articles donnent la méthode. Pour l'appliquer à votre bien, décrivez-le "
                     "nous : l'estimation est gratuite et sans engagement.",
                     "", "Estimation de revenus", titre),
        C.footer(ART.FOOTER,
                 "Le blog des propriétaires — réglementation, rentabilité et "
                 "<span class=\"font-serif-italic\">gestion locative</span>.",
                 "Paris · Île-de-France · France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write("blog", parts)
    return path


def main() -> list:
    urls = []
    tous = []
    for a in ARTICLES:
        urls.append(ART.page(a))
        tous.append({"slug": a["slug"], "cat": a["cat"], "date": a["date"],
                     "titre_court": a["h1"], "resume": a["desc"]})
    for slug, cat, titre, resume, date in EXISTANTS:
        tous.append({"slug": slug, "cat": cat, "date": date,
                     "titre_court": titre, "resume": resume})
    n = corriger_dates()
    hub(tous)
    print(f"Blog : {len(urls)} nouveaux articles, {len(tous)} au sommaire, "
          f"{n} dates futures corrigées")
    return urls


if __name__ == "__main__":
    main()
