# -*- coding: utf-8 -*-
"""Silo SEO « activités à Marrakech ».

Une page par expérience, reliée au hub /activites-marrakech existant et à la
conciergerie locale. Aucun tarif n'est affiché : les prix dépendent de la saison,
du nombre de participants et du prestataire, et nous ne publions pas de chiffres
que nous ne pourrions pas tenir. Les durées et distances indiquées sont, elles,
des repères réels.
"""
from __future__ import annotations

import pathlib
import re

import seo_common as C
from gen_seo_services import build

NAV = [("Marrakech", "/conciergerie-marrakech"), ("Activités", "/activites-marrakech"),
       ("Riad privatisé", "/riad-prive-marrakech"), ("Van & chauffeur", "/van-avec-chauffeur-marrakech")]

FOOT = [("Marrakech", [("Conciergerie à Marrakech", "/conciergerie-marrakech"),
                       ("Toutes les activités", "/activites-marrakech"),
                       ("Riad privatisé", "/riad-prive-marrakech"),
                       ("Villa & riad de luxe", "/location-villa-marrakech"),
                       ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")]),
        ("Expériences", [("Désert d'Agafay", "/desert-agafay-marrakech"),
                         ("Montgolfière", "/montgolfiere-marrakech"),
                         ("Quad", "/quad-marrakech"),
                         ("Vallée de l'Ourika", "/vallee-ourika-marrakech"),
                         ("Hammam & spa", "/hammam-spa-marrakech")])]

WHY = ("Pourquoi passer par notre conciergerie", [
    ("Des prestataires vérifiés",
     "Nous travaillons avec des partenaires que nous connaissons et que nous contrôlons : "
     "matériel, encadrement, assurance, ponctualité. C'est ce qui change tout sur place."),
    ("Transport compris dans la réflexion",
     "À Marrakech, la moitié des mauvaises expériences vient du trajet. Nous calons les "
     "horaires et les véhicules en même temps que l'activité."),
    ("Un programme qui tient debout",
     "Nous refusons d'empiler trois excursions dans une journée si elles ne s'enchaînent pas. "
     "Mieux vaut une expérience réussie que trois bâclées."),
    ("Un interlocuteur francophone",
     "Une seule personne joignable avant et pendant votre séjour, qui connaît votre programme "
     "et règle les imprévus à votre place."),
])


def activite(a: dict) -> dict:
    """Compose la spécification de page à partir des données d'une activité."""
    nom, slug = a["nom"], a["slug"]
    return dict(
        slug=slug, title=a["title"], desc=a["desc"], crumb=a["crumb"],
        trail=[("Accueil", "/"), ("Marrakech", "/conciergerie-marrakech"),
               ("Activités", "/activites-marrakech")],
        nav=NAV, service_type=a["service"], area="Marrakech",
        business=(" — Marrakech", "Marrakech", "Marrakech-Safi", "40000", "MA",
                  (31.6295, -7.9811), ["Marrakech", "Maroc"]),
        badge=a["badge"], h1=a["h1"], sub=a["sub"], photo=a["photo"],
        puces=a["puces"], cta=a.get("cta", "Réserver cette expérience"),
        intro=a["intro"],
        cards=(f"{nom} : ce que nous organisons", a.get("cards_lead", "Du transport au retour."),
               a["cards"]),
        sections=a["sections"],
        gallery=a["gallery"],
        steps=("Comment réserver", [
            ("1. Votre demande", "Dates, nombre de participants, âges, niveau souhaité."),
            ("2. Proposition", "Prestataire, horaires, transport et tarif : tout est écrit avant "
             "que vous vous engagiez."),
            ("3. Confirmation", "Créneau bloqué, point de rendez-vous et coordonnées du chauffeur."),
            ("4. Le jour J", "Prise en charge à votre riad ou votre hôtel, activité, retour."),
        ]),
        why=WHY,
        zones=("Les autres expériences à Marrakech", "",
               a["liens"] + [("Toutes les activités", "/activites-marrakech"),
                             ("Conciergerie à Marrakech", "/conciergerie-marrakech")],
               "Besoin d'un véhicule pour la journée ? Voir notre "
               "<a href=\"/van-avec-chauffeur-marrakech\"><strong>van avec chauffeur</strong></a> "
               "et notre <a href=\"/chauffeur-prive-marrakech\">chauffeur privé</a>."),
        faq_title=f"Questions fréquentes — {nom.lower()}",
        faq=a["faq"] + [
            ("Le transport est-il inclus ?",
             "Nous l'intégrons systématiquement à la proposition : prise en charge à votre riad "
             "ou votre hôtel et retour. À Marrakech, c'est ce qui fait la différence entre une "
             "belle journée et une journée passée à attendre."),
            ("Comment réserver et payer ?",
             "Vous nous décrivez votre demande, nous vous envoyons une proposition chiffrée avec "
             "le prestataire retenu et les horaires. Rien n'est engagé sans votre accord."),
        ],
        form=(f"Organisons votre {nom.lower()}",
              "Dates, nombre de participants, âges et niveau : nous revenons vers vous avec une "
              "proposition complète, transport compris.",
              "Marrakech", nom),
        footer=FOOT, tagline=a["tagline"], lieu="Marrakech · Maroc",
        mobcta="Réserver",
    )


P = "real/"
A = [
    dict(nom="Quad à Marrakech", slug="quad-marrakech",
         title="Quad à Marrakech — Palmeraie, désert d'Agafay et lac Lalla Takerkoust",
         desc="Sortie en quad à Marrakech : Palmeraie, désert d'Agafay ou lac Lalla Takerkoust, "
              "encadrement professionnel, transport depuis votre riad et pause thé. Organisé par "
              "votre conciergerie francophone.",
         crumb="Quad", service="Organisation de sorties en quad à Marrakech",
         badge="🏍️ Marrakech · Quad",
         h1="Quad à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Palmeraie, plateau rocailleux d'Agafay ou rives du lac Lalla Takerkoust : trois "
             "terrains très différents, un même encadrement et un transport calé sur votre journée.",
         photo=(P + "activite-quad2-poster.jpg", "Sortie en quad organisée par Label Maison Conciergerie"),
         puces=["Palmeraie · <b>Agafay</b>", "Encadrement <b>pro</b>",
                "Transport <b>inclus</b>", "Débutants <b>bienvenus</b>"],
         intro=[
             "Le quad est l'activité la plus demandée à Marrakech, et aussi celle où l'écart de "
             "qualité entre prestataires est le plus grand : état des machines, briefing réel ou "
             "expédié, taille des groupes, encadrement. Nous ne travaillons qu'avec des "
             "partenaires que nous avons vus rouler.",
             "Trois terrains sont possibles. La <strong>Palmeraie</strong>, à dix minutes de la "
             "ville, pour une première fois ou une sortie courte. Le <strong>désert d'Agafay</strong>, "
             "à trente à quarante minutes, pour les paysages de pierre et les grands espaces. Le "
             "<strong>lac Lalla Takerkoust</strong>, à quarante minutes, pour combiner quad et "
             "activités nautiques.",
         ],
         cards=[("Choix du terrain",
                 "Palmeraie pour une sortie courte et accessible, Agafay pour le paysage, Lalla "
                 "Takerkoust pour combiner avec le lac. Nous conseillons selon votre groupe."),
                ("Encadrement et sécurité",
                 "Casque fourni, briefing complet avant le départ, accompagnateur en tête et en "
                 "serre-file. Les machines sont adaptées à l'expérience des participants."),
                ("Formules courtes ou longues",
                 "De la sortie d'environ deux heures à la demi-journée avec pause. Nous calibrons "
                 "selon l'âge des participants et la chaleur du jour."),
                ("Pause thé et repos",
                 "La plupart des circuits incluent une halte thé à la menthe chez l'habitant ou "
                 "sous une tente : c'est souvent le meilleur moment de la sortie."),
                ("Transport depuis votre riad",
                 "Prise en charge à votre hébergement et retour, avec un chauffeur qui connaît "
                 "l'accès aux ruelles de la médina."),
                ("Combinaisons",
                 "Quad le matin, déjeuner au bord du lac ou dîner dans le désert le soir : nous "
                 "assemblons la journée entière si vous le souhaitez.")],
         sections=[
             ("Quel terrain choisir ?", [
                 "<strong>La Palmeraie</strong> est le terrain le plus accessible : pistes de terre "
                 "entre les palmiers et les villages, dix minutes de route. Idéale avec des "
                 "adolescents ou pour une première expérience.",
                 "<strong>Le désert d'Agafay</strong> offre un tout autre décor : un plateau de "
                 "pierre et de collines nues, à trente à quarante minutes de la ville. C'est le "
                 "choix des amateurs de paysage — et il se combine parfaitement avec un dîner sur "
                 "place, voir notre page <a href=\"/desert-agafay-marrakech\"><strong>désert "
                 "d'Agafay</strong></a>.",
                 "<strong>Lalla Takerkoust</strong>, au bord du lac de barrage, permet d'enchaîner "
                 "quad et <a href=\"/jet-ski-lalla-takerkoust\">jet-ski</a> dans la même journée, "
                 "avec un déjeuner les pieds dans l'eau.",
             ]),
             ("Ce qu'il faut prévoir", [
                 "Des vêtements que la poussière ne gênera pas, des lunettes, de la crème solaire "
                 "et un foulard : le sable et la poussière font partie de l'expérience. Prévoyez "
                 "des chaussures fermées.",
                 "En été, les sorties se font tôt le matin ou en fin d'après-midi : rouler à "
                 "quatorze heures en juillet n'a aucun intérêt. Nous adaptons systématiquement "
                 "l'horaire à la saison.",
             ]),
         ],
         gallery=[(P + "activite-quad2-poster.jpg", "Quad dans les environs de Marrakech"),
                  (P + "life-quad-poster.jpg", "Sortie quad encadrée"),
                  (P + "desert-pool.jpg", "Camp dans le désert près de Marrakech"),
                  (P + "marrakech-menara.jpg", "Jardin de la Ménara à Marrakech"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur pour les transferts"),
                  (P + "logement-riad-poster.jpg", "Riad à Marrakech")],
         faq=[("Faut-il un permis pour conduire un quad ?",
               "Les prestataires demandent généralement d'être majeur et de savoir conduire ; "
               "les mineurs peuvent monter en passager selon les cas. Nous vérifions les "
               "conditions exactes du prestataire retenu avant de confirmer."),
              ("Est-ce accessible aux débutants ?",
               "Oui. Le briefing et la première partie du circuit sont prévus pour cela, et "
               "l'accompagnateur adapte le rythme au groupe."),
              ("Quelle est la durée d'une sortie ?",
               "Le plus souvent deux heures environ, hors transport. Des formules demi-journée "
               "existent, avec pause et parcours plus long."),
              ("Peut-on y aller avec des enfants ?",
               "Selon l'âge : en passager pour les plus jeunes, en machine pour les adolescents "
               "sur certains circuits. Dites-nous les âges, nous adapterons.")],
         liens=[("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Jet-ski au lac", "/jet-ski-lalla-takerkoust"),
                ("Dromadaire dans la Palmeraie", "/dromadaire-palmeraie-marrakech"),
                ("Montgolfière", "/montgolfiere-marrakech")],
         tagline="Quad à Marrakech — Palmeraie, Agafay et lac, "
                 "<span class=\"font-serif-italic\">encadrés et organisés</span>."),

    dict(nom="Montgolfière à Marrakech", slug="montgolfiere-marrakech",
         title="Montgolfière à Marrakech — vol au lever du soleil sur la palmeraie et l'Atlas",
         desc="Vol en montgolfière à Marrakech au lever du soleil : décollage avant l'aube, vue "
              "sur la palmeraie, le désert et l'Atlas, petit-déjeuner berbère et transferts depuis "
              "votre riad. Organisation par votre conciergerie.",
         crumb="Montgolfière", service="Organisation de vols en montgolfière à Marrakech",
         badge="🎈 Marrakech · Montgolfière",
         h1="Montgolfière à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Décollage avant le lever du soleil, la palmeraie et les contreforts de l'Atlas qui "
             "s'éclairent sous la nacelle, puis petit-déjeuner berbère. L'expérience la plus "
             "marquante du séjour, pour beaucoup.",
         photo=(P + "marrakech-menara.jpg", "Marrakech au petit matin, jardin de la Ménara"),
         puces=["Lever de <b>soleil</b>", "Transferts <b>inclus</b>",
                "Petit-déjeuner <b>berbère</b>", "Vol d'environ <b>1 h</b>"],
         intro=[
             "Le vol se prépare tôt : prise en charge à votre riad vers 5 h à 6 h selon la saison, "
             "route jusqu'au terrain de décollage, gonflage des ballons dans la nuit, puis "
             "décollage au moment où le jour se lève. Le vol lui-même dure environ une heure.",
             "C'est une activité dépendante de la météo : le vent décide. Un vol reporté est un "
             "vol qui n'aurait pas dû partir — nous prévoyons donc, quand c'est possible, une "
             "date de repli dans votre séjour plutôt que de compter sur un créneau unique.",
         ],
         cards=[("Réveil et transferts",
                 "Prise en charge à votre riad ou hôtel en pleine nuit et retour en fin de "
                 "matinée : sans transport organisé, cette activité est difficile à tenir."),
                ("Vol au lever du soleil",
                 "Environ une heure dans les airs, au-dessus de la palmeraie, des villages et du "
                 "plateau désertique, avec l'Atlas en toile de fond."),
                ("Nacelles classiques ou privatives",
                 "Vol partagé en nacelle collective, ou vol privatif pour un moment à deux ou en "
                 "famille. Nous vous expliquons franchement la différence."),
                ("Petit-déjeuner berbère",
                 "À l'atterrissage, petit-déjeuner sous tente : thé, msemen, miel, œufs. C'est "
                 "prévu dans la plupart des formules."),
                ("Certificat de vol",
                 "La tradition veut qu'un certificat soit remis après le vol : c'est un joli "
                 "souvenir, surtout pour les enfants."),
                ("Gestion de la météo",
                 "En cas d'annulation pour vent, nous replanifions dans votre séjour si le "
                 "calendrier le permet, ou nous vous orientons vers le remboursement prévu par "
                 "le prestataire.")],
         sections=[
             ("Quand voler, et à quoi s'attendre", [
                 "Les vols ont lieu au lever du soleil, toute l'année : c'est le moment où l'air "
                 "est le plus stable. L'heure de prise en charge varie donc selon la saison, "
                 "typiquement entre 5 h et 6 h 30.",
                 "Il fait frais dans la nacelle au petit matin, même en été : prévoyez une veste "
                 "légère. Le vol est étonnamment calme — un ballon se déplace avec le vent, il n'y "
                 "a donc ni courant d'air ni sensation de vitesse.",
             ]),
             ("Combiner avec le reste de la journée", [
                 "Après l'atterrissage et le petit-déjeuner, le retour au riad se fait en général "
                 "en fin de matinée. La journée reste largement disponible : c'est le bon moment "
                 "pour un <a href=\"/hammam-spa-marrakech\">hammam</a> ou une après-midi calme.",
                 "Beaucoup de nos clients enchaînent la montgolfière un matin et le "
                 "<a href=\"/desert-agafay-marrakech\">dîner dans le désert d'Agafay</a> le soir "
                 "même : les deux se complètent bien et ne s'annulent pas.",
             ]),
         ],
         gallery=[(P + "marrakech-menara.jpg", "Marrakech, jardin de la Ménara"),
                  (P + "desert-pool.jpg", "Camp dans le désert"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "mercedes-van.jpg", "Transfert en van avec chauffeur"),
                  (P + "activite-quad2-poster.jpg", "Sortie quad dans les environs"),
                  (P + "dining.jpg", "Table dressée pour un repas")],
         faq=[("À quelle heure faut-il se lever ?",
               "La prise en charge se fait entre 5 h et 6 h 30 selon la saison, pour un décollage "
               "au lever du soleil. Le retour au riad a lieu en fin de matinée."),
              ("Que se passe-t-il si le vol est annulé ?",
               "L'annulation pour raison météo est décidée par le pilote, pour votre sécurité. "
               "Nous replanifions dans votre séjour quand c'est possible, sinon les conditions de "
               "remboursement du prestataire s'appliquent."),
              ("Les enfants peuvent-ils voler ?",
               "Oui à partir d'un certain âge et d'une certaine taille selon les prestataires. "
               "Indiquez-nous les âges, nous vérifierons avant de confirmer."),
              ("Vol partagé ou privatif ?",
               "La nacelle collective est la formule courante. Le vol privatif coûte nettement "
               "plus cher mais permet un moment à deux — utile pour une demande en mariage ou un "
               "anniversaire.")],
         liens=[("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Quad", "/quad-marrakech"),
                ("Hammam & spa", "/hammam-spa-marrakech"),
                ("Riad privatisé", "/riad-prive-marrakech")],
         tagline="Montgolfière à Marrakech — décollage au "
                 "<span class=\"font-serif-italic\">lever du soleil</span>."),

    dict(nom="Désert d'Agafay", slug="desert-agafay-marrakech",
         title="Désert d'Agafay — dîner sous tente, nuit en camp et coucher de soleil",
         desc="Désert d'Agafay depuis Marrakech : dîner sous tente avec spectacle, coucher de "
              "soleil, nuit en camp de luxe, quad et balade à dromadaire. À trente à quarante "
              "minutes de la ville, transport organisé.",
         crumb="Désert d'Agafay", service="Organisation d'expériences dans le désert d'Agafay",
         badge="🏜️ Marrakech · Désert d'Agafay",
         h1="Le désert d'<span class=\"font-serif-italic\">Agafay</span>",
         sub="Un désert de pierre à trente minutes de Marrakech : coucher de soleil sur les "
             "collines nues, dîner sous tente et nuit en camp, sans les huit heures de route du "
             "Sahara.",
         photo=(P + "desert-pool.jpg", "Camp dans le désert près de Marrakech"),
         puces=["À <b>30-40 min</b> de la ville", "Dîner <b>sous tente</b>",
                "Nuit en <b>camp</b>", "Coucher de <b>soleil</b>"],
         intro=[
             "Agafay n'est pas le Sahara : c'est un désert de pierre et de collines, sans dunes de "
             "sable, à trente à quarante minutes de Marrakech. C'est précisément ce qui en fait "
             "l'excursion la plus rentable du séjour : le dépaysement des grands espaces, sans une "
             "journée entière de route.",
             "On y vient pour la fin de journée : la lumière sur les collines, le dîner sous tente, "
             "le ciel étoilé. Certains camps proposent la nuit sur place, avec piscine et tentes "
             "équipées ; d'autres se limitent au dîner et au spectacle.",
         ],
         cards=[("Coucher de soleil",
                 "Le moment à ne pas manquer : nous calons l'heure de départ pour être sur place "
                 "avant, pas pendant."),
                ("Dîner sous tente",
                 "Tajines, grillades et pâtisseries marocaines, souvent accompagnés de musique "
                 "gnaoua ou d'un spectacle de feu selon les camps."),
                ("Nuit en camp",
                 "Tentes équipées avec vraie salle de bain dans les camps haut de gamme, piscine "
                 "et espace détente. Le lever du soleil sur le plateau vaut la nuit sur place."),
                ("Quad et dromadaire",
                 "La plupart des camps proposent des activités en fin d'après-midi : "
                 "<a href=\"/quad-marrakech\">quad</a>, buggy ou "
                 "<a href=\"/dromadaire-palmeraie-marrakech\">balade à dromadaire</a>."),
                ("Privatisations",
                 "Anniversaire, demande en mariage, séminaire : certains camps se privatisent "
                 "entièrement. Nous négocions les conditions et le programme."),
                ("Transport aller-retour",
                 "Route de trente à quarante minutes, dont une portion de piste : le véhicule "
                 "compte. Nous prévoyons un chauffeur qui connaît l'accès de nuit.")],
         sections=[
             ("Dîner seulement, ou nuit sur place ?", [
                 "<strong>Le dîner</strong> est la formule la plus choisie : départ en fin "
                 "d'après-midi, coucher de soleil, dîner, retour vers 23 h. Elle s'intègre "
                 "facilement dans un séjour court.",
                 "<strong>La nuit en camp</strong> change l'expérience : le silence après le départ "
                 "des groupes du dîner, le ciel étoilé sans pollution lumineuse, et le lever du "
                 "soleil sur le plateau. Si votre séjour le permet, c'est ce que nous recommandons.",
             ]),
             ("Ce qu'il faut savoir avant de partir", [
                 "Les nuits sont fraîches à Agafay, y compris en été : prévoyez une veste. Les "
                 "derniers kilomètres se font sur piste — c'est normal, et cela fait partie du "
                 "trajet.",
                 "Tous les camps ne se valent pas : entre le camp de groupe bruyant et le camp "
                 "haut de gamme aux tentes espacées, l'expérience n'a rien à voir. C'est "
                 "exactement le genre d'arbitrage sur lequel nous vous conseillons.",
             ]),
         ],
         gallery=[(P + "desert-pool.jpg", "Camp avec piscine dans le désert"),
                  (P + "activite-quad2-poster.jpg", "Quad dans le désert"),
                  (P + "dining.jpg", "Table dressée pour un dîner"),
                  (P + "marrakech-menara.jpg", "Marrakech, jardin de la Ménara"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur pour les transferts")],
         faq=[("À quelle distance se trouve Agafay ?",
               "Environ trente à quarante minutes de route depuis Marrakech, dont une portion de "
               "piste sur la fin."),
              ("Y a-t-il des dunes de sable ?",
               "Non. Agafay est un désert de pierre et de collines. Pour des dunes, il faut aller "
               "vers Merzouga ou Zagora, à une journée de route — nous organisons aussi ces "
               "circuits, mais il faut y consacrer deux ou trois jours."),
              ("Peut-on y aller avec des enfants ?",
               "Oui, c'est même une excursion très appréciée des familles. Certains camps "
               "disposent de piscines et proposent des activités adaptées."),
              ("Le dîner est-il adapté aux régimes particuliers ?",
               "Végétarien, sans gluten, allergies : indiquez-le à la réservation, nous "
               "transmettons au camp qui adapte le menu.")],
         liens=[("Quad", "/quad-marrakech"), ("Montgolfière", "/montgolfiere-marrakech"),
                ("Dromadaire", "/dromadaire-palmeraie-marrakech"),
                ("Soirées et tables", "/soiree-restaurant-marrakech")],
         tagline="Désert d'Agafay — dîner sous tente et nuit en camp, "
                 "<span class=\"font-serif-italic\">à trente minutes de Marrakech</span>."),

    dict(nom="Vallée de l'Ourika", slug="vallee-ourika-marrakech",
         title="Vallée de l'Ourika depuis Marrakech — cascades, Atlas et villages berbères",
         desc="Excursion dans la vallée de l'Ourika depuis Marrakech : cascades de Setti Fatma, "
              "villages berbères, déjeuner au bord de l'oued et jardins aromatiques. À une heure "
              "de route, transport et guide organisés.",
         crumb="Vallée de l'Ourika", service="Organisation d'excursions dans la vallée de l'Ourika",
         badge="⛰️ Marrakech · Vallée de l'Ourika",
         h1="La vallée de l'<span class=\"font-serif-italic\">Ourika</span>",
         sub="Une heure de route et l'on change de monde : l'oued, les villages accrochés au "
             "flanc de l'Atlas, les terrasses au bord de l'eau et la fraîcheur de la montagne.",
         photo=(P + "marrakech-menara.jpg", "Marrakech, point de départ vers l'Atlas"),
         puces=["À <b>1 h</b> de Marrakech", "Cascades de <b>Setti Fatma</b>",
                "Déjeuner <b>au bord de l'oued</b>", "Idéal en <b>famille</b>"],
         intro=[
             "La vallée de l'Ourika est l'échappée la plus simple depuis Marrakech : une heure de "
             "route vers le sud, et la température perd plusieurs degrés. La route longe l'oued, "
             "traverse des villages berbères, et s'arrête à Setti Fatma, point de départ de la "
             "montée vers les cascades.",
             "C'est une excursion à la journée qui convient particulièrement aux familles : "
             "marche courte ou longue selon l'envie, déjeuner sur une terrasse au bord de l'eau, "
             "et retour à Marrakech en fin d'après-midi.",
         ],
         cards=[("Route et villages",
                 "Arrêts possibles chez un potier, dans une coopérative d'argan ou au jardin "
                 "bio-aromatique : le trajet fait partie de l'excursion."),
                ("Cascades de Setti Fatma",
                 "Sept cascades s'étagent au-dessus du village. La première se rejoint en trente "
                 "à quarante-cinq minutes de marche ; les suivantes demandent de bonnes chaussures."),
                ("Déjeuner au bord de l'eau",
                 "Les tables installées les pieds dans l'oued sont l'image même de l'Ourika. Nous "
                 "réservons dans des adresses que nous connaissons."),
                ("Guide local",
                 "La montée vers les cascades se fait plus sereinement avec un guide du village, "
                 "surtout avec des enfants ou après la pluie."),
                ("Variante Atlas",
                 "La vallée peut se combiner avec l'Oukaïmeden ou une randonnée plus longue dans "
                 "le Haut Atlas, selon votre condition et la saison."),
                ("Transport",
                 "Route de montagne sinueuse : un chauffeur habitué change vraiment le confort du "
                 "trajet, surtout avec des enfants.")],
         sections=[
             ("Quand y aller", [
                 "Le printemps est la plus belle saison : la vallée est verte et l'eau abondante. "
                 "L'été, l'Ourika est l'échappatoire des Marrakchis à la chaleur — c'est aussi le "
                 "moment le plus fréquenté, en particulier le week-end.",
                 "En hiver, la vallée est calme et l'Atlas enneigé en toile de fond. Après de "
                 "fortes pluies, la montée aux cascades peut être glissante : le guide local est "
                 "alors indispensable.",
             ]),
             ("Une journée type", [
                 "Départ vers 9 h de votre riad, arrêts sur la route, arrivée à Setti Fatma en fin "
                 "de matinée, montée aux cascades, déjeuner au bord de l'oued, retour en milieu "
                 "d'après-midi.",
                 "Beaucoup de nos clients combinent cette journée avec un "
                 "<a href=\"/hammam-spa-marrakech\">hammam</a> au retour : la marche du matin "
                 "prend alors tout son sens.",
             ]),
         ],
         gallery=[(P + "marrakech-menara.jpg", "Marrakech et l'Atlas en arrière-plan"),
                  (P + "desert-pool.jpg", "Halte dans les environs de Marrakech"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur"),
                  (P + "dining.jpg", "Déjeuner organisé par la conciergerie"),
                  (P + "activite-quad2-poster.jpg", "Activité dans les environs de Marrakech")],
         faq=[("Combien de temps de route ?",
               "Environ une heure depuis Marrakech, un peu plus jusqu'au fond de la vallée."),
              ("La marche aux cascades est-elle difficile ?",
               "La première cascade se rejoint en trente à quarante-cinq minutes, sur un chemin "
               "rocailleux. Des chaussures fermées sont indispensables ; les suivantes demandent "
               "une meilleure condition physique."),
              ("Est-ce adapté aux jeunes enfants ?",
               "Oui pour la vallée et le déjeuner au bord de l'eau ; la montée complète aux "
               "cascades l'est moins. Nous adaptons le programme."),
              ("Peut-on y aller en hiver ?",
               "Oui, la vallée est belle et calme, avec l'Atlas enneigé. Prévoyez des vêtements "
               "chauds : il fait nettement plus frais qu'à Marrakech.")],
         liens=[("Cascades d'Ouzoud", "/cascades-ouzoud-marrakech"),
                ("Essaouira", "/excursion-essaouira-marrakech"),
                ("Lac Lalla Takerkoust", "/jet-ski-lalla-takerkoust"),
                ("Désert d'Agafay", "/desert-agafay-marrakech")],
         tagline="Vallée de l'Ourika — cascades et villages berbères, "
                 "<span class=\"font-serif-italic\">à une heure de Marrakech</span>."),

    dict(nom="Cascades d'Ouzoud", slug="cascades-ouzoud-marrakech",
         title="Cascades d'Ouzoud depuis Marrakech — excursion à la journée",
         desc="Excursion aux cascades d'Ouzoud depuis Marrakech : chutes de 110 mètres, singes "
              "magots, descente jusqu'au bassin, barques et déjeuner en terrasse. Journée complète "
              "avec transport organisé.",
         crumb="Cascades d'Ouzoud", service="Organisation d'excursions aux cascades d'Ouzoud",
         badge="💦 Marrakech · Cascades d'Ouzoud",
         h1="Les cascades d'<span class=\"font-serif-italic\">Ouzoud</span>",
         sub="Les plus hautes chutes du Maroc — environ 110 mètres — à deux heures et demie de "
             "Marrakech : une vraie journée d'excursion, et l'une des plus spectaculaires.",
         photo=(P + "desert-pool.jpg", "Excursion à la journée depuis Marrakech"),
         puces=["<b>110 m</b> de chutes", "Journée <b>complète</b>",
                "Singes <b>magots</b>", "Déjeuner <b>en terrasse</b>"],
         intro=[
             "Ouzoud demande de l'engagement : deux heures et demie à trois heures de route dans "
             "chaque sens. En échange, on découvre les plus hautes cascades du Maroc, une descente "
             "ombragée jusqu'au bassin, des barques qui s'approchent des chutes et, presque à coup "
             "sûr, des singes magots en liberté sur le chemin.",
             "C'est une journée entière : départ tôt le matin, retour en soirée. Elle ne se "
             "combine avec rien d'autre — et c'est très bien ainsi.",
         ],
         cards=[("Départ matinal",
                 "Prise en charge à votre riad tôt le matin pour arriver avant les groupes et "
                 "profiter de la fraîcheur pendant la descente."),
                ("Descente jusqu'au bassin",
                 "Un chemin aménagé descend le long des chutes, à l'ombre des oliviers. Comptez "
                 "une bonne demi-heure à la descente, un peu plus à la remontée."),
                ("Barques au pied des chutes",
                 "De petites embarcations s'approchent du rideau d'eau : c'est le moment fort de "
                 "la visite, prévoyez de quoi protéger vos appareils."),
                ("Singes magots",
                 "La forêt d'oliviers abrite des macaques de Barbarie en liberté. On les observe "
                 "sans les nourrir ni les approcher."),
                ("Déjeuner face aux chutes",
                 "Plusieurs terrasses surplombent le site. Nous réservons une table avec vue "
                 "plutôt que de laisser le hasard décider."),
                ("Guide local",
                 "Un guide du village facilite la descente, raconte le site et évite les "
                 "sollicitations. Nous le prévoyons dans la proposition.")],
         sections=[
             ("Une journée qui se prépare", [
                 "Le trajet est long : cinq à six heures de route aller-retour. Un véhicule "
                 "confortable et un chauffeur reposé ne sont pas un luxe, ce sont les conditions "
                 "d'une bonne journée.",
                 "Nous partons tôt — généralement vers 7 h 30 ou 8 h — pour arriver avant les "
                 "autocars et profiter du site dans de meilleures conditions.",
             ]),
             ("Ce qu'il faut emporter", [
                 "Chaussures de marche ou baskets à bonne adhérence : le chemin est humide par "
                 "endroits. Maillot de bain si vous souhaitez vous baigner dans le bassin en été, "
                 "et de quoi protéger vos affaires des embruns.",
                 "Le printemps offre le meilleur débit d'eau. L'été reste spectaculaire, avec la "
                 "possibilité de se baigner. L'automne est plus calme.",
             ]),
         ],
         gallery=[(P + "desert-pool.jpg", "Excursion depuis Marrakech"),
                  (P + "marrakech-menara.jpg", "Marrakech, point de départ"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur pour la journée"),
                  (P + "logement-riad-poster.jpg", "Riad à Marrakech"),
                  (P + "dining.jpg", "Déjeuner réservé par la conciergerie"),
                  (P + "activite-quad2-poster.jpg", "Autres activités aux environs")],
         faq=[("Combien de temps de route ?",
               "Deux heures et demie à trois heures dans chaque sens. C'est une journée complète, "
               "de tôt le matin à la soirée."),
              ("La descente est-elle difficile ?",
               "Le chemin est aménagé mais irrégulier et parfois humide. Comptez une trentaine de "
               "minutes à la descente et un peu plus à la remontée."),
              ("Peut-on se baigner ?",
               "En été, la baignade dans le bassin est possible. Le reste de l'année, l'eau est "
               "froide et le débit plus fort."),
              ("Les singes sont-ils dangereux ?",
               "Non, mais ce sont des animaux sauvages : on ne les nourrit pas et on ne les "
               "approche pas. Gardez vos affaires fermées.")],
         liens=[("Vallée de l'Ourika", "/vallee-ourika-marrakech"),
                ("Essaouira", "/excursion-essaouira-marrakech"),
                ("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")],
         tagline="Cascades d'Ouzoud — les plus hautes chutes du Maroc, "
                 "<span class=\"font-serif-italic\">en une journée</span>."),

    dict(nom="Excursion à Essaouira", slug="excursion-essaouira-marrakech",
         title="Essaouira depuis Marrakech — médina, port et océan en une journée",
         desc="Excursion à Essaouira depuis Marrakech : médina classée UNESCO, remparts de la "
              "skala, port de pêche, plage et arganeraie sur la route. Journée complète avec "
              "chauffeur, ou séjour de deux jours.",
         crumb="Essaouira", service="Organisation d'excursions à Essaouira depuis Marrakech",
         badge="🌊 Marrakech · Essaouira",
         h1="Essaouira depuis <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Deux heures et demie de route et l'océan : une médina classée, des remparts battus "
             "par le vent, un port de pêche encore vivant et une plage immense.",
         photo=(P + "sejour-mer-poster.jpg", "Escapade en bord de mer organisée par la conciergerie"),
         puces=["À <b>2 h 30</b> de route", "Médina <b>UNESCO</b>",
                "Port de <b>pêche</b>", "Arganeraie <b>sur la route</b>"],
         intro=[
             "Essaouira est l'antidote parfait à l'intensité de Marrakech : une ville blanche et "
             "bleue, une médina paisible où l'on circule sans être sollicité, des remparts face à "
             "l'Atlantique et un port où l'on regarde revenir les barques bleues.",
             "La route traverse l'arganeraie — arrêt possible dans une coopérative — et se fait en "
             "deux heures et demie à trois heures. En une journée, c'est faisable ; en deux jours, "
             "c'est nettement plus agréable.",
         ],
         cards=[("Route et arganeraie",
                 "Arrêt dans une coopérative féminine d'huile d'argan : production réelle, pas "
                 "boutique à touristes. Nous choisissons l'adresse."),
                ("Médina classée",
                 "Rues rectilignes, ateliers d'ébénistes en thuya, galeries : la médina d'Essaouira "
                 "se visite à pied, tranquillement."),
                ("Remparts et skala",
                 "La skala de la ville et ses canons donnent la plus belle vue sur l'océan — la "
                 "photo obligatoire du séjour."),
                ("Port de pêche",
                 "Les barques bleues, la criée, les grillades de poisson sur le port : c'est le "
                 "cœur vivant de la ville."),
                ("Plage et sports de vent",
                 "La baie est réputée pour le kitesurf et la planche à voile. Nous pouvons prévoir "
                 "un cours ou une session encadrée."),
                ("Formule deux jours",
                 "Une nuit sur place change tout : la médina en fin de journée, le dîner de "
                 "poisson et le lendemain matin sans course contre la montre.")],
         sections=[
             ("Un jour ou deux ?", [
                 "<strong>En une journée</strong>, comptez cinq à six heures de route aller-retour "
                 "et quatre à cinq heures sur place. C'est réalisable et cela reste une belle "
                 "journée, mais le rythme est soutenu.",
                 "<strong>En deux jours</strong>, vous découvrez la ville au moment où elle est la "
                 "plus belle : la lumière de fin d'après-midi sur les remparts et le calme du "
                 "matin. Nous réservons alors un riad dans la médina.",
             ]),
             ("Le vent, à connaître avant de partir", [
                 "Essaouira est surnommée la ville du vent, et ce n'est pas une image : les "
                 "alizés y soufflent une grande partie de l'année. C'est ce qui en fait un spot "
                 "de kitesurf réputé — et ce qui explique qu'on y est rarement en maillot sur la "
                 "plage.",
                 "Prévoyez une couche supplémentaire, même en été. Et pour une journée de plage "
                 "au calme, le lac de <a href=\"/jet-ski-lalla-takerkoust\">Lalla Takerkoust</a> "
                 "est parfois plus adapté.",
             ]),
         ],
         gallery=[(P + "sejour-mer-poster.jpg", "Séjour en bord de mer"),
                  (P + "marrakech-menara.jpg", "Marrakech, point de départ"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur pour la journée"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "dining.jpg", "Table réservée par la conciergerie"),
                  (P + "desert-pool.jpg", "Autres excursions depuis Marrakech")],
         faq=[("Combien de temps de route ?",
               "Environ deux heures et demie à trois heures dans chaque sens depuis Marrakech."),
              ("Peut-on se baigner à Essaouira ?",
               "La plage est immense, mais l'eau de l'Atlantique est fraîche et le vent souvent "
               "présent. C'est davantage une ville de balade et de sports de vent que de baignade."),
              ("Est-ce intéressant avec des enfants ?",
               "Oui : la médina est facile à parcourir, le port fascine les enfants, et la plage "
               "permet de courir. La longueur du trajet reste le seul point de vigilance."),
              ("Faut-il un guide ?",
               "Pas nécessairement : Essaouira se visite très bien seul. Nous pouvons toutefois "
               "prévoir un guide pour la médina et l'histoire de la ville.")],
         liens=[("Cascades d'Ouzoud", "/cascades-ouzoud-marrakech"),
                ("Vallée de l'Ourika", "/vallee-ourika-marrakech"),
                ("Van avec chauffeur", "/van-avec-chauffeur-marrakech"),
                ("Riad privatisé", "/riad-prive-marrakech")],
         tagline="Essaouira depuis Marrakech — médina, remparts et "
                 "<span class=\"font-serif-italic\">océan</span>."),

    dict(nom="Jet-ski au lac Lalla Takerkoust", slug="jet-ski-lalla-takerkoust",
         title="Jet-ski au lac Lalla Takerkoust — sports nautiques près de Marrakech",
         desc="Jet-ski au lac Lalla Takerkoust, à quarante minutes de Marrakech : sessions "
              "encadrées, quad et buggy sur les berges, déjeuner au bord de l'eau. Transport "
              "organisé depuis votre riad.",
         crumb="Jet-ski au lac", service="Organisation d'activités nautiques au lac Lalla Takerkoust",
         badge="🌅 Marrakech · Lac Lalla Takerkoust",
         h1="Jet-ski au lac <span class=\"font-serif-italic\">Lalla Takerkoust</span>",
         sub="Un lac de barrage au pied de l'Atlas, à quarante minutes de Marrakech : jet-ski, "
             "quad sur les berges et déjeuner les pieds dans l'eau.",
         photo=(P + "jetski.jpg", "Jet-ski organisé par Label Maison Conciergerie"),
         puces=["À <b>40 min</b> de Marrakech", "Sessions <b>encadrées</b>",
                "Quad <b>possible</b>", "Déjeuner <b>au bord de l'eau</b>"],
         intro=[
             "Peu de visiteurs savent qu'il existe un lac à quarante minutes de Marrakech. Le "
             "barrage de Lalla Takerkoust, au pied de l'Atlas, offre un plan d'eau où l'on "
             "pratique le jet-ski et où plusieurs adresses proposent déjeuner et transats au bord "
             "de l'eau.",
             "C'est la journée idéale quand la chaleur de la ville devient pesante : une session "
             "sur l'eau, un déjeuner à l'ombre, éventuellement une sortie "
             "<a href=\"/quad-marrakech\">quad</a> sur les berges, et retour en fin d'après-midi.",
         ],
         cards=[("Sessions de jet-ski",
                 "Sessions encadrées, gilet fourni, briefing avant le départ. Accessible aux "
                 "débutants comme aux habitués."),
                ("Quad et buggy",
                 "Les berges et les pistes environnantes se prêtent à une sortie quad avant ou "
                 "après le jet-ski."),
                ("Déjeuner au bord de l'eau",
                 "Plusieurs adresses proposent des terrasses et des transats face au lac. Nous "
                 "réservons celle qui correspond à votre groupe."),
                ("Journée famille",
                 "Baignade, pédalo, transats à l'ombre : le lac fonctionne aussi très bien pour "
                 "une journée calme en famille."),
                ("Coucher de soleil",
                 "En fin de journée, la lumière sur l'Atlas depuis les berges vaut le détour — "
                 "et il n'y a presque personne."),
                ("Transport",
                 "Quarante minutes de route depuis votre riad, aller et retour organisés avec "
                 "un chauffeur qui vous attend sur place.")],
         sections=[
             ("Une journée sur mesure", [
                 "Le lac permet d'assembler la journée comme on veut : jet-ski le matin quand "
                 "l'eau est calme, déjeuner prolongé, quad en fin d'après-midi. Rien n'oblige à "
                 "tout faire.",
                 "C'est aussi une bonne option de repli quand le programme prévu tombe à l'eau — "
                 "une montgolfière annulée pour vent, par exemple : le lac est disponible à la "
                 "dernière minute.",
             ]),
             ("Quand y aller", [
                 "Le lac se pratique du printemps à l'automne. En plein été, on privilégie la "
                 "matinée ou la fin d'après-midi pour l'activité, et l'ombre pour le déjeuner.",
                 "Le niveau du lac varie selon les années et la saison : nous vérifions les "
                 "conditions réelles avec le prestataire avant de confirmer une session.",
             ]),
         ],
         gallery=[(P + "jetski.jpg", "Session de jet-ski"),
                  (P + "activite-jetski2-poster.jpg", "Jet-ski encadré"),
                  (P + "activite-jetski3-poster.jpg", "Sortie nautique"),
                  (P + "activite-quad2-poster.jpg", "Sortie quad"),
                  (P + "desert-pool.jpg", "Halte au bord de l'eau"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur")],
         faq=[("Faut-il savoir piloter un jet-ski ?",
               "Non : un briefing est assuré avant le départ et les sessions sont encadrées. "
               "Les débutants sont la majorité."),
              ("Peut-on venir en famille ?",
               "Oui. Baignade, transats, pédalos et restauration sur place permettent d'occuper "
               "ceux qui ne font pas de jet-ski."),
              ("Quelle est la durée d'une session ?",
               "Généralement des sessions de trente minutes à une heure, à ajuster selon le "
               "nombre de participants."),
              ("Peut-on combiner avec le quad ?",
               "Oui, c'est même la combinaison la plus demandée : quad sur les berges et jet-ski "
               "sur le lac dans la même journée.")],
         liens=[("Quad", "/quad-marrakech"), ("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Vallée de l'Ourika", "/vallee-ourika-marrakech"),
                ("Hammam & spa", "/hammam-spa-marrakech")],
         tagline="Jet-ski au lac Lalla Takerkoust — l'eau et l'Atlas, "
                 "<span class=\"font-serif-italic\">à quarante minutes de Marrakech</span>."),

    dict(nom="Hammam et spa à Marrakech", slug="hammam-spa-marrakech",
         title="Hammam et spa à Marrakech — traditionnel, riad ou palace",
         desc="Hammam et spa à Marrakech : hammam traditionnel au savon noir et gommage kessa, "
              "ghassoul, massage à l'huile d'argan. Nous réservons l'adresse adaptée à vos "
              "attentes, du hammam authentique au spa de palace.",
         crumb="Hammam & spa", service="Réservation de hammams et de spas à Marrakech",
         badge="🕯️ Marrakech · Hammam & spa",
         h1="Hammam et spa à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Du hammam de quartier au spa de palace, l'écart est immense. Nous choisissons "
             "l'adresse en fonction de ce que vous cherchez vraiment.",
         photo=(P + "loveroom-jacuzzi-poster.jpg", "Espace bien-être privatisé"),
         puces=["Savon noir & <b>kessa</b>", "Ghassoul & <b>argan</b>",
                "Riad ou <b>palace</b>", "Réservation <b>anticipée</b>"],
         intro=[
             "Le hammam fait partie du séjour à Marrakech au même titre que la médina. Encore "
             "faut-il savoir où aller : entre le hammam populaire de quartier, le hammam de riad "
             "pensé pour les visiteurs et le spa de palace, ce ne sont pas les mêmes expériences, "
             "ni les mêmes budgets.",
             "Le rituel traditionnel est simple : chaleur humide, savon noir, gommage vigoureux au "
             "gant kessa, rinçage, puis argile ghassoul et souvent un massage à l'huile d'argan. "
             "On en ressort épuisé et parfaitement détendu.",
         ],
         cards=[("Hammam traditionnel",
                 "L'expérience authentique, en salle commune ou privatisée : chaleur, savon noir, "
                 "gommage au kessa. Vigoureux, et c'est le but."),
                ("Spa de riad",
                 "Cadre plus intime, souvent privatisable, avec des rituels plus longs : hammam, "
                 "gommage, enveloppement et massage à la suite."),
                ("Spa de palace",
                 "Pour ceux qui cherchent le confort maximal : espaces vastes, piscines "
                 "intérieures, protocoles longs. Nous obtenons les créneaux."),
                ("Massage à l'huile d'argan",
                 "Souvent proposé à la suite du hammam, il complète le rituel. Précisez la "
                 "pression souhaitée : les habitudes locales sont plutôt appuyées."),
                ("Formules duo",
                 "Cabines doubles pour un couple ou deux amis, dans la plupart des adresses que "
                 "nous recommandons."),
                ("Créneaux et transferts",
                 "Les bons créneaux de fin de journée partent vite. Nous réservons à l'avance et "
                 "organisons le transport aller-retour.")],
         sections=[
             ("Comment se déroule un hammam traditionnel", [
                 "On commence par rester une quinzaine de minutes dans la salle chaude pour que la "
                 "peau s'assouplisse. Vient ensuite l'application du savon noir, puis le gommage "
                 "au gant kessa — c'est la partie la plus marquante, et la plus efficace.",
                 "Après le rinçage, l'argile ghassoul est appliquée sur le corps et les cheveux. "
                 "On termine généralement par un massage à l'huile d'argan et un temps de repos "
                 "avec un thé. Comptez une heure à une heure et demie selon la formule.",
             ]),
             ("Quand le programmer dans le séjour", [
                 "Le meilleur moment est en fin de journée, après une marche dans la médina ou une "
                 "excursion : le hammam devient alors une vraie récupération.",
                 "Après une journée de <a href=\"/quad-marrakech\">quad</a> ou une montée aux "
                 "<a href=\"/vallee-ourika-marrakech\">cascades de l'Ourika</a>, c'est presque une "
                 "obligation. Prévoyez ensuite une soirée calme — voir nos "
                 "<a href=\"/soiree-restaurant-marrakech\">tables et soirées</a>.",
             ]),
         ],
         gallery=[(P + "loveroom-jacuzzi-poster.jpg", "Espace bien-être"),
                  (P + "jacuzzi.jpg", "Bassin d'un espace détente"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "logement-sdb-poster.jpg", "Salle de bain préparée"),
                  (P + "marrakech-menara.jpg", "Marrakech"),
                  (P + "dining.jpg", "Table dressée pour un dîner")],
         faq=[("Hommes et femmes ensemble ?",
               "Dans les hammams traditionnels, les espaces et les horaires sont généralement "
               "séparés. Les spas de riad et de palace proposent des cabines privatives ou duo."),
              ("Que faut-il apporter ?",
               "Rien en général : serviettes, gant et produits sont fournis dans les adresses que "
               "nous réservons. Prévoyez un maillot de bain pour les formules mixtes."),
              ("Le gommage est-il douloureux ?",
               "Il est vigoureux, pas douloureux. Vous pouvez demander une pression plus douce : "
               "dites-le simplement au début de la séance."),
              ("Combien de temps dure une séance ?",
               "D'une heure environ pour un rituel simple à deux heures pour une formule complète "
               "avec massage.")],
         liens=[("Riad privatisé", "/riad-prive-marrakech"),
                ("Soirées et tables", "/soiree-restaurant-marrakech"),
                ("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Montgolfière", "/montgolfiere-marrakech")],
         tagline="Hammam et spa à Marrakech — la bonne adresse, "
                 "<span class=\"font-serif-italic\">selon ce que vous cherchez</span>."),

    dict(nom="Riad privatisé à Marrakech", slug="riad-prive-marrakech",
         title="Riad privatisé à Marrakech — maison entière, personnel et chef",
         desc="Louer un riad privatisé à Marrakech : maison entière dans la médina ou villa à la "
              "Palmeraie, personnel de maison, chef à domicile, transferts et programme "
              "d'activités. Anniversaires, EVJF, séjours en famille.",
         crumb="Riad privatisé", service="Location et privatisation de riads à Marrakech",
         badge="🏛️ Marrakech · Riad privatisé",
         h1="Riad <span class=\"font-serif-italic\">privatisé</span> à Marrakech",
         sub="Une maison entière pour votre groupe, avec le personnel, le chef et un programme "
             "cousu main. La formule la plus confortable pour un séjour à plusieurs.",
         photo=(P + "logement-riad-poster.jpg", "Riad à Marrakech"),
         puces=["Maison <b>entière</b>", "Personnel <b>sur place</b>",
                "Chef à <b>domicile</b>", "Programme <b>sur mesure</b>"],
         intro=[
             "Privatiser un riad change complètement un séjour à Marrakech : vous avez la maison "
             "pour vous, le patio, la terrasse, souvent une piscine, et un personnel qui prépare "
             "les repas et s'occupe de tout. Pour un groupe d'amis, un anniversaire ou une famille, "
             "c'est presque toujours plus confortable et plus économique qu'un hôtel.",
             "Nous cherchons la maison qui correspond réellement à votre séjour — médina pour "
             "l'ambiance et la proximité, Palmeraie pour l'espace et le calme — puis nous "
             "organisons ce qui va autour : transferts, chef, activités, soirées.",
         ],
         cards=[("Recherche de la maison",
                 "Nombre de chambres, piscine, terrasse, accès en voiture, distance de la place "
                 "Jemaa el-Fna : nous filtrons sur vos vrais critères."),
                ("Personnel de maison",
                 "Cuisinière, femme de chambre, majordome selon la maison : le personnel est "
                 "généralement inclus dans la privatisation."),
                ("Chef à domicile",
                 "Cuisine marocaine ou internationale, dîners à thème, cours de cuisine avec la "
                 "dada de la maison : tout se prévoit à l'avance."),
                ("Transferts et véhicules",
                 "Accueil à l'aéroport Ménara et véhicule à disposition — voir notre "
                 "<a href=\"/van-avec-chauffeur-marrakech\">van avec chauffeur</a>."),
                ("Événements privés",
                 "Anniversaire, EVJF, demande en mariage, séminaire : décoration, musiciens, "
                 "traiteur, photographe. Nous coordonnons les prestataires."),
                ("Programme d'activités",
                 "Quad, montgolfière, désert, hammam : nous calons les activités dans un ordre "
                 "qui tient compte des trajets et de la chaleur.")],
         sections=[
             ("Médina ou Palmeraie ?", [
                 "<strong>Dans la médina</strong>, on vit au cœur de la ville : les souks à pied, "
                 "les terrasses sur les toits, l'appel à la prière. Contrainte réelle : la voiture "
                 "s'arrête à l'entrée des ruelles, et les bagages se finissent parfois en charrette.",
                 "<strong>À la Palmeraie</strong> ou sur la route d'Amizmiz, on gagne l'espace, la "
                 "piscine et le calme, avec une voiture indispensable pour rejoindre le centre en "
                 "vingt minutes. Le choix dépend surtout de la composition du groupe.",
             ]),
             ("Ce que nous vérifions avant de vous proposer une maison", [
                 "La réalité des photos, l'état de la piscine, la climatisation dans toutes les "
                 "chambres, l'insonorisation entre les chambres, l'accès et le stationnement, et "
                 "le sérieux du personnel.",
                 "Une belle photo de patio ne dit rien de la nuit qu'on y passe. C'est exactement "
                 "ce que notre présence locale permet de vérifier avant que vous versiez un acompte.",
             ]),
         ],
         gallery=[(P + "logement-riad-poster.jpg", "Riad à Marrakech"),
                  (P + "logement-salon-poster.jpg", "Salon d'une maison privatisée"),
                  (P + "logement-chambre2-poster.jpg", "Chambre préparée"),
                  (P + "jacuzzi.jpg", "Espace bien-être"),
                  (P + "dining.jpg", "Table dressée pour un dîner"),
                  (P + "marrakech-menara.jpg", "Marrakech")],
         faq=[("À partir de combien de personnes ?",
               "La privatisation se justifie dès quatre à six personnes, et devient très "
               "intéressante au-delà. Il existe aussi de petits riads pour deux couples."),
              ("Le personnel est-il inclus ?",
               "Dans la plupart des maisons, oui : cuisine, ménage et service courant. Les repas "
               "sont facturés à part, généralement au coût des courses plus un forfait."),
              ("Peut-on organiser un événement privé ?",
               "Oui : anniversaires, EVJF, demandes en mariage, séminaires. Nous coordonnons "
               "décoration, traiteur, musiciens et photographe."),
              ("Combien de temps à l'avance réserver ?",
               "Plusieurs mois pour les périodes de vacances scolaires et les ponts, où les belles "
               "maisons partent très tôt.")],
         liens=[("Villa & riad de luxe", "/location-villa-marrakech"),
                ("Hammam & spa", "/hammam-spa-marrakech"),
                ("Soirées et tables", "/soiree-restaurant-marrakech"),
                ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")],
         tagline="Riad privatisé à Marrakech — la maison, le personnel et "
                 "<span class=\"font-serif-italic\">le programme</span>."),

    dict(nom="Soirées et tables à Marrakech", slug="soiree-restaurant-marrakech",
         title="Soirées et restaurants à Marrakech — tables, rooftops et dîners spectacle",
         desc="Réserver les meilleures tables et soirées à Marrakech : rooftops de la médina, "
              "dîners spectacle, restaurants de la Palmeraie, clubs et soirées privées. "
              "Réservations, transport et retour organisés.",
         crumb="Soirées & tables", service="Réservation de restaurants et de soirées à Marrakech",
         badge="🌙 Marrakech · Soirées & tables",
         h1="Soirées et tables à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Rooftops de la médina, dîners spectacle, tables de la Palmeraie, clubs : nous "
             "réservons, nous plaçons et nous ramenons.",
         photo=(P + "dining.jpg", "Table dressée pour un dîner"),
         puces=["Rooftops & <b>médina</b>", "Dîners <b>spectacle</b>",
                "Tables <b>très demandées</b>", "Retour <b>organisé</b>"],
         intro=[
             "Marrakech se vit beaucoup le soir : la chaleur retombe, les terrasses s'allument et "
             "la ville change de rythme. Le problème est classique — les meilleures tables sont "
             "complètes, les adresses citées partout ne sont pas toujours les meilleures, et le "
             "retour à 2 h du matin ne s'improvise pas.",
             "Nous réservons dans des adresses que nous connaissons, nous demandons les bonnes "
             "places plutôt que la table près de la porte, et nous prévoyons le chauffeur pour le "
             "retour.",
         ],
         cards=[("Rooftops de la médina",
                 "Coucher de soleil sur les toits et la Koutoubia : le premier verre de la soirée "
                 "se prend en hauteur."),
                ("Tables gastronomiques",
                 "Cuisine marocaine contemporaine ou internationale, dans la médina, à Guéliz ou "
                 "à la Palmeraie. Nous conseillons selon vos goûts, pas selon les commissions."),
                ("Dîners spectacle",
                 "Musiciens gnaoua, danse, feu : les grandes tables spectacle de Marrakech "
                 "impressionnent toujours, surtout en groupe."),
                ("Clubs et soirées",
                 "Accès aux clubs et soirées de la Palmeraie et de l'Hivernage, avec table et "
                 "entrée prévues à l'avance."),
                ("Dîner privé chez vous",
                 "Chef à domicile dans votre riad ou votre villa : souvent le meilleur repas du "
                 "séjour, voir notre <a href=\"/riad-prive-marrakech\">riad privatisé</a>."),
                ("Transport et retour",
                 "Chauffeur qui vous dépose et vous récupère à l'heure convenue : indispensable en "
                 "fin de soirée.")],
         sections=[
             ("Où sortir selon l'ambiance", [
                 "<strong>La médina</strong> pour les rooftops, les riads-restaurants et l'ambiance "
                 "de la ville ancienne. <strong>Guéliz et l'Hivernage</strong> pour les tables "
                 "contemporaines, les bars et les clubs.",
                 "<strong>La Palmeraie et la route d'Amizmiz</strong> pour les grandes tables avec "
                 "jardins, piscines et spectacles : il faut compter le trajet, mais ce sont "
                 "souvent les soirées les plus mémorables.",
             ]),
             ("Réserver au bon moment", [
                 "Pendant les vacances scolaires, les ponts et les fêtes de fin d'année, les "
                 "meilleures tables sont complètes plusieurs jours à l'avance. Nous réservons dès "
                 "que vos dates sont fixées, quitte à ajuster ensuite.",
                 "Pour un anniversaire ou une demande en mariage, dites-le nous : le placement, le "
                 "gâteau et le timing se préparent avec le restaurant.",
             ]),
         ],
         gallery=[(P + "dining.jpg", "Table dressée pour un dîner"),
                  (P + "logement-riad-poster.jpg", "Riad marocain"),
                  (P + "marrakech-menara.jpg", "Marrakech en soirée"),
                  (P + "desert-pool.jpg", "Dîner dans le désert"),
                  (P + "mercedes-van.jpg", "Van avec chauffeur pour le retour"),
                  (P + "proof-voiture-nuit-poster.jpg", "Véhicule en soirée")],
         faq=[("Pouvez-vous réserver une table complète ?",
               "Nous ne promettons jamais l'impossible, mais notre réseau local permet souvent "
               "d'obtenir ce que les plateformes affichent complet. Nous vous répondons franchement."),
              ("Y a-t-il un code vestimentaire ?",
               "Dans les tables de la Palmeraie et les clubs, une tenue soignée est attendue. "
               "Les rooftops de la médina sont plus décontractés."),
              ("Peut-on sortir en famille ?",
               "Oui, de nombreuses adresses accueillent les enfants, y compris les dîners "
               "spectacle. Nous orientons selon les âges."),
              ("Comment rentrer en fin de soirée ?",
               "Avec votre chauffeur, à l'heure convenue. C'est prévu dans la proposition — les "
               "taxis se négocient mal à 2 h du matin.")],
         liens=[("Riad privatisé", "/riad-prive-marrakech"),
                ("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Hammam & spa", "/hammam-spa-marrakech"),
                ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")],
         tagline="Soirées et tables à Marrakech — les bonnes adresses, "
                 "<span class=\"font-serif-italic\">et le retour prévu</span>."),

    dict(nom="Balade à dromadaire dans la Palmeraie", slug="dromadaire-palmeraie-marrakech",
         title="Balade à dromadaire dans la Palmeraie de Marrakech — coucher de soleil",
         desc="Balade à dromadaire dans la Palmeraie de Marrakech : environ une heure entre les "
              "palmiers, thé sous la tente et coucher de soleil. Activité familiale, transferts "
              "depuis votre riad inclus.",
         crumb="Dromadaire", service="Organisation de balades à dromadaire à Marrakech",
         badge="🐪 Marrakech · Palmeraie",
         h1="Balade à dromadaire dans la <span class=\"font-serif-italic\">Palmeraie</span>",
         sub="Une heure entre les palmiers, en fin d'après-midi, avec le thé sous la tente et la "
             "lumière du couchant. L'activité la plus simple — et celle dont les enfants parlent "
             "en rentrant.",
         photo=(P + "life-quad-poster.jpg", "Sortie dans les environs de Marrakech"),
         puces=["À <b>10-15 min</b> de la ville", "Environ <b>1 h</b>",
                "Thé sous <b>la tente</b>", "Parfait en <b>famille</b>"],
         intro=[
             "La Palmeraie commence à quelques minutes du centre de Marrakech. On y monte à "
             "dromadaire pour une balade d'environ une heure entre les palmiers et les pistes de "
             "terre, généralement en fin d'après-midi, quand la lumière est belle et la chaleur "
             "supportable.",
             "C'est une activité courte, accessible à tous les âges, et facile à combiner avec "
             "autre chose dans la journée. Nous choisissons des prestataires attentifs à l'état "
             "des animaux — ce n'est malheureusement pas systématique.",
         ],
         cards=[("Balade d'environ une heure",
                 "Le format le plus courant, largement suffisant. Des sorties plus longues "
                 "existent pour ceux qui veulent s'enfoncer davantage dans la palmeraie."),
                ("Coucher de soleil",
                 "La fin d'après-midi est le meilleur créneau : lumière rasante entre les palmiers "
                 "et température agréable."),
                ("Thé sous la tente",
                 "La halte au thé à la menthe fait partie du rituel, souvent sous une tente "
                 "berbère installée dans la palmeraie."),
                ("Tenue traditionnelle",
                 "Beaucoup de prestataires proposent chèche et djellaba pour la balade : les "
                 "photos y gagnent, et les enfants adorent."),
                ("Bien-être des animaux",
                 "Nous travaillons avec des prestataires dont les animaux sont correctement "
                 "traités et les groupes limités. C'est un critère de sélection, pas un argument."),
                ("Transferts",
                 "Prise en charge à votre riad et retour : la Palmeraie est proche, mais les "
                 "accès ne sont pas évidents sans chauffeur.")],
         sections=[
             ("À combiner dans la journée", [
                 "La balade se glisse facilement en fin d'après-midi après une matinée dans les "
                 "souks ou une session de <a href=\"/quad-marrakech\">quad</a> : les deux "
                 "activités se pratiquent d'ailleurs souvent au même endroit.",
                 "Elle s'enchaîne très bien avec un dîner dans la Palmeraie ou avec le "
                 "<a href=\"/desert-agafay-marrakech\">désert d'Agafay</a> le lendemain, pour "
                 "varier les décors.",
             ]),
             ("Avec des enfants", [
                 "C'est l'une des rares activités que les tout-petits peuvent faire : la montée se "
                 "fait à l'arrêt, l'animal est tenu par un accompagnateur, et la balade reste "
                 "lente.",
                 "Prévoyez un chapeau, de l'eau et des vêtements longs et légers. Et acceptez que "
                 "les photos soient nombreuses.",
             ]),
         ],
         gallery=[(P + "life-quad-poster.jpg", "Sortie dans la palmeraie"),
                  (P + "activite-quad2-poster.jpg", "Quad dans la palmeraie"),
                  (P + "desert-pool.jpg", "Camp dans le désert"),
                  (P + "marrakech-menara.jpg", "Jardin de la Ménara"),
                  (P + "logement-riad-poster.jpg", "Riad à Marrakech"),
                  (P + "mercedes-van.jpg", "Transfert en van")],
         faq=[("Quelle est la durée de la balade ?",
               "Environ une heure pour la formule standard, hors transport. Des sorties plus "
               "longues sont possibles."),
              ("Est-ce accessible aux jeunes enfants ?",
               "Oui, la montée se fait à l'arrêt et l'animal est tenu par un accompagnateur "
               "pendant toute la balade."),
              ("À quel moment de la journée ?",
               "En fin d'après-midi de préférence, pour la lumière et la température. Le matin "
               "tôt fonctionne également en été."),
              ("Comment vous assurez-vous du traitement des animaux ?",
               "Nous ne travaillons qu'avec des prestataires que nous avons vus opérer : état des "
               "animaux, durée des rotations, taille des groupes. Si un partenaire ne convient "
               "plus, nous cessons de le proposer.")],
         liens=[("Quad", "/quad-marrakech"), ("Désert d'Agafay", "/desert-agafay-marrakech"),
                ("Montgolfière", "/montgolfiere-marrakech"),
                ("Riad privatisé", "/riad-prive-marrakech")],
         tagline="Balade à dromadaire dans la Palmeraie — "
                 "<span class=\"font-serif-italic\">une heure, au couchant</span>."),
]


def patch_hub() -> None:
    """Ajoute les nouvelles expériences au maillage du hub /activites-marrakech."""
    p = pathlib.Path(C.OUT / "activites-marrakech.html")
    s = p.read_text(encoding="utf-8")
    liens = "".join(f'<a href="/{a["slug"]}">{C.esc(a["nom"])}</a>' for a in A)
    bloc = f'<div class="zones" id="zonesmk" style="margin-top:14px">{liens}</div>'
    s = re.sub(r'<div class="zones" id="zonesmk".*?</div>', "", s, flags=re.S)
    s = re.sub(r'(<div class="zones"[^>]*>.*?</div>)', r"\1" + bloc, s, count=1, flags=re.S)
    p.write_text(s, encoding="utf-8")


def main() -> list:
    urls = [build(activite(a)) for a in A]
    patch_hub()
    print(f"Marrakech : {len(urls)} pages + maillage du hub /activites-marrakech")
    return urls


if __name__ == "__main__":
    main()
