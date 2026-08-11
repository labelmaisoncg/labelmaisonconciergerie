# -*- coding: utf-8 -*-
"""Silo SEO services : immobilier & horlogerie.

`build()` est le gabarit générique réutilisé par gen_seo_marrakech.py (vans VIP
et activités Marrakech). Chaque page est décrite par un dictionnaire : on garde
ainsi un seul gabarit HTML et un contenu réellement différent d'une page à l'autre.

Aucun prix n'est inventé : les prestations sont annoncées « sur devis », ce qui
est la réalité du métier et évite d'afficher des tarifs faux.
"""
from __future__ import annotations

import seo_common as C

NAV_IMMO = [("Propriétaires", "/proprietaires"),
            ("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
            ("France", "/conciergerie-airbnb-france"),
            ("Conciergerie privée", "/conciergerie-privee-paris")]
NAV_LUXE = [("Conciergerie privée", "/conciergerie-privee-paris"),
            ("Personal shopper", "/personal-shopper-paris"),
            ("Montres de luxe", "/achat-vente-montres-de-luxe"),
            ("Marrakech", "/conciergerie-marrakech")]


def build(s: dict) -> str:
    """Assemble une page à partir de sa spécification (voir PAGES plus bas)."""
    path = "/" + s["slug"]
    url = C.SITE + path
    trail = s["trail"] + [(s["crumb"], path)]
    lds = [
        C.ld_service(s["service_type"], s["area"], url, s["desc"], s.get("offers")),
        C.ld_faq(s["faq"]),
        C.ld_breadcrumb(trail),
    ]
    if s.get("business"):
        lds.insert(0, C.ld_business(s["business"][0], url, s["desc"], s["business"][1],
                                    s["business"][2], s["business"][3],
                                    pays=s["business"][4], geo=s["business"][5],
                                    area=s["business"][6]))
    lds += s.get("ld_extra", [])

    parts = [
        C.head(s["title"], s["desc"], path, lds, image=f"{C.SITE}/images/{s['photo'][0]}"),
        C.header(s["nav"]),
        C.crumb(trail),
        C.hero(s["badge"], s["h1"], s["sub"], s["photo"][0], s["photo"][1], s["puces"],
               cta1=s.get("cta", "Faire une demande")),
        C.texte(s["intro"], pad=True),
        C.cartes(s["cards"][0], s["cards"][1], s["cards"][2]),
    ]
    for titre, paras in s["sections"]:
        parts.append(C.texte(paras, titre=titre))
    if s.get("gallery"):
        parts.append(C.galerie("gal" + s["slug"].replace("-", ""), s["gallery"]))
    parts += [
        C.etapes(s["steps"][0], s["steps"][1]),
        C.cartes(s["why"][0], "", s["why"][1], cols="g2"),
        C.zones(s["zones"][0], s["zones"][1], s["zones"][2], extra=s["zones"][3]),
        C.faq(s["faq_title"], s["faq"]),
        C.formulaire(s["form"][0], s["form"][1], s["form"][2], s["form"][3], s["title"]),
        C.footer(s["footer"], s["tagline"], s["lieu"]),
        C.mobcta(s.get("mobcta", "Faire une demande")),
    ]
    C.write(s["slug"], parts)
    return path


# --------------------------------------------------------------------------- #
#  Immobilier
# --------------------------------------------------------------------------- #
FOOT_IMMO = [("Propriétaires", [("Notre offre de gestion", "/proprietaires"),
                                ("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                                ("Conciergerie Airbnb France", "/conciergerie-airbnb-france"),
                                ("Gestion locative Paris", "/gestion-locative-paris"),
                                ("Investissement locatif Paris", "/investissement-locatif-paris")]),
             ("Ressources", [("Estimer mes revenus Airbnb", "/estimation-rentabilite-airbnb"),
                             ("Fiscalité de la location meublée", "/fiscalite-airbnb-ile-de-france"),
                             ("Gestion Airbnb ou classique ?", "/gestion-airbnb-ou-gestion-classique"),
                             ("Erreurs des propriétaires", "/erreurs-proprietaires-airbnb"),
                             ("Le blog", "/blog")])]

WHY_IMMO = ("Pourquoi passer par Label Maison", [
    ("Un seul interlocuteur",
     "Recherche, travaux, ameublement, mise en location, gestion quotidienne : une seule personne "
     "coordonne l'ensemble et vous rend des comptes."),
    ("Des chiffres, pas des promesses",
     "Nous partons des biens réellement loués autour du vôtre, pas d'un rendement théorique. "
     "Si un projet ne tient pas la route, nous vous le disons avant que vous signiez."),
    ("Le bon régime au bon moment",
     "Location nue, meublée longue durée, bail mobilité, courte durée : nous arbitrons selon la "
     "réglementation locale, votre fiscalité et votre horizon de détention."),
    ("Exécution sur le terrain",
     "Artisans, ameublement, ménage, états des lieux : nous avons les équipes pour livrer, pas "
     "seulement pour conseiller."),
])

PAGES_IMMO = [
    dict(
        slug="gestion-locative-paris",
        title="Gestion locative à Paris — meublé, bail mobilité et courte durée | Label Maison",
        desc="Gestion locative complète à Paris : recherche de locataires, bail mobilité, meublé longue "
             "durée ou courte durée, états des lieux, loyers et travaux. Un interlocuteur unique, "
             "rémunéré au résultat.",
        crumb="Gestion locative Paris",
        trail=[("Accueil", "/"), ("Propriétaires", "/proprietaires")],
        nav=NAV_IMMO,
        service_type="Gestion locative et administration de biens à Paris",
        area="Paris",
        business=(" — Gestion locative Paris", "Paris", "Île-de-France", "75008", "FR",
                  (48.8698, 2.3079), ["Paris", "Île-de-France"]),
        offers=["Recherche et sélection de locataires", "Rédaction de bail et bail mobilité",
                "États des lieux", "Encaissement des loyers", "Coordination des travaux",
                "Gestion locative meublée courte durée"],
        badge="🏠 Paris · Gestion locative",
        h1="Gestion locative à <span class=\"font-serif-italic\">Paris</span>",
        sub="Meublé longue durée, bail mobilité ou courte durée : nous gérons votre bien parisien de "
            "bout en bout — locataires, loyers, travaux, états des lieux — et vous n'avez plus qu'à "
            "suivre vos revenus.",
        photo=("real/logement-suite.jpg", "Appartement parisien en gestion locative"),
        puces=["Locataires <b>sélectionnés</b>", "Loyers <b>suivis</b>",
               "Travaux <b>coordonnés</b>", "Un <b>interlocuteur</b> unique"],
        cta="Confier mon bien",
        intro=[
            "Un bien parisien vide coûte de l'argent chaque mois ; un bien mal loué en coûte encore "
            "plus longtemps. Entre la sélection des dossiers, la rédaction du bail, l'état des lieux, "
            "les régularisations de charges et le premier dégât des eaux un dimanche soir, la gestion "
            "locative demande du temps et une vraie méthode.",
            "<strong>Label Maison Conciergerie</strong> gère des appartements parisiens sous tous les "
            "régimes : location meublée longue durée, bail mobilité de 1 à 10 mois, et location courte "
            "durée quand la réglementation le permet. Nous arbitrons avec vous, puis nous exécutons.",
        ],
        cards=("Ce que couvre notre gestion locative", "Tout ce qui vous prend du temps aujourd'hui.", [
            ("Mise en location",
             "Photos, annonce, diffusion sur les plateformes pertinentes, visites organisées et "
             "regroupées : le bien se reloue vite, sans mois de vacance inutile."),
            ("Sélection des locataires",
             "Vérification des pièces, cohérence des revenus, garanties : nous constituons des dossiers "
             "solides et vous laissons le dernier mot sur le choix final."),
            ("Bail et état des lieux",
             "Rédaction du bail adapté au régime choisi, état des lieux d'entrée et de sortie photo, "
             "dépôt de garantie, diagnostics à jour."),
            ("Loyers et charges",
             "Appels de loyer, suivi des encaissements, relances en cas de retard, régularisation "
             "annuelle des charges : vous voyez arriver l'argent, pas les tracas."),
            ("Travaux et entretien",
             "Réseau d'artisans parisiens, devis comparés, suivi de chantier et réception : nous "
             "traitons de la fuite au rafraîchissement complet entre deux locataires."),
            ("Arbitrage de régime",
             "Nue, meublée, bail mobilité, courte durée : nous recalculons régulièrement ce qui "
             "rapporte le plus à votre bien, au regard de la loi et de votre fiscalité."),
        ]),
        sections=[
            ("Meublé, bail mobilité ou courte durée : que choisir à Paris ?", [
                "<strong>Le meublé longue durée</strong> reste la valeur sûre : bail d'un an "
                "(neuf mois pour un étudiant), loyer supérieur au nu, et une rotation limitée. "
                "C'est la formule la plus tranquille pour un propriétaire qui vit loin de Paris.",
                "<strong>Le bail mobilité</strong> (1 à 10 mois, sans dépôt de garantie, réservé aux "
                "publics en mobilité : étudiants, stagiaires, salariés en mission) offre un loyer "
                "mensuel plus élevé et une grande souplesse. À Paris, la demande dépasse très largement "
                "l'offre — c'est notre recommandation la plus fréquente quand la courte durée n'est pas "
                "autorisée.",
                "<strong>La courte durée</strong> est la plus rémunératrice, mais la plus encadrée : "
                "120 nuits par an maximum en résidence principale, autorisation de changement d'usage "
                "avec compensation en résidence secondaire. Nous ne mettons en ligne que des biens "
                "conformes — voir notre <a href=\"/conciergerie-airbnb-paris\">conciergerie Airbnb à "
                "Paris</a>.",
            ]),
            ("Un bien parisien bien tenu se loue mieux, et plus cher", [
                "À loyer égal, deux appartements identiques ne trouvent pas preneur au même rythme. "
                "Ce qui fait la différence : la qualité des photos, la clarté de l'annonce, la rapidité "
                "de réponse aux candidats, et l'état réel du logement le jour de la visite.",
                "Nous investissons systématiquement sur ces quatre points avant de publier. C'est ce qui "
                "permet, dans la plupart des cas, de relouer sans période de vacance — et une vacance "
                "évitée vaut souvent plus qu'une négociation de loyer.",
            ]),
        ],
        gallery=[C.photo(k) for k in range(6)],
        steps=("Comment nous prenons la main", [
            ("1. Point sur votre bien", "Situation, état, régime actuel, objectifs : nous établissons "
             "ce que le bien peut réellement rapporter."),
            ("2. Recommandation écrite", "Régime conseillé, loyer cible, travaux utiles, calendrier. "
             "Vous décidez en connaissance de cause."),
            ("3. Mise en location", "Préparation, photos, annonce, visites, sélection, bail, "
             "état des lieux : nous exécutons."),
            ("4. Gestion au quotidien", "Loyers, charges, travaux, relation locataire et reporting. "
             "Vous gardez la main, sans y passer de temps."),
        ]),
        why=WHY_IMMO,
        zones=("Nos autres services pour les propriétaires", "",
               [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                ("Investissement locatif Paris", "/investissement-locatif-paris"),
                ("Estimation de rentabilité", "/estimation-rentabilite-airbnb"),
                ("Gestion locative en France", "/gestion-locative-france"),
                ("Notre offre propriétaires", "/proprietaires")],
               "Vous hésitez entre gestion classique et location courte durée ? Nous avons comparé "
               "les deux dans <a href=\"/gestion-airbnb-ou-gestion-classique\"><strong>cet article</strong></a>."),
        faq_title="Questions fréquentes — gestion locative à Paris",
        faq=[
            ("Quels sont vos frais de gestion locative ?",
             "Un pourcentage des loyers encaissés en gestion longue durée, une commission sur les "
             "revenus en courte durée. Pas de frais de dossier ni d'abonnement. Le taux exact dépend "
             "du bien et du niveau de service ; il est indiqué dans la proposition écrite."),
            ("Gérez-vous les impayés ?",
             "Nous sécurisons en amont (vérification des dossiers, garanties) et relançons dès le "
             "premier retard. En cas d'impayé persistant, nous coordonnons la procédure avec votre "
             "assurance loyers impayés ou votre conseil juridique."),
            ("Puis-je récupérer mon logement ?",
             "Oui, dans le respect des délais légaux de congé propres à chaque type de bail. Le bail "
             "mobilité, non renouvelable et limité à 10 mois, est de loin le plus souple pour cela."),
            ("Travaillez-vous hors de Paris ?",
             "Oui — voir notre <a href=\"/gestion-locative-france\">gestion locative en France</a> et "
             "notre <a href=\"/conciergerie-airbnb-france\">conciergerie Airbnb ville par ville</a>."),
            ("Qui paie les travaux ?",
             "Le propriétaire, sauf pour les réparations locatives à la charge du locataire. Nous "
             "faisons établir plusieurs devis, nous vous les soumettons, et nous ne lançons rien sans "
             "votre accord écrit."),
            ("Puis-je passer de la longue durée à la courte durée ?",
             "Oui, à l'échéance du bail et si la réglementation locale le permet. Nous vérifions "
             "l'éligibilité de votre bien avant tout changement."),
        ],
        form=("Confiez-nous la gestion de votre bien parisien",
              "Adresse, surface, régime actuel : nous vous répondons avec une recommandation écrite "
              "et un loyer cible réaliste.",
              "Paris", "Gestion locative"),
        footer=FOOT_IMMO,
        tagline="Gestion locative à Paris — meublé, bail mobilité et courte durée, "
                "<span class=\"font-serif-italic\">sans y passer de temps</span>.",
        lieu="Paris · Île-de-France",
        mobcta="Confier mon bien",
    ),
    dict(
        slug="gestion-locative-france",
        title="Gestion locative en France — meublé, bail mobilité, courte durée | Label Maison",
        desc="Gestion locative dans toute la France : mise en location, sélection des locataires, "
             "loyers, travaux et arbitrage entre meublé, bail mobilité et courte durée. Équipes locales, "
             "interlocuteur unique.",
        crumb="Gestion locative en France",
        trail=[("Accueil", "/"), ("Propriétaires", "/proprietaires")],
        nav=NAV_IMMO,
        service_type="Gestion locative et administration de biens en France",
        area="France",
        business=(" — Gestion locative France", "Paris", "Île-de-France", "75008", "FR",
                  (48.8698, 2.3079), ["France", "Paris"]),
        badge="🇫🇷 France · Gestion locative",
        h1="Gestion locative <span class=\"font-serif-italic\">partout en France</span>",
        sub="Vous possédez un bien loin de chez vous ? Nous le louons, le suivons et l'entretenons "
            "avec des équipes locales, et vous rendons des comptes chaque mois.",
        photo=("real/residence-villa.jpg", "Bien géré par Label Maison Conciergerie en France"),
        puces=["Équipes <b>locales</b>", "Loyers <b>suivis</b>",
               "Travaux <b>coordonnés</b>", "Reporting <b>mensuel</b>"],
        cta="Confier mon bien",
        intro=[
            "Un bien à 500 kilomètres de son propriétaire finit presque toujours de la même façon : "
            "loué en dessous de sa valeur, entretenu trop tard, et source d'angoisse à chaque appel "
            "du locataire. La distance n'est pas le problème — l'absence de relais local l'est.",
            "<strong>Label Maison Conciergerie</strong> s'appuie sur des équipes de terrain (ménage, "
            "artisans, états des lieux) dans chaque ville où nous gérons, avec un référent unique "
            "côté maison. Vous n'avez qu'un numéro à appeler ; c'est lui qui coordonne le reste.",
        ],
        cards=("Notre gestion, ville par ville", "Le même standard partout, exécuté sur place.", [
            ("Mise en location locale",
             "Annonce, visites et sélection assurées par une équipe qui connaît le marché de votre "
             "ville, pas par un centre d'appels à distance."),
            ("Dossiers vérifiés",
             "Pièces contrôlées, cohérence des revenus, garanties : vous validez le locataire, nous "
             "montons le dossier."),
            ("Bail et états des lieux",
             "Bail adapté au régime retenu, état des lieux photo à l'entrée et à la sortie, "
             "gestion du dépôt de garantie."),
            ("Loyers et régularisations",
             "Encaissement, relances, régularisation annuelle des charges et récapitulatif clair "
             "pour votre déclaration."),
            ("Travaux et urgences",
             "Artisans locaux, devis comparés, intervention rapide sur les urgences : une fuite "
             "traitée le jour même coûte dix fois moins cher."),
            ("Arbitrage saisonnier",
             "Dans les villes touristiques, nous alternons courte durée en saison et bail mobilité "
             "hors saison pour maximiser le revenu annuel."),
        ]),
        sections=[
            ("Le bon régime dépend de votre ville, pas d'une règle générale", [
                "Dans une métropole étudiante comme Toulouse, Montpellier ou Rennes, le bail mobilité "
                "et le meublé longue durée tiennent le haut du pavé : la demande est continue de "
                "septembre à juillet.",
                "Sur le littoral et en montagne — Annecy, Biarritz, La Baule, Chamonix — la courte "
                "durée en saison bat tous les autres régimes, à condition de savoir remplir les "
                "intersaisons plutôt que de laisser le calendrier vide six mois par an.",
                "Dans les villes d'affaires — Lyon, Lille, Nantes, Strasbourg — la demande "
                "professionnelle en semaine permet des formules mixtes très rentables. Nous "
                "recalculons cet arbitrage chaque année pour votre bien.",
            ]),
            ("Ce que vous recevez chaque mois", [
                "Un récapitulatif lisible : loyers ou revenus encaissés, dépenses engagées, "
                "interventions réalisées, état du calendrier ou du bail, et les points qui appellent "
                "une décision de votre part.",
                "Pas de tableau de bord illisible ni de jargon : l'objectif est que vous sachiez en "
                "deux minutes où en est votre bien, et que vous puissiez transmettre le document tel "
                "quel à votre comptable.",
            ]),
        ],
        gallery=[C.photo(k + 5) for k in range(6)],
        steps=("De la prise de contact à la première quittance", [
            ("1. Étude à distance", "Photos, plans, adresse : nous évaluons le potentiel réel et "
             "vérifions la réglementation communale."),
            ("2. Visite locale", "Notre référent sur place fait le point sur l'état du bien et les "
             "travaux utiles avant mise en location."),
            ("3. Lancement", "Préparation, annonce, visites, sélection, bail, état des lieux."),
            ("4. Gestion continue", "Loyers, entretien, urgences, reporting mensuel."),
        ]),
        why=WHY_IMMO,
        zones=("Nos villes de gestion", "Une page dédiée par ville pour la location courte durée :",
               [("Conciergerie Airbnb France", "/conciergerie-airbnb-france"),
                ("Lyon", "/conciergerie-airbnb-lyon"), ("Bordeaux", "/conciergerie-airbnb-bordeaux"),
                ("Marseille", "/conciergerie-airbnb-marseille"), ("Nice", "/conciergerie-airbnb-nice"),
                ("Lille", "/conciergerie-airbnb-lille"), ("Annecy", "/conciergerie-airbnb-annecy"),
                ("Paris", "/conciergerie-airbnb-paris")],
               "Pour l'Île-de-France, voir notre <a href=\"/gestion-locative-paris\"><strong>gestion "
               "locative à Paris</strong></a>."),
        faq_title="Questions fréquentes — gestion locative en France",
        faq=[
            ("Intervenez-vous dans ma ville ?",
             "Nous couvrons Paris, l'Île-de-France, les grandes métropoles, le littoral et la montagne. "
             "Si votre ville n'apparaît pas encore, écrivez-nous : nous ouvrons de nouveaux secteurs "
             "régulièrement, à condition de pouvoir y garantir un vrai relais local."),
            ("Comment gérez-vous les urgences à distance ?",
             "Par un réseau d'artisans locaux déjà référencés, joignables directement par notre "
             "référent. Le délai d'intervention est le critère principal de sélection de nos partenaires."),
            ("Quels sont vos frais ?",
             "Un pourcentage des loyers ou des revenus encaissés, sans abonnement ni frais de dossier. "
             "Le taux dépend de la ville, du régime et du niveau de service."),
            ("Puis-je démarrer avec un seul bien ?",
             "Oui. La majorité de nos propriétaires nous confient un premier bien, puis les suivants."),
            ("Faites-vous de la courte durée partout ?",
             "Non : uniquement là où la réglementation communale le permet et où nous disposons "
             "d'équipes de ménage fiables. Ailleurs, nous proposons le meublé ou le bail mobilité."),
            ("Puis-je garder mon locataire actuel ?",
             "Bien sûr. Nous reprenons la gestion en cours de bail, sans rien changer pour lui."),
        ],
        form=("Confiez-nous votre bien, où qu'il soit",
              "Ville, surface, situation actuelle : nous revenons vers vous avec une recommandation "
              "et le nom du référent local.",
              "", "Gestion locative"),
        footer=FOOT_IMMO,
        tagline="Gestion locative partout en France — avec des "
                "<span class=\"font-serif-italic\">équipes locales</span>.",
        lieu="Paris · France",
        mobcta="Confier mon bien",
    ),
    dict(
        slug="investissement-locatif-paris",
        title="Investissement locatif à Paris — recherche, travaux et mise en location clé en main",
        desc="Investissement locatif clé en main à Paris : recherche du bien, étude de rentabilité, "
             "travaux, ameublement et mise en location. Un accompagnement complet, du repérage à la "
             "première quittance.",
        crumb="Investissement locatif Paris",
        trail=[("Accueil", "/"), ("Propriétaires", "/proprietaires")],
        nav=NAV_IMMO,
        service_type="Accompagnement à l'investissement locatif à Paris",
        area="Paris",
        business=(" — Investissement locatif Paris", "Paris", "Île-de-France", "75008", "FR",
                  (48.8698, 2.3079), ["Paris", "Île-de-France"]),
        offers=["Définition de la stratégie d'investissement", "Recherche et sélection de biens",
                "Étude de rentabilité", "Coordination des travaux", "Ameublement et décoration",
                "Mise en location et gestion"],
        badge="📈 Paris · Investissement locatif",
        h1="Investissement locatif <span class=\"font-serif-italic\">clé en main</span> à Paris",
        sub="De la recherche du bien à la première quittance : nous sélectionnons, chiffrons, "
            "rénovons, meublons et louons. Vous validez, nous exécutons.",
        photo=("real/residence-penthouse.jpg", "Bien parisien préparé pour la mise en location"),
        puces=["Rentabilité <b>chiffrée</b>", "Travaux <b>coordonnés</b>",
               "Ameublement <b>inclus</b>", "Mise en <b>location</b>"],
        cta="Parler de mon projet",
        intro=[
            "Investir à Paris, c'est acheter cher pour louer cher : la marge d'erreur est faible et "
            "elle se joue avant la signature. Un mauvais étage, une copropriété fragile, une surface "
            "impossible à meubler correctement, et le rendement théorique s'évapore.",
            "Nous accompagnons des investisseurs — primo-accédants comme multipropriétaires — sur "
            "l'ensemble de la chaîne : définition de la stratégie, repérage, chiffrage des travaux, "
            "rénovation, ameublement, mise en location et gestion. Notre intérêt n'est pas de vous "
            "faire signer vite, mais de gérer un bien qui tourne longtemps.",
        ],
        cards=("Un accompagnement de bout en bout", "Chaque étape, avec la même exigence de chiffres.", [
            ("Stratégie et budget",
             "Capacité d'emprunt, horizon de détention, objectif (cash-flow ou patrimoine), régime "
             "fiscal envisagé : on définit la cible avant de visiter quoi que ce soit."),
            ("Recherche et sélection",
             "Sourcing sur les annonces et hors marché, tri des dossiers, visites groupées. Nous "
             "écartons vite les biens qui ne passeront pas l'étude de rentabilité."),
            ("Étude de rentabilité",
             "Loyer ou revenu locatif réaliste établi sur des biens comparables réellement loués, "
             "charges, taxe foncière, travaux : le calcul complet, avant l'offre."),
            ("Négociation et achat",
             "Argumentaire de négociation appuyé sur les défauts constatés et le coût des travaux, "
             "coordination avec le notaire et le courtier."),
            ("Travaux et ameublement",
             "Devis comparés, suivi de chantier, réception, puis ameublement complet et shooting : "
             "le bien est livré prêt à louer."),
            ("Mise en location et gestion",
             "Meublé, bail mobilité ou courte durée selon l'éligibilité du bien — et notre "
             "conciergerie prend le relais au quotidien."),
        ]),
        sections=[
            ("Où investir à Paris aujourd'hui ?", [
                "Il n'y a pas de « bon arrondissement » universel : il y a des biens qui correspondent "
                "à une stratégie. Un studio destiné au bail mobilité se cherche près des campus et des "
                "hôpitaux — le <a href=\"/conciergerie-airbnb-paris-5e\">5e</a>, le "
                "<a href=\"/conciergerie-airbnb-paris-13e\">13e</a>, le "
                "<a href=\"/conciergerie-airbnb-paris-14e\">14e</a>. Un bien de rendement se cherche "
                "plutôt dans le nord-est parisien, où le prix au mètre carré laisse encore de la marge.",
                "Un bien patrimonial haut de gamme — <a href=\"/conciergerie-airbnb-paris-6e\">6e</a>, "
                "<a href=\"/conciergerie-airbnb-paris-7e\">7e</a>, "
                "<a href=\"/conciergerie-airbnb-paris-8e\">8e</a> — obéit à une autre logique : "
                "la rentabilité immédiate y est faible, la valeur de revente et la stabilité "
                "locative sont l'objectif.",
                "Nous commençons donc toujours par la question de l'objectif, jamais par celle de "
                "l'adresse.",
            ]),
            ("Les erreurs qui coûtent le plus cher", [
                "<strong>Surestimer le loyer.</strong> Un rendement calculé sur un loyer optimiste est "
                "un rendement faux. Nous partons systématiquement des biens réellement loués dans la "
                "même rue, à la même surface.",
                "<strong>Sous-estimer les travaux.</strong> À Paris, l'accès chantier, les contraintes "
                "de copropriété et les délais font monter la note bien au-delà du prix au mètre carré "
                "annoncé par un artisan au téléphone.",
                "<strong>Oublier la réglementation.</strong> Acheter une résidence secondaire en "
                "espérant la louer en courte durée sans autorisation de changement d'usage, c'est "
                "bâtir un plan de financement sur un revenu qui ne viendra pas.",
            ]),
        ],
        gallery=[C.photo(k + 2) for k in range(6)],
        steps=("Le déroulé d'un projet", [
            ("1. Cadrage", "Objectif, budget, financement, régime fiscal. Une heure d'échange pour "
             "savoir ce qu'on cherche."),
            ("2. Recherche", "Sourcing, tri, visites. Nous ne vous montrons que ce qui passe l'étude."),
            ("3. Acquisition", "Négociation, offre, notaire, financement : nous suivons jusqu'à l'acte."),
            ("4. Livraison et location", "Travaux, ameublement, photos, mise en location, puis gestion."),
        ]),
        why=WHY_IMMO,
        zones=("Aller plus loin", "",
               [("Gestion locative Paris", "/gestion-locative-paris"),
                ("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                ("Estimation de rentabilité", "/estimation-rentabilite-airbnb"),
                ("Investir à Marrakech", "/investissement-locatif-marrakech"),
                ("Investir à Dubaï", "/investissement-immobilier-dubai")],
               "À lire aussi : <a href=\"/fiscalite-airbnb-ile-de-france\"><strong>la fiscalité de la "
               "location meublée</strong></a> et "
               "<a href=\"/erreurs-proprietaires-airbnb\">les erreurs les plus fréquentes des "
               "propriétaires</a>."),
        faq_title="Questions fréquentes — investissement locatif à Paris",
        faq=[
            ("Comment êtes-vous rémunérés ?",
             "Par des honoraires d'accompagnement définis à l'avance, et par la gestion du bien "
             "ensuite si vous nous la confiez. Nous ne touchons aucune commission des vendeurs ni "
             "des artisans : c'est la condition pour que nos conseils restent les vôtres."),
            ("Quelle rentabilité peut-on viser à Paris ?",
             "Cela dépend entièrement du bien, du régime locatif et du montage. Nous refusons "
             "d'avancer un pourcentage générique : chaque projet fait l'objet d'une étude chiffrée "
             "sur des comparables réels avant toute offre."),
            ("Travaillez-vous avec un budget limité ?",
             "Oui, mais nous serons francs : sous un certain budget, Paris intra-muros n'est pas le "
             "bon terrain. Nous orientons alors vers la proche couronne ou vers d'autres villes."),
            ("Gérez-vous les travaux à ma place ?",
             "Oui : devis comparés, planning, suivi de chantier et réception. Vous validez chaque "
             "engagement de dépense."),
            ("Puis-je vous confier la gestion ensuite ?",
             "C'est le prolongement naturel : le bien est livré meublé, photographié et prêt à louer, "
             "puis notre conciergerie prend le relais."),
            ("Accompagnez-vous les investisseurs étrangers ?",
             "Oui, y compris à distance : visites filmées, comptes rendus écrits, coordination avec "
             "le notaire et le courtier."),
        ],
        form=("Parlons de votre projet d'investissement",
              "Budget, objectif, horizon : décrivez-nous votre projet en trois lignes, nous revenons "
              "vers vous avec un premier cadrage.",
              "Paris", "Investissement locatif"),
        footer=FOOT_IMMO,
        tagline="Investissement locatif clé en main à Paris — de la recherche du bien à la "
                "<span class=\"font-serif-italic\">première quittance</span>.",
        lieu="Paris · Île-de-France",
        mobcta="Parler de mon projet",
    ),
    dict(
        slug="estimation-rentabilite-airbnb",
        title="Estimation de rentabilité Airbnb — combien peut rapporter votre logement ?",
        desc="Estimation gratuite de la rentabilité Airbnb de votre logement : revenus réalistes, "
             "charges, réglementation locale et régime le plus rentable. Étude fondée sur des biens "
             "comparables réellement loués.",
        crumb="Estimation de rentabilité",
        trail=[("Accueil", "/"), ("Propriétaires", "/proprietaires")],
        nav=NAV_IMMO,
        service_type="Estimation de rentabilité locative courte durée",
        area="France",
        badge="🧮 Estimation gratuite",
        h1="Combien peut rapporter <span class=\"font-serif-italic\">votre logement</span> ?",
        sub="Nous étudions votre bien, votre quartier et les logements réellement loués autour de "
            "vous, puis nous vous remettons une estimation argumentée — pas un chiffre marketing.",
        photo=("real/logement-hero.jpg", "Logement étudié pour une estimation de revenus locatifs"),
        puces=["Étude <b>gratuite</b>", "Comparables <b>réels</b>",
               "Sans <b>engagement</b>", "Réponse <b>rapide</b>"],
        cta="Demander mon estimation",
        intro=[
            "« Combien je peux gagner ? » est la première question de tout propriétaire — et celle sur "
            "laquelle le marché raconte le plus n'importe quoi. Un simulateur qui vous annonce un "
            "revenu mensuel en trois clics ignore votre étage, votre vis-à-vis, votre literie, la "
            "réglementation de votre commune et le nombre de logements concurrents dans votre rue.",
            "Nous procédons autrement : nous regardons ce que rapportent réellement des biens "
            "comparables au vôtre, nous en déduisons une fourchette, et nous déduisons les charges "
            "réelles. Le chiffre est parfois moins flatteur qu'ailleurs. Il a l'avantage d'être "
            "utilisable.",
        ],
        cards=("Ce que contient votre estimation", "Un document court, chiffré et honnête.", [
            ("Revenu annuel estimé",
             "Une fourchette basse et haute, fondée sur des logements comparables réellement loués "
             "dans votre secteur, pas sur une moyenne nationale."),
            ("Taux d'occupation réaliste",
             "Selon la saisonnalité de votre ville et le type de clientèle que votre bien peut "
             "capter, mois par mois."),
            ("Charges à prévoir",
             "Ménage, linge, consommables, plateformes, taxe de séjour, énergie : ce qui reste "
             "vraiment dans votre poche."),
            ("Réglementation applicable",
             "Déclaration en mairie, numéro d'enregistrement, plafond de nuitées, changement d'usage : "
             "ce qui s'applique à votre adresse précise."),
            ("Régime le plus rentable",
             "Courte durée, bail mobilité, meublé longue durée ou formule mixte : nous comparons les "
             "scénarios sur douze mois."),
            ("Travaux et équipements utiles",
             "Les quelques investissements qui changent le prix par nuit — et ceux qui ne servent à rien."),
        ]),
        sections=[
            ("Ce qui fait vraiment varier vos revenus", [
                "<strong>La qualité de la photo de couverture.</strong> C'est le premier filtre : une "
                "annonce mal photographiée n'est jamais comparée aux autres, elle est ignorée.",
                "<strong>Les équipements décisifs.</strong> Wifi rapide, literie de qualité, "
                "climatisation dans le Sud, lave-linge, cuisine réellement utilisable : ce sont des "
                "critères de filtre sur les plateformes, donc des critères de visibilité.",
                "<strong>La politique de prix.</strong> Un tarif fixe toute l'année laisse "
                "systématiquement de l'argent sur la table en haute saison, et un calendrier vide "
                "en basse saison.",
                "<strong>La réactivité.</strong> Le délai de réponse aux demandes influe sur le "
                "classement des annonces. C'est l'un des rares leviers gratuits — mais il suppose "
                "d'être disponible en permanence.",
            ]),
            ("Une estimation, et ensuite ?", [
                "Vous êtes libre. L'estimation vous appartient : certains propriétaires s'en servent "
                "pour se lancer seuls, d'autres pour arbitrer entre vendre et louer, d'autres nous "
                "confient la gestion.",
                "Si nous estimons que votre bien n'est pas adapté à la courte durée — réglementation, "
                "copropriété, emplacement, état — nous vous le disons, et nous vous proposons "
                "l'alternative la plus rentable plutôt que de vous vendre une prestation inutile.",
            ]),
        ],
        steps=("Comment se déroule l'estimation", [
            ("1. Vos informations", "Adresse, surface, nombre de couchages, disponibilité : le "
             "formulaire prend deux minutes."),
            ("2. Analyse", "Nous étudions les comparables réellement loués et la réglementation "
             "de votre commune."),
            ("3. Restitution", "Vous recevez une fourchette de revenus, les charges à prévoir et "
             "le régime conseillé."),
            ("4. À vous de voir", "Vous vous lancez seul, ou vous nous confiez le bien. "
             "Sans engagement dans les deux cas."),
        ]),
        why=("Pourquoi notre estimation est différente", [
            ("Des comparables, pas un algorithme",
             "Nous regardons des annonces réelles, dans votre rue ou votre quartier, avec des "
             "caractéristiques proches des vôtres."),
            ("Les charges incluses",
             "Un revenu brut ne veut rien dire. Nous déduisons ménage, linge, consommables, "
             "commissions de plateforme et taxe de séjour."),
            ("La réglementation d'abord",
             "Inutile d'estimer des revenus impossibles à percevoir légalement : nous vérifions "
             "l'éligibilité de votre bien avant tout calcul."),
            ("Aucun engagement",
             "L'estimation est gratuite et vous appartient. Nous ne facturons rien tant que nous "
             "ne gérons pas votre bien."),
        ]),
        zones=("Estimation par territoire", "",
               [("Paris et ses arrondissements", "/conciergerie-airbnb-paris"),
                ("Toutes nos villes en France", "/conciergerie-airbnb-france"),
                ("Île-de-France", "/conciergerie-airbnb-ile-de-france"),
                ("Essonne", "/conciergerie-airbnb-essonne"),
                ("Gestion locative", "/gestion-locative-paris")],
               "À lire : <a href=\"/combien-rapporte-airbnb-91\"><strong>combien rapporte vraiment un "
               "Airbnb</strong></a> et "
               "<a href=\"/comment-rentabiliser-airbnb-essonne\">comment améliorer sa rentabilité</a>."),
        faq_title="Questions fréquentes — estimation de rentabilité",
        faq=[
            ("L'estimation est-elle vraiment gratuite ?",
             "Oui, et sans contrepartie. Nous ne facturons que la gestion, si vous décidez de nous "
             "la confier."),
            ("Sous quel délai ai-je une réponse ?",
             "Nous revenons vers vous rapidement après réception de votre demande. Si votre bien "
             "nécessite une visite, nous convenons d'un créneau."),
            ("Que se passe-t-il si mon bien n'est pas éligible à la courte durée ?",
             "Nous vous le disons clairement et nous chiffrons l'alternative : bail mobilité ou "
             "meublé longue durée, qui restent nettement plus rentables que la location nue."),
            ("Faut-il que je meuble avant l'estimation ?",
             "Non. Nous estimons le potentiel du bien tel qu'il pourrait être, et nous chiffrons "
             "l'ameublement nécessaire à part."),
            ("Donnez-vous un chiffre au téléphone ?",
             "Une fourchette très large, oui. Un chiffre exploitable, non : il suppose d'avoir vu "
             "le bien et étudié le secteur."),
            ("Puis-je demander une estimation pour plusieurs biens ?",
             "Oui, autant que vous voulez, y compris dans des villes différentes."),
        ],
        form=("Recevez votre estimation gratuite",
              "Adresse ou quartier, surface, nombre de couchages : c'est tout ce dont nous avons "
              "besoin pour démarrer.",
              "", "Estimation de rentabilité"),
        footer=FOOT_IMMO,
        tagline="Estimation de rentabilité locative — des chiffres "
                "<span class=\"font-serif-italic\">utilisables</span>, pas des promesses.",
        lieu="Paris · France",
        mobcta="Demander mon estimation",
    ),
]


def main() -> list:
    urls = [build(s) for s in PAGES_IMMO]
    print(f"Immobilier : {len(urls)} pages")
    return urls


if __name__ == "__main__":
    main()
