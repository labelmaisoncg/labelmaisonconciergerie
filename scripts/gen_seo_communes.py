# -*- coding: utf-8 -*-
"""Maillage national : une page « conciergerie » par commune, département et région.

Objectif demandé : qu'une recherche « conciergerie <ville> » trouve Label Maison
partout en France. Toutes les communes de plus de 10 000 habitants sont couvertes,
plus un hub par département et par région.

Chaque page s'appuie sur des données officielles réelles (population INSEE, code
postal, département, région, communes limitrophes calculées par distance,
éloignement de Paris et de la principale ville du département). Le texte varie
selon le profil du territoire — Île-de-France, métropole, département
méditerranéen, littoral atlantique, montagne, ville moyenne — pour que deux pages
voisines ne racontent pas la même chose.

Les villes de nos silos travaillés à la main (Paris, Côte d'Azur, banlieue,
Essonne, grandes villes) ne sont pas régénérées : elles reçoivent une redirection
301 depuis /conciergerie-<ville> vers la page existante (voir build_seo_index.py).
"""
from __future__ import annotations

import json
import pathlib

import data_communes as D
import donnees_locales as L
import variantes_communes as VC
import seo_common as C

NAV = [("France", "/conciergerie-airbnb-france"), ("Paris", "/conciergerie-airbnb-paris"),
       ("Propriétaires", "/proprietaires"), ("Estimation", "/estimation-rentabilite-airbnb")]

MED = {"06", "83", "13", "34", "30", "11", "66", "2A", "2B"}
ATL = {"17", "33", "40", "64", "44", "56", "29", "22", "35", "50", "14", "76", "62", "85", "80"}
MONT = {"73", "74", "38", "05", "04", "65", "09", "15", "63", "88", "39", "25", "68", "48"}
IDF = {"75", "77", "78", "91", "92", "93", "94", "95"}
DOM = {"971", "972", "973", "974", "976"}


def profil(c) -> str:
    if c.dept in IDF:
        return "idf"
    if c.dept in DOM:
        return "dom"
    if c.pop >= 150_000:
        return "metropole"
    if c.dept in MED:
        return "med"
    if c.dept in ATL:
        return "atl"
    if c.dept in MONT:
        return "mont"
    return "ville"


# --------------------------------------------------------------------------- #
#  Blocs de texte : trois variantes par profil, choisies via le code INSEE
# --------------------------------------------------------------------------- #
SAISON = {
    "idf": [
        "En Île-de-France, la demande est d'abord professionnelle, universitaire et hospitalière : "
        "elle ne s'arrête ni le week-end ni l'hiver. Les pics viennent des salons, des grands "
        "événements et des vacances scolaires européennes.",
        "La force du marché francilien, c'est sa régularité : une demande de fond toute l'année, "
        "renforcée par les salons professionnels, les concerts et les rencontres sportives qui "
        "saturent l'hébergement sur quelques dizaines de nuits.",
        "En région parisienne, un logement bien tenu ne connaît pas de véritable saison creuse. "
        "Ce sont les événements — congrès, matchs, vacances scolaires — qui font l'essentiel de la marge.",
    ],
    "metropole": [
        "Dans une métropole de cette taille, deux demandes cohabitent : les déplacements "
        "professionnels du lundi au jeudi, et le tourisme urbain du week-end. Bien pilotées, elles "
        "se complètent et lissent le taux d'occupation sur l'année.",
        "Le marché des grandes villes repose sur un socle solide — affaires, congrès, universités — "
        "que le tourisme de week-end vient compléter. C'est le type de marché où la régularité "
        "compte davantage que les pics.",
        "Ici, la demande existe toute l'année : missions professionnelles, salons, rentrée "
        "universitaire, week-ends prolongés. Le vrai sujet n'est pas de remplir, mais de remplir "
        "au bon prix.",
    ],
    "med": [
        "Dans un département méditerranéen, la saison estivale concentre l'essentiel des revenus, "
        "mais les épaules — mai, juin, septembre, octobre — sont de plus en plus demandées et "
        "restent largement sous-exploitées par les propriétaires.",
        "Le rythme du Sud est marqué : forte affluence de juin à septembre, activité plus calme en "
        "hiver. La différence se joue sur la capacité à remplir le printemps et l'automne plutôt "
        "qu'à brader la nuitée en août.",
        "Sur ce territoire méditerranéen, l'été fait le chiffre et l'arrière-saison fait la marge. "
        "Anticiper les événements locaux et ajuster les durées minimales de séjour change le "
        "résultat annuel.",
    ],
    "atl": [
        "Sur la façade atlantique et la Manche, la saison est plus étalée qu'on ne le croit : "
        "ponts de printemps, vacances scolaires, arrière-saison douce. Les séjours y sont souvent "
        "plus longs, ce qui réduit le nombre de rotations.",
        "Le marché de l'Ouest fonctionne par vagues : week-ends prolongés dès avril, plein été, "
        "puis une arrière-saison fidèle. Un bien bien équipé y travaille sur six à sept mois.",
        "Dans ce département, la demande de vacances se combine à une demande professionnelle de "
        "fond. C'est cette combinaison qui permet d'éviter les calendriers vides hors saison.",
    ],
    "mont": [
        "Dans un département de montagne, deux saisons se répondent : l'hiver et ses sports de "
        "neige, l'été et sa randonnée. Les intersaisons se remplissent avec des séjours plus longs "
        "plutôt qu'avec des promotions.",
        "Ici, la double saison est un atout rare : le calendrier travaille de décembre à avril, "
        "puis de juin à septembre. Encore faut-il ajuster les tarifs vacances scolaires par "
        "vacances scolaires.",
        "Le marché de montagne récompense l'anticipation : les semaines de vacances scolaires se "
        "réservent très tôt et représentent une part décisive de l'année.",
    ],
    "ville": [
        "Dans une ville de cette taille, la demande est d'abord utile : déplacements "
        "professionnels, formations, séjours familiaux, rendez-vous médicaux. Elle est moins "
        "spectaculaire que le tourisme, mais beaucoup plus régulière.",
        "Le marché local repose sur des besoins concrets — missions, mutations, visites familiales, "
        "événements — répartis sur toute l'année. C'est un marché de fond, peu concurrencé par "
        "l'hôtellerie.",
        "Ici, la concurrence en gestion professionnelle est faible : un logement irréprochable et "
        "réactif se détache immédiatement des annonces gérées à temps perdu.",
    ],
    "dom": [
        "Sur ce territoire, la demande combine tourisme de séjour et déplacements professionnels "
        "ou familiaux depuis la métropole. Les séjours sont longs, ce qui limite les rotations et "
        "les frais de gestion.",
        "Le marché local vit à la fois du tourisme et des mobilités professionnelles : deux "
        "clientèles aux calendriers différents, qui permettent de remplir une grande partie de "
        "l'année.",
        "Ici, les séjours dépassent souvent la semaine : la qualité de l'équipement et la "
        "réactivité comptent davantage que le nombre d'annonces concurrentes.",
    ],
}

