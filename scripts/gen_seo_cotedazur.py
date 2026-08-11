# -*- coding: utf-8 -*-
"""Silo SEO Côte d'Azur : tout le littoral, commune par commune.

Objectif : être la conciergerie de référence de Menton à Cassis. Deux intentions
sont couvertes séparément pour ne pas se cannibaliser :

  /conciergerie-airbnb-<commune>  → le propriétaire qui cherche un gestionnaire
  /conciergerie-<thème>           → le client final (villa, yacht, luxe, Monaco)

Nice, Cannes, Antibes, Saint-Tropez et Toulon ont déjà leur page dans le silo
France : elles sont reliées ici, pas dupliquées.
"""
from __future__ import annotations

import seo_common as C
import seo_ville as SV
from gen_seo_services import build

HUB = "/conciergerie-cote-d-azur"
NAV = [("Côte d'Azur", HUB), ("Villas", "/gestion-villa-cote-d-azur"),
       ("France", "/conciergerie-airbnb-france"), ("Propriétaires", "/proprietaires")]

# nom, slug, dept, cp, geo, quartiers, lieux, hook, demande, bien, saison, tendue
V = [
    ("Menton", "menton", "06", "06500", (43.7749, 7.4979),
     ["le Vieux Menton", "Garavan", "Carnolès", "le Borrigo"],
     ["les jardins de la Serre de la Madone", "la Fête du Citron", "la vieille ville italienne", "la frontière italienne"],
     "Menton fait deux saisons : la Fête du Citron en février remplit la ville en plein hiver, ce qui est rarissime sur la Côte.",
     "Clientèle italienne toute proche, seniors en long séjour hivernal, familles en été, visiteurs de la Fête du Citron.",
     "Appartements Belle Époque, biens vue mer à Garavan, studios de centre-ville",
     "Février exceptionnel grâce à la Fête du Citron, été plein, et un hiver doux qui ne se vide jamais complètement.", True),
    ("Roquebrune-Cap-Martin", "roquebrune-cap-martin", "06", "06190", (43.7581, 7.4747),
     ["le Cap-Martin", "le village médiéval", "Carnolès", "Saint-Roman"],
     ["le Cabanon de Le Corbusier", "le sentier du bord de mer", "la plage du Buse", "Monaco à cinq minutes"],
     "À cinq minutes de Monaco, la commune loge ceux qui travaillent en Principauté sans pouvoir s'y loger : la moyenne durée y est une mine.",
     "Salariés de Monaco en moyenne durée, clientèle italienne, familles en séjour balnéaire l'été.",
     "Villas du Cap-Martin, appartements vue mer, studios proches gare",
     "Été très fort, mais une demande de moyenne durée continue toute l'année portée par Monaco.", True),
    ("Cap-d'Ail", "cap-d-ail", "06", "06320", (43.7256, 7.4064),
     ["la Marina", "la plage Mala", "le centre", "Saint-Antoine"],
     ["la plage Mala", "le sentier littoral", "le port de Cap-d'Ail", "Monaco à une station de train"],
     "Cap-d'Ail est la porte d'entrée de Monaco : une station de train, et des loyers qui restent inférieurs à ceux de la Principauté.",
     "Employés et cadres travaillant à Monaco, plaisanciers, familles en été.",
     "Appartements avec vue mer, studios proches gare, villas sur les hauteurs",
     "Saison estivale forte, Grand Prix de Monaco en mai, et une demande de moyenne durée toute l'année.", True),
    ("Beaulieu-sur-Mer", "beaulieu-sur-mer", "06", "06310", (43.7069, 7.3319),
     ["la Petite Afrique", "la baie des Fourmis", "le port de plaisance", "le centre"],
     ["la Villa Kérylos", "le port de plaisance", "le sentier Maurice-Rouvier", "Saint-Jean-Cap-Ferrat voisin"],
     "Beaulieu bénéficie du microclimat le plus doux de la Côte : la Petite Afrique attire une clientèle de villégiature qui reste plusieurs semaines.",
     "Villégiature haut de gamme, seniors en long séjour, plaisanciers du port.",
     "Appartements Belle Époque, biens vue baie, villas de villégiature",
     "Saison longue d'avril à octobre, hiver doux qui soutient les longs séjours.", True),
    ("Villefranche-sur-Mer", "villefranche-sur-mer", "06", "06230", (43.7042, 7.3111),
     ["la vieille ville", "la Darse", "les Marinières", "Saint-Michel"],
     ["la rade de Villefranche", "la citadelle", "la plage des Marinières", "les escales de croisière"],
     "L'une des plus belles rades d'Europe, à dix minutes de Nice : la demande y est internationale et se réserve très en avance.",
     "Croisiéristes en escale, clientèle américaine et britannique, couples en séjour romantique.",
     "Appartements de la vieille ville, biens vue rade, studios de charme",
     "Saison d'avril à octobre, avec des escales de croisière qui prolongent l'arrière-saison.", True),
    ("Saint-Jean-Cap-Ferrat", "saint-jean-cap-ferrat", "06", "06230", (43.6924, 7.3320),
     ["le port", "la pointe Saint-Hospice", "Passable", "le centre du village"],
     ["la Villa Ephrussi de Rothschild", "la plage de Paloma", "le sentier du Cap", "le port de plaisance"],
     "Le Cap-Ferrat est l'une des adresses les plus fermées de la Côte : peu de biens disponibles, une clientèle très exigeante, et un service qui doit être irréprochable.",
     "Clientèle internationale fortunée, familles en villa, plaisanciers.",
     "Villas avec piscine, appartements de standing, biens vue mer",
     "Saison de mai à septembre, avec des séjours longs en villa et des exigences de service élevées.", True),
    ("Èze", "eze", "06", "06360", (43.7278, 7.3620),
     ["Èze Village", "Èze-Bord-de-Mer", "la Grande Corniche", "la Moyenne Corniche"],
     ["le jardin exotique", "le sentier Nietzsche", "les corniches", "la parfumerie Fragonard"],
     "Èze cumule deux marchés distincts : le village perché, très touristique en journée, et le bord de mer, qui se loue à la semaine.",
     "Touristes internationaux en court séjour, couples en séjour romantique, familles côté bord de mer.",
     "Maisons de village en pierre, appartements vue mer, villas sur les corniches",
     "Forte saison d'avril à octobre, avec une clientèle internationale qui réserve tôt.", True),
    ("Saint-Laurent-du-Var", "saint-laurent-du-var", "06", "06700", (43.6683, 7.1878),
     ["le port", "les Vespins", "le centre-ville", "les Pugets"],
     ["le port de Saint-Laurent", "l'aéroport Nice Côte d'Azur à cinq minutes", "Cap3000", "les plages"],
     "Cinq minutes de l'aéroport de Nice : la commune capte les séjours courts et les escales, un marché que les propriétaires locaux exploitent peu.",
     "Voyageurs en escale aéroport, déplacements professionnels, familles en séjour balnéaire.",
     "Appartements proches port, studios rénovés, biens avec parking",
     "Demande aéroportuaire toute l'année, doublée d'une saison estivale classique.", True),
    ("Cagnes-sur-Mer", "cagnes-sur-mer", "06", "06800", (43.6644, 7.1489),
     ["le Haut-de-Cagnes", "le Cros-de-Cagnes", "le centre-ville", "les Bréguières"],
     ["le château Grimaldi", "l'hippodrome de la Côte d'Azur", "la plage du Cros", "le musée Renoir"],
     "Cagnes offre un rapport prix d'achat / potentiel locatif parmi les meilleurs du 06, avec la mer d'un côté et un village perché de l'autre.",
     "Familles en séjour balnéaire, public de l'hippodrome, clientèle en escale aéroport.",
     "Appartements front de mer au Cros, maisons du Haut-de-Cagnes, studios centre",
     "Été très fort, réunions hippiques au printemps et à l'automne, hiver plus calme.", True),
    ("Villeneuve-Loubet", "villeneuve-loubet", "06", "06270", (43.6581, 7.1225),
     ["la Marina Baie des Anges", "le village", "Vaugrenier", "les plages"],
     ["la Marina Baie des Anges", "le parc de Vaugrenier", "le port de plaisance", "les plages de galets"],
     "La Marina Baie des Anges concentre à elle seule des centaines de logements de vacances : le bien qui sort du lot est celui qui est réellement bien tenu.",
     "Familles en séjour d'été, plaisanciers, retraités en moyenne durée hors saison.",
     "Appartements de la Marina, studios vue mer, biens avec terrasse",
     "Saison de mai à septembre très marquée, arrière-saison douce, hiver calme.", True),
    ("Biot", "biot", "06", "06410", (43.6285, 7.0955),
     ["le village", "la Brague", "Biot 3000", "les Terriers"],
     ["Marineland", "le musée Fernand-Léger", "la verrerie de Biot", "Sophia Antipolis"],
     "Entre Marineland et Sophia Antipolis, Biot cumule tourisme familial et déplacements professionnels : deux clientèles qui ne se disputent pas les mêmes dates.",
     "Familles venues pour Marineland, ingénieurs de Sophia Antipolis en mission, touristes culturels.",
     "Maisons de village en pierre, appartements proches Sophia, villas avec jardin",
     "Été familial très fort, demande professionnelle continue hors vacances scolaires.", False),
    ("Valbonne Sophia Antipolis", "valbonne-sophia-antipolis", "06", "06560", (43.6406, 7.0086),
     ["le village de Valbonne", "Garbejaïre", "Sophia Antipolis", "les Clausonnes"],
     ["la technopole de Sophia Antipolis", "le village à arcades", "les golfs d'Opio", "la vallée de la Brague"],
     "Première technopole d'Europe : à Sophia Antipolis, la moyenne durée pour ingénieurs et consultants bat la nuitée touristique dix mois sur douze.",
     "Ingénieurs et consultants en mission, séminaires d'entreprise, familles en été.",
     "Appartements proches technopole, maisons provençales, villas avec piscine",
     "Demande professionnelle très régulière de septembre à juin, été plus touristique.", False),
    ("Vallauris Golfe-Juan", "vallauris-golfe-juan", "06", "06220", (43.5804, 7.0546),
     ["Golfe-Juan", "le centre de Vallauris", "le port Camille Rayon", "Super-Cannes"],
     ["le musée national Picasso", "le port Camille Rayon", "les plages de Golfe-Juan", "Cannes à cinq minutes"],
     "Golfe-Juan offre les plages de la baie de Cannes à des prix d'achat très inférieurs : c'est l'un des meilleurs rendements du secteur.",
     "Familles en séjour d'été, plaisanciers, visiteurs des congrès cannois à budget maîtrisé.",
     "Appartements front de mer, studios proches port, maisons de Vallauris",
     "Été très fort, congrès cannois au printemps et à l'automne, hiver calme.", True),
    ("Juan-les-Pins", "juan-les-pins", "06", "06160", (43.5675, 7.1103),
     ["la Pinède", "le centre", "le Cap d'Antibes", "les Îlettes"],
     ["le festival Jazz à Juan", "la Pinède Gould", "les plages de sable", "le casino"],
     "Jazz à Juan, en juillet, fait grimper les tarifs de toute la station : c'est la semaine la plus rentable de l'année pour un bien bien placé.",
     "Familles en séjour balnéaire, festivaliers en juillet, jeunes en séjour estival.",
     "Appartements proches plages, studios de station, biens avec balcon",
     "Saison de mai à septembre, pic absolu pendant Jazz à Juan, hiver très calme.", True),
    ("Le Cannet", "le-cannet", "06", "06110", (43.5757, 7.0192),
     ["le Vieux Cannet", "Rocheville", "la Croix des Gardes", "les Hauts du Cannet"],
     ["le musée Bonnard", "les hauteurs avec vue sur la baie", "Cannes à dix minutes", "les collines"],
     "Le Cannet, c'est Cannes sans les prix de la Croisette : même bassin de clientèle, notamment pendant les congrès, pour un ticket d'entrée bien plus accessible.",
     "Congressistes cannois, familles en été, clientèle en séjour prolongé.",
     "Appartements avec vue baie, villas sur les hauteurs, studios rénovés",
     "Pics pendant les congrès de Cannes, été plein, arrière-saison douce.", True),
    ("Mougins", "mougins", "06", "06250", (43.6003, 7.0060),
     ["le vieux village", "Val de Mougins", "Font de l'Orme", "Tournamy"],
     ["le vieux village perché", "les tables gastronomiques", "les golfs de Mougins", "Cannes à quinze minutes"],
     "Mougins attire une clientèle qui veut la Côte d'Azur sans la foule : villas avec piscine, séjours d'une à deux semaines, très peu de rotations.",
     "Familles internationales en villa, golfeurs, congressistes cannois logés au calme.",
     "Villas avec piscine, maisons provençales, appartements de standing",
     "Saison de mai à septembre, prolongée par le golf et les congrès cannois.", False),
    ("Grasse", "grasse", "06", "06130", (43.6597, 6.9225),
     ["la vieille ville", "Saint-Jacques", "Plascassier", "Saint-Antoine"],
     ["les parfumeries Fragonard et Molinard", "la cathédrale", "les champs de fleurs", "l'arrière-pays grassois"],
     "Capitale mondiale du parfum, Grasse reçoit un tourisme d'expérience toute l'année, et des prix d'achat sans rapport avec ceux du littoral situé à vingt minutes.",
     "Touristes du parfum, familles en séjour arrière-pays, professionnels de la filière.",
     "Appartements de la vieille ville, bastides, maisons avec vue",
     "Saison de mai à octobre, récolte des fleurs au printemps, demande étalée le reste de l'année.", False),
    ("Saint-Paul-de-Vence", "saint-paul-de-vence", "06", "06570", (43.6959, 7.1223),
     ["le village fortifié", "les Gardettes", "Sainte-Claire", "les Fumerates"],
     ["la fondation Maeght", "les remparts", "les galeries d'art", "la Colombe d'Or"],
     "Saint-Paul-de-Vence est une destination internationale à part entière : la rareté des biens dans les remparts soutient les prix toute l'année.",
     "Amateurs d'art, couples en séjour romantique, clientèle internationale haut de gamme.",
     "Maisons de village en pierre, mas avec vue, appartements de charme",
     "Fréquentation étalée d'avril à octobre, avec une clientèle culturelle hors saison.", False),
    ("Vence", "vence", "06", "06140", (43.7226, 7.1114),
     ["la cité historique", "les Baous", "Saint-Michel", "la Sine"],
     ["la chapelle du Rosaire de Matisse", "les Baous", "le marché provençal", "Saint-Paul à cinq minutes"],
     "Vence offre l'arrière-pays à quinze minutes de la mer : les séjours y sont plus longs et les charges de gestion, mécaniquement plus faibles.",
     "Familles en séjour d'une semaine, amateurs d'art, randonneurs des Baous.",
     "Maisons provençales avec jardin, appartements du centre historique, villas avec piscine",
     "Saison d'avril à octobre, très forte en juillet-août, arrière-saison agréable.", False),
    ("Mandelieu-la-Napoule", "mandelieu-la-napoule", "06", "06210", (43.5460, 6.9385),
     ["la Napoule", "Capitou", "les Termes", "le port"],
     ["le château de la Napoule", "les golfs de Mandelieu", "le massif de l'Estérel", "les ports de plaisance"],
     "Capitale du mimosa et paradis du golf : Mandelieu tourne bien en hiver, ce qui est l'exception plus que la règle sur le littoral.",
     "Golfeurs toute l'année, familles en été, plaisanciers, congressistes cannois.",
     "Appartements avec terrasse, villas proches golf, biens vue Estérel",
     "Été plein, golf de septembre à mai, mimosa en février : une année sans vrai creux.", True),
    ("Théoule-sur-Mer", "theoule-sur-mer", "06", "06590", (43.5063, 6.9407),
     ["le port", "Miramar", "la Figueirette", "le centre"],
     ["les roches rouges de l'Estérel", "les calanques", "le sentier littoral", "Cannes à dix minutes"],
     "Les roches rouges de l'Estérel plongeant dans la mer : Théoule est l'un des décors les plus photogéniques de la Côte, et cela se voit dans les taux de réservation.",
     "Couples en séjour nature, familles, randonneurs et plongeurs.",
     "Appartements vue mer, villas dans l'Estérel, studios proches criques",
     "Saison de mai à septembre, très demandée en juillet-août, arrière-saison prisée des randonneurs.", True),
    ("Saint-Raphaël", "saint-raphael", "83", "83700", (43.4249, 6.7686),
     ["le centre", "Valescure", "Boulouris", "Agay"],
     ["le port de plaisance", "les calanques d'Agay", "le golf de Valescure", "la gare TGV"],
     "Saint-Raphaël combine gare TGV, port et plages : les voyageurs arrivent sans voiture, ce qui élargit considérablement la clientèle potentielle.",
     "Familles en séjour d'été, golfeurs à Valescure, voyageurs TGV sans voiture.",
     "Appartements proches gare, villas à Valescure, biens vue mer à Agay",
     "Haute saison de juin à septembre, golf et randonnée au printemps et à l'automne.", True),
    ("Fréjus", "frejus", "83", "83600", (43.4332, 6.7370),
     ["Fréjus-Plage", "la vieille ville", "Saint-Aygulf", "Port-Fréjus"],
     ["les arènes romaines", "la base nature François-Léotard", "Port-Fréjus", "les plages de Saint-Aygulf"],
     "Fréjus est un marché familial de masse : de gros volumes en été, une demande stable, et des prix d'achat très inférieurs à ceux du 06.",
     "Familles en séjour d'été, campeurs en résidentiel, visiteurs du patrimoine romain.",
     "Appartements de Port-Fréjus, studios proches plage, maisons avec jardin",
     "Saison estivale massive de juin à septembre, épaules de mai et octobre en croissance.", True),
    ("Sainte-Maxime", "sainte-maxime", "83", "83120", (43.3092, 6.6383),
     ["le centre", "la Nartelle", "Guerrevieille", "la Croisette"],
     ["la plage de la Nartelle", "les navettes maritimes vers Saint-Tropez", "le port", "le golf de Beauvallon"],
     "Sainte-Maxime, c'est le golfe de Saint-Tropez à moitié prix : la navette maritime met la clientèle à vingt minutes du village mythique sans les tarifs correspondants.",
     "Familles en séjour golfe de Saint-Tropez, couples, plaisanciers.",
     "Appartements vue mer, villas avec piscine, studios proches port",
     "Saison très concentrée de juin à septembre, avec un pic en août.", True),
    ("Grimaud et Port-Grimaud", "grimaud-port-grimaud", "83", "83310", (43.2742, 6.5218),
     ["Port-Grimaud", "le village perché", "Beauvallon", "la Giscle"],
     ["la « Venise provençale »", "le village médiéval", "la baie de Saint-Tropez", "les plages de Beauvallon"],
     "Port-Grimaud est unique en France : des maisons les pieds dans l'eau avec amarrage privé, une demande internationale et des semaines qui se réservent un an à l'avance.",
     "Plaisanciers, familles internationales, clientèle du golfe de Saint-Tropez.",
     "Maisons de Port-Grimaud avec amarrage, villas avec piscine, maisons de village",
     "Saison de juin à septembre, réservations très anticipées, hors saison quasi nulle.", True),
    ("Cogolin", "cogolin", "83", "83310", (43.2528, 6.5300),
     ["le centre", "les Marines de Cogolin", "la plaine", "Saint-Maur"],
     ["les Marines de Cogolin", "le golf du golfe de Saint-Tropez", "Saint-Tropez à dix minutes", "les vignobles"],
     "Cogolin est la base arrière du golfe : mêmes plages, même clientèle, mais un prix d'achat qui laisse enfin de la place au rendement.",
     "Familles en séjour golfe, plaisanciers des Marines, saisonniers en moyenne durée.",
     "Appartements des Marines, maisons de village, villas avec piscine",
     "Été très fort, moyenne durée pour saisonniers au printemps, hiver calme.", False),
    ("Ramatuelle", "ramatuelle", "83", "83350", (43.2153, 6.6119),
     ["le village", "Pampelonne", "l'Escalet", "Bonne Terrasse"],
     ["la plage de Pampelonne", "le cap Camarat", "le festival de Ramatuelle", "les vignobles"],
     "Ramatuelle possède Pampelonne : la plage la plus célèbre d'Europe fait de chaque villa un actif rare, à condition d'un service à la hauteur des attentes.",
     "Clientèle internationale fortunée, groupes en villa, festivaliers en août.",
     "Villas avec piscine, mas provençaux, maisons de village",
     "Saison très concentrée de juin à septembre, avec des semaines à très forte valeur.", True),
    ("Gassin", "gassin", "83", "83580", (43.2283, 6.5847),
     ["le village classé", "la Foux", "les Marines de Gassin", "Bertaud"],
     ["le village perché classé", "le golfe de Saint-Tropez", "les vignobles", "les plages de Pampelonne"],
     "Classé parmi les plus beaux villages de France, Gassin surplombe le golfe : la vue est l'argument de vente numéro un, et elle se monétise.",
     "Couples en séjour, familles en villa, clientèle du golfe de Saint-Tropez.",
     "Maisons de village avec vue, villas avec piscine, mas viticoles",
     "Saison de juin à septembre, avec une arrière-saison viticole en croissance.", False),
    ("La Croix-Valmer", "la-croix-valmer", "83", "83420", (43.2078, 6.5697),
     ["le centre", "Gigaro", "Sylvabelle", "le Débarquement"],
     ["la plage de Gigaro", "le cap Lardier", "le sentier du littoral", "les vignobles"],
     "La Croix-Valmer garde un littoral préservé et un public familial fidèle : les mêmes voyageurs reviennent d'une année sur l'autre, ce qui simplifie tout.",
     "Familles fidélisées, randonneurs du cap Lardier, couples en séjour nature.",
     "Villas avec piscine, appartements proches Gigaro, maisons avec jardin",
     "Saison de juin à septembre, avec un printemps et un automne prisés des randonneurs.", False),
    ("Cavalaire-sur-Mer", "cavalaire-sur-mer", "83", "83240", (43.1739, 6.5308),
     ["le centre", "la Baie", "Pardigon", "le port"],
     ["la grande plage", "le port de plaisance", "les navettes vers les îles d'Hyères", "le massif des Maures"],
     "Cavalaire propose l'une des plus longues plages de sable du Var avec des prix d'achat abordables : le rendement locatif y est nettement supérieur au golfe voisin.",
     "Familles en séjour d'été, plaisanciers, plongeurs.",
     "Appartements proches plage, studios de station, villas avec vue",
     "Saison de juin à septembre, très forte en août, hors saison calme.", False),
    ("Le Lavandou", "le-lavandou", "83", "83980", (43.1372, 6.3670),
     ["Saint-Clair", "Aiguebelle", "Cavalière", "le centre"],
     ["les douze plages", "les navettes pour Port-Cros et Le Levant", "le cap Nègre", "le sentier du littoral"],
     "Douze plages sur une seule commune : Le Lavandou fidélise une clientèle familiale qui réserve d'une année sur l'autre, souvent en direct.",
     "Familles fidélisées, plongeurs, visiteurs des îles d'Hyères.",
     "Appartements vue mer, villas avec piscine, studios proches plages",
     "Saison de mai à septembre, pic en juillet-août, arrière-saison douce.", True),
    ("Bormes-les-Mimosas", "bormes-les-mimosas", "83", "83230", (43.1509, 6.3421),
     ["le village médiéval", "la Favière", "Cabasson", "le port"],
     ["le port de Bormes", "le fort de Brégançon", "le corso fleuri du mimosa", "les plages de Cabasson"],
     "Le corso du mimosa en février et le fort de Brégançon donnent à Bormes une notoriété qui dépasse largement sa saison estivale.",
     "Familles en été, visiteurs du corso en février, plaisanciers du port.",
     "Maisons du village médiéval, appartements à la Favière, villas avec piscine",
     "Été plein, pic en février pour le corso du mimosa, printemps très agréable.", False),
    ("Hyères", "hyeres", "83", "83400", (43.1204, 6.1286),
     ["la vieille ville", "la presqu'île de Giens", "l'Ayguade", "le Port"],
     ["les îles d'Or (Porquerolles, Port-Cros)", "la presqu'île de Giens", "les salins", "la villa Noailles"],
     "Porte des îles d'Or et capitale française du kitesurf : Hyères tourne d'avril à octobre, bien au-delà de la saison estivale classique.",
     "Kitesurfeurs et véliplanchistes, familles, visiteurs des îles, seniors en long séjour hivernal.",
     "Appartements proches port, villas de Giens, maisons de la vieille ville",
     "Saison longue d'avril à octobre, sports nautiques au printemps, hivernants en janvier-février.", True),
    ("Bandol", "bandol", "83", "83150", (43.1355, 5.7530),
     ["le port", "Rènecros", "le Capelan", "les Engraviers"],
     ["le vignoble de Bandol", "la plage de Rènecros", "l'île de Bendor", "le port de plaisance"],
     "Le vignoble de Bandol attire une clientèle œnotouristique qui vient hors saison : c'est ce qui permet de remplir avril, mai et octobre.",
     "Œnotouristes, familles en été, plaisanciers, clientèle lyonnaise et suisse.",
     "Appartements vue port, villas avec piscine, studios proches plage",
     "Été très fort, saison des vins d'avril à octobre, hiver calme.", False),
    ("Sanary-sur-Mer", "sanary-sur-mer", "83", "83110", (43.1197, 5.8003),
     ["le port", "Portissol", "la Gorguette", "le centre"],
     ["le port aux pointus", "le marché de Sanary", "la plage de Portissol", "le sentier du littoral"],
     "Régulièrement citée parmi les plus beaux marchés de France, Sanary attire une clientèle familiale française très fidèle, avec des séjours longs.",
     "Familles françaises fidélisées, seniors, couples en arrière-saison.",
     "Appartements proches port, villas avec jardin, studios rénovés",
     "Saison de mai à septembre, marché toute l'année, arrière-saison bien remplie.", False),
    ("Six-Fours-les-Plages", "six-fours-les-plages", "83", "83140", (43.0961, 5.8397),
     ["le Brusc", "les Lônes", "le centre", "la Coudoulière"],
     ["l'île des Embiez", "la plage de Bonnegrâce", "le cap Sicié", "les spots de voile"],
     "Six-Fours vit de la voile et de la plongée : une clientèle sportive qui vient hors juillet-août et remplit les mois où les stations voisines se vident.",
     "Véliplanchistes et plongeurs, familles en été, visiteurs des Embiez.",
     "Appartements proches plages, villas avec jardin, studios au Brusc",
     "Saison d'avril à octobre, sports nautiques au printemps et à l'automne.", False),
    ("Cassis", "cassis", "13", "13260", (43.2148, 5.5381),
     ["le port", "les Janots", "la Presqu'île", "le centre"],
     ["les calanques de Cassis", "le cap Canaille", "le vignoble de Cassis", "le port"],
     "Les calanques font de Cassis une destination de journée autant que de séjour : les biens qui capturent la clientèle sur deux ou trois nuits sont ceux qui savent se différencier.",
     "Randonneurs des calanques, couples en week-end, clientèle marseillaise et internationale.",
     "Appartements du port, maisons de village, villas avec vue",
     "Saison d'avril à octobre, week-ends très demandés toute l'année, pic estival.", True),
]

