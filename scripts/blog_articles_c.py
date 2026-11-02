# -*- coding: utf-8 -*-
"""Articles de blog — série de novembre 2026 : préparer la saison 2027.

Règles maison : aucun chiffre de performance inventé, aucun avis fictif. Les
règles de droit citées sont celles de la loi n° 2024-1039 du 19 novembre 2024
(dite loi Le Meur), de la loi de finances pour 2025 et de la loi de finances
pour 2026 ; là où les textes d'application ou les seuils peuvent encore bouger,
l'article le dit et renvoie le lecteur à sa mairie ou à service-public.fr.
"""
from __future__ import annotations

ARTICLES = [
    dict(
        slug="loi-le-meur-meuble-de-tourisme-2027",
        cat="Réglementation", crumb="Loi Le Meur",
        title="Loi Le Meur : ce qui change pour votre meublé de tourisme",
        h1="Loi Le Meur : ce qu'un propriétaire doit avoir réglé avant la saison 2027",
        desc="Numéro d'enregistrement, plafond de nuitées, DPE, abattement fiscal, copropriété : "
             "les obligations de la loi du 19 novembre 2024 et l'ordre dans lequel les traiter.",
        date="2026-11-02", date_txt="2 novembre 2026", lecture=8,
        lead="La loi du 19 novembre 2024, dite loi Le Meur, a changé les règles du jeu de la "
             "location de courte durée. Deux ans plus tard, une partie de ses mesures est en "
             "vigueur, une autre arrive par décrets. Voici ce qu'il faut avoir vérifié avant "
             "d'ouvrir son calendrier pour 2027, sans paniquer ni ignorer.",
        sections=[
            ("Trois volets, un seul objectif", [
                "<p>La loi vise à <strong>réguler</strong> la location touristique, pas à l'interdire. "
                "Elle agit sur trois plans : l'<strong>enregistrement</strong> des logements, la "
                "<strong>fiscalité</strong> des revenus et les <strong>pouvoirs des maires</strong> "
                "(plafond de nuitées, changement d'usage, quotas). Chaque volet a son calendrier.</p>",
                "<p>Le bon réflexe n'est pas de lire la loi, mais de se poser quatre questions sur "
                "<em>votre</em> logement : est-il déclaré ? est-ce votre résidence principale ? quel "
                "est son DPE ? votre copropriété a-t-elle voté quelque chose ?</p>",
            ]),
            ("1. L'enregistrement devient la règle partout", [
                "<p>Avant la loi, seules les communes qui l'avaient décidé imposaient un numéro "
                "d'enregistrement. La loi <strong>généralise la déclaration avec enregistrement</strong> "
                "à toutes les communes et prévoit un <strong>téléservice national</strong> unique. "
                "L'échéance fixée par le texte est le 20 mai 2026 ; à la date où nous écrivons, les "
                "communes continuent de délivrer les numéros par leurs propres guichets et la mise en "
                "service du portail national est annoncée pour la fin 2026. Vérifiez l'état exact sur "
                "service-public.fr ou auprès de votre mairie.</p>",
                "<p>Concrètement : si votre commune délivre déjà un numéro, <strong>il doit figurer sur "
                "l'annonce</strong>, résidence principale comprise. Si elle ne le fait pas encore, la "
                "déclaration simple en mairie (formulaire Cerfa 14004) reste obligatoire pour une "
                "résidence secondaire. Les plateformes bloquent les annonces sans numéro là où il est "
                "exigé : c'est le premier point à régler, avant les photos et avant les prix.</p>",
            ]),
            ("2. Résidence principale : 120 nuits, et parfois 90", [
                "<p>Louer sa résidence principale reste possible <strong>120 nuits par an</strong> au "
                "maximum. La loi permet désormais aux communes d'<strong>abaisser ce plafond à 90 "
                "nuits</strong> par délibération. Paris l'a fait ; d'autres villes tendues peuvent "
                "suivre. Le compteur est tenu par les plateformes, qui bloquent le calendrier une fois "
                "le plafond atteint.</p>",
                "<p>Au-delà du plafond, ou pour une résidence secondaire en zone tendue, on entre dans "
                "le régime du <strong>changement d'usage</strong> : autorisation de la mairie, parfois "
                "avec compensation. Nous avons détaillé ce mécanisme dans notre guide sur "
                "<a href=\"/changement-usage-meuble-tourisme\">le changement d'usage</a>.</p>",
            ]),
            ("3. Le DPE entre dans le jeu", [
                "<p>C'est la nouveauté la plus sous-estimée. Un logement qui passe par une "
                "<strong>autorisation de changement d'usage</strong> doit présenter un DPE de classe "
                "<strong>A à E</strong> jusqu'en 2033, puis <strong>A à D</strong> à partir de 2034. "
                "Au 1<sup>er</sup> janvier 2034, l'exigence A à D s'appliquera à <strong>tous</strong> "
                "les meublés de tourisme, sauf la résidence principale du loueur. Le maire peut "
                "demander un DPE valide à tout moment.</p>",
                "<p>Un bien classé F ou G destiné à la courte durée hors résidence principale est donc "
                "un bien <strong>à rénover avant d'investir</strong> dans la décoration. L'ordre des "
                "travaux a changé : l'isolation et le chauffage avant le canapé.</p>",
            ]),
            ("4. La fiscalité : l'abattement a baissé, le classement rapporte", [
                "<p>Pour un meublé de tourisme <strong>non classé</strong>, le régime micro-BIC "
                "applique un abattement de <strong>30 %</strong> avec un plafond de recettes de "
                "<strong>15 000 €</strong>. Pour un meublé <strong>classé</strong>, l'abattement reste "
                "de <strong>50 %</strong> avec un plafond bien plus élevé (77 700 € selon le texte, "
                "les sources divergent sur une revalorisation en 2026 : vérifiez sur impots.gouv.fr).</p>",
                "<p>Deux conséquences pratiques. D'abord, le <strong>classement en meublé de "
                "tourisme</strong> (de 1 à 5 étoiles, par un organisme agréé, valable cinq ans) "
                "devient un levier fiscal direct. Ensuite, dès que les charges réelles sont "
                "importantes (intérêts d'emprunt, travaux, commission de gestion, amortissement), le "
                "<strong>régime réel</strong> bat souvent le micro-BIC à 30 %. Notre article sur "
                "<a href=\"/fiscalite-airbnb-ile-de-france\">la fiscalité en Île-de-France</a> "
                "détaille l'arbitrage.</p>",
            ]),
            ("5. La copropriété peut dire non", [
                "<p>La loi a facilité l'<strong>interdiction de la location de courte durée par "
                "l'assemblée générale</strong> et impose au loueur d'<strong>informer le syndic</strong> "
                "de son activité. Avant toute mise en location, relisez le règlement de copropriété "
                "(clause d'habitation bourgeoise, interdiction d'activité commerciale) et les derniers "
                "procès-verbaux. Un logement interdit par sa copropriété ne se rattrape pas avec une "
                "bonne annonce.</p>",
            ]),
            ("Dans quel ordre s'en occuper", [
                "<ol>"
                "<li><strong>Copropriété</strong> : règlement et procès-verbaux, information du syndic.</li>"
                "<li><strong>Déclaration et numéro</strong> : mairie ou téléservice, numéro sur l'annonce.</li>"
                "<li><strong>DPE</strong> : diagnostic valide, travaux si F ou G.</li>"
                "<li><strong>Classement</strong> : visite d'un organisme agréé, dossier en quelques semaines.</li>"
                "<li><strong>Choix du régime fiscal</strong> : micro-BIC ou réel, avec un expert-comptable "
                "si les charges sont significatives.</li>"
                "</ol>",
                "<p>Une conciergerie sérieuse prend en charge les quatre premiers points avec vous et "
                "<strong>refuse de mettre en ligne un bien non conforme</strong>. C'est notre règle : un "
                "revenu locatif durable ne se construit pas sur une zone grise.</p>",
            ]),
        ],
        faq=[
            ("Le téléservice national d'enregistrement est-il ouvert ?",
             "La loi fixe l'échéance au 20 mai 2026, mais la mise en service effective a été "
             "annoncée pour la fin 2026. En attendant, les communes qui exigent un numéro le "
             "délivrent via leur propre guichet. Vérifiez sur service-public.fr."),
            ("Le plafond de 90 nuits s'applique-t-il partout ?",
             "Non. La règle nationale reste 120 nuits pour la résidence principale ; chaque commune "
             "peut l'abaisser à 90 par délibération. Renseignez-vous auprès de votre mairie."),
            ("Mon logement classé F peut-il être loué en courte durée ?",
             "S'il s'agit de votre résidence principale, oui, dans la limite des nuitées. Pour un "
             "bien soumis à changement d'usage, un DPE E minimum est exigé jusqu'en 2033, puis D. "
             "À partir de 2034, tous les meublés de tourisme devront être classés A à D."),
            ("Le classement en meublé de tourisme vaut-il le coût ?",
             "Dans la plupart des cas, oui : il fait passer l'abattement micro-BIC de 30 % à 50 % "
             "et rassure les voyageurs. La visite de classement coûte en général entre 150 et 250 € "
             "et le classement vaut cinq ans."),
        ],
        related=[
            ("Le changement d'usage, expliqué", "/changement-usage-meuble-tourisme"),
            ("Fiscalité Airbnb en Île-de-France", "/fiscalite-airbnb-ile-de-france"),
            ("Combien coûte une conciergerie Airbnb ?", "/combien-coute-une-conciergerie-airbnb"),
            ("Notre gestion clé en main", "/proprietaires"),
        ],
    ),
    dict(
        slug="lmnp-2026-amortissement-plus-value",
        cat="Fiscalité", crumb="LMNP 2026",
        title="LMNP en 2026 : amortissement, plus-value, ce qui a changé",
        h1="LMNP en 2026 : ce que la loi de finances a changé, et ce qu'elle n'a pas touché",
        desc="Statut LMNP maintenu, amortissement conservé, mais amortissements réintégrés dans la "
             "plus-value à la revente depuis 2025 : les règles 2026 pour un propriétaire en "
             "location meublée, avec un exemple chiffré.",
        date="2026-11-02", date_txt="2 novembre 2026", lecture=7,
        lead="Chaque automne, la rumeur de la « fin du LMNP » revient avec le projet de loi de "
             "finances. En 2026, le statut est toujours là, l'amortissement aussi. Ce qui a "
             "réellement changé se joue au moment de la revente. Voici les règles, sans "
             "dramatisation.",
        sections=[
            ("Ce que la loi de finances pour 2026 n'a pas changé", [
                "<p>La loi de finances pour 2026, promulguée le 19 février 2026, <strong>n'a pas "
                "supprimé le statut de loueur en meublé non professionnel</strong> et n'a pas "
                "plafonné l'amortissement. Les amendements qui proposaient de limiter l'amortissement "
                "déductible ont été rejetés. Le régime réel fonctionne donc comme avant : les charges, "
                "les intérêts d'emprunt et l'amortissement du bien et du mobilier viennent réduire, "
                "souvent jusqu'à zéro, le revenu imposable des premières années.</p>",
                "<p>Le micro-BIC n'a pas bougé non plus par rapport à 2025 : 30 % d'abattement pour "
                "un meublé de tourisme non classé (plafond 15 000 € de recettes), 50 % pour un meublé "
                "classé.</p>",
            ]),
            ("Ce qui a changé : la plus-value à la revente", [
                "<p>Le vrai changement vient de la <strong>loi de finances pour 2025</strong> et "
                "s'applique aux ventes réalisées <strong>depuis le 15 février 2025</strong> : les "
                "<strong>amortissements déduits pendant la location sont réintégrés dans le calcul "
                "de la plus-value</strong>. Avant, le LMNP cumulait deux avantages : amortir pendant "
                "la détention et revendre sur la base du prix d'achat. Ce cumul a pris fin.</p>",
                "<p>Exemple. Un appartement acheté 200 000 €, amorti pour 40 000 € pendant la "
                "location, revendu 250 000 €. Avant la réforme, la plus-value imposable était de "
                "50 000 €. Depuis le 15 février 2025, elle est de <strong>90 000 €</strong> "
                "(250 000 − 200 000 + 40 000). Les abattements pour durée de détention continuent de "
                "s'appliquer sur ce montant : exonération d'impôt sur le revenu après 22 ans et de "
                "prélèvements sociaux après 30 ans.</p>",
                "<p>Deux précisions. La réintégration vise les amortissements effectivement déduits, "
                "y compris ceux pratiqués avant 2025. Et les logements qui restent exclus de la "
                "réforme sont rares (résidences services sous conditions) : un meublé de tourisme "
                "classique est concerné.</p>",
            ]),
            ("Faut-il renoncer au régime réel ?", [
                "<p>Non, dans la grande majorité des cas. L'amortissement procure une "
                "<strong>économie d'impôt chaque année</strong> au taux marginal du propriétaire, "
                "plus les prélèvements sociaux ; la réintégration se paie <strong>une fois</strong>, "
                "à la revente, au taux de la plus-value immobilière (19 % d'impôt, prélèvements "
                "sociaux en sus) après abattements de durée. Pour un propriétaire qui garde son bien "
                "plus de dix ans, l'avantage annuel l'emporte presque toujours.</p>",
                "<p>Le calcul mérite toutefois d'être fait avec un expert-comptable, surtout si une "
                "revente est envisagée à court terme ou si le bien a été fortement amorti.</p>",
            ]),
            ("Les leviers qui restent ouverts en 2027", [
                "<ul>"
                "<li><strong>Le classement du meublé</strong> : abattement micro-BIC de 50 % au lieu de "
                "30 %, et un plafond de recettes bien plus élevé.</li>"
                "<li><strong>Le régime réel</strong> dès que les charges dépassent l'abattement : "
                "commission de gestion, intérêts, travaux, assurance, amortissement.</li>"
                "<li><strong>La tenue des comptes</strong> : un bilan annuel coûte quelques centaines "
                "d'euros et sécurise l'amortissement en cas de contrôle.</li>"
                "<li><strong>La cotisation foncière des entreprises</strong> (CFE) : due dans la "
                "plupart des cas, avec une base minimale ; à anticiper dans le calcul de rentabilité.</li>"
                "</ul>",
                "<p>Enfin, les débats sur le projet de loi de finances pour 2027 ont déjà commencé et "
                "des pistes de plafonnement circulent. Tant qu'un texte n'est pas promulgué, rien ne "
                "s'applique : nous mettrons cet article à jour.</p>",
            ]),
        ],
        faq=[
            ("Le statut LMNP a-t-il été supprimé en 2026 ?",
             "Non. La loi de finances pour 2026 n'a ni supprimé le statut ni plafonné l'amortissement."),
            ("La réintégration des amortissements concerne-t-elle les amortissements d'avant 2025 ?",
             "Oui. Pour une vente réalisée depuis le 15 février 2025, tous les amortissements "
             "déduits sont réintégrés, quelle que soit leur année."),
            ("Micro-BIC ou réel pour un meublé de tourisme ?",
             "Si les charges réelles (commission, intérêts, travaux, amortissement) dépassent 30 % des "
             "recettes, le réel est en général plus avantageux. Un expert-comptable tranche en "
             "une heure avec vos chiffres."),
            ("Faut-il déclarer son activité LMNP ?",
             "Oui : immatriculation sur le guichet des formalités des entreprises dans les quinze "
             "jours du début de l'activité, pour obtenir un numéro SIRET et choisir son régime."),
        ],
        related=[
            ("Fiscalité Airbnb en Île-de-France", "/fiscalite-airbnb-ile-de-france"),
            ("Calculer la rentabilité d'une location courte durée", "/calculer-rentabilite-location-courte-duree"),
            ("Les charges d'une location courte durée", "/charges-location-courte-duree"),
            ("Loi Le Meur : ce qui change", "/loi-le-meur-meuble-de-tourisme-2027"),
        ],
    ),
    dict(
        slug="checklist-confier-logement-conciergerie",
        cat="Choisir une conciergerie", crumb="Checklist conciergerie",
        title="Confier son logement à une conciergerie : la checklist en 10 points",
        h1="Avant de signer avec une conciergerie : les 10 questions qui évitent les mauvaises surprises",
        desc="Périmètre du mandat, commission et frais annexes, maîtrise du calendrier, linge, "
             "assurance, reporting, sortie du contrat : la liste des points à vérifier avant de "
             "confier un logement en gestion.",
        date="2026-11-02", date_txt="2 novembre 2026", lecture=7,
        lead="Un contrat de gestion se signe en dix minutes et se subit pendant un an. Les "
             "propriétaires déçus ont presque tous la même histoire : ils ont comparé des "
             "pourcentages, pas des périmètres. Voici ce qu'il faut demander, et ce que nous "
             "répondons.",
        sections=[
            ("1. Qu'est-ce qui est inclus dans la commission, exactement ?", [
                "<p>Demandez la liste écrite : annonce, photos, tarification, messages voyageurs, "
                "arrivées, ménages, linge, petites réparations, gestion des avis, reporting. Puis "
                "demandez <strong>ce qui est facturé en plus</strong> : frais de mise en service, "
                "shooting, produits d'accueil, déplacements, gestion des incidents. Une commission "
                "basse avec quatre lignes de frais annexes coûte souvent plus cher qu'une commission "
                "complète.</p>",
            ]),
            ("2. Qui paie le ménage et le linge ?", [
                "<p>Dans la plupart des modèles, le ménage est <strong>facturé au voyageur</strong> via "
                "les frais de ménage de l'annonce, et le linge est soit loué, soit fourni par le "
                "propriétaire. Faites préciser le circuit : qui achète, qui lave, qui remplace, et ce "
                "qui se passe quand un drap est taché. Un linge hôtelier bien géré pèse directement "
                "sur les avis.</p>",
            ]),
            ("3. Qui garde la main sur le calendrier ?", [
                "<p>Vous devez pouvoir <strong>bloquer vos propres dates</strong> sans justification, "
                "avec un préavis raisonnable. Méfiez-vous des contrats qui imposent une disponibilité "
                "minimale ou des pénalités en cas de blocage. Chez nous, vous ouvrez les périodes que "
                "vous voulez louer ; nous ne gérons que celles-là.</p>",
            ]),
            ("4. Les comptes sont-ils à votre nom ?", [
                "<p>Deux modèles existent : l'annonce est publiée depuis <strong>votre compte</strong> "
                "(la conciergerie est co-hôte), ou depuis le compte de la conciergerie. Le premier vous "
                "laisse propriétaire de l'historique et des avis si vous changez de prestataire. "
                "Demandez lequel s'applique et ce qu'il advient de l'annonce à la fin du contrat.</p>",
            ]),
            ("5. Comment sont fixés les prix ?", [
                "<p>Une bonne gestion ajuste les prix selon la saison, les événements et le délai de "
                "réservation. Demandez <strong>qui décide</strong>, si un prix plancher est garanti et "
                "comment vous êtes informé. Nous expliquons notre méthode dans l'article sur la "
                "<a href=\"/tarification-dynamique-airbnb\">tarification dynamique</a>.</p>",
            ]),
            ("6. Qui répond aux voyageurs, et en combien de temps ?", [
                "<p>Le délai de réponse conditionne le classement de l'annonce et la note. Demandez "
                "les horaires de permanence, le délai moyen et ce qui se passe la nuit en cas "
                "d'urgence (clé perdue, fuite, panne de chauffage).</p>",
            ]),
            ("7. Quelle assurance couvre quoi ?", [
                "<p>Trois couches : la garantie de la plateforme, l'assurance du propriétaire "
                "(informer son assureur de l'activité de location meublée est indispensable) et la "
                "responsabilité civile professionnelle de la conciergerie. Demandez l'attestation de "
                "cette dernière et le mode de traitement d'un dégât constaté après un séjour.</p>",
            ]),
            ("8. Quel reporting recevez-vous ?", [
                "<p>Au minimum, un relevé mensuel : nuits louées, revenu brut, frais, commission, net "
                "versé, avec les justificatifs. Un espace propriétaire en ligne avec le calendrier et "
                "les réservations en temps réel est devenu la norme ; l'absence de reporting clair est "
                "un signal d'alerte.</p>",
            ]),
            ("9. La conformité est-elle prise en charge ?", [
                "<p>Déclaration en mairie, numéro d'enregistrement, plafond de nuitées, taxe de séjour, "
                "DPE : demandez qui s'en occupe et ce que fait la conciergerie si le bien n'est pas "
                "conforme. Notre position est simple : nous ne mettons pas en ligne un logement non "
                "déclaré. Les règles sont résumées dans "
                "<a href=\"/loi-le-meur-meuble-de-tourisme-2027\">notre article sur la loi Le Meur</a>.</p>",
            ]),
            ("10. Comment sort-on du contrat ?", [
                "<p>Durée, préavis, frais de sortie, sort des réservations déjà prises et de "
                "l'annonce : tout doit être écrit. Un contrat sans engagement de durée avec un préavis "
                "d'un à deux mois est un bon standard. Les engagements de douze mois reconductibles "
                "sans sortie simple méritent une négociation avant signature.</p>",
            ]),
            ("Ce que vous devez préparer de votre côté", [
                "<ul>"
                "<li>le DPE et les diagnostics du logement ;</li>"
                "<li>le règlement de copropriété et les derniers procès-verbaux ;</li>"
                "<li>la déclaration en mairie ou le numéro d'enregistrement ;</li>"
                "<li>l'inventaire du mobilier et des équipements ;</li>"
                "<li>les accès : clés, boîte à clés ou serrure connectée, codes, compteurs ;</li>"
                "<li>vos dates personnelles pour l'année.</li>"
                "</ul>",
                "<p>Avec ces éléments, une mise en service se fait en deux à trois semaines, "
                "photos comprises.</p>",
            ]),
        ],
        faq=[
            ("Quelle commission est normale pour une conciergerie Airbnb ?",
             "Le marché va de 10 % à 25 % du revenu des nuitées selon le périmètre inclus. "
             "Comparez le périmètre et les frais annexes avant le pourcentage."),
            ("Puis-je utiliser mon logement quand je veux ?",
             "Vous devez pouvoir bloquer vos dates librement. Vérifiez qu'aucune disponibilité "
             "minimale ni pénalité ne figure au contrat."),
            ("L'annonce m'appartient-elle à la fin du contrat ?",
             "Si elle est publiée depuis votre compte, oui, avec son historique et ses avis. Si elle "
             "est publiée depuis le compte de la conciergerie, demandez ce qu'il en advient."),
            ("Combien de temps dure une mise en service ?",
             "Deux à trois semaines en général, le temps de la visite, des photos, de la mise en "
             "ligne et des premiers réglages de prix."),
        ],
        related=[
            ("Combien coûte une conciergerie Airbnb ?", "/combien-coute-une-conciergerie-airbnb"),
            ("Pourquoi passer par une conciergerie ?", "/pourquoi-conciergerie-airbnb"),
            ("Les 8 erreurs des propriétaires", "/erreurs-proprietaires-airbnb"),
            ("Notre gestion clé en main", "/proprietaires"),
        ],
    ),
    dict(
        slug="preparer-saison-2027-calendrier-proprietaire",
        cat="Exploitation", crumb="Saison 2027",
        title="Préparer la saison 2027 : le calendrier du propriétaire",
        h1="De novembre à mars : le calendrier qui fait une bonne saison 2027",
        desc="Mois par mois, ce qu'un propriétaire en location courte durée doit faire entre "
             "novembre et mars pour aborder la saison 2027 avec un logement conforme, une annonce "
             "à jour et des prix prêts.",
        date="2026-11-02", date_txt="2 novembre 2026", lecture=6,
        lead="Les réservations de l'été se prennent dès janvier. Un logement qui n'est pas prêt "
             "en mars rate les réservations anticipées, les mieux payées. Voici le calendrier que "
             "nous suivons pour les biens que nous gérons.",
        sections=[
            ("Novembre : la conformité d'abord", [
                "<ul>"
                "<li><strong>Déclaration et numéro d'enregistrement</strong> : vérifiez qu'ils sont à "
                "jour et affichés sur l'annonce.</li>"
                "<li><strong>DPE</strong> : contrôlez la validité et la classe ; un F ou G hors "
                "résidence principale se traite maintenant, pas en juin.</li>"
                "<li><strong>Copropriété</strong> : relisez le règlement et informez le syndic.</li>"
                "<li><strong>Classement du meublé</strong> : lancez la demande, le délai est de "
                "quelques semaines et l'abattement fiscal passe de 30 % à 50 %.</li>"
                "</ul>",
                "<p>Le détail des obligations est dans "
                "<a href=\"/loi-le-meur-meuble-de-tourisme-2027\">notre article sur la loi Le Meur</a>.</p>",
            ]),
            ("Décembre : les travaux et les équipements", [
                "<p>Profitez de la basse saison pour tout ce qui immobilise le logement : peinture, "
                "literie, chauffe-eau, isolation. Puis passez en revue les équipements qui font monter "
                "le prix et la note : literie de qualité, wifi fiable, espace de travail, machine à "
                "café, rangements vides pour les voyageurs. Nous les avons listés dans "
                "<a href=\"/equipements-qui-augmentent-le-prix\">cet article</a>.</p>",
            ]),
            ("Janvier : photos, annonce, prix", [
                "<p>Un logement rafraîchi mérite de nouvelles photos. Refaites la couverture, "
                "réécrivez le titre et la description avec les atouts de l'année (classement, "
                "nouvel équipement), vérifiez les règles de la maison. Puis construisez la grille de "
                "prix de l'année : saison haute, ponts, vacances scolaires des trois zones, événements "
                "locaux, avec des <strong>tarifs plus élevés pour les réservations anticipées de l'été</strong>. "
                "C'est en janvier et février que se réservent les semaines les plus chères.</p>",
            ]),
            ("Février : ouvrir le calendrier, régler les conditions", [
                "<p>Ouvrez le calendrier jusqu'à la fin de l'année, fixez les durées minimales par "
                "période (plus longues en été, plus courtes hors saison), les conditions d'annulation "
                "et les frais de ménage. Bloquez dès maintenant vos propres dates. Un calendrier ouvert "
                "tôt remonte dans les résultats de recherche.</p>",
            ]),
            ("Mars : le ménage de printemps et le linge", [
                "<p>Grand ménage, vitres, joints, matelas, électroménager, détecteur de fumée. "
                "Comptez le linge et remplacez ce qui est usé : il faut au moins deux jeux complets "
                "par couchage pour enchaîner deux séjours. Vérifiez la boîte à clés ou la serrure "
                "connectée et le guide d'accueil. Le logement est prêt pour les premiers ponts de "
                "mai.</p>",
            ]),
            ("Ce que nous faisons à votre place", [
                "<p>Pour les logements en gestion, ce calendrier est le nôtre : conformité, "
                "préparation, photos, tarification, ouverture du calendrier et linge sont pris en "
                "charge, avec un point mensuel. Si vous voulez savoir ce que votre logement peut "
                "rapporter sur la saison 2027, nous l'estimons gratuitement à partir de biens "
                "comparables réellement loués : "
                "<a href=\"/estimation-rentabilite-airbnb\">demander une estimation</a>.</p>",
            ]),
        ],
        faq=[
            ("Quand ouvrir son calendrier pour l'été ?",
             "Dès janvier. Les séjours d'été se réservent de janvier à avril, et les réservations "
             "anticipées sont celles qui acceptent les prix les plus élevés."),
            ("Faut-il refaire les photos chaque année ?",
             "Pas forcément, mais après des travaux ou un changement d'équipement, oui. Une "
             "couverture datée se repère immédiatement."),
            ("Combien de jeux de linge prévoir ?",
             "Au moins deux jeux complets par couchage, trois si les séjours sont courts et "
             "enchaînés, pour ne jamais dépendre du séchage."),
            ("Le classement du meublé prend-il longtemps ?",
             "Comptez quelques semaines entre la demande, la visite de l'organisme agréé et la "
             "décision. Lancé en novembre, il est acquis pour la saison."),
        ],
        related=[
            ("Les équipements qui font monter le prix", "/equipements-qui-augmentent-le-prix"),
            ("Tarification dynamique", "/tarification-dynamique-airbnb"),
            ("Les photos d'une annonce", "/photos-annonce-airbnb"),
            ("Estimer mes revenus", "/estimation-rentabilite-airbnb"),
        ],
    ),
]
