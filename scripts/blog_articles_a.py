# -*- coding: utf-8 -*-
"""Articles de blog — réglementation et fiscalité de la location meublée.

Les règles citées sont datées et sourcées par leur texte (loi, article de code).
Chaque article rappelle que la fiscalité évolue et renvoie à un professionnel :
nous sommes gestionnaires, pas conseils fiscaux.
"""
from __future__ import annotations

DISCLAIMER_FISCAL = (
    "⚠️ Cet article est informatif et ne remplace pas l'avis d'un professionnel. "
    "La fiscalité de la location meublée évolue à chaque loi de finances : faites "
    "valider votre situation par un expert-comptable avant de décider."
)
DISCLAIMER_REGLEMENTAIRE = (
    "⚠️ Les règles varient d'une commune à l'autre et évoluent vite. Cet article donne "
    "le cadre national ; la mairie de votre commune reste la source qui fait foi pour "
    "votre adresse. Nous faisons cette vérification pour les biens que nous gérons."
)

ARTICLES = [
    dict(
        slug="loi-le-meur-location-courte-duree",
        cat="Réglementation", crumb="Loi Le Meur",
        title="Loi Le Meur : ce qui a changé pour la location courte durée",
        h1="Loi Le Meur : ce qui a changé pour les meublés de tourisme",
        desc="La loi du 19 novembre 2024 a modifié la fiscalité des meublés de tourisme, renforcé "
             "les pouvoirs des communes et introduit une exigence de performance énergétique. "
             "Ce qu'un propriétaire doit en retenir.",
        date="2026-03-04", date_txt="4 mars 2026", lecture=8,
        lead="Adoptée le 19 novembre 2024, la loi dite « Le Meur » est le texte qui a le plus "
             "changé la donne pour les loueurs en meublé de tourisme depuis dix ans. Elle agit sur "
             "trois leviers à la fois : la fiscalité, les pouvoirs des maires et la performance "
             "énergétique. Voici ce qu'elle implique concrètement.",
        tip=DISCLAIMER_FISCAL,
        sections=[
            ("1. La fiscalité du micro-BIC a été revue à la baisse", [
                "<p>C'est le changement le plus immédiat pour la majorité des propriétaires. "
                "Jusque-là, un meublé de tourisme non classé bénéficiait d'un abattement "
                "forfaitaire confortable. La <strong>loi n° 2024-1039 du 19 novembre 2024</strong> "
                "a resserré le dispositif :</p>",
                "<ul>"
                "<li><strong>Meublé de tourisme non classé</strong> : abattement de "
                "<strong>30 %</strong>, dans la limite de <strong>15 000 €</strong> de recettes "
                "annuelles.</li>"
                "<li><strong>Meublé de tourisme classé</strong> : abattement de "
                "<strong>50 %</strong>, avec un plafond nettement plus élevé.</li>"
                "</ul>",
                "<p>Traduction pratique : au-delà de ces plafonds, vous basculez au régime réel. "
                "Ce n'est pas nécessairement une mauvaise nouvelle — le réel permet de déduire les "
                "charges effectives et d'amortir le bien — mais cela suppose une comptabilité "
                "tenue sérieusement. Voir notre article "
                "<a href=\"/micro-bic-ou-reel-location-meublee\">micro-BIC ou réel</a>.</p>",
                "<p>Le classement en meublé de tourisme, qui relève d'un organisme accrédité, "
                "reprend donc de l'intérêt : il conditionne désormais un écart d'abattement "
                "important.</p>",
            ]),
            ("2. Les communes ont gagné de vrais pouvoirs", [
                "<p>La loi élargit sensiblement la boîte à outils des maires. Trois mesures "
                "comptent pour un propriétaire :</p>",
                "<ul>"
                "<li><strong>Abaisser le plafond de nuitées</strong> de la résidence principale : "
                "les communes peuvent descendre en dessous des 120 nuits par an historiques, "
                "jusqu'à 90 nuits.</li>"
                "<li><strong>Instaurer des quotas</strong> de meublés de tourisme par quartier, "
                "avec autorisation préalable.</li>"
                "<li><strong>Réserver des zones à la résidence principale</strong> dans les "
                "documents d'urbanisme.</li>"
                "</ul>",
                "<p>Conséquence concrète : la réponse à « puis-je louer mon bien en courte "
                "durée ? » n'est plus nationale, elle est communale — et elle peut changer d'une "
                "année sur l'autre. C'est exactement pour cette raison que nous vérifions en "
                "mairie avant toute mise en ligne, plutôt que de nous fier à ce qui était vrai "
                "l'an dernier.</p>",
            ]),
            ("3. L'enregistrement se généralise", [
                "<p>Le numéro d'enregistrement, jusque-là réservé aux communes qui l'avaient "
                "instauré, a vocation à se généraliser : toute mise en location d'un meublé de "
                "tourisme suppose une déclaration, et le numéro obtenu doit figurer sur l'annonce. "
                "Les plateformes sont tenues de le contrôler et de bloquer les annonces "
                "non conformes.</p>",
                "<p>Le calendrier d'application dépend des textes réglementaires. En pratique, "
                "considérez que la déclaration est la règle et l'absence de déclaration "
                "l'exception : c'est le sens de l'histoire, et une annonce désactivée en pleine "
                "saison coûte bien plus cher qu'une démarche administrative. Voir notre guide sur "
                "le <a href=\"/numero-enregistrement-meuble-tourisme\">numéro "
                "d'enregistrement</a>.</p>",
            ]),
            ("4. La performance énergétique entre dans l'équation", [
                "<p>Nouveauté de fond : la loi introduit une exigence de diagnostic de performance "
                "énergétique pour les meublés de tourisme, avec un calendrier progressif et des "
                "règles renforcées dans les communes qui appliquent l'autorisation de changement "
                "d'usage.</p>",
                "<p>Autrement dit, la passoire thermique que l'on sortait de la location nue pour "
                "la basculer en courte durée n'est plus une échappatoire durable. Si votre bien "
                "est mal classé, mieux vaut planifier les travaux maintenant que découvrir "
                "l'échéance trois mois avant.</p>",
            ]),
            ("5. Ce que nous en retenons pour nos propriétaires", [
                "<p>La lecture pessimiste consiste à dire que la courte durée est attaquée. La "
                "lecture réaliste est plus intéressante : le marché se professionnalise. Les biens "
                "déclarés, conformes, bien tenus et bien classés continuent de très bien "
                "fonctionner — et ils affrontent moins de concurrence amateur qu'avant.</p>",
                "<p>Trois réflexes utiles :</p>",
                "<ul>"
                "<li><strong>Déclarer et se mettre en règle</strong>, systématiquement. Une "
                "annonce désactivée en août anéantit une saison.</li>"
                "<li><strong>Envisager le classement</strong> du meublé, qui change le régime "
                "d'abattement.</li>"
                "<li><strong>Garder le bail mobilité en réserve</strong> : quand la courte durée "
                "est bloquée, la moyenne durée reste ouverte, sans plafond de nuitées. Voir "
                "<a href=\"/courte-moyenne-longue-duree-comparatif\">notre comparatif</a>.</li>"
                "</ul>",
            ]),
        ],
        faq=[
            ("La loi Le Meur interdit-elle la location Airbnb ?",
             "Non. Elle encadre : fiscalité moins avantageuse au micro-BIC pour les meublés non "
             "classés, pouvoirs renforcés des communes, déclaration généralisée et exigences "
             "énergétiques. La location reste possible, à condition d'être en règle."),
            ("Faut-il faire classer son meublé de tourisme ?",
             "C'est à étudier au cas par cas, mais l'écart d'abattement entre un meublé classé et "
             "non classé au micro-BIC rend la démarche nettement plus intéressante qu'avant. "
             "Le classement est délivré par un organisme accrédité après visite."),
            ("Ma commune peut-elle limiter la location à 90 nuits ?",
             "Oui, la loi lui en donne la possibilité pour les résidences principales. Vérifiez "
             "la délibération applicable à votre commune : c'est elle qui fait foi."),
            ("Que faire si je ne peux plus louer en courte durée ?",
             "Le bail mobilité (1 à 10 mois) et la location meublée classique restent ouverts, "
             "sans plafond de nuitées, et rapportent davantage qu'une location nue."),
        ],
        related=[("Numéro d'enregistrement : le guide", "/numero-enregistrement-meuble-tourisme"),
                 ("Changement d'usage et compensation", "/changement-usage-meuble-tourisme"),
                 ("Micro-BIC ou réel ?", "/micro-bic-ou-reel-location-meublee"),
                 ("Estimer mes revenus", "/estimation-rentabilite-airbnb")],
    ),

    dict(
        slug="numero-enregistrement-meuble-tourisme",
        cat="Réglementation", crumb="Numéro d'enregistrement",
        title="Numéro d'enregistrement d'un meublé de tourisme : mode d'emploi",
        h1="Numéro d'enregistrement : quand il est obligatoire, et comment l'obtenir",
        desc="Déclaration en mairie, numéro d'enregistrement à afficher sur l'annonce, contrôle "
             "par les plateformes : le mode d'emploi complet pour un propriétaire qui loue en "
             "meublé de tourisme.",
        date="2026-03-19", date_txt="19 mars 2026", lecture=6,
        lead="C'est la formalité que la plupart des propriétaires découvrent le jour où leur "
             "annonce est désactivée. Elle prend pourtant quelques minutes, et elle conditionne "
             "tout le reste.",
        tip=DISCLAIMER_REGLEMENTAIRE,
        sections=[
            ("À quoi sert ce numéro", [
                "<p>Le numéro d'enregistrement permet à la commune de savoir quels logements sont "
                "loués en meublé de tourisme, et de contrôler le respect du plafond de nuitées "
                "pour les résidences principales. Il doit figurer <strong>sur l'annonce "
                "elle-même</strong>, quelle que soit la plateforme.</p>",
                "<p>Les plateformes ont l'obligation de vérifier ce numéro et de transmettre à la "
                "commune le décompte des nuitées louées. C'est ce croisement de données qui rend "
                "aujourd'hui inutile toute tentative de passer entre les mailles : le dépassement "
                "se voit automatiquement.</p>",
            ]),
            ("Qui doit le demander", [
                "<p>La règle générale : dès que votre commune a instauré la procédure "
                "d'enregistrement, tout meublé de tourisme doit être déclaré — résidence "
                "principale comme résidence secondaire.</p>",
                "<p>Les grandes villes et les communes touristiques l'ont instaurée depuis "
                "longtemps. Le mouvement engagé par la loi du 19 novembre 2024 va dans le sens "
                "d'une généralisation. En pratique, partez du principe que vous devez déclarer, et "
                "vérifiez le cas contraire plutôt que l'inverse.</p>",
            ]),
            ("Comment l'obtenir, concrètement", [
                "<p>La démarche se fait en ligne sur le téléservice de votre commune, ou "
                "directement en mairie pour les plus petites. Prévoyez :</p>",
                "<ul>"
                "<li>votre identité et vos coordonnées ;</li>"
                "<li>l'adresse exacte du logement, avec le bâtiment et l'étage ;</li>"
                "<li>le statut du bien : résidence principale ou secondaire ;</li>"
                "<li>le numéro d'invariant fiscal, qui figure sur votre avis de taxe foncière ;</li>"
                "<li>le nombre de pièces et la capacité d'accueil.</li>"
                "</ul>",
                "<p>Le numéro est délivré immédiatement dans la plupart des téléservices. Il est "
                "propre au logement, pas au propriétaire : un second bien suppose une seconde "
                "déclaration.</p>",
            ]),
            ("Les erreurs qui coûtent cher", [
                "<p><strong>Déclarer une résidence secondaire comme résidence principale.</strong> "
                "C'est une fausse déclaration, et le croisement des données la rend visible. "
                "L'amende encourue est sans commune mesure avec le gain espéré.</p>",
                "<p><strong>Oublier d'afficher le numéro sur l'annonce.</strong> La plateforme "
                "peut suspendre l'annonce — souvent au pire moment, c'est-à-dire quand elle "
                "commence à bien tourner.</p>",
                "<p><strong>Confondre enregistrement et changement d'usage.</strong> Ce sont deux "
                "démarches distinctes : la déclaration ne vous autorise pas à louer une résidence "
                "secondaire en courte durée si votre commune exige une autorisation de changement "
                "d'usage. Voir notre article dédié au "
                "<a href=\"/changement-usage-meuble-tourisme\">changement d'usage</a>.</p>",
            ]),
            ("Et la taxe de séjour ?", [
                "<p>Elle est due dans la quasi-totalité des communes touristiques. Dans les faits, "
                "les plateformes la collectent auprès du voyageur et la reversent à la commune : "
                "vous n'avez rien à avancer, mais vous restez responsable de la conformité des "
                "informations déclarées.</p>",
                "<p>En cas de réservation en direct — hors plateforme — la collecte et le "
                "reversement vous incombent. C'est un point que nous prenons en charge pour les "
                "biens que nous gérons.</p>",
            ]),
        ],
        faq=[
            ("Combien de temps faut-il pour obtenir le numéro ?",
             "Souvent quelques minutes sur le téléservice communal, le numéro étant délivré "
             "immédiatement. Dans les communes sans téléservice, comptez le délai de traitement "
             "de la mairie."),
            ("Le numéro est-il payant ?",
             "Non, la déclaration en mairie est gratuite. Ce qui peut être payant, c'est le "
             "classement du meublé de tourisme, qui est une démarche différente et facultative."),
            ("Faut-il un numéro par logement ?",
             "Oui : l'enregistrement porte sur le logement, pas sur le propriétaire."),
            ("Que risque-t-on sans déclaration ?",
             "Une amende administrative dont le montant peut être élevé, et la désactivation de "
             "l'annonce par la plateforme. Le calcul est vite fait."),
        ],
        related=[("Loi Le Meur : ce qui a changé", "/loi-le-meur-location-courte-duree"),
                 ("Changement d'usage : le guide", "/changement-usage-meuble-tourisme"),
                 ("Le plafond de 120 nuits", "/plafond-120-nuits-residence-principale"),
                 ("Notre gestion clé en main", "/proprietaires")],
    ),

    dict(
        slug="changement-usage-meuble-tourisme",
        cat="Réglementation", crumb="Changement d'usage",
        title="Changement d'usage et compensation : le guide du propriétaire",
        h1="Changement d'usage : le vrai obstacle de la location courte durée",
        desc="Autorisation de changement d'usage, compensation, communes concernées : pourquoi "
             "louer une résidence secondaire en meublé de tourisme n'est pas toujours possible, "
             "et quelles solutions restent ouvertes.",
        date="2026-04-08", date_txt="8 avril 2026", lecture=7,
        lead="C'est le point sur lequel butent la plupart des projets d'investissement en courte "
             "durée. Beaucoup de propriétaires découvrent l'existence du changement d'usage après "
             "avoir signé — c'est-à-dire trop tard.",
        tip=DISCLAIMER_REGLEMENTAIRE,
        sections=[
            ("De quoi parle-t-on", [
                "<p>Un logement a, juridiquement, un « usage » d'habitation. Le louer de manière "
                "répétée à une clientèle de passage qui n'y élit pas domicile constitue un "
                "changement d'usage, encadré par l'<strong>article L631-7 du code de la "
                "construction et de l'habitation</strong>. Dans les communes concernées, ce "
                "changement suppose une <strong>autorisation préalable du maire</strong>.</p>",
                "<p>Attention à ne pas confondre avec la déclaration en mairie et le "
                "<a href=\"/numero-enregistrement-meuble-tourisme\">numéro d'enregistrement</a> : "
                "ce sont deux démarches différentes, et la première ne dispense pas de la "
                "seconde.</p>",
            ]),
            ("Quelles communes sont concernées", [
                "<p>Le régime s'applique de plein droit :</p>",
                "<ul>"
                "<li>dans les <strong>communes de plus de 200 000 habitants</strong> ;</li>"
                "<li>dans <strong>tous les Hauts-de-Seine (92), la Seine-Saint-Denis (93) et le "
                "Val-de-Marne (94)</strong> — un point que la plupart des propriétaires de "
                "banlieue ignorent ;</li>"
                "<li>dans les autres communes qui l'ont mis en place sur décision "
                "préfectorale.</li>"
                "</ul>",
                "<p>Autrement dit, un appartement à Boulogne, à Montreuil ou à Vincennes relève du "
                "même régime qu'un appartement parisien. Voir notre "
                "<a href=\"/conciergerie-airbnb-banlieue-parisienne\">page dédiée à la banlieue "
                "parisienne</a>.</p>",
            ]),
            ("Le cas de la résidence principale", [
                "<p>Bonne nouvelle : votre résidence principale — celle que vous occupez au moins "
                "huit mois par an — échappe à l'autorisation de changement d'usage. Vous pouvez la "
                "louer en meublé de tourisme dans la limite du "
                "<a href=\"/plafond-120-nuits-residence-principale\">plafond de nuitées "
                "annuel</a>, après déclaration.</p>",
                "<p>C'est le cas de figure le plus simple, et il concerne beaucoup de "
                "propriétaires qui louent pendant leurs absences.</p>",
            ]),
            ("La compensation, ou pourquoi c'est difficile à Paris", [
                "<p>Pour une résidence secondaire, l'autorisation est le plus souvent soumise à "
                "<strong>compensation</strong> : transformer en logement une surface équivalente "
                "de local commercial ou de bureau, dans le même arrondissement, parfois dans un "
                "rapport supérieur à un pour un dans les secteurs les plus tendus.</p>",
                "<p>Concrètement, cela signifie acheter ou faire acheter de la « commercialité ». "
                "Le coût est tel qu'il sort du budget de la quasi-totalité des investisseurs "
                "particuliers. Il faut le savoir avant de bâtir un plan de financement sur des "
                "revenus de courte durée.</p>",
            ]),
            ("Les solutions qui restent ouvertes", [
                "<p>Ne pas obtenir de changement d'usage n'est pas la fin du projet. Trois voies "
                "restent parfaitement légales et rentables :</p>",
                "<ul>"
                "<li><strong>Le bail mobilité</strong> (1 à 10 mois, sans dépôt de garantie), "
                "destiné aux étudiants, stagiaires et salariés en mission : aucun plafond de "
                "nuitées, aucune autorisation nécessaire.</li>"
                "<li><strong>La location meublée classique</strong>, avec un loyer supérieur à "
                "celui d'une location nue et une fiscalité BIC.</li>"
                "<li><strong>La location de votre résidence principale</strong> pendant vos "
                "absences, dans la limite du plafond.</li>"
                "</ul>",
                "<p>Notre <a href=\"/courte-moyenne-longue-duree-comparatif\">comparatif des trois "
                "durées</a> détaille ce que chacune rapporte réellement, charges déduites.</p>",
            ]),
        ],
        faq=[
            ("Le changement d'usage s'applique-t-il en banlieue parisienne ?",
             "Oui, dans les Hauts-de-Seine, la Seine-Saint-Denis et le Val-de-Marne, ainsi que "
             "dans les communes de plus de 200 000 habitants. C'est l'une des méconnaissances les "
             "plus fréquentes chez les propriétaires de petite couronne."),
            ("Ma résidence principale est-elle concernée ?",
             "Non, elle échappe à l'autorisation de changement d'usage, à condition de respecter "
             "le plafond de nuitées annuel et d'être déclarée en mairie."),
            ("L'autorisation est-elle attachée au bien ou à la personne ?",
             "Cela dépend du régime communal : certaines autorisations sont personnelles et "
             "temporaires, d'autres attachées au local lorsqu'il y a compensation. C'est un point "
             "à vérifier précisément avant tout achat."),
            ("Que se passe-t-il si je loue sans autorisation ?",
             "Vous vous exposez à une amende civile élevée, prononcée par le tribunal judiciaire "
             "à la demande de la commune. Le risque n'est pas théorique dans les grandes villes."),
        ],
        related=[("Le plafond de 120 nuits", "/plafond-120-nuits-residence-principale"),
                 ("Loi Le Meur", "/loi-le-meur-location-courte-duree"),
                 ("Courte, moyenne ou longue durée ?", "/courte-moyenne-longue-duree-comparatif"),
                 ("Conciergerie en banlieue parisienne", "/conciergerie-airbnb-banlieue-parisienne")],
    ),

    dict(
        slug="plafond-120-nuits-residence-principale",
        cat="Réglementation", crumb="Plafond de 120 nuits",
        title="Plafond de 120 nuits : ce que la règle couvre vraiment",
        h1="Le plafond de 120 nuits : ce qu'il couvre, et comment ne pas le dépasser",
        desc="Location de sa résidence principale en meublé de tourisme : ce que recouvre le "
             "plafond annuel de nuitées, comment les communes peuvent l'abaisser, et comment "
             "piloter son calendrier pour rester en règle.",
        date="2026-04-23", date_txt="23 avril 2026", lecture=6,
        lead="Louer sa résidence principale quelques mois par an est la porte d'entrée la plus "
             "simple vers la location courte durée. Encore faut-il savoir compter — et savoir "
             "que le plafond n'est plus figé partout à 120 nuits.",
        tip=DISCLAIMER_REGLEMENTAIRE,
        sections=[
            ("Ce que dit la règle", [
                "<p>Une résidence principale — le logement que vous occupez au moins huit mois "
                "par an — peut être louée en meublé de tourisme dans la limite de "
                "<strong>120 nuits par année civile</strong>. Au-delà, le logement n'est plus "
                "considéré comme votre résidence principale au sens de la location touristique, "
                "et bascule dans le régime du "
                "<a href=\"/changement-usage-meuble-tourisme\">changement d'usage</a>.</p>",
                "<p>Depuis la loi du 19 novembre 2024, les communes peuvent <strong>abaisser ce "
                "plafond jusqu'à 90 nuits</strong> par délibération. Vérifiez donc le chiffre "
                "applicable chez vous plutôt que de retenir 120 comme une constante nationale.</p>",
            ]),
            ("Ce qui compte, et ce qui ne compte pas", [
                "<p>Le décompte porte sur les nuitées louées <strong>à une clientèle de passage "
                "qui n'y élit pas domicile</strong>. En pratique :</p>",
                "<ul>"
                "<li><strong>Compté</strong> : toute nuit louée en meublé de tourisme, sur "
                "n'importe quelle plateforme ou en direct.</li>"
                "<li><strong>Non compté</strong> : les nuits où vous occupez le logement, les "
                "nuits vides, et les locations relevant d'un autre régime — bail mobilité ou "
                "location meublée classique — puisque le locataire y élit domicile.</li>"
                "</ul>",
                "<p>Cette distinction est le levier le plus utile : un bail mobilité de six mois "
                "n'entame pas votre compteur de nuitées touristiques.</p>",
            ]),
            ("Comment le compteur est contrôlé", [
                "<p>Les plateformes transmettent aux communes le nombre de nuitées louées par "
                "numéro d'enregistrement, et bloquent automatiquement les annonces qui atteignent "
                "le plafond. Le contrôle est donc devenu mécanique.</p>",
                "<p>Le piège classique : multiplier les plateformes en pensant diluer le compteur. "
                "Le numéro d'enregistrement étant le même, les nuitées s'additionnent. Le "
                "dépassement se voit, et il coûte cher.</p>",
            ]),
            ("Piloter son calendrier intelligemment", [
                "<p>Avec 120 nuits — ou 90 — l'enjeu n'est plus de remplir, mais de "
                "<strong>choisir</strong> quelles nuits vendre. Une nuit de plafond consommée en "
                "février à bas prix, c'est une nuit indisponible en juillet au tarif fort.</p>",
                "<p>La méthode que nous appliquons pour les résidences principales que nous "
                "gérons :</p>",
                "<ul>"
                "<li>identifier les <strong>périodes à forte valeur</strong> de la commune — "
                "salons, festivals, vacances scolaires, grands événements sportifs ;</li>"
                "<li>réserver le quota à ces périodes, en fermant volontairement le calendrier "
                "sur les périodes creuses ;</li>"
                "<li>imposer des <strong>durées minimales de séjour</strong> plus longues quand le "
                "quota se réduit, pour maximiser le revenu par nuit consommée.</li>"
                "</ul>",
                "<p>Bien piloté, un quota de 120 nuits peut représenter davantage de revenu net "
                "qu'un calendrier ouvert toute l'année et mal tarifé.</p>",
            ]),
            ("Et si vous voulez louer davantage", [
                "<p>Deux options légales : basculer sur le <strong>bail mobilité</strong> pour les "
                "périodes hors quota, ou obtenir une autorisation de changement d'usage — "
                "difficile et coûteuse dans les grandes villes.</p>",
                "<p>Dans la pratique, la combinaison « courte durée sur les pics + bail mobilité "
                "le reste de l'année » est celle qui produit le meilleur revenu annuel pour une "
                "résidence secondaire en zone tendue.</p>",
            ]),
        ],
        faq=[
            ("Le plafond est-il de 120 nuits partout ?",
             "Non. C'est la règle historique, mais les communes peuvent désormais l'abaisser "
             "jusqu'à 90 nuits. Vérifiez la délibération applicable à votre commune."),
            ("Les nuits réservées mais annulées comptent-elles ?",
             "Le décompte porte sur les nuitées effectivement louées. Une réservation annulée "
             "sans séjour n'a pas à être comptabilisée."),
            ("Puis-je louer 120 nuits sur chacune de mes plateformes ?",
             "Non. Le compteur est attaché au logement via son numéro d'enregistrement : les "
             "nuitées de toutes les plateformes s'additionnent."),
            ("Le bail mobilité entre-t-il dans le quota ?",
             "Non : le locataire en bail mobilité élit domicile dans le logement, ce n'est pas une "
             "location de meublé de tourisme. C'est ce qui en fait un complément si utile."),
        ],
        related=[("Changement d'usage", "/changement-usage-meuble-tourisme"),
                 ("Numéro d'enregistrement", "/numero-enregistrement-meuble-tourisme"),
                 ("Tarification dynamique", "/tarification-dynamique-airbnb"),
                 ("Simulateur de revenus", "/simulateur-revenus-airbnb")],
    ),

    dict(
        slug="copropriete-location-courte-duree",
        cat="Réglementation", crumb="Copropriété",
        title="Copropriété : peut-on vous interdire de louer en courte durée ?",
        h1="Copropriété et location courte durée : ce que le règlement peut vous imposer",
        desc="Clause d'habitation bourgeoise, décision d'assemblée générale, troubles de "
             "voisinage : ce qu'une copropriété peut réellement imposer à un propriétaire qui "
             "loue en meublé de tourisme.",
        date="2026-05-12", date_txt="12 mai 2026", lecture=6,
        lead="On peut être parfaitement en règle avec sa mairie et se faire arrêter par son "
             "règlement de copropriété. C'est la deuxième cause d'arrêt brutal d'une activité de "
             "location courte durée, après la réglementation communale.",
        tip=DISCLAIMER_REGLEMENTAIRE,
        sections=[
            ("Le règlement de copropriété prime", [
                "<p>Avant toute chose : lisez votre règlement de copropriété. C'est un document "
                "contractuel qui s'impose à tous les copropriétaires, et il peut restreindre "
                "l'usage des lots bien au-delà de ce que prévoit la commune.</p>",
                "<p>Deux clauses à repérer :</p>",
                "<ul>"
                "<li>la <strong>clause d'habitation bourgeoise exclusive</strong>, qui réserve "
                "l'immeuble au seul usage d'habitation et exclut donc toute activité "
                "commerciale ;</li>"
                "<li>la <strong>clause d'habitation bourgeoise simple</strong>, plus souple, qui "
                "tolère certaines activités professionnelles.</li>"
                "</ul>",
                "<p>La jurisprudence considère de longue date que la location meublée de tourisme "
                "répétée s'apparente à une activité de nature commerciale : une clause "
                "d'habitation bourgeoise exclusive peut donc suffire à l'interdire.</p>",
            ]),
            ("Ce que l'assemblée générale peut décider", [
                "<p>La loi du 19 novembre 2024 a renforcé les moyens des copropriétés. Deux points "
                "à connaître :</p>",
                "<ul>"
                "<li>l'assemblée générale peut se prononcer sur l'<strong>interdiction de la "
                "location de meublés de tourisme</strong> dans les immeubles à destination "
                "d'habitation, selon les conditions de majorité prévues par le texte ;</li>"
                "<li>le copropriétaire qui déclare son meublé de tourisme en mairie doit en "
                "<strong>informer le syndic</strong>, lequel inscrit le sujet à l'ordre du jour de "
                "l'assemblée suivante.</li>"
                "</ul>",
                "<p>Autrement dit, la discrétion n'est plus une stratégie : votre activité devient "
                "un point d'ordre du jour.</p>",
            ]),
            ("Les troubles de voisinage, l'autre risque", [
                "<p>Même sans interdiction formelle, un propriétaire peut être poursuivi pour "
                "troubles anormaux de voisinage : bruit nocturne, allées et venues, dégradations "
                "des parties communes, valises dans les escaliers à 2 h du matin.</p>",
                "<p>C'est un sujet très concret, et largement évitable. Ce que nous mettons en "
                "place sur les biens que nous gérons en copropriété :</p>",
                "<ul>"
                "<li>règlement intérieur clair remis à l'arrivée, avec interdiction explicite des "
                "fêtes ;</li>"
                "<li>sélection des voyageurs, et refus assumé des réservations à risque ;</li>"
                "<li>accueil en personne plutôt que boîte à clés dans les immeubles sensibles ;</li>"
                "<li>durée minimale de séjour relevée, qui filtre naturellement les séjours "
                "festifs ;</li>"
                "<li>un numéro joignable par le voisinage en cas de problème.</li>"
                "</ul>",
                "<p>Un voisin qui sait qui appeler porte rarement plainte. Un voisin qui ne sait "
                "pas finit par écrire au syndic.</p>",
            ]),
            ("Que faire si la copropriété se braque", [
                "<p>D'abord, vérifier ce que dit exactement le règlement : beaucoup d'interdictions "
                "invoquées en assemblée n'ont aucun fondement écrit. Ensuite, désamorcer : dans "
                "bien des cas, les griefs portent sur des nuisances réelles, pas sur le principe.</p>",
                "<p>Si l'interdiction est fondée et confirmée, le bail mobilité redevient la "
                "solution : un locataire en mobilité élit domicile dans le logement, ce n'est pas "
                "une activité de meublé de tourisme, et le règlement de copropriété ne peut pas "
                "s'y opposer au titre de l'habitation bourgeoise.</p>",
            ]),
        ],
        faq=[
            ("Le syndic peut-il m'interdire de louer ?",
             "Le syndic applique le règlement et les décisions d'assemblée générale ; il ne décide "
             "pas seul. En revanche, un règlement contenant une clause d'habitation bourgeoise "
             "exclusive peut suffire à interdire la location meublée de tourisme."),
            ("Dois-je informer le syndic de mon activité ?",
             "Oui lorsque vous déclarez votre meublé de tourisme en mairie : la loi prévoit une "
             "information du syndic, avec inscription du sujet à l'ordre du jour de l'assemblée."),
            ("La location de ma résidence principale est-elle concernée ?",
             "Le règlement de copropriété s'applique quel que soit le statut du logement. Une "
             "clause d'habitation bourgeoise exclusive vise l'activité, pas le nombre de nuits."),
            ("Le bail mobilité est-il possible en copropriété ?",
             "Oui : il s'agit d'une location d'habitation classique, pas d'une activité de meublé "
             "de tourisme. C'est souvent la porte de sortie quand la copropriété se ferme."),
        ],
        related=[("Changement d'usage", "/changement-usage-meuble-tourisme"),
                 ("Dégradations et incidents", "/degradations-incidents-location"),
                 ("Courte, moyenne ou longue durée ?", "/courte-moyenne-longue-duree-comparatif"),
                 ("Notre gestion clé en main", "/proprietaires")],
    ),

    dict(
        slug="micro-bic-ou-reel-location-meublee",
        cat="Fiscalité", crumb="Micro-BIC ou réel",
        title="Micro-BIC ou régime réel : comment choisir pour un meublé",
        h1="Micro-BIC ou régime réel : comment choisir",
        desc="Abattement forfaitaire ou déduction des charges réelles et amortissement : la "
             "méthode pour arbitrer entre micro-BIC et régime réel en location meublée, et les "
             "points à faire vérifier par un comptable.",
        date="2026-05-27", date_txt="27 mai 2026", lecture=8,
        lead="C'est l'arbitrage fiscal le plus structurant pour un loueur en meublé — et celui "
             "que le plus grand nombre de propriétaires tranchent par défaut, faute d'avoir fait "
             "le calcul.",
        tip=DISCLAIMER_FISCAL,
        sections=[
            ("Le principe : deux façons de calculer le revenu imposable", [
                "<p>La location meublée relève des <strong>bénéfices industriels et commerciaux "
                "(BIC)</strong>, et non des revenus fonciers. Deux régimes coexistent :</p>",
                "<ul>"
                "<li><strong>Le micro-BIC</strong> : l'administration applique un abattement "
                "forfaitaire sur vos recettes, censé représenter vos charges. Vous ne déduisez "
                "rien d'autre.</li>"
                "<li><strong>Le régime réel</strong> : vous déduisez vos charges effectives et "
                "vous <strong>amortissez</strong> le bien et le mobilier.</li>"
                "</ul>",
                "<p>Le second demande une comptabilité, donc un comptable. Le premier ne demande "
                "rien — ce qui explique son succès, pas sa pertinence.</p>",
            ]),
            ("Ce qui a changé avec la loi Le Meur", [
                "<p>Depuis la <strong>loi du 19 novembre 2024</strong>, les abattements du "
                "micro-BIC pour les meublés de tourisme ont été réduits, avec une distinction "
                "nette entre meublé classé et non classé, et des plafonds de recettes plus bas "
                "pour les non classés.</p>",
                "<p>Conséquence : le micro-BIC, qui était souvent le choix par défaut, devient "
                "beaucoup moins avantageux pour un meublé de tourisme non classé. Le régime réel "
                "gagne mécaniquement du terrain, et le classement du meublé aussi. Voir notre "
                "article sur la <a href=\"/loi-le-meur-location-courte-duree\">loi Le Meur</a>.</p>",
            ]),
            ("Ce que le réel permet de déduire", [
                "<p>La liste est large, et c'est tout l'intérêt :</p>",
                "<ul>"
                "<li>intérêts d'emprunt et frais de dossier ;</li>"
                "<li>taxe foncière, charges de copropriété, assurances ;</li>"
                "<li>frais de conciergerie et commissions de plateformes ;</li>"
                "<li>ménage, linge, consommables ;</li>"
                "<li>travaux d'entretien et de réparation ;</li>"
                "<li>frais de comptabilité ;</li>"
                "<li>et surtout l'<strong>amortissement</strong> du bien (hors terrain) et du "
                "mobilier, qui constitue une charge déductible sans décaissement.</li>"
                "</ul>",
                "<p>C'est l'amortissement qui explique qu'un loueur au réel affiche fréquemment un "
                "résultat fiscal très faible, voire nul, pendant plusieurs années — tout en "
                "encaissant des loyers.</p>",
            ]),
            ("La méthode d'arbitrage, en trois étapes", [
                "<p><strong>1. Additionnez vos charges réelles annuelles</strong>, amortissement "
                "compris. Comptez tout : notre article sur "
                "<a href=\"/charges-location-courte-duree\">les charges d'une location courte "
                "durée</a> donne la liste complète.</p>",
                "<p><strong>2. Comparez au montant de l'abattement forfaitaire</strong> auquel "
                "vous auriez droit au micro-BIC, compte tenu de votre statut classé ou non.</p>",
                "<p><strong>3. Si vos charges réelles dépassent l'abattement, le réel est "
                "gagnant</strong> — et l'écart est souvent large dès qu'il y a un emprunt en "
                "cours, puisque les intérêts s'ajoutent à l'amortissement.</p>",
                "<p>Règle empirique : un bien financé à crédit, meublé, avec des frais de gestion, "
                "bascule presque toujours au réel. Un studio détenu sans emprunt, peu chargé, peut "
                "rester au micro.</p>",
            ]),
            ("Les points de vigilance", [
                "<p><strong>La revente.</strong> Le traitement des amortissements au moment du "
                "calcul de la plus-value a évolué avec la loi de finances pour 2025. C'est un "
                "point à examiner avec votre comptable si vous envisagez de revendre à moyen "
                "terme : il peut modifier l'arbitrage.</p>",
                "<p><strong>L'engagement.</strong> L'option pour le réel s'exerce dans des délais "
                "précis et engage sur plusieurs années. Ce n'est pas un choix qu'on inverse d'une "
                "déclaration à l'autre.</p>",
                "<p><strong>Le coût du comptable.</strong> Il est déductible, et souvent inférieur "
                "à l'économie d'impôt réalisée. Mais il existe : intégrez-le au calcul.</p>",
            ]),
        ],
        faq=[
            ("Le micro-BIC est-il vraiment plus simple ?",
             "Oui, administrativement : vous déclarez vos recettes, l'abattement est automatique. "
             "La question n'est pas la simplicité mais le montant d'impôt payé au bout."),
            ("Peut-on amortir le bien au micro-BIC ?",
             "Non. L'amortissement n'existe qu'au régime réel — c'est précisément ce qui fait sa "
             "force."),
            ("Faut-il un comptable au régime réel ?",
             "Ce n'est pas juridiquement obligatoire, mais c'est vivement recommandé : la liasse "
             "fiscale et le plan d'amortissement ne s'improvisent pas."),
            ("Le classement du meublé change-t-il l'arbitrage ?",
             "Oui : il donne droit à un abattement plus favorable au micro-BIC et à un plafond de "
             "recettes plus élevé. Il mérite d'être étudié avant de trancher."),
        ],
        related=[("Loi Le Meur", "/loi-le-meur-location-courte-duree"),
                 ("Les charges d'une location courte durée", "/charges-location-courte-duree"),
                 ("Calculer sa rentabilité", "/calculer-rentabilite-location-courte-duree"),
                 ("Fiscalité en Île-de-France", "/fiscalite-airbnb-ile-de-france")],
    ),

    dict(
        slug="charges-location-courte-duree",
        cat="Rentabilité", crumb="Les charges réelles",
        title="Les charges réelles d'une location courte durée : la liste complète",
        h1="Ce que coûte vraiment une location courte durée",
        desc="Ménage, linge, consommables, commissions, énergie, taxe foncière, assurance, "
             "renouvellement du mobilier : la liste complète des charges à déduire avant de "
             "parler de rentabilité.",
        date="2026-06-10", date_txt="10 juin 2026", lecture=7,
        lead="La plupart des déceptions en location courte durée viennent du même endroit : on a "
             "raisonné en revenu brut. Voici tout ce qui se glisse entre ce que le voyageur paie "
             "et ce qui reste sur votre compte.",
        sections=[
            ("Les charges par séjour", [
                "<p>Ce sont celles qui varient avec le nombre de rotations — et c'est ce qui rend "
                "la courte durée si différente de la location classique.</p>",
                "<ul>"
                "<li><strong>Ménage</strong> : le poste principal. Il augmente mécaniquement avec "
                "le nombre de séjours, pas avec le revenu.</li>"
                "<li><strong>Linge</strong> : draps, serviettes, blanchisserie. Prévoyez au moins "
                "trois jeux complets en rotation pour tenir un enchaînement départ-arrivée le même "
                "jour.</li>"
                "<li><strong>Consommables</strong> : produits d'accueil, papier, café, produits "
                "d'entretien.</li>"
                "<li><strong>Commission de plateforme</strong>, prélevée sur chaque "
                "réservation.</li>"
                "</ul>",
                "<p>Point souvent négligé : deux séjours de trois nuits coûtent bien plus cher à "
                "servir qu'un séjour de six nuits au même prix total. C'est la raison pour "
                "laquelle nous relevons souvent les durées minimales de séjour.</p>",
            ]),
            ("Les charges fixes annuelles", [
                "<ul>"
                "<li><strong>Taxe foncière</strong>.</li>"
                "<li><strong>Charges de copropriété</strong>, y compris les provisions pour "
                "travaux.</li>"
                "<li><strong>Assurance</strong> : un contrat adapté à la location saisonnière, pas "
                "une multirisque habitation classique.</li>"
                "<li><strong>Énergie, eau, internet</strong> : à votre charge, et le poste dérape "
                "vite quand les voyageurs laissent la climatisation tourner fenêtre ouverte.</li>"
                "<li><strong>Abonnements</strong> : logiciel de calendrier, serrure connectée, "
                "boîte à clés.</li>"
                "<li><strong>Comptabilité</strong>, au régime réel.</li>"
                "<li><strong>Cotisation foncière des entreprises</strong>, due dans la plupart des "
                "cas — à vérifier auprès de votre service des impôts.</li>"
                "</ul>",
            ]),
            ("Les charges qu'on oublie systématiquement", [
                "<p><strong>Le renouvellement du mobilier.</strong> En courte durée, l'usure est "
                "sans commune mesure avec une location classique : matelas, linge, vaisselle, "
                "petit électroménager se remplacent régulièrement. Provisionnez.</p>",
                "<p><strong>La vacance.</strong> Un calendrier n'est jamais plein. Raisonner sur "
                "365 nuits, c'est se mentir ; raisonner sur un taux d'occupation réaliste, c'est "
                "faire un calcul.</p>",
                "<p><strong>Votre temps.</strong> Si vous gérez seul, comptez-le. Messages, "
                "planning de ménage, réassorts, incidents : notre article "
                "<a href=\"/gerer-seul-ou-deleguer-airbnb\">gérer seul ou déléguer</a> chiffre "
                "ce volume horaire.</p>",
                "<p><strong>Les impayés et les dégradations.</strong> Rares s'ils sont bien "
                "prévenus, mais jamais nuls.</p>",
            ]),
            ("Comment on réduit ces charges", [
                "<p>Trois leviers marchent réellement :</p>",
                "<ul>"
                "<li><strong>Allonger la durée moyenne de séjour.</strong> C'est le levier le plus "
                "puissant : moins de rotations, moins de ménage, moins de linge, même revenu.</li>"
                "<li><strong>Mutualiser.</strong> Une conciergerie qui gère plusieurs biens dans le "
                "même secteur amortit les déplacements et négocie la blanchisserie.</li>"
                "<li><strong>Équiper juste.</strong> Un bon matelas coûte cher une fois ; un "
                "mauvais matelas coûte des avis pendant deux ans.</li>"
                "</ul>",
            ]),
            ("La bonne façon de présenter le calcul", [
                "<p>Prenez vos recettes annuelles réalistes, déduisez les charges par séjour "
                "multipliées par le nombre de séjours, puis les charges fixes. Vous obtenez un "
                "revenu net avant impôt. C'est ce chiffre-là — et lui seul — qui doit être comparé "
                "à ce que rapporterait une location classique.</p>",
                "<p>Notre <a href=\"/simulateur-revenus-airbnb\">simulateur</a> applique exactement "
                "cette logique à partir de vos propres hypothèses.</p>",
            ]),
        ],
        faq=[
            ("Quel est le poste de charge le plus lourd ?",
             "Le ménage et le linge, parce qu'ils augmentent avec le nombre de rotations et non "
             "avec le revenu. C'est pourquoi allonger la durée moyenne de séjour améliore la "
             "marge plus sûrement qu'augmenter le prix."),
            ("Peut-on refacturer le ménage aux voyageurs ?",
             "Oui, les frais de ménage sont une ligne standard des plateformes. Attention "
             "toutefois : un montant élevé pèse sur le prix total affiché et fait fuir les "
             "séjours courts."),
            ("Faut-il une assurance spécifique ?",
             "Oui. Une multirisque habitation classique ne couvre pas correctement l'activité de "
             "location saisonnière. Les garanties des plateformes existent mais ne remplacent pas "
             "un contrat adapté."),
            ("Comment provisionner l'usure ?",
             "En mettant de côté une part de chaque revenu mensuel. En courte durée, le mobilier "
             "et le linge se renouvellent bien plus vite qu'en location classique."),
        ],
        related=[("Calculer sa rentabilité", "/calculer-rentabilite-location-courte-duree"),
                 ("Micro-BIC ou réel ?", "/micro-bic-ou-reel-location-meublee"),
                 ("Simulateur de revenus", "/simulateur-revenus-airbnb"),
                 ("Combien coûte une conciergerie ?", "/combien-coute-une-conciergerie-airbnb")],
    ),

    dict(
        slug="calculer-rentabilite-location-courte-duree",
        cat="Rentabilité", crumb="Calculer sa rentabilité",
        title="Calculer la rentabilité d'une location courte durée : la méthode",
        h1="Calculer la rentabilité d'une location courte durée, sans se raconter d'histoires",
        desc="La méthode complète pour estimer ce que rapporte un logement en courte durée : "
             "revenu brut réaliste, taux d'occupation, charges, rendement net — et les erreurs de "
             "calcul les plus fréquentes.",
        date="2026-06-24", date_txt="24 juin 2026", lecture=8,
        lead="« Ça rapporte combien ? » La réponse honnête tient en une méthode, pas en un "
             "pourcentage. Voici celle que nous utilisons pour estimer un bien avant de le "
             "prendre en gestion.",
        sections=[
            ("Étape 1 : trouver le prix moyen réel de votre secteur", [
                "<p>Pas le prix affiché : le prix <strong>réellement pratiqué</strong> par des "
                "biens comparables au vôtre. Comparable veut dire : même quartier, même surface, "
                "même capacité de couchage, même niveau de finition.</p>",
                "<p>Concrètement, on regarde une dizaine d'annonces similaires sur plusieurs mois "
                "et on observe leurs calendriers : les dates bloquées indiquent ce qui se vend "
                "vraiment, et à quel prix. Une annonce à 200 € la nuit dont le calendrier est vide "
                "ne vaut rien comme référence.</p>",
            ]),
            ("Étape 2 : poser un taux d'occupation crédible", [
                "<p>C'est là que la plupart des calculs dérapent. Un taux d'occupation se raisonne "
                "<strong>mois par mois</strong>, pas en moyenne annuelle : un bien de bord de mer "
                "peut afficher un taux très élevé en juillet-août et quasi nul en janvier.</p>",
                "<p>Deux repères de méthode :</p>",
                "<ul>"
                "<li>construisez douze lignes, une par mois, avec un taux propre à chacun ;</li>"
                "<li>retirez les nuits que vous vous réservez, et celles perdues entre deux "
                "séjours.</li>"
                "</ul>",
                "<p>Et si votre logement est une résidence principale, plafonnez le total au quota "
                "légal de nuitées — voir "
                "<a href=\"/plafond-120-nuits-residence-principale\">notre article</a>.</p>",
            ]),
            ("Étape 3 : déduire les charges, toutes les charges", [
                "<p>Le revenu brut ne veut rien dire. Reprenez la liste complète dans notre "
                "article sur <a href=\"/charges-location-courte-duree\">les charges d'une location "
                "courte durée</a> : charges par séjour, charges fixes annuelles, provision pour "
                "usure, et frais de gestion si vous déléguez.</p>",
                "<p>Vous obtenez alors un <strong>revenu net avant impôt</strong>. C'est le seul "
                "chiffre comparable d'un scénario à l'autre.</p>",
            ]),
            ("Étape 4 : calculer le rendement, et le comparer", [
                "<p>Le rendement net se calcule en rapportant ce revenu net annuel au coût total "
                "de l'opération — prix d'achat, frais de notaire, travaux, ameublement — et non au "
                "seul prix d'achat. C'est une différence considérable sur un bien rénové.</p>",
                "<p>Puis comparez à l'alternative : que rapporterait le même bien en location "
                "meublée classique ou en bail mobilité, charges déduites ? La courte durée doit "
                "gagner <strong>nettement</strong> pour justifier le surcroît de gestion et de "
                "risque réglementaire. Si l'écart est faible, la longue durée est probablement le "
                "meilleur choix. Voir "
                "<a href=\"/courte-moyenne-longue-duree-comparatif\">notre comparatif</a>.</p>",
            ]),
            ("Les cinq erreurs qui faussent tout", [
                "<ul>"
                "<li><strong>Raisonner sur 365 nuits.</strong> Aucun bien n'est plein toute "
                "l'année.</li>"
                "<li><strong>Prendre le prix des semaines de pointe</strong> comme prix moyen.</li>"
                "<li><strong>Oublier les frais de ménage et de linge</strong>, qui grimpent avec "
                "le nombre de séjours.</li>"
                "<li><strong>Ignorer la réglementation locale</strong> : un revenu qu'on n'a pas le "
                "droit d'encaisser n'est pas un revenu.</li>"
                "<li><strong>Ne pas compter son temps</strong> quand on gère soi-même.</li>"
                "</ul>",
                "<p>Notre <a href=\"/simulateur-revenus-airbnb\">simulateur de revenus</a> vous "
                "fait renseigner ces hypothèses une à une, précisément pour éviter ces cinq "
                "écueils. Et si vous préférez que nous fassions le calcul sur votre bien réel, "
                "l'<a href=\"/estimation-rentabilite-airbnb\">estimation est gratuite</a>.</p>",
            ]),
        ],
        faq=[
            ("Quel rendement viser en courte durée ?",
             "Nous ne publions pas de pourcentage cible : il dépend de la ville, du prix d'achat, "
             "de la saisonnalité et de la réglementation. Un rendement annoncé sans ces quatre "
             "paramètres est un argument commercial, pas un calcul."),
            ("Comment connaître le taux d'occupation de mon secteur ?",
             "En observant les calendriers des annonces comparables sur plusieurs mois. C'est "
             "long, et c'est exactement ce que nous faisons dans nos estimations."),
            ("Faut-il inclure les frais de conciergerie dans le calcul ?",
             "Oui, systématiquement, comme n'importe quelle autre charge. Comparer un scénario "
             "géré et un scénario délégué sans compter la gestion n'a aucun sens."),
            ("Le revenu brut affiché par les plateformes est-il fiable ?",
             "Il correspond à ce que le voyageur paie, commissions et ménage inclus. Ce n'est pas "
             "ce que vous encaissez, et encore moins ce que vous conservez."),
        ],
        related=[("Les charges réelles", "/charges-location-courte-duree"),
                 ("Simulateur de revenus", "/simulateur-revenus-airbnb"),
                 ("Courte, moyenne ou longue durée ?", "/courte-moyenne-longue-duree-comparatif"),
                 ("Estimation gratuite", "/estimation-rentabilite-airbnb")],
    ),

    dict(
        slug="courte-moyenne-longue-duree-comparatif",
        cat="Rentabilité", crumb="Comparatif des durées",
        title="Courte, moyenne ou longue durée : le comparatif pour un propriétaire",
        h1="Courte, moyenne ou longue durée : lequel rapporte le plus, vraiment ?",
        desc="Location touristique, bail mobilité ou bail meublé classique : revenus, charges, "
             "contraintes réglementaires et charge de gestion comparés, pour choisir le régime le "
             "plus rentable selon votre bien.",
        date="2026-07-08", date_txt="8 juillet 2026", lecture=8,
        lead="La courte durée rapporte davantage par nuit. La longue durée coûte beaucoup moins "
             "cher à servir. Entre les deux, le bail mobilité est l'option la plus sous-utilisée "
             "du marché français. Voici comment trancher.",
        sections=[
            ("Les trois régimes en une minute", [
                "<ul>"
                "<li><strong>Courte durée (meublé de tourisme)</strong> : à la nuit, clientèle de "
                "passage. Revenu par nuit le plus élevé, charges d'exploitation les plus lourdes, "
                "réglementation la plus stricte.</li>"
                "<li><strong>Moyenne durée (bail mobilité)</strong> : de 1 à 10 mois, non "
                "renouvelable, sans dépôt de garantie, réservé aux publics en mobilité — "
                "étudiants, stagiaires, salariés en mission. Aucun plafond de nuitées, aucune "
                "autorisation de changement d'usage.</li>"
                "<li><strong>Longue durée (bail meublé classique)</strong> : un an, renouvelable. "
                "Revenu le plus faible, mais quasi aucune charge d'exploitation ni gestion "
                "quotidienne.</li>"
                "</ul>",
            ]),
            ("Ce que chacun coûte à servir", [
                "<p>C'est le point que les comparatifs oublient. À revenu brut égal, les trois "
                "régimes ne laissent pas du tout la même chose :</p>",
                "<ul>"
                "<li>en <strong>courte durée</strong>, il faut financer le ménage et le linge à "
                "chaque rotation, les consommables, les commissions de plateforme, l'énergie, et "
                "provisionner une usure rapide ;</li>"
                "<li>en <strong>moyenne durée</strong>, un seul ménage par occupant, pas de "
                "commission de plateforme, usure modérée ;</li>"
                "<li>en <strong>longue durée</strong>, presque rien, et les charges courantes sont "
                "souvent à la charge du locataire.</li>"
                "</ul>",
                "<p>Un écart de revenu brut de 40 % en faveur de la courte durée peut ainsi "
                "s'évaporer une fois les charges déduites — surtout sur un petit logement à "
                "rotation rapide.</p>",
            ]),
            ("Le bail mobilité, l'option la plus sous-estimée", [
                "<p>Créé par la loi ELAN, il coche beaucoup de cases pour un propriétaire "
                "urbain :</p>",
                "<ul>"
                "<li>loyer mensuel nettement supérieur à celui d'un bail nu ;</li>"
                "<li>durée de 1 à 10 mois, non renouvelable : vous récupérez le bien à date "
                "certaine ;</li>"
                "<li>aucun plafond de nuitées, aucune autorisation de changement d'usage ;</li>"
                "<li>très peu de rotations, donc des charges d'exploitation faibles ;</li>"
                "<li>une demande structurelle près des pôles universitaires, hospitaliers, "
                "aéroportuaires et industriels.</li>"
                "</ul>",
                "<p>C'est la formule que nous recommandons le plus souvent lorsqu'un bien "
                "n'obtient pas le droit de louer en courte durée, ou en complément de saison. Voir "
                "nos pages <a href=\"/conciergerie-airbnb-paris-saclay\">plateau de "
                "Paris-Saclay</a> et "
                "<a href=\"/conciergerie-airbnb-banlieue-parisienne\">banlieue parisienne</a>, où "
                "elle domine.</p>",
            ]),
            ("Comment choisir : trois questions", [
                "<p><strong>1. Ai-je le droit ?</strong> Résidence principale ou secondaire, "
                "commune soumise au changement d'usage, règlement de copropriété. Si la courte "
                "durée est fermée, la question est réglée.</p>",
                "<p><strong>2. Quelle est la demande locale, mois par mois ?</strong> Une ville "
                "touristique très saisonnière appelle un régime mixte ; une ville d'affaires ou "
                "universitaire appelle la moyenne durée.</p>",
                "<p><strong>3. Quel niveau d'implication j'accepte ?</strong> La courte durée non "
                "déléguée, c'est un second métier. Déléguée, elle reste souvent gagnante — à "
                "condition de compter les frais de gestion dans le calcul.</p>",
            ]),
            ("La formule mixte, souvent la meilleure", [
                "<p>Sur beaucoup de biens, le meilleur revenu annuel ne vient d'aucun régime pur "
                "mais de leur combinaison : courte durée sur les périodes de pointe — salons, "
                "festivals, vacances scolaires, grands événements — et bail mobilité sur le reste "
                "de l'année.</p>",
                "<p>Cette bascule demande d'anticiper les dates plusieurs mois à l'avance, et de "
                "savoir remplir un bail mobilité rapidement. C'est du travail, mais c'est là que "
                "se trouve l'écart de revenu.</p>",
            ]),
        ],
        faq=[
            ("Le bail mobilité est-il risqué pour le propriétaire ?",
             "Il ne comporte pas de dépôt de garantie, ce qui inquiète souvent. En contrepartie, "
             "le locataire relève d'un public identifié, la durée est courte et non renouvelable, "
             "et la caution Visale peut couvrir le risque locatif."),
            ("Peut-on alterner les régimes dans l'année ?",
             "Oui, à condition de respecter les règles de chacun et de ne pas engager le logement "
             "sur des périodes qui se chevauchent. C'est précisément le travail de pilotage d'une "
             "conciergerie."),
            ("La longue durée est-elle toujours moins rentable ?",
             "Non. Sur un bien excentré, avec peu de demande touristique et beaucoup de rotations "
             "à prévoir, la longue durée peut laisser davantage une fois les charges déduites."),
            ("Quel régime pour une résidence secondaire en zone tendue ?",
             "Sans autorisation de changement d'usage, la courte durée est fermée : bail mobilité "
             "ou bail meublé classique sont les options réalistes."),
        ],
        related=[("Changement d'usage", "/changement-usage-meuble-tourisme"),
                 ("Les charges réelles", "/charges-location-courte-duree"),
                 ("Calculer sa rentabilité", "/calculer-rentabilite-location-courte-duree"),
                 ("Gestion locative en France", "/gestion-locative-france")],
    ),
]
