# -*- coding: utf-8 -*-
"""Silo SEO national : conciergerie Airbnb ville par ville + hub France.

Cible : « conciergerie Airbnb Lyon », « gestion locative courte durée Bordeaux »,
« conciergerie Annecy », etc. — soit le propriétaire qui cherche un gestionnaire
dans SA ville, pas une conciergerie parisienne générique.

Le contenu de chaque page s'appuie sur des données réelles (quartiers, lieux,
nature de la demande locative, saisonnalité). Les formulations des blocs
génériques sont volontairement différentes de celles du silo Paris pour ne pas
créer de pages jumelles entre les deux silos.
"""
from __future__ import annotations

import seo_common as C

HUB = "/conciergerie-airbnb-france"

# nom, slug, dept, region, cp, geo, quartiers, lieux, hook, demande, bien, saison, zone_tendue
V = [
    # ---------------------------------------------------------------- Sud-Est
    ("Lyon", "lyon", "69", "Auvergne-Rhône-Alpes", "69000", (45.7640, 4.8357),
     ["la Presqu'île", "le Vieux Lyon", "la Croix-Rousse", "Confluence", "la Part-Dieu"],
     ["la place Bellecour", "le parc de la Tête d'Or", "les traboules", "la gare de la Part-Dieu"],
     "Deuxième pôle d'affaires de France et capitale gastronomique : Lyon combine une demande professionnelle en semaine et un tourisme urbain le week-end, ce qui lisse le taux d'occupation sur l'année.",
     "Cadres en mission autour de la Part-Dieu, congressistes, couples en week-end gastronomique, familles pendant la Fête des Lumières.",
     "Appartements de canut à la Croix-Rousse, deux-pièces Presqu'île, biens neufs à Confluence",
     "Occupation très régulière, avec des pics marqués en décembre (Fête des Lumières) et pendant les salons d'Eurexpo.", True),
    ("Marseille", "marseille", "13", "Provence-Alpes-Côte d'Azur", "13000", (43.2965, 5.3698),
     ["le Vieux-Port", "le Panier", "Notre-Dame-du-Mont", "les Goudes", "Endoume"],
     ["le Vieux-Port", "le MuCEM", "les calanques", "le Stade Vélodrome"],
     "Marseille est devenue une destination de court séjour à part entière : ville, mer et calanques dans la même journée, avec une saison qui démarre en avril et ne retombe qu'en octobre.",
     "Jeunes couples européens, groupes d'amis en été, supporters et spectateurs du Vélodrome, croisiéristes en escale.",
     "Appartements avec terrasse ou vue mer, biens du Panier, T2 rénovés côté Notre-Dame-du-Mont",
     "Très forte saison d'avril à octobre, avec des pics sur juillet-août et les grands événements du Vélodrome.", True),
    ("Nice", "nice", "06", "Provence-Alpes-Côte d'Azur", "06000", (43.7102, 7.2620),
     ["le Vieux-Nice", "le Carré d'Or", "le port", "Cimiez", "la Libération"],
     ["la promenade des Anglais", "la colline du Château", "le cours Saleya", "l'aéroport Nice Côte d'Azur"],
     "Nice bénéficie du deuxième aéroport de France : la clientèle internationale arrive toute l'année, y compris hors saison, ce qui est rare sur la Côte d'Azur.",
     "Clientèle internationale en séjour balnéaire, congressistes, seniors en long séjour hivernal, public du carnaval.",
     "Studios et deux-pièces proches mer, appartements bourgeois du Carré d'Or, biens avec balcon",
     "Haute saison de mai à septembre, mais une demande qui ne s'éteint jamais grâce aux longs séjours d'hiver.", True),
    ("Cannes", "cannes", "06", "Provence-Alpes-Côte d'Azur", "06400", (43.5528, 7.0174),
     ["la Croisette", "le Suquet", "la Banane", "la Californie"],
     ["le Palais des Festivals", "la Croisette", "le vieux port", "les îles de Lérins"],
     "À Cannes, le calendrier des congrès fait le prix : pendant le Festival, le MIPIM ou le MIPCOM, une semaine peut représenter ce que rapporte un mois entier en basse saison.",
     "Professionnels des congrès, clientèle internationale de villégiature, familles en été.",
     "Appartements Croisette, biens de standing avec vue mer, studios proches Palais des Festivals",
     "Pics extrêmes pendant les congrès (mai, mars, octobre), plein été très demandé, hiver plus calme.", True),
    ("Antibes", "antibes", "06", "Provence-Alpes-Côte d'Azur", "06600", (43.5808, 7.1251),
     ["le Vieil Antibes", "Juan-les-Pins", "le Cap d'Antibes", "la Salis"],
     ["le port Vauban", "le musée Picasso", "les plages de Juan-les-Pins", "le marché provençal"],
     "Entre Nice et Cannes, Antibes attire une clientèle de séjour plus longue : on y reste une à deux semaines, ce qui réduit le nombre de rotations et les frais de ménage.",
     "Familles en séjour d'été, plaisanciers du port Vauban, clientèle nordique en avant et arrière-saison.",
     "Appartements Juan-les-Pins, villas et biens avec jardin, studios vieille ville",
     "Saison longue de mai à septembre, prolongée par la plaisance et les salons nautiques.", True),
    ("Saint-Tropez", "saint-tropez", "83", "Provence-Alpes-Côte d'Azur", "83990", (43.2677, 6.6407),
     ["le village", "les Salins", "Pampelonne", "la Ponche"],
     ["le port", "la plage de Pampelonne", "la citadelle", "les Voiles de Saint-Tropez"],
     "Saint-Tropez fonctionne sur une saison courte mais à très forte valeur : la qualité de la prestation — accueil, ménage, services annexes — pèse plus lourd ici que partout ailleurs.",
     "Clientèle internationale fortunée, groupes en villa, plaisanciers, clientèle des Voiles en octobre.",
     "Villas avec piscine, appartements du village, biens de prestige avec vue",
     "Saison concentrée de juin à septembre, avec une pointe en juillet-août et un rebond en octobre.", True),
    ("Aix-en-Provence", "aix-en-provence", "13", "Provence-Alpes-Côte d'Azur", "13100", (43.5297, 5.4474),
     ["le centre ancien", "le quartier Mazarin", "les Allées provençales", "le Tholonet"],
     ["le cours Mirabeau", "la place des Cardeurs", "le Festival d'art lyrique", "la montagne Sainte-Victoire"],
     "Ville universitaire et festivalière, Aix garde une demande solide hors saison estivale, portée par les étudiants, les enseignants-chercheurs et les visiteurs culturels.",
     "Familles en visite universitaire, public du Festival d'art lyrique, couples en week-end provençal.",
     "Appartements de l'hypercentre, hôtels particuliers divisés, biens avec terrasse",
     "Été très fort, festival en juillet, et une demande de moyenne durée continue grâce aux universités.", True),
    ("Toulon", "toulon", "83", "Provence-Alpes-Côte d'Azur", "83000", (43.1242, 5.9280),
     ["le Mourillon", "le centre-ville", "le port", "Saint-Jean-du-Var"],
     ["les plages du Mourillon", "la rade de Toulon", "le téléphérique du Faron", "les navettes pour les îles d'Hyères"],
     "Toulon reste l'un des rares littoraux méditerranéens où l'achat est encore accessible : la rentabilité y est souvent supérieure à celle des villes voisines plus cotées.",
     "Familles en séjour balnéaire, militaires et personnels en mission, visiteurs en transit vers les îles.",
     "Appartements Mourillon, biens avec vue rade, studios centre-ville rénovés",
     "Forte saison estivale, complétée par des séjours professionnels liés à la base navale toute l'année.", False),
    ("Avignon", "avignon", "84", "Provence-Alpes-Côte d'Azur", "84000", (43.9493, 4.8055),
     ["l'intra-muros", "la Balance", "les Carmes", "Villeneuve-lès-Avignon"],
     ["le Palais des Papes", "le pont Saint-Bénézet", "le Festival d'Avignon", "les remparts"],
     "Le Festival d'Avignon transforme la ville chaque mois de juillet : les logements intra-muros se réservent des mois à l'avance, à des tarifs sans rapport avec le reste de l'année.",
     "Festivaliers et compagnies en juillet, touristes culturels au printemps, étapes sur la route du Sud.",
     "Appartements intra-muros, maisons de village, studios pour compagnies",
     "Juillet exceptionnel (Festival), printemps et automne soutenus, hiver plus calme.", False),
    ("Grenoble", "grenoble", "38", "Auvergne-Rhône-Alpes", "38000", (45.1885, 5.7245),
     ["l'hypercentre", "Championnet", "l'Île Verte", "la Presqu'île scientifique"],
     ["la Bastille et ses bulles", "le campus", "les stations de Belledonne", "le CEA et le campus scientifique"],
     "Grenoble vit sur deux moteurs : la recherche scientifique, qui génère des séjours professionnels toute l'année, et la montagne, à trois quarts d'heure des premières stations.",
     "Chercheurs et ingénieurs en mission, étudiants internationaux, skieurs en séjour hiver.",
     "Deux-pièces proches campus, appartements hypercentre, biens familiaux",
     "Demande professionnelle continue, renforcée par la saison de ski de décembre à mars.", False),
    ("Annecy", "annecy", "74", "Auvergne-Rhône-Alpes", "74000", (45.8992, 6.1294),
     ["la vieille ville", "les Marquisats", "le Pâquier", "Annecy-le-Vieux"],
     ["le lac d'Annecy", "le Palais de l'Isle", "le col de la Forclaz", "les stations du Semnoz"],
     "Annecy est l'une des destinations les plus tendues de France : le lac attire toute l'année, la ville a fortement encadré la location touristique, et les biens conformes sont donc très recherchés.",
     "Familles en séjour lac, sportifs (trail, vélo, parapente), touristes internationaux, skieurs en hiver.",
     "Appartements vieille ville, biens avec vue lac, studios proches Pâquier",
     "Saison très longue : lac de mai à septembre, ski en hiver, événements sportifs au printemps et à l'automne.", True),
    ("Chamonix-Mont-Blanc", "chamonix", "74", "Auvergne-Rhône-Alpes", "74400", (45.9237, 6.8694),
     ["le centre de Chamonix", "les Praz", "les Bossons", "Argentière"],
     ["l'Aiguille du Midi", "la mer de Glace", "le tramway du Mont-Blanc", "l'UTMB"],
     "Chamonix est l'une des rares stations françaises à faire deux saisons pleines : ski l'hiver, alpinisme et trail l'été. Le taux d'occupation annuel y est bien supérieur à la moyenne des stations.",
     "Alpinistes et randonneurs l'été, skieurs internationaux l'hiver, public de l'UTMB fin août.",
     "Appartements de station, chalets, studios rénovés proches télécabines",
     "Deux hautes saisons (décembre-avril et juin-septembre), intersaisons courtes.", True),
    ("Courchevel", "courchevel", "73", "Auvergne-Rhône-Alpes", "73120", (45.4154, 6.6349),
     ["Courchevel 1850", "Moriond", "Village", "Le Praz"],
     ["les 3 Vallées", "l'altiport", "le front de neige", "la Croisette de 1850"],
     "Courchevel concentre la clientèle la plus exigeante des Alpes : ici, la conciergerie n'est pas un confort, c'est ce qui justifie le prix de la semaine.",
     "Clientèle internationale haut de gamme, familles en séjour semaine, groupes en chalet.",
     "Appartements de standing, chalets, biens skis aux pieds",
     "Saison hivernale de décembre à avril, avec des semaines de vacances scolaires décisives pour l'année.", False),
    ("Megève", "megeve", "74", "Auvergne-Rhône-Alpes", "74120", (45.8567, 6.6174),
     ["le village", "le Mont d'Arbois", "Rochebrune", "le Jaillet"],
     ["la place du village", "le Mont d'Arbois", "le domaine Évasion Mont-Blanc", "les calèches"],
     "Megève garde une vraie vie de village hors saison de ski : la clientèle estivale, en famille ou en séminaire, complète utilement l'hiver.",
     "Familles françaises et suisses, clientèle de séminaires, séjours été golf et randonnée.",
     "Chalets, appartements village, biens avec garage et ski room",
     "Hiver dominant, mais un été de plus en plus solide (golf, randonnée, festivals).", False),
    ("Clermont-Ferrand", "clermont-ferrand", "63", "Auvergne-Rhône-Alpes", "63000", (45.7772, 3.0870),
     ["le centre historique", "les Salins", "Montferrand", "Chamalières"],
     ["la cathédrale de lave", "le puy de Dôme", "le stade Marcel-Michelin", "Vulcania"],
     "Clermont-Ferrand est un marché de proximité méconnu : peu de concurrence en conciergerie professionnelle, une demande professionnelle stable et le tourisme des volcans en été.",
     "Déplacements professionnels toute l'année, supporters de l'ASM, familles en séjour volcans.",
     "Appartements centre-ville, maisons de ville, biens proches stade",
     "Demande professionnelle continue, saison touristique de mai à septembre.", False),
    # ---------------------------------------------------------------- Corse
    ("Ajaccio", "ajaccio", "2A", "Corse", "20000", (41.9192, 8.7386),
     ["le centre-ville", "les Sanguinaires", "Saint-Joseph", "le port Tino Rossi"],
     ["la maison Bonaparte", "les îles Sanguinaires", "les plages du Ricanto", "l'aéroport Napoléon-Bonaparte"],
     "Ajaccio combine l'aéroport, le port et les plages : c'est la porte d'entrée de la Corse du Sud, avec une demande qui s'étale d'avril à octobre.",
     "Familles en séjour d'été, croisiéristes, déplacements professionnels et administratifs hors saison.",
     "Appartements avec vue golfe, biens proches plages, studios centre-ville",
     "Saison forte de mai à septembre, épaules d'avril et octobre en croissance.", False),
    ("Porto-Vecchio", "porto-vecchio", "2A", "Corse", "20137", (41.5911, 9.2795),
     ["la vieille ville", "Santa Giulia", "Palombaggia", "la marine"],
     ["la plage de Palombaggia", "Santa Giulia", "le port de plaisance", "l'Alta Rocca"],
     "Porto-Vecchio est la destination la plus recherchée de Corse en été : la saison est courte, très intense, et la qualité de l'accueil détermine directement les avis et donc les prix de l'année suivante.",
     "Familles et groupes en juillet-août, clientèle italienne, plaisanciers.",
     "Villas avec piscine, appartements proches plages, biens vue mer",
     "Saison très concentrée de juin à septembre, avec un pic en août.", False),
    ("Bastia", "bastia", "2B", "Corse", "20200", (42.7028, 9.4508),
     ["la citadelle", "le vieux port", "le centre-ville", "Cardo"],
     ["le vieux port", "la place Saint-Nicolas", "le Cap Corse", "l'aéroport de Poretta"],
     "Bastia vit toute l'année, contrairement aux stations balnéaires de l'île : le port de commerce et l'activité administrative apportent une clientèle professionnelle hors saison.",
     "Séjours professionnels, étapes avant le Cap Corse, familles en été.",
     "Appartements du vieux port, biens avec vue mer, studios centre",
     "Été fort, mais une demande professionnelle qui ne disparaît jamais en hiver.", False),
    # ---------------------------------------------------------------- Occitanie
    ("Toulouse", "toulouse", "31", "Occitanie", "31000", (43.6047, 1.4442),
     ["le Capitole", "les Carmes", "Saint-Cyprien", "Compans-Caffarelli"],
     ["la place du Capitole", "la Garonne", "la Cité de l'espace", "le campus aéronautique de Blagnac"],
     "Capitale de l'aéronautique, Toulouse génère un flux continu d'ingénieurs, de sous-traitants et de stagiaires : la moyenne durée y est souvent plus rentable que la nuitée touristique.",
     "Ingénieurs en mission aéronautique, étudiants et stagiaires, familles en week-end, rugby au Stadium.",
     "Appartements de brique du centre, T2 proches métro, biens neufs quartiers d'affaires",
     "Demande professionnelle très régulière de septembre à juillet, creux limité en août.", True),
    ("Montpellier", "montpellier", "34", "Occitanie", "34000", (43.6108, 3.8767),
     ["l'Écusson", "Antigone", "Port-Marianne", "Boutonnet"],
     ["la place de la Comédie", "la faculté de médecine", "les plages de Palavas", "le Corum"],
     "Montpellier cumule une des plus fortes croissances démographiques de France, une population étudiante massive et la mer à dix minutes : trois moteurs locatifs indépendants.",
     "Étudiants et internes en médecine, congressistes du Corum, touristes en route vers le littoral.",
     "Studios et T2 proches tram, appartements Écusson, biens neufs Port-Marianne",
     "Rentrée universitaire très tendue, été littoral fort, congrès au printemps et à l'automne.", True),
    ("Perpignan", "perpignan", "66", "Occitanie", "66000", (42.6887, 2.8948),
     ["le centre historique", "le Castillet", "Saint-Jacques", "Moulin-à-Vent"],
     ["le palais des Rois de Majorque", "les plages de Canet", "la Côte Vermeille", "la frontière espagnole"],
     "Perpignan sert de base arrière au littoral catalan et à l'Espagne : les séjours y sont plus longs et le prix d'achat au mètre carré reste très inférieur à celui de la côte.",
     "Familles en séjour littoral, visiteurs transfrontaliers, public de Visa pour l'Image en septembre.",
     "Appartements centre historique, maisons catalanes, biens avec terrasse",
     "Été dominant, septembre soutenu par le festival, hiver calme.", False),
    # ---------------------------------------------------------- Nouvelle-Aquitaine
    ("Bordeaux", "bordeaux", "33", "Nouvelle-Aquitaine", "33000", (44.8378, -0.5792),
     ["les Chartrons", "Saint-Pierre", "Saint-Michel", "les Bassins à flot", "Caudéran"],
     ["la place de la Bourse", "la Cité du Vin", "les quais de Garonne", "la gare Saint-Jean"],
     "Deux heures de Paris en TGV : Bordeaux capte un tourisme de week-end très régulier, doublé d'un œnotourisme international qui réserve tôt et paie bien.",
     "Couples en week-end œnotouristique, clientèle internationale du vin, déplacements professionnels.",
     "Appartements en pierre des Chartrons, échoppes bordelaises, T2 hypercentre",
     "Demande forte d'avril à octobre, avec un pic pendant Bordeaux Fête le Vin et les vendanges.", True),
    ("Biarritz", "biarritz", "64", "Nouvelle-Aquitaine", "64200", (43.4832, -1.5586),
     ["le centre-ville", "la Côte des Basques", "Beaurivage", "Milady"],
     ["la Grande Plage", "le rocher de la Vierge", "la Côte des Basques", "le golf du Phare"],
     "Biarritz a une saison plus longue que la Méditerranée grâce au surf et au golf : la Côte des Basques reste fréquentée d'avril à novembre.",
     "Surfeurs et golfeurs, familles en été, clientèle espagnole en week-end, séminaires d'entreprise.",
     "Appartements vue océan, villas basques, studios proches plages",
     "Saison d'avril à octobre, avec pointe en juillet-août et arrière-saison très active.", True),
    ("Bayonne", "bayonne", "64", "Nouvelle-Aquitaine", "64100", (43.4929, -1.4748),
     ["le Grand Bayonne", "le Petit Bayonne", "Saint-Esprit", "Marracq"],
     ["les Fêtes de Bayonne", "la cathédrale Sainte-Marie", "les quais de la Nive", "les arènes"],
     "Les Fêtes de Bayonne, fin juillet, créent l'un des pics tarifaires les plus spectaculaires de France : cinq jours qui pèsent lourd dans une année de gestion.",
     "Festayres fin juillet, familles en séjour côte basque, visiteurs culturels toute l'année.",
     "Appartements des maisons à colombages, biens Petit Bayonne, T2 proches gare",
     "Pic extrême pendant les Fêtes, saison estivale forte, demande de moyenne durée le reste de l'année.", False),
    ("Arcachon", "arcachon", "33", "Nouvelle-Aquitaine", "33120", (44.6586, -1.1680),
     ["la Ville d'Hiver", "la Ville d'Été", "le Moulleau", "Pereire"],
     ["la dune du Pilat", "le bassin d'Arcachon", "la jetée Thiers", "le cap Ferret"],
     "Le bassin d'Arcachon est l'une des destinations préférées des Bordelais et des Parisiens : la demande commence dès les ponts de printemps et ne retombe qu'en septembre.",
     "Familles en séjour bassin, Bordelais en week-end, clientèle parisienne en été.",
     "Villas arcachonnaises, appartements front de mer, biens avec jardin",
     "Ponts de printemps, été très fort, arrière-saison ostréicole en septembre-octobre.", True),
    ("La Rochelle", "la-rochelle", "17", "Nouvelle-Aquitaine", "17000", (46.1603, -1.1511),
     ["le Vieux-Port", "le centre historique", "les Minimes", "Saint-Nicolas"],
     ["les tours du Vieux-Port", "l'aquarium", "l'île de Ré", "les Francofolies"],
     "La Rochelle bénéficie d'un centre historique piéton et de l'île de Ré à vingt minutes : deux atouts qui allongent la durée moyenne des séjours.",
     "Familles en séjour d'été, public des Francofolies en juillet, plaisanciers des Minimes.",
     "Appartements du centre piéton, biens proches port, maisons rochelaises",
     "Saison de mai à septembre, pic pendant les Francofolies, week-ends de printemps très demandés.", False),
    # ------------------------------------------------- Bretagne & Pays de la Loire
    ("Nantes", "nantes", "44", "Pays de la Loire", "44000", (47.2184, -1.5536),
     ["le centre-ville", "l'île de Nantes", "Bouffay", "Talensac", "Chantenay"],
     ["les Machines de l'île", "le château des ducs de Bretagne", "le Voyage à Nantes", "la Loire à vélo"],
     "Nantes attire à la fois les entreprises et les familles : l'événementiel culturel de l'été y crée une saison touristique là où la ville était historiquement un marché d'affaires.",
     "Déplacements professionnels, familles pendant le Voyage à Nantes, étudiants en moyenne durée.",
     "Appartements du centre, biens sur l'île de Nantes, maisons nantaises",
     "Demande professionnelle continue, saison culturelle de juillet à août, congrès au printemps.", True),
    ("Rennes", "rennes", "35", "Bretagne", "35000", (48.1173, -1.6778),
     ["le centre historique", "Thabor", "Sainte-Anne", "Villejean"],
     ["la place des Lices", "le parc du Thabor", "le campus de Rennes", "la gare LGV"],
     "Depuis la LGV, Rennes est à 1h25 de Paris : la ville a gagné une clientèle de week-end en plus de son marché étudiant et professionnel historique.",
     "Étudiants et parents en visite, déplacements professionnels, week-ends parisiens, étapes vers le Mont-Saint-Michel.",
     "Appartements du centre historique, T2 proches campus, maisons de ville",
     "Demande très régulière hors août, pics lors des rentrées et des grands événements.", True),
    ("Saint-Malo", "saint-malo", "35", "Bretagne", "35400", (48.6493, -2.0257),
     ["intra-muros", "Paramé", "Rothéneuf", "Saint-Servan"],
     ["les remparts", "la plage du Sillon", "la Route du Rhum", "le Grand Bé"],
     "Intra-muros, l'offre est limitée par les murs eux-mêmes : la rareté y soutient les prix bien au-delà de la saison estivale, notamment lors des grandes marées et de la Route du Rhum.",
     "Familles en séjour côte d'Émeraude, Britanniques via le ferry, public des grandes marées et des événements nautiques.",
     "Appartements intra-muros, biens vue mer à Paramé, maisons malouines",
     "D'avril à octobre, avec des pics lors des grandes marées, de la Route du Rhum et des ponts.", True),
    ("Vannes", "vannes", "56", "Bretagne", "56000", (47.6587, -2.7603),
     ["l'intra-muros", "le port", "Conleau", "Ménimur"],
     ["le golfe du Morbihan", "les remparts et les lavoirs", "la presqu'île de Rhuys", "Belle-Île au départ du port"],
     "Vannes est la base idéale pour visiter le golfe du Morbihan : les voyageurs y restent en moyenne plus longtemps que dans les stations balnéaires voisines, ce qui simplifie la gestion.",
     "Familles en séjour golfe, plaisanciers, retraités en moyenne durée au printemps et à l'automne.",
     "Appartements intra-muros, maisons avec jardin, biens proches port",
     "Saison d'avril à septembre, avec la Semaine du Golfe et un arrière-saison douce très demandé.", False),
    ("La Baule", "la-baule", "44", "Pays de la Loire", "44500", (47.2861, -2.3931),
     ["le front de mer", "le centre", "La Baule-les-Pins", "Le Pouliguen"],
     ["la baie de La Baule", "le remblai", "le port de Pornichet", "les marais salants de Guérande"],
     "L'une des plus longues plages d'Europe, à deux heures de Paris en TGV : La Baule est un marché de résidences secondaires où la conciergerie remplace l'ami qui a les clés.",
     "Familles parisiennes et nantaises, séminaires d'entreprise, seniors en séjour longue durée.",
     "Appartements front de mer, villas balnéaires, biens avec terrasse",
     "Saison de mai à septembre, très forte en juillet-août, complétée par les ponts et les séminaires.", True),
    # ------------------------------------------------ Normandie & Hauts-de-France
    ("Deauville", "deauville", "14", "Normandie", "14800", (49.3600, 0.0756),
     ["les Planches", "le centre", "le port", "Bénerville"],
     ["les Planches", "l'hippodrome", "le Festival du cinéma américain", "Trouville-sur-Mer"],
     "Deauville vit au rythme des week-ends parisiens : deux heures de porte à porte, une clientèle qui réserve court et paie bien pour un logement impeccable.",
     "Parisiens en week-end, public du Festival du cinéma américain, courses hippiques, séminaires.",
     "Appartements proches Planches, villas normandes, studios de bord de mer",
     "Week-ends toute l'année, saison estivale forte, pics lors du Festival et des grandes courses.", True),
    ("Honfleur", "honfleur", "14", "Normandie", "14600", (49.4194, 0.2333),
     ["le Vieux-Bassin", "Sainte-Catherine", "la Côte de Grâce", "le plateau"],
     ["le Vieux-Bassin", "l'église Sainte-Catherine", "le pont de Normandie", "les plages du Calvados"],
     "Honfleur est une destination de court séjour toute l'année : la ville est belle en hiver aussi, ce qui la distingue de la plupart des stations normandes.",
     "Couples en week-end, clientèle internationale en escale, croisiéristes du Havre voisin.",
     "Maisons de pêcheurs rénovées, appartements Vieux-Bassin, biens de charme",
     "Fréquentation étalée sur l'année, avec des week-ends très demandés d'avril à octobre.", False),
    ("Rouen", "rouen", "76", "Normandie", "76000", (49.4432, 1.0993),
     ["le centre historique", "le Vieux-Marché", "Saint-Sever", "Jardin des Plantes"],
     ["la cathédrale", "le Gros-Horloge", "l'Armada", "les quais de Seine"],
     "Rouen est un marché d'affaires doublé d'un tourisme culturel de proximité : à 1h15 de Paris, la ville capte aussi les séjours de week-end à budget maîtrisé.",
     "Déplacements professionnels, familles en visite culturelle, public de l'Armada les années d'édition.",
     "Appartements à colombages du centre, T2 proches gare, biens rénovés",
     "Demande professionnelle stable, pointes lors des grands événements et des ponts.", False),
    ("Le Havre", "le-havre", "76", "Normandie", "76600", (49.4944, 0.1079),
     ["le centre Perret", "Sainte-Adresse", "les Docks", "Saint-François"],
     ["la plage du Havre", "l'architecture Perret classée UNESCO", "le port de croisière", "les falaises d'Étretat"],
     "Port de croisière majeur et ville UNESCO, Le Havre reste un marché peu concurrentiel en conciergerie : les opportunités y sont réelles pour un propriétaire bien accompagné.",
     "Croisiéristes en escale, déplacements professionnels portuaires, familles en route vers Étretat.",
     "Appartements Perret, biens vue mer à Sainte-Adresse, T2 proches port",
     "Escales de croisière d'avril à octobre, demande professionnelle continue.", False),
    ("Lille", "lille", "59", "Hauts-de-France", "59000", (50.6292, 3.0573),
     ["le Vieux-Lille", "Wazemmes", "Euralille", "Vauban"],
     ["la Grand-Place", "la braderie de Lille", "Euralille et les gares", "la frontière belge"],
     "Trois capitales à moins d'une heure et demie de train : Lille reçoit une clientèle belge, britannique et néerlandaise en plus du flux d'affaires d'Euralille.",
     "Voyageurs Eurostar et Thalys, clientèle belge en week-end, étudiants, braderie début septembre.",
     "Appartements du Vieux-Lille, maisons 1930, T2 proches Euralille",
     "Demande régulière toute l'année, pic exceptionnel lors de la braderie et des marchés de Noël.", True),
    ("Le Touquet", "le-touquet", "62", "Hauts-de-France", "62520", (50.5242, 1.5860),
     ["le centre", "le front de mer", "la forêt", "Paris-Plage"],
     ["la plage et les chars à voile", "le golf du Touquet", "l'Enduropale", "le marché couvert"],
     "Le Touquet est le week-end de la clientèle parisienne et lilloise : réservations courtes, exigence élevée sur la propreté, et un Enduropale en février qui remplit la ville hors saison.",
     "Familles parisiennes et lilloises, golfeurs, public de l'Enduropale, Britanniques.",
     "Villas anglo-normandes, appartements front de mer, studios centre",
     "Week-ends et vacances scolaires toute l'année, été fort, pic en février pour l'Enduropale.", True),
    # ---------------------------------------------- Grand Est, Bourgogne, Centre
    ("Strasbourg", "strasbourg", "67", "Grand Est", "67000", (48.5734, 7.7521),
     ["la Grande Île", "la Petite France", "la Krutenau", "le Quartier européen"],
     ["la cathédrale", "le marché de Noël", "le Parlement européen", "la Petite France"],
     "Le marché de Noël de Strasbourg est l'un des plus forts pics tarifaires d'Europe, et les sessions du Parlement européen créent une demande professionnelle prévisible tout au long de l'année.",
     "Visiteurs du marché de Noël, personnels et lobbyistes du Parlement, touristes européens.",
     "Appartements de la Grande Île, biens à colombages, T2 proches tram",
     "Décembre exceptionnel (marché de Noël), sessions parlementaires mensuelles, été touristique.", True),
    ("Colmar", "colmar", "68", "Grand Est", "68000", (48.0794, 7.3585),
     ["la Petite Venise", "le centre historique", "les Tanneurs", "Saint-Joseph"],
     ["la Petite Venise", "le musée Unterlinden", "la route des vins d'Alsace", "le marché de Noël"],
     "Colmar est devenue une destination internationale à part entière : la ville est très photographiée, et un bien de caractère bien mis en scène s'y loue toute l'année.",
     "Touristes internationaux, visiteurs du marché de Noël, amateurs de la route des vins.",
     "Maisons alsaciennes rénovées, appartements centre historique, biens de charme",
     "Décembre très fort, saison des vins de mai à octobre, demande étalée le reste de l'année.", False),
    ("Reims", "reims", "51", "Grand Est", "51100", (49.2583, 4.0317),
     ["le centre-ville", "Cathédrale", "Clairmarais", "Boulingrin"],
     ["la cathédrale Notre-Dame", "les maisons de champagne", "les caves classées UNESCO", "la gare TGV"],
     "45 minutes de Paris en TGV et des maisons de champagne mondialement connues : Reims combine tourisme œnologique international et déplacements professionnels.",
     "Œnotouristes internationaux, couples en week-end, déplacements professionnels, congrès.",
     "Appartements centre, maisons rémoises, biens proches gare",
     "Saison œnotouristique d'avril à octobre, week-ends toute l'année, vendanges en septembre.", False),
    ("Metz", "metz", "57", "Grand Est", "57000", (49.1193, 6.1757),
     ["le centre-ville", "l'Amphithéâtre", "le Sablon", "Outre-Seille"],
     ["la cathédrale Saint-Étienne", "le Centre Pompidou-Metz", "les marchés de Noël", "la gare impériale"],
     "Metz profite de sa position frontalière : la clientèle luxembourgeoise et allemande y trouve un rapport qualité-prix imbattable, notamment en période de fêtes.",
     "Visiteurs luxembourgeois et allemands, public du Centre Pompidou-Metz, marchés de Noël.",
     "Appartements centre, biens proches Pompidou, T2 quartier gare",
     "Décembre très fort, expositions du Pompidou-Metz, demande frontalière continue.", False),
    ("Nancy", "nancy", "54", "Grand Est", "54000", (48.6921, 6.1844),
     ["la Ville Vieille", "Charles III", "Saint-Léon", "Poincaré"],
     ["la place Stanislas", "le musée de l'École de Nancy", "le parc de la Pépinière", "les universités"],
     "Ville universitaire et patrimoniale, Nancy fonctionne surtout à la moyenne durée : stagiaires, internes et enseignants représentent une demande stable sur dix mois de l'année.",
     "Étudiants et internes, visiteurs patrimoniaux, déplacements professionnels.",
     "Appartements Art nouveau, T2 proches facultés, biens centre historique",
     "Rentrée universitaire tendue, saison touristique en été, marché de Noël en décembre.", False),
    ("Dijon", "dijon", "21", "Bourgogne-Franche-Comté", "21000", (47.3220, 5.0415),
     ["le centre historique", "le quartier des Antiquaires", "Darcy", "la Toison d'Or"],
     ["le palais des Ducs", "la Cité de la gastronomie", "la route des Grands Crus", "la gare TGV"],
     "Dijon est la porte d'entrée de la route des Grands Crus : les séjours œnologiques y sont courts mais très réguliers, avec une clientèle internationale au pouvoir d'achat élevé.",
     "Œnotouristes internationaux, couples en week-end gastronomique, déplacements professionnels.",
     "Appartements du centre historique, maisons à pans de bois, T2 proches gare",
     "Saison viticole de mai à octobre, vente des vins en novembre, week-ends toute l'année.", False),
    ("Tours", "tours", "37", "Centre-Val de Loire", "37000", (47.3941, 0.6848),
     ["le Vieux-Tours", "Plumereau", "les Prébendes", "Saint-Pierre-des-Corps"],
     ["la place Plumereau", "les châteaux de la Loire", "la Loire à vélo", "la gare TGV"],
     "Tours est la base naturelle pour visiter les châteaux de la Loire : les voyageurs y posent leurs valises trois à quatre nuits, ce qui limite les rotations et le coût de gestion.",
     "Familles et couples en circuit châteaux, cyclotouristes de la Loire à vélo, étudiants.",
     "Appartements du Vieux-Tours, maisons tourangelles, T2 proches gare",
     "Saison d'avril à octobre, très forte en été, complétée par les séjours étudiants.", False),
    ("Orléans", "orleans", "45", "Centre-Val de Loire", "45000", (47.9029, 1.9093),
     ["le centre-ville", "Bourgogne", "Dunois", "Saint-Marceau"],
     ["la cathédrale Sainte-Croix", "les fêtes de Jeanne d'Arc", "les bords de Loire", "la gare d'Orléans"],
     "À une heure de Paris, Orléans capte une demande professionnelle régulière et des séjours de week-end sur les bords de Loire, sur un marché encore peu couvert par les conciergeries.",
     "Déplacements professionnels, familles en séjour Loire, public des fêtes de Jeanne d'Arc en mai.",
     "Appartements centre-ville, maisons de ville, T2 proches gare",
     "Demande professionnelle continue, pic en mai pendant les fêtes johanniques.", False),
]

