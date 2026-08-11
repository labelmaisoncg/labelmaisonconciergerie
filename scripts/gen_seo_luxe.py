# -*- coding: utf-8 -*-
"""Silos SEO horlogerie et transport en van VIP.

Horlogerie : nous sommes une conciergerie, pas une maison de vente. Les textes
disent donc exactement ce que nous faisons — recherche, mise en relation,
accompagnement de la transaction, authentification par un horloger partenaire
indépendant — sans jamais promettre une expertise que nous n'exerçons pas
nous-mêmes, ni afficher de prix inventés.
"""
from __future__ import annotations

import seo_common as C
from gen_seo_services import build, NAV_LUXE

NAV_VAN = [("Van avec chauffeur", "/van-avec-chauffeur-paris"),
           ("Transferts aéroport", "/navette-aeroport-paris"),
           ("Chauffeur privé Paris", "/chauffeur-prive-paris"),
           ("Conciergerie privée", "/conciergerie-privee-paris")]

FOOT_MONTRE = [("Horlogerie", [("Achat & vente de montres de luxe", "/achat-vente-montres-de-luxe"),
                               ("Vendre sa montre à Paris", "/vendre-sa-montre-de-luxe-paris"),
                               ("Acheter une Rolex à Paris", "/acheter-une-rolex-paris"),
                               ("Estimation de montre", "/estimation-montre-de-luxe"),
                               ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai")]),
               ("Conciergerie", [("Personal shopper Paris", "/personal-shopper-paris"),
                                 ("Conciergerie privée Paris", "/conciergerie-privee-paris"),
                                 ("Conciergerie Dubaï", "/conciergerie-dubai"),
                                 ("Conciergerie Marrakech", "/conciergerie-marrakech"),
                                 ("Accueil", "/")])]

FOOT_VAN = [("Transport", [("Van avec chauffeur Paris", "/van-avec-chauffeur-paris"),
                           ("Navette aéroport Paris", "/navette-aeroport-paris"),
                           ("Van pour mariage et événement", "/van-avec-chauffeur-mariage"),
                           ("Van avec chauffeur Marrakech", "/van-avec-chauffeur-marrakech"),
                           ("Van avec chauffeur Dubaï", "/van-avec-chauffeur-dubai")]),
            ("Conciergerie", [("Chauffeur privé Paris", "/chauffeur-prive-paris"),
                              ("Chauffeur privé Marrakech", "/chauffeur-prive-marrakech"),
                              ("Chauffeur privé Dubaï", "/chauffeur-prive-dubai"),
                              ("Conciergerie privée Paris", "/conciergerie-privee-paris"),
                              ("Accueil", "/")])]

WHY_MONTRE = ("Pourquoi passer par nous", [
    ("Nous cherchons, vous décidez",
     "Nous ne vendons pas notre stock : nous cherchons la pièce que vous voulez, au meilleur "
     "prix disponible, et nous vous présentons les options avec leurs défauts."),
    ("Transaction encadrée",
     "Vérification du vendeur, authentification par un horloger indépendant, paiement sécurisé, "
     "facture et documents : chaque étape est tracée."),
    ("Discrétion",
     "Aucun nom, aucune pièce, aucune transaction n'est communiquée. C'est la première exigence "
     "de nos clients, et la nôtre."),
    ("Un réseau, pas une vitrine",
     "Détaillants, courtiers, collectionneurs, maisons de vente : nous activons plusieurs canaux "
     "en parallèle, en France comme à l'étranger."),
])

WHY_VAN = ("Pourquoi choisir notre service de van", [
    ("Un chauffeur, pas un forfait anonyme",
     "Le même chauffeur pendant toute la durée de votre mise à disposition, qui connaît votre "
     "programme et vos horaires."),
    ("Bagages et groupes",
     "Là où une berline oblige à commander deux voitures, un van transporte le groupe et les "
     "valises ensemble — moins cher et plus simple."),
    ("Ponctualité surveillée",
     "Vols suivis en temps réel, marges prévues pour le trafic francilien : nous sommes là avant vous."),
    ("Devis ferme",
     "Le prix est convenu à l'avance selon le trajet et la durée. Pas de compteur, pas de "
     "majoration surprise."),
])

PAGES = [
    # ------------------------------------------------------------- Horlogerie
    dict(slug="achat-vente-montres-de-luxe",
         title="Achat et vente de montres de luxe — Rolex, Audemars Piguet, Patek Philippe",
         desc="Achat et vente de montres de luxe accompagnés : recherche de pièces rares, "
              "estimation, authentification par horloger indépendant, transaction sécurisée et "
              "discrète. Paris, Dubaï, Marrakech.",
         crumb="Montres de luxe",
         trail=[("Accueil", "/"), ("Personal shopping", "/personal-shopper-paris")],
         nav=NAV_LUXE,
         service_type="Recherche, achat et vente accompagnés de montres de luxe",
         area="France",
         business=(" — Horlogerie", "Paris", "Île-de-France", "75008", "FR", (48.8698, 2.3079),
                   ["Paris", "France", "Dubaï", "Marrakech"]),
         offers=["Recherche de montre", "Accompagnement à l'achat", "Accompagnement à la vente",
                 "Estimation", "Authentification par horloger partenaire"],
         badge="⌚ Horlogerie · Achat & vente",
         h1="Achat et vente de <span class=\"font-serif-italic\">montres de luxe</span>",
         sub="Vous cherchez une pièce précise, ou vous voulez vendre au bon prix sans y passer six "
             "mois ? Nous cherchons, nous vérifions, nous sécurisons la transaction.",
         photo=("real/rolex-coffret.jpg", "Montre de luxe présentée dans son coffret"),
         puces=["Recherche <b>ciblée</b>", "Authentification <b>indépendante</b>",
                "Paiement <b>sécurisé</b>", "Discrétion <b>totale</b>"],
         cta="Décrire ma recherche",
         intro=[
             "Le marché des montres de luxe est le plus opaque du secteur du luxe. Les pièces les "
             "plus demandées ne sont jamais en vitrine, les listes d'attente des concessionnaires "
             "sont réservées aux clients historiques, et le marché secondaire mélange des "
             "professionnels sérieux, des particuliers pressés et des contrefaçons de très bon niveau.",
             "Nous ne sommes ni horloger, ni maison de vente : nous sommes une conciergerie. "
             "Concrètement, nous cherchons la pièce que vous voulez à travers notre réseau, nous "
             "faisons vérifier son authenticité et son état par un horloger indépendant, et nous "
             "encadrons la transaction jusqu'au paiement et à la remise des documents.",
         ],
         cards=("Notre accompagnement", "À l'achat comme à la vente.", [
             ("Recherche de pièce",
              "Modèle, référence, année, état, présence de la boîte et des papiers : nous partons "
              "de votre cahier des charges, pas de ce qu'il y a en stock quelque part."),
             ("Estimation avant décision",
              "Nous situons la pièce sur le marché réel — transactions récentes comparables — pour "
              "que vous sachiez si le prix demandé tient debout."),
             ("Authentification",
              "Contrôle par un horloger indépendant : mouvement, numéros, cohérence des composants, "
              "état de service. Le rapport vous est remis."),
             ("Accompagnement à la vente",
              "Nous présentons votre pièce à plusieurs acheteurs — professionnels, collectionneurs, "
              "maisons de vente — pour faire jouer la concurrence au lieu d'accepter la première offre."),
             ("Transaction sécurisée",
              "Vérification des parties, paiement tracé, facture, remise en main propre ou transport "
              "assuré selon la valeur."),
             ("Confidentialité",
              "Aucune pièce, aucun nom, aucun montant ne sortent du dossier. Ni sur nos réseaux, "
              "ni ailleurs."),
         ]),
         sections=[
             ("Ce que nous cherchons le plus souvent", [
                 "Les demandes qui reviennent : <strong>Rolex</strong> (Submariner, GMT-Master II, "
                 "Daytona, Datejust, Explorer), <strong>Audemars Piguet</strong> Royal Oak, "
                 "<strong>Patek Philippe</strong> Nautilus et Aquanaut, <strong>Cartier</strong> "
                 "Santos et Tank, <strong>Omega</strong> Speedmaster.",
                 "Sur les références les plus tendues, la question n'est pas le prix mais la "
                 "disponibilité réelle : c'est là qu'un réseau vaut plus qu'un budget. Voir aussi "
                 "notre page <a href=\"/acheter-une-rolex-paris\"><strong>acheter une Rolex à "
                 "Paris</strong></a>.",
             ]),
             ("Vendre sans se faire avoir", [
                 "Un particulier qui vend seul commet presque toujours la même erreur : il accepte "
                 "la première offre d'un professionnel, parce qu'elle est immédiate. L'écart entre "
                 "cette offre et le prix réellement atteignable est rarement anecdotique.",
                 "Notre méthode est simple : mise en concurrence de plusieurs acheteurs, "
                 "documentation complète de la pièce, et un délai raisonnable. Détail sur notre page "
                 "<a href=\"/vendre-sa-montre-de-luxe-paris\"><strong>vendre sa montre de luxe à "
                 "Paris</strong></a>.",
             ]),
             ("Acheter à l'étranger : les précautions", [
                 "Dubaï attire par ses prix affichés, mais une montre achetée hors Union européenne "
                 "et rapportée en France est soumise aux droits et taxes à l'importation, à déclarer "
                 "en douane. L'économie réelle est souvent bien inférieure à l'économie apparente.",
                 "Nous vous disons franchement quand l'opération vaut le coup et quand elle ne le "
                 "vaut pas. Voir notre page <a href=\"/montres-de-luxe-dubai\">montres de luxe à "
                 "Dubaï</a>.",
             ]),
         ],
         gallery=[("real/rolex-coffret.jpg", "Montre de luxe dans son coffret"),
                  ("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master"),
                  ("real/rolex-gmt-poignet.jpg", "Rolex GMT portée au poignet"),
                  ("real/montre-rolex-datejust.jpeg", "Rolex Datejust"),
                  ("real/montre-rolex-datejust-bleue.png", "Rolex Datejust à cadran bleu"),
                  ("real/shopping-montre2-poster.jpg", "Montre remise à un client")],
         steps=("Comment se déroule une recherche", [
             ("1. Votre cahier des charges", "Modèle, référence, état, budget, délai acceptable."),
             ("2. Sourcing", "Nous activons notre réseau en France et à l'étranger, en parallèle."),
             ("3. Vérification", "Authentification indépendante, contrôle des documents et de l'historique."),
             ("4. Transaction", "Négociation, paiement sécurisé, remise et facture."),
         ]),
         why=WHY_MONTRE,
         zones=("Horlogerie et personal shopping", "",
                [("Vendre sa montre à Paris", "/vendre-sa-montre-de-luxe-paris"),
                 ("Acheter une Rolex à Paris", "/acheter-une-rolex-paris"),
                 ("Estimation de montre", "/estimation-montre-de-luxe"),
                 ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai"),
                 ("Personal shopper à Paris", "/personal-shopper-paris")],
                "Nous accompagnons aussi la recherche de <strong>joaillerie</strong> et de "
                "<strong>maroquinerie</strong> rare : voir notre "
                "<a href=\"/personal-shopper-paris\">personal shopping</a>."),
         faq_title="Questions fréquentes — achat et vente de montres de luxe",
         faq=[
             ("Êtes-vous horloger ou revendeur ?",
              "Ni l'un ni l'autre : nous sommes une conciergerie. Nous cherchons, nous mettons en "
              "relation, nous faisons authentifier par un horloger indépendant et nous sécurisons "
              "la transaction. Nous n'avons pas de stock à écouler, donc aucun intérêt à vous "
              "orienter vers une pièce plutôt qu'une autre."),
             ("Comment êtes-vous rémunérés ?",
              "Par des honoraires d'accompagnement convenus à l'avance, en pourcentage ou au "
              "forfait selon le dossier. Ils vous sont annoncés avant toute recherche."),
             ("Comment vérifiez-vous l'authenticité ?",
              "Par un horloger indépendant : contrôle du mouvement, des numéros, de la cohérence "
              "des composants et de l'état de service. Le rapport vous est remis avant l'achat."),
             ("Combien de temps pour trouver une pièce ?",
              "De quelques jours pour un modèle courant à plusieurs mois pour une référence très "
              "recherchée. Nous vous donnons un délai réaliste dès le départ, et nous le disons "
              "quand une demande est irréaliste."),
             ("Intervenez-vous hors de Paris ?",
              "Oui, partout en France, ainsi qu'à <a href=\"/conciergerie-dubai\">Dubaï</a> et "
              "<a href=\"/conciergerie-marrakech\">Marrakech</a> où nous sommes implantés."),
             ("Puis-je vous confier une montre en dépôt ?",
              "Nous étudions chaque situation au cas par cas, avec un contrat écrit et une "
              "assurance adaptée à la valeur de la pièce."),
         ],
         form=("Dites-nous ce que vous cherchez — ou ce que vous vendez",
               "Modèle, référence si vous la connaissez, budget ou prix attendu : nous revenons "
               "vers vous avec une première analyse du marché.",
               "Paris", "Montre de luxe"),
         footer=FOOT_MONTRE,
         tagline="Achat et vente accompagnés de montres de luxe — recherche, authentification, "
                 "<span class=\"font-serif-italic\">transaction sécurisée</span>.",
         lieu="Paris · Dubaï · Marrakech",
         mobcta="Décrire ma recherche"),

    dict(slug="vendre-sa-montre-de-luxe-paris",
         title="Vendre sa montre de luxe à Paris — Rolex, AP, Patek : au bon prix, en sécurité",
         desc="Vendre sa montre de luxe à Paris : estimation, mise en concurrence de plusieurs "
              "acheteurs, authentification indépendante, paiement sécurisé et discrétion totale. "
              "Rolex, Audemars Piguet, Patek Philippe, Cartier.",
         crumb="Vendre sa montre",
         trail=[("Accueil", "/"), ("Montres de luxe", "/achat-vente-montres-de-luxe")],
         nav=NAV_LUXE,
         service_type="Accompagnement à la vente de montres de luxe à Paris", area="Paris",
         business=(" — Vente de montres", "Paris", "Île-de-France", "75008", "FR",
                   (48.8698, 2.3079), ["Paris", "Île-de-France"]),
         badge="⌚ Paris · Vendre sa montre",
         h1="Vendre sa <span class=\"font-serif-italic\">montre de luxe</span> à Paris",
         sub="La première offre n'est presque jamais la meilleure. Nous documentons votre pièce, "
             "nous mettons plusieurs acheteurs en concurrence et nous sécurisons le paiement.",
         photo=("real/proof-montre-poster.jpg", "Montre de luxe photographiée avant transaction"),
         puces=["Plusieurs <b>acheteurs</b>", "Authentification <b>incluse</b>",
                "Paiement <b>tracé</b>", "Discrétion <b>totale</b>"],
         cta="Faire estimer ma montre",
         intro=[
             "Vendre une montre de valeur pose trois problèmes : savoir ce qu'elle vaut vraiment, "
             "trouver un acheteur sérieux, et ne pas se faire piéger au moment du paiement. Les "
             "trois se règlent avec de la méthode — et un peu de patience.",
             "Nous accompagnons des particuliers qui vendent une pièce unique comme des "
             "collectionneurs qui arbitrent leur collection. Notre rôle : documenter, mettre en "
             "concurrence, et sécuriser. Vous décidez, toujours.",
         ],
         cards=("Comment nous vendons votre montre", "Méthode, pas improvisation.", [
             ("Estimation de marché",
              "Nous situons votre pièce à partir des transactions comparables récentes, pas d'un "
              "prix de vitrine ni d'une cote théorique."),
             ("Dossier complet",
              "Photos professionnelles, références, historique d'entretien, boîte et papiers : "
              "une pièce bien documentée se vend nettement mieux."),
             ("Authentification",
              "Contrôle par un horloger indépendant avant présentation aux acheteurs : cela lève "
              "l'argument de négociation le plus utilisé contre les vendeurs particuliers."),
             ("Mise en concurrence",
              "Professionnels, collectionneurs, maisons de vente : plusieurs offres, comparées "
              "devant vous, avec nos commentaires."),
             ("Paiement sécurisé",
              "Vérification de l'acheteur, paiement tracé, remise contre justificatif : la montre "
              "ne part jamais avant que l'argent soit là."),
             ("Confidentialité",
              "Ni votre nom ni la pièce ne circulent publiquement. Les acheteurs sont contactés "
              "individuellement."),
         ]),
         sections=[
             ("Ce qui fait varier le prix de votre montre", [
                 "<strong>La référence.</strong> Deux modèles voisins peuvent avoir des cotes très "
                 "différentes selon la génération, le cadran ou le millésime.",
                 "<strong>La boîte et les papiers.</strong> Leur présence change sensiblement la "
                 "valeur, surtout sur les pièces recherchées.",
                 "<strong>L'état et l'entretien.</strong> Un polissage excessif peut faire perdre "
                 "de la valeur : mieux vaut ne rien faire avant de nous montrer la pièce.",
                 "<strong>Le moment.</strong> Le marché secondaire connaît des cycles. Sur certaines "
                 "références, attendre quelques mois change le résultat — nous vous le dirons.",
             ]),
             ("Les pièges les plus fréquents", [
                 "L'offre « ferme, aujourd'hui seulement » qui pousse à décider vite ; le paiement "
                 "par virement annoncé mais non arrivé au moment de la remise ; l'acheteur qui veut "
                 "« faire vérifier » la montre en l'emportant.",
                 "Aucune de ces situations n'a lieu d'être quand la transaction est encadrée. C'est "
                 "précisément ce que nous apportons.",
             ]),
         ],
         gallery=[("real/proof-montre-poster.jpg", "Montre de luxe avant transaction"),
                  ("real/proof-montre-client-poster.jpg", "Remise d'une montre à un client"),
                  ("real/rolex-coffret.jpg", "Montre dans son coffret d'origine"),
                  ("real/montre-rolex-datejust.jpeg", "Rolex Datejust"),
                  ("real/rolex-gmt-poignet.jpg", "Rolex GMT au poignet"),
                  ("real/shopping-montre2-poster.jpg", "Montre présentée à un client")],
         steps=("Le déroulé d'une vente", [
             ("1. Premier échange", "Photos et références par message : nous donnons une fourchette "
              "indicative sous 24 à 48 h."),
             ("2. Expertise", "Rendez-vous à Paris, authentification par notre horloger partenaire."),
             ("3. Mise en concurrence", "Présentation à plusieurs acheteurs, offres comparées."),
             ("4. Vente", "Paiement sécurisé, remise, facture. Vous validez à chaque étape."),
         ]),
         why=WHY_MONTRE,
         zones=("Aller plus loin", "",
                [("Achat & vente de montres", "/achat-vente-montres-de-luxe"),
                 ("Estimation de montre", "/estimation-montre-de-luxe"),
                 ("Acheter une Rolex à Paris", "/acheter-une-rolex-paris"),
                 ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai"),
                 ("Personal shopper Paris", "/personal-shopper-paris")],
                "Vous cherchez aussi à acheter ? Voir "
                "<a href=\"/acheter-une-rolex-paris\"><strong>acheter une Rolex à Paris</strong></a>."),
         faq_title="Questions fréquentes — vendre sa montre de luxe",
         faq=[
             ("Achetez-vous la montre vous-mêmes ?",
              "Non. Nous vous représentons face aux acheteurs : c'est ce qui garantit que nous "
              "cherchons le prix le plus haut, et non le plus bas."),
             ("Combien de temps prend une vente ?",
              "Souvent quelques jours à quelques semaines selon la référence. Les pièces très "
              "recherchées partent vite ; les modèles plus confidentiels demandent de la patience."),
             ("Dois-je faire réviser ou polir ma montre avant ?",
              "Surtout pas sans nous en parler : un polissage mal fait peut faire perdre de la "
              "valeur, en particulier sur les pièces de collection."),
             ("Et si je n'ai plus la boîte ni les papiers ?",
              "La vente reste possible : cela pèse sur le prix, dans des proportions variables "
              "selon la référence. Nous vous le chiffrons honnêtement."),
             ("Où se passe le rendez-vous ?",
              "À Paris, dans un cadre sécurisé. Pour les pièces de valeur importante, nous "
              "organisons un transport assuré."),
             ("Quelle discrétion garantissez-vous ?",
              "Totale : rien n'est publié, aucun nom n'est communiqué, et les acheteurs sont "
              "contactés individuellement."),
         ],
         form=("Faites estimer votre montre",
               "Modèle, référence, année, présence de la boîte et des papiers : envoyez-nous ces "
               "informations, nous revenons avec une fourchette de marché.",
               "Paris", "Vente de montre"),
         footer=FOOT_MONTRE,
         tagline="Vendre sa montre de luxe à Paris — plusieurs acheteurs, "
                 "<span class=\"font-serif-italic\">un seul intermédiaire</span>.",
         lieu="Paris · Île-de-France",
         mobcta="Faire estimer ma montre"),

    dict(slug="acheter-une-rolex-paris",
         title="Acheter une Rolex à Paris — recherche de modèle, marché secondaire, sécurité",
         desc="Acheter une Rolex à Paris : recherche du modèle recherché (Submariner, GMT, Daytona, "
              "Datejust), accès au marché secondaire, authentification indépendante et transaction "
              "sécurisée par votre conciergerie.",
         crumb="Acheter une Rolex",
         trail=[("Accueil", "/"), ("Montres de luxe", "/achat-vente-montres-de-luxe")],
         nav=NAV_LUXE,
         service_type="Recherche et acquisition de montres Rolex à Paris", area="Paris",
         business=(" — Rolex Paris", "Paris", "Île-de-France", "75008", "FR", (48.8698, 2.3079),
                   ["Paris", "Île-de-France"]),
         badge="⌚ Paris · Rolex",
         h1="Acheter une <span class=\"font-serif-italic\">Rolex</span> à Paris",
         sub="Les modèles les plus demandés ne sont pas en vitrine. Nous les cherchons sur le "
             "marché secondaire, nous les faisons authentifier, et nous sécurisons l'achat.",
         photo=("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master"),
         puces=["Submariner · <b>GMT</b> · Daytona", "Marché <b>secondaire</b>",
                "Authentification <b>indépendante</b>", "Achat <b>sécurisé</b>"],
         cta="Chercher ma Rolex",
         intro=[
             "Entrer dans une concession et repartir avec une Submariner ou une Daytona relève de "
             "l'exception : les modèles acier les plus demandés sont attribués à des clients "
             "historiques, et les listes d'attente ne sont pas des files d'attente.",
             "Le marché secondaire est donc la voie réaliste. Encore faut-il y naviguer : prix "
             "très dispersés, pièces recomposées, contrefaçons de bon niveau, vendeurs pressés. "
             "Notre rôle est de trouver la bonne pièce, de la faire vérifier et de sécuriser "
             "l'opération.",
         ],
         cards=("Notre accompagnement à l'achat", "De la référence recherchée à la remise en main propre.", [
             ("Définition précise",
              "Référence exacte, génération, cadran, année, état accepté, boîte et papiers "
              "souhaités ou non : plus le cahier des charges est net, plus la recherche est rapide."),
             ("Sourcing multi-canal",
              "Détaillants, courtiers, collectionneurs, maisons de vente, en France et à l'étranger : "
              "nous ne dépendons pas d'une seule source."),
             ("Analyse de prix",
              "Nous situons chaque offre par rapport aux transactions comparables récentes, pour "
              "que vous sachiez si le prix est cohérent."),
             ("Authentification",
              "Contrôle par un horloger indépendant avant tout paiement : mouvement, numéros, "
              "cohérence des composants, historique."),
             ("Négociation",
              "Nous discutons le prix sur des arguments concrets — état, service à prévoir, "
              "absence de papiers — pas au feeling."),
             ("Transaction sécurisée",
              "Paiement tracé, facture, remise en main propre ou transport assuré selon la valeur."),
         ]),
         sections=[
             ("Les modèles que l'on nous demande le plus", [
                 "<strong>Submariner</strong> : la référence absolue, en date ou no-date, acier ou "
                 "or. <strong>GMT-Master II</strong> : très demandée dans ses versions bicolores. "
                 "<strong>Daytona</strong> : la plus difficile à obtenir en acier. "
                 "<strong>Datejust</strong> : la plus polyvalente, avec une offre bien plus large. "
                 "<strong>Explorer</strong> et <strong>Oyster Perpetual</strong> : les portes "
                 "d'entrée les plus sensées.",
                 "Sur les trois premières, la disponibilité prime sur le prix. Sur les autres, il "
                 "y a de vraies affaires à faire pour qui prend le temps de comparer — et c'est "
                 "exactement le temps que nous vous faisons gagner.",
             ]),
             ("Neuf, occasion, vintage : que choisir ?", [
                 "Une pièce récente avec boîte et papiers offre la plus grande liquidité à la "
                 "revente. Une pièce d'occasion bien entretenue permet d'accéder à des références "
                 "autrement inaccessibles.",
                 "Le vintage est un autre métier : l'originalité des composants y détermine "
                 "l'essentiel de la valeur, et une pièce « trop belle » est souvent une pièce "
                 "recomposée. Nous ne nous engageons sur ce terrain qu'avec l'avis de notre "
                 "horloger partenaire.",
             ]),
         ],
         gallery=[("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master"),
                  ("real/rolex-gmt-poignet.jpg", "Rolex GMT au poignet"),
                  ("real/montre-rolex-datejust.jpeg", "Rolex Datejust"),
                  ("real/montre-rolex-datejust-bleue.png", "Rolex Datejust cadran bleu"),
                  ("real/rolex-coffret.jpg", "Montre dans son coffret"),
                  ("real/proof-montre-client-poster.jpg", "Remise d'une montre à un client")],
         steps=("Comment se passe une recherche", [
             ("1. Brief", "Référence, budget, délai, exigences sur l'état et les documents."),
             ("2. Recherche", "Activation du réseau, présélection avec prix et défauts signalés."),
             ("3. Vérification", "Authentification indépendante avant tout engagement."),
             ("4. Acquisition", "Négociation, paiement sécurisé, remise et facture."),
         ]),
         why=WHY_MONTRE,
         zones=("Horlogerie", "",
                [("Achat & vente de montres", "/achat-vente-montres-de-luxe"),
                 ("Vendre sa montre à Paris", "/vendre-sa-montre-de-luxe-paris"),
                 ("Estimation de montre", "/estimation-montre-de-luxe"),
                 ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai"),
                 ("Personal shopper Paris", "/personal-shopper-paris")],
                "Nous cherchons également <strong>Audemars Piguet</strong>, "
                "<strong>Patek Philippe</strong>, <strong>Cartier</strong> et "
                "<strong>Omega</strong> : décrivez-nous votre demande."),
         faq_title="Questions fréquentes — acheter une Rolex",
         faq=[
             ("Pouvez-vous me faire entrer sur une liste d'attente ?",
              "Non, et personne ne peut sérieusement le promettre : l'attribution relève des "
              "concessionnaires. Nous travaillons sur le marché secondaire, où les pièces sont "
              "réellement disponibles."),
             ("Le marché secondaire est-il plus cher ?",
              "Selon les références. Sur les modèles très demandés, oui. Sur beaucoup d'autres, "
              "les prix sont proches, voire inférieurs au neuf. Nous vous le disons pièce par pièce."),
             ("Comment éviter les contrefaçons ?",
              "En ne payant jamais avant l'authentification par un horloger indépendant. C'est "
              "notre règle, sans exception."),
             ("Puis-je acheter à distance ?",
              "Oui : nous gérons la vérification sur place et le transport assuré. Le paiement "
              "n'intervient qu'après contrôle."),
             ("Quels sont vos honoraires ?",
              "Convenus à l'avance, avant toute recherche. Nous ne prenons aucune commission du "
              "vendeur : vous savez pour qui nous travaillons."),
             ("Reprenez-vous une montre en échange ?",
              "Nous pouvons organiser la vente de votre pièce actuelle en parallèle de l'achat — "
              "voir <a href=\"/vendre-sa-montre-de-luxe-paris\">vendre sa montre</a>."),
         ],
         form=("Quelle Rolex cherchez-vous ?",
               "Référence ou modèle, budget, exigences sur l'état et les documents : nous lançons "
               "la recherche et nous revenons avec des options réelles.",
               "Paris", "Recherche de montre"),
         footer=FOOT_MONTRE,
         tagline="Acheter une Rolex à Paris — la bonne pièce, "
                 "<span class=\"font-serif-italic\">vérifiée avant paiement</span>.",
         lieu="Paris · Île-de-France",
         mobcta="Chercher ma Rolex"),

    dict(slug="estimation-montre-de-luxe",
         title="Estimation de montre de luxe — combien vaut vraiment votre montre ?",
         desc="Estimation gratuite de votre montre de luxe : fourchette de marché fondée sur des "
              "transactions comparables réelles, points qui font varier le prix et conseils avant "
              "vente. Rolex, AP, Patek, Cartier, Omega.",
         crumb="Estimation de montre",
         trail=[("Accueil", "/"), ("Montres de luxe", "/achat-vente-montres-de-luxe")],
         nav=NAV_LUXE,
         service_type="Estimation de montres de luxe", area="France",
         badge="⌚ Estimation gratuite",
         h1="Combien vaut vraiment <span class=\"font-serif-italic\">votre montre</span> ?",
         sub="Une fourchette de marché argumentée, fondée sur des transactions comparables — pas "
             "sur une cote théorique ni sur une offre de rachat déguisée en estimation.",
         photo=("real/shopping-montre2-poster.jpg", "Montre de luxe présentée pour estimation"),
         puces=["Réponse <b>rapide</b>", "Comparables <b>réels</b>",
                "Sans <b>engagement</b>", "Aucune <b>pression</b>"],
         cta="Demander mon estimation",
         intro=[
             "La plupart des « estimations gratuites » du marché sont en réalité des offres de "
             "rachat : celui qui estime est celui qui achète, et il a tout intérêt à annoncer un "
             "prix bas. Le résultat est mécanique.",
             "Nous n'achetons pas votre montre. Notre estimation situe la pièce sur le marché réel, "
             "en indiquant ce qui tire le prix vers le haut et ce qui le tire vers le bas. Ce que "
             "vous en faites ensuite vous appartient.",
         ],
         cards=("Ce que contient l'estimation", "Court, chiffré, argumenté.", [
             ("Fourchette de marché",
              "Une borne basse et une borne haute, appuyées sur des transactions comparables "
              "récentes pour la même référence et le même état."),
             ("Effet des documents",
              "Boîte, papiers, facture d'origine, historique d'entretien : nous chiffrons ce que "
              "leur présence — ou leur absence — représente."),
             ("État et service",
              "Rayures, polissage antérieur, révision à prévoir : ce que l'acheteur verra, et ce "
              "qu'il utilisera pour négocier."),
             ("Liquidité de la référence",
              "Certaines pièces se vendent en trois jours, d'autres en trois mois. Le délai fait "
              "partie du prix."),
             ("Conseil avant vente",
              "Ce qu'il faut faire — et surtout ne pas faire — avant de présenter la montre à des "
              "acheteurs."),
             ("Canaux de vente",
              "Professionnel, collectionneur, maison de vente : lequel correspond le mieux à votre "
              "pièce et à votre délai."),
         ]),
         sections=[
             ("Ce que nous avons besoin de savoir", [
                 "Marque, modèle et référence si vous la connaissez, année approximative, état "
                 "général, présence de la boîte et des papiers, éventuelles révisions. Quelques "
                 "photos nettes — cadran, dos, bracelet, fermoir — suffisent pour une première "
                 "fourchette.",
                 "Pour une estimation ferme, un examen physique par notre horloger partenaire est "
                 "nécessaire : certaines vérifications ne se font pas en photo.",
             ]),
             ("Une estimation, et après ?", [
                 "Rien ne vous engage. Certains clients estiment simplement leur patrimoine ou "
                 "préparent une succession ; d'autres vendent dans la foulée, d'autres encore "
                 "attendent un meilleur moment de marché.",
                 "Si vous décidez de vendre, notre accompagnement est décrit sur la page "
                 "<a href=\"/vendre-sa-montre-de-luxe-paris\"><strong>vendre sa montre de luxe à "
                 "Paris</strong></a>.",
             ]),
         ],
         steps=("Comment ça se passe", [
             ("1. Vos informations", "Modèle, référence, année, photos : par formulaire ou WhatsApp."),
             ("2. Analyse", "Nous comparons avec les transactions récentes de la même référence."),
             ("3. Fourchette", "Vous recevez une estimation argumentée et les points de vigilance."),
             ("4. À vous de voir", "Vous vendez, vous attendez, ou vous gardez. Sans aucune pression."),
         ]),
         why=("Pourquoi notre estimation est honnête", [
             ("Nous n'achetons pas votre montre",
              "Celui qui estime n'est pas celui qui achète : c'est la seule façon d'obtenir un "
              "chiffre qui ne soit pas orienté."),
             ("Des transactions, pas des cotes",
              "Nous partons de ventes réelles récentes, pas d'indices théoriques qui ne "
              "correspondent à aucune transaction."),
             ("Les défauts sont dits",
              "Nous signalons ce qui fera baisser le prix. Le savoir avant l'acheteur, c'est "
              "pouvoir y répondre."),
             ("Aucune obligation",
              "L'estimation est gratuite et sans suite obligatoire. Nous ne relançons pas."),
         ]),
         zones=("Horlogerie", "",
                [("Vendre sa montre à Paris", "/vendre-sa-montre-de-luxe-paris"),
                 ("Acheter une Rolex", "/acheter-une-rolex-paris"),
                 ("Achat & vente de montres", "/achat-vente-montres-de-luxe"),
                 ("Montres de luxe à Dubaï", "/montres-de-luxe-dubai"),
                 ("Personal shopper Paris", "/personal-shopper-paris")],
                "Nous estimons également la <strong>joaillerie</strong> avec l'appui de nos "
                "partenaires gemmologues."),
         faq_title="Questions fréquentes — estimation de montre",
         faq=[
             ("L'estimation est-elle vraiment gratuite ?",
              "Oui, et sans contrepartie. Nous ne facturons que l'accompagnement à la vente ou à "
              "l'achat, si vous choisissez d'aller plus loin."),
             ("Sous quel délai ai-je une réponse ?",
              "En général sous 24 à 48 heures pour une première fourchette, à partir de vos photos "
              "et informations."),
             ("Une estimation en photo est-elle fiable ?",
              "Pour une fourchette, oui. Pour un prix ferme, un examen physique reste nécessaire : "
              "l'état réel du boîtier et du mouvement se voit mal en photo."),
             ("Estimez-vous les montres non fonctionnelles ?",
              "Oui. Une pièce qui ne fonctionne pas garde de la valeur ; le coût de la remise en "
              "état est simplement intégré à l'estimation."),
             ("Et pour une succession ?",
              "Nous accompagnons régulièrement des successions : estimation écrite de l'ensemble "
              "des pièces, puis vente si la famille le souhaite."),
             ("Quelles marques estimez-vous ?",
              "Rolex, Audemars Piguet, Patek Philippe, Cartier, Omega, Vacheron Constantin, "
              "Jaeger-LeCoultre, Breitling, IWC, Panerai et les principales maisons du marché."),
         ],
         form=("Recevez l'estimation de votre montre",
               "Marque, modèle, référence, année, état, documents disponibles : quelques lignes "
               "suffisent pour démarrer.",
               "Paris", "Estimation de montre"),
         footer=FOOT_MONTRE,
         tagline="Estimation de montres de luxe — un chiffre "
                 "<span class=\"font-serif-italic\">sans arrière-pensée</span>.",
         lieu="Paris · France · Dubaï",
         mobcta="Demander mon estimation"),

    dict(slug="montres-de-luxe-dubai",
         title="Montres de luxe à Dubaï — sourcing, achat accompagné et retour en France",
         desc="Acheter une montre de luxe à Dubaï : sourcing auprès de nos contacts locaux, "
              "authentification, négociation et rappel des règles de douane pour un retour en "
              "France en toute légalité.",
         crumb="Montres à Dubaï",
         trail=[("Accueil", "/"), ("Montres de luxe", "/achat-vente-montres-de-luxe")],
         nav=NAV_LUXE,
         service_type="Recherche et acquisition de montres de luxe à Dubaï", area="Dubaï",
         business=(" — Dubaï", "Dubaï", "Dubaï", "", "AE", (25.2048, 55.2708),
                   ["Dubaï", "Émirats arabes unis"]),
         badge="⌚ Dubaï · Horlogerie",
         h1="Montres de luxe à <span class=\"font-serif-italic\">Dubaï</span>",
         sub="Un marché profond, des pièces disponibles — et des règles de douane que beaucoup "
             "découvrent trop tard. Nous cherchons, nous vérifions, et nous vous disons la vérité "
             "sur l'économie réelle.",
         photo=("real/dubai-skyline.jpg", "Dubaï, place forte du marché horloger"),
         puces=["Réseau <b>local</b>", "Authentification <b>indépendante</b>",
                "Douane <b>expliquée</b>", "Accompagnement <b>sur place</b>"],
         cta="Parler de ma recherche",
         intro=[
             "Dubaï est l'un des marchés horlogers les plus actifs au monde : concessionnaires, "
             "courtiers et collectionneurs y font circuler des pièces que l'on cherche des mois en "
             "Europe. Nous y sommes implantés — voir notre "
             "<a href=\"/conciergerie-dubai\">conciergerie à Dubaï</a>.",
             "Mais l'économie annoncée n'est pas toujours l'économie réelle. Une montre achetée "
             "hors Union européenne et rapportée en France doit être déclarée en douane, avec "
             "droits et TVA à l'importation. Nous préférons le dire avant, pas après.",
         ],
         cards=("Notre accompagnement à Dubaï", "Sur place, avec les mêmes règles qu'en France.", [
             ("Sourcing local",
              "Nos contacts sur place cherchent la référence demandée auprès des détaillants et "
              "des courtiers du marché émirati."),
             ("Vérification avant paiement",
              "Authentification et contrôle d'état par un horloger indépendant : la règle ne change "
              "pas parce qu'on change de pays."),
             ("Négociation",
              "Le marché de Dubaï se négocie. Nous discutons sur des éléments concrets : état, "
              "documents, disponibilité de la référence."),
             ("Accompagnement sur place",
              "Rendez-vous organisés, chauffeur, traduction si nécessaire, sécurité du déplacement "
              "avec la pièce."),
             ("Cadre douanier",
              "Nous vous expliquons ce qui doit être déclaré au retour en France et ce que cela "
              "représente réellement, pour que vous décidiez en connaissance de cause."),
             ("Alternative française",
              "Si le calcul complet ne joue pas en faveur de Dubaï, nous vous le disons et nous "
              "cherchons en France — voir <a href=\"/acheter-une-rolex-paris\">acheter une Rolex à "
              "Paris</a>."),
         ]),
         sections=[
             ("Dubaï est-il vraiment moins cher ?", [
                 "Sur certaines références, oui : le marché est plus profond, la disponibilité "
                 "meilleure, et la fiscalité locale plus légère. Sur d'autres, l'écart est faible, "
                 "voire nul.",
                 "Le calcul honnête inclut les droits et la TVA à l'importation au retour en "
                 "France, le déplacement, et le risque si la pièce n'est pas vérifiée. Une fois "
                 "tout additionné, la bonne décision n'est pas toujours celle qu'on imaginait — et "
                 "notre rôle est de vous donner les chiffres, pas de vous vendre un voyage.",
             ]),
             ("Ce que nous organisons pendant votre séjour", [
                 "Nous combinons souvent la recherche horlogère avec un séjour complet : "
                 "<a href=\"/conciergerie-dubai\">conciergerie</a>, "
                 "<a href=\"/chauffeur-prive-dubai\">chauffeur privé</a>, "
                 "<a href=\"/location-villa-dubai\">hébergement</a>, "
                 "<a href=\"/yacht-dubai\">yacht</a> et "
                 "<a href=\"/activites-vip-dubai\">expériences</a>.",
                 "Un rendez-vous horloger mal placé dans la journée peut coûter deux heures de "
                 "trajet à Dubaï : la logistique fait partie du service.",
             ]),
         ],
         gallery=[("real/dubai-skyline.jpg", "Skyline de Dubaï"),
                  ("real/dubai-marina.jpg", "Dubaï Marina"),
                  ("real/rolex-coffret.jpg", "Montre de luxe dans son coffret"),
                  ("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master"),
                  ("real/shopping-montre2-poster.jpg", "Montre présentée à un client"),
                  ("real/dubai-palace.jpg", "Hôtel de luxe à Dubaï")],
         steps=("Comment nous procédons", [
             ("1. Votre demande", "Référence, budget, délai, et si vous vous déplacez ou non."),
             ("2. Sourcing local", "Nos contacts cherchent et remontent les options avec les prix."),
             ("3. Vérification", "Authentification indépendante avant tout paiement."),
             ("4. Décision éclairée", "Coût complet, douane comprise, puis achat si le calcul tient."),
         ]),
         why=WHY_MONTRE,
         zones=("Dubaï et horlogerie", "",
                [("Conciergerie à Dubaï", "/conciergerie-dubai"),
                 ("Chauffeur privé à Dubaï", "/chauffeur-prive-dubai"),
                 ("Van avec chauffeur à Dubaï", "/van-avec-chauffeur-dubai"),
                 ("Achat & vente de montres", "/achat-vente-montres-de-luxe"),
                 ("Acheter une Rolex à Paris", "/acheter-une-rolex-paris")],
                "Voir aussi nos <a href=\"/activites-vip-dubai\"><strong>expériences VIP à "
                "Dubaï</strong></a> et la <a href=\"/location-villa-dubai\">location de villa</a>."),
         faq_title="Questions fréquentes — montres de luxe à Dubaï",
         faq=[
             ("Dois-je déclarer ma montre en rentrant en France ?",
              "Oui : un achat effectué hors Union européenne doit être déclaré à la douane à "
              "l'entrée, avec paiement des droits et de la TVA à l'importation au-delà des "
              "franchises voyageurs. Nous vous expliquons la procédure ; pour votre situation "
              "précise, l'administration des douanes fait foi."),
             ("Les prix affichés à Dubaï sont-ils négociables ?",
              "Souvent, oui, en particulier sur le marché secondaire. C'est l'un des intérêts du "
              "marché émirati."),
             ("Comment être sûr de l'authenticité ?",
              "Même règle qu'en France : authentification par un horloger indépendant avant tout "
              "paiement. Nous ne dérogeons jamais à ce principe."),
             ("Puis-je acheter sans me déplacer ?",
              "Oui : nous gérons la recherche, la vérification et l'acheminement assuré. Le cadre "
              "douanier s'applique de la même façon."),
             ("Êtes-vous vraiment présents à Dubaï ?",
              "Oui, c'est l'une de nos destinations historiques — voir notre "
              "<a href=\"/conciergerie-dubai\">page Dubaï</a>."),
             ("Pouvez-vous aussi vendre une montre à Dubaï ?",
              "Oui, nous présentons la pièce à nos contacts locaux et comparons avec les offres "
              "françaises avant de vous recommander un canal."),
         ],
         form=("Votre recherche horlogère à Dubaï",
               "Référence, budget, dates de séjour éventuelles : nous lançons la recherche et nous "
               "vous donnons le coût complet, douane incluse.",
               "Dubaï", "Montre de luxe"),
         footer=FOOT_MONTRE,
         tagline="Montres de luxe à Dubaï — sourcing local et "
                 "<span class=\"font-serif-italic\">calcul honnête</span>.",
         lieu="Dubaï · Paris",
         mobcta="Parler de ma recherche"),

    # ------------------------------------------------------------------ Vans
    dict(slug="van-avec-chauffeur-paris",
         title="Van avec chauffeur à Paris — Mercedes Classe V, groupes et bagages",
         desc="Van avec chauffeur à Paris : Mercedes Classe V jusqu'à 7 passagers, transferts "
              "aéroport, mise à disposition à l'heure ou à la journée, groupes, familles et "
              "déplacements professionnels. Devis ferme.",
         crumb="Van avec chauffeur Paris",
         trail=[("Accueil", "/"), ("Transport privé", "/transport")],
         nav=NAV_VAN,
         service_type="Location de van avec chauffeur à Paris", area="Paris",
         business=(" — Transport Paris", "Paris", "Île-de-France", "75008", "FR",
                   (48.8698, 2.3079), ["Paris", "Île-de-France"]),
         offers=["Transfert aéroport", "Mise à disposition à l'heure", "Mise à disposition à la journée",
                 "Transport de groupe", "Événements et mariages"],
         badge="🚐 Paris · Van avec chauffeur",
         h1="Van avec chauffeur à <span class=\"font-serif-italic\">Paris</span>",
         sub="Jusqu'à sept passagers et leurs bagages dans le même véhicule, avec un chauffeur qui "
             "attend, porte les valises et connaît la ville. Transferts, journées, événements.",
         photo=("real/mercedes-van.jpg", "Van Mercedes avec chauffeur"),
         puces=["Jusqu'à <b>7 passagers</b>", "Bagages <b>inclus</b>",
                "Devis <b>ferme</b>", "Disponible <b>7j/7</b>"],
         cta="Demander un devis",
         intro=[
             "À partir de quatre personnes avec des valises, la berline ne suffit plus : il faut "
             "deux voitures, deux chauffeurs, et le groupe se sépare. Le van résout le problème — "
             "un seul véhicule, tout le monde ensemble, les bagages avec.",
             "Nous mettons à disposition des vans de type <strong>Mercedes Classe V</strong> avec "
             "chauffeur à Paris et en Île-de-France : transferts aéroport, mises à disposition à "
             "l'heure ou à la journée, déplacements professionnels, événements familiaux.",
         ],
         cards=("Nos prestations en van", "Un véhicule, un chauffeur, un prix connu à l'avance.", [
             ("Transferts aéroport",
              "Roissy-CDG, Orly, Beauvais et Le Bourget : accueil en salle d'arrivée avec pancarte, "
              "suivi du vol en temps réel, aide au chargement. Voir nos "
              "<a href=\"/navette-aeroport-paris\">navettes aéroport</a>."),
             ("Transferts gares",
              "Gare du Nord, Lyon, Montparnasse, Est, Saint-Lazare : prise en charge à quai "
              "convenue à l'avance, y compris pour les groupes."),
             ("Mise à disposition",
              "À l'heure ou à la journée, avec chauffeur dédié : réunions, shopping, visites, "
              "tournages, déplacements multiples."),
             ("Groupes et familles",
              "Jusqu'à sept passagers, sièges enfants sur demande, coffre adapté aux valises "
              "longues durées."),
             ("Déplacements professionnels",
              "Délégations, séminaires, roadshows : plusieurs véhicules coordonnés si nécessaire, "
              "avec un interlocuteur unique."),
             ("Excursions",
              "Versailles, Giverny, Champagne, Disneyland, châteaux de la Loire : à la journée, "
              "avec un chauffeur qui reste à disposition."),
         ]),
         sections=[
             ("Van ou berline : comment choisir", [
                 "<strong>La berline</strong> convient jusqu'à trois passagers avec des bagages "
                 "légers. Au-delà, le coffre devient le facteur limitant bien avant les places assises.",
                 "<strong>Le van</strong> transporte jusqu'à sept passagers avec leurs valises, "
                 "permet de se parler pendant le trajet et évite de commander deux voitures. Pour "
                 "un transfert aéroport en famille, c'est presque toujours la solution la plus "
                 "économique.",
                 "Si vous cherchez plutôt une berline ou un véhicule d'exception, voir notre "
                 "<a href=\"/chauffeur-prive-paris\"><strong>chauffeur privé à Paris</strong></a>.",
             ]),
             ("Ce que nous garantissons", [
                 "Un chauffeur professionnel en tenue, un véhicule récent et propre, une prise en "
                 "charge à l'heure convenue, et un prix fixé à l'avance selon le trajet ou la durée. "
                 "Pas de compteur qui tourne dans les embouteillages, pas de majoration découverte "
                 "à l'arrivée.",
                 "Pour les vols, nous suivons les horaires réels : un retard d'avion ne vous coûte "
                 "pas votre transfert.",
             ]),
         ],
         gallery=[("real/mercedes-van.jpg", "Van Mercedes avec chauffeur"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur d'un véhicule avec chauffeur"),
                  ("real/g-wagon.jpg", "SUV de la flotte partenaire"),
                  ("real/proof-transport-poster.jpg", "Prise en charge d'un client"),
                  ("real/proof-arrivee-poster.jpg", "Accueil à l'arrivée"),
                  ("real/billetterie-avion.jpg", "Transfert vers l'aéroport")],
         steps=("Comment réserver", [
             ("1. Votre demande", "Date, heure, adresses, nombre de passagers et de bagages."),
             ("2. Devis ferme", "Prix tout compris, envoyé rapidement, sans engagement."),
             ("3. Confirmation", "Chauffeur affecté, coordonnées transmises la veille."),
             ("4. Le jour J", "Prise en charge à l'heure, suivi du vol ou du train si nécessaire."),
         ]),
         why=WHY_VAN,
         zones=("Nos autres services de transport", "",
                [("Navette aéroport Paris", "/navette-aeroport-paris"),
                 ("Van pour mariage et événement", "/van-avec-chauffeur-mariage"),
                 ("Chauffeur privé à Paris", "/chauffeur-prive-paris"),
                 ("Van avec chauffeur à Marrakech", "/van-avec-chauffeur-marrakech"),
                 ("Van avec chauffeur à Dubaï", "/van-avec-chauffeur-dubai")],
                "Besoin d'un accompagnement complet ? Voir notre "
                "<a href=\"/conciergerie-privee-paris\"><strong>conciergerie privée à "
                "Paris</strong></a>."),
         faq_title="Questions fréquentes — van avec chauffeur à Paris",
         faq=[
             ("Combien de personnes dans un van ?",
              "Jusqu'à sept passagers selon la configuration, avec leurs bagages. Au-delà, nous "
              "coordonnons plusieurs véhicules."),
             ("Le prix est-il fixé à l'avance ?",
              "Oui, sur devis ferme selon le trajet ou la durée de mise à disposition. Aucun "
              "compteur, aucune majoration surprise."),
             ("Que se passe-t-il si mon vol a du retard ?",
              "Nous suivons le vol en temps réel et adaptons l'heure de prise en charge. Une "
              "franchise d'attente est prévue dans nos transferts aéroport."),
             ("Proposez-vous des sièges enfants ?",
              "Oui, sur demande à la réservation, en précisant l'âge et le poids des enfants."),
             ("Peut-on réserver pour plusieurs jours ?",
              "Oui, en mise à disposition à la journée avec le même chauffeur, ce qui est la "
              "formule la plus efficace pour un séjour chargé."),
             ("Intervenez-vous hors d'Île-de-France ?",
              "Oui : excursions à la journée, longues distances et transferts vers la province ou "
              "les pays limitrophes, sur devis."),
         ],
         form=("Demandez votre devis de van avec chauffeur",
               "Date, horaires, trajet, nombre de passagers et de bagages : nous revenons vers "
               "vous avec un prix ferme.",
               "Paris", "Van avec chauffeur"),
         footer=FOOT_VAN,
         tagline="Van avec chauffeur à Paris — tout le monde et les bagages "
                 "<span class=\"font-serif-italic\">dans le même véhicule</span>.",
         lieu="Paris · Île-de-France",
         mobcta="Demander un devis"),

    dict(slug="navette-aeroport-paris",
         title="Navette aéroport Paris — transferts CDG, Orly, Beauvais avec chauffeur",
         desc="Navette aéroport à Paris avec chauffeur privé : transferts Roissy-CDG, Orly, "
              "Beauvais et Le Bourget en berline ou en van jusqu'à 7 passagers. Suivi des vols, "
              "accueil en salle d'arrivée, prix fixé à l'avance.",
         crumb="Navette aéroport",
         trail=[("Accueil", "/"), ("Transport privé", "/transport")],
         nav=NAV_VAN,
         service_type="Transferts aéroport avec chauffeur à Paris", area="Paris",
         business=(" — Transferts aéroport", "Paris", "Île-de-France", "75008", "FR",
                   (48.8698, 2.3079), ["Paris", "Roissy-en-France", "Orly", "Île-de-France"]),
         badge="✈️ Paris · Transferts aéroport",
         h1="Navette <span class=\"font-serif-italic\">aéroport</span> à Paris",
         sub="Roissy-CDG, Orly, Beauvais, Le Bourget : un chauffeur vous attend, suit votre vol et "
             "vous emmène directement, avec un prix connu avant le départ.",
         photo=("real/billetterie-avion.jpg", "Départ depuis un aéroport parisien"),
         puces=["Vols <b>suivis</b>", "Accueil <b>en salle d'arrivée</b>",
                "Berline ou <b>van</b>", "Prix <b>ferme</b>"],
         cta="Réserver mon transfert",
         intro=[
             "Un transfert aéroport rate rarement pour une question de trajet : il rate parce que "
             "le vol a bougé, parce que le chauffeur n'est pas au bon terminal, ou parce que les "
             "valises ne rentrent pas. Ces trois problèmes se règlent en amont.",
             "Nous assurons les transferts depuis et vers <strong>Roissy-Charles-de-Gaulle</strong>, "
             "<strong>Orly</strong>, <strong>Beauvais</strong> et <strong>Le Bourget</strong>, en "
             "berline ou en van jusqu'à sept passagers, à Paris comme en Île-de-France.",
         ],
         cards=("Ce que comprend un transfert", "Tout ce qui évite les mauvaises surprises.", [
             ("Suivi du vol",
              "Nous surveillons les horaires réels : un vol en avance ou en retard décale la prise "
              "en charge, sans que vous ayez à prévenir."),
             ("Accueil en salle d'arrivée",
              "Le chauffeur vous attend avec une pancarte au nom convenu, au bon terminal, et "
              "aide au chargement."),
             ("Véhicule adapté",
              "Berline pour un couple, van jusqu'à sept passagers pour une famille ou un groupe "
              "avec bagages volumineux."),
             ("Franchise d'attente",
              "Un temps d'attente est inclus après l'atterrissage, le temps des bagages et des "
              "formalités."),
             ("Prix ferme",
              "Le tarif est fixé au devis selon le trajet et le véhicule. Les embouteillages ne "
              "changent pas la note."),
             ("Sièges enfants",
              "Disponibles sur demande à la réservation, en précisant l'âge et le poids."),
         ]),
         sections=[
             ("Depuis quel aéroport ?", [
                 "<strong>Roissy-Charles-de-Gaulle</strong> est le plus éloigné du centre : compter "
                 "une heure environ hors heures de pointe, davantage en fin de journée. "
                 "<strong>Orly</strong> est plus proche mais l'accès sud est très chargé aux heures "
                 "de pointe.",
                 "<strong>Beauvais</strong> se situe à environ 80 km au nord de Paris : le transfert "
                 "y est plus long et se prépare, surtout pour un vol tôt le matin. "
                 "<strong>Le Bourget</strong>, réservé à l'aviation d'affaires, demande une "
                 "coordination avec l'opérateur pour l'accès au terminal.",
             ]),
             ("Vols très matinaux et arrivées de nuit", [
                 "Les vols de 6 h imposent un départ de Paris vers 4 h. Nos chauffeurs assurent ces "
                 "créneaux, y compris le week-end. Les arrivées après minuit sont également "
                 "couvertes, avec le même suivi de vol.",
                 "Si vous cherchez plutôt à dormir à proximité, notre "
                 "<a href=\"/conciergerie-airbnb-orly-aeroport\">page sur le secteur d'Orly</a> "
                 "explique pourquoi cette demande est si forte.",
             ]),
         ],
         gallery=[("real/billetterie-avion.jpg", "Départ en avion"),
                  ("real/mercedes-van.jpg", "Van pour transfert aéroport"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur du véhicule"),
                  ("real/proof-avion-poster.jpg", "Voyage organisé par la conciergerie"),
                  ("real/proof-transport-poster.jpg", "Prise en charge d'un client"),
                  ("real/proof-arrivee-poster.jpg", "Accueil à l'arrivée")],
         steps=("Réserver en quatre étapes", [
             ("1. Vos informations", "Numéro de vol, terminal, date, adresse, nombre de passagers."),
             ("2. Devis ferme", "Tarif tout compris selon le véhicule choisi."),
             ("3. Confirmation", "Coordonnées du chauffeur transmises avant le jour J."),
             ("4. Prise en charge", "Accueil avec pancarte, aide aux bagages, départ direct."),
         ]),
         why=WHY_VAN,
         zones=("Nos services de transport", "",
                [("Van avec chauffeur à Paris", "/van-avec-chauffeur-paris"),
                 ("Chauffeur privé à Paris", "/chauffeur-prive-paris"),
                 ("Van pour mariage et événement", "/van-avec-chauffeur-mariage"),
                 ("Van avec chauffeur à Marrakech", "/van-avec-chauffeur-marrakech"),
                 ("Van avec chauffeur à Dubaï", "/van-avec-chauffeur-dubai")],
                "Vous arrivez pour un séjour complet ? Voir notre "
                "<a href=\"/conciergerie-privee-paris\"><strong>conciergerie privée</strong></a>."),
         faq_title="Questions fréquentes — navette aéroport à Paris",
         faq=[
             ("Combien de temps à l'avance faut-il réserver ?",
              "Idéalement 24 à 48 heures. Nous traitons aussi les demandes urgentes selon la "
              "disponibilité des chauffeurs."),
             ("Que se passe-t-il si mon vol est annulé ?",
              "Prévenez-nous : nous reprogrammons le transfert. Nos conditions d'annulation vous "
              "sont communiquées avec le devis."),
             ("Le chauffeur attend-il si les bagages tardent ?",
              "Oui, une franchise d'attente est incluse après l'atterrissage. Au-delà, un tarif "
              "horaire s'applique, connu à l'avance."),
             ("Prenez-vous en charge plusieurs vols le même jour ?",
              "Oui, pour les groupes arrivant séparément : nous coordonnons les prises en charge "
              "et les véhicules."),
             ("Desservez-vous Disneyland et Versailles ?",
              "Oui, ainsi que les gares et les principales destinations d'Île-de-France, sur devis."),
             ("Peut-on payer sur place ?",
              "Les modalités de paiement sont convenues avec le devis, avant le jour du transfert."),
         ],
         form=("Réservez votre transfert aéroport",
               "Numéro de vol, terminal, date et heure, adresse, nombre de passagers : nous "
               "revenons avec un prix ferme.",
               "Paris", "Transfert aéroport"),
         footer=FOOT_VAN,
         tagline="Navette aéroport à Paris — CDG, Orly, Beauvais, "
                 "<span class=\"font-serif-italic\">vols suivis</span>.",
         lieu="Paris · Roissy · Orly · Beauvais",
         mobcta="Réserver mon transfert"),

    dict(slug="van-avec-chauffeur-mariage",
         title="Van avec chauffeur pour mariage et événement — Paris et Île-de-France",
         desc="Van avec chauffeur pour mariage, séminaire ou événement à Paris et en Île-de-France : "
              "navettes invités, transferts mairie-église-domaine, mise à disposition à la journée. "
              "Plusieurs véhicules coordonnés.",
         crumb="Mariages et événements",
         trail=[("Accueil", "/"), ("Transport privé", "/transport")],
         nav=NAV_VAN,
         service_type="Transport de groupe avec chauffeur pour mariages et événements",
         area="Île-de-France",
         business=(" — Événements", "Paris", "Île-de-France", "75008", "FR", (48.8698, 2.3079),
                   ["Paris", "Île-de-France"]),
         badge="💍 Mariages & événements",
         h1="Van avec chauffeur pour <span class=\"font-serif-italic\">mariage et événement</span>",
         sub="Navettes d'invités, transferts entre la mairie, le lieu de cérémonie et le domaine, "
             "retours de fin de soirée : un plan de transport écrit, tenu à la minute.",
         photo=("real/mercedes-van.jpg", "Van avec chauffeur pour un événement"),
         puces=["Navettes <b>invités</b>", "Plusieurs <b>véhicules</b>",
                "Retours <b>de nuit</b>", "Plan de transport <b>écrit</b>"],
         cta="Organiser mon transport",
         intro=[
             "Le transport est ce qui casse le plus souvent le déroulé d'un mariage : des invités "
             "qui arrivent en retard à la cérémonie, un domaine impossible à rejoindre sans voiture, "
             "et une fin de soirée où plus personne n'est en état de conduire.",
             "Nous construisons un plan de transport avec vous : qui part d'où, à quelle heure, "
             "dans quel véhicule, et qui rentre quand. Puis nous l'exécutons, avec un ou plusieurs "
             "vans et un coordinateur unique.",
         ],
         cards=("Ce que nous organisons", "Un plan écrit, des chauffeurs briefés.", [
             ("Navettes d'invités",
              "Rotations entre les hôtels, la gare, l'aéroport et le lieu de réception, selon un "
              "planning établi à l'avance avec vous."),
             ("Trajets de la journée",
              "Mairie, lieu de cérémonie, séance photo, domaine : le van suit le programme, avec "
              "les marges nécessaires."),
             ("Retours de fin de soirée",
              "Plusieurs rotations en fin de nuit pour ramener tout le monde en sécurité : c'est "
              "souvent la prestation la plus utile."),
             ("Véhicules coordonnés",
              "Au-delà de sept invités, nous alignons plusieurs vans avec un interlocuteur unique "
              "et des chauffeurs briefés sur le même planning."),
             ("Séminaires et événements pro",
              "Transferts d'équipes, roadshows, soirées d'entreprise : même méthode, même exigence "
              "de ponctualité."),
             ("Repérage",
              "Pour les domaines difficiles d'accès, nous vérifions l'itinéraire et les contraintes "
              "de stationnement en amont."),
         ]),
         sections=[
             ("Construire un plan de transport qui tient", [
                 "Nous partons du programme de la journée et nous remontons : heure de cérémonie, "
                 "temps de trajet réel, marge d'aléa, capacité des véhicules, nombre de rotations "
                 "nécessaires. Le document final indique, pour chaque véhicule, l'heure et le lieu "
                 "de chaque prise en charge.",
                 "C'est ce plan qui permet de dire à cinquante invités où et quand se présenter — "
                 "et d'éviter les dix appels au marié pendant qu'il s'habille.",
             ]),
             ("En Île-de-France et au-delà", [
                 "Nous intervenons à Paris, dans toute l'Île-de-France et sur les domaines de "
                 "province accessibles à la journée. Les distances longues sont chiffrées "
                 "spécifiquement, avec les temps de repos réglementaires des chauffeurs.",
                 "Pour un événement à l'étranger, voir nos pages "
                 "<a href=\"/van-avec-chauffeur-marrakech\">Marrakech</a> et "
                 "<a href=\"/van-avec-chauffeur-dubai\">Dubaï</a>.",
             ]),
         ],
         gallery=[("real/mercedes-van.jpg", "Van avec chauffeur"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur du véhicule"),
                  ("real/proof-transport-poster.jpg", "Prise en charge d'invités"),
                  ("real/dining.jpg", "Table dressée pour une réception"),
                  ("real/g-wagon.jpg", "SUV de la flotte partenaire"),
                  ("real/proof-voiture-nuit-poster.jpg", "Véhicule en fin de soirée")],
         steps=("Comment nous préparons votre journée", [
             ("1. Le programme", "Horaires, lieux, nombre d'invités, hébergements."),
             ("2. Le plan de transport", "Véhicules, rotations, heures : un document clair, validé par vous."),
             ("3. Le devis", "Prix ferme selon les véhicules et les amplitudes horaires."),
             ("4. Le jour J", "Chauffeurs briefés, coordinateur joignable en permanence."),
         ]),
         why=WHY_VAN,
         zones=("Nos autres prestations", "",
                [("Van avec chauffeur à Paris", "/van-avec-chauffeur-paris"),
                 ("Navette aéroport", "/navette-aeroport-paris"),
                 ("Chauffeur privé à Paris", "/chauffeur-prive-paris"),
                 ("Conciergerie privée", "/conciergerie-privee-paris"),
                 ("Van à Marrakech", "/van-avec-chauffeur-marrakech")],
                "Pour l'ensemble de l'organisation — hébergement des invités, traiteur, prestataires "
                "— voir notre <a href=\"/conciergerie-privee-paris\"><strong>conciergerie "
                "privée</strong></a>."),
         faq_title="Questions fréquentes — transport de mariage",
         faq=[
             ("Combien de vans pour cinquante invités ?",
              "Cela dépend du nombre de rotations acceptables. Avec des vans de sept places, on "
              "combine généralement plusieurs véhicules et deux ou trois rotations. Nous le "
              "chiffrons dans le plan de transport."),
             ("Assurez-vous les retours tard dans la nuit ?",
              "Oui, c'est même l'une des demandes les plus fréquentes. Les amplitudes horaires "
              "sont prévues au devis."),
             ("Décorez-vous les véhicules ?",
              "Nous acceptons une décoration légère et non abrasive, à convenir à l'avance."),
             ("Combien de temps à l'avance réserver ?",
              "Plusieurs semaines pour un mariage, davantage en pleine saison (mai à septembre) "
              "et pour les week-ends très demandés."),
             ("Intervenez-vous en province ?",
              "Oui, sur devis, en tenant compte des temps de trajet et des temps de repos des "
              "chauffeurs."),
             ("Peut-on ajouter un véhicule au dernier moment ?",
              "Selon la disponibilité. Mieux vaut prévoir une marge dans le plan initial : c'est "
              "moins cher qu'un ajout en urgence."),
         ],
         form=("Organisons le transport de votre événement",
               "Date, lieux, horaires, nombre d'invités : nous revenons vers vous avec un plan de "
               "transport et un devis.",
               "Île-de-France", "Transport événement"),
         footer=FOOT_VAN,
         tagline="Transport de mariage et d'événement — un plan écrit, "
                 "<span class=\"font-serif-italic\">tenu à la minute</span>.",
         lieu="Paris · Île-de-France",
         mobcta="Organiser mon transport"),

    dict(slug="van-avec-chauffeur-marrakech",
         title="Van avec chauffeur à Marrakech — transferts aéroport et excursions",
         desc="Van avec chauffeur à Marrakech : transferts depuis l'aéroport Ménara, mise à "
              "disposition à la journée, excursions vers Agafay, l'Ourika, Essaouira et Ouzoud. "
              "Chauffeur francophone, prix convenu à l'avance.",
         crumb="Van à Marrakech",
         trail=[("Accueil", "/"), ("Marrakech", "/conciergerie-marrakech")],
         nav=[("Marrakech", "/conciergerie-marrakech"),
              ("Activités", "/activites-marrakech"),
              ("Chauffeur privé", "/chauffeur-prive-marrakech"),
              ("Van avec chauffeur", "/van-avec-chauffeur-marrakech")],
         service_type="Location de van avec chauffeur à Marrakech", area="Marrakech",
         business=(" — Marrakech", "Marrakech", "Marrakech-Safi", "40000", "MA",
                   (31.6295, -7.9811), ["Marrakech", "Maroc"]),
         badge="🚐 Marrakech · Van avec chauffeur",
         h1="Van avec chauffeur à <span class=\"font-serif-italic\">Marrakech</span>",
         sub="Transferts depuis l'aéroport Ménara, journées à disposition et excursions dans tout "
             "le sud marocain, avec un chauffeur francophone qui connaît les routes.",
         photo=("real/marrakech-menara.jpg", "Marrakech, jardin de la Ménara"),
         puces=["Chauffeur <b>francophone</b>", "Jusqu'à <b>7 passagers</b>",
                "Excursions <b>à la journée</b>", "Prix <b>convenu</b>"],
         cta="Demander un devis",
         intro=[
             "À Marrakech, le transport fait la moitié de la réussite d'un séjour : la médina se "
             "ferme à la circulation, les riads sont au bout de ruelles introuvables, et les "
             "excursions dépassent souvent les deux heures de route.",
             "Nous mettons à disposition des vans avec chauffeur francophone pour les groupes et "
             "les familles : transferts, journées à disposition et excursions. Pour une berline ou "
             "un véhicule seul, voir notre "
             "<a href=\"/chauffeur-prive-marrakech\"><strong>chauffeur privé à Marrakech</strong></a>.",
         ],
         cards=("Nos prestations à Marrakech", "Transferts, journées, excursions.", [
             ("Transfert aéroport Ménara",
              "Accueil à l'arrivée, aide aux bagages et dépose au plus près de votre riad ou de "
              "votre hôtel, y compris lorsque l'accès en voiture s'arrête à l'entrée de la médina."),
             ("Mise à disposition",
              "À la demi-journée ou à la journée, avec chauffeur qui attend pendant vos visites, "
              "vos repas et vos achats."),
             ("Excursions au désert d'Agafay",
              "Trente à quarante minutes de route : dîner sous tente, coucher de soleil, nuit en "
              "camp. Voir <a href=\"/desert-agafay-marrakech\">notre page dédiée</a>."),
             ("Vallée de l'Ourika et Atlas",
              "Une heure de route vers les cascades et les villages berbères — "
              "<a href=\"/vallee-ourika-marrakech\">en savoir plus</a>."),
             ("Essaouira et Ouzoud",
              "Deux heures et demie à trois heures de route : des journées longues qui demandent "
              "un vrai véhicule et un chauffeur reposé."),
             ("Groupes et familles",
              "Jusqu'à sept passagers avec bagages, sièges enfants sur demande, plusieurs véhicules "
              "coordonnés au-delà."),
         ]),
         sections=[
             ("Pourquoi un van plutôt qu'un taxi", [
                 "Les taxis locaux conviennent pour un trajet court à deux. Dès qu'on est quatre "
                 "avec des valises, ou qu'on part à la journée, le van change tout : un seul "
                 "véhicule, un chauffeur qui attend, la climatisation, et un prix arrêté avant le "
                 "départ plutôt que négocié à chaque course.",
                 "Sur les excursions longues — Essaouira, Ouzoud, l'Atlas — c'est aussi une "
                 "question de sécurité : ces routes se font avec un chauffeur professionnel qui "
                 "les connaît.",
             ]),
             ("Combiner transport et séjour", [
                 "La plupart de nos clients à Marrakech nous confient l'ensemble : "
                 "<a href=\"/conciergerie-marrakech\">conciergerie</a>, "
                 "<a href=\"/riad-prive-marrakech\">riad privatisé</a>, "
                 "<a href=\"/activites-marrakech\">activités</a> et transport.",
                 "C'est ce qui permet d'enchaîner une matinée en quad, un déjeuner à la Palmeraie "
                 "et un dîner dans le désert sans passer la journée à organiser des trajets.",
             ]),
         ],
         gallery=[("real/marrakech-menara.jpg", "Jardin de la Ménara à Marrakech"),
                  ("real/mercedes-van.jpg", "Van avec chauffeur"),
                  ("real/logement-riad-poster.jpg", "Riad à Marrakech"),
                  ("real/desert-pool.jpg", "Camp dans le désert"),
                  ("real/activite-quad2-poster.jpg", "Sortie en quad"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur du véhicule")],
         steps=("Comment réserver", [
             ("1. Votre programme", "Dates, nombre de passagers, transferts et excursions envisagés."),
             ("2. Devis", "Prix ferme par trajet ou par journée, chauffeur francophone inclus."),
             ("3. Confirmation", "Coordonnées du chauffeur transmises avant votre arrivée."),
             ("4. Sur place", "Prise en charge à l'aéroport puis véhicule à disposition selon le programme."),
         ]),
         why=WHY_VAN,
         zones=("Marrakech", "",
                [("Conciergerie à Marrakech", "/conciergerie-marrakech"),
                 ("Chauffeur privé à Marrakech", "/chauffeur-prive-marrakech"),
                 ("Activités à Marrakech", "/activites-marrakech"),
                 ("Riad privatisé", "/riad-prive-marrakech"),
                 ("Désert d'Agafay", "/desert-agafay-marrakech")],
                "Voir aussi nos <a href=\"/location-villa-marrakech\"><strong>villas à "
                "Marrakech</strong></a>."),
         faq_title="Questions fréquentes — van avec chauffeur à Marrakech",
         faq=[
             ("Les chauffeurs parlent-ils français ?",
              "Oui, tous nos chauffeurs à Marrakech sont francophones."),
             ("Le van peut-il entrer dans la médina ?",
              "Non, la circulation y est restreinte. Le chauffeur vous dépose au plus près, et "
              "nous organisons l'acheminement des bagages jusqu'au riad."),
             ("Le carburant et le péage sont-ils inclus ?",
              "Oui, nos devis sont tout compris pour le trajet ou la journée convenue."),
             ("Peut-on modifier le programme sur place ?",
              "Dans la mesure du possible, oui. Un ajustement d'horaire se gère facilement ; une "
              "excursion supplémentaire se chiffre à part."),
             ("Combien de temps pour Essaouira ?",
              "Environ deux heures et demie à trois heures de route dans chaque sens : cela "
              "constitue une journée complète."),
             ("Proposez-vous des sièges enfants ?",
              "Oui, sur demande à la réservation."),
         ],
         form=("Votre transport à Marrakech",
               "Dates, nombre de passagers, transferts et excursions souhaités : nous revenons "
               "avec un devis ferme.",
               "Marrakech", "Van avec chauffeur"),
         footer=[("Marrakech", [("Conciergerie Marrakech", "/conciergerie-marrakech"),
                                ("Activités", "/activites-marrakech"),
                                ("Chauffeur privé", "/chauffeur-prive-marrakech"),
                                ("Riad privatisé", "/riad-prive-marrakech"),
                                ("Villas", "/location-villa-marrakech")]),
                 ("Transport", [("Van avec chauffeur Paris", "/van-avec-chauffeur-paris"),
                                ("Navette aéroport Paris", "/navette-aeroport-paris"),
                                ("Van pour mariage", "/van-avec-chauffeur-mariage"),
                                ("Van avec chauffeur Dubaï", "/van-avec-chauffeur-dubai"),
                                ("Accueil", "/")])],
         tagline="Van avec chauffeur à Marrakech — transferts, journées et "
                 "<span class=\"font-serif-italic\">excursions</span>.",
         lieu="Marrakech · Maroc",
         mobcta="Demander un devis"),

    dict(slug="van-avec-chauffeur-dubai",
         title="Van avec chauffeur à Dubaï — transferts DXB, journées et groupes",
         desc="Van avec chauffeur à Dubaï : transferts depuis l'aéroport DXB, mise à disposition à "
              "la journée, déplacements de groupe et excursions (désert, Abu Dhabi). Chauffeur "
              "francophone sur demande.",
         crumb="Van à Dubaï",
         trail=[("Accueil", "/"), ("Dubaï", "/conciergerie-dubai")],
         nav=[("Dubaï", "/conciergerie-dubai"), ("Activités VIP", "/activites-vip-dubai"),
              ("Chauffeur privé", "/chauffeur-prive-dubai"), ("Yacht", "/yacht-dubai")],
         service_type="Location de van avec chauffeur à Dubaï", area="Dubaï",
         business=(" — Dubaï transport", "Dubaï", "Dubaï", "", "AE", (25.2048, 55.2708),
                   ["Dubaï", "Émirats arabes unis"]),
         badge="🚐 Dubaï · Van avec chauffeur",
         h1="Van avec chauffeur à <span class=\"font-serif-italic\">Dubaï</span>",
         sub="Transferts depuis DXB, journées à disposition, déplacements de groupe : à Dubaï, les "
             "distances sont longues et la chaleur ne pardonne pas l'improvisation.",
         photo=("real/dubai-skyline.jpg", "Skyline de Dubaï"),
         puces=["Transferts <b>DXB</b>", "Jusqu'à <b>7 passagers</b>",
               "Journées <b>à disposition</b>", "Chauffeur <b>francophone</b>"],
         cta="Demander un devis",
         intro=[
             "Dubaï s'étire sur des dizaines de kilomètres : entre la Marina, Downtown, le Palm et "
             "l'aéroport, chaque trajet se compte en dizaines de minutes, et marcher n'est pas une "
             "option la moitié de l'année.",
             "Nous mettons à disposition des vans avec chauffeur pour les familles et les groupes : "
             "transferts aéroport, journées à disposition, excursions vers le désert ou Abu Dhabi. "
             "Pour un véhicule d'exception ou une berline, voir notre "
             "<a href=\"/chauffeur-prive-dubai\"><strong>chauffeur privé à Dubaï</strong></a>.",
         ],
         cards=("Nos prestations à Dubaï", "Transferts, journées, excursions.", [
             ("Transfert aéroport DXB",
              "Accueil à l'arrivée, aide aux bagages, dépose à l'hôtel ou à la villa, avec suivi "
              "du vol."),
             ("Mise à disposition",
              "Demi-journée ou journée complète avec chauffeur qui attend : shopping, réunions, "
              "visites, plages."),
             ("Groupes et familles",
              "Jusqu'à sept passagers avec bagages, sièges enfants sur demande, plusieurs véhicules "
              "coordonnés au-delà."),
             ("Excursions désert",
              "Départ vers les camps du désert en fin d'après-midi, dîner et retour de nuit : le "
              "van reste le véhicule le plus confortable pour un groupe."),
             ("Abu Dhabi et Émirats voisins",
              "Une heure et demie de route environ vers Abu Dhabi : mosquée Cheikh Zayed, Louvre "
              "Abu Dhabi, Yas Island."),
             ("Déplacements professionnels",
              "Délégations, salons, réunions multiples : plusieurs véhicules et un interlocuteur "
              "unique."),
         ]),
         sections=[
             ("Ce qu'il faut savoir sur les trajets à Dubaï", [
                 "Les heures de pointe sur Sheikh Zayed Road allongent considérablement les temps "
                 "de trajet, et les accès aux hôtels du Palm ou aux îles se font par des voies "
                 "uniques. Un rendez-vous mal placé dans la journée peut coûter deux heures.",
                 "Nous construisons donc le programme dans l'ordre géographique, pas seulement dans "
                 "l'ordre des envies. C'est la différence entre une journée fluide et une journée "
                 "passée en voiture.",
             ]),
             ("Un séjour complet", [
                 "Nous organisons également l'<a href=\"/location-villa-dubai\">hébergement</a>, "
                 "les <a href=\"/activites-vip-dubai\">expériences VIP</a>, le "
                 "<a href=\"/yacht-dubai\">yacht</a> et la recherche horlogère — voir "
                 "<a href=\"/montres-de-luxe-dubai\">montres de luxe à Dubaï</a>.",
                 "Le transport est la colonne vertébrale de tout cela : c'est lui qui détermine ce "
                 "qui est réellement faisable dans une journée.",
             ]),
         ],
         gallery=[("real/dubai-skyline.jpg", "Skyline de Dubaï"),
                  ("real/dubai-marina.jpg", "Dubaï Marina"),
                  ("real/mercedes-van.jpg", "Van avec chauffeur"),
                  ("real/desert-pool.jpg", "Camp dans le désert"),
                  ("real/dubai-palace.jpg", "Hôtel de luxe à Dubaï"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur du véhicule")],
         steps=("Comment réserver", [
             ("1. Votre programme", "Dates, vols, nombre de passagers, déplacements prévus."),
             ("2. Devis", "Prix ferme par transfert ou par journée."),
             ("3. Confirmation", "Chauffeur affecté, coordonnées transmises avant l'arrivée."),
             ("4. Sur place", "Prise en charge à DXB puis véhicule selon le programme."),
         ]),
         why=WHY_VAN,
         zones=("Dubaï", "",
                [("Conciergerie à Dubaï", "/conciergerie-dubai"),
                 ("Chauffeur privé à Dubaï", "/chauffeur-prive-dubai"),
                 ("Activités VIP à Dubaï", "/activites-vip-dubai"),
                 ("Yacht à Dubaï", "/yacht-dubai"),
                 ("Villa à Dubaï", "/location-villa-dubai")],
                "Voir aussi notre page <a href=\"/montres-de-luxe-dubai\"><strong>montres de luxe "
                "à Dubaï</strong></a>."),
         faq_title="Questions fréquentes — van avec chauffeur à Dubaï",
         faq=[
             ("Les chauffeurs parlent-ils français ?",
              "Nous proposons des chauffeurs francophones sur demande ; l'anglais est la langue "
              "courante sur place."),
             ("Le transfert depuis DXB est-il long ?",
              "Comptez de vingt minutes à une heure selon la destination et l'heure : Downtown est "
              "proche, la Marina et le Palm nettement plus éloignés."),
             ("Peut-on réserver plusieurs jours ?",
              "Oui, en mise à disposition à la journée avec le même chauffeur — la formule la plus "
              "efficace pour un séjour chargé."),
             ("Organisez-vous l'excursion dans le désert ?",
              "Oui, transport et camp compris, en coordination avec nos partenaires locaux."),
             ("Combien de personnes dans un van ?",
              "Jusqu'à sept passagers avec bagages ; au-delà, nous coordonnons plusieurs véhicules."),
             ("Quels sont les délais de réservation ?",
              "Quelques jours suffisent en général, mais les périodes de salons et de vacances "
              "scolaires du Golfe se réservent plus tôt."),
         ],
         form=("Votre transport à Dubaï",
               "Dates, vols, nombre de passagers et programme envisagé : nous revenons avec un "
               "devis ferme.",
               "Dubaï", "Van avec chauffeur"),
         footer=[("Dubaï", [("Conciergerie Dubaï", "/conciergerie-dubai"),
                            ("Activités VIP", "/activites-vip-dubai"),
                            ("Chauffeur privé", "/chauffeur-prive-dubai"),
                            ("Yacht", "/yacht-dubai"),
                            ("Villa", "/location-villa-dubai")]),
                 ("Transport", [("Van avec chauffeur Paris", "/van-avec-chauffeur-paris"),
                                ("Navette aéroport Paris", "/navette-aeroport-paris"),
                                ("Van pour mariage", "/van-avec-chauffeur-mariage"),
                                ("Van avec chauffeur Marrakech", "/van-avec-chauffeur-marrakech"),
                                ("Accueil", "/")])],
         tagline="Van avec chauffeur à Dubaï — transferts DXB, journées et "
                 "<span class=\"font-serif-italic\">excursions</span>.",
         lieu="Dubaï · Émirats arabes unis",
         mobcta="Demander un devis"),
]


def main() -> list:
    urls = [build(s) for s in PAGES]
    print(f"Horlogerie & vans : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
