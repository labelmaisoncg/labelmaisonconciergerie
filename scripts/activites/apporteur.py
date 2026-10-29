# -*- coding: utf-8 -*-
"""Famille « apporteur d'affaires » : 1 hub + 7 pages.

Seule somme publique : la prime du Cercle (150 € par propriétaire recommandé,
déclenchée à la première réservation), déjà affichée sur /cerclelabelmaison.
Pour les autres services, la rémunération est « convenue par écrit avant la
mise en relation » : nous n'inventons aucun pourcentage.
"""
from __future__ import annotations

from . import commun as K

HUB = K.HUB_APPORTEUR
TRAIL = [("Accueil", "/"), ("Apporteur d'affaires", HUB)]


def base(**kw) -> dict:
    d = dict(nav=K.NAV_APPORTEUR, footer=K.FOOT_ACTIVITES, why=K.WHY_APPORTEUR,
             steps=K.STEPS_APPORTEUR, area="France, Dubaï, Maroc, Chine",
             lieu="Paris · Dubaï · Marrakech", cta="Devenir apporteur d'affaires",
             mobcta="Devenir apporteur", gallery=K.P_SHOPPING,
             tagline="Apporteur d'affaires Label Maison — vous présentez, "
                     "<span class=\"font-serif-italic\">nous exécutons</span>.")
    d.update(kw)
    return d


LIENS = [("Apporteur d'affaires immobilier", "/apporteur-d-affaires-immobilier"),
         ("Apporteur montres de luxe", "/apporteur-d-affaires-montres-de-luxe"),
         ("Apporteur personal shopping", "/apporteur-d-affaires-personal-shopping"),
         ("Apporteur d'affaires Chine", "/apporteur-d-affaires-chine"),
         ("Apporteur d'affaires Dubaï", "/apporteur-d-affaires-dubai"),
         ("Apporteur d'affaires Maroc", "/apporteur-d-affaires-maroc"),
         ("Le contrat d'apporteur", "/contrat-apporteur-d-affaires"),
         ("Le Cercle : 150 € par propriétaire", "/cerclelabelmaison")]


def zones(exclure: str = "") -> tuple:
    return ("Apporteur d'affaires : nos autres programmes", "",
            [l for l in LIENS if l[1] != exclure] + [("Tous les programmes", HUB)],
            "Vous n'êtes pas sûr du service concerné ? Décrivez simplement qui vous pouvez "
            "recommander dans le formulaire : nous vous dirons quel programme s'applique.")


