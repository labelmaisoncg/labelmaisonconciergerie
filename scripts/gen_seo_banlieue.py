# -*- coding: utf-8 -*-
"""Silo SEO banlieue parisienne : les communes où l'Airbnb rapporte vraiment.

Le critère de sélection n'est pas la taille de la commune mais son moteur de
demande : aéroport (Roissy, Orly), parc des expositions (Villepinte, Le Bourget),
stade et salle (Stade de France, La Défense Arena), pôle hospitalier ou
universitaire, gare TGV/RER, Disneyland, château de Versailles.

Point réglementaire important et vérifiable : dans les Hauts-de-Seine, la
Seine-Saint-Denis et le Val-de-Marne, l'autorisation de changement d'usage
s'applique comme à Paris (art. L631-7 du code de la construction et de
l'habitation), ce que la plupart des propriétaires ignorent.
"""
from __future__ import annotations

import seo_common as C
import seo_ville as SV

HUB = "/conciergerie-airbnb-banlieue-parisienne"
NAV = [("Banlieue parisienne", HUB), ("Paris", "/conciergerie-airbnb-paris"),
       ("Île-de-France", "/conciergerie-airbnb-ile-de-france"),
       ("Propriétaires", "/proprietaires")]

# nom, slug, dept, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue
V = [
    # -------------------------------------------------------------- 92
    ("Boulogne-Billancourt", "boulogne-billancourt", "92", "92100", (48.8352, 2.2409),
     ["le Point du Jour", "Billancourt", "Marcel-Sembat", "les Princes"],
     ["l'île Seguin et la Seine Musicale", "le Parc des Princes voisin", "Roland-Garros", "les lignes 9 et 10"],
     "Première ville de banlieue de France, Boulogne joue en réalité dans la même catégorie que les arrondissements parisiens limitrophes — pour un prix d'achat inférieur.",
     "Cadres en mission dans les sièges sociaux, spectateurs du Parc des Princes et de Roland-Garros, familles en séjour parisien.",
     "Appartements des années 30, immeubles récents, studios proches métro",
     "Demande professionnelle continue, pics lors des matchs, de Roland-Garros et des concerts de la Seine Musicale.", True),
    ("Neuilly-sur-Seine", "neuilly-sur-seine", "92", "92200", (48.8846, 2.2697),
     ["les Sablons", "le Château", "Bagatelle", "Saint-James"],
     ["le bois de Boulogne", "le Palais des Congrès porte Maillot", "La Défense à cinq minutes", "l'avenue Charles-de-Gaulle"],
     "Entre le bois de Boulogne et La Défense, Neuilly capte une clientèle d'affaires haut de gamme qui refuse les hôtels du quartier d'affaires.",
     "Dirigeants en déplacement, congressistes de la porte Maillot, familles internationales.",
     "Appartements haussmanniens, immeubles de standing, pied-à-terre",
     "Demande professionnelle très régulière, renforcée par les congrès et les grands salons.", True),
    ("Levallois-Perret", "levallois-perret", "92", "92300", (48.8933, 2.2889),
     ["le centre", "Anatole-France", "Louise-Michel", "le front de Seine"],
     ["les sièges d'entreprises", "le Palais des Congrès", "la ligne 3", "les bords de Seine"],
     "L'une des plus fortes densités de sièges sociaux d'Île-de-France : à Levallois, la semaine se loue mieux que le week-end, ce qui est l'inverse de Paris.",
     "Consultants et cadres en mission à la semaine, séjours professionnels de courte durée.",
     "Studios et deux-pièces récents, appartements proches métro",
     "Occupation forte du lundi au jeudi, creux le week-end et en août : la moyenne durée comble parfaitement.", True),
    ("Puteaux et La Défense", "puteaux-la-defense", "92", "92800", (48.8846, 2.2385),
     ["La Défense", "le centre ancien", "l'île de Puteaux", "Bellini"],
     ["le quartier d'affaires de La Défense", "la Grande Arche", "Paris La Défense Arena", "le CNIT"],
     "Premier quartier d'affaires d'Europe, doublé de la plus grande salle de spectacle du continent : Puteaux cumule séjours professionnels en semaine et concerts le week-end.",
     "Cadres et consultants en mission, public de Paris La Défense Arena, congressistes du CNIT.",
     "Studios et deux-pièces de tours résidentielles, appartements du centre ancien",
     "Demande professionnelle très soutenue hors vacances, pics les soirs de concert et de match.", True),
    ("Courbevoie", "courbevoie", "92", "92400", (48.8975, 2.2568),
     ["le Faubourg de l'Arche", "Bécon-les-Bruyères", "le centre", "Gambetta"],
     ["La Défense à pied", "la gare de Bécon", "les bords de Seine", "Paris La Défense Arena"],
     "Courbevoie offre La Défense à pied avec des loyers inférieurs : c'est le meilleur compromis du secteur pour un investisseur.",
     "Cadres en mission, séjours professionnels à la semaine, public des événements de La Défense.",
     "Deux-pièces récents, studios proches gare, appartements familiaux",
     "Semaine chargée toute l'année hors août, week-ends portés par les événements.", True),
    ("Issy-les-Moulineaux", "issy-les-moulineaux", "92", "92130", (48.8244, 2.2735),
     ["le Val de Seine", "Corentin-Celton", "l'île Saint-Germain", "les Épinettes"],
     ["les sièges des médias et de la tech", "l'héliport de Paris", "le parc de l'île Saint-Germain", "les lignes 12 et T2"],
     "Le Val de Seine concentre médias, télécoms et tech : une demande professionnelle stable, très peu concurrencée par l'offre hôtelière du secteur.",
     "Salariés en mission dans les sièges du Val de Seine, prestataires en projet long, familles.",
     "Appartements récents avec balcon, studios proches tram, deux-pièces rénovés",
     "Occupation professionnelle continue, creux estival compensé par la moyenne durée.", True),
    ("Clichy", "clichy", "92", "92110", (48.9044, 2.3064),
     ["le centre", "Bac d'Asnières", "Berges de Seine", "Victor-Hugo"],
     ["l'hôpital Beaujon", "la ligne 13", "le marché de Clichy", "Paris à une station"],
     "À une station de Paris, Clichy reste l'un des tickets d'entrée les plus abordables de la petite couronne pour un bien réellement rentable.",
     "Séjours hospitaliers autour de Beaujon, jeunes voyageurs européens, déplacements professionnels.",
     "Studios rénovés, deux-pièces d'immeubles anciens, appartements récents",
     "Demande régulière toute l'année, sans forte saisonnalité.", True),
    ("Asnières-sur-Seine", "asnieres-sur-seine", "92", "92600", (48.9105, 2.2850),
     ["le centre", "les Grésillons", "le parc Robinson", "Bécon"],
     ["les bords de Seine", "la ligne 13", "le cimetière des chiens", "La Défense à dix minutes"],
     "Asnières profite de deux pôles à la fois — Paris et La Défense — avec des prix d'achat qui restent accessibles à un premier investissement.",
     "Déplacements professionnels, jeunes couples, familles en visite parisienne.",
     "Appartements des années 30, studios proches gare, biens familiaux",
     "Demande stable, portée par la semaine professionnelle et les week-ends parisiens.", True),
    ("Montrouge", "montrouge", "92", "92120", (48.8186, 2.3197),
     ["le centre", "la Vache Noire", "Jean-Jaurès", "Ferry"],
     ["la ligne 4", "Alésia à cinq minutes", "le beffroi", "la Cité universitaire voisine"],
     "Montrouge, c'est Paris 14e sans le prix parisien : la ligne 4 met la porte d'Orléans à trois minutes, et les voyageurs ne font pas la différence.",
     "Voyageurs qui visitent Paris à budget maîtrisé, universitaires, déplacements professionnels.",
     "Studios et deux-pièces d'immeubles récents, appartements rénovés",
     "Occupation régulière toute l'année, très peu de creux.", True),
    ("Rueil-Malmaison", "rueil-malmaison", "92", "92500", (48.8760, 2.1802),
     ["le centre-ville", "Rueil-sur-Seine", "Buzenval", "Plaine-Gare"],
     ["le château de Malmaison", "les bords de Seine", "le RER A", "les sièges d'entreprises"],
     "Rueil combine sièges d'entreprises, cadre verdoyant et RER A : la moyenne durée pour salariés en mission y fonctionne remarquablement bien.",
     "Salariés en mission longue, familles en mutation, visiteurs du château de Malmaison.",
     "Appartements avec balcon, maisons de ville, biens familiaux avec parking",
     "Demande professionnelle continue, avec des séjours plus longs que la moyenne francilienne.", True),
    ("Nanterre", "nanterre", "92", "92000", (48.8924, 2.2069),
     ["le Petit-Nanterre", "le centre", "Université", "les Terrasses"],
     ["Paris La Défense Arena", "l'université Paris-Nanterre", "la préfecture", "le RER A"],
     "Paris La Défense Arena remplit Nanterre à chaque concert et à chaque match : une demande événementielle massive, mal servie par l'offre hôtelière locale.",
     "Public des concerts et matchs à l'Arena, étudiants et intervenants universitaires, déplacements administratifs.",
     "Appartements récents des Terrasses, studios proches RER, biens familiaux",
     "Pics très marqués les soirs d'événement à l'Arena, demande universitaire de septembre à juin.", True),
    ("Saint-Cloud", "saint-cloud", "92", "92210", (48.8459, 2.2189),
     ["le centre", "Montretout", "le Val d'Or", "Coteaux"],
     ["le parc de Saint-Cloud", "l'hippodrome", "le stade Français", "les bords de Seine"],
     "Saint-Cloud offre un cadre résidentiel rare à dix minutes de Paris : les séjours y sont plus longs, souvent familiaux, et les rotations plus faibles.",
     "Familles en séjour parisien, séjours professionnels prolongés, visiteurs du parc et de l'hippodrome.",
     "Appartements bourgeois, maisons avec jardin, biens avec vue sur Paris",
     "Demande régulière, renforcée aux beaux jours par le parc et les événements hippiques.", True),
    # -------------------------------------------------------------- 93
    ("Saint-Denis", "saint-denis-93", "93", "93200", (48.9362, 2.3574),
     ["le centre-ville", "La Plaine Saint-Denis", "Pleyel", "la Basilique"],
     ["le Stade de France", "la basilique des rois de France", "La Plaine et ses sièges sociaux", "la ligne 13 et le RER B"],
     "Le Stade de France, c'est plusieurs dizaines de soirées par an à guichets fermés : les nuits d'événement se paient trois à quatre fois le tarif d'une nuit ordinaire.",
     "Public des concerts et matchs au Stade de France, salariés de La Plaine, voyageurs en transit vers Roissy.",
     "Appartements récents de La Plaine, studios proches RER, biens rénovés du centre",
     "Demande professionnelle en semaine, pics spectaculaires les soirs de match ou de concert.", True),
    ("Saint-Ouen-sur-Seine", "saint-ouen-sur-seine", "93", "93400", (48.9110, 2.3336),
     ["les Puces", "les Docks", "le Vieux Saint-Ouen", "Garibaldi"],
     ["les puces de Saint-Ouen", "le terminus de la ligne 14", "les Docks et l'écoquartier", "le Grand Paris"],
     "Le prolongement de la ligne 14 a rapproché Saint-Ouen du centre de Paris plus vite que les prix ne l'ont rattrapé : c'est encore une fenêtre.",
     "Chineurs des puces le week-end, voyageurs en visite parisienne, déplacements professionnels.",
     "Appartements neufs des Docks, lofts d'ateliers, studios rénovés",
     "Week-ends portés par les puces, semaine professionnelle, occupation stable toute l'année.", True),
    ("Montreuil", "montreuil", "93", "93100", (48.8638, 2.4485),
     ["le Bas-Montreuil", "Croix-de-Chavaux", "les Murs à Pêches", "Robespierre"],
     ["la ligne 9", "les Murs à Pêches", "le marché de la Croix-de-Chavaux", "Paris à une station"],
     "Le Bas-Montreuil est devenu le prolongement naturel du 11e arrondissement : même clientèle, mêmes attentes, prix d'achat nettement inférieurs.",
     "Jeunes voyageurs européens, séjours de trois à cinq nuits, clientèle culturelle.",
     "Lofts d'anciens ateliers, deux-pièces faubouriens, maisons de ville",
     "Demande stable toute l'année, portée par la proximité immédiate de l'est parisien.", True),
    ("Pantin", "pantin", "93", "93500", (48.8940, 2.4090),
     ["les Grands Moulins", "les Quatre-Chemins", "l'Église", "Hoche"],
     ["le canal de l'Ourcq", "les Grands Moulins", "la Cité Fertile", "la ligne 5 et le RER E"],
     "Le canal de l'Ourcq a transformé Pantin en quartier créatif : maisons de mode, bureaux et cafés attirent une clientèle qui n'aurait jamais dormi ici il y a dix ans.",
     "Voyageurs jeunes et créatifs, déplacements professionnels, séjours culturels.",
     "Lofts reconvertis, appartements neufs canal, studios rénovés",
     "Occupation régulière, renforcée par les événements culturels du canal.", True),
    ("Aubervilliers", "aubervilliers", "93", "93300", (48.9146, 2.3822),
     ["le centre", "le Fort d'Aubervilliers", "Front populaire", "la Villette voisine"],
     ["la ligne 12", "le parc de La Villette voisin", "la Cité des sciences", "les zones d'activités"],
     "À une station de Paris par la ligne 12, Aubervilliers propose des surfaces impossibles à trouver intra-muros au même budget.",
     "Familles en visite parisienne, déplacements professionnels, voyageurs à budget maîtrisé.",
     "Grands appartements, studios rénovés, biens récents",
     "Demande régulière toute l'année, sans forte saisonnalité.", True),
    ("Le Bourget", "le-bourget", "93", "93350", (48.9350, 2.4250),
     ["le centre", "la gare", "les Six-Routes", "Dugny voisin"],
     ["l'aéroport d'affaires du Bourget", "le Salon international de l'aéronautique", "le musée de l'Air et de l'Espace", "le parc des expositions"],
     "Le Salon du Bourget, tous les deux ans, sature l'hébergement dans un rayon de vingt kilomètres : une semaine qui peut représenter plusieurs mois de revenus.",
     "Exposants et visiteurs de salons, professionnels de l'aviation d'affaires, voyageurs en transit Roissy.",
     "Studios proches gare, appartements familiaux, biens avec parking",
     "Demande professionnelle continue, pic exceptionnel lors du Salon du Bourget.", True),
    ("Villepinte", "villepinte", "93", "93420", (48.9600, 2.5333),
     ["le Parc des Expositions", "le Vert-Galant", "la Haie Bertrand", "Tremblay voisin"],
     ["Paris Nord Villepinte", "l'aéroport Roissy-CDG à dix minutes", "le RER B", "le parc du Sausset"],
     "Paris Nord Villepinte accueille les plus grands salons professionnels d'Europe : pendant ces semaines, tout se remplit à des tarifs sans commune mesure avec le reste de l'année.",
     "Exposants et visiteurs de salons, équipages et voyageurs en transit CDG, déplacements professionnels.",
     "Appartements proches RER, maisons avec parking, studios fonctionnels",
     "Calendrier rythmé par les salons du parc des expositions, demande aéroportuaire toute l'année.", False),
    ("Noisy-le-Grand", "noisy-le-grand", "93", "93160", (48.8489, 2.5528),
     ["le Mont d'Est", "les Yvris", "le Pavé Neuf", "la cité Descartes"],
     ["le RER A", "la cité Descartes et ses écoles d'ingénieurs", "les bords de Marne", "Disneyland à vingt minutes"],
     "Noisy est la base arrière idéale de Disneyland : vingt minutes de RER, des prix bien inférieurs à ceux de Val d'Europe, et une clientèle familiale qui réserve tôt.",
     "Familles en séjour Disneyland, étudiants et intervenants de la cité Descartes, déplacements professionnels.",
     "Appartements familiaux, studios proches RER, biens avec parking",
     "Vacances scolaires très fortes grâce à Disneyland, demande professionnelle et universitaire le reste du temps.", True),
    ("Bagnolet", "bagnolet", "93", "93170", (48.8659, 2.4176),
     ["le centre", "les Coutures", "la Noue", "porte de Bagnolet"],
     ["la ligne 3", "la gare routière internationale", "le Père-Lachaise voisin", "Paris à une station"],
     "La gare routière internationale de Bagnolet déverse chaque jour des voyageurs européens à petit budget : une clientèle constante que peu de propriétaires exploitent.",
     "Voyageurs européens en bus, jeunes en court séjour, déplacements professionnels.",
     "Studios rénovés, deux-pièces d'immeubles récents, appartements familiaux",
     "Occupation régulière, portée par l'accès direct à l'est parisien.", True),
    # -------------------------------------------------------------- 94
    ("Vincennes", "vincennes", "94", "94300", (48.8478, 2.4392),
     ["le centre", "le Château", "les Vignerons", "Diderot"],
     ["le château de Vincennes", "le bois de Vincennes", "la ligne 1", "le marché de Vincennes"],
     "Vincennes est la commune la plus recherchée de l'est parisien : ligne 1, château, bois, marché — les voyageurs y trouvent Paris sans la densité de Paris.",
     "Familles en visite parisienne, séjours professionnels, couples en court séjour.",
     "Appartements bourgeois, deux-pièces rénovés, biens avec balcon",
     "Demande très régulière toute l'année, week-ends et vacances scolaires soutenus.", True),
    ("Saint-Mandé", "saint-mande", "94", "94160", (48.8459, 2.4166),
     ["le centre", "le lac de Saint-Mandé", "Alouettes", "la mairie"],
     ["le bois de Vincennes", "la ligne 1", "le lac Daumesnil", "Paris à une station"],
     "Saint-Mandé est aussi proche de Paris que certains arrondissements périphériques, avec un cadre résidentiel qui séduit les familles en séjour long.",
     "Familles en séjour parisien, cadres en mission longue, couples.",
     "Appartements de standing, deux-pièces rénovés, biens avec vue sur le bois",
     "Occupation stable, séjours plus longs que la moyenne de la petite couronne.", True),
    ("Charenton-le-Pont", "charenton-le-pont", "94", "94220", (48.8213, 2.4128),
     ["le centre", "Bercy voisin", "Liberté", "les Quais"],
     ["Bercy et l'Accor Arena", "le bois de Vincennes", "la ligne 8", "les bords de Seine"],
     "À cinq minutes de Bercy, Charenton capte le public de l'Accor Arena les soirs de concert — un marché que l'hôtellerie locale ne suffit pas à absorber.",
     "Public de l'Accor Arena, déplacements professionnels, familles en visite parisienne.",
     "Appartements récents, studios proches métro, biens avec parking",
     "Demande régulière, pics les soirs de concert et de compétition à Bercy.", True),
    ("Ivry-sur-Seine", "ivry-sur-seine", "94", "94200", (48.8130, 2.3894),
     ["le centre", "Ivry-Port", "Petit-Ivry", "Monmousseau"],
     ["la ligne 7", "les bords de Seine", "la BnF voisine", "le quartier Ivry Confluences"],
     "Ivry est directement connectée au 13e arrondissement par la ligne 7 : la clientèle qui cherche « Paris sud » n'y regarde pas de si près, et les prix sont bien plus bas.",
     "Voyageurs en visite parisienne, déplacements professionnels, séjours hospitaliers.",
     "Appartements récents, lofts d'anciens ateliers, studios rénovés",
     "Occupation régulière toute l'année, faible saisonnalité.", True),
    ("Villejuif", "villejuif", "94", "94800", (48.7938, 2.3592),
     ["le centre", "Louis-Aragon", "Paul-Vaillant-Couturier", "les Hautes-Bruyères"],
     ["l'Institut Gustave-Roussy", "la ligne 7 et le Grand Paris Express", "le parc des Hautes-Bruyères", "l'hôpital Paul-Brousse"],
     "Deux hôpitaux majeurs, dont le premier centre européen de lutte contre le cancer : la demande d'hébergement pour les familles de patients est constante, toute l'année.",
     "Familles de patients de Gustave-Roussy et Paul-Brousse, personnels médicaux en mission, déplacements professionnels.",
     "Studios et deux-pièces proches hôpital, appartements familiaux",
     "Demande hospitalière continue, sans creux estival ni saisonnalité touristique.", True),
    ("Créteil", "creteil", "94", "94000", (48.7904, 2.4556),
     ["le Mont-Mesly", "le lac", "le Palais", "l'Échat"],
     ["le CHU Henri-Mondor", "le lac de Créteil", "l'université Paris-Est", "la ligne 8"],
     "CHU, université et préfecture : Créteil vit d'une demande institutionnelle permanente, très peu concurrencée par l'hôtellerie.",
     "Familles de patients du CHU Henri-Mondor, étudiants et intervenants universitaires, déplacements administratifs.",
     "Appartements des années 70 rénovés, studios proches métro, biens familiaux",
     "Demande continue toute l'année, sans saisonnalité marquée.", True),
    ("Maisons-Alfort", "maisons-alfort", "94", "94700", (48.8120, 2.4370),
     ["le centre", "Alfort", "Charentonneau", "les Juilliottes"],
     ["l'école vétérinaire d'Alfort", "la ligne 8", "les bords de Marne", "le CHU voisin"],
     "Entre l'école vétérinaire et le CHU voisin, Maisons-Alfort accueille une demande d'étudiants et de professionnels de santé qui dure toute l'année scolaire.",
     "Étudiants et stagiaires, professionnels de santé, familles de patients.",
     "Deux-pièces proches métro, appartements familiaux, studios rénovés",
     "Occupation forte de septembre à juillet, très adaptée au bail mobilité.", True),
    ("Nogent-sur-Marne", "nogent-sur-marne", "94", "94130", (48.8360, 2.4820),
     ["le centre", "les bords de Marne", "le Port", "Baltard"],
     ["les bords de Marne et les guinguettes", "le RER A et E", "le bois de Vincennes", "le pavillon Baltard"],
     "Les bords de Marne donnent à Nogent une identité de villégiature à vingt minutes de Paris : les séjours y sont plus longs et plus familiaux.",
     "Familles en séjour parisien, événements au pavillon Baltard, déplacements professionnels.",
     "Maisons de meulière, appartements bourgeois, biens avec jardin",
     "Demande régulière, renforcée au printemps et en été par les bords de Marne.", True),
    ("Le Kremlin-Bicêtre", "le-kremlin-bicetre", "94", "94270", (48.8103, 2.3610),
     ["le centre", "l'hôpital", "Fontainebleau", "la porte d'Italie"],
     ["l'hôpital Bicêtre", "la ligne 7", "la porte d'Italie", "le 13e arrondissement voisin"],
     "L'hôpital Bicêtre génère une demande d'hébergement de proximité toute l'année : accompagnants, internes, personnels en mission.",
     "Familles de patients, internes et personnels hospitaliers, voyageurs en visite parisienne.",
     "Studios proches hôpital, deux-pièces rénovés, appartements familiaux",
     "Demande hospitalière constante, sans saisonnalité.", True),
    ("Orly", "orly", "94", "94310", (48.7433, 2.3927),
     ["le centre", "les Aviateurs", "le Vieux Orly", "Paray voisin"],
     ["l'aéroport de Paris-Orly", "le tramway T7", "l'Orlyval", "le marché international de Rungis voisin"],
     "Un aéroport qui accueille des dizaines de millions de passagers par an : les vols tôt le matin et les correspondances créent une demande de nuit d'escale que rien ne vient absorber.",
     "Passagers en escale et vols matinaux, équipages, professionnels de Rungis et de la zone aéroportuaire.",
     "Studios fonctionnels, appartements avec parking, biens proches tram",
     "Demande aéroportuaire continue toute l'année, y compris en semaine et en hiver.", False),
    # -------------------------------------------------------------- 78
    ("Versailles", "versailles", "78", "78000", (48.8014, 2.1301),
     ["Notre-Dame", "Saint-Louis", "Montreuil", "Chantiers"],
     ["le château de Versailles", "le marché Notre-Dame", "le potager du Roi", "les gares vers Paris"],
     "Le château reçoit chaque année des millions de visiteurs, dont une majorité repart dormir à Paris faute d'offre locale : c'est exactement le vide qu'un bien bien tenu vient combler.",
     "Touristes internationaux du château, familles, séminaires d'entreprise, événements équestres.",
     "Appartements du quartier Notre-Dame, maisons de ville, biens de caractère",
     "Saison touristique d'avril à octobre, événements et congrès toute l'année, marché très animé le week-end.", True),
    ("Saint-Germain-en-Laye", "saint-germain-en-laye", "78", "78100", (48.8990, 2.0940),
     ["le centre historique", "le Bel-Air", "Fourqueux", "le Pecq voisin"],
     ["le château et la terrasse Le Nôtre", "la forêt de Saint-Germain", "le RER A", "le camp des Loges"],
     "Saint-Germain-en-Laye combine patrimoine, forêt et RER A direct : une clientèle familiale et internationale qui reste plusieurs nuits.",
     "Familles internationales, visiteurs du château, cadres en mission longue, événements sportifs.",
     "Appartements du centre historique, maisons avec jardin, biens de standing",
     "Saison d'avril à octobre, demande professionnelle et familiale continue le reste de l'année.", True),
    ("Saint-Quentin-en-Yvelines", "saint-quentin-en-yvelines", "78", "78180", (48.7700, 2.0300),
     ["Montigny-le-Bretonneux", "Guyancourt", "Voisins-le-Bretonneux", "Trappes"],
     ["le Vélodrome national", "le Golf National", "les sièges automobiles et technologiques", "la gare de Saint-Quentin"],
     "Vélodrome national, Golf National et grands sièges industriels : Saint-Quentin vit d'une demande professionnelle et sportive qu'aucune offre hôtelière ne suffit à absorber lors des grands événements.",
     "Ingénieurs et prestataires des sièges industriels, public des événements sportifs, séminaires.",
     "Appartements récents, maisons de ville, biens avec parking",
     "Demande professionnelle très régulière, pics lors des compétitions au Vélodrome et au Golf National.", False),
    ("Poissy", "poissy", "78", "78300", (48.9290, 2.0400),
     ["le centre", "la Coudraie", "Beauregard", "le port"],
     ["l'usine automobile", "la villa Savoye", "les bords de Seine", "le RER A"],
     "Le tissu industriel de Poissy fait venir chaque semaine des prestataires en mission : la moyenne durée y est bien plus rentable que la nuitée touristique.",
     "Prestataires et ingénieurs en mission, visiteurs de la villa Savoye, déplacements professionnels.",
     "Appartements proches gare, maisons de ville, studios fonctionnels",
     "Demande professionnelle continue de septembre à juillet, creux limité en août.", False),
    # -------------------------------------------------------------- 95
    ("Roissy-en-France", "roissy-en-france", "95", "95700", (49.0000, 2.5150),
     ["le village", "Roissypole", "Paris Nord 2", "Le Mesnil-Amelot voisin"],
     ["l'aéroport Roissy-Charles-de-Gaulle", "le parc des expositions de Villepinte", "Paris Nord 2", "la gare TGV de CDG"],
     "Premier aéroport de France : escales, vols matinaux, équipages et salons professionnels génèrent une demande de nuit qui ne connaît ni week-end ni saison creuse.",
     "Passagers en escale et vols tôt le matin, équipages, exposants des salons, professionnels de la zone aéroportuaire.",
     "Studios fonctionnels, appartements avec parking, maisons proches navettes",
     "Demande aéroportuaire continue toute l'année, renforcée par les salons de Villepinte et du Bourget.", False),
    ("Cergy", "cergy", "95", "95000", (49.0350, 2.0600),
     ["Cergy-Préfecture", "Cergy-le-Haut", "l'Axe majeur", "Cergy-Village"],
     ["l'université CY Cergy Paris", "la base de loisirs", "l'Axe majeur", "le RER A"],
     "Université, préfecture et base de loisirs : Cergy cumule demande étudiante d'octobre à juin et fréquentation familiale l'été.",
     "Étudiants et intervenants universitaires, familles à la base de loisirs, déplacements administratifs.",
     "Appartements récents, studios proches campus, maisons de ville",
     "Rentrée universitaire très tendue, été porté par la base de loisirs.", False),
    ("Enghien-les-Bains", "enghien-les-bains", "95", "95880", (48.9700, 2.3060),
     ["le lac", "le centre", "la gare", "Soisy voisin"],
     ["le casino d'Enghien", "le lac", "les thermes", "la gare vers Paris Nord en quinze minutes"],
     "Seule ville thermale d'Île-de-France, avec le casino le plus fréquenté du pays : Enghien reçoit une clientèle de loisirs à quinze minutes de la gare du Nord.",
     "Clientèle du casino et des spectacles, curistes, couples en week-end, déplacements professionnels.",
     "Appartements Belle Époque, biens vue lac, maisons de ville",
     "Week-ends très demandés toute l'année, saison thermale au printemps et à l'automne.", True),
    ("Argenteuil", "argenteuil", "95", "95100", (48.9470, 2.2470),
     ["le centre", "le Val d'Argent", "Orgemont", "les bords de Seine"],
     ["les bords de Seine peints par les impressionnistes", "la gare vers Saint-Lazare", "le parc des Berges", "La Défense à quinze minutes"],
     "Argenteuil offre un accès direct à Saint-Lazare et à La Défense pour des prix d'achat parmi les plus bas de la petite couronne élargie : le rendement brut y est mécaniquement élevé.",
     "Déplacements professionnels, familles en visite parisienne, séjours de moyenne durée.",
     "Appartements récents, maisons de ville, studios rénovés",
     "Demande régulière toute l'année, portée par l'accès rapide à Paris et à La Défense.", True),
    # -------------------------------------------------------------- 77
    ("Val d'Europe et Disneyland", "val-d-europe-disneyland", "77", "77700", (48.8500, 2.7800),
     ["Serris", "Chessy", "Bailly-Romainvilliers", "Magny-le-Hongre"],
     ["Disneyland Paris", "La Vallée Village", "la gare TGV de Marne-la-Vallée", "le centre commercial Val d'Europe"],
     "Disneyland Paris est la première destination touristique d'Europe : à Val d'Europe, la demande familiale est massive, prévisible et concentrée sur les vacances scolaires européennes.",
     "Familles en séjour Disneyland, visiteurs internationaux, clientèle de La Vallée Village, séminaires.",
     "Appartements familiaux, maisons avec plusieurs chambres, biens avec parking",
     "Vacances scolaires françaises, britanniques, néerlandaises et espagnoles : un calendrier européen dense toute l'année.", False),
    ("Meaux", "meaux", "77", "77100", (48.9600, 2.8800),
     ["le centre historique", "Beauval", "la Cathédrale", "les bords de Marne"],
     ["la cathédrale Saint-Étienne", "le musée de la Grande Guerre", "les bords de Marne", "Disneyland à trente minutes"],
     "Meaux joue deux cartes : le tourisme de mémoire autour du musée de la Grande Guerre, et une base arrière abordable pour Disneyland à trente minutes.",
     "Familles en séjour Disneyland à budget maîtrisé, tourisme de mémoire, déplacements professionnels.",
     "Appartements du centre historique, maisons de ville, biens avec parking",
     "Vacances scolaires portées par Disneyland, saison culturelle d'avril à octobre.", False),
    ("Fontainebleau", "fontainebleau", "77", "77300", (48.4040, 2.7010),
     ["le centre", "le Château", "Avon", "la forêt"],
     ["le château de Fontainebleau", "la forêt et les sites d'escalade", "l'INSEAD", "le Grand Parquet"],
     "Château, forêt d'escalade mondialement connue et INSEAD : Fontainebleau attire trois clientèles différentes qui ne se disputent jamais les mêmes semaines.",
     "Grimpeurs et randonneurs, étudiants et cadres de l'INSEAD, visiteurs du château, cavaliers.",
     "Maisons bellifontaines, appartements du centre, biens avec jardin",
     "Escalade au printemps et à l'automne, tourisme du château en été, sessions INSEAD toute l'année.", False),
]

