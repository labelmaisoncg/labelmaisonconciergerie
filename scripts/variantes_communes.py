# -*- coding: utf-8 -*-
"""Variantes rédactionnelles des blocs communs aux pages communes.

Pourquoi : mesuré le 2 novembre 2026 sur 40 pages communes, le contenu principal
(hors en-tête, pied de page et formulaire) était partagé à près de 50 % entre deux
pages prises au hasard (indice de Jaccard sur des suites de 8 mots). Google l'avait
compris avant nous : 1 104 de ces pages étaient « détectées, non indexées ».
Chaque bloc existe ici en trois formulations réellement différentes ; la page d'une
commune en reçoit une, choisie de façon stable à partir de son code INSEE. Les
données officielles locales (scripts/donnees_locales.py) apportent le reste de
l'unicité.
"""
from __future__ import annotations

# --------------------------------------------------------------------------- #
#  Conciergerie privée et gestion de résidence (6 cartes)
# --------------------------------------------------------------------------- #
PRIVEE = [
    [
        ("Gestion de résidence secondaire",
         "Visites régulières, relevé du courrier, aération, contrôle après intempérie et préparation "
         "du logement avant votre arrivée."),
        ("Intendance et prestataires",
         "Ménage, jardinier, artisan, livraison : nous coordonnons les intervenants et nous vérifions "
         "que le travail est fait."),
        ("Remise de clés et accueil",
         "Pour vos invités, vos locataires ou vos artisans : quelqu'un sur place, à l'heure, avec un "
         "compte rendu."),
        ("Préparation avant séjour",
         "Ménage, linge, courses, chauffage ou climatisation en route : vous arrivez dans une maison "
         "prête, pas dans une maison fermée."),
        ("Suivi administratif du bien",
         "Déclaration en mairie, taxe de séjour, relation avec la copropriété : nous prenons en charge "
         "les démarches liées à la location."),
        ("Demandes sur mesure",
         "Chauffeur, réservations, personnel de maison, organisation d'un séjour : notre métier de "
         "conciergerie privée s'applique aussi ici."),
    ],
    [
        ("Une maison fermée, surveillée",
         "Passage à intervalle convenu, photos à chaque visite, vérification des ouvertures, de "
         "l'humidité et des compteurs : vous savez ce qui se passe chez vous."),
        ("Les artisans, sans y aller",
         "Devis comparés, rendez-vous pris, travaux suivis et réceptionnés. Vous validez, nous "
         "faisons le reste."),
        ("Clés et accès",
         "Boîte sécurisée ou serrure connectée, remise en main propre quand il le faut, registre de "
         "qui est entré et quand."),
        ("Prête à votre arrivée",
         "Lits faits, frigo rempli si vous le demandez, température réglée : la maison vous attend "
         "au lieu de l'inverse."),
        ("Paperasse de la location",
         "Déclaration du meublé, taxe de séjour, information du syndic, classement si vous le "
         "souhaitez : nous montons les dossiers avec vous."),
        ("Au-delà du logement",
         "Un chauffeur, une table, un séjour à organiser pour des proches : la conciergerie privée "
         "Label Maison répond aussi à ces demandes."),
    ],
    [
        ("Veille sur le bien inoccupé",
         "Une résidence vide se dégrade sans bruit. Nos passages réguliers repèrent la fuite, le volet "
         "cassé ou le courrier qui déborde avant que cela ne coûte."),
        ("Coordination des interventions",
         "Jardin, piscine, ménage, réparations : un seul interlocuteur organise, contrôle et vous "
         "rend compte."),
        ("Accueil de vos invités",
         "Famille, amis ou locataires de passage sont accueillis sur place, avec les consignes de la "
         "maison et un numéro à appeler."),
        ("Ouverture et fermeture de saison",
         "Remise en route au printemps, hivernage à l'automne : eau, chauffage, électroménager, "
         "literie, tout est vérifié."),
        ("Obligations du loueur",
         "Numéro d'enregistrement, taxe de séjour, règlement de copropriété : nous vérifions ce que "
         "votre commune impose et nous nous en occupons."),
        ("Services de conciergerie privée",
         "Réservations, déplacements, personnel de maison ponctuel : le reste de notre métier reste "
         "à votre disposition."),
    ],
]

