# -*- coding: utf-8 -*-
"""Silo SEO Paris : une page par arrondissement + un hub.

Cible : le propriétaire parisien qui cherche « conciergerie Airbnb Paris 11 »,
« gestion locative courte durée 75008 », « qui s'occupe de mon Airbnb à Paris ».

Chaque page est écrite autour de données réelles de l'arrondissement (quartiers
administratifs, lieux, type de demande locative) pour éviter les pages jumelles :
Google sanctionne les silos dupliqués, pas les silos denses.

Aucune statistique de rendement n'est inventée : on parle méthode, pas chiffres.
"""
from __future__ import annotations

import seo_common as C

HUB = "/conciergerie-airbnb-paris"

# num, label, cp, geo, quartiers, lieux, hook, demande, bien
ARR = [
    (1, "1er", "75001", (48.8607, 2.3358),
     ["Saint-Germain-l'Auxerrois", "Les Halles", "Palais-Royal", "Place Vendôme"],
     ["le Louvre", "les Tuileries", "la rue de Rivoli", "Westfield Forum des Halles"],
     "Le 1er est l'hypercentre absolu : on y dort à cinq minutes à pied du Louvre, et la demande ne connaît quasiment pas de saison creuse.",
     "Couples en court séjour culturel, clientèle d'affaires du quartier Vendôme, visiteurs internationaux qui veulent tout faire à pied.",
     "Petites surfaces haussmanniennes, studios sous combles et deux-pièces de standing."),
    (2, "2e", "75002", (48.8686, 2.3412),
     ["Gaillon", "Vivienne", "Le Mail", "Bonne-Nouvelle"],
     ["Montorgueil", "les passages couverts", "la Bourse", "l'Opéra Garnier"],
     "Le plus petit arrondissement de Paris concentre les passages couverts, Montorgueil et le quartier d'affaires de la Bourse : séjours pros en semaine, city-break le week-end.",
     "Consultants et cadres en mission à la semaine, couples attirés par Montorgueil, voyageurs qui veulent l'Opéra à pied.",
     "Deux-pièces rénovés, lofts d'anciens ateliers du Sentier, studios bien optimisés."),
    (3, "3e", "75003", (48.8637, 2.3615),
     ["Arts-et-Métiers", "Enfants-Rouges", "Archives", "Sainte-Avoye"],
     ["le Haut-Marais", "le musée Picasso", "le Carreau du Temple", "le marché des Enfants-Rouges"],
     "Le Haut-Marais est devenu l'un des quartiers les plus désirables de Paris : galeries, créateurs, cafés — une clientèle qui réserve tôt et paie la qualité.",
     "Clientèle mode et design, couples européens en week-end long, voyageurs américains fidèles au Marais.",
     "Appartements de caractère avec poutres, duplex sur cour, petites surfaces très décorées."),
    (4, "4e", "75004", (48.8546, 2.3572),
     ["Saint-Merri", "Saint-Gervais", "L'Arsenal", "Notre-Dame"],
     ["la place des Vosges", "l'île Saint-Louis", "le Centre Pompidou", "l'Hôtel de Ville"],
     "Entre la place des Vosges et l'île Saint-Louis, le 4e est le Paris de carte postale : c'est l'un des rares secteurs où un bien bien tenu se remplit toute l'année.",
     "Couples en voyage anniversaire, familles en court séjour, clientèle internationale haut de gamme.",
     "Petits volumes anciens, appartements sous toit avec vue, biens familiaux rue Saint-Antoine."),
    (5, "5e", "75005", (48.8448, 2.3471),
     ["Saint-Victor", "Sorbonne", "Val-de-Grâce", "Jardin-des-Plantes"],
     ["le Panthéon", "la rue Mouffetard", "le Jardin des Plantes", "les quais de Seine"],
     "Le Quartier latin vit au rythme des universités et des congrès : la demande y est plus régulière et moins dépendante du tourisme pur que dans le reste du centre.",
     "Universitaires et intervenants en colloque, familles en visite scolaire, voyageurs culturels.",
     "Studios et deux-pièces d'immeubles anciens, chambres de bonne réunies, biens familiaux Mouffetard."),
    (6, "6e", "75006", (48.8496, 2.3327),
     ["Monnaie", "Odéon", "Notre-Dame-des-Champs", "Saint-Germain-des-Prés"],
     ["Saint-Germain-des-Prés", "le jardin du Luxembourg", "l'Odéon", "la rue de Buci"],
     "Saint-Germain-des-Prés reste l'adresse la plus prestigieuse de la rive gauche : la clientèle y arbitre sur la qualité de la décoration et du service, rarement sur le prix.",
     "Clientèle américaine et asiatique haut de gamme, couples en séjour d'exception, longs séjours d'expatriés.",
     "Appartements de standing avec parquet et moulures, biens d'exception vue Luxembourg."),
    (7, "7e", "75007", (48.8565, 2.3125),
     ["Saint-Thomas-d'Aquin", "Invalides", "École-Militaire", "Gros-Caillou"],
     ["la tour Eiffel", "le musée d'Orsay", "les Invalides", "la rue Cler"],
     "Une vue sur la tour Eiffel change tout : dans le 7e, le cadrage d'une fenêtre pèse autant que la surface du bien dans le prix d'une nuit.",
     "Familles internationales, voyageurs de noces, clientèle diplomatique et institutionnelle.",
     "Grands appartements familiaux, biens avec vue tour Eiffel, pied-à-terre de standing."),
    (8, "8e", "75008", (48.8725, 2.3125),
     ["Champs-Élysées", "Faubourg-du-Roule", "Madeleine", "Europe"],
     ["l'avenue Montaigne", "le Triangle d'Or", "le parc Monceau", "la Madeleine"],
     "Le 8e, c'est le Triangle d'Or : clientèle d'affaires en semaine, shopping de luxe le week-end, et des exigences de service qui rejoignent celles de l'hôtellerie.",
     "Dirigeants en déplacement, clientèle du Golfe en saison, séjours shopping haut de gamme.",
     "Appartements haussmanniens de réception, pied-à-terre de luxe, biens avec service d'immeuble."),
    (9, "9e", "75009", (48.8768, 2.3399),
     ["Saint-Georges", "Chaussée-d'Antin", "Faubourg-Montmartre", "Rochechouart"],
     ["les Galeries Lafayette", "l'Opéra Garnier", "SoPi (South Pigalle)", "les Grands Boulevards"],
     "Entre grands magasins et South Pigalle, le 9e cumule tourisme de shopping et vie nocturne : un bien bien insonorisé et bien équipé s'y loue vite.",
     "Voyageurs shopping, groupes d'amis, clientèle d'affaires du quartier de l'Opéra.",
     "Deux et trois-pièces haussmanniens, studios optimisés, appartements rénovés SoPi."),
    (10, "10e", "75010", (48.8709, 2.3603),
     ["Saint-Vincent-de-Paul", "Porte-Saint-Denis", "Porte-Saint-Martin", "Hôpital-Saint-Louis"],
     ["le canal Saint-Martin", "la gare du Nord", "la gare de l'Est", "la rue du Faubourg-Saint-Denis"],
     "Deux gares internationales et le canal Saint-Martin : le 10e capte à la fois les séjours courts en Eurostar et le Paris jeune que cherchent les Européens.",
     "Voyageurs Eurostar et Thalys, jeunes couples européens, séjours de deux ou trois nuits.",
     "Studios et deux-pièces canal, appartements d'immeubles anciens rénovés."),
    (11, "11e", "75011", (48.8594, 2.3765),
     ["Folie-Méricourt", "Saint-Ambroise", "La Roquette", "Sainte-Marguerite"],
     ["Oberkampf", "la Bastille", "le marché d'Aligre voisin", "la rue de Charonne"],
     "Le 11e est l'arrondissement le plus demandé par les voyageurs qui veulent « vivre comme un Parisien » : restaurants, bars, marchés, et une demande très stable toute l'année.",
     "Trentenaires européens, groupes d'amis, séjours de trois à cinq nuits.",
     "Deux-pièces d'immeubles faubouriens, lofts d'anciens ateliers, appartements sur cour."),
    (12, "12e", "75012", (48.8409, 2.3876),
     ["Bel-Air", "Picpus", "Bercy", "Quinze-Vingts"],
     ["la gare de Lyon", "Bercy Village", "la coulée verte René-Dumont", "le bois de Vincennes"],
     "Avec la gare de Lyon et l'Accor Arena, le 12e vit au rythme des arrivées TGV et des grands événements : une demande à la fois touristique et événementielle.",
     "Voyageurs TGV, public de concerts à Bercy, familles attirées par le bois de Vincennes.",
     "Appartements familiaux, deux-pièces proches gare, biens avec balcon côté Bel-Air."),
    (13, "13e", "75013", (48.8322, 2.3561),
     ["Salpêtrière", "Gare", "Maison-Blanche", "Croulebarbe"],
     ["la Butte-aux-Cailles", "la BnF François-Mitterrand", "la gare d'Austerlitz", "le quartier asiatique des Olympiades"],
     "Le 13e reste l'un des rapports qualité-prix les plus intéressants de Paris intra-muros : moins cher à l'achat, très bien desservi, avec une demande hôtelière soutenue autour d'Austerlitz.",
     "Séjours médicaux autour de la Pitié-Salpêtrière, voyageurs d'affaires, clientèle asiatique.",
     "Studios et deux-pièces des années 70 bien agencés, appartements Butte-aux-Cailles."),
    (14, "14e", "75014", (48.8331, 2.3264),
     ["Montparnasse", "Parc-de-Montsouris", "Petit-Montrouge", "Plaisance"],
     ["la gare Montparnasse", "les Catacombes", "le parc Montsouris", "la rue Daguerre"],
     "Le 14e joue la carte du calme résidentiel à dix minutes du centre : la clientèle familiale et les longs séjours y sont surreprésentés.",
     "Familles, séjours d'une semaine et plus, voyageurs de l'Ouest via Montparnasse.",
     "Trois-pièces familiaux, ateliers d'artistes, appartements calmes sur jardin."),
    (15, "15e", "75015", (48.8412, 2.3003),
     ["Saint-Lambert", "Necker", "Grenelle", "Javel"],
     ["la porte de Versailles", "Beaugrenelle", "le front de Seine", "l'hôpital Necker"],
     "Le plus peuplé des arrondissements vit aussi au rythme du parc des expositions : pendant les salons de la porte de Versailles, la demande explose sur quelques jours.",
     "Exposants et visiteurs de salons, familles hospitalisées à Necker, clientèle d'affaires.",
     "Deux et trois-pièces des années 60-70, appartements avec parking, biens familiaux."),
    (16, "16e", "75016", (48.8637, 2.2769),
     ["Auteuil", "La Muette", "Porte-Dauphine", "Chaillot"],
     ["le Trocadéro", "le bois de Boulogne", "Roland-Garros", "le Parc des Princes"],
     "Le 16e est l'arrondissement des grands événements : Roland-Garros, les matchs au Parc des Princes et les congrès du Palais des Congrès voisin créent des pics de demande très rémunérateurs.",
     "Clientèle familiale internationale, séjours événementiels, longs séjours d'expatriés.",
     "Grands appartements bourgeois, biens vue tour Eiffel côté Trocadéro, duplex Auteuil."),
    (17, "17e", "75017", (48.8871, 2.3175),
     ["Ternes", "Plaine-de-Monceau", "Batignolles", "Épinettes"],
     ["le Palais des Congrès porte Maillot", "le parc Martin-Luther-King", "le village Batignolles", "le parc Monceau"],
     "Deux 17e cohabitent : la plaine Monceau bourgeoise et les Batignolles, devenues l'un des quartiers les plus recherchés du nord de Paris depuis l'arrivée du nouveau parc.",
     "Congressistes de la porte Maillot, jeunes familles, clientèle d'affaires.",
     "Haussmanniens côté Ternes, appartements neufs Clichy-Batignolles, deux-pièces village."),
    (18, "18e", "75018", (48.8925, 2.3444),
     ["Grandes-Carrières", "Clignancourt", "Goutte-d'Or", "La Chapelle"],
     ["Montmartre", "le Sacré-Cœur", "les Abbesses", "les puces de Saint-Ouen"],
     "Montmartre est, avec le Marais, la recherche la plus tapée par les voyageurs qui préparent Paris : sur la Butte, un bien avec vue ou avec escalier photogénique part très vite.",
     "Couples en week-end, voyageurs internationaux première visite, chineurs des puces.",
     "Studios de charme sur la Butte, deux-pièces Abbesses, appartements avec vue toits."),
    (19, "19e", "75019", (48.8817, 2.3822),
     ["La Villette", "Pont-de-Flandre", "Amérique", "Combat"],
     ["les Buttes-Chaumont", "la Cité des sciences", "le bassin de la Villette", "la Philharmonie"],
     "Le 19e concentre les grands équipements culturels du nord-est : Philharmonie, Cité des sciences, La Villette — un public familial et événementiel toute l'année.",
     "Familles avec enfants, public de concerts et festivals, séjours de moyenne durée.",
     "Appartements familiaux, biens avec balcon vue Buttes-Chaumont, lofts canal."),
    (20, "20e", "75020", (48.8639, 2.3985),
     ["Belleville", "Saint-Fargeau", "Père-Lachaise", "Charonne"],
     ["le Père-Lachaise", "Ménilmontant", "la rue des Pyrénées", "le parc de Belleville"],
     "Belleville et Ménilmontant attirent la clientèle qui fuit le Paris carte postale : séjours plus longs, budget maîtrisé, très bons taux d'occupation hors saison.",
     "Jeunes voyageurs européens, séjours de moyenne durée, clientèle culturelle.",
     "Ateliers reconvertis, deux-pièces avec vue dégagée, appartements de villas pavillonnaires."),
]

