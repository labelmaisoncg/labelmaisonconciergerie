# -*- coding: utf-8 -*-
"""Famille « transport et voyage » : 6 pages. Véhicules, vols premium, jet
privé, tables et événements : nous organisons et réservons via des partenaires
(loueurs, compagnies, courtiers aériens). Aucun tarif affiché."""
from __future__ import annotations

from . import commun as K

HUB = K.HUB_TRANSPORT
TRAIL = [("Accueil", "/"), ("Conciergerie privée", "/conciergerie-privee-paris")]


def base(**kw) -> dict:
    d = dict(nav=K.NAV_TRANSPORT, footer=K.FOOT_ACTIVITES, why=K.WHY_TRANSPORT, steps=K.STEPS_DEMANDE,
             area="Paris", lieu="Paris · Dubaï · Marrakech", cta="Demander un devis",
             mobcta="Demander un devis", gallery=K.P_VOITURE, trail=TRAIL,
             tagline="Transport, vols et expériences — le bon choix, "
                     "<span class=\"font-serif-italic\">au prix convenu</span>.")
    d.update(kw)
    return d


LIENS = [("Voitures de luxe à Paris", HUB), ("Voitures de luxe à Dubaï", "/location-voiture-de-luxe-dubai"),
         ("Vols business et première", "/billets-d-avion-business-class"), ("Jet privé", "/jet-prive-location"),
         ("Tables et restaurants", "/reservation-restaurant-paris-conciergerie"),
         ("Événement privé", "/organisation-evenement-prive-paris"),
         ("Chauffeur privé Paris", "/chauffeur-prive-paris"), ("Van avec chauffeur", "/van-avec-chauffeur-paris"),
         ("Navette aéroport", "/navette-aeroport-paris"), ("Activités VIP Paris", "/activites-vip-paris")]


def zones(exclure: str = "") -> tuple:
    return ("Transport et expériences : nos autres services", "", [l for l in LIENS if l[1] != exclure],
            "Vous organisez pour un tiers ? Voir notre programme "
            "<a href=\"/apporteur-d-affaires\"><strong>apporteur d'affaires</strong></a>.")