# --------------------------------------------------------------------------- #
#  Pourquoi nous (4 cartes)
# --------------------------------------------------------------------------- #
POURQUOI = [
    [
        ("Un interlocuteur unique",
         "Une seule personne suit votre bien, connaît son histoire et vous répond. Pas de plateforme "
         "anonyme ni de numéro de dossier."),
        ("Rémunérés au résultat",
         "Une commission sur les revenus encaissés, sans abonnement ni frais d'entrée. Un calendrier "
         "vide ne nous rapporte rien non plus."),
        ("Courte durée, moyenne durée, ou les deux",
         "Selon la réglementation locale et la saison, nous arbitrons entre nuitée touristique et bail "
         "mobilité pour maximiser le revenu annuel."),
        ("Votre bien protégé",
         "Sélection des voyageurs, état des lieux photo à chaque rotation, suivi de l'usure : nous "
         "traitons votre logement comme s'il était le nôtre."),
    ],
    [
        ("On vous dit non quand il faut",
         "Un bien non déclaré, une copropriété qui interdit, un DPE qui bloque : nous le disons avant "
         "de signer, pas après le premier litige."),
        ("Des chiffres, pas des promesses",
         "L'estimation part des annonces réellement louées autour de chez vous. Si le marché ne "
         "justifie pas la courte durée, nous proposons autre chose."),
        ("Vous gardez votre logement",
         "Vos dates restent vos dates. Vous bloquez le calendrier quand vous voulez, sans "
         "justification ni pénalité."),
        ("Un contrat qu'on peut quitter",
         "Pas d'engagement de durée : si le service ne vous convient pas, vous partez avec votre "
         "annonce et son historique."),
    ],
    [
        ("Le détail qui fait la note",
         "Linge repassé, lumière réglée, mot d'accueil : les avis cinq étoiles se gagnent sur ce que "
         "le voyageur remarque sans le dire."),
        ("La réglementation d'abord",
         "Numéro d'enregistrement, plafond de nuitées, taxe de séjour, règlement de copropriété : "
         "tout est vérifié avant la première réservation."),
        ("Un revenu lisible",
         "Chaque mois, ce que le bien a rapporté, ce qu'il a coûté, ce qui a changé. Un relevé que "
         "votre comptable peut utiliser tel quel."),
        ("Payés quand vous l'êtes",
         "Notre commission ne porte que sur les séjours encaissés. Pas de frais fixes, pas de "
         "surprise."),
    ],
]

# --------------------------------------------------------------------------- #
#  Comment nous démarrons (4 étapes)
# --------------------------------------------------------------------------- #
ETAPES = [
    [
        ("1. Étude de votre bien",
         "Visite sur place ou à distance, analyse des logements réellement loués autour de vous, "
         "estimation de revenus argumentée — gratuite et sans engagement."),
        ("2. Préparation",
         "Ajustements d'aménagement, équipements manquants, photos professionnelles."),
        ("3. Mise en marché",
         "Annonce rédigée pour la recherche, diffusion multi-plateformes, prix et durées minimales "
         "paramétrés."),
        ("4. Exploitation",
         "Voyageurs, ménage, maintenance, avis, reporting mensuel : vous n'avez plus rien à faire."),
    ],
    [
        ("1. On regarde les chiffres",
         "Les annonces réellement louées dans votre secteur, leur prix, leur occupation : vous "
         "recevez une fourchette de revenus et nos réserves, s'il y en a."),
        ("2. On vérifie les règles",
         "Déclaration, numéro, plafond de nuitées, copropriété, DPE : rien n'est mis en ligne avant "
         "d'être en règle."),
        ("3. On prépare le logement",
         "Ce qui manque, ce qui gêne, ce qui se voit en photo. Puis le shooting et l'annonce."),
        ("4. On gère, vous suivez",
         "Réservations, arrivées, ménages, incidents et avis sont pris en charge ; vous lisez un "
         "relevé mensuel et vous bloquez vos dates quand vous voulez."),
    ],
    [
        ("1. Un premier échange",
         "Dix minutes au téléphone pour comprendre le bien, vos attentes et vos dates. Puis une "
         "estimation écrite, gratuite."),
        ("2. Le dossier",
         "Démarches en mairie, classement éventuel, assurance, règlement de copropriété : le "
         "dossier est monté avec vous."),
        ("3. L'annonce",
         "Photos, texte, règles de la maison, grille de prix et durées minimales : le logement est "
         "présenté comme un produit, pas comme une annonce de particulier."),
        ("4. La saison",
         "Voyageurs accueillis, ménages enchaînés, prix ajustés, avis suivis. Chaque mois, un point "
         "clair sur ce que le bien a rapporté."),
    ],
]

