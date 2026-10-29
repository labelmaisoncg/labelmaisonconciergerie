# -*- coding: utf-8 -*-
"""Famille « Chine » : 1 hub + 4 pages.

Nous sommes une conciergerie française qui organise des déplacements et des
missions en Chine avec des partenaires locaux (interprètes, chauffeurs, agents
de sourcing). Les textes ne prétendent jamais à une implantation chinoise, ni à
une équipe sinophone en propre. Les repères factuels (Foire de Canton deux fois
par an à Guangzhou, Hong Kong sans TVA, détaxe française pour les résidents
hors UE) sont des faits publics.
"""
from __future__ import annotations

from . import commun as K

HUB = K.HUB_CHINE
TRAIL = [("Accueil", "/"), ("Chine", HUB)]


def base(**kw) -> dict:
    d = dict(nav=K.NAV_CHINE, footer=K.FOOT_ACTIVITES, why=K.WHY_CHINE, steps=K.STEPS_DEMANDE,
             area="Chine, Hong Kong", lieu="Paris · Shanghai · Hong Kong", cta="Préparer mon déplacement",
             mobcta="Faire une demande", gallery=K.P_VOYAGE,
             tagline="Vos affaires en Chine, organisées depuis Paris — "
                     "<span class=\"font-serif-italic\">avec des gens sur place</span>.")
    d.update(kw)
    return d


LIENS = [("Conciergerie Chine", HUB), ("Sourcing en Chine", "/sourcing-chine"),
         ("Foire de Canton", "/foire-de-canton-accompagnement"),
         ("Voyage d'affaires en Chine", "/voyage-d-affaires-chine"),
         ("Clientèle chinoise à Paris", "/clientele-chinoise-paris"),
         ("Montres à Hong Kong", "/montres-de-luxe-hong-kong"),
         ("Apporteur d'affaires Chine", "/apporteur-d-affaires-chine"),
         ("Propriétaires vivant en Chine", "/conciergerie-airbnb-expatrie-chine")]


def zones(exclure: str = "") -> tuple:
    return ("Chine et Hong Kong : nos autres services", "",
            [l for l in LIENS if l[1] != exclure],
            "Vous avez un besoin qui ne rentre dans aucune case ? Le formulaire ci-dessous suffit : "
            "nous vous dirons si nous savons le faire, et avec qui.")