SERVICES_SETS = [
    [("Mise en ligne et diffusion",
      "Photos professionnelles, annonce rédigée pour la recherche, diffusion sur Airbnb, Booking "
      "et Abritel avec calendriers synchronisés."),
     ("Tarification pilotée",
      "Les prix suivent la demande réelle de votre secteur — événements, vacances scolaires, "
      "concurrence directe — au lieu d'un tarif fixe toute l'année."),
     ("Accueil des voyageurs",
      "Remise des clés en personne ou boîte sécurisée, arrivées tardives acceptées, livret "
      "d'accueil et réponse aux messages en continu."),
     ("Ménage et linge hôtelier",
      "Rotation professionnelle entre chaque séjour, linge fourni et blanchi, produits d'accueil, "
      "contrôle photo après chaque départ."),
     ("Maintenance",
      "Un réseau d'artisans mobilisable rapidement : une panne traitée le jour même, c'est un avis "
      "négatif évité."),
     ("Reporting mensuel",
      "Revenus, occupation, dépenses, avis : un récapitulatif clair, transmissible tel quel à "
      "votre comptable.")],
    [("Annonce et photos",
      "La photo de couverture décide de la moitié des réservations. Nous préparons le logement, "
      "nous le photographions, puis nous rédigeons l'annonce."),
     ("Prix ajustés en continu",
      "Nous suivons les événements locaux et la concurrence de votre quartier pour monter les "
      "tarifs quand la demande est là et rester attractifs le reste du temps."),
     ("Check-in 7j/7",
      "Vos voyageurs sont accueillis à toute heure, avec vérification d'identité : moins "
      "d'incidents, de meilleurs avis, un bien mieux respecté."),
     ("Propreté hôtelière",
      "Équipes formées, linge de maison fourni, consommables réassortis et vérification "
      "systématique de l'état du logement entre deux séjours."),
     ("Interventions techniques",
      "Plomberie, serrurerie, électroménager, chauffage : nos artisans partenaires interviennent "
      "vite, y compris le week-end."),
     ("Suivi des revenus",
      "Un point mensuel lisible sur ce que votre bien a rapporté, ce qu'il a coûté, et ce qui peut "
      "être amélioré.")],
    [("Commercialisation du bien",
      "Préparation, shooting, rédaction et diffusion multi-plateformes : votre logement est "
      "présenté comme un produit, pas comme une annonce de particulier."),
     ("Stratégie de prix",
      "Durées minimales de séjour, tarifs dégressifs, ouverture du calendrier : chaque paramètre "
      "est réglé selon la demande de votre secteur."),
     ("Relation voyageurs",
      "Réponses rapides avant réservation, accueil sur place, assistance pendant le séjour : "
      "c'est ce qui fait les avis cinq étoiles."),
     ("Ménage, linge, consommables",
      "Tout est pris en charge, y compris le réassort. Vous n'avez ni planning à tenir, ni "
      "prestataire à chercher."),
     ("Petits travaux et entretien",
      "Nous traitons l'usure avant qu'elle ne se voie sur les photos et dans les commentaires."),
     ("Transparence",
      "Aucun frais caché : une commission sur les revenus encaissés et un récapitulatif mensuel "
      "détaillé.")],
]