SERVICES = [
    ("Annonce et diffusion",
     "Photos professionnelles, annonce rédigée pour la recherche, diffusion Airbnb, Booking et "
     "Abritel avec calendriers synchronisés."),
    ("Prix calés sur les événements",
     "Salons, concerts, matchs, congrès, vacances scolaires européennes : en banlieue parisienne, "
     "l'essentiel de la marge se fait sur quelques dizaines de nuits par an."),
    ("Arrivées à toute heure",
     "Vols matinaux, trains de nuit, spectacles qui finissent tard : nos check-in s'adaptent aux "
     "horaires réels des voyageurs franciliens."),
    ("Ménage et linge hôtelier",
     "Rotation professionnelle entre chaque séjour, linge fourni et blanchi, produits d'accueil, "
     "contrôle photo à chaque départ."),
    ("Moyenne durée et bail mobilité",
     "Missions, mutations, stages, internats hospitaliers : en Île-de-France, la moyenne durée "
     "remplit les mois creux mieux que n'importe quelle promotion."),
    ("Maintenance réactive",
     "Un réseau d'artisans en petite et grande couronne : la panne du samedi soir ne devient pas "
     "un avis à deux étoiles."),
]

WHY = [
    ("Nous jouons le calendrier francilien",
     "Stade de France, Paris La Défense Arena, Accor Arena, Villepinte, Le Bourget, Roland-Garros, "
     "Disneyland : ces dates valent plusieurs mois de revenus, et elles se préparent à l'avance."),
    ("Le bon régime pour la bonne commune",
     "Dans les Hauts-de-Seine, la Seine-Saint-Denis et le Val-de-Marne, la réglementation est aussi "
     "stricte qu'à Paris. Nous vérifions, puis nous choisissons entre courte durée et bail mobilité."),
    ("Des équipes qui se déplacent vite",
     "Ménage et artisans basés en couronne, pas à l'autre bout de l'Île-de-France : c'est ce qui "
     "permet d'enchaîner un départ à 11 h et une arrivée à 15 h."),
    ("Rémunérés au résultat",
     "Commission sur les revenus encaissés, sans abonnement ni frais d'entrée. Un calendrier vide "
     "ne nous rapporte rien non plus."),
]