SERVICES_A = [
    ("Annonce & tarification dynamique",
     "Rédaction, shooting, mise en ligne sur Airbnb, Booking et Abritel, puis ajustement des prix nuit par nuit selon les événements du quartier et la saison."),
    ("Accueil des voyageurs",
     "Remise des clés en personne ou boîte sécurisée, arrivées tardives acceptées, guide numérique du logement et réponses aux messages en continu."),
    ("Ménage & linge hôtelier",
     "Équipes formées au standard hôtelier, linge de maison fourni et blanchi, réassort des consommables et check photo après chaque départ."),
    ("Maintenance & petits travaux",
     "Réseau d'artisans parisiens mobilisable rapidement : plomberie, serrurerie, électroménager, remise en état après incident."),
    ("Suivi des revenus",
     "Un point mensuel clair : réservations, revenus encaissés, taux d'occupation réel de votre bien, et les leviers pour l'améliorer."),
    ("Conformité & déclarations",
     "Accompagnement sur le numéro d'enregistrement, la taxe de séjour et le suivi du plafond de nuitées de la résidence principale."),
]
SERVICES_B = [
    ("Mise en marché du bien",
     "Photos professionnelles, annonce optimisée pour la recherche Airbnb et diffusion multi-plateformes pour ne jamais dépendre d'un seul canal."),
    ("Prix ajustés en continu",
     "Nous suivons les salons, congrès et événements parisiens pour monter les tarifs quand la ville se remplit et rester attractifs le reste du temps."),
    ("Check-in 7j/7",
     "Vos voyageurs sont accueillis à toute heure, avec vérification d'identité et caution le cas échéant : moins d'incidents, de meilleurs avis."),
    ("Hôtellerie & propreté",
     "Ménage professionnel entre chaque séjour, linge fourni, produits d'accueil, et contrôle systématique de l'état du logement."),
    ("Interventions techniques",
     "Un artisan de confiance sur place rapidement en cas de panne : le séjour continue, votre note reste intacte."),
    ("Reporting propriétaire",
     "Revenus, calendrier, avis reçus : vous gardez la main sur votre bien sans avoir à gérer un seul message."),
]