CONCIERGERIE_PRIVEE = [
    ("Gestion de résidence secondaire",
     "Visites régulières, relevé du courrier, aération, contrôle après intempérie et préparation "
     "du logement avant votre arrivée."),
    ("Intendance et prestataires",
     "Ménage, jardinier, artisan, livraison : nous coordonnons les intervenants et nous vérifions "
     "que le travail est fait."),
    ("Remise de clés et accueil",
     "Pour vos invités, vos locataires ou vos artisans : quelqu'un sur place, à l'heure, avec un "
     "compte rendu."),
    ("Préparation avant séjour",
     "Ménage, linge, courses, chauffage ou climatisation en route : vous arrivez dans une maison "
     "prête, pas dans une maison fermée."),
    ("Suivi administratif du bien",
     "Déclaration en mairie, taxe de séjour, relation avec la copropriété : nous prenons en charge "
     "les démarches liées à la location."),
    ("Demandes sur mesure",
     "Chauffeur, réservations, personnel de maison, organisation d'un séjour : notre métier de "
     "conciergerie privée s'applique aussi ici."),
]

WHY = [
    ("Un interlocuteur unique",
     "Une seule personne suit votre bien, connaît son histoire et vous répond. Pas de plateforme "
     "anonyme ni de numéro de dossier."),
    ("Rémunérés au résultat",
     "Une commission sur les revenus encaissés, sans abonnement ni frais d'entrée. Un calendrier "
     "vide ne nous rapporte rien non plus."),
    ("Courte durée, moyenne durée, ou les deux",
     "Selon la réglementation locale et la saison, nous arbitrons entre nuitée touristique et bail "
     "mobilité pour maximiser le revenu annuel."),
    ("Votre bien protégé",
     "Sélection des voyageurs, état des lieux photo à chaque rotation, suivi de l'usure : nous "
     "traitons votre logement comme s'il était le nôtre."),
]


PRESENCE = [
    lambda c, v_txt: (
        f"<strong>Label Maison Conciergerie</strong> est une conciergerie basée en Essonne, qui gère "
        f"des logements en Île-de-France. À {c.nom}, nous ne faisons pas semblant d'avoir une équipe "
        f"sur place : nous travaillons avec des <strong>partenaires locaux</strong> du réseau Label "
        f"Maison lorsqu'ils existent, et nous accompagnons les propriétaires à distance pour tout ce "
        f"qui ne demande pas d'être là — estimation de revenus fondée sur les locations réelles du "
        f"secteur, vérification des démarches, préparation de l'annonce, choix et suivi d'un "
        f"gestionnaire. Si personne ne peut tenir votre bien correctement à {c.nom}, nous vous le disons."),
    lambda c, v_txt: (
        f"Soyons clairs : notre équipe est en Île-de-France, pas à {c.nom}. Ce que nous faisons pour "
        f"un propriétaire de {c.nom}, c'est d'abord <strong>lui dire la vérité sur son bien</strong> : "
        f"ce qu'il peut rapporter au vu des locations réelles du secteur, ce que la commune exige, ce "
        f"qu'il faut corriger avant de louer. Ensuite, nous le mettons en relation avec un "
        f"<strong>partenaire local du réseau Label Maison</strong> quand il y en a un — ménage, "
        f"accueil, maintenance se font sur place ou ne se font pas — et nous suivons le dossier avec lui. "
        f"<strong>Label Maison Conciergerie</strong> ne vend pas une présence qu'elle n'a pas."),
    lambda c, v_txt: (
        f"<strong>Label Maison Conciergerie</strong> gère des logements en Île-de-France depuis "
        f"l'Essonne. Pour {c.nom} et ses environs ({v_txt}), notre rôle est celui d'un "
        f"<strong>conseil et d'un réseau</strong> : estimation gratuite à partir des annonces "
        f"réellement louées autour de chez vous, lecture des règles de la commune, préparation du "
        f"logement et de l'annonce, puis gestion confiée à un partenaire local sélectionné lorsqu'il "
        f"existe. Nous préférons vous orienter vers quelqu'un de sérieux sur place que de promettre "
        f"une équipe que nous n'avons pas à {c.nom}."),
]
HERO_RESEAU = [
    lambda c: (f"Ce que votre logement peut rapporter à {c.nom}, les règles locales à respecter, et la "
               f"bonne façon de le faire gérer : une estimation gratuite, des données officielles, et "
               f"un partenaire local du réseau Label Maison quand il existe."),
    lambda c: (f"Estimation gratuite de vos revenus à {c.nom}, règles de la commune vérifiées, et un "
               f"relais sur place par le réseau Label Maison quand il existe. Sans promesse que nous "
               f"ne pouvons pas tenir."),
    lambda c: (f"Avant de louer à {c.nom} : combien, sous quelles règles, avec qui. Nous répondons aux "
               f"trois questions avec des données officielles et notre réseau de partenaires locaux."),
]
FAQ_RESEAU = [
    lambda c, v_txt, dept_url: (
        f"Nous ne sommes pas installés à {c.nom} : notre équipe est en Île-de-France. Nous y "
        f"intervenons par un partenaire local du réseau Label Maison quand il existe ; sinon, nous "
        f"vous accompagnons à distance (estimation, démarches, préparation de l'annonce, choix d'un "
        f"gestionnaire) et nous vous le disons clairement. Même principe pour {v_txt} et le reste du "
        f"département : voir <a href=\"{dept_url}\">conciergerie en {c.dept_nom}</a>."),
    lambda c, v_txt, dept_url: (
        f"Pas avec notre propre équipe, qui travaille en Île-de-France. À {c.nom} comme à {v_txt}, "
        f"la gestion sur place passe par un partenaire du réseau Label Maison, et nous gardons le "
        f"conseil et le suivi. S'il n'y a pas encore de partenaire, nous vous aidons à distance et "
        f"nous vous orientons. La page <a href=\"{dept_url}\">conciergerie en {c.dept_nom}</a> "
        f"résume la situation du département."),
    lambda c, v_txt, dept_url: (
        f"Oui pour le conseil, l'estimation et les démarches, qui se font à distance ; sur place, "
        f"c'est un partenaire local du réseau Label Maison qui intervient à {c.nom} et dans les "
        f"communes voisines ({v_txt}) lorsqu'il existe. Nous ne cachons pas que notre équipe est en "
        f"Île-de-France : voir aussi <a href=\"{dept_url}\">conciergerie en {c.dept_nom}</a>."),
]