# --------------------------------------------------------------------------- #
#  Questions fréquentes génériques (4 questions) — le nom de la commune est inséré
# --------------------------------------------------------------------------- #
def faq_generique(nom: str, v: int) -> list:
    jeux = [
        [
            (f"Que fait exactement une conciergerie à {nom} ?",
             "Deux métiers complémentaires. Pour un propriétaire qui loue : annonce, photos, "
             "tarification, accueil des voyageurs, ménage, linge, maintenance et suivi des revenus. "
             "Pour un propriétaire qui ne loue pas : entretien et surveillance du bien, coordination "
             "des prestataires et préparation avant chaque séjour."),
            (f"Combien coûte votre conciergerie à {nom} ?",
             "En location, une commission sur les revenus réellement encaissés — sans abonnement ni "
             "frais d'entrée. En gestion de résidence secondaire, un forfait selon la fréquence des "
             "visites et l'étendue des prestations. Tout est chiffré à l'avance."),
            (f"Quelle rentabilité peut-on espérer à {nom} ?",
             f"Cela dépend de l'adresse exacte, de la surface, de l'équipement et de la période. Nous "
             f"ne donnons jamais de rendement au hasard : l'estimation est établie à partir de "
             f"logements comparables réellement loués dans le secteur de {nom}, charges déduites."),
            ("Puis-je continuer à utiliser mon logement ?",
             "Oui, autant que vous le souhaitez. Vous bloquez vos dates dans le calendrier ; nous ne "
             "gérons que les périodes que vous ouvrez à la location."),
        ],
        [
            (f"Concrètement, que prenez-vous en charge à {nom} ?",
             "Tout ce qui se passe entre deux séjours et pendant : l'annonce et ses photos, les "
             "prix, les messages des voyageurs, l'arrivée, le ménage et le linge, les petites "
             "réparations, les avis, puis le relevé mensuel. Pour un bien que vous n'ouvrez pas à la "
             "location, nous assurons la surveillance et l'intendance."),
            (f"Quel est le prix de la gestion à {nom} ?",
             "Un pourcentage des revenus encaissés, connu d'avance, sans frais fixes. Si le bien ne "
             "loue pas, nous ne facturons rien. Pour l'entretien d'une résidence sans location, un "
             "forfait calé sur la fréquence des passages."),
            (f"Combien rapporte un meublé à {nom} ?",
             f"La réponse honnête est : cela dépend du logement, et nous le mesurons. Nous comparons "
             f"votre bien aux annonces réellement louées à {nom}, nous déduisons les charges et nous "
             f"vous donnons une fourchette, pas un chiffre rond trouvé sur internet."),
            ("Est-ce que je perds l'usage de mon logement ?",
             "Non. Le calendrier reste à vous : vous bloquez les semaines où vous venez, et nous "
             "louons le reste. Beaucoup de propriétaires gardent l'été ou les fêtes pour eux."),
        ],
        [
            (f"À {nom}, par quoi commence votre travail ?",
             "Par une estimation écrite fondée sur les locations réelles du secteur, puis par la "
             "vérification des règles de la commune. Ensuite seulement viennent les photos, "
             "l'annonce, les prix, l'accueil, le ménage et le suivi mensuel."),
            (f"Comment êtes-vous payés à {nom} ?",
             "Sur les séjours encaissés, par une commission fixée dans le contrat. Aucun "
             "abonnement, aucun frais de mise en service caché : les frais de ménage sont facturés "
             "au voyageur, comme partout."),
            (f"Pouvez-vous garantir un revenu à {nom} ?",
             f"Non, et méfiez-vous de ceux qui le font. Nous donnons une fourchette argumentée à "
             f"partir des biens comparables loués à {nom}, et nous vous disons si la courte durée "
             f"n'est pas le bon choix pour votre logement."),
            ("Et si je veux reprendre mon logement ?",
             "Vous bloquez les dates que vous voulez, et vous pouvez arrêter la gestion sans "
             "engagement de durée. Votre annonce et ses avis vous suivent."),
        ],
    ]
    return jeux[v % 3]


# --------------------------------------------------------------------------- #
#  Phrases des données locales (variantes courtes)
# --------------------------------------------------------------------------- #
COLLECTE = [
    "Quand la réservation passe par Airbnb ou Booking, la plateforme collecte et reverse la taxe "
    "pour vous ; en direct, c'est au loueur de la déclarer.",
    "Sur Airbnb et Booking, la taxe est ajoutée au prix et reversée par la plateforme ; pour une "
    "réservation en direct, le loueur la collecte et la déclare lui-même.",
    "Les plateformes la prélèvent et la reversent à la collectivité ; seules les locations en "
    "direct vous obligent à la déclarer vous-même.",
]

REGLES_ABSENTES = [
    lambda nom: (f"Nous n'avons pas relevé de délibération propre à {nom} sur le changement d'usage ou "
                 f"le numéro d'enregistrement : la règle nationale s'applique (déclaration en mairie, "
                 f"120 nuits par an au plus pour une résidence principale, taxe de séjour). Nous le "
                 f"vérifions auprès de la mairie avant toute mise en ligne, car une commune peut "
                 f"délibérer à tout moment."),
    lambda nom: (f"Aucune règle locale spécifique n'a été relevée pour {nom} à ce jour : s'appliquent "
                 f"donc la déclaration en mairie, le plafond de 120 nuits pour une résidence "
                 f"principale et la taxe de séjour. Une délibération peut intervenir à tout moment ; "
                 f"nous le vérifions auprès de la mairie avant de mettre un bien en ligne."),
    lambda nom: (f"À notre connaissance, {nom} n'a pas instauré de changement d'usage ni de numéro "
                 f"d'enregistrement propre : c'est le droit commun qui s'applique, avec la déclaration "
                 f"en mairie, la limite de 120 nuits pour la résidence principale et la taxe de "
                 f"séjour. Ce point est reconfirmé auprès de la mairie avant toute location."),
]
