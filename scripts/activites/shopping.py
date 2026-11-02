# -*- coding: utf-8 -*-
"""Famille « personal shopping » : 8 pages autour du hub existant
/personal-shopper-paris. Honoraires toujours annoncés séparément du prix de la
pièce ; aucune marge cachée ; jamais de contrefaçon. Aucun prix affiché."""
from __future__ import annotations

from . import commun as K

HUB = K.HUB_SHOPPING
TRAIL = [("Accueil", "/"), ("Personal shopper", HUB)]


def base(**kw) -> dict:
    d = dict(nav=K.NAV_SHOPPING, footer=K.FOOT_ACTIVITES, why=K.WHY_SHOPPING, steps=K.STEPS_DEMANDE,
             area="Paris", lieu="Paris · Dubaï · Marrakech", cta="Décrire ma recherche",
             mobcta="Faire une demande", gallery=K.P_SHOPPING, trail=TRAIL,
             tagline="Personal shopping — l'accès, le prix réel et la discrétion, "
                     "<span class=\"font-serif-italic\">sans marge cachée</span>.")
    d.update(kw)
    return d


LIENS = [("Personal shopper à Paris", HUB), ("Sacs de luxe", "/personal-shopper-sac-de-luxe-paris"),
         ("Joaillerie", "/personal-shopper-joaillerie-paris"), ("Mode homme", "/personal-shopper-mode-homme-paris"),
         ("Cadeaux d'affaires", "/cadeaux-d-affaires-luxe"), ("À distance", "/personal-shopper-a-distance"),
         ("Détaxe à Paris", "/detaxe-shopping-paris"), ("Personal shopper Dubaï", "/personal-shopper-dubai"),
         ("Personal shopper Marrakech", "/personal-shopper-marrakech"), ("Montres de luxe", K.HUB_MONTRES)]


def zones(exclure: str = "") -> tuple:
    return ("Personal shopping : nos autres services", "", [l for l in LIENS if l[1] != exclure],
            "Vous voulez recommander un client ? Voir notre programme "
            "<a href=\"/apporteur-d-affaires-personal-shopping\"><strong>apporteur d'affaires personal shopping</strong></a>.")


