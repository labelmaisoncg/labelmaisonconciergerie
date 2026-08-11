# -*- coding: utf-8 -*-
"""Gabarit « page ville » paramétrable, partagé par les silos géographiques.

Les silos Côte d'Azur, banlieue parisienne et Essonne partagent la même
structure de page mais PAS le même texte : chaque silo fournit ses propres
blocs (services, arguments, réglementation, FAQ complémentaire) via un objet
`Silo`. C'est ce qui permet d'avoir 100+ pages sans pages jumelles.

Champs d'une ville (tuple) :
    nom, slug, dept, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue
"""
from __future__ import annotations

from dataclasses import dataclass, field

import seo_common as C


@dataclass
class Silo:
    nom: str                      # « Côte d'Azur », « banlieue parisienne »…
    hub: str                      # chemin du hub, ex. /conciergerie-cote-d-azur
    region: str                   # région administrative principale
    nav: list                     # nav du header
    services: list                # 6 cartes (titre, texte)
    why: list                     # 4 cartes (titre, texte)
    slug_prefix: str = "conciergerie-airbnb-"
    intro: object = None          # callable(v) -> [paragraphes]
    regl: object = None           # callable(v) -> str
    extra_section: object = None  # callable(v) -> (titre, [paragraphes]) | None
    faq_extra: object = None      # callable(v) -> [(q, r)]
    footer_extra: list = field(default_factory=list)
    voisins: object = None        # callable(v, toutes) -> [villes]
    titre_tpl: str = "Conciergerie Airbnb à {nom} ({dept}) — gestion locative clé en main"
    h1_tpl: str = "Conciergerie Airbnb à <span class=\"font-serif-italic\">{nom}</span>"
    badge_tpl: str = "📍 {nom} · {dept}"


def voisins_defaut(v, toutes) -> list:
    """Villes liées : les plus proches dans l'ordre de la liste (littoral, ligne…)."""
    idx = [x[1] for x in toutes].index(v[1])
    out = []
    for d in (-2, -1, 1, 2, 3):
        j = (idx + d) % len(toutes)
        if toutes[j][1] != v[1] and toutes[j] not in out:
            out.append(toutes[j])
    return out[:5]