def var(c, n: int, sel: int = 0) -> int:
    """Variante stable par commune (dérivée du code INSEE). `sel` décorrèle les blocs :
    deux communes qui partagent la variante d'un bloc n'ont pas forcément celle d'un autre."""
    return sum(ord(x) * (i + 3 + sel * 7) for i, x in enumerate(c.insee)) % n


def slug_dept(nom: str, pris: set) -> str:
    s = "conciergerie-" + C.slugify(nom)
    return s if s not in pris else "conciergerie-departement-" + C.slugify(nom)


def slug_region(nom: str, pris: set) -> str:
    s = "conciergerie-" + C.slugify(nom)
    return s if s not in pris else "conciergerie-region-" + C.slugify(nom)


def url_commune(c, couvertes: dict) -> str:
    """URL canonique d'une commune : page curée si elle existe, sinon page générée."""
    return couvertes.get(c.slug) or f"/conciergerie-{c.slug}"


def page_commune(c, dept_url: str, region_url: str, couvertes: dict) -> str:
    slug = "conciergerie-" + c.slug
    path = "/" + slug
    url = C.SITE + path
    p = profil(c)
    v = var(c, 3)
    titre = f"Conciergerie à {c.nom} ({c.cp}) — gestion locative et services | Label Maison"
    desc = (f"Conciergerie à {c.nom} ({c.dept_nom}) : gestion locative courte et moyenne durée, "
            f"accueil des voyageurs, ménage hôtelier, entretien et gestion de résidence secondaire. "
            f"Estimation gratuite pour les propriétaires.")
    voisines = c.voisines
    v_txt = ", ".join(x.nom for x in voisines[:4]) if voisines else c.dept_nom
    photo = C.photo(sum(ord(x) for x in c.insee))
    # Présence réelle : l'équipe est en Île-de-France ; ailleurs, on passe par un
    # partenaire local du réseau Label Maison, ou on accompagne à distance. On le dit.
    direct = L.presence_idf(c.dept)
    hab = f"{c.pop:,}".replace(",", "\u202f")  # espace fine insécable
    trail = [("Accueil", "/"), (c.region, region_url), (c.dept_nom, dept_url), (c.nom, path)]

    faq_items = VC.faq_generique(c.nom, var(c, 3, 4)) + [
        (f"Quelles démarches dois-je faire à {c.nom} ?",
         f"Selon la commune, la location de meublé de tourisme peut être soumise à une déclaration "
         f"en mairie avec numéro d'enregistrement à afficher sur l'annonce. La location d'une "
         f"résidence principale est plafonnée à 120 nuits par an, et la taxe de séjour est due. "
         f"Nous vérifions ce qui s'applique à {c.nom} avant toute mise en ligne."),
        (f"Intervenez-vous autour de {c.nom} ?",
         (f"Oui : nous couvrons {c.nom} et les communes voisines — {v_txt} — ainsi que l'ensemble "
          f"du département ({c.dept_nom}). Voir notre page "
          f"<a href=\"{dept_url}\">conciergerie en {c.dept_nom}</a>.") if direct else
         FAQ_RESEAU[var(c, 3, 5)](c, v_txt, dept_url)),
    ]
    faq_items[4:4] = L.faq(c.nom, c.insee)

    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — {c.nom}", url, desc, c.nom, c.region, c.cp,
                              geo=(round(c.lat, 4), round(c.lon, 4)),
                              area=[c.nom] + [x.nom for x in voisines[:4]]),
                C.ld_service(f"Conciergerie, gestion locative et entretien de biens à {c.nom}",
                             c.nom, url, desc,
                             ["Gestion locative courte durée", "Bail mobilité et moyenne durée",
                              "Accueil des voyageurs", "Ménage et linge hôtelier",
                              "Entretien et gardiennage", "Coordination d'artisans"]),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{photo[0]}", garder_cp=c.slug != C.slugify(c.nom)),
        C.header(NAV + [(c.dept_nom, dept_url)]),
        C.crumb(trail),
        C.hero(f"📍 {c.nom} · {c.cp} · {c.dept_nom}",
               f"Conciergerie à <span class=\"font-serif-italic\">{c.nom}</span>",
               (f"Location courte et moyenne durée, entretien de résidence secondaire, accueil et "
                f"intendance : nous prenons votre bien en charge à {c.nom} et vous rendons votre temps.")
               if direct else
               HERO_RESEAU[var(c, 3, 6)](c),
               photo[0], f"Logement géré par Label Maison Conciergerie à {c.nom}",
               ["Gestion <b>clé en main</b>", "Commission au <b>résultat</b>",
                "Ménage <b>hôtelier</b>", "Sans <b>engagement</b>"] if direct else
               ["Estimation <b>gratuite</b>", "Données <b>officielles</b>",
                "Réseau de <b>partenaires locaux</b>", "Sans <b>engagement</b>"]),
        C.texte([
            f"<strong>{c.nom}</strong> compte environ <strong>{hab}</strong> habitants "
            f"({c.dept_nom}, {c.region}), à quelque {c.km_paris} km de Paris. "
            f"Que votre logement soit un investissement locatif, une résidence secondaire ou un "
            f"bien hérité que vous ne savez pas quoi faire, il coûte de l'argent chaque mois tant "
            f"qu'il ne travaille pas — et il se dégrade quand personne ne le surveille.",
            (f"<strong>Label Maison Conciergerie</strong> prend en charge les deux situations à "
             f"{c.nom} : la <strong>gestion locative</strong> complète pour ceux qui veulent des "
             f"revenus, et la <strong>gestion de résidence</strong> pour ceux qui veulent seulement "
             f"retrouver leur maison prête et en bon état. Nous intervenons également sur les "
             f"communes voisines : {v_txt}.") if direct else
            PRESENCE[var(c, 3, 7)](c, v_txt),
        ], pad=True),
        C.cartes(f"Notre gestion locative à {c.nom}",
                 "Vous confiez les clés. Vous suivez vos revenus. C'est tout.",
                 SERVICES_SETS[var(c, 3, 8)]),
        C.texte([
            SAISON[p][v],
            f"À {c.nom}, nous commençons toujours par le même travail : rendre le bien lisible en "
            f"photo, corriger les équipements qui font perdre des réservations, puis positionner le "
            f"prix. Dans cet ordre. Baisser le tarif d'une annonce mal présentée ne remplit pas un "
            f"calendrier : cela réduit simplement la marge.",
        ], titre=f"Le marché de la location courte durée à {c.nom}"),
        L.bloc(c.nom, c.insee),
        C.galerie_ville(c.slug, c.nom,
                        f"Les secteurs sur lesquels nous positionnons les biens de {c.nom}, et ce "
                        f"qu'ils changent concrètement pour un calendrier de réservations."),
        C.cartes(f"Conciergerie privée et gestion de résidence à {c.nom}",
                 "Vous ne souhaitez pas louer ? Nous veillons quand même sur votre bien.",
                 VC.PRIVEE[var(c, 3, 1)]),
        C.texte(([] if L.pour(c.insee) else [
            f"La location meublée de tourisme est encadrée, et les règles varient d'une commune à "
            f"l'autre. À {c.nom}, une déclaration en mairie avec numéro d'enregistrement peut être "
            f"exigée ; la location d'une résidence principale reste plafonnée à 120 nuits par an, "
            f"et la taxe de séjour est due dans tous les cas."]) + [
            f"<strong>Quand la courte durée n'est pas possible</strong>, le bail mobilité prend le "
            f"relais : de 1 à 10 mois, sans dépôt de garantie, pour les étudiants, stagiaires et "
            f"salariés en mission. Aucun plafond de nuitées, moins de rotations, et un revenu "
            f"supérieur à celui d'une location nue classique.",
            "<em>Le cadre fiscal des meublés de tourisme a évolué avec la loi du 19 novembre 2024. "
            "Nous signalons les points à vérifier ; votre expert-comptable tranche.</em>",
        ], titre=(f"Bail mobilité et fiscalité à {c.nom}" if L.pour(c.insee)
                  else f"Réglementation et démarches à {c.nom}")),
        C.etapes(f"Comment nous démarrons à {c.nom}", VC.ETAPES[var(c, 3, 2)]),
        C.cartes(f"Pourquoi les propriétaires de {c.nom} nous choisissent", "",
                 VC.POURQUOI[var(c, 3, 3)], cols="g2"),
        C.zones(f"Notre conciergerie autour de {c.nom}",
                "Nos pages pour les communes voisines :",
                [(x.nom, url_commune(x, couvertes)) for x in voisines]
                + [(f"Tout le département : {c.dept_nom}", dept_url),
                   (c.region, region_url),
                   ("Conciergerie Airbnb en France", "/conciergerie-airbnb-france")],
                extra=("Propriétaire ? Demandez votre "
                       "<a href=\"/estimation-rentabilite-airbnb\"><strong>estimation gratuite de "
                       "revenus</strong></a>, découvrez "
                       "<a href=\"/proprietaires\">notre offre de gestion</a> ou le "
                       "<a href=\"/cerclelabelmaison\">Cercle Label Maison</a> si vous souhaitez "
                       "nous recommander un bien."
                       + ("" if direct else
                          f" Vous êtes conciergerie, femme ou homme de ménage, artisan à {c.nom} ? "
                          f"<a href=\"#contact-form\">Rejoignez le réseau Label Maison</a> : nous "
                          f"vous confions les propriétaires qui nous écrivent depuis votre secteur."))),
        C.faq(f"Questions fréquentes — conciergerie à {c.nom}", faq_items),
        C.formulaire(f"Estimation gratuite pour votre bien à {c.nom}",
                     "Surface, quartier, disponibilité : trois informations suffisent pour recevoir "
                     "une estimation de revenus et notre proposition de gestion.",
                     c.nom, "Conciergerie", titre),
        C.footer([(c.dept_nom, [(x.nom, url_commune(x, couvertes)) for x in voisines[:5]]
                   + [("Tout le département", dept_url)]),
                  ("Nos services", [("Conciergerie Airbnb en France", "/conciergerie-airbnb-france"),
                                    ("Gestion locative", "/gestion-locative-france"),
                                    ("Estimation gratuite", "/estimation-rentabilite-airbnb"),
                                    ("Conciergerie privée de luxe", "/conciergerie-privee-paris"),
                                    ("Le blog des propriétaires", "/blog")])],
                 f"Conciergerie à {c.nom} — gestion locative, entretien et "
                 f"<span class=\"font-serif-italic\">tranquillité</span>.",
                 f"{c.nom} ({c.cp}) · {c.dept_nom} · {c.region}"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts, auto=True)
    return path