SERVICES = [
    ("Location saisonnière pilotée",
     "Annonce, photos, diffusion Airbnb/Booking/Abritel et tarification calée sur le calendrier "
     "réel de la Côte : congrès, festivals, régates, ponts et vacances scolaires européennes."),
    ("Accueil et conciergerie voyageurs",
     "Check-in en personne, livret d'accueil, réservations de restaurants, chauffeur, bateau ou "
     "chef à domicile : c'est ce niveau de service qui fait les avis cinq étoiles sur la Côte."),
    ("Ménage et linge hôtelier",
     "Équipes formées au standard hôtelier, linge et serviettes fournis, produits d'accueil, "
     "rotation le jour même entre un départ et une arrivée en pleine saison."),
    ("Piscine, jardin, extérieurs",
     "Entretien de la piscine, du jardin et des terrasses coordonné avec le planning de location : "
     "sur la Côte d'Azur, l'extérieur est le premier critère de réservation."),
    ("Gardiennage hors saison",
     "Visites régulières de votre résidence secondaire, relevé du courrier, aération, contrôle "
     "après intempérie et remise en route avant votre arrivée."),
    ("Maintenance et artisans",
     "Climatisation, pompe de piscine, électroménager : un réseau d'artisans locaux joignables "
     "en pleine saison, quand tout le monde est débordé."),
]