SERVICES = [
    ("Diffusion multi-plateformes",
     "Airbnb, Booking, Abritel : votre bien est visible partout, avec des calendriers synchronisés pour éliminer tout risque de double réservation."),
    ("Prix pilotés à la nuit",
     "Nous suivons les événements locaux, les vacances scolaires et la concurrence directe de votre rue pour placer le bon prix au bon moment."),
    ("Accueil et remise des clés",
     "Check-in en personne ou boîte à clés sécurisée, arrivées tardives acceptées, livret d'accueil numérique et réponse aux voyageurs en continu."),
    ("Ménage et blanchisserie",
     "Rotation professionnelle entre chaque séjour, linge et serviettes fournis, produits d'accueil réassortis, contrôle photo systématique."),
    ("Maintenance de proximité",
     "Un réseau d'artisans local mobilisable rapidement : une panne ne doit jamais se transformer en avis négatif."),
    ("Comptes clairs",
     "Revenus, occupation, avis, dépenses : un récapitulatif mensuel lisible, sans jargon, et un interlocuteur unique au bout du fil."),
]

POURQUOI = [
    ("Un référent local, pas un centre d'appels",
     "Sur chaque ville, nous travaillons avec des équipes de ménage et des artisans du secteur. C'est ce qui permet d'intervenir dans l'heure quand il le faut."),
    ("Payés uniquement sur ce que vous gagnez",
     "Pas d'abonnement, pas de frais de dossier : une commission sur les revenus encaissés. Un calendrier vide ne nous rapporte rien non plus."),
    ("Courte durée, moyenne durée, ou les deux",
     "Selon la réglementation locale et la saison, nous basculons votre bien entre nuitée touristique et bail mobilité pour aller chercher le meilleur revenu annuel."),
    ("Votre bien traité comme le nôtre",
     "Sélection des voyageurs, état des lieux photo à chaque rotation, suivi de l'usure : nous protégeons la valeur de votre logement, pas seulement son calendrier."),
]