def page_dept(code: str, nom: str, communes: list, slug: str, region_url: str,
              region: str) -> str:
    path = "/" + slug
    url = C.SITE + path
    top = sorted(communes, key=lambda x: -x.pop)
    dl = D.loc_dept(code, nom)          # « dans le Var », « en Gironde »…
    rl = D.loc_region(region)
    pop = sum(x.pop for x in communes)
    pop_txt = f"{pop:,}".replace(",", "\u202f")
    titre = f"Conciergerie {dl} ({code}) — gestion locative et services aux propriétaires"
    desc = (f"Conciergerie {dl} : gestion locative courte et moyenne durée, accueil des "
            f"voyageurs, ménage hôtelier et entretien de résidence secondaire dans "
            f"{len(communes)} communes du département.")
    trail = [("Accueil", "/"), (region, region_url), (nom, path)]
    faq_items = [
        (f"Dans quelles communes intervenez-vous {dl} ?",
         f"Les principales communes du département — {', '.join(x.nom for x in top[:6])} — ont "
         f"chacune leur page, avec les données officielles locales (taxe de séjour, hébergement, "
         f"règles). Notre équipe est en Île-de-France ; ailleurs, nous passons par un partenaire "
         f"local du réseau Label Maison quand il existe, et nous accompagnons à distance sinon."),
        ("Quel est votre modèle de rémunération ?",
         "Une commission sur les revenus encaissés en gestion locative, un forfait pour l'entretien "
         "et la surveillance d'une résidence secondaire. Sans abonnement ni frais d'entrée."),
        ("Gérez-vous la moyenne durée ?",
         "Oui. Le bail mobilité (1 à 10 mois) est souvent la meilleure formule hors haute saison, "
         "en particulier autour des pôles universitaires, hospitaliers et industriels."),
        ("Faites-vous une estimation avant de démarrer ?",
         "Systématiquement, et elle est gratuite : nous étudions des biens comparables réellement "
         "loués autour du vôtre et nous vous remettons une fourchette argumentée."),
        ("Et si ma commune n'apparaît pas ?",
         "Écrivez-nous : nous étudions votre bien de la même façon, et nous vous disons honnêtement "
         "si un partenaire peut le gérer sur place ou s'il vaut mieux un accompagnement à distance."),
    ]
    photo = C.photo(len(nom) + len(communes))
    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — {nom}", url, desc, top[0].nom, region, top[0].cp,
                              geo=(round(top[0].lat, 4), round(top[0].lon, 4)),
                              area=[x.nom for x in top[:12]] + [nom]),
                C.ld_service(f"Conciergerie et gestion locative {dl}", nom, url, desc),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail),
                {"@context": "https://schema.org", "@type": "ItemList",
                 "name": f"Conciergerie par commune — {nom}",
                 "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": x.nom,
                                      "url": f"{C.SITE}/conciergerie-{x.slug}"}
                                     for i, x in enumerate(top)]}],
               image=f"{C.SITE}/images/{photo[0]}", garder_cp=len(code) == 3),
        C.header(NAV),
        C.crumb(trail),
        C.hero(f"📍 {nom} · {code}",
               f"Conciergerie <span class=\"font-serif-italic\">{dl}</span>",
               f"Gestion locative, accueil des voyageurs, ménage hôtelier et entretien de "
               f"résidence secondaire dans {len(communes)} communes du département.",
               photo[0], f"Bien géré par Label Maison Conciergerie {dl}",
               [f"<b>{len(communes)}</b> communes", "Équipes <b>locales</b>",
                "Commission au <b>résultat</b>", "Estimation <b>gratuite</b>"]),
        C.texte([
            f"Le département <strong>{nom}</strong> ({code}) réunit, pour les seules communes "
            f"couvertes ici, près de {pop_txt} habitants" +
            f". La demande locative y est portée par {top[0].nom} et les pôles voisins, mais elle "
            f"ne s'y limite pas : les villes moyennes concentrent une demande professionnelle, "
            f"universitaire et familiale que peu de propriétaires exploitent sérieusement.",
            "<strong>Label Maison Conciergerie</strong> gère des logements en location courte et "
            "moyenne durée, et entretient des résidences secondaires pour des propriétaires qui "
            "vivent ailleurs. Nous sommes rémunérés au pourcentage des revenus encaissés : notre "
            "intérêt, c'est que votre bien tourne bien.",
        ], pad=True),
        C.cartes("Ce que nous prenons en charge",
                 "Le même standard partout, exécuté par des équipes du secteur.", SERVICES_SETS[0]),
        C.zones(f"Nos communes {dl}",
                "Une page par commune, avec les démarches et la saisonnalité locales.",
                [(f"{x.nom} ({x.cp})", f"/conciergerie-{x.slug}") for x in top],
                extra=(f"Voir aussi la <a href=\"{region_url}\"><strong>conciergerie "
                       f"{rl}</strong></a> et notre "
                       f"<a href=\"/conciergerie-airbnb-france\">couverture nationale</a>.")),
        C.cartes("Pourquoi Label Maison", "", WHY, cols="g2"),
        C.faq(f"Questions fréquentes — conciergerie {dl}", faq_items),
        C.formulaire(f"Estimation gratuite {dl}",
                     "Commune, surface, disponibilité : nous revenons vers vous avec une estimation "
                     "locale et une proposition de gestion.",
                     nom, "Conciergerie", titre),
        C.footer([(nom, [(x.nom, f"/conciergerie-{x.slug}") for x in top[:6]]),
                  ("Nos services", [("Conciergerie Airbnb en France", "/conciergerie-airbnb-france"),
                                    (f"Conciergerie {rl}", region_url),
                                    ("Gestion locative", "/gestion-locative-france"),
                                    ("Estimation gratuite", "/estimation-rentabilite-airbnb"),
                                    ("Le blog", "/blog")])],
                 f"Conciergerie {dl} — gestion locative et entretien, "
                 f"<span class=\"font-serif-italic\">commune par commune</span>.",
                 f"{nom} ({code}) · {region}"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts, auto=True)
    return path