POURQUOI = [
    ("Nous connaissons Paris rue par rue",
     "Un bien près d'un parc des expositions ne se tarifie pas comme un bien du Marais. Nous adaptons la stratégie à votre adresse exacte, pas à une moyenne parisienne."),
    ("Zéro gestion pour vous",
     "Vous nous confiez les clés, nous prenons tout : annonces, messages, ménage, linge, incidents, départs. Vous suivez vos revenus, c'est tout."),
    ("Rémunération au résultat",
     "Notre commission est un pourcentage des revenus générés. Si vous ne gagnez rien, nous ne gagnons rien : nos intérêts sont alignés avec les vôtres."),
    ("Votre bien protégé",
     "Sélection des voyageurs, état des lieux photo à chaque rotation, réseau d'artisans : votre appartement est traité comme s'il était le nôtre."),
]


def voisins(num: int) -> list:
    """Arrondissements liés : les deux voisins numériques + deux repères."""
    order = [n for n, *_ in ARR]
    idx = order.index(num)
    picks = []
    for d in (-2, -1, 1, 2):
        j = (idx + d) % len(order)
        picks.append(ARR[j])
    return picks


def lab(a) -> str:
    return f"Paris {a[1]}"


def page_arr(a, i: int) -> None:
    num, label, cp, geo, quartiers, lieux, hook, demande, bien = a
    slug = f"conciergerie-airbnb-paris-{label}"  # …-1er, …-2e, … …-20e
    path = "/" + slug
    url = C.SITE + path
    ville = f"Paris {label}"
    titre = f"Conciergerie Airbnb Paris {label} ({cp}) — gestion locative clé en main"
    desc = (f"Conciergerie Airbnb à Paris {label} : mise en ligne, tarification, accueil des voyageurs, "
            f"ménage hôtelier et maintenance. Gestion clé en main pour les propriétaires du {cp} "
            f"({', '.join(quartiers[:2])}).")
    q_txt = ", ".join(quartiers[:-1]) + " et " + quartiers[-1]
    l_txt = ", ".join(lieux[:-1]) + " et " + lieux[-1]

    faq_items = [
        (f"Combien coûte une conciergerie Airbnb à Paris {label} ?",
         "Nous fonctionnons à la commission sur les revenus encaissés, sans abonnement ni frais d'entrée. "
         "Le pourcentage dépend du niveau de service (ménage inclus ou non, fréquence des rotations) et du "
         f"type de bien. Nous vous envoyons une proposition chiffrée après avoir vu votre appartement du {cp}."),
        (f"Puis-je louer mon appartement du {cp} toute l'année ?",
         "Si c'est votre résidence principale, la location saisonnière est plafonnée à 120 nuits par an à Paris. "
         "Pour une résidence secondaire, une autorisation de changement d'usage — avec compensation — est exigée. "
         "Sans cette autorisation, nous vous orientons vers la moyenne durée (bail mobilité de 1 à 10 mois), "
         "parfaitement légale et très demandée dans le secteur."),
        (f"Quels quartiers couvrez-vous dans le {label} ?",
         f"L'ensemble de l'arrondissement : {q_txt}. Nos équipes de ménage et nos artisans interviennent "
         "dans tout Paris intra-muros et en proche couronne."),
        ("Faut-il un numéro d'enregistrement ?",
         "Oui. À Paris, tout meublé de tourisme doit être déclaré en mairie et afficher son numéro "
         "d'enregistrement sur l'annonce. Nous vous accompagnons dans la démarche et vérifions que "
         "l'annonce est conforme avant la mise en ligne."),
        ("Qui s'occupe du ménage et du linge ?",
         "Nos équipes, avec du linge de maison fourni et blanchi entre chaque séjour. Vous n'avez ni "
         "prestataire à trouver, ni planning à tenir : les rotations sont calées automatiquement sur "
         "les départs et les arrivées."),
        ("Puis-je récupérer mon logement quand je veux ?",
         "Oui. Vous bloquez vos dates dans le calendrier quand vous le souhaitez, sans préavis particulier "
         "au-delà des réservations déjà confirmées. Beaucoup de nos propriétaires louent uniquement pendant "
         "leurs absences."),
    ]

    services = SERVICES_A if num % 2 else SERVICES_B
    p1, p2 = C.photo(i), C.photo(i + 1)
    trail = [("Accueil", "/"), ("Conciergerie Airbnb Paris", HUB), (ville, path)]

    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — Paris {label}", url, desc, "Paris", "Île-de-France",
                              cp, geo=geo, area=[f"Paris {label}", "Paris"]),
                C.ld_service(f"Conciergerie Airbnb et gestion locative courte durée à Paris {label}",
                             f"Paris {label}", url, desc,
                             ["Mise en ligne et optimisation de l'annonce", "Tarification dynamique",
                              "Accueil des voyageurs", "Ménage et linge hôtelier",
                              "Maintenance et petits travaux", "Suivi des revenus"]),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{p1[0]}"),
        C.header([("Paris", HUB), ("France", "/conciergerie-airbnb-france"),
                  ("Conciergerie privée", "/conciergerie-privee-paris"),
                  ("Propriétaires", "/proprietaires")]),
        C.crumb(trail),
        C.hero(f"📍 Paris {label} · {cp}",
               f"Conciergerie Airbnb à <span class=\"font-serif-italic\">Paris {label}</span>",
               f"Vous possédez un bien dans le {cp} ? Nous gérons tout — annonce, prix, voyageurs, ménage, "
               f"maintenance — et vous encaissez. {hook}",
               p1[0], f"Appartement géré par notre conciergerie Airbnb à Paris {label}",
               ["Gestion <b>clé en main</b>", "Rémunérés au <b>résultat</b>",
                "Ménage <b>hôtelier</b>", "Accueil <b>7j/7</b>"]),
        C.texte([
            f"Louer un appartement en courte durée dans le <strong>{label} arrondissement</strong> n'a "
            f"rien d'un revenu passif quand on s'en occupe seul : messages à toute heure, arrivées à "
            f"caler, ménage à enchaîner, plafond de nuitées à surveiller. <strong>Label Maison "
            f"Conciergerie</strong> prend l'ensemble en charge sur {q_txt}, et vous laisse la seule "
            f"partie agréable : les revenus.",
            f"Autour de {l_txt}, la demande ne se comporte pas comme ailleurs dans Paris. {demande} "
            f"Nous calons la stratégie sur cette réalité — type de séjour, durée minimum, prix par nuit — "
            f"plutôt que sur une moyenne parisienne qui ne veut rien dire à l'échelle d'une rue.",
        ], pad=True),
        C.cartes(f"Notre gestion Airbnb clé en main dans le {label}",
                 "Vous nous confiez les clés. Nous nous occupons du reste, de la première photo au dernier départ.",
                 services),
        C.texte([
            f"Le parc immobilier du {cp} — {bien.lower()} — impose ses propres arbitrages. "
            f"Un studio de 22 m² bien agencé peut générer davantage qu'un trois-pièces mal photographié : "
            f"nous travaillons d'abord la présentation et le positionnement du bien, avant de toucher aux prix.",
            f"Côté voyageurs, le {label} attire surtout : {demande.lower()} Cette clientèle réserve "
            f"différemment selon la période. Nous ajustons les durées minimales de séjour et les tarifs "
            f"semaine par semaine, en tenant compte des grands rendez-vous parisiens qui remplissent la ville.",
        ], titre=f"Louer en courte durée dans le {label} : ce qui compte vraiment"),
        C.texte([
            "À Paris, la location meublée de tourisme est encadrée, et c'est une bonne nouvelle pour les "
            "propriétaires sérieux : le marché est plus propre, et les biens conformes se louent mieux.",
            "<strong>Résidence principale</strong> : vous pouvez louer jusqu'à 120 nuits par an, après "
            "déclaration en mairie et obtention d'un numéro d'enregistrement à afficher sur l'annonce. "
            "<strong>Résidence secondaire</strong> : la location touristique suppose une autorisation de "
            "changement d'usage, soumise à compensation à Paris.",
            "<strong>Vous n'avez pas d'autorisation ?</strong> Nous basculons votre bien en moyenne durée : "
            "bail mobilité de 1 à 10 mois pour les étudiants, stagiaires et salariés en mission. "
            "Moins de rotations, aucun plafond de nuitées, un cadre légal simple — et une rentabilité "
            "supérieure à la location nue classique.",
            "<em>Le cadre fiscal des meublés de tourisme a été durci par la loi du 19 novembre 2024. "
            "Nous vous indiquons les points à vérifier, mais le dernier mot revient à votre expert-comptable.</em>",
        ], titre=f"Réglementation Airbnb à Paris {label} : ce que vous devez savoir"),
        C.galerie(f"gal{num}", [C.photo(i + k) for k in range(6)]),
        C.etapes("Comment on démarre ensemble", [
            ("1. Visite et estimation",
             f"Nous visitons votre bien du {cp}, évaluons son potentiel réel et vous remettons une "
             "estimation de revenus argumentée, sans engagement."),
            ("2. Mise en scène et photos",
             "Conseils d'aménagement, achat des manquants si besoin, shooting professionnel : "
             "c'est la photo de couverture qui déclenche la réservation."),
            ("3. Mise en ligne multi-plateformes",
             "Annonce rédigée pour la recherche, diffusion sur Airbnb, Booking et Abritel, calendrier "
             "synchronisé pour éviter toute double réservation."),
            ("4. Vous encaissez, nous gérons",
             "Voyageurs accueillis, ménage enchaîné, incidents traités. Vous recevez vos revenus et "
             "un point mensuel clair."),
        ]),
        C.cartes(f"Pourquoi les propriétaires du {label} nous confient leur bien", "",
                 POURQUOI, cols="g2"),
        C.zones("Notre conciergerie dans les arrondissements voisins",
                "Nous intervenons dans les 20 arrondissements de Paris et en proche couronne.",
                [(f"Conciergerie Airbnb Paris {v[1]}",
                  f"/conciergerie-airbnb-paris-{v[1]}") for v in voisins(num)]
                + [("Tous les arrondissements", HUB),
                   ("Conciergerie Airbnb en France", "/conciergerie-airbnb-france")],
                extra=(f"Vous cherchez plutôt une <a href=\"/conciergerie-privee-paris\"><strong>conciergerie "
                       f"privée à Paris</strong></a> (chauffeur, réservations, personal shopping) ? "
                       f"C'est également notre métier. Propriétaires : découvrez "
                       f"<a href=\"/proprietaires\">notre offre de gestion</a> et le "
                       f"<a href=\"/cerclelabelmaison\">Cercle Label Maison</a> si vous souhaitez nous "
                       f"recommander un bien.")),
        C.faq(f"Questions fréquentes — conciergerie Airbnb Paris {label}", faq_items),
        C.formulaire(f"Estimation gratuite pour votre bien du {cp}",
                     "Décrivez-nous votre appartement : surface, quartier, disponibilité. "
                     "Nous vous répondons avec une estimation de revenus et notre proposition de gestion.",
                     ville, "Conciergerie Airbnb", titre),
        C.footer([("Paris", [("Tous les arrondissements", HUB),
                             (f"Conciergerie Airbnb Paris {label}", path),
                             ("Conciergerie privée Paris", "/conciergerie-privee-paris"),
                             ("Chauffeur privé Paris", "/chauffeur-prive-paris"),
                             ("Van avec chauffeur Paris", "/van-avec-chauffeur-paris")]),
                  ("Propriétaires", [("Notre offre de gestion", "/proprietaires"),
                                     ("Conciergerie Airbnb en France", "/conciergerie-airbnb-france"),
                                     ("Gestion locative Paris", "/gestion-locative-paris"),
                                     ("Investissement locatif Paris", "/investissement-locatif-paris"),
                                     ("Le blog des propriétaires", "/blog")])],
                 f"Conciergerie Airbnb à Paris {label} — gestion locative courte et moyenne durée, "
                 f"<span class=\"font-serif-italic\">clé en main</span>.",
                 f"Paris {label} ({cp}) · Paris · Île-de-France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts)


def page_hub() -> None:
    path = HUB
    url = C.SITE + path
    titre = "Conciergerie Airbnb Paris — gestion locative clé en main dans les 20 arrondissements"
    desc = ("Conciergerie Airbnb à Paris : annonce, tarification dynamique, accueil des voyageurs, "
            "ménage hôtelier et maintenance dans les 20 arrondissements. Estimation gratuite pour "
            "les propriétaires parisiens.")
    faq_items = [
        ("Dans quels arrondissements intervenez-vous ?",
         "Dans les 20 arrondissements de Paris, ainsi qu'en proche couronne (Neuilly, Boulogne, "
         "Levallois, Saint-Denis, Montreuil) et dans toute l'Île-de-France."),
        ("Quel est votre modèle de rémunération ?",
         "Une commission sur les revenus réellement encaissés, sans abonnement ni frais de dossier. "
         "Nous ne gagnons que si votre bien génère des revenus."),
        ("Gérez-vous aussi la moyenne durée ?",
         "Oui. Le bail mobilité (1 à 10 mois) est souvent la meilleure option à Paris quand le bien "
         "n'a pas d'autorisation de changement d'usage : pas de plafond de nuitées, moins de rotations, "
         "une rentabilité supérieure à la location nue."),
        ("Combien de temps avant la première réservation ?",
         "Une fois les photos faites et l'annonce en ligne, les premières demandes arrivent en général "
         "dans les jours qui suivent à Paris. Le calendrier de départ est calé avec vous."),
        ("Puis-je continuer à utiliser mon appartement ?",
         "Bien sûr. Vous bloquez vos dates dans le calendrier. Beaucoup de propriétaires ne louent "
         "que pendant leurs absences."),
    ]
    trail = [("Accueil", "/"), ("Conciergerie Airbnb Paris", path)]
    p = C.photo(3)
    parts = [
        C.head(titre, desc, path,
               [C.ld_business(" — Paris", url, desc, "Paris", "Île-de-France", "75008",
                              geo=(48.8698, 2.3079),
                              area=[f"Paris {a[1]}" for a in ARR] + ["Paris", "Île-de-France"]),
                C.ld_service("Conciergerie Airbnb et gestion locative courte durée à Paris",
                             "Paris", url, desc),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail),
                {"@context": "https://schema.org", "@type": "ItemList",
                 "name": "Conciergerie Airbnb par arrondissement de Paris",
                 "itemListElement": [
                     {"@type": "ListItem", "position": i + 1,
                      "name": f"Conciergerie Airbnb Paris {a[1]} ({a[2]})",
                      "url": f"{C.SITE}/conciergerie-airbnb-paris-{a[1]}"}
                     for i, a in enumerate(ARR)]}],
               image=f"{C.SITE}/images/{p[0]}"),
        C.header([("Paris", HUB), ("France", "/conciergerie-airbnb-france"),
                  ("Conciergerie privée", "/conciergerie-privee-paris"),
                  ("Propriétaires", "/proprietaires")]),
        C.crumb(trail),
        C.hero("📍 Paris · 20 arrondissements",
               "Conciergerie Airbnb à <span class=\"font-serif-italic\">Paris</span>",
               "Votre appartement parisien mérite mieux qu'un calendrier vide ou qu'une gestion "
               "à temps perdu. Nous nous occupons de tout — annonce, prix, voyageurs, ménage, "
               "maintenance — dans les 20 arrondissements.",
               p[0], "Appartement parisien géré par Label Maison Conciergerie",
               ["20 <b>arrondissements</b>", "Gestion <b>clé en main</b>",
                "Rémunérés au <b>résultat</b>", "Ménage <b>hôtelier</b>"]),
        C.texte([
            "Paris reste l'un des marchés locatifs les plus tendus d'Europe : la demande existe toute "
            "l'année, mais elle se gagne. Entre la qualité des photos, le positionnement tarifaire, "
            "la rapidité de réponse aux messages et la propreté irréprochable entre deux séjours, "
            "un bien bien géré et un bien mal géré n'obtiennent pas les mêmes résultats — au même endroit, "
            "avec la même surface.",
            "<strong>Label Maison Conciergerie</strong> gère des logements parisiens en courte et moyenne "
            "durée, du studio sous les toits à l'appartement de réception. Nous sommes rémunérés au "
            "pourcentage des revenus encaissés : notre intérêt, c'est que votre bien tourne bien.",
        ], pad=True),
        C.cartes("Ce que nous prenons en charge",
                 "Zéro tâche pour vous. Zéro imprévu à gérer.", SERVICES_A),
        C.zones("Choisissez votre arrondissement",
                "Une page dédiée par arrondissement : quartiers couverts, type de demande, réglementation.",
                [(f"Paris {a[1]} ({a[2]})", f"/conciergerie-airbnb-paris-{a[1]}") for a in ARR],
                extra=("Hors de Paris ? Voir notre <a href=\"/conciergerie-airbnb-france\"><strong>"
                       "conciergerie Airbnb en France</strong></a>, notre "
                       "<a href=\"/conciergerie-airbnb-ile-de-france\">couverture Île-de-France</a> "
                       "et notre <a href=\"/conciergerie-airbnb-essonne\">présence en Essonne</a>.")),
        C.texte([
            "<strong>Résidence principale</strong> : location saisonnière plafonnée à 120 nuits par an, "
            "déclaration en mairie et numéro d'enregistrement obligatoire sur l'annonce.",
            "<strong>Résidence secondaire</strong> : autorisation de changement d'usage avec compensation. "
            "Sans elle, la courte durée touristique n'est pas possible — mais la moyenne durée, si.",
            "<strong>Notre position</strong> : nous ne mettons en ligne que des biens conformes. C'est la "
            "condition pour construire un revenu durable plutôt qu'un coup d'un an. Quand la courte durée "
            "n'est pas possible, nous basculons sur le bail mobilité et vous accompagnons de la même façon.",
        ], titre="Le cadre parisien, expliqué simplement"),
        C.galerie("galhub", [C.photo(k) for k in range(8)]),
        C.etapes("De la visite à la première réservation", [
            ("1. Estimation", "Visite du bien, analyse du quartier et estimation de revenus argumentée."),
            ("2. Préparation", "Aménagement, équipements manquants, photos professionnelles."),
            ("3. Mise en ligne", "Annonce optimisée, diffusion multi-plateformes, calendriers synchronisés."),
            ("4. Exploitation", "Voyageurs, ménage, maintenance, reporting mensuel : nous gérons."),
        ]),
        C.cartes("Pourquoi Label Maison à Paris", "", POURQUOI, cols="g2"),
        C.faq("Questions fréquentes — conciergerie Airbnb à Paris", faq_items),
        C.formulaire("Estimation gratuite pour votre bien parisien",
                     "Surface, arrondissement, disponibilité : donnez-nous trois informations et nous "
                     "revenons vers vous avec une estimation et une proposition de gestion.",
                     "Paris", "Conciergerie Airbnb", titre),
        C.footer([("Arrondissements", [(f"Paris {a[1]}", f"/conciergerie-airbnb-paris-{a[1]}")
                                       for a in ARR[:8]]),
                  ("Nos silos", [("Conciergerie Airbnb France", "/conciergerie-airbnb-france"),
                                 ("Conciergerie privée Paris", "/conciergerie-privee-paris"),
                                 ("Gestion locative Paris", "/gestion-locative-paris"),
                                 ("Investissement locatif Paris", "/investissement-locatif-paris"),
                                 ("Blog propriétaires", "/blog")])],
                 "Conciergerie Airbnb à Paris — gestion locative courte et moyenne durée dans les "
                 "<span class=\"font-serif-italic\">20 arrondissements</span>.",
                 "Paris · Île-de-France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(HUB.lstrip("/"), parts)


def main() -> list:
    page_hub()
    for i, a in enumerate(ARR):
        page_arr(a, i)
    urls = [HUB] + [f"/conciergerie-airbnb-paris-{a[1]}" for a in ARR]
    print(f"Paris : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
