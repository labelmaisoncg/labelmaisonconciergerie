# -*- coding: utf-8 -*-
"""Famille « horlogerie » : 8 pages autour du hub existant
/achat-vente-montres-de-luxe. Même ligne que gen_seo_luxe.py : nous sommes une
conciergerie, pas une maison de vente ; authentification par un horloger
indépendant ; aucun prix inventé ; aucun conseil en investissement."""
from __future__ import annotations

from . import commun as K

HUB = K.HUB_MONTRES
TRAIL = [("Accueil", "/"), ("Montres de luxe", HUB)]


def base(**kw) -> dict:
    d = dict(nav=K.NAV_MONTRES, footer=K.FOOT_ACTIVITES, why=K.WHY_MONTRE, steps=K.STEPS_DEMANDE,
             area="France", lieu="Paris · Dubaï · Hong Kong", cta="Décrire ma recherche",
             mobcta="Faire une demande", gallery=K.P_MONTRE, trail=TRAIL,
             tagline="Montres de luxe — recherche, vérification, transaction encadrée, "
                     "<span class=\"font-serif-italic\">discrétion</span>.")
    d.update(kw)
    return d


LIENS = [("Achat & vente de montres", HUB), ("Acheter une Rolex", "/acheter-une-rolex-paris"),
         ("Patek Philippe", "/acheter-une-patek-philippe-paris"), ("Audemars Piguet", "/acheter-une-audemars-piguet-paris"),
         ("Richard Mille", "/acheter-une-richard-mille-paris"), ("Occasion certifiée", "/montre-de-luxe-occasion-certifiee"),
         ("Authentification", "/authentification-montre-de-luxe"), ("Offrir une montre", "/montre-cadeau-luxe"),
         ("Montres et patrimoine", "/investir-dans-les-montres-de-luxe"), ("Vendre sa montre", "/vendre-sa-montre-de-luxe-paris"),
         ("Estimation", "/estimation-montre-de-luxe"), ("Dubaï", "/montres-de-luxe-dubai"), ("Hong Kong", "/montres-de-luxe-hong-kong")]


def zones(exclure: str = "") -> tuple:
    return ("Horlogerie : nos autres pages", "", [l for l in LIENS if l[1] != exclure],
            "Vous connaissez un acheteur ou un vendeur ? Voir notre programme "
            "<a href=\"/apporteur-d-affaires-montres-de-luxe\"><strong>apporteur d'affaires horlogerie</strong></a>.")


FAQ_COMMUNE = [
    ("Êtes-vous horloger ou revendeur ?",
     "Ni l'un ni l'autre : nous sommes une conciergerie. Nous cherchons la pièce, nous la faisons "
     "vérifier par un horloger indépendant et nous encadrons la transaction. Nous ne vendons pas de "
     "stock."),
    ("Comment êtes-vous rémunérés ?",
     "Par des honoraires annoncés avant la recherche, séparés du prix de la pièce. Jamais de marge "
     "cachée sur la montre."),
]


def marque(slug: str, nom: str, badge_emoji: str, h1_nom: str, title: str, desc: str, sub: str,
           intro: list, cards: list, sections: list, faq: list, photo: tuple) -> dict:
    return base(
        slug=slug, title=title, desc=desc, crumb=nom,
        service_type=f"Recherche et acquisition accompagnées de montres {nom}",
        badge=f"{badge_emoji} Paris · {nom}",
        h1=f"Acheter une <span class=\"font-serif-italic\">{h1_nom}</span> à Paris",
        sub=sub, photo=photo,
        puces=["Recherche <b>ciblée</b>", "Authentification <b>indépendante</b>", "Prix <b>réel du marché</b>", "Discrétion <b>totale</b>"],
        intro=intro, cards=(f"Notre accompagnement pour une {nom}", "", cards), sections=sections,
        zones=zones("/" + slug), faq_title=f"Questions fréquentes — {nom} à Paris",
        faq=faq + FAQ_COMMUNE + K.faq_contact(),
        form=(f"Décrivez la {nom} que vous cherchez", "Référence, état souhaité, boîte et papiers, "
              "budget, délai : nous lançons la recherche et revenons vers vous avec des options.",
              "Paris", f"Montre de luxe — {nom}"),
    )