WHY = [
    ("Nous connaissons le calendrier de la Côte",
     "Festival de Cannes, Grand Prix de Monaco, Jazz à Juan, Voiles de Saint-Tropez, régates, "
     "congrès : ces dates valent plusieurs mois de revenus. Elles se préparent des mois à l'avance."),
    ("Villas et résidences secondaires",
     "Piscine, jardin, domotique, personnel de maison : nous gérons des biens qui demandent plus "
     "qu'un simple ménage entre deux séjours."),
    ("Présents hors saison",
     "D'octobre à avril, votre bien reste surveillé, entretenu et prêt. C'est ce qui distingue une "
     "conciergerie d'un simple prestataire de ménage."),
    ("Rémunérés au résultat",
     "Commission sur les revenus encaissés, sans abonnement. Une saison ratée nous coûte autant "
     "qu'à vous : c'est la meilleure garantie d'implication."),
]


def regl(v) -> str:
    nom, tendue = v[0], v[11]
    if tendue:
        return (f"À {nom}, la location de meublés de tourisme est encadrée : la commune impose "
                f"généralement une déclaration en mairie avec numéro d'enregistrement à afficher sur "
                f"l'annonce, et une autorisation de changement d'usage peut être exigée pour une "
                f"résidence secondaire. Les règles varient d'une commune à l'autre du littoral et "
                f"évoluent régulièrement : nous vérifions la situation exacte de votre bien avant "
                f"toute mise en ligne.")
    return (f"À {nom}, les démarches sont plus légères que dans les grandes communes du littoral, "
            f"mais une déclaration en mairie et un numéro d'enregistrement peuvent être exigés, et "
            f"la taxe de séjour reste due dans tous les cas. Nous vérifions les règles applicables "
            f"à votre adresse avant la mise en ligne.")


