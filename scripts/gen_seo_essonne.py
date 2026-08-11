# -*- coding: utf-8 -*-
"""Renforcement du silo Essonne (91) — notre territoire historique.

Le hub /conciergerie-airbnb-essonne et 13 communes existent déjà. Ce script :
  1. ajoute 27 communes non couvertes, choisies pour leur moteur de demande réel
     (Paris-Saclay, Courtabœuf, aéroport d'Orly, Étampes, Dourdan, Milly…) ;
  2. crée deux pages de pôle : aéroport d'Orly et plateau de Paris-Saclay ;
  3. complète le maillage du hub existant avec les nouvelles communes.
"""
from __future__ import annotations

import pathlib
import re

import seo_common as C
import seo_ville as SV
from gen_seo_services import build

HUB = "/conciergerie-airbnb-essonne"
NAV = [("Essonne", HUB), ("Banlieue parisienne", "/conciergerie-airbnb-banlieue-parisienne"),
       ("Paris", "/conciergerie-airbnb-paris"), ("Propriétaires", "/proprietaires")]

# nom, slug, dept, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue
V = [
    ("Savigny-sur-Orge", "savigny-sur-orge", "91", "91600", (48.6797, 2.3494),
     ["le centre", "Grand-Vaux", "Champagne", "les Gâtines"],
     ["la gare RER C", "le château de Savigny", "les bords de l'Orge", "Orly à quinze minutes"],
     "Une des communes les plus peuplées du département, à quinze minutes d'Orly par la route : la demande d'escale et de mission y est régulière et peu exploitée.",
     "Passagers d'Orly, salariés en mission, familles en visite dans le sud francilien.",
     "Pavillons avec jardin, appartements proches RER, studios rénovés",
     "Demande stable toute l'année, sans saisonnalité touristique marquée.", False),
    ("Sainte-Geneviève-des-Bois", "sainte-genevieve-des-bois", "91", "91700", (48.6394, 2.3253),
     ["le centre", "le Perray", "Liers", "la Donnerie"],
     ["le cimetière russe", "le RER C", "le parc Pierre", "la donjon du Perray"],
     "Le cimetière russe attire une clientèle internationale de niche, et la gare RER met Paris à trente minutes : deux publics distincts sur une même commune.",
     "Visiteurs internationaux, déplacements professionnels, familles en séjour francilien.",
     "Pavillons familiaux, appartements récents, studios proches gare",
     "Occupation régulière, avec une demande de moyenne durée soutenue toute l'année.", False),
    ("Draveil", "draveil", "91", "91210", (48.6853, 2.4111),
     ["le centre", "Champrosay", "Mainville", "Villiers"],
     ["la forêt de Sénart", "les bords de Seine", "le port aux Cerises", "la base de loisirs"],
     "Entre forêt de Sénart et bords de Seine, Draveil attire des séjours familiaux plus longs que la moyenne francilienne.",
     "Familles en séjour nature, séminaires, déplacements professionnels.",
     "Pavillons avec jardin, maisons de caractère, appartements calmes",
     "Printemps et été portés par la base de loisirs, demande professionnelle le reste de l'année.", False),
    ("Ris-Orangis", "ris-orangis", "91", "91130", (48.6531, 2.4139),
     ["le centre", "le Plateau", "les Docks", "Orangis"],
     ["Le Plan (salle de concert)", "le RER D", "les bords de Seine", "Évry à cinq minutes"],
     "Ris-Orangis profite de l'activité du pôle d'Évry voisin tout en restant nettement moins chère à l'achat.",
     "Déplacements professionnels, public des concerts, familles en visite.",
     "Appartements récents, pavillons, studios proches RER",
     "Demande régulière, renforcée par l'activité économique et culturelle d'Évry.", False),
    ("Vigneux-sur-Seine", "vigneux-sur-seine", "91", "91270", (48.7017, 2.4147),
     ["le centre", "la Croix-Blanche", "les Bergeries", "le lac"],
     ["le lac de Vigneux", "les bords de Seine", "le RER D", "la forêt de Sénart"],
     "Le lac et la Seine donnent à Vigneux un cadre de loisirs à trente minutes de Paris, avec des prix d'achat parmi les plus accessibles du secteur.",
     "Familles en séjour, déplacements professionnels, séjours de moyenne durée.",
     "Pavillons avec jardin, appartements récents, studios",
     "Demande stable, pic estival autour des activités nautiques.", False),
    ("Épinay-sur-Orge", "epinay-sur-orge", "91", "91360", (48.6742, 2.3111),
     ["le centre", "Petit-Vaux", "Mauregard", "la Croix-Ronde"],
     ["la gare RER C", "la vallée de l'Orge", "le parc de Sillery", "Orly à vingt minutes"],
     "Petite commune très bien desservie, Épinay sert de base à ceux qui travaillent à Massy, Saclay ou Orly sans vouloir en payer le prix.",
     "Salariés en mission autour de Massy et Saclay, familles, passagers d'Orly.",
     "Pavillons, appartements proches gare, studios rénovés",
     "Demande professionnelle continue, très adaptée au bail mobilité.", False),
    ("Saint-Michel-sur-Orge", "saint-michel-sur-orge", "91", "91240", (48.6383, 2.3072),
     ["le centre", "le Bois des Roches", "Les Genêts", "la Grande Rue"],
     ["le RER C", "la vallée de l'Orge", "le parc du Séminaire", "Brétigny voisin"],
     "Saint-Michel bénéficie de la dynamique de Brétigny et de la vallée de l'Orge, avec un ticket d'entrée très bas pour un premier investissement locatif.",
     "Déplacements professionnels, familles, séjours de moyenne durée.",
     "Appartements des années 70 rénovés, pavillons, studios",
     "Occupation régulière toute l'année.", False),
    ("Les Ulis", "les-ulis", "91", "91940", (48.6819, 2.1686),
     ["le centre", "Courtabœuf", "les Amonts", "la Treille"],
     ["le parc d'activités de Courtabœuf", "le plateau de Saclay", "l'université Paris-Saclay", "l'A10"],
     "Courtabœuf est l'un des plus grands parcs d'activités d'Europe : des milliers d'entreprises, donc un flux permanent de prestataires en mission à héberger.",
     "Ingénieurs et prestataires de Courtabœuf, intervenants de Paris-Saclay, missions de plusieurs semaines.",
     "Appartements fonctionnels, studios proches zone d'activités, pavillons",
     "Demande professionnelle continue de septembre à juillet, idéale pour le bail mobilité.", False),
    ("Orsay", "orsay", "91", "91400", (48.6989, 2.1869),
     ["le centre", "le Guichet", "Mondétour", "la vallée"],
     ["l'université Paris-Saclay", "le campus scientifique", "la vallée de l'Yvette", "le RER B"],
     "Orsay est au cœur de Paris-Saclay : chercheurs invités, doctorants, colloques et entreprises du plateau créent une demande de moyenne durée continue.",
     "Chercheurs et universitaires en séjour, familles d'étudiants, colloques scientifiques.",
     "Appartements proches campus, maisons de la vallée, studios étudiants",
     "Année universitaire très tendue de septembre à juin, creux limité en août.", False),
    ("Gif-sur-Yvette", "gif-sur-yvette", "91", "91190", (48.6836, 2.1372),
     ["le centre", "Chevry", "Belleville", "Moulon"],
     ["CentraleSupélec et le campus de Saclay", "la vallée de Chevreuse", "le RER B", "les laboratoires du CEA"],
     "Le campus de Saclay concentre écoles d'ingénieurs et laboratoires : la demande d'hébergement pour intervenants et doctorants dépasse largement l'offre locale.",
     "Doctorants et chercheurs invités, intervenants d'écoles d'ingénieurs, familles en visite.",
     "Appartements proches campus, maisons de la vallée, studios",
     "Rentrée universitaire très forte, colloques toute l'année, août calme.", False),
    ("Bures-sur-Yvette", "bures-sur-yvette", "91", "91440", (48.6969, 2.1608),
     ["le centre", "la Guyonnerie", "le Grand Mesnil", "la vallée"],
     ["le campus universitaire", "l'IHES", "la vallée de l'Yvette", "le RER B"],
     "Bures vit au rythme du campus : entre l'IHES et l'université, les séjours de chercheurs se comptent en semaines, pas en nuits.",
     "Chercheurs invités, doctorants, familles d'étudiants.",
     "Studios et deux-pièces proches RER, maisons avec jardin",
     "Demande universitaire de septembre à juillet, séjours longs dominants.", False),
    ("Villebon-sur-Yvette", "villebon-sur-yvette", "91", "91140", (48.7006, 2.2408),
     ["le centre", "Courtabœuf", "la Roche", "le Val Fleuri"],
     ["le parc d'activités de Courtabœuf", "le centre commercial Villebon 2", "l'A10", "Massy à dix minutes"],
     "Villebon partage Courtabœuf avec Les Ulis : mêmes entreprises, même demande de missions, avec un habitat plus pavillonnaire.",
     "Prestataires en mission à Courtabœuf, déplacements professionnels, familles.",
     "Pavillons avec jardin, appartements récents, studios fonctionnels",
     "Demande professionnelle continue hors août.", False),
    ("Chilly-Mazarin", "chilly-mazarin", "91", "91380", (48.7025, 2.3128),
     ["le centre", "la Butte", "Grand-Vaux", "les Vignes"],
     ["l'aéroport d'Orly à dix minutes", "le RER C", "la zone d'activités de la Vigne aux Loups", "l'A6"],
     "Dix minutes d'Orly, dix minutes de Massy TGV : Chilly cumule deux pôles de transport majeurs, ce qui est rare pour une commune de cette taille.",
     "Passagers d'Orly, voyageurs TGV via Massy, prestataires en mission.",
     "Pavillons, appartements récents, studios avec parking",
     "Demande aéroportuaire et professionnelle continue toute l'année.", False),
    ("Morangis", "morangis", "91", "91420", (48.7053, 2.3411),
     ["le centre", "les Sources", "la Fontaine", "la zone d'activités"],
     ["l'aéroport d'Orly à cinq minutes", "le tramway T7", "les zones logistiques", "Rungis voisin"],
     "Cinq minutes d'Orly et du marché de Rungis : Morangis est l'une des adresses les plus logiques du département pour capter la clientèle d'escale.",
     "Passagers et équipages d'Orly, professionnels de Rungis, missions logistiques.",
     "Pavillons, appartements récents, studios avec parking",
     "Demande continue toute l'année, y compris en hiver et le week-end.", False),
    ("Wissous", "wissous", "91", "91320", (48.7333, 2.3239),
     ["le centre", "Montjean", "la Fraternelle", "les zones d'activités"],
     ["l'aéroport d'Orly", "le marché international de Rungis", "l'A6 et l'A10", "Massy TGV à dix minutes"],
     "Coincée entre Orly, Rungis et Massy TGV, Wissous est une adresse de logistique pure : les nuits d'escale s'y vendent toute l'année.",
     "Passagers d'Orly, professionnels de Rungis, chauffeurs et équipages, missions courtes.",
     "Pavillons, appartements récents, studios fonctionnels",
     "Demande aéroportuaire et professionnelle sans saisonnalité.", False),
    ("Paray-Vieille-Poste", "paray-vieille-poste", "91", "91550", (48.7150, 2.3600),
     ["le centre", "le Vieux Paray", "Contin", "la zone aéroportuaire"],
     ["les terminaux d'Orly", "le tramway T7", "l'Orlyval", "les hôtels de la plateforme"],
     "Une partie de l'aéroport d'Orly se trouve sur la commune : impossible d'être plus près des terminaux pour une nuit d'escale ou un vol de 6 heures.",
     "Passagers en escale et vols matinaux, équipages, personnels de la plateforme aéroportuaire.",
     "Pavillons, studios fonctionnels, appartements avec parking",
     "Demande continue 365 jours par an, portée par le trafic aérien.", False),
    ("Igny", "igny", "91", "91430", (48.7411, 2.2258),
     ["le centre", "les Ruchères", "Gommonvilliers", "la vallée"],
     ["le plateau de Saclay", "la vallée de la Bièvre", "le RER C", "Massy à cinq minutes"],
     "Igny bénéficie de la dynamique de Paris-Saclay tout en gardant un cadre de village : les séjours de chercheurs et d'ingénieurs y sont longs.",
     "Ingénieurs et chercheurs du plateau, familles, déplacements professionnels.",
     "Maisons avec jardin, appartements récents, studios",
     "Demande professionnelle et universitaire continue hors été.", False),
    ("Verrières-le-Buisson", "verrieres-le-buisson", "91", "91370", (48.7472, 2.2686),
     ["le centre", "le Bois de Verrières", "Vaucluse", "les Prés-Hauts"],
     ["le bois de Verrières", "l'arboretum", "Massy TGV à dix minutes", "Paris à vingt minutes"],
     "Commune résidentielle prisée entre Antony et Massy : la clientèle y cherche du calme, un jardin et un accès rapide à Paris.",
     "Familles en séjour francilien, cadres en mission longue, séminaires.",
     "Maisons avec jardin, appartements de standing, studios",
     "Demande régulière, séjours plus longs que la moyenne du département.", False),
    ("Marcoussis", "marcoussis", "91", "91460", (48.6403, 2.2361),
     ["le centre", "la Ronce", "Bellejame", "le vieux village"],
     ["le Centre national du rugby", "les golfs", "la forêt", "l'A10"],
     "Le Centre national du rugby attire équipes, staffs et médias : une demande sportive régulière que l'hôtellerie locale ne couvre pas.",
     "Staffs et délégations sportives, séminaires, golfeurs, familles.",
     "Maisons de village, pavillons avec jardin, appartements",
     "Demande sportive et professionnelle répartie sur l'année, pics lors des rassemblements.", False),
    ("Montlhéry et Linas", "montlhery-linas", "91", "91310", (48.6392, 2.2731),
     ["le centre de Montlhéry", "Linas", "la Tour", "Guipereux"],
     ["la tour de Montlhéry", "l'autodrome de Linas-Montlhéry", "la forêt", "l'A10"],
     "L'autodrome de Linas-Montlhéry accueille des rassemblements automobiles suivis dans toute l'Europe : quelques week-ends qui remplissent la commune entière.",
     "Public et exposants des rassemblements automobiles, déplacements professionnels, familles.",
     "Maisons de village, pavillons, appartements du centre",
     "Pics lors des événements de l'autodrome, demande professionnelle le reste de l'année.", False),
    ("Mennecy", "mennecy", "91", "91540", (48.5686, 2.4394),
     ["le centre", "le Bois de Chise", "Villeroy", "la Verville"],
     ["le parc de Villeroy", "la vallée de l'Essonne", "le RER D", "Évry à dix minutes"],
     "Mennecy offre un cadre verdoyant à dix minutes du pôle d'Évry : un bon compromis pour les missions longues du sud francilien.",
     "Salariés en mission, familles, séjours de moyenne durée.",
     "Pavillons avec jardin, maisons de ville, appartements récents",
     "Demande professionnelle continue, saison estivale plus calme.", False),
    ("Étampes", "etampes", "91", "91150", (48.4342, 2.1614),
     ["le centre historique", "Saint-Martin", "Guinette", "la Base"],
     ["la tour Guinette", "les églises classées", "la base de loisirs", "la gare RER C et TER"],
     "Sous-préfecture au patrimoine médiéval remarquable, Étampes attire un tourisme de proximité que les propriétaires locaux exploitent très peu.",
     "Tourisme de patrimoine, cyclotouristes, déplacements professionnels, familles.",
     "Maisons anciennes du centre, appartements rénovés, biens avec jardin",
     "Saison touristique d'avril à octobre, demande professionnelle et administrative toute l'année.", False),
    ("Dourdan", "dourdan", "91", "91410", (48.5325, 2.0136),
     ["le centre historique", "les Fontaines", "Liphard", "la forêt"],
     ["le château de Dourdan", "la forêt domaniale", "les halles", "la gare RER C"],
     "Le château et la forêt font de Dourdan une destination de week-end vert à une heure de Paris, avec une offre d'hébergement très limitée.",
     "Couples en week-end nature, randonneurs et cavaliers, familles, mariages et réceptions.",
     "Maisons de caractère, gîtes urbains, appartements du centre",
     "Week-ends toute l'année, saison forte d'avril à octobre, réceptions en été.", False),
    ("Milly-la-Forêt", "milly-la-foret", "91", "91490", (48.4050, 2.4700),
     ["le centre", "la halle", "le Cyclop", "les Sablons"],
     ["les halles médiévales", "le Cyclop de Jean Tinguely", "le massif des Trois Pignons", "la forêt de Fontainebleau"],
     "Aux portes du massif des Trois Pignons, Milly capte les grimpeurs et randonneurs de Fontainebleau, une clientèle qui vient au printemps et à l'automne.",
     "Grimpeurs et randonneurs, couples en week-end, amateurs d'art et de patrimoine.",
     "Maisons de village, gîtes, biens avec jardin",
     "Printemps et automne très forts (escalade), été touristique, hiver plus calme.", False),
    ("La Ferté-Alais", "la-ferte-alais", "91", "91590", (48.4783, 2.3419),
     ["le centre", "l'aérodrome de Cerny", "la vallée", "Guigneville voisin"],
     ["le meeting aérien de La Ferté-Alais", "la vallée de l'Essonne", "les falaises d'escalade", "le RER D"],
     "Le meeting aérien de la Pentecôte est l'un des plus importants d'Europe : un week-end qui sature l'hébergement dans un large rayon.",
     "Public du meeting aérien, randonneurs et grimpeurs, familles.",
     "Maisons de village, gîtes, pavillons avec jardin",
     "Pic exceptionnel au meeting de Pentecôte, saison verte d'avril à octobre.", False),
    ("Saclay", "saclay", "91", "91400", (48.7311, 2.1719),
     ["le bourg", "le Val d'Albian", "le plateau", "Christ de Saclay"],
     ["le campus Paris-Saclay", "le CEA", "les grandes écoles du plateau", "l'aéroport de Toussus voisin"],
     "Le plateau de Saclay concentre laboratoires, grandes écoles et sièges de R&D : une demande d'hébergement de moyenne durée qui ne connaît pas de creux.",
     "Chercheurs et ingénieurs en mission, intervenants de grandes écoles, séminaires scientifiques.",
     "Maisons du bourg, appartements récents, studios fonctionnels",
     "Demande scientifique et professionnelle continue de septembre à juillet.", False),
    ("Étiolles et Soisy-sur-Seine", "etiolles-soisy-sur-seine", "91", "91450", (48.6392, 2.4831),
     ["Étiolles", "Soisy-sur-Seine", "la forêt de Sénart", "les bords de Seine"],
     ["le golf d'Étiolles", "la forêt de Sénart", "les bords de Seine", "Évry à dix minutes"],
     "Golf, forêt et Seine : un triptyque de loisirs à trente minutes de Paris, avec une offre d'hébergement quasi inexistante.",
     "Golfeurs, familles en séjour nature, séminaires, déplacements professionnels vers Évry.",
     "Maisons avec jardin, pavillons, appartements calmes",
     "Saison verte d'avril à octobre, demande professionnelle le reste de l'année.", False),
]

