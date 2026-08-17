# -*- coding: utf-8 -*-
"""Articles de blog — exploitation d'un meublé et choix d'une conciergerie.

Aucun chiffre de performance n'est avancé : ni « +35 % de revenus », ni taux
d'occupation moyen inventé. On parle méthode, arbitrages et coûts réels.
"""
from __future__ import annotations

ARTICLES = [
    dict(
        slug="photos-annonce-airbnb",
        cat="Exploitation", crumb="Les photos",
        title="Les photos d'une annonce : ce qui déclenche vraiment la réservation",
        h1="Les photos : le seul poste où l'on ne devrait jamais économiser",
        desc="Photo de couverture, ordre des vues, lumière, cadrage, home staging : ce qui fait "
             "qu'une annonce est cliquée ou ignorée, et les erreurs qui coûtent le plus de "
             "réservations.",
        date="2026-02-11", date_txt="11 février 2026", lecture=6,
        lead="Un voyageur balaie une page de résultats en quelques secondes. À ce stade, il ne lit "
             "pas votre description : il regarde une vignette et un prix. Tout le reste de votre "
             "travail dépend de cette image.",
        sections=[
            ("La photo de couverture décide de tout", [
                "<p>C'est la seule image visible dans les résultats de recherche. Elle doit "
                "montrer <strong>la meilleure pièce du logement, en pleine lumière, rangée</strong> "
                "— et si le bien a un atout rare (vue, terrasse, piscine, cheminée), c'est lui "
                "qu'on met en couverture, pas le salon.</p>",
                "<p>Erreur la plus fréquente : ouvrir sur une photo d'extérieur d'immeuble, ou "
                "sur une chambre sombre. Le voyageur ne se projette pas, il passe à l'annonce "
                "suivante.</p>",
            ]),
            ("L'ordre raconte une histoire", [
                "<p>Une fois l'annonce ouverte, les photos se parcourent dans l'ordre. Celui qui "
                "fonctionne le mieux suit le trajet d'un occupant :</p>",
                "<ol>"
                "<li>la pièce à vivre, vue large ;</li>"
                "<li>l'atout différenciant : terrasse, vue, extérieur ;</li>"
                "<li>la ou les chambres, lit fait, linge repassé ;</li>"
                "<li>la cuisine, plan de travail dégagé ;</li>"
                "<li>la salle de bain, propre et sans effets personnels ;</li>"
                "<li>les détails qui rassurent : espace de travail, équipements, entrée.</li>"
                "</ol>",
                "<p>Chaque photo doit ajouter une information. Trois angles du même canapé "
                "fatiguent et donnent l'impression qu'on cache le reste.</p>",
            ]),
            ("Les règles techniques qui changent le résultat", [
                "<ul>"
                "<li><strong>Lumière du jour</strong>, volets ouverts, lumières d'appoint allumées "
                "pour équilibrer.</li>"
                "<li><strong>Format horizontal</strong>, hauteur de prise de vue à mi-corps, "
                "appareil de niveau : les verticales de travers donnent un rendu amateur "
                "immédiat.</li>"
                "<li><strong>Grand angle mesuré.</strong> Un objectif trop large déforme et gonfle "
                "artificiellement les volumes : le voyageur le voit à l'arrivée, et il le dit dans "
                "son avis.</li>"
                "<li><strong>Aucun effet personnel visible</strong> : produits de douche, photos "
                "de famille, chargeurs, poubelles.</li>"
                "</ul>",
            ]),
            ("Le home staging, avant même le photographe", [
                "<p>Une bonne photo ne rattrape pas un intérieur mal préparé. Avant la séance, "
                "nous faisons systématiquement : désencombrer, harmoniser le linge de lit — blanc, "
                "de préférence —, ajouter deux ou trois points de couleur, dégager les surfaces, "
                "et remplacer ce qui est visiblement fatigué.</p>",
                "<p>Le coût de cette préparation est faible comparé à ce qu'elle change sur le "
                "prix par nuit atteignable — voir "
                "<a href=\"/equipements-qui-augmentent-le-prix\">les équipements qui font monter "
                "le prix</a>.</p>",
            ]),
            ("Faut-il un photographe professionnel ?", [
                "<p>Oui, dans l'immense majorité des cas. C'est un investissement ponctuel qui "
                "sert pendant des années et sur toutes les plateformes à la fois.</p>",
                "<p>Si vous photographiez vous-même : trépied, lumière naturelle de milieu de "
                "journée, appareil de niveau, et surtout un tri sévère. Dix excellentes photos "
                "valent mieux que trente moyennes.</p>",
                "<p>Nous intégrons le shooting à la mise en gestion, précisément parce que c'est "
                "le poste où le retour est le plus rapide.</p>",
            ]),
        ],
        faq=[
            ("Combien de photos faut-il ?",
             "Une vingtaine bien choisies suffisent : toutes les pièces, les extérieurs et les "
             "équipements différenciants. Au-delà, on dilue plus qu'on informe."),
            ("Faut-il montrer les défauts du logement ?",
             "Il ne faut jamais les masquer. Un voyageur qui découvre à l'arrivée un défaut caché "
             "le mentionne dans son avis — et un avis pèse plus lourd qu'une réservation."),
            ("À quelle fréquence refaire les photos ?",
             "Après tout changement notable de décoration ou d'équipement, et globalement tous les "
             "deux à trois ans. Un intérieur daté se repère immédiatement."),
            ("Les photos au grand angle sont-elles un problème ?",
             "Utilisées avec mesure, non. Poussées trop loin, elles créent un décalage entre "
             "l'annonce et la réalité, qui se paie en commentaires."),
        ],
        related=[("Les équipements qui font monter le prix", "/equipements-qui-augmentent-le-prix"),
                 ("Obtenir de bons avis", "/obtenir-de-bons-avis-airbnb"),
                 ("Tarification dynamique", "/tarification-dynamique-airbnb"),
                 ("Notre gestion clé en main", "/proprietaires")],
    ),

    dict(
        slug="equipements-qui-augmentent-le-prix",
        cat="Exploitation", crumb="Les équipements",
        title="Les équipements qui font monter le prix par nuit",
        h1="Les équipements qui font vraiment monter le prix par nuit",
        desc="Literie, wifi, climatisation, cuisine, espace de travail : les équipements qui "
             "agissent réellement sur le prix et le taux d'occupation d'un meublé, et ceux qui ne "
             "servent à rien.",
        date="2026-02-25", date_txt="25 février 2026", lecture=6,
        lead="Tous les équipements ne se valent pas. Certains sont des filtres de recherche — ils "
             "décident si votre annonce est même vue. D'autres sont des arguments de prix. "
             "Beaucoup, enfin, ne servent qu'à vider votre budget.",
        sections=[
            ("Les filtres de recherche : ils décident si on vous voit", [
                "<p>Sur les plateformes, le voyageur coche des critères, et votre annonce sort ou "
                "ne sort pas. Ces équipements-là ne se négocient pas :</p>",
                "<ul>"
                "<li><strong>Wifi</strong>, et un vrai débit : c'est le premier critère filtré, "
                "loisirs comme affaires.</li>"
                "<li><strong>Lave-linge</strong>, décisif au-delà de trois nuits.</li>"
                "<li><strong>Cuisine équipée</strong> réellement utilisable : plaques, four ou "
                "micro-ondes, réfrigérateur, vaisselle en nombre.</li>"
                "<li><strong>Climatisation</strong> dans le Sud, <strong>chauffage efficace</strong> "
                "partout ailleurs.</li>"
                "<li><strong>Parking</strong> là où il est rare : en périphérie et près des "
                "aéroports, c'est un argument massif.</li>"
                "</ul>",
                "<p>Ne pas cocher une de ces cases, c'est disparaître d'une partie des recherches "
                "avant même la question du prix.</p>",
            ]),
            ("Ce qui justifie un prix plus élevé", [
                "<ul>"
                "<li><strong>Une literie de qualité.</strong> C'est le premier sujet des avis. Un "
                "bon matelas et du linge épais valent plus que n'importe quel élément de "
                "décoration.</li>"
                "<li><strong>Un vrai espace de travail</strong> : bureau, chaise correcte, prises "
                "accessibles. Indispensable en ville et près des pôles d'activité.</li>"
                "<li><strong>Un extérieur</strong>, même minuscule : balcon, cour, terrasse. Le "
                "gain de prix est disproportionné par rapport à sa taille.</li>"
                "<li><strong>Le confort de la salle de bain</strong> : pression d'eau, douche "
                "correcte, serviettes en quantité.</li>"
                "<li><strong>L'insonorisation</strong>, invisible en photo, décisive dans les "
                "commentaires.</li>"
                "</ul>",
            ]),
            ("Ce qui ne sert presque à rien", [
                "<p>La décoration très marquée, qui plaît à quelques-uns et fait fuir les autres. "
                "Les objets fragiles. La télévision haut de gamme, rarement citée dans les avis. "
                "Les gadgets connectés qui deviennent un problème d'assistance dès qu'ils "
                "cessent de fonctionner.</p>",
                "<p>Règle simple : investissez dans ce qui se ressent la nuit et le matin — "
                "dormir, se doucher, prendre un café — avant ce qui se voit sur une photo.</p>",
            ]),
            ("Les détails qui font les avis cinq étoiles", [
                "<ul>"
                "<li>rangements réellement disponibles, cintres en nombre ;</li>"
                "<li>rideaux occultants dans les chambres ;</li>"
                "<li>multiprises et chargeurs près des lits ;</li>"
                "<li>produits d'accueil corrects, papier toilette en réserve visible ;</li>"
                "<li>un livret clair : wifi, chauffage, poubelles, transports, deux ou trois bonnes "
                "adresses du quartier.</li>"
                "</ul>",
                "<p>Ces détails ne coûtent presque rien et pèsent beaucoup dans la note — laquelle "
                "détermine votre visibilité future. Voir "
                "<a href=\"/obtenir-de-bons-avis-airbnb\">notre article sur les avis</a>.</p>",
            ]),
            ("Adapter à la clientèle réelle du secteur", [
                "<p>Un logement près d'un aéroport n'a pas les mêmes priorités qu'une villa "
                "familiale : rideaux occultants, accès autonome et parking priment sur la "
                "décoration. Près d'un campus ou d'une technopole, l'espace de travail et le débit "
                "internet passent devant tout le reste.</p>",
                "<p>C'est ce qui explique nos recommandations très différentes d'une commune à "
                "l'autre — comparez par exemple nos pages "
                "<a href=\"/conciergerie-airbnb-orly-aeroport\">aéroport d'Orly</a> et "
                "<a href=\"/conciergerie-cote-d-azur\">Côte d'Azur</a>.</p>",
            ]),
        ],
        faq=[
            ("Faut-il meubler haut de gamme ?",
             "Non : il faut meubler robuste et confortable. En courte durée, le mobilier fragile "
             "ne survit pas, et le luxe décoratif se remarque moins qu'un bon matelas."),
            ("La climatisation est-elle indispensable ?",
             "Dans le Sud et dans les logements sous les toits, elle est devenue un critère de "
             "réservation en été. Ailleurs, un bon ventilateur suffit souvent."),
            ("Le parking vaut-il l'investissement ?",
             "Là où il est rare, oui : c'est un filtre de recherche et un argument de prix, "
             "notamment près des aéroports, des gares et des centres-villes denses."),
            ("Combien prévoir pour l'ameublement d'un studio ?",
             "Cela dépend entièrement de l'état initial et du niveau visé. Nous chiffrons "
             "l'ameublement poste par poste dans nos estimations, plutôt que d'annoncer un "
             "forfait qui ne voudrait rien dire."),
        ],
        related=[("Les photos qui déclenchent la réservation", "/photos-annonce-airbnb"),
                 ("Obtenir de bons avis", "/obtenir-de-bons-avis-airbnb"),
                 ("Les charges réelles", "/charges-location-courte-duree"),
                 ("Estimation gratuite", "/estimation-rentabilite-airbnb")],
    ),

    dict(
        slug="tarification-dynamique-airbnb",
        cat="Exploitation", crumb="Tarification dynamique",
        title="Tarification dynamique : la méthode pour fixer ses prix",
        h1="Tarification dynamique : arrêter de fixer un prix et l'oublier",
        desc="Prix de base, saisonnalité, événements locaux, durées minimales, dernière minute : "
             "la méthode complète pour piloter les tarifs d'une location courte durée tout au long "
             "de l'année.",
        date="2026-03-11", date_txt="11 mars 2026", lecture=7,
        lead="Un tarif fixe toute l'année, c'est laisser de l'argent sur la table en haute saison "
             "et un calendrier vide le reste du temps. Le prix n'est pas une donnée : c'est un "
             "outil de pilotage.",
        sections=[
            ("Poser un prix de base réaliste", [
                "<p>Le prix de base n'est pas votre prix cible : c'est le prix d'un jour ordinaire, "
                "hors vacances et hors événement. On l'établit en observant des biens réellement "
                "comparables — même quartier, même capacité, même niveau — <strong>et dont le "
                "calendrier se remplit</strong>.</p>",
                "<p>Une annonce chère au calendrier vide n'est pas une référence de prix, c'est "
                "un contre-exemple.</p>",
            ]),
            ("Construire un calendrier, pas un tarif", [
                "<p>Le travail consiste ensuite à moduler ce prix de base, semaine par semaine, "
                "selon quatre facteurs :</p>",
                "<ul>"
                "<li><strong>la saison</strong> propre à votre ville — et elle n'a rien d'universel : "
                "février est la meilleure période à Menton pendant la Fête du Citron, la pire "
                "ailleurs sur la Côte ;</li>"
                "<li><strong>les vacances scolaires</strong>, françaises mais aussi européennes "
                "pour les destinations qui attirent des Britanniques, des Néerlandais ou des "
                "Espagnols ;</li>"
                "<li><strong>les événements locaux</strong> : salons, congrès, festivals, matchs, "
                "régates ;</li>"
                "<li><strong>le jour de la semaine</strong> : en ville d'affaires, la semaine se "
                "vend mieux que le week-end ; en ville touristique, c'est l'inverse.</li>"
                "</ul>",
            ]),
            ("Les événements : là où se fait la marge", [
                "<p>Quelques dizaines de nuits par an font souvent une part disproportionnée du "
                "revenu annuel. Un salon à Paris Nord Villepinte, un concert au Stade de France, "
                "le Festival de Cannes, les Fêtes de Bayonne, le marché de Noël de Strasbourg, le "
                "Grand Prix de Monaco : ces dates se préparent des mois à l'avance.</p>",
                "<p>Trois réflexes :</p>",
                "<ul>"
                "<li>ouvrir le calendrier très en amont sur ces périodes ;</li>"
                "<li>relever le tarif <strong>avant</strong> que la ville affiche complet, pas "
                "après ;</li>"
                "<li>imposer une durée minimale de séjour pour éviter qu'une nuit isolée à bas "
                "prix ne bloque toute la semaine.</li>"
                "</ul>",
                "<p>C'est précisément le travail que nous documentons commune par commune dans nos "
                "pages locales.</p>",
            ]),
            ("Les durées minimales, levier sous-estimé", [
                "<p>Allonger la durée minimale de séjour réduit le nombre de rotations, donc les "
                "frais de ménage et de linge — voir "
                "<a href=\"/charges-location-courte-duree\">les charges réelles</a>. À revenu brut "
                "équivalent, un séjour de six nuits laisse nettement plus qu'un enchaînement de "
                "deux séjours de trois nuits.</p>",
                "<p>À l'inverse, en basse saison, raccourcir la durée minimale permet de capter "
                "les séjours d'une ou deux nuits qui, autrement, iraient à l'hôtel.</p>",
            ]),
            ("La dernière minute : baisser, mais pas n'importe comment", [
                "<p>Une nuit vide ne rapporte rien : à l'approche de la date, une baisse "
                "progressive est rationnelle. Mais elle doit rester maîtrisée, pour trois "
                "raisons : elle attire une clientèle plus difficile, elle habitue le marché à "
                "attendre, et elle abîme votre positionnement.</p>",
                "<p>La bonne pratique : des réductions progressives et automatiques à trois "
                "semaines puis une semaine, et un plancher en dessous duquel on n'accepte pas — "
                "un séjour à perte, une fois le ménage payé, n'a aucun intérêt.</p>",
            ]),
            ("Un outil ne remplace pas une décision", [
                "<p>Les outils de tarification automatique sont utiles pour suivre le marché au "
                "jour le jour, mais ils ignorent ce qui ne figure pas dans leurs données : un "
                "salon qui change de dates, des travaux dans la rue, une réglementation nouvelle.</p>",
                "<p>Notre méthode combine les deux : l'outil pour la tendance, la connaissance "
                "locale pour les décisions qui comptent.</p>",
            ]),
        ],
        faq=[
            ("Faut-il utiliser un outil de tarification automatique ?",
             "Il aide à suivre la tendance du marché, mais il ne connaît pas le calendrier "
             "événementiel réel de votre rue. Utilisez-le comme une aide, pas comme un pilote "
             "automatique."),
            ("Vaut-il mieux baisser le prix ou attendre ?",
             "Cela dépend du délai. Loin de la date, tenir son prix est généralement payant ; à "
             "quelques jours, une nuit vide ne rapporte rien — mais jamais en dessous du coût du "
             "ménage."),
            ("Comment gérer les week-ends ?",
             "En ville touristique, vendredi et samedi se tarifent plus cher. En ville d'affaires, "
             "c'est la semaine qui porte la demande. Observez vos propres réservations avant de "
             "recopier une règle générale."),
            ("Les frais de ménage doivent-ils être élevés ?",
             "Ils doivent couvrir le coût réel sans écraser le prix total affiché pour les séjours "
             "courts, sous peine de faire fuir les réservations de deux nuits."),
        ],
        related=[("Les charges réelles", "/charges-location-courte-duree"),
                 ("Calculer sa rentabilité", "/calculer-rentabilite-location-courte-duree"),
                 ("Le plafond de 120 nuits", "/plafond-120-nuits-residence-principale"),
                 ("Simulateur de revenus", "/simulateur-revenus-airbnb")],
    ),

    dict(
        slug="obtenir-de-bons-avis-airbnb",
        cat="Exploitation", crumb="Les avis",
        title="Obtenir de bons avis : pourquoi ça vaut de l'argent",
        h1="Les avis : la monnaie réelle de la location courte durée",
        desc="Ce qui déclenche un bon ou un mauvais avis, comment les prévenir, comment répondre "
             "à une critique, et pourquoi la note conditionne la visibilité et donc le prix.",
        date="2026-04-01", date_txt="1er avril 2026", lecture=6,
        lead="Un avis n'est pas un compliment : c'est un actif. Il détermine votre position dans "
             "les résultats, donc le nombre de personnes qui voient votre annonce, donc le prix "
             "que vous pouvez demander.",
        sections=[
            ("Ce qui déclenche un mauvais avis", [
                "<p>Presque jamais ce que redoutent les propriétaires. Dans la pratique, les "
                "critiques portent sur :</p>",
                "<ul>"
                "<li><strong>la propreté</strong>, de loin le premier motif — et l'exigence est "
                "hôtelière, pas domestique ;</li>"
                "<li><strong>l'écart entre l'annonce et la réalité</strong> : surface, vue, bruit, "
                "équipement annoncé mais absent ;</li>"
                "<li><strong>un problème non résolu</strong> pendant le séjour — un chauffe-eau en "
                "panne dont personne ne s'occupe ;</li>"
                "<li><strong>la lenteur des réponses</strong> ;</li>"
                "<li><strong>le bruit</strong>, quand il n'a pas été annoncé.</li>"
                "</ul>",
                "<p>Trois de ces cinq motifs se règlent uniquement par de l'organisation.</p>",
            ]),
            ("La règle la plus rentable : ne jamais survendre", [
                "<p>Un logement modeste, décrit honnêtement et impeccablement tenu, obtient de "
                "meilleures notes qu'un logement supérieur survendu. L'avis mesure l'écart entre "
                "l'attente et le réel, pas la qualité absolue.</p>",
                "<p>Conséquence pratique : annoncez le troisième étage sans ascenseur, la rue "
                "animée le samedi soir, la vue partielle. Vous perdrez quelques réservations "
                "inadaptées et vous gagnerez des étoiles.</p>",
            ]),
            ("L'accueil et la réactivité", [
                "<p>Le moment de l'arrivée pèse lourd. Un check-in fluide — instructions claires, "
                "accès qui fonctionne, quelqu'un de joignable — pose le ton du séjour.</p>",
                "<p>Pendant le séjour, un message doit obtenir une réponse rapide. Un problème "
                "traité vite se transforme souvent en compliment dans l'avis ; le même problème "
                "ignoré devient une note à trois étoiles. C'est pour cette raison que nous "
                "maintenons une assistance en continu sur les biens que nous gérons.</p>",
            ]),
            ("Répondre à une critique", [
                "<p>Un avis négatif n'est pas une catastrophe : c'est une occasion de montrer "
                "comment vous réagissez, devant tous les futurs voyageurs.</p>",
                "<ul>"
                "<li>Répondez brièvement, sans polémique.</li>"
                "<li>Reconnaissez ce qui est vrai.</li>"
                "<li>Dites ce que vous avez corrigé depuis.</li>"
                "<li>N'attaquez jamais le voyageur : le lecteur se range instinctivement de son "
                "côté.</li>"
                "</ul>",
                "<p>Une réponse posée sous un avis sévère rassure davantage qu'une succession "
                "d'avis parfaits.</p>",
            ]),
            ("Demander l'avis, sans le forcer", [
                "<p>Un message court après le départ, remerciant et invitant à laisser un "
                "commentaire, suffit. Ce qu'il ne faut pas faire : réclamer explicitement cinq "
                "étoiles, ou négocier une note contre un geste commercial. Les plateformes le "
                "sanctionnent, et les voyageurs le prennent mal.</p>",
                "<p>Nous ne sollicitons jamais d'avis de complaisance, et nous n'en publions aucun "
                "que nous n'aurions pas reçu — c'est aussi vrai sur ce site que sur les "
                "plateformes.</p>",
            ]),
        ],
        faq=[
            ("Un mauvais avis peut-il être supprimé ?",
             "Seulement s'il enfreint les règles de la plateforme — propos injurieux, chantage, "
             "avis sans lien avec le séjour. Un avis simplement sévère mais sincère ne sera pas "
             "retiré."),
            ("La note influence-t-elle vraiment la visibilité ?",
             "Oui : les plateformes classent les annonces en tenant compte de la satisfaction et "
             "de la réactivité. Une note qui baisse fait mécaniquement baisser le nombre de vues."),
            ("Faut-il laisser un avis sur le voyageur ?",
             "Oui, honnêtement. C'est ce qui permet à l'ensemble des propriétaires de sélectionner "
             "correctement les séjours suivants."),
            ("Comment éviter les fêtes ?",
             "Durée minimale de séjour plus longue, sélection des réservations, accueil en "
             "personne, règlement intérieur explicite et voisinage informé de qui appeler."),
        ],
        related=[("Les photos", "/photos-annonce-airbnb"),
                 ("Les équipements", "/equipements-qui-augmentent-le-prix"),
                 ("Dégradations et incidents", "/degradations-incidents-location"),
                 ("Notre gestion clé en main", "/proprietaires")],
    ),

    dict(
        slug="degradations-incidents-location",
        cat="Exploitation", crumb="Dégradations et incidents",
        title="Dégradations et incidents : comment on les gère vraiment",
        h1="Dégradations, pannes, fêtes : ce qu'on fait quand ça arrive",
        desc="Prévention, état des lieux photo, caution, assurance, garanties des plateformes : la "
             "marche à suivre quand un séjour tourne mal, et comment limiter le risque en amont.",
        date="2026-04-15", date_txt="15 avril 2026", lecture=6,
        lead="C'est la crainte numéro un des propriétaires qui hésitent à louer. Elle est "
             "légitime, mais elle se traite : la quasi-totalité des incidents graves se préviennent "
             "en amont, et les autres se règlent avec de la méthode.",
        sections=[
            ("Prévenir : la sélection en amont", [
                "<p>La plupart des sinistres sérieux — fête, sur-occupation, dégradation — "
                "viennent de réservations qu'on aurait pu refuser :</p>",
                "<ul>"
                "<li>réservation de dernière minute, pour une seule nuit, un samedi, par un profil "
                "sans historique et sans pièce d'identité vérifiée ;</li>"
                "<li>nombre de voyageurs annoncé inférieur à la réalité ;</li>"
                "<li>réservation locale, pour un logement situé dans la ville même du voyageur.</li>"
                "</ul>",
                "<p>Une durée minimale de séjour un peu plus longue et un accueil en personne "
                "suffisent à éliminer l'essentiel du risque.</p>",
            ]),
            ("L'état des lieux photo, à chaque rotation", [
                "<p>C'est la pièce maîtresse du dossier en cas de litige. Après chaque ménage, nos "
                "équipes photographient l'état du logement : c'est daté, horodaté, et cela permet "
                "de démontrer qu'un dommage est survenu pendant un séjour précis.</p>",
                "<p>Sans ce document, une réclamation auprès d'une plateforme ou d'un assureur est "
                "presque toujours perdue d'avance.</p>",
            ]),
            ("Que faire dans l'heure", [
                "<ol>"
                "<li><strong>Constater et documenter</strong> : photos, vidéos, témoignages.</li>"
                "<li><strong>Sécuriser</strong> : couper l'eau ou l'électricité si nécessaire, "
                "faire intervenir un artisan.</li>"
                "<li><strong>Notifier la plateforme</strong> dans les délais qu'elle impose, qui "
                "sont courts — c'est l'erreur la plus fréquente.</li>"
                "<li><strong>Chiffrer</strong> avec un devis, pas une estimation à la louche.</li>"
                "<li><strong>Déclarer à l'assurance</strong> si le montant le justifie.</li>"
                "</ol>",
                "<p>En cas de fête ou de trouble en cours, on ne se déplace pas seul et on ne "
                "confronte pas : on contacte les occupants, puis les autorités si nécessaire.</p>",
            ]),
            ("Caution, assurance, garanties : qui couvre quoi", [
                "<p><strong>La caution</strong> demandée via la plateforme couvre les petits "
                "dommages, dans des limites vite atteintes.</p>",
                "<p><strong>Les garanties des plateformes</strong> existent mais restent des "
                "protections conditionnelles, soumises à des délais et à des justificatifs "
                "stricts. Elles ne remplacent pas une assurance.</p>",
                "<p><strong>Votre assurance</strong> doit être adaptée à la location saisonnière. "
                "Une multirisque habitation classique peut refuser sa garantie au motif que le "
                "logement est loué à des tiers de passage : vérifiez votre contrat avant le "
                "premier voyageur, pas après le premier sinistre.</p>",
            ]),
            ("Ce que change une gestion professionnelle", [
                "<p>Le point décisif n'est pas d'éviter tout incident — c'est impossible — mais le "
                "délai de réaction. Un dégât des eaux traité dans l'heure coûte une intervention ; "
                "le même dégât découvert trois jours plus tard coûte un parquet, un plafond chez le "
                "voisin et un dossier d'assurance.</p>",
                "<p>C'est la raison pour laquelle nous travaillons avec des artisans locaux "
                "référencés sur chaque secteur, plutôt qu'avec un prestataire national joignable "
                "aux heures de bureau.</p>",
            ]),
        ],
        faq=[
            ("Faut-il demander une caution ?",
             "C'est utile pour les petits dommages et pour l'effet dissuasif. Elle ne couvre pas "
             "un sinistre important : l'assurance reste indispensable."),
            ("Les garanties des plateformes suffisent-elles ?",
             "Non. Ce sont des protections conditionnelles, avec des délais de déclaration courts "
             "et des exclusions. Elles complètent une assurance, elles ne la remplacent pas."),
            ("Que faire si une fête est en cours ?",
             "Contacter les occupants et, si nécessaire, les autorités. On ne se déplace pas seul "
             "pour interrompre une fête. Le meilleur traitement reste la prévention en amont."),
            ("Les dégradations sont-elles fréquentes ?",
             "Les dégradations sérieuses restent rares quand la sélection et l'accueil sont "
             "sérieux. L'usure accélérée, elle, est certaine : elle se provisionne."),
        ],
        related=[("Obtenir de bons avis", "/obtenir-de-bons-avis-airbnb"),
                 ("Copropriété et courte durée", "/copropriete-location-courte-duree"),
                 ("Les charges réelles", "/charges-location-courte-duree"),
                 ("Notre gestion clé en main", "/proprietaires")],
    ),

    dict(
        slug="combien-coute-une-conciergerie-airbnb",
        cat="Choisir une conciergerie", crumb="Combien ça coûte",
        title="Combien coûte une conciergerie Airbnb ? Les modèles expliqués",
        h1="Combien coûte une conciergerie Airbnb ?",
        desc="Commission sur les revenus, forfait, frais annexes, ménage refacturé : comment lire "
             "une offre de conciergerie, ce qui doit être inclus, et les coûts cachés à repérer "
             "avant de signer.",
        date="2026-05-06", date_txt="6 mai 2026", lecture=7,
        lead="La question arrive toujours en premier, et la réponse honnête commence par une "
             "autre question : que contient exactement le pourcentage annoncé ? Deux offres "
             "affichées au même taux peuvent laisser des revenus nets très différents.",
        sections=[
            ("Les trois modèles du marché", [
                "<ul>"
                "<li><strong>La commission sur les revenus encaissés.</strong> Le modèle "
                "dominant, et le nôtre : la conciergerie prélève un pourcentage de ce que le bien "
                "génère réellement. Si vous ne gagnez rien, elle ne gagne rien.</li>"
                "<li><strong>Le forfait mensuel.</strong> Un montant fixe, indépendant du "
                "résultat. Rassurant pour le prestataire, moins pour le propriétaire : le "
                "gestionnaire est payé même quand le calendrier est vide.</li>"
                "<li><strong>Le loyer garanti.</strong> L'entreprise vous verse un montant fixe et "
                "conserve la différence. La sécurité a un prix : le plafonnement de vos revenus "
                "quand la saison est bonne, et une dépendance forte à la solidité financière du "
                "prestataire.</li>"
                "</ul>",
            ]),
            ("Ce que le pourcentage doit inclure", [
                "<p>C'est là que se joue la comparaison réelle. Vérifiez ligne à ligne :</p>",
                "<ul>"
                "<li>création de l'annonce, photos professionnelles, diffusion multi-plateformes ;</li>"
                "<li>tarification et mise à jour du calendrier ;</li>"
                "<li>relation voyageurs avant, pendant et après le séjour ;</li>"
                "<li>accueil et remise des clés, y compris tardive ;</li>"
                "<li>coordination du ménage et du linge ;</li>"
                "<li>gestion des incidents et coordination des artisans ;</li>"
                "<li>reporting et éléments pour la comptabilité.</li>"
                "</ul>",
                "<p>Une offre à taux bas qui exclut l'accueil et la coordination technique n'est "
                "pas moins chère : elle est moins complète.</p>",
            ]),
            ("Les coûts qui s'ajoutent (et qui sont normaux)", [
                "<p><strong>Le ménage et le linge</strong> sont presque toujours facturés en plus, "
                "et refacturés au voyageur via les frais de ménage. C'est logique : ce sont des "
                "coûts variables liés au nombre de séjours.</p>",
                "<p><strong>Les fournitures et consommables</strong>, les petites réparations et "
                "les interventions d'artisans sont à votre charge : une conciergerie coordonne, "
                "elle ne finance pas votre bien.</p>",
                "<p><strong>Les commissions des plateformes</strong> sont prélevées en amont par "
                "Airbnb ou Booking, et n'ont rien à voir avec la conciergerie.</p>",
            ]),
            ("Les coûts cachés à repérer avant de signer", [
                "<ul>"
                "<li><strong>Frais de mise en service</strong> ou d'ouverture de dossier.</li>"
                "<li><strong>Durée d'engagement</strong> et préavis de résiliation : un an ferme "
                "n'est pas anodin.</li>"
                "<li><strong>Exclusivité</strong> : vous interdit-on de louer en direct ?</li>"
                "<li><strong>Commission sur les réservations que vous apportez vous-même.</strong></li>"
                "<li><strong>Marge sur les travaux</strong> et les interventions d'artisans.</li>"
                "<li><strong>Propriété de l'annonce</strong> : récupérez-vous votre historique "
                "d'avis si vous partez ? C'est le point le plus important, et le moins "
                "discuté.</li>"
                "</ul>",
                "<p>Voir aussi nos "
                "<a href=\"/questions-avant-de-choisir-une-conciergerie\">7 questions à poser "
                "avant de signer</a>.</p>",
            ]),
            ("Comment savoir si ça vaut le coup", [
                "<p>Le calcul est simple : comparez votre revenu net actuel, en gérant seul, au "
                "revenu net estimé avec la conciergerie, frais de gestion déduits.</p>",
                "<p>Une gestion professionnelle agit sur trois leviers — un meilleur taux "
                "d'occupation, un meilleur prix moyen, et moins de nuits perdues sur incidents. Si "
                "ces trois leviers ne compensent pas la commission, alors la délégation n'a pas de "
                "sens financier, et nous vous le dirons.</p>",
                "<p>Reste un quatrième terme, que chacun valorise à sa façon : le temps que vous "
                "récupérez. Notre article "
                "<a href=\"/gerer-seul-ou-deleguer-airbnb\">gérer seul ou déléguer</a> le "
                "chiffre.</p>",
            ]),
        ],
        faq=[
            ("Quel est votre taux de commission ?",
             "Il dépend du niveau de service et du rythme de rotation du bien. Il vous est indiqué "
             "par écrit dans la proposition, après l'étude de votre logement — sans abonnement ni "
             "frais d'entrée."),
            ("Le ménage est-il inclus dans la commission ?",
             "Non, c'est un coût variable lié au nombre de séjours, généralement refacturé au "
             "voyageur via les frais de ménage. Une offre qui prétend l'inclure l'a intégré "
             "ailleurs."),
            ("Faut-il s'engager sur une durée ?",
             "Chez nous, non : la relation tient parce qu'elle fonctionne, pas parce qu'un contrat "
             "vous retient. Vérifiez ce point systématiquement chez les prestataires que vous "
             "comparez."),
            ("Qui garde l'annonce et les avis en cas de départ ?",
             "Question essentielle : l'historique d'avis a une vraie valeur. Assurez-vous que "
             "l'annonce reste rattachée à votre compte."),
        ],
        related=[("7 questions avant de signer", "/questions-avant-de-choisir-une-conciergerie"),
                 ("Gérer seul ou déléguer", "/gerer-seul-ou-deleguer-airbnb"),
                 ("Les charges réelles", "/charges-location-courte-duree"),
                 ("Estimation gratuite", "/estimation-rentabilite-airbnb")],
    ),

    dict(
        slug="questions-avant-de-choisir-une-conciergerie",
        cat="Choisir une conciergerie", crumb="7 questions à poser",
        title="7 questions à poser avant de choisir une conciergerie",
        h1="Les 7 questions à poser avant de confier votre bien",
        desc="Contrat, exclusivité, propriété de l'annonce, délais d'intervention, équipes de "
             "ménage, reporting, assurance : les questions qui distinguent une conciergerie "
             "sérieuse d'un intermédiaire.",
        date="2026-05-20", date_txt="20 mai 2026", lecture=6,
        lead="Toutes les conciergeries promettent la même chose. Ces sept questions font "
             "apparaître la différence en une conversation — et vous verrez vite lesquelles y "
             "répondent sans détour.",
        sections=[
            ("1. Qui fait le ménage, exactement ?", [
                "<p>Équipe interne, prestataire dédié, ou plateforme de petites annonces ? La "
                "réponse en dit long. La propreté est le premier motif de mauvais avis : une "
                "conciergerie qui ne maîtrise pas son ménage ne maîtrise pas son produit.</p>",
                "<p>Question complémentaire : qui contrôle après le passage, et comment le "
                "prouve-t-on ?</p>",
            ]),
            ("2. En combien de temps intervenez-vous en cas de problème ?", [
                "<p>Un chauffe-eau en panne un dimanche, une serrure bloquée à 22 h. Demandez un "
                "délai concret et le nom des artisans partenaires du secteur. Une réponse vague "
                "signifie généralement qu'il n'y a pas de réseau local, seulement un standard "
                "téléphonique.</p>",
            ]),
            ("3. À qui appartient l'annonce et l'historique d'avis ?", [
                "<p>C'est la question la plus importante et la moins posée. Si l'annonce est "
                "hébergée sur le compte de la conciergerie, vous repartez sans vos avis le jour où "
                "vous changez de prestataire — c'est-à-dire en repartant de zéro.</p>",
            ]),
            ("4. Quelle est la durée d'engagement et le préavis ?", [
                "<p>Un engagement long est un aveu : le prestataire craint que vous partiez. "
                "Vérifiez aussi les conditions de sortie et le sort des réservations déjà "
                "confirmées.</p>",
            ]),
            ("5. Comment fixez-vous les prix, et qui décide ?", [
                "<p>Demandez à voir la logique : suivi des événements locaux, durées minimales, "
                "règles de dernière minute. Et surtout : pouvez-vous refuser une décision "
                "tarifaire ? Sur les biens que nous gérons, le propriétaire garde toujours la "
                "main sur son calendrier et ses prix planchers. Voir "
                "<a href=\"/tarification-dynamique-airbnb\">notre méthode</a>.</p>",
            ]),
            ("6. Que recevrai-je chaque mois ?", [
                "<p>Un récapitulatif lisible — revenus encaissés, dépenses, occupation, avis — "
                "utilisable tel quel pour votre comptabilité. Demandez à voir un exemple réel, "
                "anonymisé. Une conciergerie qui ne peut pas en montrer n'en produit "
                "probablement pas.</p>",
            ]),
            ("7. Vérifiez-vous la conformité réglementaire de mon bien ?", [
                "<p>Déclaration en mairie, numéro d'enregistrement, changement d'usage, "
                "règlement de copropriété. Une conciergerie qui met en ligne sans poser ces "
                "questions vous expose à une amende — et elle ne la paiera pas à votre place.</p>",
                "<p>Voir nos articles sur le "
                "<a href=\"/numero-enregistrement-meuble-tourisme\">numéro d'enregistrement</a> et "
                "le <a href=\"/changement-usage-meuble-tourisme\">changement d'usage</a>.</p>",
            ]),
            ("Et une huitième, en creux : que refusez-vous ?", [
                "<p>Une conciergerie qui accepte tous les biens, à toutes les conditions, dans "
                "toutes les villes, ne sélectionne rien — et ne pourra pas tenir le niveau de "
                "service promis. Savoir dire non est un critère de qualité.</p>",
            ]),
        ],
        faq=[
            ("Faut-il choisir une conciergerie locale ou nationale ?",
             "Ce qui compte n'est pas la taille mais la présence réelle sur votre secteur : "
             "équipes de ménage et artisans sur place, et un référent qui connaît votre bien."),
            ("Comment vérifier le sérieux d'une conciergerie ?",
             "Demandez des exemples concrets : un reporting réel, le nom des artisans partenaires, "
             "leur protocole de ménage et leur position sur la conformité réglementaire."),
            ("Peut-on tester sur une saison ?",
             "Oui, si le contrat n'impose pas d'engagement long. C'est d'ailleurs le meilleur "
             "moyen de comparer une promesse à un résultat."),
            ("Le moins cher est-il le bon choix ?",
             "Rarement. Une commission faible finance rarement un accueil en personne, un ménage "
             "contrôlé et une astreinte technique. Comparez ce qui est inclus, pas le taux."),
        ],
        related=[("Combien coûte une conciergerie ?", "/combien-coute-une-conciergerie-airbnb"),
                 ("Gérer seul ou déléguer", "/gerer-seul-ou-deleguer-airbnb"),
                 ("Notre offre de gestion", "/proprietaires"),
                 ("Estimation gratuite", "/estimation-rentabilite-airbnb")],
    ),

    dict(
        slug="gerer-seul-ou-deleguer-airbnb",
        cat="Choisir une conciergerie", crumb="Gérer seul ou déléguer",
        title="Gérer seul ou déléguer son Airbnb : le vrai calcul",
        h1="Gérer seul ou déléguer : le calcul que personne ne fait",
        desc="Temps réellement passé, revenus comparés, risques assumés : la méthode pour savoir "
             "si déléguer la gestion de votre location courte durée est rentable dans votre cas "
             "précis.",
        date="2026-06-03", date_txt="3 juin 2026", lecture=7,
        lead="La question n'est pas « est-ce que je peux gérer seul ? » — vous pouvez. Elle est "
             "« qu'est-ce que ça me coûte, et qu'est-ce que ça me rapporte de plus ou de moins ? ». "
             "Voici comment y répondre en trois colonnes.",
        sections=[
            ("Colonne 1 : le temps réel, poste par poste", [
                "<p>Faites l'inventaire honnête de ce qu'implique une gestion en propre :</p>",
                "<ul>"
                "<li>répondre aux demandes, souvent dans l'heure, sept jours sur sept ;</li>"
                "<li>ajuster les prix et le calendrier ;</li>"
                "<li>organiser chaque arrivée et chaque départ ;</li>"
                "<li>planifier le ménage et vérifier qu'il a été fait ;</li>"
                "<li>gérer le linge et les réassorts ;</li>"
                "<li>traiter les incidents — c'est le poste imprévisible ;</li>"
                "<li>suivre la comptabilité et les déclarations.</li>"
                "</ul>",
                "<p>Comptez sur un mois représentatif, pas sur un mois calme. Puis valorisez cette "
                "heure : au coût de votre temps professionnel, ou simplement au prix que vous "
                "attachez à vos soirées.</p>",
            ]),
            ("Colonne 2 : l'écart de revenus", [
                "<p>Une gestion professionnelle agit sur trois leviers mesurables :</p>",
                "<ul>"
                "<li><strong>le taux d'occupation</strong>, via la réactivité et la présence sur "
                "plusieurs plateformes ;</li>"
                "<li><strong>le prix moyen</strong>, via une tarification suivie plutôt que fixe ;</li>"
                "<li><strong>les nuits sauvées</strong> : un incident traité vite, c'est un séjour "
                "qui n'est pas annulé.</li>"
                "</ul>",
                "<p>Nous ne publions pas de pourcentage de gain : il dépend entièrement de votre "
                "point de départ. Un propriétaire déjà très réactif, avec une bonne annonce, "
                "gagnera peu. Un propriétaire qui répond le soir, avec un tarif fixe et des photos "
                "au téléphone, gagnera beaucoup.</p>",
            ]),
            ("Colonne 3 : le risque", [
                "<p>Gérer seul, c'est aussi porter seul le risque réglementaire — déclaration, "
                "plafond de nuitées, changement d'usage — et le risque opérationnel : que se "
                "passe-t-il si vous êtes en déplacement, hospitalisé, ou simplement en vacances "
                "sans réseau, le jour où le chauffe-eau lâche ?</p>",
                "<p>Ce risque n'a pas de prix affiché, mais il se matérialise toujours au pire "
                "moment.</p>",
            ]),
            ("Quand gérer seul est le bon choix", [
                "<p>Soyons directs, cela arrive souvent :</p>",
                "<ul>"
                "<li>vous habitez à proximité immédiate du bien ;</li>"
                "<li>vous avez du temps disponible en journée ;</li>"
                "<li>vous n'avez qu'un seul logement, avec peu de rotations ;</li>"
                "<li>la gestion vous plaît — c'est un vrai critère.</li>"
                "</ul>",
                "<p>Dans ce cas, une conciergerie n'apportera pas grand-chose, et nous vous le "
                "dirons plutôt que de vous vendre un contrat.</p>",
            ]),
            ("Quand déléguer s'impose", [
                "<ul>"
                "<li>vous vivez loin du bien, ou à l'étranger ;</li>"
                "<li>vous avez plusieurs logements ;</li>"
                "<li>votre bien est très saisonnier et demande un pilotage tarifaire soutenu ;</li>"
                "<li>vous ne pouvez pas répondre en journée ;</li>"
                "<li>la réglementation locale est complexe et évolutive.</li>"
                "</ul>",
                "<p>Dans ces situations, la commission se rembourse généralement d'elle-même — et "
                "c'est exactement ce que notre "
                "<a href=\"/estimation-rentabilite-airbnb\">estimation gratuite</a> permet de "
                "vérifier avant de s'engager.</p>",
            ]),
        ],
        faq=[
            ("Combien de temps prend une gestion en propre ?",
             "Cela varie selon le nombre de rotations et l'état du bien. La bonne méthode est de "
             "mesurer sur un mois représentatif plutôt que d'estimer de mémoire — les messages et "
             "les imprévus sont toujours sous-évalués."),
            ("Une conciergerie augmente-t-elle vraiment les revenus ?",
             "Elle agit sur l'occupation, le prix moyen et les nuits perdues sur incident. "
             "L'ampleur du gain dépend de votre point de départ : nous préférons l'estimer sur "
             "votre bien plutôt que d'annoncer un pourcentage générique."),
            ("Peut-on déléguer seulement une partie ?",
             "Oui : certains propriétaires gardent la relation voyageurs et délèguent le ménage et "
             "les interventions techniques. C'est une formule intermédiaire tout à fait viable."),
            ("Peut-on reprendre la main plus tard ?",
             "Oui, à condition que l'annonce et l'historique d'avis restent sur votre compte. "
             "Vérifiez ce point avant de signer avec qui que ce soit."),
        ],
        related=[("Combien coûte une conciergerie ?", "/combien-coute-une-conciergerie-airbnb"),
                 ("7 questions avant de signer", "/questions-avant-de-choisir-une-conciergerie"),
                 ("Calculer sa rentabilité", "/calculer-rentabilite-location-courte-duree"),
                 ("Simulateur de revenus", "/simulateur-revenus-airbnb")],
    ),
]