def regl(v) -> str:
    nom, dept = v[0], v[2]
    if dept in ("92", "93", "94"):
        return (f"Point souvent ignoré des propriétaires : dans les Hauts-de-Seine, la "
                f"Seine-Saint-Denis et le Val-de-Marne, le régime du changement d'usage s'applique "
                f"comme à Paris (article L631-7 du code de la construction et de l'habitation). "
                f"À {nom}, louer une <strong>résidence principale</strong> en meublé de tourisme "
                f"reste possible dans la limite de 120 nuits par an, avec déclaration en mairie "
                f"lorsque la commune l'a instaurée ; en revanche, louer une "
                f"<strong>résidence secondaire</strong> en courte durée suppose une autorisation "
                f"de changement d'usage. Nous vérifions la situation exacte de votre bien auprès de "
                f"la mairie avant toute mise en ligne.")
    return (f"À {nom}, les règles dépendent de la commune : enregistrement en mairie et numéro à "
            f"afficher sur l'annonce lorsqu'il a été instauré, plafond de 120 nuits par an pour une "
            f"résidence principale, et taxe de séjour due dans tous les cas. Nous vérifions ce qui "
            f"s'applique à votre adresse avant la mise en ligne.")


def extra(v):
    nom = v[0]
    return (f"Moyenne durée à {nom} : le levier que peu de propriétaires exploitent", [
        f"L'Île-de-France concentre les mobilités professionnelles : missions de trois mois, "
        f"mutations, stages, internats hospitaliers, chantiers. Le bail mobilité (1 à 10 mois, sans "
        f"dépôt de garantie) répond exactement à ce besoin, et il échappe au plafond de nuitées de "
        f"la location touristique.",
        f"Concrètement, à {nom}, cela permet de louer en courte durée pendant les périodes de forte "
        f"demande — salons, événements, vacances — et de basculer en bail mobilité le reste de "
        f"l'année, plutôt que de laisser le calendrier se vider. C'est ce pilotage mixte qui fait "
        f"la différence sur douze mois.",
    ])