PAGES = [
    marque(
        "acheter-une-patek-philippe-paris", "Patek Philippe", "⌚", "Patek Philippe",
        "Acheter une Patek Philippe à Paris — Nautilus, Aquanaut, Calatrava : recherche et sécurité | Label Maison",
        "Acheter une Patek Philippe à Paris : Nautilus, Aquanaut, Calatrava, complications. "
        "Recherche sur le marché secondaire vérifié, authentification indépendante, documents, "
        "transaction encadrée. Sans liste d'attente, sans mauvaise surprise.",
        "Nautilus, Aquanaut, Calatrava, complications : les pièces les plus recherchées de la "
        "maison ne sont pas en vitrine. Nous les cherchons sur le marché secondaire vérifié, en "
        "France et à l'étranger, et nous sécurisons la transaction.",
        [
            "Patek Philippe produit peu, et attribue ses modèles sportifs à ses clients de longue "
            "date. Pour un acheteur qui n'a pas d'historique avec un détaillant, le chemin passe par "
            "le marché secondaire — où les prix dépassent souvent le prix public, où la présence du "
            "coffret, du certificat d'origine et de l'extrait des archives change tout, et où les "
            "contrefaçons de haut niveau existent.",
            "Nous cherchons la référence que vous voulez auprès de courtiers, de collectionneurs et "
            "de maisons de vente, nous faisons vérifier la pièce par un horloger indépendant, et nous "
            "encadrons le paiement et la remise des documents. Voir aussi notre page "
            "<a href=\"/achat-vente-montres-de-luxe\">achat et vente de montres de luxe</a>.",
        ],
        [
            ("Nautilus et Aquanaut", "Les références les plus demandées : disponibilité réelle, "
             "écart au prix public, pièces avec papiers complets uniquement."),
            ("Calatrava et complications", "Pièces plus disponibles, parfois à des prix plus "
             "raisonnables que leur réputation : le bon choix pour une première Patek."),
            ("Documents", "Certificat d'origine, extrait des archives Patek Philippe quand il est "
             "utile, historique d'entretien."),
            ("Authentification", "Vérification indépendante avant paiement, y compris pour une "
             "pièce venant d'un revendeur réputé."),
            ("Négociation", "Sur le marché secondaire, le prix se discute sur l'état, les papiers "
             "et la rareté réelle de la référence."),
            ("À l'étranger", "Dubaï, Hong Kong, Genève : parfois plus disponible, avec le cadre "
             "douanier expliqué au retour."),
        ],
        [
            ("Le prix d'une Patek Philippe : public, secondaire et réel", [
                "Le prix public est celui du détaillant, souvent inaccessible faute d'attribution. Le "
                "prix du marché secondaire varie avec la référence, l'année, l'état et les documents, "
                "et fluctue dans le temps. Le prix réel est celui auquel une pièce comparable s'est "
                "vendue récemment : c'est de celui-là que nous partons pour vous conseiller.",
            ]),
        ],
        [
            ("Pouvez-vous me faire obtenir une Nautilus en boutique ?",
             "Non, et personne ne le peut honnêtement. Nous cherchons sur le marché secondaire "
             "vérifié."),
            ("Que vaut une Patek sans papiers ?",
             "Nettement moins, et elle se revend plus difficilement. Nous recommandons les pièces "
             "avec coffret et certificat, sauf pour des pièces anciennes où l'extrait des archives "
             "peut suppléer."),
        ],
        ("real/rolex-coffret.jpg", "Montre de luxe présentée dans son coffret"),
    ),

    marque(
        "acheter-une-audemars-piguet-paris", "Audemars Piguet", "⌚", "Audemars Piguet",
        "Acheter une Audemars Piguet à Paris — Royal Oak, Offshore, Code 11.59 : recherche et sécurité | Label Maison",
        "Acheter une Audemars Piguet à Paris : Royal Oak, Royal Oak Offshore, Code 11.59. "
        "Recherche sur le marché secondaire vérifié, authentification indépendante, documents, "
        "transaction encadrée et discrète.",
        "La Royal Oak est l'une des montres les plus demandées et les plus contrefaites au monde. "
        "Nous cherchons la référence que vous voulez, nous la faisons vérifier, et nous encadrons "
        "l'achat.",
        [
            "Audemars Piguet a réorganisé sa distribution autour de ses propres boutiques, et la "
            "Royal Oak en acier reste attribuée avec parcimonie. Le marché secondaire est donc le "
            "passage obligé pour la plupart des acheteurs, avec les mêmes précautions que pour "
            "toute pièce très demandée : documents, état, authentification.",
            "Nous travaillons avec des courtiers, des collectionneurs et des maisons de vente, en "
            "France et à l'étranger, et nous faisons vérifier chaque pièce par un horloger "
            "indépendant avant le paiement.",
        ],
        [
            ("Royal Oak", "Acier, or, 41 ou 37 mm, références récentes ou anciennes : "
             "disponibilité, prix réel, pièces avec papiers."),
            ("Royal Oak Offshore", "Plus disponible, large choix de matériaux et de cadrans : "
             "souvent un meilleur point d'entrée."),
            ("Code 11.59", "La collection la plus accessible de la maison, parfois en boutique."),
            ("Authentification", "Contrôle indépendant des numéros, du mouvement et des finitions : "
             "la Royal Oak est très contrefaite."),
            ("Documents et entretien", "Certificat, carte de garantie, historique de révision chez "
             "la manufacture."),
            ("Revente", "Si vous voulez vendre une AP : voir "
             "<a href=\"/vendre-sa-montre-de-luxe-paris\">vendre sa montre à Paris</a>."),
        ],
        [
            ("Royal Oak : pourquoi tant de contrefaçons", [
                "Sa notoriété et son prix en font une cible, et les copies récentes reproduisent "
                "la lunette octogonale, les vis et le cadran « tapisserie » de façon convaincante à "
                "l'œil nu. Seul un contrôle par un professionnel, mouvement ouvert si nécessaire, "
                "permet de trancher. Nous ne payons jamais avant ce contrôle.",
            ]),
        ],
        [
            ("Une Royal Oak en acier est-elle trouvable ?",
             "Oui, sur le marché secondaire, à un prix au-dessus du prix public pour les références "
             "récentes. Nous vous donnons le prix réel avant de chercher."),
        ],
        ("real/rolex-gmt-poignet.jpg", "Montre de luxe portée au poignet"),
    ),

    marque(
        "acheter-une-richard-mille-paris", "Richard Mille", "⌚", "Richard Mille",
        "Acheter une Richard Mille à Paris — recherche, authentification et transaction sécurisée | Label Maison",
        "Acheter une Richard Mille à Paris : recherche sur le marché secondaire vérifié, "
        "authentification indépendante, documents, paiement sécurisé et remise en main propre. "
        "Discrétion absolue.",
        "Des pièces produites en très petites séries, des prix à six chiffres, un marché secondaire "
        "où la prudence n'est pas une option : nous cherchons, nous vérifions, nous sécurisons.",
        [
            "Richard Mille produit quelques milliers de montres par an, réservées en boutique à une "
            "clientèle établie. Le marché secondaire concentre donc l'essentiel des transactions, "
            "avec des montants qui imposent une vérification complète : authenticité, provenance, "
            "état du mouvement, documents, et sécurité du paiement et de la remise.",
            "Nous cherchons la référence demandée auprès de courtiers spécialisés et de "
            "collectionneurs, nous organisons l'authentification par un horloger indépendant "
            "habitué à la marque, et nous encadrons une transaction où rien n'est laissé au hasard : "
            "paiement sécurisé, remise en main propre dans un lieu sûr, documents.",
        ],
        [
            ("Recherche de référence", "RM 011, RM 035, RM 067, éditions limitées : disponibilité "
             "réelle et prix récents comparables."),
            ("Authentification", "Horloger indépendant familier de la marque ; contrôle complet "
             "avant tout paiement."),
            ("Provenance", "Historique de la pièce, facture d'origine, absence de litige."),
            ("Paiement sécurisé", "Séquestre ou paiement contre remise selon le montant et les "
             "parties."),
            ("Remise sécurisée", "Rendez-vous dans un lieu adapté, transport assuré si nécessaire."),
            ("Discrétion", "Aucune information ne circule : ni votre nom, ni la pièce, ni le prix."),
        ],
        [
            ("Acheter une Richard Mille : la sécurité avant le prix", [
                "À ces montants, le risque principal n'est pas de payer un peu trop cher : c'est de "
                "payer une contrefaçon, une pièce volée ou une pièce qui n'arrive jamais. Notre rôle "
                "est d'organiser la transaction pour que ces trois risques soient écartés avant que "
                "l'argent ne bouge.",
            ]),
        ],
        [
            ("Pouvez-vous organiser l'achat à l'étranger ?",
             "Oui, notamment à Dubaï et Hong Kong, avec le cadre douanier au retour expliqué avant."),
        ],
        ("real/montre-rolex-gmt.jpeg", "Montre de luxe, cadran et lunette"),
    ),

    base(
        slug="montre-de-luxe-occasion-certifiee",
        title="Montre de luxe d'occasion vérifiée — acheter en seconde main sans risque | Label Maison",
        desc="Acheter une montre de luxe d'occasion à Paris : pièces vérifiées par un horloger "
             "indépendant, papiers et historique contrôlés, prix réel du marché, transaction "
             "encadrée. Rolex, Omega, Cartier, Patek, AP.",
        crumb="Occasion vérifiée", service_type="Recherche de montres de luxe d'occasion vérifiées",
        badge="🔍 Occasion · Vérifiée",
        h1="Montre de luxe <span class=\"font-serif-italic\">d'occasion</span>, vérifiée avant d'être payée",
        sub="La seconde main est le meilleur moyen d'obtenir la montre que vous voulez au prix "
            "réel du marché — à condition de savoir qui vérifie la pièce. Chez nous, c'est un "
            "horloger indépendant, avant tout paiement.",
        photo=("real/montre-rolex-datejust.jpeg", "Rolex Datejust d'occasion"),
        puces=["Horloger <b>indépendant</b>", "Papiers et <b>historique</b>", "Prix <b>réel</b>", "Transaction <b>encadrée</b>"],
        intro=[
            "Une montre de luxe d'occasion coûte souvent moins qu'une neuve, est disponible tout de "
            "suite, et parfois n'existe plus qu'en seconde main. En face, trois risques : la "
            "contrefaçon, la pièce « frankenstein » assemblée de composants d'origines diverses, et "
            "la pièce vendue au-dessus de sa valeur réelle à un acheteur mal informé.",
            "Nous cherchons la pièce selon votre cahier des charges, nous la faisons vérifier par un "
            "horloger indépendant — authenticité, composants, état du mouvement — nous contrôlons "
            "les papiers et l'historique, et nous situons le prix sur des transactions récentes "
            "comparables avant que vous décidiez.",
        ],
        cards=("Ce que nous vérifions", "", [
            ("Authenticité", "Numéros, gravures, mouvement, finitions : contrôle par un horloger "
             "indépendant."),
            ("Composants d'origine", "Cadran, aiguilles, lunette, bracelet : une pièce modifiée vaut "
             "moins et doit être annoncée comme telle."),
            ("État et entretien", "Usure, révisions, polissage excessif, étanchéité."),
            ("Papiers", "Carte de garantie, facture, coffret, historique d'entretien."),
            ("Provenance", "Vendeur identifié, pièce non signalée volée, facture de cession."),
            ("Prix", "Comparaison avec des ventes récentes de pièces équivalentes."),
        ]),
        sections=[
            ("Avec ou sans papiers ?", [
                "Une montre avec coffret et papiers d'origine se paie plus cher et se revend plus "
                "facilement. Une montre sans papiers peut être parfaitement authentique — la "
                "vérification le dira — mais elle doit être achetée moins cher, et vous devez en "
                "être conscient au moment de la revente. Nous vous donnons les deux prix.",
            ]),
        ],
        zones=zones("/montre-de-luxe-occasion-certifiee"),
        faq_title="Questions fréquentes — montre de luxe d'occasion",
        faq=[
            ("Garantissez-vous les pièces ?",
             "Nous garantissons la vérification indépendante avant paiement et la traçabilité de la "
             "transaction. La garantie de fonctionnement dépend du vendeur et de l'horloger qui "
             "révise la pièce, et elle est précisée avant l'achat."),
            ("Quelles marques traitez-vous ?",
             "Rolex, Patek Philippe, Audemars Piguet, Richard Mille, Omega, Cartier, Vacheron "
             "Constantin, Jaeger-LeCoultre, et d'autres sur demande."),
        ] + FAQ_COMMUNE + K.faq_contact(),
        form=("Décrivez la montre que vous cherchez", "Marque, référence, budget, avec ou sans "
              "papiers : nous cherchons et faisons vérifier.", "Paris", "Montre d'occasion"),
    ),

    base(
        slug="authentification-montre-de-luxe",
        title="Authentification de montre de luxe — vérifier avant d'acheter ou de vendre | Label Maison",
        desc="Faire authentifier une montre de luxe à Paris par un horloger indépendant avant un "
             "achat, une vente ou une succession : contrôle des numéros, du mouvement, des "
             "composants et des papiers. Rapport écrit.",
        crumb="Authentification", service_type="Organisation d'authentification de montres de luxe",
        badge="✅ Horlogerie · Authentification",
        h1="Faire <span class=\"font-serif-italic\">authentifier</span> une montre de luxe",
        sub="Avant d'acheter, avant de vendre, après un héritage : une vérification par un horloger "
            "indépendant, avec un rapport écrit, évite les erreurs qui coûtent le prix de la montre.",
        photo=("real/shopping-montre2-poster.jpg", "Montre présentée pour vérification"),
        puces=["Horloger <b>indépendant</b>", "Rapport <b>écrit</b>", "Avant <b>tout paiement</b>", "Paris et <b>à distance</b>"],
        cta="Faire vérifier ma montre",
        intro=[
            "Les contrefaçons de montres de luxe ont atteint un niveau où l'œil, même exercé, ne "
            "suffit plus : poids, gravures, finitions et parfois mouvement imitent l'original. Et "
            "entre la contrefaçon pure et la pièce authentique, il existe des pièces modifiées, "
            "assemblées ou mal entretenues qui valent bien moins que leur apparence.",
            "Nous organisons l'authentification par un horloger indépendant — qui n'a aucun intérêt "
            "dans la transaction — avec un rapport écrit : authenticité, composants, état du "
            "mouvement, cohérence des numéros et des papiers. C'est l'étape que nous imposons avant "
            "tout paiement dans nos propres recherches ; nous la proposons aussi seule.",
        ],
        cards=("Quand faire authentifier", "", [
            ("Avant d'acheter", "Une pièce trouvée seul, chez un particulier ou en ligne : "
             "vérification avant de payer."),
            ("Avant de vendre", "Un rapport indépendant rassure l'acheteur et justifie le prix."),
            ("Après un héritage", "Savoir ce que valent réellement les montres d'une succession."),
            ("Pour une assurance", "Attestation et valeur pour un contrat d'assurance."),
            ("En cas de doute", "Une montre achetée il y a des années dont on n'est plus sûr."),
            ("À distance", "Envoi assuré à l'horloger partenaire et rapport par e-mail."),
        ]),
        sections=[
            ("Ce que contient le rapport", [
                "Identification de la pièce (marque, référence, numéros), contrôle de l'authenticité "
                "du boîtier, du cadran, du mouvement et du bracelet, état général et fonctionnement, "
                "cohérence avec les papiers fournis, et réserves éventuelles. Le rapport n'est pas "
                "une estimation de prix ; pour cela, voir notre "
                "<a href=\"/estimation-montre-de-luxe\">estimation de montre de luxe</a>.",
            ]),
        ],
        zones=zones("/authentification-montre-de-luxe"),
        faq_title="Questions fréquentes — authentification",
        faq=[
            ("Combien de temps prend une authentification ?",
             "De quelques heures à quelques jours selon la pièce et la nécessité d'ouvrir le boîtier."),
            ("Est-ce une expertise officielle ?",
             "C'est le rapport d'un horloger professionnel indépendant. Pour une procédure judiciaire, "
             "un expert agréé est nécessaire ; nous vous orientons."),
        ] + FAQ_COMMUNE + K.faq_contact(),
        form=("Faire authentifier une montre", "Marque, référence, contexte (achat, vente, héritage) : "
              "nous organisons la vérification.", "Paris", "Authentification montre"),
    ),

    base(
        slug="montre-cadeau-luxe",
        title="Offrir une montre de luxe — choisir, trouver et remettre la bonne pièce | Label Maison",
        desc="Offrir une montre de luxe pour un anniversaire, un mariage, une naissance, une "
             "retraite : conseil sur le modèle, recherche de la pièce, gravure, écrin, remise "
             "discrète. Rolex, Omega, Cartier, Tudor, Patek.",
        crumb="Offrir une montre", service_type="Conseil et recherche de montre de luxe à offrir",
        badge="🎁 Horlogerie · Cadeau",
        h1="Offrir une <span class=\"font-serif-italic\">montre de luxe</span>, sans se tromper",
        sub="Quarante ans, un mariage, une naissance, un départ en retraite, un contrat signé : la "
            "montre est le cadeau qui reste. Encore faut-il choisir la bonne, la trouver à temps et "
            "la remettre comme il faut.",
        photo=("real/proof-montre-client-poster.jpg", "Remise d'une montre à un client"),
        puces=["Conseil <b>modèle</b>", "Recherche <b>à temps</b>", "Gravure et <b>écrin</b>", "Remise <b>discrète</b>"],
        cta="Préparer mon cadeau",
        intro=[
            "Offrir une montre engage : c'est un objet que la personne portera des années, et qui "
            "dit quelque chose de celui qui l'offre. Le modèle doit correspondre au poignet, au "
            "style et à la vie de la personne, pas au catalogue ; et la pièce doit être là à la "
            "date, pas « dans six mois si la boutique l'a ».",
            "Nous vous conseillons sur le modèle à partir de ce que vous savez de la personne, nous "
            "cherchons la pièce — en boutique quand c'est possible, sur le marché secondaire vérifié "
            "sinon — et nous organisons la gravure, l'écrin et la remise, en main propre ou "
            "livrée, sans que rien ne trahisse la surprise.",
        ],
        cards=("Ce que nous faisons", "", [
            ("Conseil", "Budget, style, taille, usage quotidien ou occasion : trois propositions "
             "argumentées, pas un catalogue."),
            ("Recherche", "Boutique, marché secondaire vérifié, réseau à l'étranger : la pièce à la "
             "date voulue."),
            ("Vérification", "Pour une pièce de seconde main : authentification indépendante avant "
             "paiement."),
            ("Gravure", "Fond de boîte ou boucle, texte et police, par un graveur partenaire."),
            ("Écrin et présentation", "Coffret d'origine ou écrin personnalisé, carte manuscrite."),
            ("Remise", "En main propre à Paris, livraison assurée ailleurs, ou mise en scène lors "
             "d'un dîner organisé par nos soins."),
        ]),
        sections=[
            ("Quel modèle pour quelle occasion ?", [
                "Une première « belle montre » se choisit robuste et polyvalente — une Tudor, une "
                "Omega, une Rolex Oyster Perpetual ou Datejust. Un cadeau de mariage ou d'étape de "
                "vie va vers des pièces plus habillées ou plus rares — Cartier, Jaeger-LeCoultre, "
                "une Rolex plus marquée. Un cadeau d'exception regarde vers Patek Philippe ou "
                "Audemars Piguet, où la recherche prend plus de temps. Nous partons de la personne, "
                "pas de la marque.",
            ]),
        ],
        zones=zones("/montre-cadeau-luxe"),
        faq_title="Questions fréquentes — offrir une montre",
        faq=[
            ("Combien de temps à l'avance faut-il vous prévenir ?",
             "Quelques jours pour un modèle disponible, plusieurs semaines pour une pièce recherchée "
             "ou une gravure. Plus tôt vous nous écrivez, plus le choix est large."),
            ("Et si la montre ne convient pas ?",
             "Nous précisons avant l'achat les conditions d'échange de la boutique ou du vendeur."),
            ("Pouvez-vous offrir une montre pour une entreprise ?",
             "Oui : voir nos <a href=\"/cadeaux-d-affaires-luxe\">cadeaux d'affaires</a>."),
        ] + FAQ_COMMUNE + K.faq_contact(),
        form=("Préparer votre cadeau", "Occasion, date, budget, ce que vous savez de la personne : "
              "nous revenons vers vous avec trois propositions.", "Paris", "Montre cadeau"),
    ),

    base(
        slug="investir-dans-les-montres-de-luxe",
        title="Montres de luxe et patrimoine — ce qu'il faut savoir avant d'acheter « pour investir » | Label Maison",
        desc="Acheter une montre de luxe comme placement : ce qui a réellement pris de la valeur, "
             "ce qui en a perdu, les frais, la liquidité, la fiscalité à la revente. Un point de "
             "vue honnête, sans conseil en investissement.",
        crumb="Montres et patrimoine", service_type="Accompagnement à l'acquisition de montres de collection",
        badge="📈 Horlogerie · Patrimoine",
        h1="Montres de luxe et <span class=\"font-serif-italic\">patrimoine</span> : la version honnête",
        sub="Certaines montres ont pris beaucoup de valeur ; beaucoup d'autres en ont perdu. Avant "
            "d'acheter « pour investir », voici ce que nous disons à nos clients.",
        photo=("real/rolex-gmt-poignet.jpg", "Rolex GMT-Master portée au poignet"),
        puces=["Pas de <b>conseil en investissement</b>", "Frais et <b>liquidité</b>", "Fiscalité à la <b>revente</b>", "Pièces <b>vérifiées</b>"],
        intro=[
            "On lit partout que les montres de luxe sont un placement. La réalité est plus nuancée : "
            "quelques références très demandées se sont revendues au-dessus de leur prix d'achat "
            "pendant certaines périodes ; la plupart des montres, même de grandes maisons, se "
            "revendent en dessous ; et le marché secondaire a connu des hausses fortes suivies de "
            "baisses marquées.",
            "Nous ne sommes pas conseillers en investissement et nous ne vous dirons jamais qu'une "
            "montre « va monter ». Ce que nous faisons : vous aider à acheter une pièce qui vous "
            "plaît, au prix réel, vérifiée, avec papiers — c'est-à-dire une pièce qui se revendra "
            "dans de bonnes conditions si vous le décidez un jour.",
        ],
        cards=("Ce qu'il faut regarder", "", [
            ("Le prix réel d'achat", "Au-dessus du prix public sur le marché secondaire, la marge "
             "de progression est déjà consommée."),
            ("Les frais", "Honoraires, commissions de vente, révisions, assurance : ils pèsent sur "
             "le résultat final."),
            ("La liquidité", "Une Rolex sportive en acier se revend en quelques jours ; une pièce "
             "rare mais confidentielle peut attendre des mois."),
            ("Les papiers", "Coffret, certificat, factures, historique d'entretien : sans eux, la "
             "décote à la revente est importante."),
            ("L'état", "Une montre portée avec soin et révisée se revend mieux qu'une pièce "
             "polie à l'excès ou négligée."),
            ("La fiscalité", "En France, la revente d'une montre peut relever de la taxe forfaitaire "
             "sur les objets précieux ou du régime des plus-values selon les cas : votre conseil "
             "fiscal tranche."),
        ]),
        sections=[
            ("Notre position", [
                "Achetez une montre parce que vous voulez la porter. Si elle est bien choisie, bien "
                "achetée et bien conservée, elle gardera une valeur de revente honorable, et peut-être "
                "davantage. Si vous cherchez un placement, parlez-en à un conseiller en "
                "investissements financiers, pas à une conciergerie.",
            ]),
        ],
        zones=zones("/investir-dans-les-montres-de-luxe"),
        faq_title="Questions fréquentes — montres et patrimoine",
        faq=[
            ("Quelles montres gardent le mieux leur valeur ?",
             "Historiquement, certaines références très demandées de Rolex, Patek Philippe et "
             "Audemars Piguet avec papiers complets. Ce constat passé ne garantit rien pour l'avenir."),
            ("Faut-il assurer une montre de valeur ?",
             "Oui, en général via un contrat spécifique ou une extension ; une facture et un rapport "
             "d'authentification facilitent la souscription."),
        ] + FAQ_COMMUNE + K.faq_contact(),
        form=("Parlons de la pièce qui vous intéresse", "Référence, budget, horizon : nous vous "
              "donnons le prix réel, les frais et les conditions de revente.", "Paris", "Montre — patrimoine"),
    ),

    base(
        slug="montres-de-luxe-hong-kong",
        title="Montres de luxe à Hong Kong — sourcing, authentification et retour en France | Label Maison",
        desc="Acheter une montre de luxe à Hong Kong : un marché sans TVA, très profond en Rolex, "
             "Patek et AP, avec nos contacts locaux, l'authentification indépendante et le cadre "
             "douanier au retour en France expliqué avant l'achat.",
        crumb="Hong Kong", area="Hong Kong", lieu="Hong Kong · Paris", nav=K.NAV_CHINE,
        service_type="Recherche et acquisition de montres de luxe à Hong Kong",
        badge="🇭🇰 Hong Kong · Horlogerie",
        h1="Montres de luxe à <span class=\"font-serif-italic\">Hong Kong</span>",
        sub="L'un des premiers marchés horlogers du monde, sans TVA, avec une offre que l'Europe "
            "n'a pas. Et une douane française qui attend au retour : nous faisons le calcul complet "
            "avant que vous achetiez.",
        photo=("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master"),
        puces=["Marché <b>sans TVA</b>", "Contacts <b>locaux</b>", "Authentification <b>indépendante</b>", "Douane <b>expliquée</b>"],
        intro=[
            "Hong Kong est depuis des décennies une place forte de l'horlogerie : boutiques des "
            "maisons, détaillants historiques, courtiers et un marché secondaire très actif, le tout "
            "sans taxe sur la valeur ajoutée. Pour certaines références, la disponibilité et le prix "
            "y sont meilleurs qu'en Europe.",
            "Mais une montre achetée à Hong Kong et rapportée en France doit être déclarée, avec "
            "droits et TVA à l'importation au-delà des franchises. L'économie réelle se calcule une "
            "fois tout additionné. Nous cherchons avec nos contacts sur place, nous faisons vérifier "
            "la pièce, et nous vous donnons le chiffre complet — voir aussi notre "
            "<a href=\"/conciergerie-chine\">conciergerie Chine</a>.",
        ],
        cards=("Notre accompagnement à Hong Kong", "", [
            ("Sourcing local", "Détaillants, courtiers et marché secondaire : la référence demandée, "
             "avec les prix."),
            ("Authentification", "Horloger indépendant avant paiement, comme partout."),
            ("Négociation", "Sur le marché secondaire, le prix se discute sur des éléments concrets."),
            ("Accompagnement sur place", "Rendez-vous, chauffeur, sécurité du déplacement avec la "
             "pièce."),
            ("Achat à distance", "Sans vous déplacer : recherche, vérification, envoi assuré."),
            ("Cadre douanier", "Ce qui doit être déclaré en France et ce que cela coûte, avant "
             "l'achat."),
        ]),
        sections=[
            ("Hong Kong, Shenzhen, Canton : un même voyage", [
                "Hong Kong se combine naturellement avec un déplacement d'affaires à Shenzhen ou à la "
                "Foire de Canton, à moins de deux heures de train. Nos clients entrepreneurs y "
                "ajoutent souvent une journée horlogère ; voir notre "
                "<a href=\"/voyage-d-affaires-chine\">voyage d'affaires en Chine</a>.",
            ]),
        ],
        zones=zones("/montres-de-luxe-hong-kong"),
        faq_title="Questions fréquentes — montres à Hong Kong",
        faq=[
            ("Dois-je déclarer ma montre en rentrant en France ?",
             "Oui, au-delà des franchises voyageurs : droits et TVA à l'importation s'appliquent. La "
             "douane française fait foi ; nous vous expliquons la procédure avant l'achat."),
            ("Hong Kong est-il moins cher que Dubaï ?",
             "Cela dépend des références et du moment. Nous comparons les deux places pour la pièce "
             "demandée."),
        ] + FAQ_COMMUNE + K.faq_contact(),
        form=("Votre recherche horlogère à Hong Kong", "Référence, budget, dates de séjour "
              "éventuelles : nous lançons la recherche et chiffrons le coût complet.", "Hong Kong",
              "Montre de luxe — Hong Kong"),
    ),
]
