# -*- coding: utf-8 -*-
"""Investissement immobilier à l'étranger : Marrakech et Dubaï.

Les règles juridiques et fiscales citées sont volontairement générales et
assorties d'un renvoi à un conseil local : nous sommes une conciergerie, pas un
cabinet juridique, et le droit évolue. Aucun rendement chiffré n'est promis.
"""
from __future__ import annotations

import seo_common as C
from gen_seo_services import build

NAV_MK = [("Marrakech", "/conciergerie-marrakech"), ("Activités", "/activites-marrakech"),
          ("Riad privatisé", "/riad-prive-marrakech"),
          ("Investir", "/investissement-locatif-marrakech")]
NAV_DXB = [("Dubaï", "/conciergerie-dubai"), ("Activités VIP", "/activites-vip-dubai"),
           ("Yacht", "/yacht-dubai"), ("Investir", "/investissement-immobilier-dubai")]

WHY = ("Pourquoi nous", [
    ("Nous sommes sur place",
     "Marrakech et Dubaï sont deux de nos destinations historiques. Nous y avons des "
     "partenaires que nous utilisons toute l'année, pas un carnet d'adresses acheté."),
    ("Le vrai calcul, pas le rendement de brochure",
     "Charges, taxes, vacance locative, gestion, frais de transaction et rapatriement : nous "
     "comptons tout avant de dire si un projet tient."),
    ("Nous gérons ensuite",
     "L'intérêt d'un investissement à distance dépend entièrement de la qualité de la gestion. "
     "C'est notre métier de départ."),
    ("Nous savons dire non",
     "Si votre projet ne tient pas, nous vous le dirons avant que vous versiez un acompte. "
     "Notre revenu vient de la gestion, pas d'une commission de vendeur."),
])