def extra(v):
    nom = v[0]
    return (f"Résidence secondaire à {nom} : la gérer, ou la faire vivre", [
        f"Beaucoup de nos propriétaires de {nom} n'habitent pas sur place. Leur bien reste fermé dix "
        f"mois par an, se dégrade lentement, et coûte des charges toute l'année. La location "
        f"saisonnière encadrée résout les deux problèmes à la fois : le bien est occupé, donc "
        f"entretenu, et il finance ses propres charges.",
        f"Nous adaptons la formule à votre usage : certains propriétaires gardent juillet et août "
        f"pour eux et nous confient le reste de la saison ; d'autres louent l'été et récupèrent leur "
        f"maison en septembre. Vous bloquez vos dates, nous remplissons les autres — et hors saison, "
        f"nous continuons de veiller sur la maison, piscine et jardin compris.",
    ])


def faq_extra(v):
    nom = v[0]
    return [
        (f"Gérez-vous les villas avec piscine à {nom} ?",
         "Oui, c'est même l'essentiel de notre activité sur le littoral : entretien de la piscine et "
         "du jardin coordonné avec le calendrier de location, ménage renforcé, accueil sur place et "
         "services à la carte pour les voyageurs (chef, chauffeur, bateau)."),
        ("Que faites-vous de mon bien hors saison ?",
         f"Nous continuons de le surveiller : visites régulières, relevé du courrier, aération, "
         f"contrôle après un coup de vent ou une forte pluie, remise en route avant votre arrivée. "
         f"Un bien fermé six mois sans visite est un bien qui se dégrade."),
        (f"Puis-je garder l'été pour moi à {nom} ?",
         "Bien sûr. Beaucoup de propriétaires bloquent juillet-août pour leur famille et nous "
         "confient mai, juin, septembre et octobre — des mois souvent sous-exploités alors que la "
         "demande y est réelle."),
    ]