SERVICES = [
    ("Mise en ligne et diffusion",
     "Photos professionnelles, annonce optimisée, diffusion Airbnb, Booking et Abritel, "
     "calendriers synchronisés."),
    ("Tarification pilotée",
     "Salons, événements sportifs, rentrée universitaire de Paris-Saclay, vols matinaux d'Orly : "
     "les prix suivent la demande réelle du secteur, semaine par semaine."),
    ("Accueil des voyageurs",
     "Check-in en personne ou boîte à clés, arrivées tardives et départs très matinaux acceptés — "
     "indispensable près d'un aéroport."),
    ("Ménage et linge hôtelier",
     "Équipes basées en Essonne, linge fourni et blanchi, produits d'accueil, contrôle photo "
     "après chaque départ."),
    ("Bail mobilité et moyenne durée",
     "Missions Courtabœuf, doctorants de Saclay, stagiaires : la moyenne durée remplit les mois "
     "où la nuitée touristique faiblit."),
    ("Maintenance locale",
     "Artisans du département, mobilisables rapidement : nous sommes implantés ici, pas à "
     "l'autre bout de l'Île-de-France."),
]

WHY = [
    ("L'Essonne, c'est notre base",
     "Nous y gérons des biens depuis nos débuts. Nos équipes de ménage et nos artisans sont "
     "installés dans le département : les délais d'intervention s'en ressentent."),
    ("Nous connaissons les pôles qui remplissent",
     "Orly, Courtabœuf, Paris-Saclay, Évry, Massy TGV, l'autodrome, le meeting de La Ferté-Alais : "
     "chaque commune a son moteur, et il commande la stratégie de prix."),
    ("Courte durée et bail mobilité",
     "Dans un département où la demande est largement professionnelle et universitaire, savoir "
     "alterner les deux régimes change le revenu annuel."),
    ("Rémunérés au résultat",
     "Commission sur les revenus encaissés, sans abonnement. Nous ne gagnons que si votre bien "
     "tourne."),
]