def page_region(nom: str, depts: dict, slug: str, dept_urls: dict, communes: list) -> str:
    path = "/" + slug
    url = C.SITE + path
    top = sorted(communes, key=lambda x: -x.pop)[:24]
    rl = D.loc_region(nom)
    titre = f"Conciergerie {rl} — gestion locative dans toute la région"
    # Formulée autrement que la page département du même nom (Guadeloupe, Guyane,
    # Martinique, Nouvelle-Calédonie, Polynésie) pour ne pas dupliquer la description.
    desc = (f"Conciergerie {rl}, toute la région : gestion locative courte et moyenne durée "
            f"dans {len(depts)} département{'s' if len(depts) > 1 else ''} et {len(communes)} "
            f"communes. Accueil des voyageurs, ménage hôtelier, entretien.")
    trail = [("Accueil", "/"), (nom, path)]
    faq_items = [
        (f"Quels départements couvrez-vous {rl} ?",
         f"{', '.join(sorted(depts))} — avec une page dédiée par département et par commune."),
        ("Comment gérez-vous à distance ?",
         "Nous ne gérons un logement qu'avec un relais sur place : notre équipe en Île-de-France, "
         "un partenaire local du réseau Label Maison ailleurs. Quand ce relais n'existe pas encore, "
         "nous accompagnons le propriétaire à distance (estimation, démarches, cahier des charges) "
         "sans prétendre faire le ménage depuis l'Essonne."),
        ("Quel est votre modèle de rémunération ?",
         "Commission sur les revenus encaissés pour la location, forfait pour l'entretien d'une "
         "résidence secondaire. Sans abonnement."),
        ("Faites-vous de la courte durée partout ?",
         "Uniquement là où la réglementation communale le permet et où nous pouvons garantir un "
         "vrai relais local. Ailleurs, nous proposons le meublé ou le bail mobilité."),
        ("Comment démarrer ?",
         "Par une estimation gratuite : décrivez-nous votre bien, nous revenons avec une "
         "fourchette de revenus et une proposition de gestion."),
    ]
    photo = C.photo(len(nom))
    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — {nom}", url, desc, top[0].nom, nom, top[0].cp,
                              geo=(round(top[0].lat, 4), round(top[0].lon, 4)),
                              area=[x.nom for x in top[:12]] + [nom]),
                C.ld_service(f"Conciergerie et gestion locative {rl}", nom, url, desc),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{photo[0]}"),
        C.header(NAV),
        C.crumb(trail),
        C.hero(f"📍 Région {nom}",
               f"Conciergerie <span class=\"font-serif-italic\">{rl}</span>",
               f"{len(depts)} départements, {len(communes)} communes couvertes : gestion locative, "
               f"accueil, ménage hôtelier et entretien de résidences secondaires.",
               photo[0], f"Bien géré par Label Maison Conciergerie {rl}",
               [f"<b>{len(depts)}</b> départements", f"<b>{len(communes)}</b> communes",
                "Équipes <b>locales</b>", "Estimation <b>gratuite</b>"]),
        C.texte([
            f"La location courte durée n'obéit pas aux mêmes règles d'un bout à l'autre de la "
            f"région <strong>{nom}</strong> : ici la saison dure quatre mois, là elle dure toute "
            f"l'année ; ici la mairie encadre strictement, là le bail mobilité est la meilleure "
            f"formule. Appliquer la même recette partout revient à laisser de l'argent sur la table.",
            "<strong>Label Maison Conciergerie</strong> travaille commune par commune : "
            "réglementation locale, calendrier des événements, comparables réels du quartier, "
            "équipes de ménage et artisans sur place. Vous gardez un interlocuteur unique.",
        ], pad=True),
        C.cartes("Ce que nous prenons en charge", "", SERVICES_SETS[1]),
        C.zones(f"Les départements de {nom}", "Choisissez votre département :",
                [(d, dept_urls[d]) for d in sorted(depts)],
                extra=("Voir aussi notre <a href=\"/conciergerie-airbnb-france\"><strong>"
                       "conciergerie Airbnb en France</strong></a>.")),
        C.zones(f"Les principales villes de {nom}", "",
                [(x.nom, f"/conciergerie-{x.slug}") for x in top],
                extra=("Votre commune n'apparaît pas ? Écrivez-nous : nous couvrons aussi les "
                       "communes plus petites.")),
        C.cartes("Pourquoi Label Maison", "", WHY, cols="g2"),
        C.faq(f"Questions fréquentes — conciergerie {rl}", faq_items),
        C.formulaire(f"Estimation gratuite {rl}",
                     "Commune, surface, disponibilité : nous revenons avec une estimation locale.",
                     nom, "Conciergerie", titre),
        C.footer([(nom, [(d, dept_urls[d]) for d in sorted(depts)[:6]]),
                  ("Nos services", [("Conciergerie Airbnb en France", "/conciergerie-airbnb-france"),
                                    ("Gestion locative", "/gestion-locative-france"),
                                    ("Estimation gratuite", "/estimation-rentabilite-airbnb"),
                                    ("Conciergerie privée de luxe", "/conciergerie-privee-paris"),
                                    ("Le blog", "/blog")])],
                 f"Conciergerie {rl} — gestion locative et entretien, "
                 f"<span class=\"font-serif-italic\">partout dans la région</span>.",
                 nom),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts, auto=True)
    return path