def faq_extra(v):
    nom, dept = v[0], v[2]
    q = [(f"Faut-il une autorisation de changement d'usage à {nom} ?",
          ("Oui pour une résidence secondaire louée en meublé de tourisme : les communes des "
           "Hauts-de-Seine, de Seine-Saint-Denis et du Val-de-Marne relèvent du même régime que "
           "Paris. Pour une résidence principale, la location reste possible dans la limite de "
           "120 nuits par an. Nous faisons la vérification pour vous avant toute mise en ligne.")
          if dept in ("92", "93", "94") else
          ("Cela dépend de la commune : certaines ont instauré l'enregistrement, d'autres non. "
           "Nous vérifions auprès de la mairie avant la mise en ligne, et nous nous chargeons de "
           "la démarche si elle est nécessaire."))]
    q.append((f"Mon bien à {nom} intéresse-t-il vraiment les voyageurs ?",
              "La banlieue parisienne est très recherchée dès lors que le trajet vers le centre est "
              "simple et que le logement est irréprochable. Les voyageurs comparent d'abord le temps "
              "de transport et la propreté, ensuite l'adresse."))
    return q


SILO = SV.Silo(
    nom="banlieue parisienne", hub=HUB, region="Île-de-France", nav=NAV,
    services=SERVICES, why=WHY, regl=regl, extra_section=extra, faq_extra=faq_extra,
    titre_tpl="Conciergerie Airbnb à {nom} ({cp}) — gestion locative clé en main",
    badge_tpl="📍 {nom} · {dept} · Île-de-France",
    footer_extra=[("Île-de-France", [("Toute la banlieue parisienne", HUB),
                                     ("Paris et ses 20 arrondissements", "/conciergerie-airbnb-paris"),
                                     ("Île-de-France", "/conciergerie-airbnb-ile-de-france"),
                                     ("Essonne (91)", "/conciergerie-airbnb-essonne"),
                                     ("Estimation gratuite", "/estimation-rentabilite-airbnb")])],
)