def page(silo: Silo, v, i: int, toutes: list) -> str:
    nom, slug_v, dept, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue = v
    slug = silo.slug_prefix + slug_v
    path = "/" + slug
    url = C.SITE + path
    titre = silo.titre_tpl.format(nom=nom, dept=dept, cp=cp)
    desc = (f"Conciergerie Airbnb à {nom} ({cp}) : mise en ligne, tarification, accueil des voyageurs, "
            f"ménage et maintenance. Gestion locative courte et moyenne durée clé en main pour les "
            f"propriétaires de {nom}.")
    q_txt = ", ".join(quartiers[:-1]) + " et " + quartiers[-1]
    l_txt = ", ".join(lieux[:-1]) + " et " + lieux[-1]
    regl = silo.regl(v) if silo.regl else ""
    voisines = (silo.voisins or voisins_defaut)(v, toutes)

    faq_items = [
        (f"Combien coûte votre conciergerie à {nom} ?",
         "Une commission sur les revenus réellement encaissés, sans abonnement ni frais d'entrée. "
         "Le taux dépend du niveau de service et du rythme de rotation ; il figure noir sur blanc "
         "dans la proposition que nous vous envoyons après l'étude de votre bien."),
        (f"Quels secteurs couvrez-vous autour de {nom} ?",
         f"{nom} et ses environs immédiats, dont {q_txt}. Nos équipes de ménage et nos artisans "
         f"partenaires interviennent sur l'ensemble du secteur."),
        (f"Quelle rentabilité viser à {nom} ?",
         f"Tout dépend de l'adresse, de la surface, de l'équipement et de la période : {saison} "
         f"Nous ne donnons jamais de rendement au hasard — l'estimation est établie sur des biens "
         f"comparables réellement loués autour du vôtre."),
    ]
    if regl:
        faq_items.append(("Quelles démarches dois-je faire en mairie ?", C.strip_tags(regl)))
    faq_items += (silo.faq_extra(v) if silo.faq_extra else [])
    faq_items += [
        ("Gérez-vous aussi la moyenne durée ?",
         "Oui. Le bail mobilité (1 à 10 mois) s'adresse aux étudiants, stagiaires et salariés en "
         "mission : moins de rotations, aucun plafond de nuitées, et un revenu supérieur à la "
         "location nue. C'est souvent la bonne formule hors haute saison."),
        ("Puis-je bloquer des dates pour moi ?",
         "Autant que vous le souhaitez. Vous gardez la main sur le calendrier ; nous ne gérons que "
         "les périodes que vous ouvrez à la location."),
    ]

    p1 = C.photo(i + 3)
    trail = [("Accueil", "/"), (silo.nom, silo.hub), (nom, path)]
    intro = silo.intro(v) if silo.intro else [
        f"Gérer soi-même une location courte durée à {nom} prend un temps considérable : messages, "
        f"prix, ménages entre un départ et une arrivée, imprévus techniques. "
        f"<strong>Label Maison Conciergerie</strong> prend tout en charge sur {q_txt}.",
        f"Autour de {l_txt}, la demande a sa propre logique. {demande} {saison}",
    ]
    sections = [(f"Le marché de la location courte durée à {nom}", [
        f"Le parc locatif de {nom} — {bien.lower()} — ne se valorise pas de la même manière d'un "
        f"quartier à l'autre. Nous travaillons toujours dans le même ordre : rendre le bien lisible "
        f"en photo, corriger les équipements qui font perdre des réservations, puis positionner le "
        f"prix. Une annonce mal présentée dont on baisse le tarif ne se remplit pas : elle rapporte "
        f"simplement moins.",
        f"<strong>Saisonnalité :</strong> {saison} C'est là que se joue l'écart entre une gestion "
        f"amateur et une gestion professionnelle : anticiper les pics des semaines à l'avance et "
        f"remplir les creux avec des séjours plus longs plutôt que de brader la nuitée.",
    ])]
    if silo.extra_section:
        ex = silo.extra_section(v)
        if ex:
            sections.append(ex)
    if regl:
        sections.append((f"Réglementation et démarches à {nom}", [
            regl,
            "<strong>Notre principe :</strong> nous ne mettons en ligne que des biens conformes. "
            "Un revenu locatif durable ne se bâtit pas sur une zone grise. Quand la courte durée "
            "n'est pas possible, nous basculons sur le bail mobilité, parfaitement légal.",
            "<em>Le cadre fiscal des meublés de tourisme a évolué avec la loi du 19 novembre 2024. "
            "Nous signalons les points à vérifier ; votre expert-comptable tranche.</em>",
        ]))

    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — {nom}", url, desc, nom, silo.region, cp, geo=geo,
                              area=[nom, silo.nom]),
                C.ld_service(f"Conciergerie Airbnb et gestion locative courte durée à {nom}",
                             nom, url, desc,
                             ["Mise en ligne et diffusion multi-plateformes", "Tarification dynamique",
                              "Accueil des voyageurs", "Ménage et blanchisserie",
                              "Maintenance", "Reporting mensuel"]),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{p1[0]}"),
        C.header(silo.nav),
        C.crumb(trail),
        C.hero(silo.badge_tpl.format(nom=nom, dept=dept, cp=cp),
               silo.h1_tpl.format(nom=nom),
               f"Votre bien à {nom} peut rapporter sans vous prendre une heure. Annonce, prix, "
               f"voyageurs, ménage, imprévus : nous gérons. {hook}",
               p1[0], f"Logement géré par notre conciergerie à {nom}",
               ["Gestion <b>clé en main</b>", "Commission au <b>résultat</b>",
                "Équipe <b>locale</b>", "Courte & <b>moyenne durée</b>"]),
        C.texte(intro, pad=True),
        C.cartes(f"Notre gestion locative à {nom}, de A à Z",
                 "Vous confiez les clés. Vous suivez vos revenus. C'est tout.", silo.services),
    ]
    for t, paras in sections:
        parts.append(C.texte(paras, titre=t))
    parts += [
        C.galerie("gal" + slug_v.replace("-", ""), [C.photo(i + k + 3) for k in range(6)]),
        C.etapes(f"Comment nous démarrons à {nom}", [
            ("1. Étude du bien",
             "Visite sur place ou à distance, analyse des logements réellement loués autour de vous, "
             "estimation de revenus argumentée."),
            ("2. Préparation et shooting",
             "Ajustements d'aménagement, équipements manquants, photos professionnelles : la couverture "
             "de l'annonce fait la moitié du travail."),
            ("3. Lancement",
             "Annonce rédigée pour la recherche, diffusion multi-plateformes, prix et durées minimales "
             "paramétrés."),
            ("4. Exploitation quotidienne",
             "Messages, arrivées, ménages, incidents, avis, reporting mensuel : vous n'avez plus rien "
             "à faire."),
        ]),
        C.cartes(f"Pourquoi les propriétaires de {nom} nous confient leur bien", "",
                 silo.why, cols="g2"),
        C.zones(f"Nos autres secteurs autour de {nom}",
                "Nous couvrons tout le secteur avec les mêmes équipes.",
                [(f"Conciergerie {x[0]}", f"/{silo.slug_prefix}{x[1]}") for x in voisines]
                + [(f"Tout le secteur : {silo.nom}", silo.hub),
                   ("Conciergerie Airbnb en France", "/conciergerie-airbnb-france")],
                extra=("Propriétaire ? Découvrez <a href=\"/proprietaires\"><strong>notre offre de "
                       "gestion</strong></a>, l'<a href=\"/estimation-rentabilite-airbnb\">estimation "
                       "gratuite de vos revenus</a> et le "
                       "<a href=\"/cerclelabelmaison\">Cercle Label Maison</a>.")),
        C.faq(f"Questions fréquentes — conciergerie Airbnb à {nom}", faq_items),
        C.formulaire(f"Estimation gratuite pour votre bien à {nom}",
                     "Surface, quartier, disponibilité : trois informations suffisent pour recevoir "
                     "une estimation de revenus et notre proposition de gestion.",
                     nom, "Conciergerie Airbnb", titre),
        C.footer([(silo.nom, [(x[0], f"/{silo.slug_prefix}{x[1]}") for x in voisines]
                   + [("Tout le secteur", silo.hub)])] + silo.footer_extra,
                 f"Conciergerie Airbnb à {nom} — gestion locative courte et moyenne durée, "
                 f"<span class=\"font-serif-italic\">clé en main</span>.",
                 f"{nom} ({cp}) · {silo.nom}"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts)
    return path


def hub(silo: Silo, toutes: list, spec: dict) -> str:
    """Hub de silo : présentation + annuaire complet des villes."""
    path = silo.hub
    url = C.SITE + path
    trail = [("Accueil", "/"), (silo.nom, path)]
    faq_items = spec["faq"]
    p = C.photo(spec.get("photo_index", 1))
    parts = [
        C.head(spec["title"], spec["desc"], path,
               [C.ld_business(f" — {silo.nom}", url, spec["desc"], spec["ville_ld"], silo.region,
                              spec["cp_ld"], geo=spec["geo_ld"],
                              area=[v[0] for v in toutes] + [silo.nom]),
                C.ld_service(f"Conciergerie Airbnb et gestion locative courte durée — {silo.nom}",
                             silo.nom, url, spec["desc"]),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail),
                {"@context": "https://schema.org", "@type": "ItemList",
                 "name": f"Conciergerie Airbnb — {silo.nom}",
                 "itemListElement": [
                     {"@type": "ListItem", "position": i + 1,
                      "name": f"Conciergerie Airbnb {v[0]}",
                      "url": f"{C.SITE}/{silo.slug_prefix}{v[1]}"} for i, v in enumerate(toutes)]}],
               image=f"{C.SITE}/images/{p[0]}"),
        C.header(silo.nav),
        C.crumb(trail),
        C.hero(spec["badge"], spec["h1"], spec["sub"], p[0], spec["alt"], spec["puces"]),
        C.texte(spec["intro"], pad=True),
        C.cartes("Ce que nous prenons en charge",
                 "Le même standard partout, exécuté par des équipes du secteur.", silo.services),
        C.zones("Choisissez votre commune",
                "Une page par commune : quartiers couverts, saisonnalité réelle, démarches locales.",
                [(f"{v[0]} ({v[3]})", f"/{silo.slug_prefix}{v[1]}") for v in toutes],
                extra=spec["zones_extra"]),
    ]
    for t, paras in spec.get("sections", []):
        parts.append(C.texte(paras, titre=t))
    parts += [
        C.galerie("galhub" + silo.hub.strip("/").replace("-", ""),
                  [C.photo(k + 2) for k in range(8)]),
        C.etapes("Notre méthode", [
            ("1. Étude locale", "Comparables réellement loués, réglementation communale, potentiel réel."),
            ("2. Préparation", "Aménagement, équipements, photos professionnelles, annonce optimisée."),
            ("3. Lancement", "Diffusion multi-plateformes, calendriers synchronisés, prix pilotés."),
            ("4. Exploitation", "Voyageurs, ménage, maintenance, avis, reporting mensuel."),
        ]),
        C.cartes("Pourquoi Label Maison", "", silo.why, cols="g2"),
        C.faq(spec["faq_title"], faq_items),
        C.formulaire(spec["form"][0], spec["form"][1], spec["form"][2], "Conciergerie Airbnb",
                     spec["title"]),
        C.footer([(silo.nom, [(v[0], f"/{silo.slug_prefix}{v[1]}") for v in toutes[:8]])]
                 + silo.footer_extra, spec["tagline"], spec["lieu"]),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(path.lstrip("/"), parts)
    return path