def main() -> dict:
    communes, _ = D.selection()
    couvertes = D.deja_couvertes()

    # Slugs de départements et de régions (calculés avant génération pour l'ancrage)
    par_dept, par_region = {}, {}
    for c in communes:
        par_dept.setdefault((c.dept, c.dept_nom, c.region), []).append(c)
        par_region.setdefault(c.region, []).append(c)
    pris = {"conciergerie-" + c.slug for c in communes}
    dept_slug = {k[1]: slug_dept(k[1], pris) for k in par_dept}
    region_slug = {r: slug_region(r, pris | set(dept_slug.values())) for r in par_region}
    dept_url = {n: "/" + s for n, s in dept_slug.items()}
    region_url = {n: "/" + s for n, s in region_slug.items()}

    urls, redirections = [], {}
    for c in communes:
        cible = couvertes.get(c.slug)
        if cible:  # page déjà travaillée à la main : on redirige au lieu de dupliquer
            redirections["/conciergerie-" + c.slug] = cible
            continue
        urls.append(page_commune(c, dept_url[c.dept_nom], region_url[c.region], couvertes))

    for (code, nom, region), liste in par_dept.items():
        urls.append(page_dept(code, nom, liste, dept_slug[nom], region_url[region], region))

    for region, liste in par_region.items():
        depts = {c.dept_nom for c in liste}
        urls.append(page_region(region, depts, region_slug[region], dept_url, liste))

    out = {"pages": urls, "redirections": redirections}
    pathlib.Path(__file__).with_name(".cache").mkdir(exist_ok=True)
    pathlib.Path(__file__).with_name(".cache").joinpath("communes_urls.json").write_text(
        json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"Communes : {len(urls)} pages générées, "
          f"{len(redirections)} redirections vers les pages existantes")
    return out


if __name__ == "__main__":
    main()