HUB_SPEC = dict(
    title="Conciergerie Airbnb en banlieue parisienne — les communes où ça rapporte vraiment",
    desc="Conciergerie Airbnb en banlieue parisienne : La Défense, Stade de France, Roissy-CDG, Orly, "
         "Villepinte, Versailles, Disneyland, Vincennes, Boulogne… Gestion locative clé en main pour "
         "les propriétaires du 92, 93, 94, 78, 95 et 77.",
    ville_ld="Paris", cp_ld="75008", geo_ld=(48.8698, 2.3079), photo_index=8,
    badge="🏙️ Île-de-France · Petite et grande couronne",
    h1="Conciergerie Airbnb en <span class=\"font-serif-italic\">banlieue parisienne</span>",
    sub="Aéroports, parcs des expositions, stades, hôpitaux, Disneyland : la couronne parisienne "
        "concentre des moteurs de demande que Paris intra-muros n'a pas. Encore faut-il savoir les "
        "jouer.",
    alt="Appartement géré par Label Maison Conciergerie en banlieue parisienne",
    puces=["92 · 93 · 94 · 78 · 95 · 77", "Salons & <b>événements</b>",
           "Aéroports <b>CDG & Orly</b>", "Bail mobilité <b>inclus</b>"],
    intro=[
        "On répète aux propriétaires de banlieue que « l'Airbnb, c'est pour Paris ». C'est faux, et "
        "c'est même souvent l'inverse : à Villepinte pendant un salon, à Saint-Denis un soir de "
        "concert, à Roissy pour un vol de 6 h, à Val d'Europe pendant les vacances scolaires "
        "européennes, la demande dépasse largement l'offre — et le prix d'achat au mètre carré n'a "
        "rien à voir avec celui du 6e arrondissement.",
        "<strong>Label Maison Conciergerie</strong> gère des biens dans toute la couronne. Nous "
        "connaissons les calendriers qui font la rentabilité — Stade de France, Paris La Défense "
        "Arena, Paris Nord Villepinte, Le Bourget, Roland-Garros, Disneyland — et la réglementation "
        "propre à chaque département.",
    ],
    sections=[
        ("Ce qui fait la rentabilité en banlieue : les moteurs de demande", [
            "<strong>Les aéroports.</strong> "
            "<a href=\"/conciergerie-airbnb-roissy-en-france\">Roissy-CDG</a> et "
            "<a href=\"/conciergerie-airbnb-orly\">Orly</a> génèrent une demande de nuit d'escale "
            "continue, sans week-end ni saison creuse : vols matinaux, correspondances, équipages.",
            "<strong>Les salons et les grandes salles.</strong> "
            "<a href=\"/conciergerie-airbnb-villepinte\">Paris Nord Villepinte</a>, "
            "<a href=\"/conciergerie-airbnb-le-bourget\">Le Bourget</a>, "
            "<a href=\"/conciergerie-airbnb-saint-denis-93\">le Stade de France</a>, "
            "<a href=\"/conciergerie-airbnb-puteaux-la-defense\">Paris La Défense Arena</a> : "
            "quelques dizaines de nuits par an à des tarifs sans commune mesure avec le reste de "
            "l'année.",
            "<strong>Les hôpitaux et les universités.</strong> "
            "<a href=\"/conciergerie-airbnb-villejuif\">Villejuif</a>, "
            "<a href=\"/conciergerie-airbnb-creteil\">Créteil</a>, "
            "<a href=\"/conciergerie-airbnb-le-kremlin-bicetre\">Le Kremlin-Bicêtre</a> : une "
            "demande d'accompagnants et de personnels soignants qui ne s'arrête jamais.",
            "<strong>Le tourisme familial.</strong> "
            "<a href=\"/conciergerie-airbnb-val-d-europe-disneyland\">Disneyland Paris</a> et "
            "<a href=\"/conciergerie-airbnb-versailles\">Versailles</a> attirent des millions de "
            "visiteurs qui cherchent de la place et du parking — deux choses que Paris n'offre pas.",
        ]),
        ("La réglementation, département par département", [
            "Beaucoup de propriétaires de banlieue croient échapper aux règles parisiennes. C'est "
            "inexact : dans les <strong>Hauts-de-Seine (92), la Seine-Saint-Denis (93) et le "
            "Val-de-Marne (94)</strong>, le régime du changement d'usage s'applique comme à Paris "
            "(article L631-7 du code de la construction et de l'habitation). Louer une résidence "
            "secondaire en meublé de tourisme y suppose donc une autorisation.",
            "Dans les <strong>Yvelines (78), le Val-d'Oise (95), la Seine-et-Marne (77) et l'Essonne "
            "(91)</strong>, les règles dépendent de chaque commune : certaines ont instauré "
            "l'enregistrement obligatoire, d'autres non. La taxe de séjour, elle, est due partout.",
            "Nous faisons cette vérification avant toute mise en ligne. Quand la courte durée n'est "
            "pas possible, le bail mobilité prend le relais — et reste bien plus rentable que la "
            "location nue.",
        ]),
    ],
    zones_extra=("Voir aussi : <a href=\"/conciergerie-airbnb-paris\"><strong>Paris et ses 20 "
                 "arrondissements</strong></a>, "
                 "<a href=\"/conciergerie-airbnb-ile-de-france\">l'Île-de-France</a>, "
                 "<a href=\"/conciergerie-airbnb-essonne\"><strong>l'Essonne (91)</strong></a> où "
                 "nous sommes historiquement implantés, et "
                 "<a href=\"/conciergerie-airbnb-france\">toutes nos villes en France</a>."),
    faq_title="Questions fréquentes — conciergerie Airbnb en banlieue parisienne",
    faq=[
        ("La location courte durée fonctionne-t-elle vraiment en banlieue ?",
         "Oui, à condition de jouer les bons moteurs de demande : aéroport, salon, stade, hôpital, "
         "université, parc de loisirs. Un bien à dix minutes d'un parc des expositions peut "
         "réaliser sur trois semaines de salons ce qu'un bien parisien met deux mois à générer."),
        ("Ai-je besoin d'une autorisation dans le 92, 93 ou 94 ?",
         "Pour une résidence secondaire louée en meublé de tourisme, oui : ces trois départements "
         "relèvent du même régime de changement d'usage que Paris. Pour une résidence principale, "
         "la location reste possible dans la limite de 120 nuits par an."),
        ("Quelles communes couvrez-vous ?",
         "Toute la petite couronne (92, 93, 94), les Yvelines, le Val-d'Oise, la Seine-et-Marne et "
         "l'Essonne, où nous sommes historiquement implantés. Chaque commune a sa page dédiée."),
        ("Le bail mobilité est-il intéressant en banlieue ?",
         "Très souvent, oui : missions, mutations, stages et internats hospitaliers créent une "
         "demande de moyenne durée continue, particulièrement autour des pôles hospitaliers et "
         "universitaires."),
        ("Combien coûte votre gestion ?",
         "Une commission sur les revenus encaissés, sans abonnement ni frais d'entrée. Le taux "
         "dépend du bien et du niveau de service."),
        ("Faites-vous une estimation avant de démarrer ?",
         "Systématiquement, et elle est gratuite : nous étudions les biens réellement loués autour "
         "du vôtre et nous vous remettons une fourchette argumentée."),
    ],
    form=("Estimation gratuite pour votre bien en banlieue parisienne",
          "Commune, surface, disponibilité : nous vous répondons avec une estimation de revenus et "
          "les démarches applicables à votre adresse.", "Île-de-France"),
    tagline="Conciergerie Airbnb en banlieue parisienne — "
            "<span class=\"font-serif-italic\">là où la demande est réelle</span>.",
    lieu="Hauts-de-Seine · Seine-Saint-Denis · Val-de-Marne · Yvelines · Val-d'Oise · Seine-et-Marne",
)


def main() -> list:
    urls = [SV.hub(SILO, V, HUB_SPEC)]
    for i, v in enumerate(V):
        urls.append(SV.page(SILO, v, i, V))
    print(f"Banlieue parisienne : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