SILO = SV.Silo(
    nom="Côte d'Azur", hub=HUB, region="Provence-Alpes-Côte d'Azur", nav=NAV,
    services=SERVICES, why=WHY, regl=regl, extra_section=extra, faq_extra=faq_extra,
    titre_tpl="Conciergerie Airbnb à {nom} ({cp}) — gestion de villas et appartements",
    badge_tpl="🌊 {nom} · Côte d'Azur ({dept})",
    footer_extra=[("Côte d'Azur", [("Toute la Côte d'Azur", HUB),
                                   ("Gestion de villa", "/gestion-villa-cote-d-azur"),
                                   ("Conciergerie de luxe à Cannes", "/conciergerie-luxe-cannes"),
                                   ("Conciergerie privée à Nice", "/conciergerie-privee-nice"),
                                   ("Conciergerie à Monaco", "/conciergerie-monaco")])],
)

HUB_SPEC = dict(
    title="Conciergerie Côte d'Azur — gestion de villas et locations saisonnières, de Menton à Cassis",
    desc="Conciergerie sur toute la Côte d'Azur : gestion locative saisonnière, villas avec piscine, "
         "accueil des voyageurs, ménage hôtelier, entretien et gardiennage hors saison. Nice, Cannes, "
         "Antibes, Saint-Tropez, Menton, Monaco et tout le littoral.",
    ville_ld="Nice", cp_ld="06000", geo_ld=(43.7102, 7.2620), photo_index=11,
    badge="🌊 Côte d'Azur · de Menton à Cassis",
    h1="Conciergerie sur la <span class=\"font-serif-italic\">Côte d'Azur</span>",
    sub="Villas avec piscine, appartements vue mer, résidences secondaires : nous gérons votre bien "
        "azuréen toute l'année — location saisonnière, accueil, ménage hôtelier, piscine, jardin et "
        "gardiennage hors saison.",
    alt="Villa avec piscine gérée par Label Maison Conciergerie sur la Côte d'Azur",
    puces=["De <b>Menton</b> à <b>Cassis</b>", "Villas & <b>piscines</b>",
           "Accueil <b>voyageurs</b>", "Gardiennage <b>hors saison</b>"],
    intro=[
        "La Côte d'Azur n'est pas un marché locatif, c'en est une dizaine. Une villa à Ramatuelle, un "
        "deux-pièces à Juan-les-Pins, un appartement à cinq minutes de Monaco et une maison dans "
        "l'arrière-pays grassois ne se louent ni au même public, ni à la même période, ni au même prix. "
        "Appliquer la même recette partout, c'est laisser une saison entière sur la table.",
        "<strong>Label Maison Conciergerie</strong> couvre l'ensemble du littoral, commune par commune, "
        "avec des équipes de ménage, des pisciniers et des artisans locaux. Nous gérons la location "
        "saisonnière quand vous voulez que le bien rapporte, et nous veillons dessus quand vous voulez "
        "simplement qu'il vous attende en bon état.",
    ],
    sections=[
        ("Le calendrier azuréen : là où se gagne la saison", [
            "Le Festival de Cannes, le Grand Prix de Monaco, Jazz à Juan, les Voiles de Saint-Tropez, "
            "la Fête du Citron à Menton, les régates et les grands congrès ne remplissent pas seulement "
            "leur commune : ils font monter les prix sur tout le littoral alentour, parfois à trente "
            "kilomètres à la ronde.",
            "Ces dates se préparent des mois à l'avance : durée minimale de séjour, ouverture du "
            "calendrier, positionnement tarifaire. Un propriétaire qui découvre l'événement une semaine "
            "avant a déjà perdu l'essentiel de la marge. C'est précisément le travail que nous faisons "
            "à votre place, sur toutes les communes que nous couvrons.",
        ]),
        ("Villas, piscines et résidences secondaires", [
            "Sur la Côte, une part importante du parc est constituée de résidences secondaires "
            "occupées quelques semaines par an. Le reste du temps, elles se dégradent et coûtent des "
            "charges. La location saisonnière encadrée les fait vivre, et un gardiennage sérieux "
            "les protège.",
            "Nous gérons l'ensemble : piscine, jardin, terrasses, climatisation, domotique, "
            "personnel de maison si nécessaire. Et nous coordonnons ces interventions avec le "
            "calendrier de location, pour qu'un voyageur ne trouve jamais un jardinier dans son "
            "salon un jour d'arrivée.",
        ]),
    ],
    zones_extra=("Nos grandes villes de la Côte ont leur propre page : "
                 "<a href=\"/conciergerie-airbnb-nice\"><strong>Nice</strong></a>, "
                 "<a href=\"/conciergerie-airbnb-cannes\"><strong>Cannes</strong></a>, "
                 "<a href=\"/conciergerie-airbnb-antibes\"><strong>Antibes</strong></a>, "
                 "<a href=\"/conciergerie-airbnb-saint-tropez\"><strong>Saint-Tropez</strong></a> et "
                 "<a href=\"/conciergerie-airbnb-toulon\">Toulon</a>. "
                 "Pour le client final : <a href=\"/conciergerie-luxe-cannes\">conciergerie de luxe à "
                 "Cannes</a>, <a href=\"/conciergerie-privee-nice\">conciergerie privée à Nice</a>, "
                 "<a href=\"/conciergerie-villa-saint-tropez\">villas à Saint-Tropez</a>, "
                 "<a href=\"/conciergerie-monaco\">Monaco</a> et "
                 "<a href=\"/conciergerie-yacht-cote-d-azur\">yachting</a>."),
    faq_title="Questions fréquentes — conciergerie sur la Côte d'Azur",
    faq=[
        ("Sur quelles communes intervenez-vous ?",
         "De Menton à Cassis : tout le littoral des Alpes-Maritimes et du Var, l'arrière-pays proche "
         "(Grasse, Mougins, Valbonne, Vence, Saint-Paul) et le golfe de Saint-Tropez. Chaque commune "
         "a sa page dédiée avec ses spécificités."),
        ("Gérez-vous les villas avec piscine ?",
         "Oui, c'est le cœur de notre activité sur la Côte : entretien de la piscine et du jardin, "
         "ménage renforcé, accueil sur place, services à la carte pour les voyageurs et maintenance "
         "coordonnée avec le calendrier de location."),
        ("Que se passe-t-il hors saison ?",
         "Nous assurons le gardiennage : visites régulières, courrier, aération, contrôle après "
         "intempérie, remise en route avant votre arrivée. Votre maison ne reste jamais six mois "
         "sans surveillance."),
        ("Quelle est votre rémunération ?",
         "Une commission sur les revenus locatifs encaissés, et un forfait pour les prestations "
         "d'entretien et de gardiennage hors location. Tout est chiffré à l'avance, sans abonnement "
         "caché."),
        ("Puis-je garder mon bien pour moi une partie de l'année ?",
         "Oui, autant que vous voulez. Vous bloquez vos dates ; nous optimisons les périodes que vous "
         "ouvrez — souvent mai, juin, septembre et octobre, très sous-exploités par les propriétaires."),
        ("Travaillez-vous avec les propriétaires étrangers ?",
         "Oui. Une grande partie des propriétaires du littoral vivent à l'étranger : nous sommes leur "
         "présence sur place, avec des comptes rendus écrits et photos à chaque intervention."),
    ],
    form=("Votre bien sur la Côte d'Azur mérite mieux qu'un calendrier vide",
          "Commune, type de bien, périodes que vous souhaitez garder : nous revenons vers vous avec "
          "une estimation et un plan de saison.", ""),
    tagline="Conciergerie sur toute la Côte d'Azur — villas, appartements et résidences secondaires, "
            "<span class=\"font-serif-italic\">de Menton à Cassis</span>.",
    lieu="Nice · Cannes · Antibes · Saint-Tropez · Monaco",
)