PAGES = [
    dict(slug="investissement-locatif-marrakech",
         title="Investir à Marrakech — riad, villa ou appartement, achat et gestion",
         desc="Investissement locatif à Marrakech : recherche de riad, villa ou appartement, "
              "vérifications juridiques, travaux, ameublement et gestion locative sur place. "
              "Accompagnement complet par une conciergerie implantée localement.",
         crumb="Investir à Marrakech",
         trail=[("Accueil", "/"), ("Marrakech", "/conciergerie-marrakech")],
         nav=NAV_MK,
         service_type="Accompagnement à l'investissement locatif à Marrakech", area="Marrakech",
         business=(" — Marrakech", "Marrakech", "Marrakech-Safi", "40000", "MA",
                   (31.6295, -7.9811), ["Marrakech", "Maroc"]),
         offers=["Recherche de bien", "Vérifications juridiques", "Coordination des travaux",
                 "Ameublement", "Mise en location", "Gestion locative"],
         badge="🏛️ Marrakech · Investissement",
         h1="Investir à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Riad dans la médina, villa à la Palmeraie ou appartement à Guéliz : nous cherchons, "
             "nous vérifions, nous rénovons et nous gérons. Depuis place, toute l'année.",
         photo=("real/logement-riad-poster.jpg", "Riad à Marrakech"),
         puces=["Riad · villa · <b>appartement</b>", "Vérifications <b>juridiques</b>",
                "Travaux <b>suivis</b>", "Gestion <b>sur place</b>"],
         cta="Parler de mon projet",
         intro=[
             "Marrakech attire les investisseurs français pour trois raisons : des prix d'entrée "
             "sans commune mesure avec la France, une demande locative touristique réelle toute "
             "l'année, et un climat qui rend les intersaisons vivantes. Les trois sont vraies. "
             "Elles ne suffisent pas à faire un bon investissement.",
             "Ce qui fait la différence, c'est le bien lui-même — son emplacement exact, son "
             "accès, son état réel — et surtout la gestion qui suivra. Un riad magnifique tenu "
             "par personne devient un gouffre en deux ans. Nous accompagnons l'achat, puis nous "
             "gérons.",
         ],
         cards=("Notre accompagnement à Marrakech", "De la recherche à la première réservation.", [
             ("Définition du projet",
              "Riad de rapport, villa familiale, appartement à revendre : l'objectif détermine "
              "le quartier, la taille et le budget de travaux."),
             ("Recherche et visites",
              "Nous visitons pour vous, en vidéo si vous êtes en France, et nous écartons vite "
              "ce qui ne passera pas les vérifications."),
             ("Vérifications juridiques",
              "Titre foncier, autorisations, conformité, servitudes, accès : rien ne s'engage "
              "sans le contrôle d'un notaire marocain et, si nécessaire, d'un avocat."),
             ("Travaux et rénovation",
              "Devis comparés, artisans locaux, suivi de chantier hebdomadaire avec photos : "
              "un chantier non surveillé à distance dérape systématiquement."),
             ("Ameublement et shooting",
              "Décoration, achats sur place, photos professionnelles : c'est ce qui détermine "
              "le prix par nuit que vous pourrez demander."),
             ("Gestion locative",
              "Annonce, prix, accueil des voyageurs, ménage, maintenance, comptes : notre métier "
              "d'origine, appliqué à votre bien."),
         ]),
         sections=[
             ("Médina, Guéliz, Palmeraie : trois marchés différents", [
                 "<strong>La médina</strong> concentre les riads : c'est le produit le plus "
                 "recherché des voyageurs, mais aussi le plus exigeant — accès à pied, humidité, "
                 "travaux dans des bâtiments anciens, règles de la médina classée.",
                 "<strong>Guéliz et l'Hivernage</strong> offrent des appartements modernes, plus "
                 "faciles à entretenir et à revendre, avec une clientèle mixte affaires et loisirs.",
                 "<strong>La Palmeraie et les routes d'Amizmiz ou de l'Ourika</strong> concentrent "
                 "les villas avec piscine, très demandées par les groupes et les familles — voir "
                 "notre <a href=\"/riad-prive-marrakech\">activité de privatisation</a>.",
             ]),
             ("Ce qu'il faut savoir avant d'acheter au Maroc", [
                 "Un étranger peut acquérir un bien immobilier au Maroc, à l'exception notable des "
                 "terrains agricoles. La transaction passe par un notaire ou un adoul, et le titre "
                 "foncier doit être vérifié : c'est le point le plus important, et celui que "
                 "certains vendeurs préfèrent survoler.",
                 "Pour préserver la possibilité de rapatrier plus tard le produit d'une vente ou "
                 "les revenus locatifs, l'investissement doit être réalisé en devises et déclaré "
                 "dans les formes prévues par la réglementation des changes marocaine. Cette étape "
                 "administrative, souvent négligée à l'achat, se paie très cher à la revente.",
                 "Enfin, un résident fiscal français reste imposable en France sur ses revenus "
                 "mondiaux, sous réserve de la convention fiscale entre les deux pays. "
                 "<em>Nous signalons ces points, nous ne les tranchons pas : notaire marocain et "
                 "conseil fiscal français ont le dernier mot.</em>",
             ]),
         ],
         gallery=[("real/logement-riad-poster.jpg", "Riad à Marrakech"),
                  ("real/logement-salon-poster.jpg", "Salon d'une maison marocaine"),
                  ("real/logement-chambre2-poster.jpg", "Chambre préparée"),
                  ("real/jacuzzi.jpg", "Espace bien-être"),
                  ("real/marrakech-menara.jpg", "Jardin de la Ménara"),
                  ("real/desert-pool.jpg", "Environs de Marrakech")],
         steps=("Le déroulé d'un projet", [
             ("1. Cadrage", "Objectif, budget, horizon, fiscalité : une heure d'échange pour savoir "
              "ce qu'on cherche."),
             ("2. Recherche", "Sélection et visites sur place, comptes rendus vidéo si vous êtes en France."),
             ("3. Sécurisation", "Vérifications juridiques, négociation, acte chez le notaire."),
             ("4. Livraison et gestion", "Travaux, ameublement, photos, mise en location, gestion."),
         ]),
         why=WHY,
         zones=("Marrakech", "",
                [("Conciergerie à Marrakech", "/conciergerie-marrakech"),
                 ("Riad privatisé", "/riad-prive-marrakech"),
                 ("Villa & riad de luxe", "/location-villa-marrakech"),
                 ("Activités à Marrakech", "/activites-marrakech"),
                 ("Investir à Dubaï", "/investissement-immobilier-dubai")],
                "Vous investissez plutôt en France ? Voir notre "
                "<a href=\"/investissement-locatif-paris\"><strong>investissement locatif à "
                "Paris</strong></a> et notre "
                "<a href=\"/gestion-locative-france\">gestion locative nationale</a>."),
         faq_title="Questions fréquentes — investir à Marrakech",
         faq=[
             ("Un étranger peut-il acheter au Maroc ?",
              "Oui, à l'exception des terrains agricoles. La transaction se fait devant notaire, "
              "avec vérification du titre foncier — étape sur laquelle nous ne transigeons jamais."),
             ("Pourra-t-on rapatrier l'argent d'une revente ?",
              "C'est possible si l'investissement initial a été réalisé en devises et déclaré "
              "selon la réglementation des changes en vigueur. C'est précisément pour cela que "
              "nous insistons sur cette formalité au moment de l'achat, et non après."),
             ("Quelle rentabilité peut-on espérer ?",
              "Nous ne publions pas de pourcentage : cela dépend du quartier, du type de bien, de "
              "la qualité de la rénovation et surtout de la gestion. Nous établissons une "
              "projection chiffrée sur des biens comparables réellement loués avant toute offre."),
             ("Faut-il être sur place pour gérer ?",
              "Non, à condition d'avoir un gestionnaire fiable. C'est le cœur du sujet : sans "
              "présence locale sérieuse, un bien à Marrakech se dégrade et se loue mal."),
             ("Gérez-vous les travaux ?",
              "Oui : devis comparés, artisans locaux, suivi hebdomadaire avec photos et validation "
              "de chaque engagement de dépense par vous."),
             ("Quelle fiscalité pour un résident français ?",
              "Les revenus doivent être déclarés en France, sous réserve de la convention fiscale "
              "franco-marocaine. Nous vous orientons vers un conseil fiscal : c'est son métier, "
              "pas le nôtre."),
         ],
         form=("Parlons de votre projet à Marrakech",
               "Budget, type de bien, objectif : décrivez-nous votre projet en quelques lignes, "
               "nous revenons avec un premier cadrage honnête.",
               "Marrakech", "Investissement immobilier"),
         footer=[("Marrakech", [("Conciergerie à Marrakech", "/conciergerie-marrakech"),
                                ("Riad privatisé", "/riad-prive-marrakech"),
                                ("Villa & riad de luxe", "/location-villa-marrakech"),
                                ("Activités", "/activites-marrakech"),
                                ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")]),
                 ("Investir", [("Investir à Dubaï", "/investissement-immobilier-dubai"),
                               ("Investissement locatif Paris", "/investissement-locatif-paris"),
                               ("Gestion locative France", "/gestion-locative-france"),
                               ("Estimation de rentabilité", "/estimation-rentabilite-airbnb"),
                               ("Accueil", "/")])],
         tagline="Investir à Marrakech — acheter, rénover et "
                 "<span class=\"font-serif-italic\">faire gérer sur place</span>.",
         lieu="Marrakech · Maroc",
         mobcta="Parler de mon projet"),

    dict(slug="investissement-immobilier-dubai",
         title="Investir à Dubaï — achat immobilier, freehold et gestion locative",
         desc="Investissement immobilier à Dubaï : zones freehold, sélection du bien, "
              "vérifications, frais réels d'acquisition et gestion locative sur place. "
              "Accompagnement par une conciergerie implantée à Dubaï.",
         crumb="Investir à Dubaï",
         trail=[("Accueil", "/"), ("Dubaï", "/conciergerie-dubai")],
         nav=NAV_DXB,
         service_type="Accompagnement à l'investissement immobilier à Dubaï", area="Dubaï",
         business=(" — Dubaï", "Dubaï", "Dubaï", "", "AE", (25.2048, 55.2708),
                   ["Dubaï", "Émirats arabes unis"]),
         offers=["Recherche de bien", "Analyse du marché", "Vérifications",
                 "Ameublement", "Mise en location", "Gestion locative"],
         badge="🌇 Dubaï · Investissement",
         h1="Investir à <span class=\"font-serif-italic\">Dubaï</span>",
         sub="Marché liquide, fiscalité locale légère, demande locative forte — et beaucoup de "
             "promesses commerciales. Nous vous aidons à faire le tri, puis nous gérons le bien.",
         photo=("real/dubai-skyline.jpg", "Skyline de Dubaï"),
         puces=["Zones <b>freehold</b>", "Frais <b>réels</b> annoncés",
                "Gestion <b>sur place</b>", "Aucune <b>promesse</b> creuse"],
         cta="Parler de mon projet",
         intro=[
             "Dubaï est devenu, en quelques années, l'un des marchés les plus démarchés auprès des "
             "investisseurs français. Les arguments avancés sont souvent exacts — croissance de la "
             "population, absence d'impôt local sur le revenu des particuliers, forte demande "
             "locative — mais ils s'accompagnent rarement du détail des frais et des risques.",
             "Nous sommes implantés à Dubaï pour notre activité de conciergerie — voir notre "
             "<a href=\"/conciergerie-dubai\">page Dubaï</a>. Nous accompagnons l'acquisition avec "
             "la même règle qu'ailleurs : le calcul complet d'abord, la décision ensuite.",
         ],
         cards=("Notre accompagnement à Dubaï", "Sélection, vérification, gestion.", [
             ("Cadrage du projet",
              "Objectif de revenu ou de plus-value, horizon, budget, financement : cela détermine "
              "le quartier et le type de bien, bien plus que les brochures."),
             ("Sélection du bien",
              "Neuf sur plan ou revente, tour résidentielle ou villa : nous comparons sur des "
              "critères concrets — étage, exposition, vis-à-vis, charges de la copropriété."),
             ("Vérifications",
              "Statut freehold du secteur, promoteur, calendrier de livraison, charges annuelles, "
              "état du bien en revente. Rien ne se signe sur une plaquette."),
             ("Coûts complets",
              "Frais d'enregistrement auprès du Dubai Land Department, honoraires d'agence, "
              "charges de service annuelles, ameublement : le rendement net n'a rien à voir avec "
              "le rendement brut affiché."),
             ("Ameublement et mise en location",
              "À Dubaï, un bien meublé avec goût se loue nettement mieux. Nous préparons le "
              "logement et nous le photographions."),
             ("Gestion locative",
              "Courte durée pour les secteurs touristiques, longue durée ailleurs : nous "
              "arbitrons et nous gérons au quotidien."),
         ]),
         sections=[
             ("Ce que « pas d'impôt » veut dire — et ne veut pas dire", [
                 "Les Émirats n'appliquent pas d'impôt sur le revenu des particuliers, ce qui "
                 "explique une large part de l'attrait du marché. Cela ne signifie pas absence de "
                 "coûts : frais d'enregistrement au moment de l'acquisition, charges de service "
                 "annuelles parfois élevées dans les tours, frais d'agence et de gestion.",
                 "Surtout, un <strong>résident fiscal français</strong> reste imposable en France "
                 "sur ses revenus mondiaux, sous réserve de la convention fiscale applicable. "
                 "L'économie fiscale réelle dépend donc entièrement de votre résidence fiscale — "
                 "et c'est une question pour votre conseil, pas pour un vendeur de programme.",
             ]),
             ("Neuf sur plan ou revente ?", [
                 "<strong>Le neuf sur plan</strong> séduit par ses échéanciers de paiement étalés "
                 "et ses prix d'entrée. Il expose en contrepartie au risque de retard de livraison "
                 "et à une offre abondante au moment où le bien arrive sur le marché locatif.",
                 "<strong>La revente</strong> permet de voir ce que l'on achète, de connaître les "
                 "charges réelles et de louer immédiatement. C'est souvent le choix le plus sain "
                 "pour un premier investissement à distance.",
             ]),
         ],
         gallery=[("real/dubai-skyline.jpg", "Skyline de Dubaï"),
                  ("real/dubai-marina.jpg", "Dubaï Marina"),
                  ("real/dubai-palace.jpg", "Résidence de luxe à Dubaï"),
                  ("real/residence-penthouse.jpg", "Penthouse meublé"),
                  ("real/logement-suite.jpg", "Intérieur meublé pour la location"),
                  ("real/golf-dubai.jpg", "Golf à Dubaï")],
         steps=("Le déroulé d'un projet", [
             ("1. Cadrage", "Objectif, budget, résidence fiscale, horizon de détention."),
             ("2. Sélection", "Biens comparés sur critères concrets, visites ou visites vidéo."),
             ("3. Vérification et achat", "Contrôles, coûts complets, enregistrement de la transaction."),
             ("4. Location et gestion", "Ameublement, photos, mise en marché, gestion au quotidien."),
         ]),
         why=WHY,
         zones=("Dubaï", "",
                [("Conciergerie à Dubaï", "/conciergerie-dubai"),
                 ("Location de villa à Dubaï", "/location-villa-dubai"),
                 ("Chauffeur privé", "/chauffeur-prive-dubai"),
                 ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai"),
                 ("Investir à Marrakech", "/investissement-locatif-marrakech")],
                "Pour un investissement en France, voir notre "
                "<a href=\"/investissement-locatif-paris\"><strong>investissement locatif à "
                "Paris</strong></a>."),
         faq_title="Questions fréquentes — investir à Dubaï",
         faq=[
             ("Un étranger peut-il acheter à Dubaï ?",
              "Oui, en pleine propriété dans les zones dites freehold, qui couvrent une grande "
              "partie des secteurs recherchés. Nous vérifions systématiquement le statut du "
              "secteur avant toute offre."),
             ("Quels frais faut-il prévoir à l'achat ?",
              "Des frais d'enregistrement auprès du Dubai Land Department, des honoraires "
              "d'agence, et des charges de service annuelles qui varient fortement d'une "
              "résidence à l'autre. Nous les chiffrons avant que vous décidiez."),
             ("Y a-t-il vraiment zéro impôt ?",
              "Il n'y a pas d'impôt local sur le revenu des particuliers. En revanche, si vous "
              "êtes résident fiscal français, vos revenus restent à déclarer en France sous "
              "réserve de la convention applicable. Faites valider votre situation par un conseil "
              "fiscal."),
             ("Neuf sur plan ou revente ?",
              "Pour un premier investissement à distance, nous recommandons généralement la "
              "revente : on voit le bien, on connaît les charges, et il se loue tout de suite."),
             ("Assurez-vous la gestion ?",
              "Oui, c'est notre métier d'origine et la condition pour qu'un investissement à "
              "distance tienne dans la durée."),
             ("Quelle rentabilité annoncez-vous ?",
              "Aucune à l'avance. Nous établissons une projection à partir de biens comparables "
              "réellement loués, charges et vacance déduites, et nous vous la présentons avant "
              "toute décision."),
         ],
         form=("Parlons de votre projet à Dubaï",
               "Budget, objectif, résidence fiscale, horizon : nous revenons vers vous avec un "
               "cadrage et les coûts réels.",
               "Dubaï", "Investissement immobilier"),
         footer=[("Dubaï", [("Conciergerie à Dubaï", "/conciergerie-dubai"),
                            ("Location de villa", "/location-villa-dubai"),
                            ("Activités VIP", "/activites-vip-dubai"),
                            ("Yacht", "/yacht-dubai"),
                            ("Van avec chauffeur", "/van-avec-chauffeur-dubai")]),
                 ("Investir", [("Investir à Marrakech", "/investissement-locatif-marrakech"),
                               ("Investissement locatif Paris", "/investissement-locatif-paris"),
                               ("Gestion locative France", "/gestion-locative-france"),
                               ("Estimation de rentabilité", "/estimation-rentabilite-airbnb"),
                               ("Accueil", "/")])],
         tagline="Investir à Dubaï — le calcul complet, "
                 "<span class=\"font-serif-italic\">puis la gestion</span>.",
         lieu="Dubaï · Émirats arabes unis",
         mobcta="Parler de mon projet"),
]


def main() -> list:
    urls = [build(s) for s in PAGES]
    print(f"Investissement : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