def by_region(v) -> list:
    """Villes liées : même région d'abord, puis départements proches."""
    same = [x for x in V if x[3] == v[3] and x[1] != v[1]]
    if len(same) < 4:
        same += [x for x in V if x[3] != v[3] and x[1] != v[1]][: 4 - len(same)]
    return same[:5]


def page_ville(v, i: int) -> None:
    nom, slug_v, dept, region, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue = v
    slug = f"conciergerie-airbnb-{slug_v}"
    path = "/" + slug
    url = C.SITE + path
    titre = f"Conciergerie Airbnb à {nom} ({dept}) — gestion locative clé en main"
    desc = (f"Conciergerie Airbnb à {nom} : mise en ligne, tarification, accueil des voyageurs, ménage et "
            f"maintenance. Gestion locative courte et moyenne durée clé en main pour les propriétaires "
            f"de {nom} et alentours.")
    q_txt = ", ".join(quartiers[:-1]) + " et " + quartiers[-1]
    l_txt = ", ".join(lieux[:-1]) + " et " + lieux[-1]

    regl = (
        f"À {nom}, la location meublée de tourisme est encadrée : déclaration en mairie avec numéro "
        f"d'enregistrement, plafond de 120 nuits par an pour une résidence principale, et autorisation "
        f"de changement d'usage pour une résidence secondaire. Nous vérifions la situation exacte de "
        f"votre bien avant toute mise en ligne — c'est notre travail, pas le vôtre."
        if tendue else
        f"À {nom}, les démarches sont plus souples que dans les grandes zones tendues, mais la commune "
        f"peut exiger une déclaration en mairie et un numéro d'enregistrement, et la taxe de séjour "
        f"reste due. Nous vérifions les règles applicables à votre adresse avant la mise en ligne."
    )

    faq_items = [
        (f"Combien coûte votre conciergerie à {nom} ?",
         "Nous prenons une commission sur les revenus réellement encaissés — pas d'abonnement, pas de "
         "frais d'entrée. Le taux dépend du niveau de service choisi et du rythme de rotation du bien. "
         "Vous recevez une proposition chiffrée après l'étude de votre logement."),
        (f"Quels secteurs couvrez-vous autour de {nom} ?",
         f"{nom} et sa périphérie, dont {q_txt}. Nos équipes de ménage et nos artisans partenaires "
         f"interviennent dans un rayon qui couvre l'agglomération."),
        (f"Quelle rentabilité espérer à {nom} ?",
         f"Cela dépend entièrement de l'adresse, de la surface, de l'équipement et de la saison : "
         f"{saison} Nous refusons d'annoncer un rendement au hasard. Après avoir vu votre bien, nous "
         f"vous remettons une estimation argumentée, fondée sur les biens comparables réellement loués "
         f"dans votre quartier."),
        ("Faut-il déclarer mon logement en mairie ?",
         C.strip_tags(regl)),
        ("Gérez-vous aussi la moyenne durée ?",
         "Oui. Bail mobilité de 1 à 10 mois pour les étudiants, stagiaires et salariés en mission : "
         "moins de rotations, aucun plafond de nuitées, et un revenu supérieur à la location nue. "
         "C'est souvent la meilleure formule hors haute saison."),
        ("Puis-je bloquer des dates pour moi ?",
         "Oui, autant que vous voulez. Vous gardez la main sur le calendrier ; nous nous occupons "
         "uniquement des périodes que vous ouvrez à la location."),
    ]

    p1 = C.photo(i + 2)
    trail = [("Accueil", "/"), ("Conciergerie Airbnb en France", HUB), (nom, path)]
    voisines = by_region(v)

    parts = [
        C.head(titre, desc, path,
               [C.ld_business(f" — {nom}", url, desc, nom, region, cp, geo=geo,
                              area=[nom, region]),
                C.ld_service(f"Conciergerie Airbnb et gestion locative courte durée à {nom}",
                             nom, url, desc,
                             ["Mise en ligne et diffusion multi-plateformes", "Tarification dynamique",
                              "Accueil des voyageurs", "Ménage et blanchisserie",
                              "Maintenance", "Reporting mensuel"]),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{p1[0]}"),
        C.header([("France", HUB), ("Paris", "/conciergerie-airbnb-paris"),
                  ("Conciergerie privée", "/conciergerie-privee-paris"),
                  ("Propriétaires", "/proprietaires")]),
        C.crumb(trail),
        C.hero(f"📍 {nom} · {dept} · {region}",
               f"Conciergerie Airbnb à <span class=\"font-serif-italic\">{nom}</span>",
               f"Votre logement à {nom} peut rapporter sans vous coûter une heure de votre temps. "
               f"Nous gérons annonce, prix, voyageurs, ménage et imprévus. {hook}",
               p1[0], f"Logement géré par notre conciergerie Airbnb à {nom}",
               ["Gestion <b>clé en main</b>", "Commission au <b>résultat</b>",
                "Équipes <b>locales</b>", "Courte & <b>moyenne durée</b>"]),
        C.texte([
            f"Gérer soi-même une location courte durée à {nom}, c'est un vrai second métier : répondre "
            f"aux messages dans l'heure, tenir les prix à jour, enchaîner les ménages entre un départ à "
            f"11 h et une arrivée à 15 h, trouver un plombier un dimanche. <strong>Label Maison "
            f"Conciergerie</strong> prend tout en charge sur {q_txt}, et vous rend le plus important : "
            f"votre temps.",
            f"Autour de {l_txt}, la demande a sa propre logique. {demande} {saison} Nous calons la "
            f"stratégie sur cette réalité locale — durée minimale de séjour, prix par nuit, périodes à "
            f"protéger — au lieu d'appliquer une recette nationale.",
        ], pad=True),
        C.cartes(f"Notre gestion locative à {nom}, de A à Z",
                 "Vous confiez les clés, nous nous occupons du reste. Vous suivez vos revenus.",
                 SERVICES),
        C.texte([
            f"Le parc locatif de {nom} — {bien.lower()} — ne se valorise pas de la même façon selon le "
            f"quartier. Nous commençons toujours par le même travail : rendre le bien lisible en photo, "
            f"corriger les manques d'équipement qui font perdre des réservations, puis positionner le "
            f"prix. Dans cet ordre. Baisser le tarif d'une annonce mal présentée ne remplit pas un "
            f"calendrier, cela réduit juste la marge.",
            f"<strong>Saisonnalité :</strong> {saison} C'est précisément là que se joue la différence "
            f"entre une gestion amateur et une gestion professionnelle : anticiper les pics des semaines "
            f"à l'avance, et remplir les creux avec des séjours plus longs plutôt que de brader la nuitée.",
        ], titre=f"Le marché de la location courte durée à {nom}"),
        C.galerie_ville(slug_v, nom,
                        f"Les secteurs sur lesquels nous positionnons les biens de {nom}, et ce "
                        f"qu'ils changent concrètement pour un calendrier de réservations."),
        C.texte([regl,
                 "<strong>Notre principe :</strong> nous ne mettons en ligne que des biens conformes. "
                 "Un revenu locatif durable ne se construit pas sur une zone grise. Quand la courte "
                 "durée n'est pas possible, nous basculons sur le bail mobilité (1 à 10 mois), "
                 "parfaitement légal et souvent plus confortable à gérer.",
                 "<em>Le cadre fiscal des meublés de tourisme a évolué avec la loi du 19 novembre 2024. "
                 "Nous signalons les points à vérifier, votre expert-comptable tranche.</em>"],
                titre=f"Réglementation et démarches à {nom}"),
        C.galerie(f"gal{slug_v.replace('-', '')}", [C.photo(i + k + 2) for k in range(6)]),
        C.etapes(f"Comment nous démarrons à {nom}", [
            ("1. Étude du bien",
             f"Visite ou visite à distance, analyse du quartier et des biens réellement loués autour "
             f"de vous, estimation de revenus argumentée."),
            ("2. Préparation et shooting",
             "Ajustements d'aménagement, équipements manquants, photos professionnelles : la couverture "
             "de l'annonce fait la moitié du travail."),
            ("3. Lancement",
             "Rédaction de l'annonce, diffusion multi-plateformes, paramétrage des prix, des règles et "
             "des durées minimales."),
            ("4. Exploitation quotidienne",
             "Messages, arrivées, ménages, incidents, avis : nous tenons le bien au quotidien et vous "
             "envoyons le récapitulatif chaque mois."),
        ]),
        C.cartes(f"Pourquoi confier votre bien de {nom} à Label Maison", "", POURQUOI, cols="g2"),
        C.zones(f"Nos autres villes {'en ' + region if not region.startswith('Corse') else 'en Corse'}",
                "Nous accompagnons des propriétaires partout en France.",
                [(f"Conciergerie Airbnb {x[0]}", f"/conciergerie-airbnb-{x[1]}") for x in voisines]
                + [("Toutes nos villes en France", HUB),
                   ("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris")],
                extra=("Propriétaire ? Découvrez <a href=\"/proprietaires\"><strong>notre offre de "
                       "gestion</strong></a>, notre <a href=\"/gestion-locative-paris\">gestion "
                       "locative</a> et le <a href=\"/cerclelabelmaison\">Cercle Label Maison</a> "
                       "si vous souhaitez nous recommander un bien.")),
        C.faq(f"Questions fréquentes — conciergerie Airbnb à {nom}", faq_items),
        C.formulaire(f"Estimation gratuite pour votre bien à {nom}",
                     "Surface, quartier, disponibilité : trois informations suffisent pour que nous "
                     "revenions vers vous avec une estimation de revenus et notre proposition.",
                     nom, "Conciergerie Airbnb", titre),
        C.footer([(region, [(f"Conciergerie {x[0]}", f"/conciergerie-airbnb-{x[1]}")
                            for x in voisines] + [("Toutes nos villes", HUB)]),
                  ("Nos services", [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                                    ("Gestion locative", "/gestion-locative-paris"),
                                    ("Investissement locatif", "/investissement-locatif-paris"),
                                    ("Conciergerie privée de luxe", "/conciergerie-privee-paris"),
                                    ("Blog propriétaires", "/blog")])],
                 f"Conciergerie Airbnb à {nom} — gestion locative courte et moyenne durée, "
                 f"<span class=\"font-serif-italic\">clé en main</span>.",
                 f"{nom} ({cp}) · {region}"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(slug, parts)


def page_hub() -> None:
    path = HUB
    url = C.SITE + path
    titre = "Conciergerie Airbnb en France — gestion locative clé en main partout"
    desc = ("Conciergerie Airbnb partout en France : Paris, Lyon, Marseille, Bordeaux, Nice, Annecy, "
            "Biarritz, Lille, Strasbourg… Annonce, prix, voyageurs, ménage et maintenance pris en charge. "
            "Estimation gratuite pour les propriétaires.")
    regions: dict = {}
    for v in V:
        regions.setdefault(v[3], []).append(v)
    faq_items = [
        ("Dans quelles villes intervenez-vous ?",
         "Nous couvrons Paris et l'Île-de-France, les grandes métropoles (Lyon, Marseille, Bordeaux, "
         "Toulouse, Nantes, Lille, Strasbourg…), le littoral et la montagne. Si votre ville n'a pas "
         "encore sa page, écrivez-nous : nous ouvrons régulièrement de nouveaux secteurs."),
        ("Comment gérez-vous à distance ?",
         "Nous ne gérons jamais uniquement à distance. Sur chaque ville, nous travaillons avec des "
         "équipes de ménage et des artisans locaux, pilotés par un référent unique côté Label Maison. "
         "C'est ce qui permet de traiter un incident dans l'heure."),
        ("Quel est votre modèle de rémunération ?",
         "Une commission sur les revenus encaissés. Pas d'abonnement, pas de frais d'entrée : nous ne "
         "gagnons que quand votre bien génère du revenu."),
        ("Courte durée ou moyenne durée ?",
         "Les deux, selon la réglementation locale et la saison. Le bail mobilité (1 à 10 mois) est "
         "souvent la meilleure option dans les villes où la courte durée est très encadrée."),
        ("Combien de biens gérez-vous par ville ?",
         "Nous limitons volontairement le nombre de biens par secteur pour garder un niveau de service "
         "réel. C'est aussi ce qui nous permet de refuser des logements que nous ne pourrions pas "
         "tenir correctement."),
    ]
    trail = [("Accueil", "/"), ("Conciergerie Airbnb en France", path)]
    p = C.photo(6)
    parts = [
        C.head(titre, desc, path,
               [C.ld_business(" — France", url, desc, "Paris", "Île-de-France", "75008",
                              geo=(48.8698, 2.3079),
                              area=[v[0] for v in V] + ["Paris", "France"]),
                C.ld_service("Conciergerie Airbnb et gestion locative courte durée en France",
                             "France", url, desc),
                C.ld_faq(faq_items), C.ld_breadcrumb(trail),
                {"@context": "https://schema.org", "@type": "ItemList",
                 "name": "Conciergerie Airbnb ville par ville en France",
                 "itemListElement": [
                     {"@type": "ListItem", "position": i + 1,
                      "name": f"Conciergerie Airbnb {v[0]}",
                      "url": f"{C.SITE}/conciergerie-airbnb-{v[1]}"} for i, v in enumerate(V)]}],
               image=f"{C.SITE}/images/{p[0]}"),
        C.header([("France", HUB), ("Paris", "/conciergerie-airbnb-paris"),
                  ("Conciergerie privée", "/conciergerie-privee-paris"),
                  ("Propriétaires", "/proprietaires")]),
        C.crumb(trail),
        C.hero("🇫🇷 Partout en France",
               "Conciergerie Airbnb <span class=\"font-serif-italic\">en France</span>",
               "Métropoles, littoral, montagne, villes de province : nous gérons des logements en "
               "location courte et moyenne durée avec des équipes locales et un interlocuteur unique.",
               p[0], "Logements gérés par Label Maison Conciergerie partout en France",
               [f"<b>{len(V)}</b> villes", "Équipes <b>locales</b>",
                "Commission au <b>résultat</b>", "Courte & <b>moyenne durée</b>"]),
        C.texte([
            "La location courte durée n'obéit pas aux mêmes règles à Annecy, à Lille ou à Porto-Vecchio. "
            "Ici la saison dure quatre mois, là elle dure toute l'année ; ici la mairie plafonne les "
            "nuitées, là le bail mobilité est la meilleure formule. Une conciergerie qui applique la "
            "même recette partout laisse de l'argent sur la table — ou expose ses propriétaires.",
            "<strong>Label Maison Conciergerie</strong> travaille ville par ville : réglementation "
            "locale, calendrier des événements, comparables réels de votre quartier, équipes de ménage "
            "et artisans sur place. Vous gardez un interlocuteur unique ; c'est lui qui coordonne tout "
            "le reste.",
        ], pad=True),
        C.cartes("Ce que nous prenons en charge",
                 "Le même standard partout, exécuté par des équipes du secteur.", SERVICES),
        C.zones("Choisissez votre ville",
                "Une page par ville : quartiers couverts, saisonnalité réelle, réglementation locale.",
                [(f"{v[0]} ({v[2]})", f"/conciergerie-airbnb-{v[1]}") for v in V],
                extra=("Île-de-France : voir <a href=\"/conciergerie-airbnb-paris\"><strong>Paris et ses "
                       "20 arrondissements</strong></a>, "
                       "<a href=\"/conciergerie-airbnb-ile-de-france\">l'Île-de-France</a>, "
                       "<a href=\"/conciergerie-airbnb-essonne\">l'Essonne</a> et "
                       "<a href=\"/conciergerie-airbnb-sens\">l'Yonne</a>.")),
        C.galerie("galfr", [C.photo(k + 4) for k in range(8)]),
        C.etapes("Notre méthode, partout la même", [
            ("1. Étude locale", "Analyse du quartier, des comparables réellement loués et de la réglementation communale."),
            ("2. Préparation", "Aménagement, équipements, photos professionnelles, annonce rédigée pour la recherche."),
            ("3. Lancement", "Diffusion multi-plateformes, calendriers synchronisés, prix pilotés selon les événements locaux."),
            ("4. Exploitation", "Voyageurs, ménage, maintenance, avis, reporting mensuel : vous n'avez plus rien à faire."),
        ]),
        C.cartes("Pourquoi les propriétaires nous choisissent", "", POURQUOI, cols="g2"),
        C.faq("Questions fréquentes — conciergerie Airbnb en France", faq_items),
        C.formulaire("Estimation gratuite, partout en France",
                     "Dites-nous où se trouve votre bien et ce que vous en attendez : nous revenons "
                     "vers vous avec une estimation locale et une proposition de gestion.",
                     "", "Conciergerie Airbnb", titre),
        C.footer([("Grandes villes", [(v[0], f"/conciergerie-airbnb-{v[1]}") for v in V[:8]]),
                  ("Nos silos", [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                                 ("Conciergerie privée de luxe", "/conciergerie-privee-paris"),
                                 ("Gestion locative", "/gestion-locative-paris"),
                                 ("Investissement locatif", "/investissement-locatif-paris"),
                                 ("Blog propriétaires", "/blog")])],
                 "Conciergerie Airbnb partout en France — gestion locative courte et moyenne durée, "
                 "<span class=\"font-serif-italic\">avec des équipes locales</span>.",
                 "Paris · Lyon · Marseille · Bordeaux · Nice · Annecy · Lille"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(HUB.lstrip("/"), parts)


def main() -> list:
    page_hub()
    for i, v in enumerate(V):
        page_ville(v, i)
    urls = [HUB] + [f"/conciergerie-airbnb-{v[1]}" for v in V]
    print(f"France : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