# --------------------------------------------------------------------------- #
#  Pages premium (client final, pas propriétaire)
# --------------------------------------------------------------------------- #
FOOT_CA = [("Côte d'Azur", [("Toute la Côte d'Azur", HUB),
                            ("Gestion de villa", "/gestion-villa-cote-d-azur"),
                            ("Location de villa", "/location-villa-cote-d-azur"),
                            ("Yachting", "/conciergerie-yacht-cote-d-azur"),
                            ("Monaco", "/conciergerie-monaco")]),
           ("Nos villes", [("Nice", "/conciergerie-airbnb-nice"), ("Cannes", "/conciergerie-airbnb-cannes"),
                           ("Antibes", "/conciergerie-airbnb-antibes"),
                           ("Saint-Tropez", "/conciergerie-airbnb-saint-tropez"),
                           ("Menton", "/conciergerie-airbnb-menton")])]

WHY_LUXE = ("Pourquoi Label Maison sur la Côte", [
    ("Un interlocuteur, pas un standard",
     "Une seule personne connaît votre dossier, vos habitudes et vos contraintes. Vous n'expliquez "
     "jamais deux fois la même chose."),
    ("Un réseau réellement local",
     "Chauffeurs, capitaines, chefs, pisciniers, gouvernantes, artisans : des partenaires que nous "
     "utilisons toute l'année, pas un annuaire acheté."),
    ("Discrétion",
     "Nos clients ne sont jamais cités, nos adresses jamais communiquées. C'est la base du métier."),
    ("Disponibilité en pleine saison",
     "En août sur la Côte, tout le monde est complet. Notre valeur, c'est de trouver quand même — "
     "table, bateau, chauffeur, artisan."),
])