def regl(v) -> str:
    return (f"En Essonne, les règles dépendent de chaque commune : {v[0]} peut avoir instauré "
            f"l'enregistrement en mairie avec numéro à afficher sur l'annonce, ou non. Dans tous "
            f"les cas, la location d'une résidence principale en meublé de tourisme est plafonnée "
            f"à 120 nuits par an et la taxe de séjour est due. Nous vérifions ce qui s'applique "
            f"réellement à votre adresse avant la mise en ligne — c'est inclus dans notre travail.")


def extra(v):
    nom = v[0]
    return (f"Courte durée ou bail mobilité à {nom} ?", [
        f"L'Essonne n'est pas un marché touristique classique : la demande y est d'abord "
        f"professionnelle, universitaire, hospitalière et aéroportuaire. Cela change tout à la "
        f"stratégie.",
        f"Concrètement, à {nom}, nous ouvrons la courte durée sur les périodes de forte demande — "
        f"salons, événements, rentrée, pics de missions — et nous basculons sur le bail mobilité "
        f"(1 à 10 mois) le reste de l'année. Résultat : un calendrier plein, moins de rotations, "
        f"et un revenu annuel supérieur à celui d'une location nue classique.",
    ])


def faq_extra(v):
    return [(f"Vos équipes interviennent-elles vraiment à {v[0]} ?",
             "Oui. L'Essonne est notre département historique : nos équipes de ménage et nos "
             "artisans y sont basés, ce qui nous permet d'enchaîner un départ et une arrivée le "
             "même jour et de traiter une urgence dans la journée.")]