PAGES = [
    base(
        slug=HUB.strip("/"),
        title="Apporteur d'affaires — recommandez, nous exécutons, vous êtes payé | Label Maison",
        desc="Devenez apporteur d'affaires Label Maison : propriétaires, montres de luxe, personal "
             "shopping, Dubaï, Maroc, Chine. Prime convenue par écrit avant la mise en relation, "
             "versée dès que la condition est remplie.",
        crumb="Apporteur d'affaires", trail=[("Accueil", "/"), ("Le Cercle", "/cerclelabelmaison")],
        service_type="Programme d'apporteur d'affaires",
        offers=["Recommandation de propriétaires (Cercle)", "Apport d'affaires horlogerie",
                "Apport d'affaires personal shopping", "Apport d'affaires Dubaï et Maroc",
                "Apport d'affaires Chine", "Contrat d'apporteur écrit"],
        badge="🤝 Apporteur d'affaires · Tous services",
        h1="Apporteur d'affaires : vous présentez, <span class=\"font-serif-italic\">nous faisons le reste</span>",
        sub="Vous connaissez un propriétaire, un collectionneur, un dirigeant qui voyage, une famille "
            "qui achète à Paris ? Présentez-le-nous. La prime est fixée par écrit avant, et versée "
            "dès que l'affaire se concrétise.",
        photo=("real/proof-montre-client-poster.jpg", "Remise d'une montre à un client présenté par un apporteur"),
        puces=["Prime <b>écrite avant</b>", "Rien à <b>vendre</b>", "Paiement <b>à la condition</b>", "Tous nos <b>services</b>"],
        intro=[
            "Une conciergerie vit de recommandations. La plupart de nos clients nous ont été présentés "
            "par quelqu'un : un voisin, un notaire, un agent immobilier, un ami de passage à Dubaï, un "
            "collègue qui cherchait une montre. Nous avons décidé de rémunérer ces présentations "
            "proprement, par écrit, plutôt que par un merci.",
            "<strong>Le principe est simple.</strong> Vous nous présentez une personne qui a besoin "
            "d'un de nos services ; nous convenons avant la présentation de ce que vous touchez et à "
            "quel moment ; nous faisons le rendez-vous, la proposition et le travail ; vous êtes payé "
            "quand la condition convenue est remplie. Pour les propriétaires, c'est déjà formalisé : le "
            "<a href=\"/cerclelabelmaison\">Cercle Label Maison</a> verse 150 € par propriétaire "
            "recommandé dès la première réservation de son logement.",
        ],
        cards=("Ce que vous pouvez nous apporter", "Un programme par service, les mêmes règles partout.", [
            ("Un propriétaire",
             "Appartement à Paris, maison en Essonne, villa sur la Côte d'Azur ou à Marrakech : nous "
             "gérons la location courte ou moyenne durée. Prime de 150 € via le Cercle, à la "
             "première réservation."),
            ("Un acheteur ou un vendeur de montre",
             "Rolex, Patek Philippe, Audemars Piguet, Richard Mille : nous cherchons, authentifions "
             "et encadrons la transaction. Prime convenue par écrit selon l'opération."),
            ("Un client personal shopping",
             "Sacs sur liste d'attente, joaillerie, cadeaux d'affaires, achats à distance : nous "
             "obtenons la pièce. Prime convenue sur la prestation réalisée."),
            ("Un voyageur vers Dubaï ou le Maroc",
             "Villa, chauffeur, yacht, activités, séjour complet : nos conciergeries sur place "
             "prennent le relais. Prime sur le séjour organisé."),
            ("Un dirigeant qui va en Chine",
             "Sourcing, Foire de Canton, voyage d'affaires, Hong Kong : nous organisons le "
             "déplacement et les rendez-vous. Prime sur la mission."),
            ("Un partenaire professionnel",
             "Agence immobilière, notaire, gestionnaire de patrimoine, hôtel, agence de voyages : "
             "nous formalisons un accord d'apport récurrent."),
        ]),
        sections=[
            ("Ce que nous vous promettons, et ce que nous ne promettons pas", [
                "Nous promettons une règle écrite avant chaque présentation, un suivi de chaque "
                "recommandation et un paiement à la date convenue. Nous ne promettons pas de "
                "revenus : un apporteur gagne ce que ses recommandations produisent, ni plus ni moins. "
                "Nous préférons dix apporteurs qui présentent trois bonnes personnes par an à cent qui "
                "envoient des listes.",
                "Nous ne demandons jamais à un apporteur de vendre, de négocier ou de promettre quoi "
                "que ce soit en notre nom. Votre rôle s'arrête à la présentation ; c'est ce qui "
                "protège votre relation avec la personne recommandée.",
            ]),
            ("Qui devient apporteur d'affaires Label Maison ?", [
                "Des professionnels dont les clients ont naturellement besoin de nous : agents "
                "immobiliers, notaires, conseillers en gestion de patrimoine, courtiers en crédit, "
                "architectes d'intérieur, hôteliers, agences de voyages, horlogers et bijoutiers.",
                "Et des particuliers bien entourés : propriétaires déjà clients, expatriés, membres de "
                "clubs et d'associations, anciens élèves d'écoles, personnes qui vivent entre Paris, "
                "Dubaï, Casablanca et Shanghai. Si vous hésitez, le formulaire ci-dessous suffit "
                "pour poser la question.",
            ]),
        ],
        zones=("Choisissez votre programme", "Chaque page détaille les conditions propres au service.",
               LIENS, ""),
        faq_title="Questions fréquentes — apporteur d'affaires",
        faq=[
            ("Combien gagne un apporteur d'affaires ?",
             "Pour un propriétaire recommandé, 150 € à la première réservation (programme du "
             "Cercle). Pour les autres services, un montant ou un pourcentage convenu par écrit "
             "avant la présentation, selon la nature et la taille de l'opération. Nous ne publions "
             "pas de grille car les opérations n'ont rien de comparable entre elles."),
            ("Dois-je avoir un statut particulier ?",
             "Un particulier peut percevoir une prime de parrainage occasionnelle ; une activité "
             "régulière suppose un statut (micro-entreprise ou société) et une facture. Nous vous "
             "indiquons le cadre qui s'applique à chaque accord."),
            ("Quand suis-je payé ?",
             "À la condition convenue dans l'accord : mandat signé et première réservation pour un "
             "propriétaire, transaction conclue pour une montre, prestation réalisée et réglée pour "
             "le personal shopping ou un voyage. Le délai de versement figure dans l'accord."),
            ("Puis-je recommander plusieurs personnes ?",
             "Oui, sans limite. Chaque recommandation est suivie séparément et vous en connaissez "
             "l'état à tout moment."),
            ("Et si la personne vous contacte directement sans me citer ?",
             "Prévenez-nous avant la présentation, par message, avec le nom de la personne : c'est "
             "cette trace écrite qui fait foi, pas ce que la personne dit ensuite."),
        ] + K.faq_contact(),
        form=("Devenir apporteur d'affaires", "Dites-nous qui vous pouvez recommander et pour quel "
              "service. Nous vous répondons avec les conditions écrites du programme concerné.",
              "Paris / à distance", "Apporteur d'affaires"),
    ),

    base(
        slug="apporteur-d-affaires-immobilier",
        title="Apporteur d'affaires immobilier — recommandez un propriétaire, touchez 150 € | Label Maison",
        desc="Agents immobiliers, notaires, gestionnaires de patrimoine, particuliers : recommandez "
             "un propriétaire à Label Maison Conciergerie et touchez 150 € dès la première "
             "réservation de son logement. Conditions écrites, sans engagement.",
        crumb="Immobilier", trail=TRAIL,
        service_type="Apport d'affaires en gestion locative et conciergerie",
        badge="🏠 Apporteur · Immobilier",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">immobilier</span>",
        sub="Vous croisez des propriétaires tous les jours. Ceux qui hésitent entre louer, vendre ou "
            "laisser vide sont nos clients de demain. Présentez-les-nous : 150 € par logement, à la "
            "première réservation.",
        photo=("sens/sens-12.jpg", "Appartement géré par le réseau Label Maison"),
        gallery=[("sens/sens-04.jpg", "Salon d'un appartement géré"), ("sens/sens-08.jpg", "Chambre lumineuse d'un appartement géré"),
                 ("sens/sens-05.jpg", "Séjour prêt pour une arrivée"), ("real/gestion-villa.jpg", "Villa préparée avant une arrivée"),
                 ("sens/sens-14.jpg", "Chambre d'un appartement ancien"), ("studio/hero-terrasse.jpg", "Terrasse d'un logement géré")],
        puces=["150 € par <b>propriétaire</b>", "À la <b>première réservation</b>", "Sans <b>engagement</b>", "Recommandations <b>illimitées</b>"],
        intro=[
            "Un agent immobilier voit passer des vendeurs qui ne vendent pas, des acheteurs qui "
            "n'habiteront pas tout de suite, des héritiers qui ne savent pas quoi faire d'un "
            "appartement. Un notaire règle des successions avec un bien à faire fructifier. Un "
            "conseiller en patrimoine a des clients qui achètent pour louer. Tous ont besoin d'un "
            "gestionnaire qui exécute : c'est ce que nous faisons.",
            "Le programme est celui du <a href=\"/cerclelabelmaison\">Cercle Label Maison</a> : "
            "vous recommandez un propriétaire, nous signons le mandat et mettons le bien en "
            "location, et <strong>150 € vous sont versés dès la première réservation</strong>. Aucun "
            "plafond, aucun engagement, aucune commission prélevée sur le propriétaire pour vous "
            "rémunérer.",
        ],
        cards=("Les propriétaires qu'il nous faut", "Vous les reconnaîtrez tout de suite.", [
            ("Le bien en attente de vente", "Un appartement qui ne trouve pas preneur au prix voulu "
             "peut se louer en meublé ou en bail mobilité le temps que le marché revienne."),
            ("L'investisseur locatif", "Il vient d'acheter, il n'a pas le temps de gérer : nous "
             "meublons, mettons en ligne et gérons. Voir notre <a href=\"/investissement-locatif-paris\">investissement locatif</a>."),
            ("L'héritier ou l'indivision", "Un bien reçu en succession, plusieurs décideurs, personne "
             "sur place : la gestion déléguée évite le bien vide et les disputes."),
            ("Le propriétaire qui part", "Mutation, expatriation, retraite ailleurs : voir nos pages "
             "pour les <a href=\"/conciergerie-airbnb-proprietaires-expatries\">propriétaires à l'étranger</a>."),
            ("La résidence secondaire", "Villa sur la Côte d'Azur, maison en Bourgogne, riad à "
             "Marrakech : occupée quelques semaines, louée le reste de l'année."),
            ("Le propriétaire déçu", "Il a déjà une conciergerie et n'en est pas satisfait : nous "
             "reprenons la gestion sans interruption des réservations."),
        ]),
        sections=[
            ("Pour les professionnels : un accord d'apport récurrent", [
                "Au-delà du Cercle, nous formalisons avec les agences, études notariales et cabinets "
                "de gestion de patrimoine un accord écrit d'apport récurrent : liste des "
                "recommandations, état d'avancement, relevé des primes, facturation. Vous gardez "
                "votre client ; nous gérons son bien et vous rendons compte.",
                "Nous ne faisons ni transaction ni négociation : vos clients vendeurs ou acheteurs "
                "restent les vôtres, et nous vous les renvoyons quand ils veulent vendre ou acheter.",
            ]),
            ("Où intervenons-nous ?", [
                "Paris et l'Île-de-France en premier lieu, l'Essonne qui est notre territoire "
                "d'origine, la Côte d'Azur, la Bourgogne via notre réseau, et des villes de province "
                "couvertes avec des partenaires : voir notre "
                "<a href=\"/conciergerie-airbnb-france\">couverture ville par ville</a>. Si un bien est "
                "hors zone, nous vous le disons avant que vous ne présentiez le propriétaire.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-immobilier"),
        faq_title="Questions fréquentes — apporteur d'affaires immobilier",
        faq=[
            ("Le propriétaire paie-t-il plus cher parce qu'il a été recommandé ?",
             "Non. Nos honoraires de gestion sont les mêmes ; la prime est prise sur notre marge."),
            ("Faut-il une carte professionnelle pour être apporteur ?",
             "Vous ne faites ni transaction ni gestion : vous présentez un propriétaire à un "
             "gestionnaire. Si vous exercez une activité d'apport régulière, nous vous indiquons le "
             "cadre de facturation adapté à votre statut."),
            ("Que se passe-t-il si le bien n'est pas louable ?",
             "Nous le disons au propriétaire et à vous, honnêtement, et nous proposons une autre "
             "formule (bail mobilité, meublé longue durée) si elle est possible. La prime est "
             "déclenchée par la première réservation, quel que soit le régime retenu."),
            ("Puis-je recommander mon propre bien ?",
             "Le Cercle rémunère la recommandation d'un tiers. Pour votre propre bien, parlons "
             "directement gestion : voir notre <a href=\"/proprietaires\">offre propriétaires</a>."),
        ] + K.faq_contact(),
        form=("Recommander un propriétaire", "Indiquez votre activité et, si vous le souhaitez déjà, le "
              "type de bien et la ville. Nous revenons vers vous avec l'accord écrit.",
              "Paris / Île-de-France", "Apporteur d'affaires — immobilier"),
    ),

    base(
        slug="apporteur-d-affaires-montres-de-luxe",
        title="Apporteur d'affaires montres de luxe — présentez un acheteur ou un vendeur | Label Maison",
        desc="Vous connaissez quelqu'un qui cherche ou vend une Rolex, une Patek Philippe, une "
             "Audemars Piguet ? Présentez-le à Label Maison : recherche, authentification, "
             "transaction encadrée. Prime d'apport convenue par écrit avant la mise en relation.",
        crumb="Montres de luxe", trail=TRAIL,
        service_type="Apport d'affaires en horlogerie de luxe",
        badge="⌚ Apporteur · Horlogerie",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">montres de luxe</span>",
        sub="Un collègue qui cherche une référence introuvable, un proche qui veut vendre sans se "
            "faire avoir, un client qui a reçu une montre en héritage : présentez-les-nous. Nous "
            "cherchons, nous vérifions, nous encadrons la transaction, et vous touchez une prime "
            "convenue d'avance.",
        photo=("real/rolex-gmt-poignet.jpg", "Rolex GMT-Master portée au poignet"),
        gallery=K.P_MONTRE,
        puces=["Prime <b>convenue avant</b>", "Transaction <b>encadrée</b>", "Authentification <b>indépendante</b>", "Discrétion <b>totale</b>"],
        intro=[
            "Le marché des montres de luxe fonctionne au bouche-à-oreille, et pour cause : personne "
            "n'achète une pièce à plusieurs dizaines de milliers d'euros sur une annonce. Un acheteur "
            "veut savoir qui vérifie la pièce ; un vendeur veut savoir qui le paie et quand. Nous "
            "faisons exactement cela : voir notre page "
            "<a href=\"/achat-vente-montres-de-luxe\">achat et vente de montres de luxe</a>.",
            "Si vous nous présentez un acheteur ou un vendeur, nous convenons avant la présentation "
            "d'une prime d'apport — montant fixe ou pourcentage selon l'opération — versée quand la "
            "transaction est conclue et réglée. Vous ne touchez pas à la pièce, vous ne négociez "
            "rien, votre nom n'apparaît nulle part.",
        ],
        cards=("Les situations que vous pouvez nous apporter", "", [
            ("La recherche impossible", "Une référence absente des vitrines, une liste d'attente "
             "fermée : voir <a href=\"/acheter-une-rolex-paris\">acheter une Rolex à Paris</a> ou "
             "<a href=\"/acheter-une-patek-philippe-paris\">une Patek Philippe</a>."),
            ("La vente d'une pièce", "Un particulier qui veut vendre au bon prix, en sécurité, sans "
             "passer par les annonces : voir <a href=\"/vendre-sa-montre-de-luxe-paris\">vendre sa montre</a>."),
            ("L'héritage à évaluer", "Une ou plusieurs montres reçues en succession, dont personne ne "
             "connaît la valeur : <a href=\"/estimation-montre-de-luxe\">estimation</a> puis vente si souhaitée."),
            ("Le doute sur une pièce", "Quelqu'un hésite à acheter une montre d'occasion : "
             "<a href=\"/authentification-montre-de-luxe\">authentification indépendante</a> avant paiement."),
            ("L'achat à l'étranger", "Un client en déplacement à <a href=\"/montres-de-luxe-dubai\">Dubaï</a> "
             "ou à <a href=\"/montres-de-luxe-hong-kong\">Hong Kong</a> qui veut acheter sur place sans risque."),
            ("Le cadeau d'exception", "Une montre à offrir pour un anniversaire, un mariage, une "
             "retraite : voir <a href=\"/montre-cadeau-luxe\">offrir une montre de luxe</a>."),
        ]),
        sections=[
            ("Comment la prime est-elle calculée ?", [
                "Elle dépend de l'opération : une recherche de pièce et une vente n'ont pas la même "
                "économie, et une montre à dix mille euros n'est pas une montre à cent mille. C'est "
                "pourquoi nous ne publions pas de grille : nous convenons d'un montant ou d'un "
                "pourcentage par écrit, avant la présentation, et nous nous y tenons.",
                "La prime est versée une fois la transaction conclue et réglée, jamais sur une simple "
                "prise de contact. C'est la seule façon de rémunérer les présentations qui aboutissent "
                "et de rester sérieux avec les personnes que vous nous présentez.",
            ]),
            ("Qui apporte des affaires en horlogerie ?", [
                "Bijoutiers et horlogers qui ne traitent pas le marché secondaire, concierges d'hôtels, "
                "gestionnaires de patrimoine, avocats et notaires en charge de successions, "
                "collectionneurs qui préfèrent ne pas s'exposer, et simplement des amateurs bien "
                "entourés.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-montres-de-luxe"),
        faq_title="Questions fréquentes — apport d'affaires horlogerie",
        faq=[
            ("Dois-je connaître les montres pour être apporteur ?",
             "Non. Vous présentez une personne et son besoin ; l'expertise est de notre côté, avec "
             "un horloger indépendant pour l'authentification."),
            ("La personne présentée saura-t-elle que vous me rémunérez ?",
             "Nous ne cachons rien : si elle pose la question, nous répondons qu'un accord d'apport "
             "existe. Il ne change ni le prix de la pièce ni nos honoraires."),
            ("Et si la transaction n'aboutit pas ?",
             "Aucune prime n'est due, et vous n'êtes engagé à rien. Nous vous informons de l'issue "
             "dans les deux cas."),
            ("Puis-je apporter des affaires à l'étranger ?",
             "Oui : nos pages Dubaï et Hong Kong décrivent ce que nous faisons sur place. Les règles "
             "de douane au retour en France sont expliquées au client avant tout achat."),
        ] + K.faq_contact(),
        form=("Présenter un acheteur ou un vendeur", "Décrivez la situation (recherche, vente, "
              "héritage, doute) sans citer de nom : nous vous envoyons les conditions écrites.",
              "Paris / à distance", "Apporteur d'affaires — montres"),
    ),

    base(
        slug="apporteur-d-affaires-personal-shopping",
        title="Apporteur d'affaires personal shopping — sacs, joaillerie, cadeaux d'affaires | Label Maison",
        desc="Présentez un client à notre personal shopper (sacs sur liste d'attente, joaillerie, "
             "mode, cadeaux d'affaires, achats à distance) et touchez une prime d'apport convenue "
             "par écrit, versée à la prestation réalisée.",
        crumb="Personal shopping", trail=TRAIL,
        service_type="Apport d'affaires en personal shopping de luxe",
        badge="🛍️ Apporteur · Personal shopping",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">personal shopping</span>",
        sub="Une amie qui attend un sac depuis deux ans, une entreprise qui cherche des cadeaux pour "
            "ses clients, un expatrié qui veut acheter à Paris sans venir : présentez-les à notre "
            "personal shopper. Prime convenue d'avance, versée à la prestation.",
        photo=("real/louis-vuitton.jpg", "Boutique Louis Vuitton"),
        gallery=K.P_SHOPPING,
        puces=["Prime <b>convenue avant</b>", "Prestation <b>réalisée</b>", "Clients <b>particuliers et entreprises</b>", "Paris, <b>Dubaï</b>, à distance"],
        intro=[
            "Le personal shopping de luxe ne se trouve pas sur un moteur de recherche : on y vient "
            "parce que quelqu'un a dit « demande à Label Maison ». Sacs sur liste d'attente, pièces "
            "de joaillerie signées, cadeaux d'affaires qui ne ressemblent pas à des cadeaux "
            "d'affaires, achats à distance pour des clients qui vivent à Dubaï ou à Shanghai : voir "
            "notre <a href=\"/personal-shopper-paris\">personal shopper à Paris</a>.",
            "Pour chaque client que vous nous présentez, nous convenons d'une prime d'apport par "
            "écrit, versée quand la prestation est réalisée et réglée. Pour une entreprise qui nous "
            "confie ses cadeaux chaque année, l'accord peut être récurrent.",
        ],
        cards=("Les clients que vous pouvez nous présenter", "", [
            ("Le sac introuvable", "Hermès, Chanel, Louis Vuitton : liste d'attente ou marché "
             "secondaire vérifié. Voir <a href=\"/personal-shopper-sac-de-luxe-paris\">sacs de luxe</a>."),
            ("La pièce de joaillerie", "Cartier, Van Cleef & Arpels, Bulgari, diamants certifiés : voir "
             "<a href=\"/personal-shopper-joaillerie-paris\">joaillerie</a>."),
            ("L'entreprise et ses cadeaux", "Clients, partenaires, collaborateurs : voir "
             "<a href=\"/cadeaux-d-affaires-luxe\">cadeaux d'affaires</a>."),
            ("Le client à distance", "Il vit à l'étranger et veut acheter à Paris : voir "
             "<a href=\"/personal-shopper-a-distance\">personal shopper à distance</a>."),
            ("Le visiteur étranger à Paris", "Shopping accompagné, détaxe, livraison à l'hôtel : voir "
             "<a href=\"/detaxe-shopping-paris\">shopping et détaxe à Paris</a>."),
            ("Le client à Dubaï ou Marrakech", "Nos conciergeries sur place : voir "
             "<a href=\"/personal-shopper-dubai\">Dubaï</a> et <a href=\"/personal-shopper-marrakech\">Marrakech</a>."),
        ]),
        sections=[
            ("Pourquoi les hôtels, les agences et les assistantes nous recommandent", [
                "Parce qu'ils ont un client qui demande, et qu'ils préfèrent un interlocuteur qui "
                "répond dans l'heure, annonce ses honoraires séparément du prix de la pièce et livre "
                "où il faut. Un accord d'apport récurrent formalise la relation : vous gardez votre "
                "client, nous exécutons, vous êtes rémunéré à chaque prestation.",
            ]),
            ("Ce que nous ne faisons pas", [
                "Nous ne vendons pas de stock, nous ne prenons pas de marge cachée sur la pièce et "
                "nous ne travaillons pas avec des contrefaçons, même « de très bonne qualité ». Si un "
                "client présenté cherche cela, nous déclinons et nous vous le disons.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-personal-shopping"),
        faq_title="Questions fréquentes — apport d'affaires personal shopping",
        faq=[
            ("Sur quoi est calculée la prime ?",
             "Sur nos honoraires de prestation, jamais sur le prix de la pièce, afin que le client ne "
             "paie pas plus cher parce qu'il a été recommandé. Le montant ou le pourcentage est fixé "
             "par écrit avant la présentation."),
            ("Puis-je présenter une entreprise ?",
             "Oui, c'est même le cas le plus intéressant : cadeaux d'affaires, dotations, "
             "événements. L'accord devient récurrent et vous recevez un relevé par opération."),
            ("Que devient le client ensuite ?",
             "Il reste votre client. Nous ne le démarchons pas pour d'autres services sans vous en "
             "informer, et s'il nous présente lui-même quelqu'un, la règle du Cercle s'applique à lui."),
        ] + K.faq_contact(),
        form=("Présenter un client personal shopping", "Décrivez le type de demande (sac, joaillerie, "
              "cadeaux, achats à distance) et votre activité : nous vous envoyons les conditions.",
              "Paris / à distance", "Apporteur d'affaires — personal shopping"),
    ),

    base(
        slug="apporteur-d-affaires-chine",
        title="Apporteur d'affaires Chine — France-Chine, sourcing, Hong Kong, clientèle chinoise | Label Maison",
        desc="Vous connaissez un dirigeant qui part sourcer en Chine, une famille chinoise qui "
             "achète ou voyage à Paris, un acheteur à Hong Kong ? Présentez-les à Label Maison : "
             "prime d'apport convenue par écrit avant la mise en relation.",
        crumb="Chine", trail=TRAIL, area="France, Chine, Hong Kong",
        service_type="Apport d'affaires France–Chine",
        badge="🇨🇳 Apporteur · France–Chine",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">France–Chine</span>",
        sub="Dans les deux sens : des entreprises françaises qui vont en Chine pour sourcer ou "
            "prospecter, des familles et des entreprises chinoises qui viennent à Paris pour "
            "acheter, investir ou séjourner. Présentez-les-nous, nous organisons.",
        photo=("real/billetterie-avion.jpg", "Cabine d'un vol long-courrier"),
        gallery=K.P_VOYAGE,
        puces=["Dans les <b>deux sens</b>", "Prime <b>écrite avant</b>", "Sourcing, <b>Canton</b>, Hong Kong", "Clientèle chinoise à <b>Paris</b>"],
        intro=[
            "Nous développons deux activités liées à la Chine. Vers la Chine : l'accompagnement "
            "d'entreprises et d'entrepreneurs français qui vont sourcer, visiter des usines, exposer "
            "ou acheter — voir notre <a href=\"/conciergerie-chine\">conciergerie Chine</a>, le "
            "<a href=\"/sourcing-chine\">sourcing</a> et la <a href=\"/foire-de-canton-accompagnement\">Foire de Canton</a>. "
            "Depuis la Chine : l'accueil à Paris d'une clientèle chinoise et hongkongaise pour le "
            "shopping, l'immobilier et les séjours — voir <a href=\"/clientele-chinoise-paris\">clientèle chinoise à Paris</a>.",
            "Dans les deux cas, la présentation vaut de l'or, parce que la confiance ne se décrète "
            "pas à dix mille kilomètres. Nous convenons par écrit d'une prime d'apport avant chaque "
            "présentation, versée quand la mission ou la prestation est réalisée et réglée.",
        ],
        cards=("Ce que vous pouvez nous apporter", "", [
            ("Le dirigeant qui part sourcer", "PME, e-commerçant, marque qui cherche un fabricant : "
             "nous organisons le déplacement, les visites et le contrôle qualité avec nos partenaires."),
            ("L'exposant ou le visiteur de salon", "Foire de Canton, salons de Shanghai et Shenzhen : "
             "logistique, interprète, rendez-vous, hôtel."),
            ("L'acheteur à Hong Kong", "Montres et joaillerie sur un marché sans TVA : recherche, "
             "authentification, cadre douanier au retour. Voir <a href=\"/montres-de-luxe-hong-kong\">Hong Kong</a>."),
            ("La famille chinoise à Paris", "Shopping accompagné, détaxe, appartement pour un enfant "
             "étudiant, pied-à-terre : accueil et gestion."),
            ("L'investisseur chinois", "Appartement à Paris acheté comme placement ou pied-à-terre : "
             "gestion à distance, reporting écrit. Voir <a href=\"/conciergerie-airbnb-expatrie-chine\">propriétaires en Chine</a>."),
            ("L'intermédiaire professionnel", "Cabinet, agence, association franco-chinoise, "
             "université : accord d'apport récurrent dans les deux sens."),
        ]),
        sections=[
            ("Pourquoi un programme d'apport spécifique à la Chine", [
                "Parce que personne ne confie une mission en Chine, ni un enfant à Paris, à une "
                "entreprise qu'il a trouvée seul sur internet. Les affaires franco-chinoises se font "
                "par présentation, et celui qui présente prend une responsabilité : nous la "
                "reconnaissons par une prime écrite et un compte rendu de ce que nous avons fait "
                "pour la personne présentée.",
            ]),
            ("Langues et interlocuteurs", [
                "Nos échanges se font en français et en anglais ; pour le mandarin et le cantonais, "
                "nous travaillons avec des interprètes partenaires. Nous ne prétendons pas être une "
                "entreprise chinoise : nous sommes une conciergerie française qui organise bien les "
                "choses en Chine, avec des gens sur place que nous connaissons.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-chine"),
        faq_title="Questions fréquentes — apport d'affaires Chine",
        faq=[
            ("La prime est-elle la même pour un voyage de sourcing et pour un client à Paris ?",
             "Non : chaque type de mission a sa propre économie. Nous convenons d'un montant ou d'un "
             "pourcentage adapté, par écrit, avant la présentation."),
            ("Puis-je être apporteur depuis la Chine ?",
             "Oui. La prime est versée en euros sur un compte européen ou, selon l'accord, par un "
             "autre moyen convenu à l'avance."),
            ("Organisez-vous vous-mêmes les missions en Chine ?",
             "Nous les préparons et les coordonnons, avec des partenaires locaux pour l'interprétariat, "
             "le transport et le contrôle qualité. Le client a un interlocuteur francophone du début "
             "à la fin."),
        ] + K.faq_contact(),
        form=("Présenter une affaire France–Chine", "Décrivez le sens (vers la Chine ou vers Paris) et "
              "le type de besoin : nous revenons vers vous avec les conditions écrites.",
              "Paris / Chine", "Apporteur d'affaires — Chine"),
    ),

    base(
        slug="apporteur-d-affaires-dubai",
        title="Apporteur d'affaires Dubaï — séjours, villas, yachts, montres, immobilier | Label Maison",
        desc="Présentez un voyageur, un investisseur ou un acheteur de montre à notre conciergerie "
             "de Dubaï et touchez une prime d'apport convenue par écrit avant la mise en relation.",
        crumb="Dubaï", trail=TRAIL, area="Dubaï, Émirats arabes unis",
        service_type="Apport d'affaires conciergerie Dubaï", lieu="Dubaï · Paris",
        badge="🇦🇪 Apporteur · Dubaï",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">Dubaï</span>",
        sub="Un ami qui part à Dubaï et veut un séjour organisé, un client qui veut y acheter une "
            "montre ou un appartement, une entreprise qui y envoie une équipe : présentez-les à "
            "notre conciergerie sur place.",
        photo=("real/dubai-downtown-nuit.jpg", "Downtown Dubaï de nuit"),
        gallery=K.P_DUBAI,
        puces=["Conciergerie <b>sur place</b>", "Prime <b>écrite avant</b>", "Séjours, montres, <b>immobilier</b>", "Francophone <b>7j/7</b>"],
        intro=[
            "Dubaï est l'une de nos destinations historiques : <a href=\"/conciergerie-dubai\">conciergerie</a>, "
            "<a href=\"/location-villa-dubai\">villas</a>, <a href=\"/yacht-dubai\">yachts</a>, "
            "<a href=\"/chauffeur-prive-dubai\">chauffeurs</a>, <a href=\"/activites-vip-dubai\">expériences</a>, "
            "<a href=\"/montres-de-luxe-dubai\">montres</a> et <a href=\"/investissement-immobilier-dubai\">immobilier</a>. "
            "Tout ce qu'un visiteur ou un investisseur francophone peut y chercher, nous l'organisons.",
            "Présentez-nous quelqu'un qui part à Dubaï, qui y vit ou qui veut y investir : la prime "
            "d'apport est convenue par écrit avant la présentation et versée quand le séjour ou la "
            "prestation est réalisé et réglé.",
        ],
        cards=("Les affaires que vous pouvez nous apporter à Dubaï", "", [
            ("Le séjour complet", "Villa, chauffeur, yacht, tables, activités : une semaine organisée "
             "du décollage à l'atterrissage."),
            ("Le voyage d'entreprise", "Séminaire, incentive, délégation : logistique, transferts en "
             "van, soirées."),
            ("L'achat de montre", "Sourcing local, authentification, cadre douanier au retour."),
            ("L'investissement immobilier", "Achat en freehold, gestion locative : voir "
             "<a href=\"/investissement-immobilier-dubai\">investir à Dubaï</a>."),
            ("L'expatrié qui s'installe", "Intendance, résidence, véhicule, démarches du quotidien."),
            ("L'expatrié qui possède en France", "Son appartement parisien géré à distance : voir "
             "<a href=\"/conciergerie-airbnb-expatrie-dubai\">propriétaires à Dubaï</a>."),
        ]),
        sections=[
            ("Qui apporte des affaires sur Dubaï", [
                "Agences de voyages, assistantes de direction, conciergeries d'entreprise, "
                "expatriés installés aux Émirats, courtiers et agents immobiliers, horlogers, et "
                "simplement des voyageurs réguliers qui savent ce qu'un bon séjour veut dire.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-dubai"),
        faq_title="Questions fréquentes — apport d'affaires Dubaï",
        faq=[
            ("Puis-je être apporteur en vivant à Dubaï ?",
             "Oui. L'accord est le même ; la prime est versée en euros ou, selon l'accord, en dirhams."),
            ("Un séjour annulé donne-t-il droit à la prime ?",
             "Non : la prime est versée sur prestation réalisée et réglée. Un report conserve "
             "l'accord."),
            ("Travaillez-vous aussi à Abu Dhabi ?",
             "Oui, pour les transferts, séjours et expériences, avec nos partenaires locaux."),
        ] + K.faq_contact(),
        form=("Présenter une affaire à Dubaï", "Séjour, entreprise, montre, immobilier : décrivez le "
              "besoin, nous vous envoyons les conditions écrites.", "Dubaï", "Apporteur d'affaires — Dubaï"),
    ),

    base(
        slug="apporteur-d-affaires-maroc",
        title="Apporteur d'affaires Maroc — Marrakech, séjours, riads, investissement | Label Maison",
        desc="Présentez un voyageur, un investisseur ou un propriétaire à notre conciergerie de "
             "Marrakech et touchez une prime d'apport convenue par écrit avant la mise en relation.",
        crumb="Maroc", trail=TRAIL, area="Maroc", lieu="Marrakech · Paris",
        service_type="Apport d'affaires conciergerie Maroc",
        badge="🇲🇦 Apporteur · Maroc",
        h1="Apporteur d'affaires <span class=\"font-serif-italic\">Maroc</span>",
        sub="Un groupe d'amis qui part à Marrakech, une famille qui achète un riad, un propriétaire "
            "qui veut faire gérer sa villa : présentez-les à notre conciergerie sur place.",
        photo=("real/desert-pool.jpg", "Piscine dans le désert d'Agafay, près de Marrakech"),
        gallery=K.P_MARRAKECH,
        puces=["Conciergerie à <b>Marrakech</b>", "Prime <b>écrite avant</b>", "Séjours, riads, <b>gestion</b>", "Francophone <b>7j/7</b>"],
        intro=[
            "À Marrakech, nous organisons des séjours complets — <a href=\"/conciergerie-marrakech\">conciergerie</a>, "
            "<a href=\"/location-villa-marrakech\">villas et riads</a>, <a href=\"/riad-prive-marrakech\">riad privatisé</a>, "
            "<a href=\"/chauffeur-prive-marrakech\">chauffeur</a>, <a href=\"/activites-marrakech\">activités</a> — et nous "
            "accompagnons ceux qui y investissent : voir <a href=\"/investissement-locatif-marrakech\">investir à Marrakech</a>.",
            "Présentez-nous un voyageur, un investisseur ou un propriétaire : la prime d'apport est "
            "convenue par écrit avant la présentation et versée quand la prestation est réalisée et "
            "réglée.",
        ],
        cards=("Les affaires que vous pouvez nous apporter au Maroc", "", [
            ("Le séjour entre amis ou en famille", "Riad ou villa, chauffeur, désert d'Agafay, "
             "tables : tout est calé avant le départ."),
            ("L'événement privé", "Anniversaire, mariage, séminaire : lieu privatisé, logistique, "
             "animations."),
            ("Le riad ou la villa à faire gérer", "Un bien à Marrakech, un propriétaire en France : "
             "mise en location et intendance."),
            ("L'investisseur", "Achat de riad, villa ou appartement, puis gestion : voir "
             "<a href=\"/investissement-locatif-marrakech\">investir à Marrakech</a>."),
            ("Le Franco-Marocain qui possède en France", "Son bien parisien géré à distance : voir "
             "<a href=\"/conciergerie-airbnb-expatrie-maroc\">propriétaires au Maroc</a>."),
            ("L'excursion", "Essaouira, Ouzoud, Ourika, montgolfière, quad : voir "
             "<a href=\"/activites-marrakech\">toutes les activités</a>."),
        ]),
        sections=[
            ("Qui apporte des affaires au Maroc", [
                "Agences de voyages, organisateurs d'événements, agents immobiliers de Marrakech et "
                "de Casablanca, binationaux installés des deux côtés, et clients qui reviennent "
                "chaque année.",
            ]),
        ],
        zones=zones("/apporteur-d-affaires-maroc"),
        faq_title="Questions fréquentes — apport d'affaires Maroc",
        faq=[
            ("Puis-je être apporteur en vivant au Maroc ?",
             "Oui. La prime est versée en euros sur un compte européen ou, selon l'accord, en dirhams "
             "sur place."),
            ("Couvrez-vous d'autres villes que Marrakech ?",
             "Marrakech en priorité, Essaouira et l'Atlas pour les excursions. Pour Casablanca, Rabat "
             "ou Tanger, nous répondons au cas par cas avec nos partenaires."),
        ] + K.faq_contact(),
        form=("Présenter une affaire au Maroc", "Séjour, événement, bien à gérer, investissement : "
              "décrivez le besoin, nous vous envoyons les conditions écrites.", "Marrakech",
              "Apporteur d'affaires — Maroc"),
    ),

    base(
        slug="contrat-apporteur-d-affaires",
        title="Contrat d'apporteur d'affaires : ce qu'il contient, comment vous êtes payé | Label Maison",
        desc="Ce que prévoit un accord d'apporteur d'affaires avec Label Maison : objet, prime ou "
             "pourcentage, condition de déclenchement, délai de paiement, confidentialité, statut "
             "et facturation. Lisible en une page.",
        crumb="Le contrat", trail=TRAIL,
        service_type="Accord d'apporteur d'affaires",
        badge="📄 Apporteur · Le contrat",
        h1="Le contrat d'apporteur d'affaires, <span class=\"font-serif-italic\">en clair</span>",
        sub="Une page, six clauses, aucune surprise. Voici ce que contient l'accord que nous signons "
            "avec chaque apporteur avant la première présentation.",
        photo=("real/pshop-cadeau.jpg", "Document et cadeau préparés par la conciergerie"),
        gallery=K.P_SHOPPING,
        puces=["Six <b>clauses</b>", "Signature <b>électronique</b>", "Prime <b>écrite</b>", "Résiliable <b>à tout moment</b>"],
        intro=[
            "Un apport d'affaires qui n'est pas écrit finit toujours par une discussion désagréable. "
            "Nous avons donc un accord court, le même pour tout le monde, dont seules les lignes "
            "chiffrées changent. Il se signe en ligne, avant la première présentation, et chacun en "
            "garde une copie.",
            "Il ne crée aucune exclusivité, aucun objectif et aucune obligation de présenter qui que "
            "ce soit : vous pouvez ne jamais l'utiliser, ou le résilier d'un message.",
        ],
        cards=("Les six clauses", "Ce que vous lirez dans l'accord.", [
            ("1. L'objet", "Le ou les services concernés (gestion de biens, horlogerie, personal "
             "shopping, séjours, Chine) et le périmètre géographique."),
            ("2. La rémunération", "Montant fixe ou pourcentage de nos honoraires, par type "
             "d'opération. Pour les propriétaires : 150 € via le Cercle."),
            ("3. Le déclenchement", "L'événement précis qui rend la prime due : mandat signé et "
             "première réservation, transaction conclue et réglée, prestation réalisée et réglée."),
            ("4. Le paiement", "Délai après déclenchement, mode de versement, relevé transmis. Une "
             "facture pour les professionnels, une attestation pour les particuliers."),
            ("5. La preuve de présentation", "Un message écrit avant le premier contact, avec le nom "
             "de la personne présentée : c'est ce qui fait foi."),
            ("6. Confidentialité et résiliation", "Ce que chacun s'engage à ne pas divulguer, et la "
             "faculté de résilier à tout moment sans frais, les affaires en cours restant dues."),
        ]),
        sections=[
            ("Statut et fiscalité de l'apporteur", [
                "Une prime occasionnelle de parrainage perçue par un particulier reste à déclarer au "
                "titre de ses revenus ; une activité régulière d'apport relève d'un statut "
                "professionnel (micro-entreprise ou société) avec facturation. Nous ne sommes pas "
                "votre conseil fiscal : nous vous indiquons le cadre qui s'applique à l'accord, et "
                "votre expert-comptable valide.",
            ]),
            ("Ce que l'accord ne vous demande pas", [
                "Ni de vendre, ni de négocier, ni de promettre un prix ou un résultat en notre nom, "
                "ni de présenter un nombre minimal de personnes. Un apporteur qui « vend » pour nous "
                "nous met en difficulté avec la personne présentée : nous préférons une présentation "
                "sobre et une exécution irréprochable.",
            ]),
        ],
        zones=zones("/contrat-apporteur-d-affaires"),
        faq_title="Questions fréquentes — contrat d'apporteur",
        faq=[
            ("Puis-je lire l'accord avant de m'engager ?",
             "Oui : nous vous l'envoyons sur simple demande via le formulaire, sans engagement."),
            ("L'accord est-il exclusif ?",
             "Non. Vous restez libre de travailler avec qui vous voulez, et nous aussi."),
            ("Que se passe-t-il si je résilie avec des affaires en cours ?",
             "Les primes des affaires déjà présentées restent dues si elles se concrétisent dans le "
             "délai prévu à l'accord."),
            ("Puis-je apporter des affaires à l'étranger ?",
             "Oui, l'objet de l'accord précise les pays concernés : France, Émirats, Maroc, Chine et "
             "Hong Kong aujourd'hui."),
        ] + K.faq_contact(),
        form=("Recevoir l'accord d'apporteur", "Indiquez les services qui vous intéressent : nous vous "
              "envoyons l'accord à lire, sans engagement.", "Paris / à distance",
              "Apporteur d'affaires — contrat"),
    ),
]