PAGES = [
    base(
        slug="personal-shopper-sac-de-luxe-paris",
        title="Personal shopper sacs de luxe à Paris — Hermès, Chanel, Louis Vuitton, liste d'attente | Label Maison",
        desc="Obtenir un sac de luxe à Paris : accès en boutique, listes d'attente, marché "
             "secondaire vérifié, authentification et livraison. Hermès, Chanel, Louis Vuitton, "
             "Dior. Honoraires annoncés séparément du prix.",
        crumb="Sacs de luxe", service_type="Recherche et acquisition de sacs de luxe",
        badge="👜 Paris · Sacs de luxe",
        h1="Sacs de luxe à Paris : <span class=\"font-serif-italic\">obtenir la pièce</span>, pas seulement la chercher",
        sub="Un Birkin, un Kelly, un Classic Flap, un modèle épuisé depuis deux saisons : nous "
            "activons la boutique, le marché secondaire vérifié et notre réseau à l'étranger, et nous "
            "vous disons le prix réel avant d'acheter.",
        photo=("real/louis-vuitton.jpg", "Boutique Louis Vuitton à Paris"),
        puces=["Boutique et <b>marché secondaire</b>", "Authentification <b>vérifiée</b>", "Prix et honoraires <b>séparés</b>", "Livraison <b>assurée</b>"],
        intro=[
            "Les sacs les plus demandés ne s'achètent pas : ils s'obtiennent. Les maisons attribuent "
            "leurs pièces iconiques à leurs clients fidèles, les listes d'attente se comptent en "
            "mois, et le marché secondaire mélange des pièces impeccables avec papiers, des pièces "
            "fatiguées et des contrefaçons très convaincantes.",
            "Notre personal shopper travaille sur les trois canaux : la relation en boutique quand "
            "elle est possible, le marché secondaire vérifié (revendeurs sérieux, maisons de vente, "
            "collectionneurs), et notre réseau à Dubaï, Hong Kong et Londres où certaines pièces "
            "sont plus disponibles. Pour chaque option, vous connaissez le prix de la pièce, nos "
            "honoraires et le délai avant de décider.",
        ],
        cards=("Ce que nous faisons pour vous", "", [
            ("Recherche ciblée", "Modèle, taille, cuir, couleur, quincaillerie : nous partons de "
             "votre cahier des charges et cherchons exactement cela."),
            ("Accès en boutique", "Rendez-vous, présentation de pièces, accompagnement en boutique "
             "à Paris pour les clients qui préfèrent acheter neuf."),
            ("Marché secondaire vérifié", "Pièces récentes avec facture et papiers, état contrôlé, "
             "authentification indépendante avant paiement."),
            ("Réseau à l'étranger", "Dubaï, Hong Kong, Londres : disponibilité différente, cadre "
             "douanier expliqué au retour en France."),
            ("Négociation", "Sur le marché secondaire, le prix se discute. Nous négocions sur des "
             "éléments concrets : état, rareté réelle, papiers."),
            ("Livraison et remise", "Livraison assurée, remise en main propre à Paris, ou dépôt à "
             "votre hôtel."),
        ]),
        sections=[
            ("Neuf ou seconde main : la question honnête", [
                "Pour un modèle courant, la boutique reste le meilleur choix : prix public, garantie, "
                "expérience. Pour une pièce iconique attribuée au compte-gouttes, attendre peut "
                "prendre des années ; le marché secondaire permet de l'obtenir maintenant, parfois "
                "au-dessus du prix boutique, parfois en dessous pour une pièce moins récente. Nous "
                "vous donnons les deux prix et vous choisissez.",
            ]),
            ("Authenticité : notre règle", [
                "Toute pièce venue du marché secondaire est vérifiée avant paiement : cohérence des "
                "numéros et des poinçons, qualité des coutures et de la quincaillerie, facture "
                "d'origine, et expertise indépendante pour les pièces de valeur. Nous refusons les "
                "pièces douteuses, même « à un très bon prix ».",
            ]),
        ],
        zones=zones("/personal-shopper-sac-de-luxe-paris"),
        faq_title="Questions fréquentes — sacs de luxe à Paris",
        faq=[
            ("Pouvez-vous obtenir un Birkin ou un Kelly ?",
             "Nous cherchons, sur le marché secondaire vérifié et via notre réseau. Nous ne promettons "
             "jamais une attribution en boutique : personne ne le peut honnêtement."),
            ("Comment sont calculés vos honoraires ?",
             "Ils sont annoncés avant l'achat, séparément du prix de la pièce, selon la recherche. "
             "Jamais de marge cachée sur la pièce."),
            ("Livrez-vous à l'étranger ?",
             "Oui, en envoi assuré, avec les formalités douanières expliquées avant."),
            ("Vérifiez-vous aussi un sac que j'ai déjà acheté ?",
             "Oui : nous organisons une authentification indépendante."),
        ] + K.faq_contact(),
        form=("Décrivez le sac que vous cherchez", "Modèle, taille, couleur, neuf ou seconde main, "
              "délai : nous revenons vers vous avec les options et leurs prix.", "Paris", "Personal shopping — sac"),
    ),

    base(
        slug="personal-shopper-joaillerie-paris",
        title="Personal shopper joaillerie à Paris — Cartier, Van Cleef & Arpels, diamants certifiés | Label Maison",
        desc="Acquisition de joaillerie à Paris : pièces signées (Cartier, Van Cleef & Arpels, "
             "Bulgari), diamants certifiés GIA, bague de fiançailles, pièces anciennes vérifiées. "
             "Accès, conseil, authentification et discrétion.",
        crumb="Joaillerie", service_type="Recherche et acquisition de joaillerie",
        badge="💎 Paris · Joaillerie",
        h1="Joaillerie à Paris : <span class=\"font-serif-italic\">la bonne pièce</span>, au prix réel",
        sub="Une bague de fiançailles, une pièce signée, un diamant certifié, un bijou ancien : nous "
            "cherchons, nous faisons vérifier, et nous vous accompagnons place Vendôme comme chez "
            "les ateliers.",
        photo=("real/shopping-bijoux2-poster.jpg", "Pièces de joaillerie présentées à un client"),
        puces=["Place Vendôme et <b>ateliers</b>", "Diamants <b>certifiés</b>", "Pièces anciennes <b>vérifiées</b>", "Discrétion <b>totale</b>"],
        intro=[
            "La joaillerie se divise en deux mondes : les maisons de la place Vendôme, où l'on "
            "achète une signature et une garantie, et les ateliers et le marché de la pièce ancienne, "
            "où l'on achète une pierre, un savoir-faire et parfois une histoire, souvent à un prix "
            "plus juste. Les deux se valent ; ils ne s'achètent pas de la même manière.",
            "Notre personal shopper vous accompagne dans les deux : rendez-vous en maison, "
            "présentation de pièces, recherche d'une pièce signée épuisée sur le marché secondaire, "
            "ou création sur mesure avec un atelier parisien et une pierre certifiée. Nous ne sommes "
            "pas joailliers : nous faisons vérifier par un gemmologue indépendant quand la pièce le "
            "justifie.",
        ],
        cards=("Nos accompagnements", "", [
            ("Bague de fiançailles", "Budget, pierre (certificat GIA ou équivalent), monture, "
             "délai : nous comparons maisons et ateliers avant que vous choisissiez."),
            ("Pièce signée", "Cartier, Van Cleef & Arpels, Bulgari, Boucheron : en maison, ou sur le "
             "marché secondaire vérifié pour un modèle épuisé."),
            ("Pièce ancienne", "Art déco, années 50, pièces de collection : provenance, état, "
             "expertise indépendante."),
            ("Création sur mesure", "Atelier parisien, dessin, pierre sourcée, suivi de fabrication."),
            ("Cadeau", "Sélection, écrin, gravure, livraison ou remise en main propre, discrétion "
             "garantie jusqu'à la surprise."),
            ("Revente et estimation", "Vous voulez vendre un bijou : nous l'estimons avec un "
             "partenaire et vous proposons les canaux adaptés."),
        ]),
        sections=[
            ("Le diamant : ce qu'il faut savoir avant d'acheter", [
                "Un diamant s'évalue sur ses « 4C » — poids en carats, couleur, pureté, taille — "
                "attestés par un certificat de laboratoire indépendant, le GIA étant la référence la "
                "plus reconnue. Deux pierres de même poids peuvent avoir des prix très différents ; "
                "le certificat permet de comparer. Nous ne vous laissons pas acheter une pierre de "
                "valeur sans certificat.",
            ]),
        ],
        zones=zones("/personal-shopper-joaillerie-paris"),
        faq_title="Questions fréquentes — joaillerie à Paris",
        faq=[
            ("Maison ou atelier : que conseillez-vous ?",
             "La maison pour la signature, la garantie et la revente facilitée ; l'atelier pour une "
             "pièce unique ou un meilleur rapport pierre/prix. Nous chiffrons les deux."),
            ("Vérifiez-vous les pièces anciennes ?",
             "Oui, par un expert indépendant : pierres, métal, état, provenance, avant tout paiement."),
            ("Pouvez-vous gérer une surprise ?",
             "C'est notre quotidien : livraison discrète, horaires adaptés, aucune trace visible."),
        ] + K.faq_contact(),
        form=("Décrivez la pièce que vous cherchez", "Type de bijou, budget, délai, signée ou sur "
              "mesure : nous revenons vers vous avec des options.", "Paris", "Personal shopping — joaillerie"),
    ),

    base(
        slug="personal-shopper-mode-homme-paris",
        title="Personal shopper mode homme à Paris — maisons, streetwear de luxe, sur-mesure | Label Maison",
        desc="Personal shopper homme à Paris : garde-robe, pièces de maisons et streetwear de luxe "
             "(Amiri, Dior, Loro Piana), sneakers rares, costume sur mesure. Accès, sélection, "
             "achat accompagné ou à distance.",
        crumb="Mode homme", service_type="Personal shopping mode homme",
        badge="🧥 Paris · Mode homme",
        h1="Personal shopper <span class=\"font-serif-italic\">mode homme</span> à Paris",
        sub="Une garde-robe à reconstruire, une pièce épuisée, des sneakers introuvables, un costume "
            "à faire : nous sélectionnons, nous obtenons, et vous ne passez pas votre samedi en "
            "boutique.",
        photo=("real/amiri-boutique.jpg", "Boutique Amiri à Paris"),
        puces=["Maisons et <b>streetwear</b>", "Pièces <b>épuisées</b>", "Sur-mesure <b>parisien</b>", "En boutique ou <b>à distance</b>"],
        intro=[
            "Le vestiaire masculin de luxe a changé : les maisons classiques côtoient le streetwear "
            "haut de gamme, les sneakers se revendent plus cher que neuves, et une pièce sort en "
            "quantité limitée pour disparaître en une semaine. Suivre tout cela demande du temps ; "
            "nos clients préfèrent le consacrer à autre chose.",
            "Notre personal shopper connaît les boutiques parisiennes, leurs conseillers et les "
            "revendeurs sérieux pour les pièces épuisées. Il travaille sur rendez-vous, en boutique "
            "avec vous, ou à distance pour les clients qui vivent à Dubaï, Londres ou Shanghai.",
        ],
        cards=("Ce que nous faisons", "", [
            ("Garde-robe", "Point sur l'existant, pièces manquantes, sélection cohérente avec votre "
             "usage et votre budget, essayages regroupés."),
            ("Pièces de maisons", "Dior, Loro Piana, Brunello Cucinelli, Berluti : rendez-vous et "
             "pièces réservées."),
            ("Streetwear de luxe", "Amiri, Off-White, éditions limitées : boutique ou revente vérifiée."),
            ("Sneakers rares", "Modèles épuisés, collaborations : authentification systématique."),
            ("Costume et chemise sur mesure", "Tailleurs parisiens, rendez-vous de mesures, suivi "
             "des retouches."),
            ("Achat à distance", "Photos, tailles, essayage à domicile ou à l'hôtel, retours gérés."),
        ]),
        sections=[
            ("Sneakers et pièces limitées : attention aux contrefaçons", [
                "C'est le segment le plus contrefait du luxe. Nous n'achetons que chez des revendeurs "
                "identifiés, avec authentification avant paiement. Une paire proposée très en dessous "
                "du marché est presque toujours une contrefaçon : nous passons notre chemin, et nous "
                "vous le disons.",
            ]),
        ],
        zones=zones("/personal-shopper-mode-homme-paris"),
        faq_title="Questions fréquentes — personal shopper homme",
        faq=[
            ("Faut-il venir à Paris ?",
             "Non : à distance, nous envoyons des sélections et organisons des essayages chez vous ou "
             "à l'hôtel lors de votre passage."),
            ("Comment sont facturés vos honoraires ?",
             "À la mission ou à l'heure pour un accompagnement en boutique, annoncés avant. Le prix "
             "des pièces reste le prix boutique ou le prix négocié, visible."),
        ] + K.faq_contact(),
        form=("Décrivez votre besoin", "Garde-robe, pièce précise, sneakers, sur-mesure, dates de "
              "passage à Paris : nous vous proposons une approche.", "Paris", "Personal shopping — mode homme"),
    ),

    base(
        slug="cadeaux-d-affaires-luxe",
        title="Cadeaux d'affaires de luxe — sélection, personnalisation, livraison en France et à l'étranger | Label Maison",
        desc="Cadeaux d'affaires haut de gamme pour clients, partenaires et collaborateurs : "
             "sélection sur mesure, personnalisation, écrins, logistique en France et à l'étranger, "
             "facturation entreprise. Discrétion et délais tenus.",
        crumb="Cadeaux d'affaires", service_type="Cadeaux d'affaires et dotations de prestige",
        area="France et international", badge="🎁 Entreprises · Cadeaux d'affaires",
        h1="Cadeaux d'affaires <span class=\"font-serif-italic\">qui ne ressemblent pas</span> à des cadeaux d'affaires",
        sub="Dix clients à remercier, un partenaire à marquer, une équipe à récompenser : nous "
            "sélectionnons, personnalisons, emballons et livrons, en France et à l'étranger, avec "
            "une facture et un seul interlocuteur.",
        photo=("real/pshop-cadeau.jpg", "Cadeau d'exception préparé par la conciergerie"),
        puces=["Sélection <b>sur mesure</b>", "Personnalisation et <b>écrins</b>", "Livraison <b>internationale</b>", "Facture <b>entreprise</b>"],
        cta="Préparer mes cadeaux",
        intro=[
            "Un cadeau d'affaires réussi dit quelque chose de celui qui l'offre : du soin, du goût, "
            "de l'attention à la personne. Un cadeau raté dit l'inverse, et il coûte le même prix. "
            "La différence tient à la sélection, à la personnalisation et à la logistique — trois "
            "choses que les équipes n'ont pas le temps de faire correctement en décembre.",
            "Nous travaillons avec des directions, des assistantes de direction et des cabinets qui "
            "nous confient leurs cadeaux de fin d'année, leurs remerciements ponctuels et leurs "
            "dotations d'événements. Chaque projet commence par un brief, se poursuit par une "
            "sélection chiffrée, et finit par des livraisons tracées, en France ou à Dubaï, Londres, "
            "Shanghai.",
        ],
        cards=("Ce que nous prenons en charge", "", [
            ("Brief et sélection", "Destinataires, budget par personne, message à faire passer, "
             "contraintes culturelles : nous proposons une sélection cohérente, du même niveau pour "
             "tous."),
            ("Personnalisation", "Gravure, broderie, carte manuscrite, écrin aux couleurs de "
             "l'entreprise sans tomber dans le logo partout."),
            ("Pièces d'exception", "Pour un partenaire clé : montre, pièce de joaillerie, objet "
             "d'artisanat, expérience privée."),
            ("Logistique", "Conditionnement, expédition assurée, livraison en main propre à Paris, "
             "envois internationaux avec les formalités."),
            ("Calendrier tenu", "Fin d'année, nouvel an chinois, Ramadan, anniversaires "
             "d'entreprise : nous anticipons les délais, surtout à l'international."),
            ("Facturation", "Devis, facture unique, relevé par destinataire si votre comptabilité le "
             "demande."),
        ]),
        sections=[
            ("Cadeaux et cultures : éviter l'impair", [
                "Un cadeau apprécié à Paris peut être maladroit à Shanghai ou à Riyad : couleurs, "
                "chiffres, alcool, objets porteurs de sens. Nos clients qui travaillent avec la Chine, "
                "les Émirats ou le Maroc nous demandent précisément ce filtre. Nous l'appliquons "
                "avant de proposer quoi que ce soit.",
            ]),
            ("Budgets et volumes", [
                "Nous travaillons aussi bien sur trois cadeaux d'exception que sur cent cadeaux "
                "soignés. Le budget par destinataire guide la sélection ; nos honoraires sont "
                "annoncés séparément, selon le volume et le niveau de personnalisation.",
            ]),
        ],
        zones=zones("/cadeaux-d-affaires-luxe"),
        faq_title="Questions fréquentes — cadeaux d'affaires",
        faq=[
            ("Quel délai prévoir ?",
             "Quelques jours pour une sélection simple, plusieurs semaines pour des pièces "
             "personnalisées ou des envois internationaux. Pour les fêtes de fin d'année, nous "
             "recommandons de nous écrire dès l'automne."),
            ("Livrez-vous à l'étranger ?",
             "Oui, avec les formalités douanières et, à Dubaï et Marrakech, une remise en main "
             "propre par nos équipes."),
            ("Pouvez-vous respecter une charte ou une politique cadeaux ?",
             "Oui : plafonds par personne, exclusions, traçabilité pour la conformité. Nous "
             "documentons chaque envoi."),
        ] + K.faq_contact(),
        form=("Préparer vos cadeaux d'affaires", "Nombre de destinataires, budget par personne, "
              "date, pays de livraison : nous revenons vers vous avec une sélection chiffrée.",
              "Paris / international", "Cadeaux d'affaires"),
    ),

    base(
        slug="personal-shopper-a-distance",
        title="Personal shopper à distance — acheter à Paris sans venir, livraison assurée dans le monde | Label Maison",
        desc="Vous vivez à Dubaï, Londres, New York, Shanghai ? Notre personal shopper achète pour "
             "vous à Paris : maisons de luxe, pièces épuisées, joaillerie, montres. Photos, "
             "validation, paiement sécurisé, envoi assuré avec les formalités.",
        crumb="À distance", service_type="Personal shopping à distance", area="International",
        badge="🌍 À distance · Depuis Paris",
        h1="Personal shopper <span class=\"font-serif-italic\">à distance</span> : Paris achète pour vous",
        sub="La pièce est à Paris, vous êtes ailleurs. Nous la trouvons, nous vous l'envoyons en "
            "photos, vous validez, nous l'achetons et nous l'expédions assurée, formalités comprises.",
        photo=("real/proof-bijou-poster.jpg", "Bijou remis à un client"),
        puces=["Photos et <b>validation</b>", "Paiement <b>sécurisé</b>", "Envoi <b>assuré</b>", "Formalités <b>expliquées</b>"],
        intro=[
            "Certaines pièces ne se trouvent qu'à Paris, ou s'y trouvent plus vite : collections "
            "des maisons françaises, éditions limitées, joaillerie, montres sur le marché "
            "secondaire. Nos clients expatriés et étrangers n'ont pas toujours un voyage prévu pour "
            "autant.",
            "Le personal shopping à distance fonctionne comme sur place, moins le déplacement : "
            "vous décrivez, nous cherchons, nous vous envoyons photos et détails, vous validez, nous "
            "achetons avec un paiement sécurisé, et nous expédions en envoi assuré avec les "
            "documents nécessaires. Nous vous expliquons avant l'achat ce que l'importation "
            "représente dans votre pays.",
        ],
        cards=("Comment cela fonctionne", "", [
            ("Votre demande", "Pièce, références, budget, pays de livraison, délai."),
            ("Recherche et photos", "Nous trouvons, photographions sous tous les angles, "
             "vérifions l'état et les papiers."),
            ("Validation et paiement", "Vous validez par écrit ; paiement sécurisé de la pièce et "
             "de nos honoraires, séparés."),
            ("Authentification", "Pour le marché secondaire : vérification indépendante avant "
             "paiement, systématique."),
            ("Expédition", "Envoi assuré avec suivi, emballage adapté, documents d'exportation "
             "et de détaxe quand elle s'applique."),
            ("Réception", "Nous restons joignables jusqu'à la livraison et gérons les éventuels "
             "retours avec la boutique."),
        ]),
        sections=[
            ("Détaxe, droits et TVA : ce qu'il faut savoir", [
                "Une pièce expédiée hors Union européenne peut bénéficier d'une exonération de TVA "
                "française à l'exportation selon les cas, mais elle sera soumise aux droits et taxes "
                "du pays de destination à l'arrivée. Nous vous donnons le coût complet avant que vous "
                "validiez ; les douanes de chaque pays font foi.",
            ]),
        ],
        zones=zones("/personal-shopper-a-distance"),
        faq_title="Questions fréquentes — personal shopper à distance",
        faq=[
            ("Dans quels pays livrez-vous ?",
             "Partout où un transporteur assuré livre. Nos envois les plus fréquents vont vers les "
             "Émirats, le Royaume-Uni, les États-Unis, la Suisse, Hong Kong et le Maroc."),
            ("Puis-je faire garder la pièce jusqu'à mon passage à Paris ?",
             "Oui : nous la conservons en lieu sûr et vous la remettons en main propre."),
            ("Comment payez-vous la pièce ?",
             "Vous réglez par virement sécurisé avant l'achat ; nous achetons en votre nom et vous "
             "transmettons la facture d'origine."),
        ] + K.faq_contact(),
        form=("Décrivez la pièce et votre pays", "Nous revenons vers vous avec la disponibilité, le "
              "prix complet et le délai de livraison.", "À distance", "Personal shopping — à distance"),
    ),

    base(
        slug="detaxe-shopping-paris",
        title="Shopping à Paris avec détaxe — accompagnement des visiteurs hors UE | Label Maison",
        desc="Visiteurs résidant hors Union européenne : faites vos achats à Paris avec un personal "
             "shopper et une détaxe faite dans les règles (bordereaux, validation au départ). "
             "Maisons de luxe, horlogerie, joaillerie, chauffeur et livraison à l'hôtel.",
        crumb="Détaxe", service_type="Shopping accompagné avec détaxe pour visiteurs étrangers",
        badge="🧾 Paris · Shopping & détaxe",
        h1="Shopping à Paris avec <span class=\"font-serif-italic\">détaxe</span>, sans mauvaise surprise",
        sub="Vous résidez hors Union européenne : une partie de la TVA sur vos achats parisiens vous "
            "est remboursable, à condition de respecter la procédure. Nous organisons la journée, "
            "les achats, les bordereaux et la validation au départ.",
        photo=("real/louis-vuitton.jpg", "Boutique Louis Vuitton à Paris"),
        puces=["Résidents <b>hors UE</b>", "Bordereaux <b>préparés</b>", "Validation au <b>départ</b>", "Chauffeur et <b>livraison hôtel</b>"],
        cta="Organiser ma journée",
        intro=[
            "Pour un visiteur résidant hors de l'Union européenne, la détaxe permet de récupérer une "
            "partie de la TVA sur les achats effectués en France, au-delà d'un montant minimum par "
            "boutique et par jour, avec un bordereau électronique à faire valider à la douane avant "
            "de quitter l'Union. La procédure est simple sur le papier et souvent ratée en "
            "pratique : bordereau non validé, passeport oublié, achats dispersés sous le seuil, "
            "délai dépassé.",
            "Nous accompagnons des visiteurs des Émirats, de Chine, de Hong Kong, des États-Unis et "
            "du Royaume-Uni : programme de boutiques, chauffeur, achats regroupés pour atteindre le "
            "seuil, bordereaux vérifiés, livraison à l'hôtel et rappel de la validation à l'aéroport.",
        ],
        cards=("Ce que nous organisons", "", [
            ("Programme de boutiques", "Selon vos envies et ce qui est réellement en stock, pour ne "
             "pas traverser Paris pour rien."),
            ("Rendez-vous en maison", "Accueil personnalisé, pièces réservées, salons privés quand "
             "ils sont proposés."),
            ("Détaxe en règle", "Passeport, seuil par boutique, bordereau électronique, choix du "
             "mode de remboursement, validation à la borne au départ."),
            ("Chauffeur", "Berline ou van entre les boutiques, les déjeuners et l'hôtel ; bagages "
             "gérés."),
            ("Livraison à l'hôtel", "Vous ne portez rien ; les achats vous attendent le soir."),
            ("Horlogerie et joaillerie", "Pour les pièces de valeur : accompagnement spécifique et "
             "authentification sur le marché secondaire."),
        ]),
        sections=[
            ("La détaxe en quatre règles", [
                "Résider hors de l'Union européenne et le prouver avec son passeport ; atteindre le "
                "montant minimum d'achats dans une même boutique le même jour ; obtenir le bordereau "
                "électronique au moment de l'achat ; le faire valider à la douane (borne ou guichet) "
                "avant de quitter l'Union, dans le délai prévu. Le remboursement arrive ensuite par "
                "carte ou en espèces selon l'option choisie, diminué des frais de l'opérateur. Les "
                "règles exactes sont celles de la douane française, qui fait foi.",
            ]),
        ],
        zones=zones("/detaxe-shopping-paris"),
        faq_title="Questions fréquentes — shopping et détaxe à Paris",
        faq=[
            ("Qui a droit à la détaxe ?",
             "Les visiteurs de plus de seize ans résidant hors de l'Union européenne, de passage en "
             "France pour moins de six mois, sur des achats de nature touristique."),
            ("Récupère-t-on toute la TVA ?",
             "Non : l'opérateur de détaxe prélève des frais, et le remboursement dépend de l'option "
             "choisie. Nous vous indiquons ce que vous récupérerez réellement."),
            ("Et si j'oublie de valider le bordereau à l'aéroport ?",
             "Le remboursement est perdu dans la plupart des cas. C'est pourquoi nous vous "
             "rappelons la validation et vous expliquons où se trouvent les bornes."),
            ("Organisez-vous cela pour des groupes ?",
             "Oui, avec un van et un programme adapté ; voir aussi notre accueil de "
             "<a href=\"/clientele-chinoise-paris\">clientèle chinoise à Paris</a>."),
        ] + K.faq_contact(),
        form=("Organiser votre journée shopping", "Dates, nombre de personnes, maisons ou pièces "
              "visées, hôtel : nous revenons vers vous avec un programme.", "Paris", "Shopping & détaxe"),
    ),

    base(
        slug="personal-shopper-dubai",
        title="Personal shopper à Dubaï — Dubai Mall, horlogerie, mode, sans TVA et sans mauvaise surprise | Label Maison",
        desc="Personal shopper francophone à Dubaï : Dubai Mall, Mall of the Emirates, horlogerie "
             "et joaillerie, pièces rares, négociation, authentification et cadre douanier au "
             "retour en France. Chauffeur et accompagnement sur place.",
        crumb="Dubaï", area="Dubaï", lieu="Dubaï · Paris",
        service_type="Personal shopping à Dubaï",
        badge="🇦🇪 Dubaï · Personal shopper",
        h1="Personal shopper à <span class=\"font-serif-italic\">Dubaï</span>",
        sub="Les plus grands centres commerciaux du monde, un marché horloger profond, des pièces "
            "absentes des boutiques européennes : Dubaï se visite avec quelqu'un qui connaît les "
            "adresses, les prix réels et ce que la douane française dira au retour.",
        photo=("real/dubai-downtown-nuit.jpg", "Downtown Dubaï de nuit"),
        gallery=K.P_DUBAI,
        puces=["Francophone <b>sur place</b>", "Horlogerie et <b>joaillerie</b>", "Négociation", "Douane <b>expliquée</b>"],
        intro=[
            "Dubaï concentre en quelques kilomètres les maisons de luxe, les horlogers, les "
            "joailliers et un marché secondaire actif, dans un cadre fiscal plus léger qu'en Europe. "
            "C'est tentant, et parfois réellement avantageux ; parfois pas, une fois les droits et "
            "la TVA à l'importation payés au retour en France. Nous faisons le calcul avant.",
            "Notre <a href=\"/conciergerie-dubai\">conciergerie à Dubaï</a> met à disposition un "
            "personal shopper francophone, un chauffeur et un réseau de boutiques et de courtiers. "
            "Voir aussi <a href=\"/montres-de-luxe-dubai\">montres de luxe à Dubaï</a>.",
        ],
        cards=("Ce que nous organisons à Dubaï", "", [
            ("Journée shopping", "Programme entre Dubai Mall, Mall of the Emirates, boutiques de "
             "créateurs et souks, avec chauffeur."),
            ("Horlogerie", "Sourcing, authentification indépendante, négociation : voir notre "
             "page dédiée."),
            ("Joaillerie et or", "Gold Souk et joailliers : prix au poids, poinçons, certificats."),
            ("Pièces rares", "Références absentes en Europe, éditions régionales, marché secondaire "
             "vérifié."),
            ("Achat à distance", "Vous n'êtes pas à Dubaï : nos contacts cherchent, nous expédions "
             "assuré."),
            ("Retour en France", "Ce qui doit être déclaré, ce que cela coûte, pour décider en "
             "connaissance de cause."),
        ]),
        sections=[
            ("Dubaï est-il vraiment moins cher ?", [
                "Sur certaines pièces, oui ; sur d'autres, l'écart disparaît une fois les droits et "
                "la TVA à l'importation ajoutés au retour en France, au-delà des franchises "
                "voyageurs. Nous vous donnons le prix complet, pas le prix vitrine.",
            ]),
        ],
        zones=zones("/personal-shopper-dubai"),
        faq_title="Questions fréquentes — personal shopper à Dubaï",
        faq=[
            ("Dois-je déclarer mes achats en rentrant en France ?",
             "Oui, au-delà des franchises voyageurs : droits et TVA à l'importation s'appliquent. "
             "Nous vous expliquons la procédure ; la douane fait foi."),
            ("Pouvez-vous négocier ?",
             "Sur le marché secondaire et dans les souks, oui ; dans les boutiques de maisons, "
             "rarement."),
            ("Combinez-vous avec un séjour ?",
             "Oui : villa, chauffeur, yacht, activités — voir notre conciergerie à Dubaï."),
        ] + K.faq_contact(),
        form=("Votre shopping à Dubaï", "Dates, pièces visées, budget : nous préparons la journée "
              "et le calcul complet.", "Dubaï", "Personal shopping — Dubaï"),
    ),

    base(
        slug="personal-shopper-marrakech",
        title="Personal shopper à Marrakech — artisanat d'exception, créateurs, souks sans arnaque | Label Maison",
        desc="Personal shopper francophone à Marrakech : artisanat d'exception (tapis, cuir, "
             "bijoux berbères, céramique), créateurs marocains, souks avec un guide de confiance, "
             "négociation, expédition en France. Chauffeur et accompagnement.",
        crumb="Marrakech", area="Marrakech", lieu="Marrakech · Paris",
        service_type="Personal shopping à Marrakech", gallery=K.P_MARRAKECH,
        badge="🇲🇦 Marrakech · Personal shopper",
        h1="Personal shopper à <span class=\"font-serif-italic\">Marrakech</span>",
        sub="Un tapis ancien, un cuir d'atelier, une pièce de créateur, des bijoux berbères "
            "authentiques : la médina en regorge, à condition de savoir où aller, quoi vérifier et "
            "combien payer. Nous vous accompagnons.",
        photo=("real/desert-pool.jpg", "Désert d'Agafay, près de Marrakech"),
        puces=["Adresses <b>vérifiées</b>", "Négociation <b>juste</b>", "Expédition en <b>France</b>", "Chauffeur <b>inclus</b>"],
        intro=[
            "Les souks de Marrakech sont l'un des meilleurs endroits au monde pour l'artisanat — et "
            "l'un des plus faciles pour payer trois fois le prix une pièce médiocre. La différence "
            "tient à l'adresse, à l'œil et à la négociation, trois choses que l'on n'acquiert pas en "
            "un séjour.",
            "Notre <a href=\"/conciergerie-marrakech\">conciergerie à Marrakech</a> vous accompagne "
            "avec un personal shopper francophone qui connaît les ateliers, les coopératives et les "
            "créateurs de la ville, négocie à votre place et organise l'expédition en France des "
            "pièces encombrantes.",
        ],
        cards=("Ce que nous organisons à Marrakech", "", [
            ("Tapis", "Tapis berbères anciens et contemporains : origine, nouage, état, prix réel."),
            ("Cuir et maroquinerie", "Ateliers de la médina, pièces sur mesure, délais tenus."),
            ("Bijoux et argent", "Bijoux berbères, argent au poids, poinçons vérifiés."),
            ("Créateurs marocains", "Mode, décoration, céramique : les adresses du Guéliz et de la "
             "médina qui valent le détour."),
            ("Décoration pour votre riad ou votre maison", "Lanternes, zellige, bois : sélection et "
             "expédition groupée."),
            ("Expédition en France", "Emballage, transporteur, formalités : vos achats arrivent "
             "après vous."),
        ]),
        sections=[
            ("Négocier à Marrakech : la règle", [
                "Tout se négocie dans la médina, sauf dans les boutiques de créateurs et les "
                "coopératives à prix fixes. Négocier n'est pas faire baisser le prix à tout prix : "
                "c'est payer le juste prix d'une pièce dont on a vérifié la qualité. Nous connaissons "
                "les fourchettes et nous vous évitons les deux extrêmes.",
            ]),
        ],
        zones=zones("/personal-shopper-marrakech"),
        faq_title="Questions fréquentes — personal shopper à Marrakech",
        faq=[
            ("Pouvez-vous expédier un tapis en France ?",
             "Oui : emballage, transport et formalités d'importation sont organisés et chiffrés avant "
             "l'achat."),
            ("Combinez-vous avec les activités ?",
             "Oui : désert, hammam, excursions — voir <a href=\"/activites-marrakech\">toutes nos "
             "activités à Marrakech</a>."),
        ] + K.faq_contact(),
        form=("Votre shopping à Marrakech", "Dates, pièces visées, budget : nous préparons la "
              "journée avec chauffeur.", "Marrakech", "Personal shopping — Marrakech"),
    ),
]