PREMIUM = [
    dict(slug="gestion-villa-cote-d-azur",
         title="Gestion de villa sur la Côte d'Azur — location saisonnière, entretien et gardiennage",
         desc="Gestion complète de villas sur la Côte d'Azur : location saisonnière, accueil des "
              "voyageurs, ménage hôtelier, piscine, jardin, maintenance et gardiennage hors saison. "
              "De Menton à Saint-Tropez.",
         crumb="Gestion de villa", trail=[("Accueil", "/"), ("Côte d'Azur", HUB)], nav=NAV,
         service_type="Gestion de villa et de résidence secondaire sur la Côte d'Azur",
         area="Côte d'Azur",
         business=(" — Côte d'Azur", "Nice", "Provence-Alpes-Côte d'Azur", "06000", "FR",
                   (43.7102, 7.2620), ["Côte d'Azur", "Nice", "Cannes", "Saint-Tropez"]),
         offers=["Location saisonnière", "Accueil des voyageurs", "Ménage hôtelier",
                 "Entretien de piscine", "Entretien du jardin", "Gardiennage hors saison"],
         badge="🏊 Côte d'Azur · Villas",
         h1="Gestion de <span class=\"font-serif-italic\">villa</span> sur la Côte d'Azur",
         sub="Votre villa vous attend en parfait état quand vous arrivez, et elle travaille pour vous "
             "quand vous n'êtes pas là. Location saisonnière, entretien, piscine, jardin, gardiennage.",
         photo=("real/residence-villa.jpg", "Villa avec piscine gérée sur la Côte d'Azur"),
         puces=["Piscine & <b>jardin</b>", "Ménage <b>hôtelier</b>",
                "Gardiennage <b>hors saison</b>", "Location <b>pilotée</b>"],
         cta="Confier ma villa",
         intro=[
             "Une villa sur la Côte d'Azur, c'est un plaisir six semaines par an et une charge le "
             "reste du temps : piscine à traiter, jardin qui pousse, volets qui claquent au premier "
             "coup de mistral, et personne sur place pour s'en apercevoir.",
             "Nous prenons la villa en charge dans sa totalité. Vous décidez des semaines que vous "
             "gardez ; nous louons les autres si vous le souhaitez, nous entretenons toute l'année, "
             "et nous vous rendons la maison prête — piscine claire, jardin taillé, linge frais — "
             "le jour de votre arrivée.",
         ],
         cards=("Ce que nous prenons en charge", "Une villa demande plus qu'un ménage entre deux séjours.", [
             ("Location saisonnière",
              "Photos, annonce haut de gamme, sélection des locataires, tarification calée sur le "
              "calendrier événementiel de la Côte."),
             ("Accueil et séjour",
              "Check-in sur place, présentation de la maison, réservations (table, bateau, chauffeur, "
              "chef à domicile) et assistance pendant tout le séjour."),
             ("Ménage et linge",
              "Gouvernantes formées, linge de maison hôtelier, produits d'accueil, remise en état "
              "complète entre deux locations."),
             ("Piscine et jardin",
              "Traitement de l'eau, nettoyage, arrosage, taille, remise en ordre des extérieurs : "
              "coordonnés avec le calendrier pour rester invisibles pendant les séjours."),
             ("Maintenance technique",
              "Climatisation, pompes, domotique, électroménager, alarme : nos artisans interviennent "
              "vite, y compris en plein mois d'août."),
             ("Gardiennage hors saison",
              "Visites régulières, courrier, aération, contrôle après intempérie, mise en route "
              "avant votre arrivée. Comptes rendus photo systématiques."),
         ]),
         sections=[
             ("Louer ou ne pas louer : c'est vous qui décidez", [
                 "Certains propriétaires veulent que la villa rapporte le maximum : nous ouvrons "
                 "alors la saison complète, de mai à octobre, avec une tarification agressive sur "
                 "les semaines de pointe.",
                 "D'autres veulent seulement financer les charges : nous ne louons que quelques "
                 "semaines choisies, souvent en juin et septembre, quand la demande est bonne et "
                 "que la maison ne leur manque pas.",
                 "D'autres enfin ne veulent aucune location : nous n'assurons alors que l'entretien "
                 "et le gardiennage. Les trois formules existent, et on peut passer de l'une à "
                 "l'autre d'une année sur l'autre.",
             ]),
             ("Ce qui fait la différence sur une villa de standing", [
                 "La photo d'ouverture, évidemment — mais aussi l'état réel des extérieurs le jour de "
                 "l'arrivée, la qualité de la literie et du linge, la propreté de la piscine, et la "
                 "capacité à répondre dans l'heure quand la climatisation lâche un 14 août.",
                 "Ces détails ne se voient pas sur un contrat. Ils se voient dans les avis, et les "
                 "avis fixent le prix que vous pourrez demander l'année suivante.",
             ]),
         ],
         gallery=[C.photo(k + 5) for k in range(6)],
         steps=("Comment nous prenons la villa en main", [
             ("1. Visite complète", "État des lieux détaillé, inventaire, points techniques, "
              "prestataires en place que nous pouvons conserver."),
             ("2. Plan de saison", "Semaines que vous gardez, semaines ouvertes à la location, "
              "budget d'entretien : tout est écrit avant de commencer."),
             ("3. Mise en marché", "Shooting, annonce, diffusion et sélection des locataires — "
              "si vous choisissez de louer."),
             ("4. Suivi toute l'année", "Interventions, comptes rendus photo, revenus et dépenses : "
              "un récapitulatif clair chaque mois."),
         ]),
         why=WHY_LUXE,
         zones=("Nos secteurs villas", "",
                [("Saint-Tropez et le golfe", "/conciergerie-villa-saint-tropez"),
                 ("Cannes et Mougins", "/conciergerie-luxe-cannes"),
                 ("Nice et le Cap-Ferrat", "/conciergerie-privee-nice"),
                 ("Ramatuelle", "/conciergerie-airbnb-ramatuelle"),
                 ("Mougins", "/conciergerie-airbnb-mougins"),
                 ("Toute la Côte d'Azur", HUB)],
                "Vous cherchez plutôt à <a href=\"/location-villa-cote-d-azur\"><strong>louer une "
                "villa</strong></a> pour vos vacances ? C'est ici."),
         faq_title="Questions fréquentes — gestion de villa sur la Côte d'Azur",
         faq=[
             ("Puis-je garder mes prestataires actuels ?",
              "Oui. Si votre piscinier ou votre jardinier vous convient, nous travaillons avec eux "
              "et nous coordonnons simplement leurs interventions avec le calendrier."),
             ("Comment êtes-vous rémunérés ?",
              "Commission sur les revenus locatifs, et forfait mensuel pour l'entretien et le "
              "gardiennage hors location. Le détail figure dans la proposition, sans frais cachés."),
             ("Intervenez-vous si je ne loue pas du tout ?",
              "Oui. Beaucoup de nos propriétaires ne louent jamais et nous confient uniquement "
              "l'entretien, le gardiennage et la préparation avant leurs venues."),
             ("Que se passe-t-il en cas de dégât pendant une location ?",
              "Constat photo immédiat, chiffrage, mobilisation de la caution ou de l'assurance, "
              "réparation coordonnée. Vous êtes informé le jour même."),
             ("Gérez-vous le personnel de maison ?",
              "Oui : gouvernante, chef, chauffeur, agent d'entretien. Nous pouvons recruter, "
              "encadrer ou simplement coordonner votre personnel existant."),
             ("Sur quelles communes intervenez-vous ?",
              "Tout le littoral de Menton à Cassis et l'arrière-pays proche. Voir "
              "<a href=\"/conciergerie-cote-d-azur\">la liste complète de nos communes</a>."),
         ],
         form=("Confiez-nous votre villa",
               "Commune, taille du bien, présence d'une piscine, semaines que vous souhaitez garder : "
               "nous revenons vers vous avec un plan de gestion chiffré.",
               "Côte d'Azur", "Gestion de villa"),
         footer=FOOT_CA,
         tagline="Gestion de villas sur la Côte d'Azur — location, entretien et "
                 "<span class=\"font-serif-italic\">gardiennage toute l'année</span>.",
         lieu="Nice · Cannes · Saint-Tropez · Menton",
         mobcta="Confier ma villa"),
]


def main() -> list:
    urls = [SV.hub(SILO, V, HUB_SPEC)]
    for i, v in enumerate(V):
        urls.append(SV.page(SILO, v, i, V))
    urls += [build(s) for s in PREMIUM]
    print(f"Côte d'Azur : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