SILO = SV.Silo(
    nom="Essonne (91)", hub=HUB, region="Île-de-France", nav=NAV,
    services=SERVICES, why=WHY, regl=regl, extra_section=extra, faq_extra=faq_extra,
    titre_tpl="Conciergerie Airbnb à {nom} ({cp}) — gestion locative clé en main en Essonne",
    badge_tpl="📍 {nom} · Essonne ({cp})",
    footer_extra=[("Essonne & Île-de-France",
                   [("Toute l'Essonne", HUB), ("Aéroport d'Orly", "/conciergerie-airbnb-orly-aeroport"),
                    ("Plateau de Paris-Saclay", "/conciergerie-airbnb-paris-saclay"),
                    ("Banlieue parisienne", "/conciergerie-airbnb-banlieue-parisienne"),
                    ("Paris", "/conciergerie-airbnb-paris")])],
)

FOOT_91 = [("Essonne", [("Toute l'Essonne", HUB), ("Massy", "/conciergerie-airbnb-massy"),
                        ("Évry-Courcouronnes", "/conciergerie-airbnb-evry-courcouronnes"),
                        ("Palaiseau", "/conciergerie-airbnb-palaiseau"),
                        ("Les Ulis", "/conciergerie-airbnb-les-ulis")]),
           ("Ressources", [("Estimation gratuite", "/estimation-rentabilite-airbnb"),
                           ("Combien rapporte un Airbnb en 91 ?", "/combien-rapporte-airbnb-91"),
                           ("Rentabiliser son Airbnb", "/comment-rentabiliser-airbnb-essonne"),
                           ("Fiscalité de la location meublée", "/fiscalite-airbnb-ile-de-france"),
                           ("Le blog", "/blog")])]