PAGES = [
    base(
        slug=HUB.strip("/"),
        title="Location de voiture de luxe à Paris — Ferrari, Lamborghini, Classe G, avec ou sans chauffeur | Label Maison",
        desc="Location de voiture de luxe et de sport à Paris : Ferrari, Lamborghini Urus, "
             "Mercedes Classe G, berlines, avec ou sans chauffeur. Livraison à l'hôtel ou à "
             "l'aéroport, devis ferme, dépôt et assurance annoncés.",
        crumb="Voitures de luxe", service_type="Location de véhicules de luxe avec ou sans chauffeur",
        offers=["Voitures de sport", "SUV de luxe", "Berlines avec chauffeur", "Livraison à l'adresse",
                "Mise à disposition journée ou semaine", "Transferts aéroport"],
        badge="🏎️ Paris · Voitures de luxe",
        h1="Voitures de luxe à <span class=\"font-serif-italic\">Paris</span>, avec ou sans chauffeur",
        sub="Une Ferrari pour un week-end, un Urus pour une semaine à Paris, une Classe G livrée à "
            "l'hôtel, une berline avec chauffeur pour une journée de rendez-vous : nous choisissons "
            "le véhicule avec vous et nous organisons tout.",
        photo=("real/ferrari.jpg", "Ferrari mise à disposition par la conciergerie"),
        puces=["Sport, SUV, <b>berlines</b>", "Avec ou sans <b>chauffeur</b>", "Livraison <b>hôtel / aéroport</b>", "Devis <b>ferme</b>"],
        intro=[
            "Louer une voiture d'exception à Paris est simple ; bien la louer l'est moins. Entre le "
            "dépôt de garantie qui n'apparaît qu'à la signature, l'assurance dont la franchise "
            "dépasse le prix de la location, le véhicule « identique » qui ne l'est pas, et la "
            "livraison qui arrive en retard, nos clients préfèrent que nous nous en occupions.",
            "Nous travaillons avec des loueurs partenaires dont nous connaissons les véhicules et "
            "les contrats, et nous vous proposons le bon modèle selon l'usage : image à donner, "
            "nombre de passagers, trajets, conduite personnelle ou chauffeur. Le devis est ferme, "
            "le dépôt et l'assurance sont annoncés avant que vous décidiez.",
        ],
        cards=("Les véhicules que nous mettons à disposition", "Selon disponibilité chez nos partenaires.", [
            ("Voitures de sport", "Ferrari, Lamborghini, McLaren, Porsche : pour un week-end, un "
             "événement ou une arrivée remarquée."),
            ("SUV de luxe", "Lamborghini Urus, Mercedes Classe G, Range Rover : confort, présence, "
             "espace pour la famille ou les bagages."),
            ("Berlines avec chauffeur", "Mercedes Classe S, BMW Série 7 : journée de rendez-vous, "
             "soirée, transfert."),
            ("Vans premium", "Mercedes Classe V : groupes, bagages, événements. Voir "
             "<a href=\"/van-avec-chauffeur-paris\">van avec chauffeur</a>."),
            ("Livraison", "Véhicule livré et repris à l'hôtel, à l'aéroport ou à l'adresse de votre "
             "choix."),
            ("Courte et longue durée", "De la journée à plusieurs semaines, avec kilométrage et "
             "conditions clairement convenus."),
        ]),
        sections=[
            ("Avec ou sans chauffeur ?", [
                "Sans chauffeur, pour le plaisir de conduire : permis, âge minimum et dépôt de "
                "garantie s'appliquent, et nous vous les annonçons avant. Avec chauffeur, pour une "
                "journée de rendez-vous, une soirée ou un transfert : vous ne vous occupez ni du "
                "stationnement, ni du trafic, ni de l'alcool au dîner. Beaucoup de nos clients "
                "combinent les deux sur un même séjour.",
            ]),
            ("Dépôt de garantie et assurance : ce qu'il faut savoir", [
                "Toute location de véhicule de prestige comporte un dépôt de garantie et une "
                "franchise en cas de dommage, parfois élevés. Nous vous indiquons leurs montants "
                "exacts dans le devis, ainsi que les options de rachat partiel de franchise lorsque "
                "le loueur les propose. Pas de découverte à la remise des clés.",
            ]),
        ],
        zones=zones(HUB),
        faq_title="Questions fréquentes — location de voiture de luxe à Paris",
        faq=[
            ("Quelles conditions pour conduire moi-même ?",
             "Permis de conduire valide depuis plusieurs années, âge minimum selon le véhicule, "
             "pièce d'identité et dépôt de garantie. Les conditions exactes dépendent du loueur et "
             "figurent dans le devis."),
            ("Livrez-vous à l'aéroport ?",
             "Oui, à Roissy, Orly et Le Bourget, ainsi qu'aux gares et hôtels."),
            ("Puis-je louer pour un mariage ou un tournage ?",
             "Oui : voir aussi <a href=\"/van-avec-chauffeur-mariage\">van pour mariage et "
             "événement</a> et <a href=\"/organisation-evenement-prive-paris\">organisation "
             "d'événement</a>."),
            ("Proposez-vous les mêmes véhicules à Dubaï ?",
             "Oui, et davantage : voir <a href=\"/location-voiture-de-luxe-dubai\">voitures de luxe "
             "à Dubaï</a>."),
        ] + K.faq_contact(),
        form=("Demander un devis", "Véhicule souhaité ou usage, dates, lieu de livraison, avec ou "
              "sans chauffeur : nous revenons vers vous avec un devis ferme.", "Paris", "Voiture de luxe"),
    ),

    base(
        slug="location-voiture-de-luxe-dubai",
        title="Location de voiture de luxe à Dubaï — Lamborghini, G63, Rolls-Royce, livrée à l'hôtel | Label Maison",
        desc="Louer une voiture de luxe à Dubaï avec notre conciergerie francophone : Lamborghini, "
             "Mercedes G63, Rolls-Royce, Ferrari, livrée à l'hôtel ou à l'aéroport. Conditions "
             "de permis, dépôt et assurance expliqués avant.",
        crumb="Dubaï", area="Dubaï", lieu="Dubaï · Paris",
        service_type="Location de véhicules de luxe à Dubaï", gallery=K.P_DUBAI,
        badge="🇦🇪 Dubaï · Voitures de luxe",
        h1="Voitures de luxe à <span class=\"font-serif-italic\">Dubaï</span>",
        sub="Dubaï est la ville où l'on conduit ce que l'on ne conduira jamais ailleurs. Encore "
            "faut-il un loueur sérieux, un contrat lisible et un véhicule livré à l'heure : notre "
            "conciergerie sur place s'en charge.",
        photo=("real/lamborghini.jpg", "Lamborghini Urus à Dubaï"),
        puces=["Livraison <b>hôtel / DXB</b>", "Permis <b>vérifié</b>", "Dépôt <b>annoncé</b>", "Francophone <b>7j/7</b>"],
        intro=[
            "Lamborghini, Mercedes G63, Rolls-Royce, Ferrari, Bentley : à Dubaï, l'offre est "
            "immense et les prix plus accessibles qu'en Europe. Mais les loueurs ne se valent pas : "
            "véhicules fatigués, dépôts bloqués pendant des semaines, amendes refacturées avec "
            "frais, assurance incomplète.",
            "Notre <a href=\"/conciergerie-dubai\">conciergerie à Dubaï</a> travaille avec des "
            "loueurs partenaires identifiés, vérifie les conditions de permis applicables à votre "
            "situation, et organise la livraison à l'hôtel ou à l'aéroport. Voir aussi "
            "<a href=\"/chauffeur-prive-dubai\">chauffeur privé à Dubaï</a>.",
        ],
        cards=("Ce que nous organisons à Dubaï", "", [
            ("Le véhicule", "Sport, SUV, limousine : choix selon l'usage, photos du véhicule réel "
             "avant confirmation."),
            ("Permis et conditions", "Permis international ou permis étranger accepté selon votre "
             "pays : nous vérifions avant de réserver."),
            ("Livraison", "À l'hôtel, à la villa ou à l'aéroport, à l'heure convenue."),
            ("Dépôt et assurance", "Montants et modalités de restitution annoncés avant."),
            ("Amendes et péages", "Fonctionnement du Salik et des radars expliqué, pour éviter les "
             "surprises à la restitution."),
            ("Avec chauffeur", "Pour les soirées et les journées de rendez-vous : berline ou SUV "
             "avec chauffeur francophone ou anglophone."),
        ]),
        sections=[
            ("Conduire à Dubaï : les règles à connaître", [
                "Les radars sont nombreux et les amendes élevées ; les péages Salik sont "
                "automatiques ; le stationnement se paie par application. Nous vous expliquons "
                "l'essentiel à la livraison. Un permis français est accepté pour une location "
                "touristique de courte durée dans la plupart des cas, mais les loueurs ont leurs "
                "exigences : nous les vérifions pour vous.",
            ]),
        ],
        zones=zones("/location-voiture-de-luxe-dubai"),
        faq_title="Questions fréquentes — voiture de luxe à Dubaï",
        faq=[
            ("Mon permis français suffit-il ?",
             "Pour la plupart des locations touristiques de courte durée, oui, parfois avec un "
             "permis international. Nous vérifions auprès du loueur pour votre cas précis."),
            ("Le dépôt est-il restitué vite ?",
             "Cela dépend du loueur ; nos partenaires le restituent dans un délai annoncé, après "
             "vérification des amendes."),
        ] + K.faq_contact(),
        form=("Demander un devis à Dubaï", "Véhicule, dates, lieu de livraison : nous revenons vers "
              "vous avec un devis ferme et les conditions.", "Dubaï", "Voiture de luxe — Dubaï"),
    ),

    base(
        slug="billets-d-avion-business-class",
        title="Billets d'avion business et première classe — réservation et optimisation par notre conciergerie | Label Maison",
        desc="Réservation de vols en business et première classe : compagnies, cabines, horaires, "
             "escales, surclassements, salons, fast track et transferts. Un interlocuteur, un "
             "itinéraire cohérent, des options comparées honnêtement.",
        crumb="Vols premium", area="International", gallery=K.P_VOYAGE,
        service_type="Réservation de vols en classes premium",
        badge="✈️ Vols · Business & première",
        h1="Vols en <span class=\"font-serif-italic\">business et première</span>, réservés comme il faut",
        sub="Même destination, mêmes dates : selon la compagnie, la cabine, l'escale et le moment "
            "de la réservation, le prix et le confort changent du tout au tout. Nous comparons, nous "
            "réservons, et nous organisons ce qu'il y a autour.",
        photo=("real/billetterie-avion.jpg", "Cabine d'un vol long-courrier"),
        puces=["Compagnies et cabines <b>comparées</b>", "Salons et <b>fast track</b>", "Transferts <b>calés</b>", "Un <b>interlocuteur</b>"],
        cta="Décrire mon voyage",
        intro=[
            "Réserver un vol en business n'est pas compliqué ; réserver le bon l'est davantage. Les "
            "cabines diffèrent selon l'avion et la compagnie, une escale bien choisie coûte moins "
            "cher qu'un direct sans être pénible, certains tarifs se négocient pour les groupes, et "
            "l'expérience se joue autant au sol — salon, fast track, transfert — qu'en vol.",
            "Nous réservons pour nos clients des vols vers Dubaï, le Maroc, l'Asie, les États-Unis "
            "et l'Europe, en business, première et jet privé, en comparant honnêtement les options "
            "et en organisant les transferts et les séjours à l'arrivée.",
        ],
        cards=("Ce que nous prenons en charge", "", [
            ("Comparaison des options", "Compagnies, type d'appareil et de cabine, horaires, escales, "
             "prix : trois propositions argumentées."),
            ("Réservation et billets", "Émission, sièges, repas, bagages, programmes de fidélité "
             "renseignés."),
            ("Surclassements", "Quand ils sont possibles et à quel prix, sans promesse impossible."),
            ("Au sol", "Salons, fast track, accueil personnalisé selon les aéroports et les "
             "compagnies."),
            ("Transferts", "Chauffeur à l'arrivée et au départ, coordonné avec les horaires réels."),
            ("Modifications", "Changements de dates, annulations, perturbations : nous gérons avec "
             "la compagnie."),
        ]),
        sections=[
            ("Business ou première : la différence qui compte", [
                "Sur un long-courrier, la business offre un siège-lit et un service soigné ; la "
                "première ajoute l'espace, l'intimité et un service individuel, sur un nombre "
                "limité de compagnies et de lignes. Pour un vol de nuit vers Dubaï ou Shanghai, "
                "la question est surtout : quelle cabine, sur quel appareil ? Nous vous le disons "
                "ligne par ligne.",
            ]),
            ("Vers Dubaï, le Maroc et l'Asie", [
                "Ce sont nos destinations les plus fréquentes, et nous y organisons l'après-vol : "
                "<a href=\"/conciergerie-dubai\">Dubaï</a>, <a href=\"/conciergerie-marrakech\">Marrakech</a>, "
                "<a href=\"/voyage-d-affaires-chine\">Chine</a>. Un seul interlocuteur du décollage à "
                "l'hôtel.",
            ]),
        ],
        zones=zones("/billets-d-avion-business-class"),
        faq_title="Questions fréquentes — vols business et première",
        faq=[
            ("Êtes-vous une agence de voyages ?",
             "Nous réservons via des partenaires agréés et nous vous conseillons ; la billetterie "
             "est émise par eux ou par la compagnie, avec les garanties correspondantes."),
            ("Trouvez-vous des prix inférieurs à ceux des sites de compagnies ?",
             "Parfois, selon les tarifs disponibles chez nos partenaires et la flexibilité sur les "
             "dates ; nous ne le promettons pas. Notre valeur est de choisir la bonne option et "
             "d'organiser tout le reste."),
            ("Organisez-vous aussi des vols en jet privé ?",
             "Oui : voir <a href=\"/jet-prive-location\">jet privé</a>."),
        ] + K.faq_contact(),
        form=("Décrivez votre voyage", "Destination, dates, nombre de passagers, cabine souhaitée : "
              "nous revenons vers vous avec des options comparées.", "International", "Vols premium"),
    ),

    base(
        slug="jet-prive-location",
        title="Jet privé : affrètement au départ de Paris — Le Bourget, Dubaï, Marrakech, Europe | Label Maison",
        desc="Affrètement de jet privé au départ de Paris-Le Bourget : choix de l'appareil selon "
             "la distance et le nombre de passagers, horaires libres, terminaux dédiés, transferts "
             "et séjour organisés. Devis via nos courtiers partenaires.",
        crumb="Jet privé", area="Europe, Moyen-Orient, Afrique du Nord", gallery=K.P_VOYAGE,
        service_type="Affrètement de jets privés",
        badge="🛩️ Jet privé · Le Bourget",
        h1="<span class=\"font-serif-italic\">Jet privé</span> au départ de Paris",
        sub="Partir à l'heure que vous choisissez, depuis un terminal sans file, avec les personnes "
            "que vous voulez : nous organisons l'affrètement avec nos courtiers partenaires, de "
            "l'appareil au transfert à l'arrivée.",
        photo=("real/proof-avion-poster.jpg", "Vue depuis le hublot d'un vol"),
        puces=["Le Bourget et <b>terminaux dédiés</b>", "Appareil <b>adapté</b>", "Horaires <b>libres</b>", "Transferts <b>inclus</b>"],
        cta="Demander un devis",
        intro=[
            "Le jet privé se justifie quand le temps compte plus que le prix : un aller-retour dans "
            "la journée en Europe, un départ pour Marrakech à l'heure du dîner, une délégation qui "
            "doit voyager ensemble, un trajet sans correspondance vers un aéroport secondaire. Il se "
            "justifie moins pour un vol de nuit vers Dubaï où une première classe fait très bien "
            "l'affaire — et nous vous le dirons.",
            "Nous organisons l'affrètement avec des courtiers partenaires : choix de l'appareil "
            "selon la distance et le nombre de passagers, terminaux d'aviation d'affaires, "
            "formalités, restauration à bord, et transfert en berline ou en van à l'arrivée.",
        ],
        cards=("Ce que nous organisons", "", [
            ("Choix de l'appareil", "Turbopropulseur, jet léger, moyen ou long-courrier selon la "
             "distance, les passagers et les bagages."),
            ("Terminaux", "Le Bourget à Paris, terminaux d'aviation d'affaires à destination : "
             "arrivée quinze minutes avant le départ."),
            ("Formalités", "Passeports, douane, animaux, bagages hors format : tout est anticipé."),
            ("À bord", "Restauration, boissons, demandes particulières."),
            ("Transferts", "Berline, van ou hélicoptère à l'arrivée, coordonnés à la minute."),
            ("Vols à vide", "Quand un appareil repositionné correspond à votre trajet, nous vous le "
             "proposons : c'est l'une des rares vraies économies du secteur."),
        ]),
        sections=[
            ("Combien coûte un jet privé ?", [
                "Le prix dépend de l'appareil, de la distance, des taxes d'aéroport et du "
                "positionnement de l'avion. Nous ne publions pas de grille parce qu'elle serait "
                "fausse le lendemain : nous demandons un devis à nos courtiers pour votre trajet "
                "précis, et nous vous le transmettons avec les options.",
            ]),
        ],
        zones=zones("/jet-prive-location"),
        faq_title="Questions fréquentes — jet privé",
        faq=[
            ("Quel délai pour affréter un jet ?",
             "Quelques heures pour un vol européen en cas d'urgence, quelques jours pour un vol "
             "long ou un appareil précis. Plus tôt, plus de choix."),
            ("Pouvez-vous organiser le séjour à l'arrivée ?",
             "Oui : villa, chauffeur, yacht, activités à Dubaï, Marrakech ou sur la Côte d'Azur."),
            ("Un vol à vide, c'est quoi ?",
             "Un appareil qui doit se repositionner sans passagers : s'il correspond à votre trajet "
             "et vos dates, le prix est nettement inférieur, au prix d'une flexibilité réduite."),
        ] + K.faq_contact(),
        form=("Demander un devis jet privé", "Trajet, dates, nombre de passagers, bagages : nous "
              "revenons vers vous avec les appareils disponibles et les prix.", "Paris-Le Bourget", "Jet privé"),
    ),

    base(
        slug="reservation-restaurant-paris-conciergerie",
        title="Réservation de restaurants à Paris par conciergerie — tables prisées, dernière minute, dîners privés | Label Maison",
        desc="Obtenir une table dans les restaurants les plus demandés de Paris, y compris en "
             "dernière minute : réservations, dîners d'affaires, tables pour groupes, salons "
             "privés, chefs à domicile. Un interlocuteur, une réponse rapide.",
        crumb="Tables à Paris", service_type="Réservation de restaurants et dîners privés à Paris",
        gallery=[("real/dining.jpg", "Table réservée par la conciergerie"), ("real/voiture-vip-interieur.jpeg", "Berline avec chauffeur pour la soirée"),
                 ("real/pshop-cadeau.jpg", "Attention préparée pour un dîner"), ("real/dubai-downtown-nuit.jpg", "Soirée en ville"),
                 ("real/yacht-82.jpg", "Dîner à bord d'un yacht"), ("real/louis-vuitton.jpg", "Avant le dîner, une maison de luxe")],
        badge="🍽️ Paris · Tables & dîners",
        h1="Une <span class=\"font-serif-italic\">table à Paris</span>, même quand c'est complet",
        sub="Dîner d'affaires, anniversaire, table de dernière minute, groupe de douze, salon privé "
            "ou chef à domicile : nous réservons là où il faut, à l'heure qu'il faut, et nous "
            "organisons la soirée autour.",
        photo=("real/dining.jpg", "Table réservée par la conciergerie"),
        puces=["Tables <b>prisées</b>", "Dernière <b>minute</b>", "Groupes et <b>salons privés</b>", "Chauffeur <b>coordonné</b>"],
        cta="Réserver une table",
        intro=[
            "Les meilleures tables de Paris affichent complet des semaines à l'avance, et les "
            "plateformes ne montrent qu'une partie des disponibilités. Une conciergerie entretient "
            "des relations avec les maisons, connaît les tables qui se libèrent et sait présenter "
            "une demande pour qu'elle soit acceptée.",
            "Nous réservons pour nos clients résidents, de passage et pour les entreprises qui "
            "reçoivent : restaurants gastronomiques, tables du moment, brasseries emblématiques, "
            "rooftops, salons privés, et chefs à domicile quand la soirée doit rester chez vous.",
        ],
        cards=("Ce que nous organisons", "", [
            ("La table du moment", "Restaurants très demandés, y compris en dernière minute selon "
             "les disponibilités réelles."),
            ("Dîner d'affaires", "Table calme, menu adapté, addition réglée discrètement, chauffeur "
             "coordonné."),
            ("Groupes", "Tables de huit à trente, menus de groupe, salons privés."),
            ("Occasions", "Anniversaire, demande en mariage, célébration : attentions, gâteau, "
             "fleurs, musique si le lieu le permet."),
            ("Chef à domicile", "Chef, service et vaisselle chez vous ou dans votre location."),
            ("Régimes et contraintes", "Allergies, halal, casher, végétarien : vérifiés avant la "
             "réservation."),
        ]),
        sections=[
            ("Pour les entreprises", [
                "Nous ouvrons des comptes pour les directions et les assistantes qui réservent "
                "régulièrement : un interlocuteur, une réponse dans l'heure, une facturation "
                "mensuelle. Voir aussi notre <a href=\"/conciergerie-privee-paris\">conciergerie "
                "privée à Paris</a>.",
            ]),
        ],
        zones=zones("/reservation-restaurant-paris-conciergerie"),
        faq_title="Questions fréquentes — réservation de restaurants",
        faq=[
            ("Pouvez-vous garantir une table dans un restaurant précis ?",
             "Non : les maisons restent maîtresses de leurs tables. Nous obtenons souvent ce qui "
             "semble impossible, et nous proposons une alternative de même niveau quand ce ne l'est "
             "pas."),
            ("Facturez-vous la réservation ?",
             "Des honoraires de conciergerie annoncés avant, selon la demande ; l'addition reste la "
             "vôtre, au prix du restaurant."),
        ] + K.faq_contact(),
        form=("Réserver une table", "Date, heure, nombre de convives, type de cuisine ou restaurant "
              "visé, occasion : nous revenons vers vous rapidement.", "Paris", "Réservation restaurant"),
    ),

    base(
        slug="organisation-evenement-prive-paris",
        title="Organisation d'événement privé à Paris — anniversaire, dîner, soirée, séminaire | Label Maison",
        desc="Organisation d'événements privés à Paris : anniversaire, dîner privé, soirée, "
             "demande en mariage, séminaire ou soirée d'entreprise. Lieu, traiteur, transport, "
             "animations, logistique : un interlocuteur, un budget tenu.",
        crumb="Événement privé", service_type="Organisation d'événements privés et d'entreprise à Paris",
        gallery=[("real/dining.jpg", "Table dressée pour un dîner privé"), ("real/yacht-82.jpg", "Yacht privatisé pour une soirée"),
                 ("real/mercedes-van.jpg", "Van avec chauffeur pour les invités"), ("real/pshop-cadeau.jpg", "Cadeaux pour les invités"),
                 ("real/ferrari.jpg", "Voiture d'exception pour une arrivée"), ("real/dubai-downtown-nuit.jpg", "Soirée de nuit")],
        badge="🥂 Paris · Événement privé",
        h1="Événement privé à <span class=\"font-serif-italic\">Paris</span>, organisé de bout en bout",
        sub="Un anniversaire à vingt, un dîner à cent, une demande en mariage, une soirée "
            "d'entreprise : nous trouvons le lieu, nous choisissons les prestataires, nous tenons "
            "le budget et le timing, et vous profitez de votre propre soirée.",
        photo=("real/yacht-82.jpg", "Yacht privatisé pour une soirée"),
        puces=["Lieu et <b>prestataires</b>", "Budget <b>tenu</b>", "Transport des <b>invités</b>", "Un <b>interlocuteur</b>"],
        cta="Organiser mon événement",
        intro=[
            "Un événement réussi se juge au fait que l'hôte en a profité. Cela suppose que "
            "quelqu'un d'autre ait géré le lieu, le traiteur, les boissons, la musique, les fleurs, "
            "le transport des invités, les imprévus, et le paiement de tout cela sans dépasser le "
            "budget convenu.",
            "Nous organisons à Paris et en Île-de-France des événements privés et d'entreprise de "
            "dix à plusieurs centaines d'invités : appartements et hôtels particuliers privatisés, "
            "restaurants, péniches et yachts, rooftops, lieux atypiques. Un interlocuteur, un "
            "devis global, un planning, et une présence sur place le jour J.",
        ],
        cards=("Ce que nous prenons en charge", "", [
            ("Le lieu", "Recherche, visite, négociation, contrat : appartement, hôtel particulier, "
             "restaurant privatisé, péniche, rooftop."),
            ("Traiteur et boissons", "Sélection, dégustation, menus adaptés aux régimes, service."),
            ("Ambiance", "Décoration, fleurs, lumière, musique (DJ, musiciens), photographe."),
            ("Transport", "Chauffeurs, vans, voitures d'exception pour une arrivée : voir "
             "<a href=\"/van-avec-chauffeur-mariage\">van pour mariage et événement</a>."),
            ("Invités", "Invitations, confirmations, accueil, hébergement des invités venus de loin."),
            ("Le jour J", "Coordination des prestataires, timing, imprévus : nous sommes sur place."),
        ]),
        sections=[
            ("Entreprises : séminaires, soirées, incentives", [
                "Pour les entreprises, nous organisons séminaires, soirées de fin d'année, "
                "lancements et incentives, à Paris et à "
                "<a href=\"/apporteur-d-affaires-dubai\">Dubaï</a> ou "
                "<a href=\"/conciergerie-marrakech\">Marrakech</a>. Un devis global, une facture, un "
                "interlocuteur, et des <a href=\"/cadeaux-d-affaires-luxe\">cadeaux d'affaires</a> "
                "si vous le souhaitez.",
            ]),
        ],
        zones=zones("/organisation-evenement-prive-paris"),
        faq_title="Questions fréquentes — événement privé à Paris",
        faq=[
            ("Combien de temps à l'avance faut-il vous contacter ?",
             "Quelques semaines pour un dîner ou un anniversaire, plusieurs mois pour un grand "
             "événement ou une date très demandée. En urgence, nous disons ce qui est possible."),
            ("Comment est fixé le budget ?",
             "Vous donnez une enveloppe, nous proposons une répartition et un devis global ; rien "
             "n'est engagé sans votre accord écrit."),
            ("Organisez-vous des mariages ?",
             "Oui, en coordination avec un wedding planner partenaire pour les grands mariages ; "
             "nous gérons seuls les cérémonies et réceptions intimes."),
        ] + K.faq_contact(),
        form=("Organiser votre événement", "Type d'événement, date, nombre d'invités, budget "
              "envisagé : nous revenons vers vous avec une première proposition.", "Paris", "Événement privé"),
    ),
]