PAGES = [
    base(
        slug=HUB.strip("/"),
        title="Conciergerie Chine — sourcing, voyages d'affaires, Hong Kong, accueil à Paris | Label Maison",
        desc="Conciergerie francophone pour vos affaires en Chine : sourcing et visites d'usines, "
             "Foire de Canton, voyage d'affaires organisé, achats à Hong Kong, et accueil à Paris "
             "d'une clientèle chinoise. Un interlocuteur, des partenaires sur place.",
        crumb="Chine", trail=[("Accueil", "/"), ("Conciergerie privée", "/conciergerie-privee-paris")],
        service_type="Conciergerie d'affaires France–Chine",
        offers=["Organisation de voyage d'affaires en Chine", "Accompagnement sourcing et visites d'usines",
                "Foire de Canton", "Achats à Hong Kong", "Accueil de clientèle chinoise à Paris",
                "Interprètes et chauffeurs partenaires"],
        badge="🇨🇳 Chine · Conciergerie d'affaires",
        h1="Vos affaires en <span class=\"font-serif-italic\">Chine</span>, organisées depuis Paris",
        sub="Sourcer un produit, visiter une usine, exposer à Canton, acheter à Hong Kong, ou accueillir "
            "à Paris vos clients chinois : nous préparons, nous coordonnons, et vous gardez un "
            "interlocuteur francophone du premier message au retour.",
        photo=("real/billetterie-avion.jpg", "Cabine d'un vol long-courrier vers la Chine"),
        puces=["Interlocuteur <b>francophone</b>", "Partenaires <b>sur place</b>", "Calcul <b>complet</b>", "Dans les <b>deux sens</b>"],
        intro=[
            "La Chine n'est pas une destination que l'on improvise. Les rendez-vous se prennent par "
            "introduction, les usines se visitent avec quelqu'un qui parle la langue et connaît les "
            "codes, les salons se préparent des semaines à l'avance, et le coût réel d'un produit "
            "n'est connu qu'une fois le transport, les droits et le contrôle qualité additionnés.",
            "<strong>Label Maison Conciergerie</strong> applique à la Chine ce qu'elle fait à Paris, "
            "Dubaï et Marrakech : un interlocuteur unique, une organisation écrite, des partenaires "
            "locaux identifiés — interprètes, chauffeurs, agents de sourcing, hôtels — et la vérité "
            "sur ce qui vaut le déplacement et ce qui ne le vaut pas.",
        ],
        cards=("Ce que nous organisons", "Vers la Chine, et depuis la Chine.", [
            ("Sourcing et visites d'usines", "Identification de fabricants, prise de rendez-vous, "
             "visites accompagnées, échantillons, contrôle qualité avant expédition. Voir "
             "<a href=\"/sourcing-chine\">sourcing en Chine</a>."),
            ("Foire de Canton et salons", "Accréditation, hôtel, transferts, interprète, programme de "
             "rendez-vous. Voir <a href=\"/foire-de-canton-accompagnement\">Foire de Canton</a>."),
            ("Voyage d'affaires complet", "Vols, hôtels, chauffeur, interprète, dîners, visa : voir "
             "<a href=\"/voyage-d-affaires-chine\">voyage d'affaires en Chine</a>."),
            ("Achats à Hong Kong", "Montres et joaillerie sur un marché sans TVA, avec "
             "authentification et cadre douanier au retour : voir <a href=\"/montres-de-luxe-hong-kong\">Hong Kong</a>."),
            ("Clientèle chinoise à Paris", "Shopping accompagné, détaxe, séjour, appartement : voir "
             "<a href=\"/clientele-chinoise-paris\">accueil à Paris</a>."),
            ("Propriétaires vivant en Chine", "Un bien à Paris géré à distance, reporting écrit : "
             "voir <a href=\"/conciergerie-airbnb-expatrie-chine\">propriétaires en Chine</a>."),
        ]),
        sections=[
            ("Comment nous travaillons en Chine", [
                "Nous préparons tout depuis Paris, en français, et nous coordonnons sur place avec "
                "des partenaires que nous connaissons : interprètes d'affaires, chauffeurs, agents "
                "de sourcing, hôtels. Selon la mission, un membre de notre équipe vous accompagne ou "
                "la coordination se fait à distance avec des points quotidiens.",
                "Nous ne prétendons pas être une entreprise chinoise ni parler mandarin en interne : "
                "nous sommes une conciergerie française qui sait organiser et contrôler. C'est "
                "précisément ce qui manque à la plupart des premiers déplacements.",
            ]),
            ("Ce que coûte vraiment un produit sourcé en Chine", [
                "Le prix départ usine n'est que le début. S'y ajoutent le transport (aérien ou "
                "maritime), l'assurance, les droits de douane selon la nomenclature du produit, la "
                "TVA à l'importation, le dédouanement, le contrôle qualité et, souvent, un "
                "déplacement. Nous chiffrons l'ensemble avant que vous engagiez quoi que ce soit, et "
                "nous vous disons quand un sourcing en Europe serait plus rentable.",
            ]),
        ],
        zones=zones(HUB),
        faq_title="Questions fréquentes — conciergerie Chine",
        faq=[
            ("Faut-il un visa pour aller en Chine ?",
             "Les règles d'entrée évoluent régulièrement, avec des exemptions de courte durée pour "
             "certains passeports. Nous vérifions la règle en vigueur à la date de votre voyage et "
             "vous indiquons les démarches ; l'ambassade et les centres de visa font foi."),
            ("Parlez-vous chinois ?",
             "Nos échanges avec vous sont en français ; sur place, nous travaillons avec des "
             "interprètes partenaires pour le mandarin et le cantonais."),
            ("Pouvez-vous organiser une mission sans que je me déplace ?",
             "Oui pour une partie des besoins : recherche de fabricants, échantillons, contrôle "
             "qualité par un partenaire. Pour une négociation importante ou un premier contrat, nous "
             "recommandons le déplacement."),
            ("Travaillez-vous à Hong Kong ?",
             "Oui, surtout pour l'horlogerie et la joaillerie, et comme porte d'entrée vers "
             "Shenzhen et Canton."),
            ("Accueillez-vous des clients chinois à Paris ?",
             "Oui : shopping accompagné, détaxe, séjours et gestion de biens pour des familles et "
             "des entreprises chinoises. Voir notre page dédiée."),
        ] + K.faq_contact(),
        form=("Parlons de votre projet en Chine", "Sourcing, salon, voyage, Hong Kong, accueil à Paris : "
              "décrivez le besoin et les dates envisagées, nous revenons vers vous avec une "
              "proposition écrite.", "Chine / Hong Kong", "Conciergerie Chine"),
    ),

    base(
        slug="sourcing-chine",
        title="Sourcing en Chine accompagné — fabricants, visites d'usines, contrôle qualité | Label Maison",
        desc="Sourcing en Chine pour PME, e-commerçants et marques : identification de fabricants, "
             "rendez-vous, visites d'usines accompagnées, échantillons, contrôle qualité et calcul "
             "du coût complet rendu en France. Interlocuteur francophone.",
        crumb="Sourcing", trail=TRAIL,
        service_type="Accompagnement au sourcing de produits en Chine",
        badge="🏭 Chine · Sourcing",
        h1="Sourcing en <span class=\"font-serif-italic\">Chine</span>, accompagné de bout en bout",
        sub="Trouver le bon fabricant, le visiter, obtenir des échantillons, contrôler avant "
            "expédition et connaître le prix réel rendu en France : nous organisons chaque étape avec "
            "nos partenaires sur place.",
        photo=("real/proof-avion-poster.jpg", "Vue depuis le hublot d'un vol vers la Chine"),
        puces=["Fabricants <b>identifiés</b>", "Visites <b>accompagnées</b>", "Contrôle <b>qualité</b>", "Coût <b>rendu en France</b>"],
        cta="Décrire mon produit",
        intro=[
            "Le sourcing en Chine se joue sur trois choses : parler à la bonne usine et non à un "
            "intermédiaire qui se fait passer pour elle, vérifier ce qui sort de la chaîne avant "
            "d'avoir payé, et connaître le coût complet rendu chez vous. Les plateformes en ligne ne "
            "garantissent aucune des trois.",
            "Nous accompagnons des PME, des e-commerçants, des créateurs de marques et des "
            "restaurateurs qui veulent produire ou acheter en Chine sans y laisser leur première "
            "commande. Nous ne sommes pas un bureau d'achat : nous organisons, nous accompagnons et "
            "nous contrôlons, avec des agents de sourcing partenaires à Shenzhen, Canton, Yiwu et "
            "Shanghai.",
        ],
        cards=("Les étapes que nous prenons en charge", "", [
            ("Cahier des charges", "Produit, quantités, qualité attendue, certifications nécessaires "
             "pour le marché européen (CE, normes), budget cible, délai."),
            ("Identification de fabricants", "Présélection par nos partenaires, vérification de "
             "l'existence réelle de l'usine, premiers échanges et devis comparés."),
            ("Visites d'usines", "Déplacement organisé, interprète, chauffeur, programme de visites "
             "sur deux ou trois villes, compte rendu écrit."),
            ("Échantillons et pré-série", "Commande, réception, validation avant lancement de la "
             "production."),
            ("Contrôle qualité", "Inspection avant expédition par un partenaire indépendant, rapport "
             "photo, décision d'expédier ou non."),
            ("Logistique et douane", "Transitaire, Incoterm, assurance, droits et TVA à "
             "l'importation chiffrés avant commande."),
        ]),
        sections=[
            ("Shenzhen, Canton, Yiwu, Shanghai : où aller selon le produit", [
                "L'électronique et les objets connectés se sourcent à Shenzhen ; le textile, la "
                "maroquinerie et le mobilier autour de Canton et du Guangdong ; les petits articles, "
                "accessoires et objets promotionnels sur le marché de Yiwu, le plus grand marché de "
                "gros au monde pour ces produits ; les cosmétiques et l'industrie plus technique "
                "autour de Shanghai et du Zhejiang. Nous construisons l'itinéraire à partir du "
                "produit, pas l'inverse.",
            ]),
            ("Les erreurs classiques que nous vous évitons", [
                "Payer un acompte à un intermédiaire présenté comme l'usine ; valider un échantillon "
                "parfait et recevoir une production médiocre ; découvrir les droits de douane à "
                "l'arrivée ; oublier les certifications obligatoires en Europe ; négocier un prix "
                "sans fixer l'Incoterm. Chacune de ces erreurs a un remède simple : la vérification, "
                "l'inspection avant expédition et le chiffrage complet avant commande.",
            ]),
        ],
        zones=zones("/sourcing-chine"),
        faq_title="Questions fréquentes — sourcing en Chine",
        faq=[
            ("Dois-je me déplacer pour sourcer en Chine ?",
             "Pas toujours. Pour un produit simple, nos partenaires identifient, demandent des "
             "échantillons et contrôlent sans que vous veniez. Pour une production sur mesure ou un "
             "contrat important, la visite d'usine change tout."),
            ("Combien de temps dure un premier sourcing ?",
             "Comptez plusieurs semaines entre le cahier des charges et des échantillons validés, "
             "puis le délai de production et de transport. Nous vous donnons un calendrier réaliste "
             "au départ, pas une promesse."),
            ("Vérifiez-vous les usines ?",
             "Oui : existence réelle, capacité, références, et visite physique quand la commande le "
             "justifie."),
            ("Prenez-vous une commission sur les achats ?",
             "Nos honoraires sont annoncés séparément et avant la mission. Nous ne prenons pas de "
             "marge cachée sur le prix d'achat."),
        ] + K.faq_contact(),
        form=("Décrivez votre produit", "Type de produit, quantités, qualité attendue, délai : nous "
              "vous répondons avec une démarche proposée et un chiffrage de la mission.",
              "Chine", "Sourcing Chine"),
    ),

    base(
        slug="foire-de-canton-accompagnement",
        title="Foire de Canton : accompagnement complet — accréditation, hôtel, interprète, rendez-vous | Label Maison",
        desc="Visiter ou exposer à la Foire de Canton (Guangzhou, deux sessions par an) sans y "
             "perdre trois jours : accréditation, hôtel bien placé, transferts, interprète, programme "
             "de rendez-vous et visites d'usines après le salon.",
        crumb="Foire de Canton", trail=TRAIL, area="Canton (Guangzhou), Chine",
        service_type="Accompagnement à la Foire de Canton",
        badge="🎪 Chine · Foire de Canton",
        h1="Foire de <span class=\"font-serif-italic\">Canton</span>, préparée comme il faut",
        sub="La plus grande foire commerciale de Chine se tient deux fois par an à Guangzhou, en trois "
            "phases thématiques. Sans préparation, on y marche beaucoup et on y signe peu. Nous "
            "organisons l'avant, le pendant et l'après.",
        photo=("real/billetterie-avion.jpg", "Vol vers Canton"),
        puces=["Deux sessions <b>par an</b>", "Hôtel <b>bien placé</b>", "Interprète <b>d'affaires</b>", "Visites d'usines <b>après</b>"],
        cta="Préparer ma Foire de Canton",
        intro=[
            "La Foire de Canton (Canton Fair) réunit chaque printemps et chaque automne des dizaines "
            "de milliers d'exposants dans le complexe de Pazhou, à Guangzhou, en trois phases "
            "successives organisées par familles de produits. C'est le meilleur endroit pour "
            "rencontrer des fabricants en une semaine, et le pire pour improviser : hôtels saturés, "
            "trajets longs, stands innombrables, interlocuteurs qui ne parlent pas anglais.",
            "Nous préparons votre venue comme un voyage d'affaires : accréditation visiteur, hôtel "
            "choisi pour son accès au métro et au salon, transferts, interprète d'affaires, liste "
            "d'exposants ciblés avant le départ, puis visites d'usines dans le Guangdong à la suite "
            "du salon.",
        ],
        cards=("Notre accompagnement", "", [
            ("Avant : la phase qui vous concerne", "Chaque phase couvre des familles de produits "
             "différentes. Nous vérifions les dates et la phase utile à votre activité avant de "
             "réserver quoi que ce soit."),
            ("Accréditation et visa", "Inscription visiteur, invitation si nécessaire pour le visa, "
             "vérification des règles d'entrée en vigueur."),
            ("Hôtel et transferts", "Hôtel à proximité du métro ou du complexe de Pazhou, chauffeur "
             "pour l'aéroport et les visites hors salon."),
            ("Interprète d'affaires", "Un interprète partenaire qui comprend votre produit, pas un "
             "guide touristique : il négocie les termes avec vous, pas à votre place."),
            ("Programme de rendez-vous", "Liste d'exposants ciblés et rendez-vous pris avant le "
             "départ pour ne pas dépendre du hasard des allées."),
            ("Après : visites d'usines", "Les fabricants intéressants se trouvent à une ou deux heures "
             "de Canton. Nous prolongeons le séjour de deux ou trois jours pour les visiter."),
        ]),
        sections=[
            ("Visiter ou exposer ?", [
                "La plupart de nos clients visitent : ils cherchent des fabricants. Exposer s'adresse "
                "aux entreprises qui vendent vers la Chine ou vers les acheteurs internationaux "
                "présents sur place ; c'est une autre logistique (stand, matériel, équipe) que nous "
                "organisons aussi, avec un délai de préparation plus long.",
            ]),
            ("Combien de jours prévoir ?", [
                "Deux à trois jours de salon suffisent avec un programme ciblé ; un jour de plus "
                "sans préparation. Ajoutez deux à trois jours de visites d'usines et le temps de "
                "trajet : une semaine est le format le plus courant, parfois complétée par Hong Kong "
                "ou Shenzhen, à moins de deux heures de train.",
            ]),
        ],
        zones=zones("/foire-de-canton-accompagnement"),
        faq_title="Questions fréquentes — Foire de Canton",
        faq=[
            ("Quand a lieu la Foire de Canton ?",
             "Deux fois par an, au printemps (avril–mai) et à l'automne (octobre–novembre), en trois "
             "phases d'environ cinq jours chacune. Les dates exactes sont publiées par "
             "l'organisateur ; nous les vérifions pour votre activité."),
            ("Peut-on y aller sans parler chinois ?",
             "Oui, mais les échanges sérieux se font bien mieux avec un interprète d'affaires, "
             "surtout dès qu'on parle prix, quantités et conditions de paiement."),
            ("Faut-il réserver longtemps à l'avance ?",
             "Oui : les hôtels bien placés se remplissent des semaines avant chaque session, et le "
             "visa demande du délai. Plus tôt vous nous prévenez, mieux le séjour se passe."),
            ("Organisez-vous aussi d'autres salons ?",
             "Oui, à Shanghai, Shenzhen et Hong Kong selon votre secteur. Dites-nous votre produit."),
        ] + K.faq_contact(),
        form=("Préparer votre Foire de Canton", "Votre secteur, le nombre de personnes et la session "
              "visée : nous vous répondons avec un programme et un chiffrage.", "Canton", "Foire de Canton"),
    ),

    base(
        slug="voyage-d-affaires-chine",
        title="Voyage d'affaires en Chine organisé — vols, hôtels, chauffeur, interprète, rendez-vous | Label Maison",
        desc="Organisation complète de votre voyage d'affaires en Chine : vols, hôtels, chauffeur, "
             "interprète, programme de rendez-vous, dîners, visa. Shanghai, Pékin, Shenzhen, Canton, "
             "Hong Kong. Interlocuteur francophone du départ au retour.",
        crumb="Voyage d'affaires", trail=TRAIL,
        service_type="Organisation de voyages d'affaires en Chine",
        badge="💼 Chine · Voyage d'affaires",
        h1="Voyage d'affaires en <span class=\"font-serif-italic\">Chine</span>, organisé du départ au retour",
        sub="Vous venez pour signer, visiter, négocier ou prospecter. Nous nous occupons de tout ce "
            "qui n'est pas votre métier : vols, hôtels, déplacements, interprète, dîners, et les "
            "imprévus qui ne manqueront pas.",
        photo=("real/voiture-vip-interieur.jpeg", "Berline avec chauffeur pour un déplacement d'affaires"),
        gallery=[("real/billetterie-avion.jpg", "Cabine d'un vol long-courrier"), ("real/voiture-vip-interieur.jpeg", "Berline avec chauffeur"),
                 ("real/dining.jpg", "Table réservée pour un dîner d'affaires"), ("real/proof-avion-poster.jpg", "Vue depuis le hublot"),
                 ("real/mercedes-van.jpg", "Van pour une délégation"), ("real/dubai-downtown-nuit.jpg", "Déplacement d'affaires de nuit")],
        puces=["Vols et <b>hôtels</b>", "Chauffeur et <b>interprète</b>", "Rendez-vous <b>préparés</b>", "Imprévus <b>gérés</b>"],
        cta="Organiser mon voyage",
        intro=[
            "Un voyage d'affaires en Chine se perd dans les détails : un hôtel à une heure des "
            "rendez-vous, un chauffeur qui ne trouve pas l'adresse, une application de paiement qui "
            "refuse une carte étrangère, un dîner mal choisi, un vol intérieur manqué. Chacun de ces "
            "détails coûte une demi-journée, et une demi-journée en Chine coûte cher.",
            "Nous organisons le déplacement comme nous organisons un séjour à Dubaï : tout est calé "
            "avant le départ, un interlocuteur francophone vous suit pendant, et nos partenaires sur "
            "place — chauffeurs, interprètes, hôtels — sont prévenus de votre programme heure par "
            "heure.",
        ],
        cards=("Ce que couvre l'organisation", "", [
            ("Vols et classes", "Long-courrier en business ou première, vols intérieurs, trains à "
             "grande vitesse entre villes. Voir aussi <a href=\"/billets-d-avion-business-class\">vols premium</a>."),
            ("Hôtels", "Choisis pour leur emplacement par rapport à vos rendez-vous, pas pour leur "
             "nombre d'étoiles."),
            ("Chauffeur et déplacements", "Berline ou van avec chauffeur, trajets chronométrés, "
             "adresses vérifiées en chinois."),
            ("Interprète d'affaires", "Partenaire sélectionné selon votre secteur, briefé sur votre "
             "programme et vos objectifs."),
            ("Rendez-vous et dîners", "Programme préparé, confirmations, restaurants adaptés à un "
             "dîner d'affaires, cadeaux d'usage si nécessaire."),
            ("Pratique", "Visa, paiements mobiles, connexion, carte SIM, assistance en cas d'imprévu."),
        ]),
        sections=[
            ("Les villes que nous couvrons", [
                "Shanghai et Pékin pour les sièges, les administrations et les grands groupes ; "
                "Shenzhen et Canton pour l'industrie, l'électronique et le sourcing ; Hong Kong pour "
                "la finance, l'horlogerie et comme porte d'entrée. Un voyage combine souvent deux ou "
                "trois de ces villes, reliées par des vols courts ou le train à grande vitesse.",
            ]),
            ("Délégations et équipes", [
                "Pour une équipe ou une délégation, nous ajoutons la coordination du groupe : van, "
                "réunion de préparation, programme individuel et collectif, et un référent joignable "
                "à tout moment. Pour un dirigeant seul, nous allégeons : l'essentiel est que rien ne "
                "vous fasse perdre de temps.",
            ]),
        ],
        zones=zones("/voyage-d-affaires-chine"),
        faq_title="Questions fréquentes — voyage d'affaires en Chine",
        faq=[
            ("Combien de temps à l'avance faut-il vous prévenir ?",
             "Le plus tôt possible : visa, vols et hôtels se tendent vite. Un voyage se prépare "
             "confortablement en quelques semaines ; en urgence, nous faisons au mieux et nous vous "
             "disons ce qui est possible."),
            ("Peut-on payer en Chine avec une carte française ?",
             "De moins en moins facilement hors hôtels internationaux : les paiements passent par "
             "des applications mobiles. Nous vous expliquons comment les configurer avant le départ."),
            ("Pouvez-vous accompagner physiquement ?",
             "Selon la mission, un membre de notre équipe se déplace avec vous ou la coordination se "
             "fait à distance avec nos partenaires sur place. Nous en convenons dès la proposition."),
        ] + K.faq_contact(),
        form=("Organiser votre voyage d'affaires", "Villes, dates, nombre de personnes, objectifs : "
              "nous vous répondons avec un programme et un chiffrage.", "Chine", "Voyage d'affaires Chine"),
    ),

    base(
        slug="clientele-chinoise-paris",
        title="Accueil de clientèle chinoise à Paris — shopping, détaxe, séjours, appartements | Label Maison",
        desc="Conciergerie à Paris pour vos clients, partenaires et familles venus de Chine et de "
             "Hong Kong : shopping accompagné avec détaxe, séjours, chauffeur, tables, appartement "
             "pour un étudiant ou un pied-à-terre. Discrétion et exécution.",
        crumb="Clientèle chinoise", trail=TRAIL, area="Paris", lieu="Paris",
        service_type="Accueil et conciergerie pour clientèle chinoise à Paris",
        badge="🇫🇷 Paris · Clientèle chinoise",
        h1="Accueillir une clientèle <span class=\"font-serif-italic\">chinoise</span> à Paris",
        sub="Vos partenaires de Shanghai arrivent la semaine prochaine, une famille de Hong Kong "
            "cherche un appartement pour son enfant, un client veut faire ses achats à Paris avec la "
            "détaxe : nous organisons l'accueil, le programme et la logistique.",
        photo=("real/louis-vuitton.jpg", "Boutique Louis Vuitton à Paris"),
        gallery=K.P_SHOPPING,
        puces=["Shopping et <b>détaxe</b>", "Chauffeur et <b>tables</b>", "Appartements <b>gérés</b>", "Discrétion <b>totale</b>"],
        cta="Préparer l'accueil",
        intro=[
            "Paris reste une destination majeure pour les visiteurs chinois et hongkongais : "
            "maisons de luxe, gastronomie, immobilier, études. Mais un séjour réussi tient à des "
            "détails que l'on ne trouve pas dans un guide : la boutique qui a la pièce en stock, la "
            "détaxe faite correctement, le chauffeur qui attend au bon terminal, la table qui "
            "accepte un groupe de huit à 21 h.",
            "Nous accueillons cette clientèle pour le compte d'entreprises françaises qui reçoivent "
            "leurs partenaires, d'intermédiaires franco-chinois, et directement de familles qui nous "
            "sont présentées. Les échanges se font en français et en anglais ; un interprète "
            "partenaire se joint au programme quand c'est utile.",
        ],
        cards=("Ce que nous organisons à Paris", "", [
            ("Shopping accompagné", "Maisons de luxe, horlogerie, joaillerie, pièces réservées à "
             "l'avance : voir <a href=\"/personal-shopper-paris\">personal shopper à Paris</a>."),
            ("Détaxe", "Les visiteurs résidant hors Union européenne peuvent récupérer la TVA sur "
             "leurs achats : nous veillons à ce que la procédure soit faite dans les règles. Voir "
             "<a href=\"/detaxe-shopping-paris\">détaxe à Paris</a>."),
            ("Séjour et transport", "Hôtel ou appartement, chauffeur privé ou van, transferts "
             "aéroport, programme de visites privées."),
            ("Tables et soirées", "Restaurants emblématiques, dîners d'affaires, soirées privées, "
             "réservations en dernière minute grâce à notre réseau."),
            ("Appartement pour un étudiant", "Recherche, installation, puis gestion du logement "
             "pendant les absences : voir <a href=\"/conciergerie-airbnb-expatrie-chine\">propriétaires en Chine</a>."),
            ("Pied-à-terre et investissement", "Achat accompagné, gestion locative, reporting écrit "
             "lisible depuis Shanghai ou Hong Kong."),
        ]),
        sections=[
            ("Pour les entreprises qui reçoivent des partenaires chinois", [
                "Nous prenons en charge l'accueil de vos invités du terminal à leur départ : "
                "transferts, hôtel, programme hors réunions, dîners, cadeaux d'usage et shopping. "
                "Vos équipes se concentrent sur les réunions ; vos invités gardent le souvenir d'un "
                "séjour sans accroc, ce qui compte dans la relation d'affaires.",
            ]),
        ],
        zones=zones("/clientele-chinoise-paris"),
        faq_title="Questions fréquentes — clientèle chinoise à Paris",
        faq=[
            ("Parlez-vous mandarin ?",
             "Nos échanges se font en français et en anglais ; pour un programme en mandarin ou en "
             "cantonais, un interprète partenaire accompagne vos invités."),
            ("Comment fonctionne la détaxe pour un visiteur chinois ?",
             "Un résident hors Union européenne peut obtenir le remboursement de la TVA sur ses "
             "achats au-delà d'un montant minimum par boutique et par jour, avec un bordereau à "
             "valider au départ. Nous préparons les bordereaux et vérifions la validation ; la "
             "douane fait foi."),
            ("Pouvez-vous gérer un appartement acheté pour un enfant étudiant ?",
             "Oui : installation, intendance et, pendant les absences longues, mise en location "
             "lorsque le statut du bien le permet."),
        ] + K.faq_contact(),
        form=("Préparer l'accueil de vos invités", "Dates, nombre de personnes, programme souhaité : "
              "nous revenons vers vous avec une proposition écrite.", "Paris", "Clientèle chinoise Paris"),
    ),
]