POLES = [
    dict(slug="conciergerie-airbnb-orly-aeroport",
         title="Conciergerie Airbnb près de l'aéroport d'Orly — la demande qui ne s'arrête jamais",
         desc="Conciergerie Airbnb autour de l'aéroport d'Orly : Paray-Vieille-Poste, Wissous, "
              "Morangis, Chilly-Mazarin, Athis-Mons, Orly. Nuits d'escale, vols matinaux, équipages : "
              "gestion locative clé en main.",
         crumb="Aéroport d'Orly",
         trail=[("Accueil", "/"), ("Essonne (91)", HUB)], nav=NAV,
         service_type="Conciergerie Airbnb et gestion locative autour de l'aéroport d'Orly",
         area="Orly", business=(" — Orly", "Paray-Vieille-Poste", "Île-de-France", "91550", "FR",
                                (48.7233, 2.3794), ["Orly", "Paray-Vieille-Poste", "Wissous",
                                                    "Morangis", "Athis-Mons"]),
         badge="✈️ Aéroport d'Orly · 91 / 94",
         h1="Conciergerie Airbnb autour de <span class=\"font-serif-italic\">l'aéroport d'Orly</span>",
         sub="Vols de 6 heures, correspondances, équipages, professionnels de Rungis : autour d'Orly, "
             "la demande de nuit ne connaît ni week-end ni saison creuse.",
         photo=("real/billetterie-avion.jpg", "Voyage au départ de l'aéroport d'Orly"),
         puces=["Demande <b>365 jours</b>", "Arrivées <b>tardives</b>",
                "Départs <b>très matinaux</b>", "Parking <b>valorisé</b>"],
         cta="Estimer mes revenus",
         intro=[
             "Un vol qui décolle à 6 h 30 impose d'être à l'aéroport à 4 h 30. Aucune famille ne "
             "traverse l'Île-de-France à cette heure-là : elle dort à côté. Cette mécanique très "
             "simple crée, autour d'Orly, une demande d'hébergement continue que l'offre hôtelière "
             "de la plateforme ne suffit pas à absorber.",
             "Nous gérons des logements sur toute la couronne de l'aéroport : "
             "<a href=\"/conciergerie-airbnb-paray-vieille-poste\">Paray-Vieille-Poste</a>, "
             "<a href=\"/conciergerie-airbnb-wissous\">Wissous</a>, "
             "<a href=\"/conciergerie-airbnb-morangis\">Morangis</a>, "
             "<a href=\"/conciergerie-airbnb-chilly-mazarin\">Chilly-Mazarin</a>, "
             "<a href=\"/conciergerie-airbnb-athis-mons\">Athis-Mons</a>, "
             "<a href=\"/conciergerie-airbnb-orly\">Orly</a> et "
             "<a href=\"/conciergerie-airbnb-savigny-sur-orge\">Savigny-sur-Orge</a>.",
         ],
         cards=("Ce qui compte vraiment près d'un aéroport", "Les critères de réservation ne sont pas les mêmes qu'en centre-ville.", [
             ("Check-in à toute heure",
              "Une arrivée à 1 h du matin et un départ à 4 h sont la norme, pas l'exception. "
              "Nous équipons les biens en accès autonome sécurisé et nous restons joignables."),
             ("Parking et navettes",
              "Un stationnement disponible et une navette identifiée valent plus, ici, que la "
              "décoration : ce sont les premiers filtres de recherche des voyageurs."),
             ("Insonorisation et sommeil",
              "Rideaux occultants, literie de qualité, silence : les voyageurs d'escale ne viennent "
              "pas visiter, ils viennent dormir quatre heures. Les avis se jouent là."),
             ("Rotations très rapides",
              "Nos équipes locales enchaînent un départ matinal et une arrivée le soir même, "
              "sept jours sur sept."),
             ("Tarifs adaptés à l'escale",
              "Une nuit d'escale ne se tarifie pas comme un week-end touristique. Nous ajustons "
              "selon les horaires de vols et la saison aérienne."),
             ("Clientèle professionnelle",
              "Équipages, personnels de la plateforme, professionnels de Rungis : une demande "
              "récurrente qui se fidélise et se réserve en direct."),
         ]),
         sections=[
             ("Orly, Rungis, Massy : trois pôles dans un rayon de dix kilomètres", [
                 "L'aéroport n'est pas le seul moteur du secteur. Le marché international de Rungis "
                 "fait venir chaque nuit des professionnels de toute l'Europe, et la gare de Massy "
                 "TGV met la province à portée directe.",
                 "Un bien situé entre les trois capte donc trois demandes différentes, réparties sur "
                 "toute l'année et sur tous les jours de la semaine. C'est l'un des rares secteurs "
                 "franciliens où le samedi n'est pas nécessairement le meilleur jour.",
             ]),
             ("Courte durée, moyenne durée : le bon dosage", [
                 "Autour d'Orly, nous alternons souvent nuits d'escale et baux mobilité pour les "
                 "personnels en mission sur la plateforme. Cette combinaison évite les calendriers "
                 "à trous et lisse le revenu sur douze mois.",
                 "Côté réglementation, attention : <a href=\"/conciergerie-airbnb-orly\">Orly</a> "
                 "est dans le Val-de-Marne (94) et relève du régime du changement d'usage, alors que "
                 "les communes voisines de l'Essonne appliquent des règles communales. Nous "
                 "vérifions au cas par cas.",
             ]),
         ],
         gallery=[C.photo(k + 6) for k in range(6)],
         steps=("Comment nous démarrons", [
             ("1. Étude du bien", "Distance réelle aux terminaux, stationnement, insonorisation, "
              "capacité de couchage."),
             ("2. Préparation", "Équipements d'escale, accès autonome, photos professionnelles."),
             ("3. Lancement", "Annonce orientée voyageurs aériens, prix calés sur les horaires de vols."),
             ("4. Exploitation", "Arrivées et départs à toute heure, ménage, maintenance, reporting."),
         ]),
         why=("Pourquoi Label Maison en Essonne", WHY),
         zones=("Les communes de la couronne d'Orly", "",
                [("Paray-Vieille-Poste", "/conciergerie-airbnb-paray-vieille-poste"),
                 ("Wissous", "/conciergerie-airbnb-wissous"),
                 ("Morangis", "/conciergerie-airbnb-morangis"),
                 ("Chilly-Mazarin", "/conciergerie-airbnb-chilly-mazarin"),
                 ("Orly (94)", "/conciergerie-airbnb-orly"),
                 ("Athis-Mons", "/conciergerie-airbnb-athis-mons"),
                 ("Toute l'Essonne", HUB)],
                "Pour l'autre aéroport parisien, voir "
                "<a href=\"/conciergerie-airbnb-roissy-en-france\"><strong>Roissy-Charles-de-Gaulle"
                "</strong></a>."),
         faq_title="Questions fréquentes — Airbnb près d'Orly",
         faq=[
             ("Un studio sans charme peut-il bien marcher près d'Orly ?",
              "Oui, à condition qu'il soit impeccable, silencieux, bien équipé pour dormir et "
              "facile d'accès à toute heure. Les voyageurs d'escale ne cherchent pas un décor, "
              "ils cherchent quatre heures de sommeil et un trajet court."),
             ("Faut-il proposer une navette ?",
              "Ce n'est pas obligatoire, mais indiquer précisément le trajet (tramway T7, Orlyval, "
              "bus, temps en voiture) améliore nettement le taux de réservation."),
             ("Les arrivées de nuit sont-elles gérables ?",
              "Oui : accès autonome sécurisé, instructions claires, et une astreinte téléphonique. "
              "C'est justement la contrainte qui décourage les propriétaires — et qui fait la marge."),
             ("Le parking est-il indispensable ?",
              "Il n'est pas indispensable, mais il change la donne : beaucoup de voyageurs laissent "
              "leur voiture pendant leur séjour à l'étranger. C'est un argument fort."),
             ("Quelle réglementation s'applique ?",
              "Elle dépend de la commune : Orly relève du Val-de-Marne et de son régime de "
              "changement d'usage, les communes essonniennes appliquent leurs propres règles. "
              "Nous vérifions avant la mise en ligne."),
             ("Gérez-vous les baux mobilité pour les personnels de la plateforme ?",
              "Oui, c'est même une part importante de notre activité sur ce secteur."),
         ],
         form=("Votre bien est proche d'Orly ? Faisons le calcul",
               "Commune, surface, présence d'un parking : nous vous répondons avec une estimation "
               "de revenus adaptée à la demande aéroportuaire.",
               "Orly", "Conciergerie Airbnb"),
         footer=FOOT_91,
         tagline="Conciergerie Airbnb autour de l'aéroport d'Orly — "
                 "<span class=\"font-serif-italic\">une demande qui ne dort jamais</span>.",
         lieu="Orly · Paray-Vieille-Poste · Wissous · Morangis",
         mobcta="Estimer mes revenus"),

    dict(slug="conciergerie-airbnb-paris-saclay",
         title="Conciergerie Airbnb sur le plateau de Paris-Saclay — chercheurs, missions et campus",
         desc="Conciergerie Airbnb sur le plateau de Paris-Saclay : Orsay, Gif-sur-Yvette, Palaiseau, "
              "Saclay, Bures, Les Ulis, Courtabœuf. Bail mobilité et courte durée pour chercheurs, "
              "doctorants et ingénieurs en mission.",
         crumb="Plateau de Paris-Saclay",
         trail=[("Accueil", "/"), ("Essonne (91)", HUB)], nav=NAV,
         service_type="Conciergerie Airbnb et gestion locative sur le plateau de Paris-Saclay",
         area="Paris-Saclay",
         business=(" — Paris-Saclay", "Orsay", "Île-de-France", "91400", "FR", (48.7060, 2.1750),
                   ["Orsay", "Gif-sur-Yvette", "Palaiseau", "Saclay", "Les Ulis"]),
         badge="🔬 Plateau de Paris-Saclay · 91",
         h1="Conciergerie Airbnb sur le <span class=\"font-serif-italic\">plateau de Paris-Saclay</span>",
         sub="Chercheurs invités, doctorants, ingénieurs en mission, colloques : sur le plateau, la "
             "demande est longue, régulière et solvable. Elle appelle une gestion différente de "
             "celle du tourisme.",
         photo=("real/logement-salon-poster.jpg", "Logement meublé pour un séjour de moyenne durée"),
         puces=["Bail <b>mobilité</b>", "Séjours <b>longs</b>",
                "Demande <b>toute l'année</b>", "Peu de <b>rotations</b>"],
         cta="Estimer mes revenus",
         intro=[
             "Le plateau de Paris-Saclay regroupe universités, grandes écoles, laboratoires publics "
             "et centres de R&D privés. La conséquence pour un propriétaire est très concrète : la "
             "demande d'hébergement n'y est pas touristique mais académique et professionnelle — "
             "des séjours de plusieurs semaines à plusieurs mois, du lundi au vendredi comme le "
             "week-end.",
             "Nous gérons des biens à <a href=\"/conciergerie-airbnb-orsay\">Orsay</a>, "
             "<a href=\"/conciergerie-airbnb-gif-sur-yvette\">Gif-sur-Yvette</a>, "
             "<a href=\"/conciergerie-airbnb-bures-sur-yvette\">Bures-sur-Yvette</a>, "
             "<a href=\"/conciergerie-airbnb-saclay\">Saclay</a>, "
             "<a href=\"/conciergerie-airbnb-palaiseau\">Palaiseau</a>, "
             "<a href=\"/conciergerie-airbnb-les-ulis\">Les Ulis</a>, "
             "<a href=\"/conciergerie-airbnb-villebon-sur-yvette\">Villebon</a> et "
             "<a href=\"/conciergerie-airbnb-igny\">Igny</a>.",
         ],
         cards=("Une gestion pensée pour la moyenne durée", "Moins de rotations, plus de revenus nets.", [
             ("Bail mobilité",
              "De 1 à 10 mois, sans dépôt de garantie, réservé aux publics en mobilité : doctorants, "
              "stagiaires, chercheurs invités, salariés en mission. Le cadre légal parfait pour le plateau."),
             ("Logements équipés pour travailler",
              "Bureau, chaise correcte, wifi fiable, éclairage : un chercheur qui reste trois mois "
              "choisit d'abord un endroit où il peut travailler."),
             ("Sélection des occupants",
              "Vérification des pièces et des rattachements institutionnels : des séjours longs "
              "supposent des dossiers solides."),
             ("Ménage adapté",
              "Nettoyage entre chaque occupant, entretien intermédiaire sur demande, linge fourni "
              "selon la formule choisie."),
             ("Alternance des régimes",
              "Colloques, rentrée universitaire, salons de Courtabœuf : nous ouvrons la courte durée "
              "quand elle rapporte plus, et nous revenons au bail mobilité ensuite."),
             ("Maintenance locale",
              "Nos artisans sont dans le département : une panne de chauffage en janvier se traite "
              "le jour même."),
         ]),
         sections=[
             ("Pourquoi la moyenne durée bat souvent la nuitée sur le plateau", [
                 "Un bien loué en bail mobilité affiche un revenu mensuel inférieur à celui d'un "
                 "Airbnb plein — mais il n'a ni calendrier à trous, ni frais de ménage à chaque "
                 "rotation, ni linge à renouveler toutes les trois nuits, ni risque d'annulation.",
                 "Sur douze mois, dans un secteur où la demande touristique est faible mais la "
                 "demande académique très forte, le net encaissé est souvent supérieur — et la "
                 "gestion nettement plus sereine. Nous chiffrons les deux scénarios avant de "
                 "recommander l'un ou l'autre.",
             ]),
             ("Courtabœuf : l'autre moteur du secteur", [
                 "Le parc d'activités de Courtabœuf, l'un des plus grands d'Europe, fait venir des "
                 "prestataires en mission toute l'année, souvent pour des durées de quelques "
                 "semaines à quelques mois.",
                 "Les communes des <a href=\"/conciergerie-airbnb-les-ulis\">Ulis</a> et de "
                 "<a href=\"/conciergerie-airbnb-villebon-sur-yvette\">Villebon-sur-Yvette</a> sont "
                 "en première ligne, mais la demande déborde largement sur "
                 "<a href=\"/conciergerie-airbnb-orsay\">Orsay</a> et "
                 "<a href=\"/conciergerie-airbnb-palaiseau\">Palaiseau</a>.",
             ]),
         ],
         gallery=[C.photo(k + 2) for k in range(6)],
         steps=("Comment nous démarrons", [
             ("1. Étude", "Distance aux campus et à Courtabœuf, équipement de travail, potentiel réel."),
             ("2. Préparation", "Aménagement orienté séjour long, photos, annonce."),
             ("3. Lancement", "Diffusion sur les canaux courte durée et les réseaux de mobilité académique."),
             ("4. Suivi", "Sélection, bail, états des lieux, entretien, reporting mensuel."),
         ]),
         why=("Pourquoi Label Maison en Essonne", WHY),
         zones=("Les communes du plateau", "",
                [("Orsay", "/conciergerie-airbnb-orsay"),
                 ("Gif-sur-Yvette", "/conciergerie-airbnb-gif-sur-yvette"),
                 ("Bures-sur-Yvette", "/conciergerie-airbnb-bures-sur-yvette"),
                 ("Saclay", "/conciergerie-airbnb-saclay"),
                 ("Les Ulis", "/conciergerie-airbnb-les-ulis"),
                 ("Palaiseau", "/conciergerie-airbnb-palaiseau"),
                 ("Toute l'Essonne", HUB)],
                "Voir aussi notre <a href=\"/estimation-rentabilite-airbnb\"><strong>estimation "
                "gratuite de rentabilité</strong></a>."),
         faq_title="Questions fréquentes — Paris-Saclay",
         faq=[
             ("Le bail mobilité, c'est quoi exactement ?",
              "Un bail meublé de 1 à 10 mois, non renouvelable, sans dépôt de garantie, réservé aux "
              "personnes en formation, en stage, en mission professionnelle ou en mutation. Il "
              "échappe au plafond de nuitées de la location touristique."),
             ("Puis-je alterner Airbnb et bail mobilité ?",
              "Oui, et c'est souvent la meilleure stratégie sur le plateau : courte durée pendant "
              "les colloques et les pics, bail mobilité le reste de l'année."),
             ("Faut-il un logement très décoré ?",
              "Moins qu'en centre-ville. Ce qui compte ici : un vrai espace de travail, du calme, "
              "une connexion fiable et une literie correcte."),
             ("Quels revenus espérer ?",
              "Cela dépend de la commune, de la surface et du régime. Nous établissons une "
              "estimation à partir de biens réellement loués autour du vôtre — jamais un "
              "pourcentage sorti d'un tableur."),
             ("Gérez-vous la sélection des locataires ?",
              "Oui : vérification des pièces, du rattachement institutionnel et des garanties. "
              "Vous validez le dossier final."),
             ("Intervenez-vous à Massy et Palaiseau ?",
              "Oui — voir <a href=\"/conciergerie-airbnb-massy\">Massy</a> et "
              "<a href=\"/conciergerie-airbnb-palaiseau\">Palaiseau</a>."),
         ],
         form=("Votre bien est sur le plateau ? Comparons les scénarios",
               "Commune, surface, équipement : nous chiffrons courte durée et bail mobilité, et "
               "nous vous disons lequel rapporte le plus sur douze mois.",
               "Paris-Saclay", "Conciergerie Airbnb"),
         footer=FOOT_91,
         tagline="Conciergerie Airbnb sur le plateau de Paris-Saclay — "
                 "<span class=\"font-serif-italic\">la moyenne durée bien gérée</span>.",
         lieu="Orsay · Gif-sur-Yvette · Palaiseau · Les Ulis",
         mobcta="Estimer mes revenus"),
]


