# -*- coding: utf-8 -*-
"""Côte d'Azur — pages « client final » (par opposition aux pages propriétaires).

Cible : celui qui cherche une conciergerie pour SON séjour (villa, yacht,
Festival de Cannes, Grand Prix de Monaco), pas un gestionnaire pour son bien.
Séparer les deux intentions évite que nos propres pages se concurrencent.
"""
from __future__ import annotations

import seo_common as C
from gen_seo_cotedazur import HUB, NAV, FOOT_CA, WHY_LUXE
from gen_seo_services import build

PAGES = [
    dict(slug="conciergerie-luxe-cannes",
         title="Conciergerie de luxe à Cannes — Festival, congrès, villas et services privés",
         desc="Conciergerie de luxe à Cannes : villas et appartements Croisette, chauffeur privé, "
              "yacht, tables, plages privées et assistance pendant le Festival et les grands congrès. "
              "Disponibilité 7j/7, discrétion absolue.",
         crumb="Conciergerie de luxe à Cannes",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Conciergerie privée de luxe à Cannes", area="Cannes",
         business=(" — Cannes", "Cannes", "Provence-Alpes-Côte d'Azur", "06400", "FR",
                   (43.5528, 7.0174), ["Cannes", "Mougins", "Le Cannet", "Côte d'Azur"]),
         offers=["Recherche de villa et d'appartement", "Chauffeur privé et transferts",
                 "Réservations de tables et de plages privées", "Location de yacht",
                 "Personnel de maison", "Assistance pendant les congrès"],
         badge="✨ Cannes · Conciergerie de luxe",
         h1="Conciergerie de luxe à <span class=\"font-serif-italic\">Cannes</span>",
         sub="Festival, MIPIM, MIPCOM, saison estivale : à Cannes, tout se réserve avant tout le "
             "monde. Villa, chauffeur, bateau, table, plage privée — nous ouvrons les portes qui "
             "sont censées être fermées.",
         photo=("real/suite-hotel.jpg", "Intérieur d'exception préparé pour un séjour à Cannes"),
         puces=["Pendant le <b>Festival</b>", "Villas & <b>Croisette</b>",
                "Chauffeur & <b>yacht</b>", "Discrétion <b>absolue</b>"],
         intro=[
             "À Cannes, la difficulté n'est pas de dépenser : c'est d'obtenir. Pendant le Festival ou "
             "le MIPIM, les villas partent des mois à l'avance, les tables sont bloquées, les "
             "chauffeurs sont réservés et les bateaux affrétés. Arriver sans relais local, c'est "
             "arriver trop tard.",
             "<strong>Label Maison Conciergerie</strong> prépare des séjours à Cannes et dans toute la "
             "baie — du Cannet à Mougins, de Golfe-Juan à Théoule. Nous nous occupons de l'hébergement, "
             "des déplacements, des réservations et de tout ce qui se décide à la dernière minute.",
         ],
         cards=("Ce que nous organisons à Cannes", "Une demande, un interlocuteur, une exécution.", [
             ("Hébergement d'exception",
              "Appartements Croisette, villas avec piscine à Mougins ou sur les hauteurs du Cannet, "
              "suites d'hôtel : nous cherchons selon vos critères, y compris en pleine période de congrès."),
             ("Chauffeur privé",
              "Berline, SUV ou van avec chauffeur, transferts depuis l'aéroport de Nice, mise à "
              "disposition à la journée pendant toute la durée de votre séjour."),
             ("Tables et plages privées",
              "Restaurants de la Croisette, plages privées, tables très demandées en pleine saison : "
              "nous réservons en amont et nous rattrapons les imprévus."),
             ("Yacht et mer",
              "Journée en mer vers les îles de Lérins ou Saint-Tropez, affrètement à la journée ou à "
              "la semaine avec équipage, via nos partenaires locaux."),
             ("Personnel de maison",
              "Chef à domicile, gouvernante, majordome, sécurité : nous constituons l'équipe adaptée "
              "à la durée et à la nature de votre séjour."),
             ("Assistance 7j/7",
              "Un numéro, une personne qui connaît votre dossier, et une réponse — y compris à "
              "22 heures un soir de Festival."),
         ]),
         sections=[
             ("Le Festival de Cannes se prépare en hiver", [
                 "Pendant les dix jours du Festival, la ville change d'échelle : hébergements, "
                 "chauffeurs, bateaux et tables sont bloqués des mois à l'avance, et les tarifs n'ont "
                 "plus rien à voir avec le reste de l'année.",
                 "Notre travail commence donc en amont : sécuriser l'hébergement, réserver les "
                 "véhicules et anticiper les déplacements — une Croisette bouclée ne se traverse pas "
                 "en voiture, et un transfert mal calé fait rater un rendez-vous. Il en va de même "
                 "pour le MIPIM en mars et le MIPCOM en octobre.",
             ]),
             ("Cannes ne s'arrête pas à la Croisette", [
                 "Les meilleures villas de la baie ne sont pas à Cannes : elles sont à "
                 "<a href=\"/conciergerie-airbnb-mougins\">Mougins</a>, sur les hauteurs du "
                 "<a href=\"/conciergerie-airbnb-le-cannet\">Cannet</a>, à "
                 "<a href=\"/conciergerie-airbnb-theoule-sur-mer\">Théoule</a> face à l'Estérel ou à "
                 "<a href=\"/conciergerie-airbnb-mandelieu-la-napoule\">Mandelieu</a>, à quinze "
                 "minutes du Palais des Festivals.",
                 "Nous couvrons l'ensemble de la baie, y compris "
                 "<a href=\"/conciergerie-airbnb-vallauris-golfe-juan\">Golfe-Juan</a> et "
                 "<a href=\"/conciergerie-airbnb-juan-les-pins\">Juan-les-Pins</a>, avec les mêmes "
                 "équipes et le même niveau d'exigence.",
             ]),
         ],
         gallery=[C.photo(k + 9) for k in range(6)],
         steps=("Comment nous travaillons", [
             ("1. Votre brief", "Dates, nombre de personnes, budget, contraintes : un appel suffit."),
             ("2. Proposition", "Hébergements sélectionnés, logistique, options : un dossier clair, "
              "chiffré, sous 48 heures dans la plupart des cas."),
             ("3. Réservation", "Nous bloquons, nous contractualisons, nous coordonnons les prestataires."),
             ("4. Sur place", "Un interlocuteur joignable en permanence pendant tout le séjour."),
         ]),
         why=WHY_LUXE,
         zones=("Nos autres services sur la Côte", "",
                [("Conciergerie privée à Nice", "/conciergerie-privee-nice"),
                 ("Villas à Saint-Tropez", "/conciergerie-villa-saint-tropez"),
                 ("Conciergerie à Monaco", "/conciergerie-monaco"),
                 ("Location de villa", "/location-villa-cote-d-azur"),
                 ("Yachting", "/conciergerie-yacht-cote-d-azur"),
                 ("Toute la Côte d'Azur", HUB)],
                "Propriétaire d'un bien à Cannes ? Voir notre "
                "<a href=\"/conciergerie-airbnb-cannes\"><strong>conciergerie Airbnb à Cannes</strong></a>."),
         faq_title="Questions fréquentes — conciergerie de luxe à Cannes",
         faq=[
             ("Peut-on vous solliciter en dernière minute pendant le Festival ?",
              "Oui, et cela arrive souvent. Nous ne promettons jamais l'impossible, mais notre réseau "
              "local permet régulièrement de trouver ce que les plateformes affichent complet."),
             ("Quels sont vos tarifs ?",
              "Ils dépendent entièrement de la demande : nous établissons un devis avant toute "
              "réservation, et rien n'est engagé sans votre accord écrit."),
             ("Intervenez-vous hors de Cannes ?",
              "Oui : toute la baie et l'ensemble de la Côte d'Azur, de Menton à Saint-Tropez, ainsi "
              "qu'à <a href=\"/conciergerie-marrakech\">Marrakech</a> et "
              "<a href=\"/conciergerie-dubai\">Dubaï</a>."),
             ("Comment garantissez-vous la confidentialité ?",
              "Aucun nom de client n'est communiqué, aucune adresse n'est diffusée, et nos partenaires "
              "sont tenus aux mêmes règles. C'est une condition de travail, pas une option."),
             ("Proposez-vous des chauffeurs pour plusieurs jours ?",
              "Oui, en mise à disposition à la journée ou pour toute la durée du séjour, en berline, "
              "SUV ou <a href=\"/van-avec-chauffeur-paris\">van</a> selon le nombre de passagers."),
             ("Gérez-vous aussi les séjours professionnels ?",
              "Oui : délégations pendant les congrès, hébergement d'équipes, logistique de "
              "déplacements et coordination sur place."),
         ],
         form=("Préparons votre séjour à Cannes",
               "Dates, nombre de personnes, ce que vous cherchez : nous revenons vers vous avec une "
               "proposition sur mesure et confidentielle.",
               "Cannes", "Conciergerie de luxe"),
         footer=FOOT_CA,
         tagline="Conciergerie de luxe à Cannes — Festival, congrès et séjours privés, "
                 "<span class=\"font-serif-italic\">orchestrés dans le détail</span>.",
         lieu="Cannes · Mougins · Le Cannet · Côte d'Azur"),

    dict(slug="conciergerie-privee-nice",
         title="Conciergerie privée à Nice — villas, transferts et services sur mesure",
         desc="Conciergerie privée à Nice et sur la Riviera : recherche de villa ou d'appartement, "
              "chauffeur privé, transferts aéroport Nice Côte d'Azur, réservations, personnel de "
              "maison et assistance 7j/7.",
         crumb="Conciergerie privée à Nice",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Conciergerie privée à Nice", area="Nice",
         business=(" — Nice", "Nice", "Provence-Alpes-Côte d'Azur", "06000", "FR",
                   (43.7102, 7.2620), ["Nice", "Villefranche-sur-Mer", "Saint-Jean-Cap-Ferrat",
                                       "Beaulieu-sur-Mer"]),
         offers=["Recherche d'hébergement", "Transferts aéroport", "Chauffeur privé",
                 "Réservations et expériences", "Personnel de maison"],
         badge="✨ Nice · Conciergerie privée",
         h1="Conciergerie privée à <span class=\"font-serif-italic\">Nice</span>",
         sub="De l'aéroport à la villa, du Cap-Ferrat au Vieux-Nice : nous organisons votre séjour "
             "sur la Riviera et restons joignables du premier au dernier jour.",
         photo=("real/residence-penthouse.jpg", "Résidence d'exception sur la Riviera"),
         puces=["Transferts <b>aéroport</b>", "Villas & <b>Cap-Ferrat</b>",
                "Réservations <b>premium</b>", "Assistance <b>7j/7</b>"],
         intro=[
             "Nice est la porte d'entrée de la Riviera : deuxième aéroport de France, dix minutes de "
             "Villefranche, vingt de Saint-Jean-Cap-Ferrat, quarante de Monaco. Encore faut-il que "
             "quelqu'un organise l'ensemble — arrivée, véhicule, maison, réservations, imprévus.",
             "C'est notre rôle. <strong>Label Maison Conciergerie</strong> prépare des séjours privés "
             "à Nice et sur toute la Riviera, pour des familles, des dirigeants et des clientèles "
             "internationales qui veulent une seule personne au bout du fil.",
         ],
         cards=("Nos services à Nice et sur la Riviera", "Une demande, une réponse, une exécution.", [
             ("Transferts et chauffeur",
              "Accueil à l'aéroport Nice Côte d'Azur, berline, SUV ou van avec chauffeur, mise à "
              "disposition à la journée sur toute la Riviera."),
             ("Hébergement",
              "Villa au Cap-Ferrat, appartement dans le Carré d'Or, maison à Villefranche ou suite "
              "d'hôtel : nous cherchons selon vos critères réels, pas selon un catalogue."),
             ("Réservations",
              "Tables, plages privées, spa, billetterie, excursions : nous réservons en amont et "
              "nous adaptons en cours de séjour."),
             ("Expériences en mer",
              "Journée en bateau vers les calanques, les îles ou Monaco, avec équipage, via nos "
              "partenaires locaux."),
             ("Personnel de maison",
              "Chef à domicile, gouvernante, nurse, sécurité : l'équipe est constituée selon la durée "
              "et la nature du séjour."),
             ("Assistance permanente",
              "Un interlocuteur unique joignable pendant tout le séjour, y compris pour les imprévus "
              "de dernière minute."),
         ]),
         sections=[
             ("De Nice au Cap-Ferrat : un territoire, plusieurs ambiances", [
                 "<a href=\"/conciergerie-airbnb-villefranche-sur-mer\">Villefranche-sur-Mer</a> pour "
                 "la rade et le calme, <a href=\"/conciergerie-airbnb-saint-jean-cap-ferrat\">"
                 "Saint-Jean-Cap-Ferrat</a> pour les villas de la presqu'île, "
                 "<a href=\"/conciergerie-airbnb-beaulieu-sur-mer\">Beaulieu</a> pour son microclimat, "
                 "<a href=\"/conciergerie-airbnb-eze\">Èze</a> pour les corniches.",
                 "Chacune de ces communes a ses codes, ses accès et ses contraintes de stationnement. "
                 "Nous les connaissons — c'est ce qui évite de perdre une heure entre deux rendez-vous "
                 "sur une route de corniche un samedi d'août.",
             ]),
             ("Séjours longs et pieds-à-terre", [
                 "Une partie de notre clientèle passe plusieurs semaines par an sur la Riviera. Pour "
                 "elle, nous assurons la préparation de la maison avant chaque arrivée, la gestion "
                 "des prestataires entre deux séjours et la surveillance du bien le reste de l'année.",
                 "Si vous êtes propriétaire, c'est exactement l'objet de notre "
                 "<a href=\"/gestion-villa-cote-d-azur\"><strong>gestion de villa</strong></a>.",
             ]),
         ],
         gallery=[C.photo(k + 3) for k in range(6)],
         steps=("Comment nous préparons votre séjour", [
             ("1. Brief", "Dates, composition du groupe, envies, contraintes."),
             ("2. Proposition", "Hébergements, logistique, expériences : un dossier chiffré."),
             ("3. Réservations", "Nous bloquons et coordonnons tous les prestataires."),
             ("4. Sur place", "Accueil, suivi quotidien, disponibilité permanente."),
         ]),
         why=WHY_LUXE,
         zones=("Autour de Nice", "",
                [("Villefranche-sur-Mer", "/conciergerie-airbnb-villefranche-sur-mer"),
                 ("Saint-Jean-Cap-Ferrat", "/conciergerie-airbnb-saint-jean-cap-ferrat"),
                 ("Beaulieu-sur-Mer", "/conciergerie-airbnb-beaulieu-sur-mer"),
                 ("Èze", "/conciergerie-airbnb-eze"),
                 ("Monaco", "/conciergerie-monaco"),
                 ("Toute la Côte d'Azur", HUB)],
                "Propriétaire à Nice ? Voir notre <a href=\"/conciergerie-airbnb-nice\"><strong>"
                "conciergerie Airbnb à Nice</strong></a>."),
         faq_title="Questions fréquentes — conciergerie privée à Nice",
         faq=[
             ("Assurez-vous les transferts depuis l'aéroport ?",
              "Oui, accueil en salle d'arrivée et transfert en berline, SUV ou van selon le nombre de "
              "passagers et de bagages, vers toute la Riviera et Monaco."),
             ("Peut-on faire appel à vous pour quelques heures seulement ?",
              "Oui. Certaines demandes tiennent en un transfert et une réservation ; d'autres "
              "couvrent trois semaines. Les deux nous vont."),
             ("Travaillez-vous avec les hôtels ?",
              "Oui, en complément : nous organisons ce qui se passe en dehors de l'hôtel, ou nous "
              "prenons en charge un séjour complet en villa."),
             ("Parlez-vous anglais ?",
              "Oui, nos échanges se font en français ou en anglais."),
             ("Quels délais pour organiser un séjour ?",
              "Le plus tôt est le mieux en juillet-août, mais nous traitons régulièrement des "
              "demandes à quelques jours. Nous vous dirons franchement ce qui reste faisable."),
             ("Intervenez-vous à Monaco ?",
              "Oui — voir notre page <a href=\"/conciergerie-monaco\">conciergerie à Monaco</a>."),
         ],
         form=("Organisons votre séjour sur la Riviera",
               "Dates, nombre de personnes, ce que vous souhaitez : nous revenons vers vous "
               "rapidement avec une proposition sur mesure.",
               "Nice", "Conciergerie privée"),
         footer=FOOT_CA,
         tagline="Conciergerie privée à Nice et sur la Riviera — "
                 "<span class=\"font-serif-italic\">un seul interlocuteur</span>, du premier au dernier jour.",
         lieu="Nice · Villefranche · Cap-Ferrat · Monaco"),

    dict(slug="conciergerie-villa-saint-tropez",
         title="Conciergerie de villa à Saint-Tropez — golfe, Pampelonne et services privés",
         desc="Conciergerie de villa à Saint-Tropez et dans le golfe : recherche et gestion de villa, "
              "personnel de maison, chef, chauffeur, bateau, plages de Pampelonne. Service sur mesure, "
              "discrétion absolue.",
         crumb="Villas à Saint-Tropez",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Conciergerie de villa à Saint-Tropez", area="Saint-Tropez",
         business=(" — Saint-Tropez", "Saint-Tropez", "Provence-Alpes-Côte d'Azur", "83990", "FR",
                   (43.2677, 6.6407), ["Saint-Tropez", "Ramatuelle", "Gassin", "Grimaud"]),
         offers=["Recherche de villa", "Gestion de villa", "Personnel de maison",
                 "Chef à domicile", "Chauffeur privé", "Réservations plages et tables"],
         badge="🌴 Saint-Tropez · Villas",
         h1="Conciergerie de villa à <span class=\"font-serif-italic\">Saint-Tropez</span>",
         sub="Dans le golfe, tout se joue sur l'exécution : la villa, l'équipe, la table de 21 h, le "
             "bateau du lendemain. Nous orchestrons l'ensemble, de Pampelonne à Port-Grimaud.",
         photo=("real/jacuzzi.jpg", "Villa avec espace bien-être dans le golfe de Saint-Tropez"),
         puces=["Villas & <b>Pampelonne</b>", "Chef & <b>personnel</b>",
                "Bateau & <b>plages</b>", "Discrétion <b>absolue</b>"],
         intro=[
             "Le golfe de Saint-Tropez fonctionne à guichets fermés dix semaines par an. Les villas se "
             "réservent l'hiver précédent, les meilleures équipes de maison sont déjà engagées, et les "
             "plages de Pampelonne ne gardent pas de table pour ceux qui appellent le matin même.",
             "<strong>Label Maison Conciergerie</strong> intervient sur l'ensemble du golfe — "
             "<a href=\"/conciergerie-airbnb-ramatuelle\">Ramatuelle</a>, "
             "<a href=\"/conciergerie-airbnb-gassin\">Gassin</a>, "
             "<a href=\"/conciergerie-airbnb-grimaud-port-grimaud\">Grimaud et Port-Grimaud</a>, "
             "<a href=\"/conciergerie-airbnb-cogolin\">Cogolin</a>, "
             "<a href=\"/conciergerie-airbnb-sainte-maxime\">Sainte-Maxime</a> — pour les séjours "
             "comme pour la gestion des villas à l'année.",
         ],
         cards=("Ce que nous organisons dans le golfe", "Le séjour, et tout ce qui le rend possible.", [
             ("Recherche de villa",
              "Villa avec piscine à Ramatuelle, maison de village à Gassin, propriété avec amarrage "
              "à Port-Grimaud : nous cherchons selon vos critères réels et vérifions ce qui est "
              "réellement disponible."),
             ("Personnel de maison",
              "Gouvernante, chef à domicile, majordome, nurse, sécurité : nous constituons et "
              "encadrons l'équipe pour la durée du séjour."),
             ("Plages et tables",
              "Pampelonne, restaurants du village, clubs : nous réservons en amont, là où les "
              "demandes de dernière minute se heurtent à des refus polis."),
             ("Bateau et mer",
              "Journée en mer, transferts par la mer vers Sainte-Maxime ou Port-Grimaud, "
              "affrètement avec équipage via nos partenaires."),
             ("Chauffeur et logistique",
              "Transferts depuis Nice, Toulon-Hyères ou la gare de Saint-Raphaël, mise à "
              "disposition sur place — indispensable en août dans le golfe."),
             ("Gestion à l'année",
              "Pour les propriétaires : location saisonnière, entretien, piscine, jardin et "
              "gardiennage hors saison. Voir notre <a href=\"/gestion-villa-cote-d-azur\">gestion "
              "de villa</a>."),
         ]),
         sections=[
             ("Pourquoi le golfe se prépare six mois à l'avance", [
                 "Entre fin juin et début septembre, la demande dépasse largement l'offre disponible "
                 "sur des communes qui comptent quelques milliers d'habitants à l'année. Les villas "
                 "de qualité sont engagées dès l'hiver, et les équipes de maison expérimentées le "
                 "sont tout autant.",
                 "Anticiper ne coûte rien ; improviser coûte cher, ou aboutit à un compromis. Nous "
                 "préférons vous le dire dès le premier échange plutôt que de vous laisser découvrir "
                 "en juin que tout est pris.",
             ]),
             ("Autour de Saint-Tropez, à quinze minutes", [
                 "Le village lui-même n'a qu'une capacité limitée. Les plus belles propriétés du "
                 "secteur sont à Ramatuelle, sur les hauteurs de Gassin, à Grimaud ou à "
                 "<a href=\"/conciergerie-airbnb-la-croix-valmer\">La Croix-Valmer</a> — souvent avec "
                 "plus d'espace, plus de calme, et un accès direct aux mêmes plages.",
                 "Nous couvrons tout le golfe avec les mêmes équipes, ce qui permet d'élargir la "
                 "recherche sans dégrader le niveau de service.",
             ]),
         ],
         gallery=[C.photo(k + 11) for k in range(6)],
         steps=("Comment nous procédons", [
             ("1. Cadrage", "Dates, nombre de chambres, budget, exigences (piscine, mer, personnel)."),
             ("2. Sélection", "Villas réellement disponibles, visitées ou vérifiées, avec un avis franc."),
             ("3. Organisation", "Personnel, transferts, réservations, avitaillement, bateau."),
             ("4. Séjour", "Un interlocuteur sur place, joignable en permanence."),
         ]),
         why=WHY_LUXE,
         zones=("Le golfe de Saint-Tropez", "",
                [("Ramatuelle", "/conciergerie-airbnb-ramatuelle"),
                 ("Gassin", "/conciergerie-airbnb-gassin"),
                 ("Grimaud et Port-Grimaud", "/conciergerie-airbnb-grimaud-port-grimaud"),
                 ("Sainte-Maxime", "/conciergerie-airbnb-sainte-maxime"),
                 ("La Croix-Valmer", "/conciergerie-airbnb-la-croix-valmer"),
                 ("Toute la Côte d'Azur", HUB)],
                "Propriétaire à Saint-Tropez ? Voir notre "
                "<a href=\"/conciergerie-airbnb-saint-tropez\"><strong>conciergerie Airbnb à "
                "Saint-Tropez</strong></a>."),
         faq_title="Questions fréquentes — villas à Saint-Tropez",
         faq=[
             ("Quand faut-il réserver pour juillet-août ?",
              "Idéalement entre décembre et mars. Au-delà, l'offre de villas de qualité se réduit "
              "très vite, surtout au-dessus de quatre chambres."),
             ("Fournissez-vous le personnel de maison ?",
              "Oui : gouvernante, chef, majordome, nurse ou sécurité, selon la durée et la taille du "
              "groupe. Nous encadrons l'équipe pendant tout le séjour."),
             ("Pouvez-vous réserver les plages de Pampelonne ?",
              "Nous réservons en amont auprès de nos partenaires. En pleine saison, la disponibilité "
              "dépend du jour et de l'heure — nous vous dirons ce qui est réaliste."),
             ("Intervenez-vous hors saison ?",
              "Oui, pour les séjours de printemps et d'automne, et toute l'année pour la gestion et "
              "le gardiennage des villas."),
             ("Gérez-vous ma villa si je la loue ?",
              "Oui : c'est notre <a href=\"/gestion-villa-cote-d-azur\">gestion de villa</a> — "
              "location, accueil, ménage, piscine, jardin, gardiennage."),
             ("Organisez-vous les transferts depuis Nice ?",
              "Oui, en véhicule avec chauffeur, ou par la mer selon la saison et vos préférences."),
         ],
         form=("Préparons votre séjour dans le golfe",
               "Dates, nombre de chambres, ce que vous attendez de la maison : nous revenons vers "
               "vous avec une sélection et un plan de séjour.",
               "Saint-Tropez", "Villa & conciergerie"),
         footer=FOOT_CA,
         tagline="Conciergerie de villa à Saint-Tropez — du golfe à "
                 "<span class=\"font-serif-italic\">Pampelonne</span>.",
         lieu="Saint-Tropez · Ramatuelle · Gassin · Grimaud"),

    dict(slug="conciergerie-monaco",
         title="Conciergerie à Monaco — services privés, résidences et Grand Prix",
         desc="Conciergerie privée à Monaco : gestion de résidence, personnel de maison, chauffeur, "
              "réservations, Grand Prix de Monaco et Yacht Show. Service confidentiel, disponibilité 7j/7.",
         crumb="Conciergerie à Monaco",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Conciergerie privée à Monaco", area="Monaco",
         business=(" — Monaco", "Monaco", "Monaco", "98000", "MC", (43.7384, 7.4246),
                   ["Monaco", "Cap-d'Ail", "Roquebrune-Cap-Martin", "Beausoleil"]),
         offers=["Gestion de résidence", "Personnel de maison", "Chauffeur privé",
                 "Réservations et événements", "Assistance Grand Prix et Yacht Show"],
         badge="🏁 Monaco · Conciergerie privée",
         h1="Conciergerie privée à <span class=\"font-serif-italic\">Monaco</span>",
         sub="Grand Prix, Yacht Show, saison : à Monaco, tout se joue sur l'anticipation et la "
             "discrétion. Résidence, personnel, véhicules, réservations — nous orchestrons.",
         photo=("real/voiture-vip-interieur.jpeg", "Véhicule avec chauffeur mis à disposition à Monaco"),
         puces=["Grand Prix & <b>Yacht Show</b>", "Gestion de <b>résidence</b>",
                "Chauffeur & <b>logistique</b>", "Confidentialité <b>totale</b>"],
         intro=[
             "Monaco tient sur deux kilomètres carrés, et deux événements y concentrent une part "
             "considérable de l'activité annuelle : le Grand Prix en mai et le Yacht Show en "
             "septembre. Pendant ces périodes, l'accès, le stationnement, l'hébergement et les tables "
             "relèvent de la logistique pure.",
             "<strong>Label Maison Conciergerie</strong> accompagne une clientèle privée à Monaco et "
             "sur les communes limitrophes — <a href=\"/conciergerie-airbnb-cap-d-ail\">Cap-d'Ail</a>, "
             "<a href=\"/conciergerie-airbnb-roquebrune-cap-martin\">Roquebrune-Cap-Martin</a>, "
             "<a href=\"/conciergerie-airbnb-menton\">Menton</a> — pour la gestion des résidences "
             "comme pour l'organisation des séjours.",
         ],
         cards=("Nos services à Monaco", "Anticipation, exécution, confidentialité.", [
             ("Gestion de résidence",
              "Préparation avant votre arrivée, entretien courant, coordination des prestataires et "
              "surveillance en votre absence, avec comptes rendus écrits."),
             ("Personnel de maison",
              "Gouvernante, chef à domicile, majordome, chauffeur : recrutement, encadrement ou "
              "simple coordination de votre personnel existant."),
             ("Véhicules et transferts",
              "Berline, SUV ou van avec chauffeur, transferts depuis Nice Côte d'Azur, hélicoptère "
              "via nos partenaires, logistique de stationnement pendant les grands événements."),
             ("Grand Prix de Monaco",
              "Hébergement dans les communes limitrophes, accès, terrasses et logistique de "
              "circulation : tout se prépare des mois à l'avance."),
             ("Yacht Show et mer",
              "Coordination avec les équipages, avitaillement, transferts et réservations pendant "
              "la semaine du salon."),
             ("Réservations et événements",
              "Tables, spas, soirées privées, billetterie : nous obtenons ce qui se ferme "
              "généralement aux demandes de dernière minute."),
         ]),
         sections=[
             ("Se loger autour de Monaco", [
                 "Le marché résidentiel monégasque est étroit et strictement encadré : la location de "
                 "courte durée n'y fonctionne pas comme ailleurs sur la Côte. Nous orientons donc "
                 "l'hébergement vers les communes limitrophes, à quelques minutes de la Principauté.",
                 "<a href=\"/conciergerie-airbnb-cap-d-ail\">Cap-d'Ail</a> est à une station de train, "
                 "<a href=\"/conciergerie-airbnb-roquebrune-cap-martin\">Roquebrune-Cap-Martin</a> à "
                 "cinq minutes, <a href=\"/conciergerie-airbnb-beaulieu-sur-mer\">Beaulieu</a> et "
                 "<a href=\"/conciergerie-airbnb-eze\">Èze</a> à un quart d'heure par la basse "
                 "corniche. C'est là que se trouvent les biens réellement disponibles.",
             ]),
             ("Le Grand Prix, c'est une opération logistique", [
                 "Pendant la semaine du Grand Prix, la Principauté se ferme progressivement : voies "
                 "neutralisées, accès filtrés, stationnement saturé. Un transfert improvisé devient "
                 "une marche de quarante minutes.",
                 "Nous préparons donc les déplacements heure par heure, avec des points de "
                 "dépose-reprise adaptés à la configuration du week-end, et un interlocuteur joignable "
                 "en permanence pour ajuster en direct.",
             ]),
         ],
         gallery=[C.photo(k + 7) for k in range(6)],
         steps=("Comment nous travaillons", [
             ("1. Brief confidentiel", "Vos dates, vos exigences, vos contraintes."),
             ("2. Plan et devis", "Hébergement, véhicules, personnel, réservations : tout est chiffré."),
             ("3. Coordination", "Nous engageons et pilotons les prestataires."),
             ("4. Présence sur place", "Un référent joignable pendant toute la durée du séjour."),
         ]),
         why=WHY_LUXE,
         zones=("Autour de la Principauté", "",
                [("Cap-d'Ail", "/conciergerie-airbnb-cap-d-ail"),
                 ("Roquebrune-Cap-Martin", "/conciergerie-airbnb-roquebrune-cap-martin"),
                 ("Beaulieu-sur-Mer", "/conciergerie-airbnb-beaulieu-sur-mer"),
                 ("Menton", "/conciergerie-airbnb-menton"),
                 ("Nice", "/conciergerie-privee-nice"),
                 ("Toute la Côte d'Azur", HUB)],
                "Voir aussi notre <a href=\"/conciergerie-yacht-cote-d-azur\"><strong>conciergerie "
                "yachting</strong></a> pour les escales en Principauté."),
         faq_title="Questions fréquentes — conciergerie à Monaco",
         faq=[
             ("Proposez-vous de la location courte durée à Monaco ?",
              "Le marché monégasque est très encadré et ne fonctionne pas comme le reste de la Côte. "
              "Nous orientons l'hébergement vers les communes limitrophes, à quelques minutes de la "
              "Principauté, et nous assurons la gestion des résidences pour leurs propriétaires."),
             ("Combien de temps à l'avance faut-il réserver pour le Grand Prix ?",
              "Plusieurs mois. Les hébergements du secteur et les prestataires sont engagés très tôt ; "
              "au-delà de la fin de l'hiver, le choix se réduit fortement."),
             ("Gérez-vous une résidence en notre absence ?",
              "Oui : visites régulières, entretien, coordination des prestataires, préparation avant "
              "chaque arrivée et comptes rendus écrits avec photos."),
             ("Assurez-vous les transferts depuis l'aéroport de Nice ?",
              "Oui, en véhicule avec chauffeur ou en hélicoptère via nos partenaires, selon vos "
              "préférences et la saison."),
             ("Quelle garantie de confidentialité ?",
              "Aucun nom, aucune adresse, aucune photo de client ne sont diffusés. Nos partenaires "
              "sont soumis aux mêmes règles."),
             ("Intervenez-vous aussi en Italie voisine ?",
              "Nous organisons régulièrement des déplacements vers la Ligurie depuis la Principauté "
              "et Menton, à quelques minutes de la frontière."),
         ],
         form=("Parlons de votre séjour ou de votre résidence",
               "Dates, nature de la demande, niveau de service attendu : nous revenons vers vous "
               "avec une proposition confidentielle.",
               "Monaco", "Conciergerie privée"),
         footer=FOOT_CA,
         tagline="Conciergerie privée à Monaco — Grand Prix, Yacht Show et "
                 "<span class=\"font-serif-italic\">gestion de résidence</span>.",
         lieu="Monaco · Cap-d'Ail · Roquebrune · Beaulieu"),

    dict(slug="location-villa-cote-d-azur",
         title="Location de villa sur la Côte d'Azur — sélection et séjour clé en main",
         desc="Location de villa sur la Côte d'Azur : sélection de propriétés avec piscine à "
              "Saint-Tropez, Cannes, Mougins, Ramatuelle et sur toute la Riviera, avec personnel, "
              "chef, chauffeur et conciergerie pendant le séjour.",
         crumb="Location de villa",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Recherche et location de villa sur la Côte d'Azur", area="Côte d'Azur",
         badge="🏡 Côte d'Azur · Location de villa",
         h1="Location de <span class=\"font-serif-italic\">villa</span> sur la Côte d'Azur",
         sub="Nous cherchons la maison qui correspond réellement à votre séjour, nous vérifions ce "
             "qu'elle vaut, et nous vous accompagnons du premier jour au dernier.",
         photo=("real/hero-logement-exception.jpg", "Villa d'exception sur la Côte d'Azur"),
         puces=["Villas <b>vérifiées</b>", "Avec <b>piscine</b>",
                "Personnel <b>à la carte</b>", "Conciergerie <b>incluse</b>"],
         intro=[
             "Chercher une villa sur la Côte d'Azur à partir d'annonces, c'est comparer des photos "
             "grand-angle prises il y a cinq ans. La vraie question n'est pas de savoir à quoi "
             "ressemble le salon : c'est de savoir si la piscine est chauffée, si la route d'accès "
             "passe avec un van, si la chambre du fond est climatisée, et qui répond en cas de panne.",
             "Nous sélectionnons des propriétés que nous connaissons ou que nous vérifions, nous vous "
             "disons ce qui ne va pas, et nous organisons le séjour autour : personnel, transferts, "
             "réservations, bateau.",
         ],
         cards=("Ce que comprend notre accompagnement", "La maison, et tout ce qui va avec.", [
             ("Sélection sur critères réels",
              "Nombre de chambres, exposition, distance des plages, accès, piscine chauffée ou non : "
              "nous filtrons sur ce qui compte vraiment pour votre groupe."),
             ("Vérification",
              "Nous confirmons l'état, les équipements et les conditions avant de vous proposer une "
              "maison. Un avis franc, y compris quand il est négatif."),
             ("Personnel à la carte",
              "Gouvernante, chef à domicile, majordome, nurse ou sécurité, selon la durée et la "
              "composition du séjour."),
             ("Transferts et véhicules",
              "Accueil à l'aéroport de Nice, Toulon-Hyères ou Marseille, véhicules avec chauffeur "
              "sur place, transferts par la mer selon la destination."),
             ("Réservations",
              "Plages privées, tables, spas, excursions, bateau : nous préparons le séjour avant "
              "votre arrivée."),
             ("Assistance pendant le séjour",
              "Un interlocuteur joignable en permanence : une panne, un imprévu, une envie de "
              "dernière minute se règlent sans que vous ayez à chercher un numéro."),
         ]),
         sections=[
             ("Où chercher selon votre séjour", [
                 "<strong>En famille avec de jeunes enfants :</strong> "
                 "<a href=\"/conciergerie-airbnb-mougins\">Mougins</a>, "
                 "<a href=\"/conciergerie-airbnb-vence\">Vence</a> ou "
                 "<a href=\"/conciergerie-airbnb-la-croix-valmer\">La Croix-Valmer</a> — du calme, "
                 "de l'espace, des plages accessibles.",
                 "<strong>Pour la vie nocturne et les plages :</strong> "
                 "<a href=\"/conciergerie-airbnb-ramatuelle\">Ramatuelle</a> et le golfe de "
                 "Saint-Tropez, <a href=\"/conciergerie-airbnb-juan-les-pins\">Juan-les-Pins</a>.",
                 "<strong>Pour la vue et la tranquillité :</strong> "
                 "<a href=\"/conciergerie-airbnb-eze\">Èze</a>, "
                 "<a href=\"/conciergerie-airbnb-theoule-sur-mer\">Théoule-sur-Mer</a>, "
                 "<a href=\"/conciergerie-airbnb-saint-paul-de-vence\">Saint-Paul-de-Vence</a>.",
             ]),
             ("Quand réserver", [
                 "Pour juillet et août, l'essentiel des belles maisons est engagé entre décembre et "
                 "mars. Passé le printemps, il reste des biens, mais le choix se restreint nettement "
                 "au-delà de quatre chambres.",
                 "Juin et septembre offrent souvent le meilleur compromis : la mer est bonne, les "
                 "routes sont praticables, les tables sont accessibles et les tarifs baissent "
                 "sensiblement.",
             ]),
         ],
         gallery=[C.photo(k + 1) for k in range(6)],
         steps=("Comment ça se passe", [
             ("1. Votre besoin", "Dates, nombre de personnes et de chambres, budget, secteur souhaité."),
             ("2. Sélection", "Trois à cinq maisons réellement disponibles, avec nos commentaires."),
             ("3. Réservation", "Contrat, acompte, conditions : nous sécurisons tout."),
             ("4. Séjour organisé", "Personnel, transferts, réservations et assistance sur place."),
         ]),
         why=WHY_LUXE,
         zones=("Nos secteurs de recherche", "",
                [("Golfe de Saint-Tropez", "/conciergerie-villa-saint-tropez"),
                 ("Cannes et sa baie", "/conciergerie-luxe-cannes"),
                 ("Nice et le Cap-Ferrat", "/conciergerie-privee-nice"),
                 ("Monaco", "/conciergerie-monaco"),
                 ("Toute la Côte d'Azur", HUB)],
                "Vous êtes propriétaire d'une villa ? Voir notre "
                "<a href=\"/gestion-villa-cote-d-azur\"><strong>gestion de villa</strong></a>."),
         faq_title="Questions fréquentes — location de villa sur la Côte d'Azur",
         faq=[
             ("Facturez-vous la recherche ?",
              "La recherche fait partie de l'accompagnement ; le détail des honoraires vous est "
              "communiqué avant tout engagement, sans surprise en cours de route."),
             ("Les villas sont-elles vérifiées ?",
              "Nous ne proposons que des biens que nous connaissons ou que nous avons fait vérifier. "
              "Si une maison présente un défaut, nous vous le disons avant que vous réserviez."),
             ("Peut-on ajouter du personnel en cours de séjour ?",
              "Oui, dans la limite des disponibilités locales — plus facile en juin qu'au 15 août, "
              "mais nous trouvons dans la plupart des cas."),
             ("Proposez-vous des séjours courts ?",
              "En pleine saison, la plupart des propriétaires imposent la semaine complète. Hors "
              "saison, les séjours de trois ou quatre nuits sont possibles."),
             ("Organisez-vous les transferts ?",
              "Oui, depuis Nice, Toulon-Hyères, Marseille ou les gares TGV, en véhicule avec "
              "chauffeur adapté au nombre de passagers."),
             ("Et si un problème survient dans la maison ?",
              "Vous nous appelez, nous traitons avec le propriétaire et les artisans. C'est "
              "précisément la différence avec une réservation en direct."),
         ],
         form=("Dites-nous ce que vous cherchez",
               "Dates, nombre de personnes, secteur et budget : nous revenons vers vous avec une "
               "sélection de maisons réellement disponibles.",
               "Côte d'Azur", "Location de villa"),
         footer=FOOT_CA,
         tagline="Location de villas sur la Côte d'Azur — "
                 "<span class=\"font-serif-italic\">sélection vérifiée</span> et séjour organisé.",
         lieu="Saint-Tropez · Cannes · Nice · Monaco"),

    dict(slug="conciergerie-yacht-cote-d-azur",
         title="Conciergerie yachting Côte d'Azur — escales, avitaillement et services à quai",
         desc="Conciergerie yachting sur la Côte d'Azur : préparation d'escale, avitaillement, "
              "transferts, réservations de plages et de tables, assistance équipage à Cannes, "
              "Saint-Tropez, Monaco et Antibes.",
         crumb="Yachting",
         trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Conciergerie yachting et assistance d'escale sur la Côte d'Azur",
         area="Côte d'Azur",
         badge="⚓ Côte d'Azur · Yachting",
         h1="Conciergerie <span class=\"font-serif-italic\">yachting</span> sur la Côte d'Azur",
         sub="Escales à Cannes, Antibes, Saint-Tropez ou Monaco : avitaillement, transferts, "
             "réservations et assistance à quai, préparés avant votre arrivée.",
         photo=("real/yacht-55.jpg", "Yacht en escale sur la Côte d'Azur"),
         puces=["Avitaillement", "Transferts <b>à quai</b>",
                "Plages & <b>tables</b>", "Assistance <b>équipage</b>"],
         intro=[
             "Une escale réussie se prépare à terre. Entre l'avitaillement, les transferts des "
             "invités, les réservations de plages et de restaurants, le linge, les fleurs et les "
             "imprévus techniques, l'équipage n'a ni le temps ni le réseau pour tout traiter depuis "
             "le bord — surtout un 14 août à Pampelonne.",
             "<strong>Label Maison Conciergerie</strong> travaille avec les équipages et les "
             "propriétaires sur les principaux ports de la Côte : "
             "<a href=\"/conciergerie-airbnb-juan-les-pins\">Antibes-Juan-les-Pins</a>, Cannes, "
             "<a href=\"/conciergerie-airbnb-saint-tropez\">Saint-Tropez</a>, "
             "<a href=\"/conciergerie-monaco\">Monaco</a>, "
             "<a href=\"/conciergerie-airbnb-grimaud-port-grimaud\">Port-Grimaud</a> et "
             "<a href=\"/conciergerie-airbnb-mandelieu-la-napoule\">La Napoule</a>.",
         ],
         cards=("Nos prestations d'escale", "Tout ce qui doit être prêt avant l'accostage.", [
             ("Avitaillement",
              "Courses, produits frais, épicerie fine, cave, fleurs : livrés à quai à l'heure "
              "convenue, selon la liste transmise par le bord."),
             ("Transferts des invités",
              "Accueil à l'aéroport de Nice ou aux gares, véhicules avec chauffeur, navettes entre "
              "le port et les rendez-vous à terre."),
             ("Réservations à terre",
              "Plages privées, restaurants, clubs, spas : réservés en amont, avec gestion des "
              "changements de dernière minute."),
             ("Services à quai",
              "Blanchisserie, pressing, coiffure, massage, courses urgentes : nous mobilisons des "
              "prestataires habitués aux contraintes du bord."),
             ("Assistance équipage",
              "Recherche de pièces, artisans, prestataires techniques et solutions de dépannage "
              "pendant la haute saison, quand tout est saturé."),
             ("Excursions à terre",
              "Arrière-pays, dégustations, visites privées, hélicoptère : nous organisons les "
              "journées à terre pendant que le bateau reste disponible."),
         ]),
         sections=[
             ("Le calendrier de la saison", [
                 "Le Grand Prix de Monaco en mai, le Festival de Cannes, les régates de printemps, "
                 "les Voiles de Saint-Tropez fin septembre et le Monaco Yacht Show en septembre : "
                 "sur ces périodes, les places, les prestataires et les tables sont pris d'assaut.",
                 "Nous préparons ces escales très en amont, avec des solutions de repli identifiées : "
                 "c'est la seule façon d'absorber un changement de programme sans dégrader le séjour "
                 "des invités.",
             ]),
             ("Travailler avec les équipages", [
                 "Nous nous adaptons aux méthodes du bord : liste d'avitaillement transmise la "
                 "veille, livraison à une heure précise, interlocuteur unique côté terre, et comptes "
                 "rendus écrits.",
                 "Pour les propriétaires, nous coordonnons également ce qui se passe à terre : villa "
                 "pour une partie du groupe, véhicules, personnel de maison. Voir notre "
                 "<a href=\"/gestion-villa-cote-d-azur\">gestion de villa</a> et notre "
                 "<a href=\"/location-villa-cote-d-azur\">location de villa</a>.",
             ]),
         ],
         gallery=[("real/yacht-82.jpg", "Yacht en navigation sur la Côte d'Azur"),
                  ("real/yacht-55.jpg", "Yacht à quai"),
                  ("real/yacht-50.jpg", "Yacht de croisière en Méditerranée"),
                  ("real/dining.jpg", "Table dressée pour un dîner privé"),
                  ("real/voiture-vip-interieur.jpeg", "Intérieur d'un véhicule avec chauffeur"),
                  ("real/mercedes-van.jpg", "Van avec chauffeur pour les transferts d'invités")],
         steps=("Comment se prépare une escale", [
             ("1. Programme", "Dates, port, nombre d'invités, contraintes du bord."),
             ("2. Plan d'escale", "Avitaillement, transferts, réservations, prestataires : chiffrés à l'avance."),
             ("3. Exécution", "Livraisons à quai, véhicules, réservations confirmées."),
             ("4. Pendant l'escale", "Un référent joignable en permanence pour les ajustements."),
         ]),
         why=WHY_LUXE,
         zones=("Nos ports d'intervention", "",
                [("Cannes", "/conciergerie-luxe-cannes"),
                 ("Saint-Tropez", "/conciergerie-villa-saint-tropez"),
                 ("Monaco", "/conciergerie-monaco"),
                 ("Port-Grimaud", "/conciergerie-airbnb-grimaud-port-grimaud"),
                 ("La Napoule", "/conciergerie-airbnb-mandelieu-la-napoule"),
                 ("Toute la Côte d'Azur", HUB)],
                "Voir aussi notre <a href=\"/yacht-dubai\"><strong>offre yachting à Dubaï</strong></a>."),
         faq_title="Questions fréquentes — conciergerie yachting",
         faq=[
             ("Êtes-vous courtier en yachts ?",
              "Non. Nous sommes une conciergerie : nous préparons les escales et les services à terre, "
              "et nous mettons en relation avec des courtiers et des sociétés d'affrètement "
              "partenaires quand la demande porte sur l'affrètement lui-même."),
             ("Livrez-vous l'avitaillement à quai ?",
              "Oui, à l'heure convenue avec le bord, sur les principaux ports de la Côte, y compris "
              "en haute saison."),
             ("Travaillez-vous directement avec l'équipage ?",
              "Oui, c'est le cas le plus fréquent : un interlocuteur unique côté terre, disponible "
              "pour le chef, le chief stew ou le capitaine."),
             ("Pouvez-vous organiser les transferts des invités ?",
              "Oui : aéroport de Nice, gares, héliports, avec des véhicules adaptés au nombre de "
              "passagers et de bagages."),
             ("Intervenez-vous en dehors de la Côte d'Azur ?",
              "Sur la Méditerranée française et à Monaco. Pour d'autres destinations, nous étudions "
              "la demande au cas par cas."),
             ("Quels délais pour préparer une escale ?",
              "Quelques jours suffisent hors saison. En juillet-août, plus l'anticipation est longue, "
              "plus le choix reste ouvert."),
         ],
         form=("Préparons votre prochaine escale",
               "Port, dates, nombre d'invités et besoins du bord : nous revenons vers vous avec un "
               "plan d'escale chiffré.",
               "Côte d'Azur", "Conciergerie yachting"),
         footer=FOOT_CA,
         tagline="Conciergerie yachting sur la Côte d'Azur — escales préparées, "
                 "<span class=\"font-serif-italic\">services à quai</span>.",
         lieu="Cannes · Antibes · Saint-Tropez · Monaco"),
]


def main() -> list:
    urls = [build(s) for s in PAGES]
    print(f"Côte d'Azur premium : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