def patch_hub() -> None:
    """Ajoute les nouvelles communes au maillage du hub Essonne existant."""
    p = pathlib.Path(C.OUT / "conciergerie-airbnb-essonne.html")
    s = p.read_text(encoding="utf-8")
    liens = "".join(f'<a href="/conciergerie-airbnb-{v[1]}">{C.esc(v[0])}</a>' for v in V)
    liens += ('<a href="/conciergerie-airbnb-orly-aeroport">Aéroport d\'Orly</a>'
              '<a href="/conciergerie-airbnb-paris-saclay">Plateau de Paris-Saclay</a>'
              '<a href="/conciergerie-airbnb-banlieue-parisienne">Banlieue parisienne</a>'
              '<a href="/conciergerie-airbnb-paris">Paris</a>')
    if "conciergerie-airbnb-les-ulis" in s:  # déjà patché : on remplace le bloc ajouté
        s = re.sub(r'<div class="zones" id="zones91">.*?</div>', "", s, flags=re.S)
    bloc = f'<div class="zones" id="zones91" style="margin-top:14px">{liens}</div>'
    s = s.replace('</div>\n<p style="margin-top', bloc + '</div>\n<p style="margin-top', 1)
    if bloc not in s:  # gabarit différent : on insère juste après le bloc zones existant
        s = re.sub(r'(<div class="zones"[^>]*>.*?</div>)', r"\1" + bloc, s, count=1, flags=re.S)
    p.write_text(s, encoding="utf-8")


def main() -> list:
    urls = []
    for i, v in enumerate(V):
        urls.append(SV.page(SILO, v, i, V))
    urls += [build(s) for s in POLES]
    patch_hub()
    print(f"Essonne : {len(urls)} pages + maillage du hub existant")
    return urls


if __name__ == "__main__":
    main()
