# -*- coding: utf-8 -*-
"""Silo SEO « propriétaires expatriés et non-résidents ».

Cible d'acquisition : les propriétaires qui vivent à l'étranger (ou s'y
installent) et possèdent — ou achètent — un bien à Paris, en Île-de-France ou
ailleurs en France, qu'ils veulent faire gérer à distance.

  1 page pilier  : /conciergerie-airbnb-proprietaires-expatries
  7 pages pays   : /conciergerie-airbnb-expatrie-<pays>
                   Maroc, Dubaï (Émirats), Londres (Royaume-Uni), États-Unis,
                   Allemagne, Bali (Indonésie), Chine (et Hong Kong).

Règles maison :
  - aucun chiffre sur notre activité, aucun avis, aucune équipe ou agence à
    l'étranger inventée : Label Maison gère des biens EN FRANCE pour des
    propriétaires qui vivent AILLEURS, c'est exactement ce que disent les pages ;
  - les repères fiscaux sont ceux du droit français (taux minimum des
    non-résidents, prélèvements sociaux, conventions bilatérales) et renvoient
    toujours vers l'expert-comptable du propriétaire : nous ne faisons pas de
    conseil fiscal ;
  - photos réelles de biens gérés uniquement (seo_common.PHOTOS_LOGEMENT).

Chaque page pays a ses propres textes (décalage horaire, liaisons, profil des
propriétaires, convention fiscale, particularités bancaires) : pas de pages
jumelles.
"""
from __future__ import annotations

import pathlib
import re

import seo_common as C
from gen_seo_services import build

HUB = "/conciergerie-airbnb-proprietaires-expatries"
SLUG_HUB = HUB.strip("/")

NAV = [("Expatriés", HUB), ("Paris", "/conciergerie-airbnb-paris"),
       ("Fiscalité", "/fiscalite-airbnb-ile-de-france"), ("Propriétaires", "/proprietaires")]

# ----------------------------------------------------------------------------- #
#  Pays : clé, nom affiché, slug, gentilé/locatif, données rédactionnelles
# ----------------------------------------------------------------------------- #
# Champs :
#   nom         : nom court (« Dubaï »)
#   slug        : suffixe d'URL
#   pays        : nom du pays pour le texte (« les Émirats arabes unis »)
#   depuis      : « depuis Dubaï », « depuis Londres »…
#   villes      : villes où vivent les propriétaires visés
#   decalage    : phrase sur le décalage horaire
#   liaison     : phrase sur les liaisons avec Paris
#   profil      : qui sont les propriétaires (paragraphe)
#   pourquoi    : pourquoi ils gardent / achètent un bien en France (paragraphe)
#   convention  : convention fiscale (année) + particularité fiscale
#   banque      : particularité bancaire / paiement
#   zone_ue     : True si l'UE/EEE (prélèvement de solidarité réduit, pas de représentant fiscal)
#   faq         : 2 questions spécifiques (q, r)
PAYS = [
    dict(
        nom="Maroc", slug="maroc", pays="le Maroc", depuis="depuis le Maroc",
        vit="au Maroc", conv="France–Maroc", resident="résident du Maroc",
        adj="installés au Maroc", drapeau="🇲🇦",
        villes=["Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir"],
        decalage="Le Maroc vit à l'heure de Paris, à une heure près selon la saison : vous pouvez "
                 "nous appeler à n'importe quel moment de votre journée de travail et obtenir une "
                 "réponse immédiate.",
        liaison="Casablanca, Rabat, Marrakech et Tanger sont reliées à Paris par plusieurs vols "
                "directs quotidiens d'environ trois heures. Un passage à Paris pour voir son bien "
                "s'organise sur un week-end, et nous préparons le logement pour que vous puissiez y "
                "séjourner vous-même.",
        profil="Nos propriétaires installés au Maroc sont le plus souvent des binationaux et des "
               "familles franco-marocaines : un cadre muté à Casablanca, un couple de retraités "
               "parti vivre à Marrakech ou Agadir, un entrepreneur qui partage sa vie entre Rabat et "
               "Paris. Beaucoup ont gardé l'appartement parisien ou la maison d'Essonne et de "
               "banlieue qu'ils occupaient, ou l'ont reçu en héritage.",
        pourquoi="Garder un pied-à-terre en France répond à une logique simple : des revenus en "
                 "euros, un patrimoine dans un marché profond et liquide, et un logement disponible "
                 "pour les séjours familiaux, les études des enfants ou les rendez-vous médicaux. Le "
                 "faire gérer en location courte ou moyenne durée permet de couvrir les charges, la "
                 "taxe foncière et le crédit sans immobiliser le bien.",
        convention="La France et le Maroc sont liés par une convention fiscale (1970) qui attribue "
                   "l'imposition des revenus locatifs au pays où se situe le bien : vos loyers "
                   "français sont donc déclarés et imposés en France, puis pris en compte au Maroc "
                   "selon les règles de la convention pour éviter la double imposition.",
        banque="Vos revenus sont encaissés en euros sur un compte français ou européen à votre nom. "
               "C'est le schéma le plus simple : il évite les frais de change et les contraintes de "
               "l'Office des Changes sur les mouvements de dirhams, et il facilite la déclaration "
               "annuelle.",
        zone_ue=False,
        faq=[
            ("Je vis au Maroc : dois-je déclarer mes loyers français au Maroc ?",
             "Les loyers d'un bien situé en France sont imposés en France. La convention "
             "franco-marocaine prévoit ensuite un mécanisme pour éviter la double imposition dans "
             "votre pays de résidence. Nous vous fournissons le relevé annuel des revenus et charges ; "
             "la déclaration elle-même relève de votre expert-comptable ou conseiller fiscal."),
            ("Je viens régulièrement à Paris : puis-je occuper mon appartement ?",
             "Oui. Vous bloquez vos dates dans le calendrier, nous les retirons de la vente et nous "
             "préparons le logement avant votre arrivée (ménage, linge, consommables). Entre vos "
             "séjours, le bien est loué."),
        ],
    ),
    dict(
        nom="Dubaï", slug="dubai", pays="les Émirats arabes unis", depuis="depuis Dubaï",
        vit="à Dubaï", conv="France–Émirats", resident="résident des Émirats",
        adj="installés à Dubaï et aux Émirats", drapeau="🇦🇪",
        villes=["Dubaï", "Abu Dhabi", "Sharjah", "Ras Al Khaimah"],
        decalage="Dubaï a deux à trois heures d'avance sur Paris selon la saison. Quand vous "
                 "finissez votre journée, la nôtre est en plein après-midi : les demandes des "
                 "voyageurs, les arrivées et les imprévus du soir sont traités par nous, pas par vous "
                 "à minuit.",
        liaison="Paris–Dubaï se fait en vol direct d'environ sept heures, avec plusieurs rotations "
                "quotidiennes vers Roissy. Un aller-retour sur un long week-end est courant chez nos "
                "propriétaires des Émirats, et le logement est préparé pour vous accueillir.",
        profil="Les Français des Émirats sont très majoritairement des actifs : cadres de la finance, "
               "de l'hôtellerie, de l'aérien et du conseil, entrepreneurs et professions libérales "
               "installés pour quelques années ou pour longtemps. Beaucoup ont conservé un "
               "appartement à Paris ou en proche banlieue au moment du départ ; d'autres achètent "
               "depuis Dubaï pour diversifier un patrimoine constitué en dirhams.",
        pourquoi="Après plusieurs années sans impôt sur le revenu, placer une partie de son épargne "
                 "dans la pierre parisienne est un choix de sécurité : un actif tangible, en euros, "
                 "dans un marché réglementé, avec une demande locative qui ne se dément pas. Le faire "
                 "gérer à distance transforme ce placement en revenu régulier sans y consacrer ses "
                 "week-ends.",
        convention="Il n'y a pas d'impôt sur le revenu des personnes physiques aux Émirats, mais cela "
                   "ne change rien aux loyers d'un bien français : ils sont imposés en France en tant "
                   "que revenus de source française, selon les règles applicables aux non-résidents, "
                   "dans le cadre de la convention fiscale France–Émirats (1989).",
        banque="Les revenus sont versés en euros sur votre compte français ou européen. Si vous "
               "n'avez plus de compte en France, nous vous orientons vers des solutions bancaires "
               "adaptées aux non-résidents ; le mandat de gestion et les justificatifs se signent et "
               "s'échangent entièrement en ligne.",
        zone_ue=False,
        faq=[
            ("Je ne paie pas d'impôt à Dubaï : mes loyers parisiens sont-ils imposés ?",
             "Oui. Les revenus d'un bien situé en France sont imposés en France quelle que soit la "
             "fiscalité de votre pays de résidence, avec le taux minimum applicable aux "
             "non-résidents. Votre expert-comptable arbitre entre micro-BIC et régime réel ; nous "
             "lui fournissons un relevé annuel complet."),
            ("Puis-je acheter à Paris depuis Dubaï et vous confier le bien directement ?",
             "Oui. Nous intervenons dès la recherche si vous le souhaitez (voir notre page "
             "<a href=\"/investissement-locatif-paris\">investissement locatif à Paris</a>), puis "
             "nous prenons les clés chez le notaire ou l'agence et préparons le logement pour la "
             "mise en location."),
        ],
    ),
    dict(
        nom="Londres", slug="londres", pays="le Royaume-Uni", depuis="depuis Londres",
        vit="à Londres", conv="France–Royaume-Uni", resident="résident britannique",
        adj="installés à Londres et au Royaume-Uni", drapeau="🇬🇧",
        villes=["Londres", "Manchester", "Édimbourg", "Birmingham"],
        decalage="Londres n'a qu'une heure de décalage avec Paris : nos horaires de travail se "
                 "recouvrent presque entièrement. Vous pouvez suivre votre bien en temps réel et "
                 "nous joindre à tout moment de votre journée.",
        liaison="L'Eurostar met Paris à un peu plus de deux heures de St Pancras, de centre à "
                "centre, plusieurs fois par jour. Nos propriétaires londoniens passent souvent voir "
                "leur bien sur une journée ou un week-end ; nous le préparons pour qu'ils puissent "
                "l'occuper.",
        profil="La communauté française du Royaume-Uni est l'une des plus importantes au monde : "
               "finance, tech, santé, enseignement, restauration. Beaucoup ont acheté ou gardé un "
               "appartement à Paris au moment de partir, parfois depuis des années ; d'autres, "
               "britanniques ou binationaux, cherchent un pied-à-terre parisien à faire travailler "
               "entre leurs séjours.",
        pourquoi="Depuis le Brexit, un bien à Paris est pour beaucoup de Français de Londres une "
                 "ancre en zone euro : revenus et patrimoine dans la monnaie où ils reviendront "
                 "peut-être vivre, un logement disponible pour la famille, et une rentabilité "
                 "locative qui couvre les charges. La gestion à distance évite d'avoir à choisir "
                 "entre vendre et laisser vide.",
        convention="Les loyers d'un bien français sont imposés en France. La convention fiscale "
                   "France–Royaume-Uni (2008) prévoit les règles d'élimination de la double "
                   "imposition côté britannique. Depuis le Brexit, les résidents britanniques sont "
                   "des non-résidents hors Union européenne pour le fisc français, ce qui a des "
                   "conséquences sur les prélèvements sociaux et, lors d'une revente, sur l'éventuel "
                   "représentant fiscal : points à vérifier avec votre conseil.",
        banque="Les revenus sont versés en euros sur un compte français ou européen ; c'est "
               "préférable à un virement en livres, qui subit le change à chaque mensualité. Le "
               "mandat, les relevés et les échanges se font en ligne, et par Eurostar quand vous "
               "passez.",
        zone_ue=False,
        faq=[
            ("Résident britannique, dois-je payer les prélèvements sociaux sur mes loyers ?",
             "Les non-résidents sont en principe soumis aux prélèvements sociaux sur les revenus du "
             "patrimoine. Les personnes affiliées à un régime de sécurité sociale au Royaume-Uni "
             "peuvent, dans le cadre de l'accord post-Brexit, relever d'un prélèvement de solidarité "
             "réduit à la place. C'est une question de situation personnelle : nous vous invitons à "
             "la faire valider par votre expert-comptable."),
            ("Mon appartement parisien était ma résidence principale avant mon départ à Londres.",
             "En partant vivre à l'étranger, il devient une résidence secondaire au sens de la "
             "réglementation parisienne : la location touristique n'est plus possible sous le régime "
             "des 120 nuits. Nous étudions avec vous le bail mobilité ou le meublé longue durée, "
             "souvent plus rentables qu'on ne l'imagine, et toujours conformes."),
        ],
    ),
    dict(
        nom="États-Unis", slug="etats-unis", pays="les États-Unis", depuis="depuis les États-Unis",
        vit="aux États-Unis", conv="France–États-Unis", resident="résident américain",
        adj="installés aux États-Unis", drapeau="🇺🇸",
        villes=["New York", "Miami", "Los Angeles", "San Francisco", "Washington", "Houston"],
        decalage="De six heures (côte Est) à neuf heures (côte Ouest) de décalage : quand un "
                 "voyageur a un problème de clé à 20 h à Paris, il est 14 h à New York et 11 h à "
                 "Los Angeles. Vous n'avez pas à y penser : nous répondons et nous intervenons.",
        liaison="New York, Miami, Boston, Washington, Los Angeles et San Francisco disposent de vols "
                "directs vers Paris (sept à onze heures). Nos propriétaires américains viennent une "
                "à deux fois par an ; nous bloquons leurs dates et préparons le logement.",
        profil="Nos propriétaires outre-Atlantique sont des expatriés français de New York, Miami, "
               "la Californie ou le Texas, des couples franco-américains, et des Américains qui "
               "possèdent un pied-à-terre à Paris pour leurs séjours en Europe. Point commun : un "
               "bien qu'ils occupent quelques semaines par an et qui, le reste du temps, doit se "
               "financer tout seul.",
        pourquoi="Un appartement parisien loué en meublé couvre ses charges et son crédit tout en "
                 "restant disponible pour les séjours. Pour un résident américain, c'est aussi une "
                 "diversification en euros dans un marché stable. La gestion à distance, avec un "
                 "interlocuteur unique qui parle votre langue et connaît les contraintes "
                 "américaines, rend l'ensemble réellement passif.",
        convention="Les loyers d'un bien français sont imposés en France. Les citoyens et résidents "
                   "fiscaux américains déclarent par ailleurs leurs revenus mondiaux à l'IRS ; la "
                   "convention fiscale France–États-Unis (1994) organise l'élimination de la double "
                   "imposition par crédit d'impôt. Un comptable qui connaît les deux systèmes est "
                   "indispensable : nous travaillons avec le vôtre.",
        banque="Depuis la loi FATCA, les banques françaises sont plus prudentes avec les clients "
               "américains : conservez votre compte en France si vous en avez un. Les revenus y sont "
               "versés en euros, et le relevé annuel que nous produisons sert aussi bien à la "
               "déclaration française qu'au reporting américain.",
        zone_ue=False,
        faq=[
            ("Citoyen américain, je suis imposé sur mes revenus mondiaux : est-ce un problème ?",
             "Non, c'est une situation courante. Les loyers sont imposés en France ; la convention "
             "fiscale prévoit un crédit d'impôt côté américain pour éviter la double imposition. Nous "
             "fournissons un relevé annuel détaillé exploitable par votre CPA."),
            ("Puis-je signer le mandat et suivre la gestion sans venir en France ?",
             "Oui. Mandat signé électroniquement, visite du bien en visio, remise des clés par un "
             "proche, un voisin ou le notaire, puis suivi mensuel par écrit. Vous venez quand vous "
             "voulez, jamais parce qu'il le faut."),
        ],
    ),
    dict(
        nom="Allemagne", slug="allemagne", pays="l'Allemagne", depuis="depuis l'Allemagne",
        vit="en Allemagne", conv="France–Allemagne", resident="résident allemand",
        adj="installés en Allemagne", drapeau="🇩🇪",
        villes=["Berlin", "Munich", "Francfort", "Hambourg", "Stuttgart", "Düsseldorf"],
        decalage="Aucun décalage horaire : l'Allemagne et la France vivent à la même heure. C'est le "
                 "cas le plus confortable pour un propriétaire qui veut garder un œil sur son bien.",
        liaison="Francfort est à un peu moins de quatre heures de Paris en train direct, Stuttgart "
                "et Munich suivent, Berlin se fait en vol d'une heure quarante. Venir voir son "
                "appartement ou l'occuper un week-end ne demande ni visa ni organisation.",
        profil="Les Français d'Allemagne sont nombreux à Berlin, Munich, Francfort et dans la "
               "région rhénane : ingénieurs, chercheurs, salariés des groupes franco-allemands, "
               "couples binationaux. Beaucoup ont gardé leur logement en France au moment de la "
               "mutation ; d'autres, allemands, cherchent un appartement à Paris comme placement et "
               "pied-à-terre.",
        pourquoi="Entre deux pays de la zone euro, la question du change ne se pose pas : la "
                 "décision est purement patrimoniale. Un bien parisien ou francilien bien géré "
                 "rapporte des revenus réguliers, reste disponible pour la famille et conserve une "
                 "valeur de revente dans un marché profond. La gestion à distance enlève la seule "
                 "vraie contrainte : être sur place.",
        convention="La convention fiscale France–Allemagne (1959, plusieurs fois amendée) attribue "
                   "l'imposition des revenus immobiliers à l'État où se situe le bien : vos loyers "
                   "français sont imposés en France. Résident de l'Union européenne, vous n'avez pas "
                   "de représentant fiscal à désigner et vous relevez, si vous êtes affilié à la "
                   "sécurité sociale allemande, du prélèvement de solidarité réduit plutôt que des "
                   "prélèvements sociaux pleins — à confirmer avec votre Steuerberater.",
        banque="Un compte allemand suffit : les virements SEPA en euros sont instantanés ou à J+1 "
               "sans frais de change. Nous versons vos revenus sur le compte de votre choix, en "
               "France ou en Allemagne.",
        zone_ue=True,
        faq=[
            ("Résident allemand, comment sont imposés mes loyers français ?",
             "En France, en tant que revenus de source française, selon les règles des "
             "non-résidents. L'Allemagne les prend en compte selon la convention pour éviter la "
             "double imposition. Nous vous remettons chaque année un relevé complet ; votre "
             "conseiller fiscal fait le reste."),
            ("Je suis muté pour trois ans : que faire de mon appartement ?",
             "Ne pas le laisser vide, et ne pas le vendre dans la précipitation. Selon la ville et "
             "le statut du bien après votre départ, nous recommandons le bail mobilité, le meublé "
             "longue durée ou la courte durée, et nous vous rendons les clés à votre retour."),
        ],
    ),
    dict(
        nom="Bali", slug="bali", pays="l'Indonésie", depuis="depuis Bali",
        vit="à Bali", conv="France–Indonésie", resident="résident à Bali",
        adj="installés à Bali", drapeau="🇮🇩",
        villes=["Canggu", "Ubud", "Seminyak", "Uluwatu", "Denpasar"],
        decalage="Bali a six à sept heures d'avance sur Paris. Votre soirée correspond à notre "
                 "après-midi : vous recevez nos comptes rendus au réveil, et toute la gestion du "
                 "soir à Paris — arrivées, questions de voyageurs, urgences — est traitée par nous.",
        liaison="Pas de vol direct : comptez seize à dix-huit heures avec une escale (Doha, Dubaï, "
                "Singapour, Istanbul). On ne rentre pas pour une fuite d'eau. C'est précisément "
                "pour cela qu'un bien géré depuis Bali doit l'être par une équipe sur place.",
        profil="Entrepreneurs du numérique, indépendants, créateurs, couples en année sabbatique "
               "qui s'allonge : la communauté française de Bali est jeune, mobile et souvent "
               "propriétaire d'un appartement à Paris ou en banlieue qu'elle a quitté sans vouloir "
               "le vendre. Le loyer finance une partie de la vie sur place.",
        pourquoi="Garder son appartement en France quand on part vivre à Bali, c'est garder un "
                 "point de retour et un actif en euros pendant une période de revenus parfois "
                 "irréguliers. Loué en meublé, il couvre son crédit et ses charges ; géré à "
                 "distance, il ne vous demande rien.",
        convention="La convention fiscale France–Indonésie (1979) attribue l'imposition des revenus "
                   "immobiliers à la France. Point d'attention pour les nomades : la résidence "
                   "fiscale dépend de votre situation réelle (durée de présence, centre des intérêts), "
                   "pas d'une adresse déclarée. Faites-la qualifier par un professionnel avant de "
                   "partir, et déclarez vos loyers français chaque année.",
        banque="Les revenus restent en euros sur votre compte français ou européen ; vous convertissez "
               "en roupies au rythme de vos besoins, et non à chaque loyer. Mandat, calendrier et "
               "relevés sont accessibles en ligne depuis n'importe quel fuseau.",
        zone_ue=False,
        faq=[
            ("Je pars un ou deux ans : vaut-il mieux louer en courte durée ou en longue durée ?",
             "Cela dépend de la ville et du statut du bien. À Paris, un logement qui n'est plus "
             "votre résidence principale ne peut plus être loué en meublé de tourisme sous le régime "
             "des 120 nuits ; le bail mobilité (1 à 10 mois) est alors la solution la plus souple "
             "pour récupérer le logement au retour. En banlieue et en Essonne, la courte durée reste "
             "souvent possible. Nous chiffrons les deux options avant que vous partiez."),
            ("Comment gérez-vous une urgence si je suis injoignable ?",
             "Le mandat prévoit un seuil d'intervention sous lequel nous agissons sans attendre "
             "votre accord (fuite, panne de chauffage, serrure), avec compte rendu et facture. "
             "Au-delà, nous vous soumettons des devis et attendons votre validation écrite."),
        ],
    ),
    dict(
        nom="Chine", slug="chine", pays="la Chine", depuis="depuis la Chine",
        vit="en Chine", conv="France–Chine", resident="résident en Chine ou à Hong Kong",
        adj="installés en Chine et à Hong Kong", drapeau="🇨🇳",
        villes=["Shanghai", "Pékin", "Hong Kong", "Shenzhen", "Canton"],
        decalage="Six à sept heures d'avance sur Paris : votre fin de journée est notre fin de "
                 "matinée, ce qui laisse un créneau d'échange quotidien confortable. Les soirées "
                 "parisiennes, elles, sont couvertes par nos équipes.",
        liaison="Shanghai, Pékin et Hong Kong sont reliées à Paris en vol direct d'une douzaine "
                "d'heures. Les séjours en France sont rares et planifiés : nous nous adaptons à "
                "votre calendrier et préparons le logement pour que vous puissiez l'occuper.",
        profil="Deux profils se croisent : les Français de Shanghai, Pékin ou Hong Kong — cadres de "
               "l'industrie, du luxe et de la finance, enseignants, entrepreneurs — qui ont gardé "
               "un bien à Paris ; et les familles chinoises qui ont acheté à Paris pour les études "
               "d'un enfant, un pied-à-terre ou un placement en euros, et cherchent un gestionnaire "
               "qui rende des comptes clairs.",
        pourquoi="Paris reste l'une des destinations immobilières les plus recherchées par les "
                 "acheteurs asiatiques : marché transparent, droit de propriété solide, demande "
                 "locative continue. Faire travailler ce bien entre les séjours, avec un reporting "
                 "mensuel écrit, en fait un placement lisible depuis l'autre bout du monde.",
        convention="Les loyers d'un bien français sont imposés en France. La convention fiscale "
                   "France–Chine (2013) et la convention France–Hong Kong (2010) organisent "
                   "l'élimination de la double imposition dans votre pays de résidence. Les "
                   "résidents de Hong Kong et de Chine continentale relèvent de règles distinctes : "
                   "votre conseil fiscal doit connaître les deux.",
        banque="Les revenus sont versés en euros sur un compte français ou européen à votre nom, ce "
               "qui évite les contraintes de transfert de devises depuis la Chine continentale. "
               "Mandat, états des lieux photo et relevés sont dématérialisés et consultables à toute "
               "heure.",
        zone_ue=False,
        faq=[
            ("Nous avons acheté un appartement à Paris pour les études de notre enfant.",
             "Cas fréquent. Pendant l'année universitaire, l'étudiant occupe le logement ; l'été et "
             "pendant les périodes d'absence longues, nous pouvons le louer en meublé de courte ou "
             "moyenne durée lorsque le statut du bien le permet, afin de couvrir une partie des "
             "charges. Nous étudions le cadre juridique avant toute mise en location."),
            ("Les échanges se font-ils en français ou en anglais ?",
             "Nous travaillons en français et en anglais. Mandat, relevés mensuels et comptes rendus "
             "sont rédigés en français ; nous les commentons en anglais si vous le préférez."),
        ],
    ),
]


def pays_par_slug(slug: str) -> dict:
    return next(p for p in PAYS if p["slug"] == slug)


def lien_pays(p: dict) -> tuple:
    return (f"Propriétaires {p['vit']}", f"/conciergerie-airbnb-expatrie-{p['slug']}")


FOOT = [("Propriétaires à l'étranger",
         [("Tous les propriétaires expatriés", HUB)] + [lien_pays(p) for p in PAYS[:4]]),
        ("Gérer depuis l'étranger",
         [lien_pays(p) for p in PAYS[4:]] +
         [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
          ("Gestion locative Paris", "/gestion-locative-paris"),
          ("Fiscalité de la location meublée", "/fiscalite-airbnb-ile-de-france")])]

WHY = ("Pourquoi les propriétaires à l'étranger nous choisissent", [
    ("Un interlocuteur, un fuseau : le vôtre",
     "Vous traitez avec une seule personne, qui connaît votre bien, votre calendrier et votre "
     "situation. Nous nous adaptons à votre heure pour les points réguliers ; le reste du temps, "
     "nous gérons sans vous solliciter."),
    ("Le bon régime, pas le plus simple pour nous",
     "Courte durée, bail mobilité, meublé longue durée : le départ à l'étranger change souvent le "
     "statut juridique du bien. Nous arbitrons selon la réglementation de votre commune, votre "
     "fiscalité de non-résident et vos dates de retour."),
    ("Des comptes rendus écrits",
     "Relevé mensuel des réservations, revenus, charges et interventions, photos des états des lieux, "
     "relevé annuel pour la déclaration : tout ce qu'un propriétaire à 8 000 km doit pouvoir "
     "vérifier sans appeler."),
    ("Des équipes sur le terrain",
     "Ménage, linge, maintenance, remise des clés, accueil : nos équipes interviennent à Paris, en "
     "Île-de-France et dans nos villes partenaires. Nous ne sous-traitons pas la relation voyageur."),
])

STEPS = ("Confier son bien depuis l'étranger, étape par étape", [
    ("1. Visio et audit à distance",
     "Un échange de trente minutes à l'heure qui vous convient. Adresse, surface, état, statut "
     "du bien après votre départ, dates de retour : nous établissons ce que le logement peut "
     "rapporter et sous quel régime."),
    ("2. Recommandation et mandat électronique",
     "Vous recevez une recommandation écrite (régime, revenu cible, travaux utiles). Le mandat de "
     "gestion se signe en ligne, où que vous soyez."),
    ("3. Prise en main sur place",
     "Remise des clés par un proche, un voisin, le notaire ou lors de votre passage. Inventaire "
     "photo, serrure connectée ou boîte à clés, mise aux normes, photos professionnelles."),
    ("4. Gestion et reporting",
     "Mise en ligne, tarification, accueil, ménage, maintenance, relation voyageurs. Chaque mois, "
     "un relevé écrit ; chaque année, le récapitulatif pour votre déclaration."),
])

CARDS_SERVICES = ("Ce que nous prenons en charge pour vous", "Tout ce qui exige d'être sur place.", [
    ("Clés et accès",
     "Serrure connectée ou boîte à clés sécurisée, codes renouvelés à chaque séjour, double "
     "conservé par nos équipes : personne n'a besoin de vous pour entrer, sortir ou intervenir."),
    ("Accueil et relation voyageurs",
     "Réponses aux demandes, arrivées et départs, consignes, urgences : nous répondons à l'heure de "
     "Paris, dans la langue du voyageur, et vous n'êtes jamais réveillé."),
    ("Ménage, linge et consommables",
     "Ménage hôtelier entre chaque séjour, linge fourni et blanchi, produits d'accueil "
     "réapprovisionnés. Le logement est contrôlé et photographié avant chaque arrivée."),
    ("Maintenance et travaux",
     "Fuite, panne, serrure, électroménager : intervention de nos artisans dans le cadre du seuil "
     "fixé au mandat, devis comparés au-delà, et compte rendu photo à chaque fois."),
    ("Annonce, tarification et calendrier",
     "Création des annonces, tarification ajustée à la saison et aux événements, blocage de vos "
     "dates personnelles, arbitrage entre plateformes et moyenne durée."),
    ("Administratif et reporting",
     "Déclaration en mairie quand elle est requise, taxe de séjour collectée et reversée, relevé "
     "mensuel, relevé annuel pour votre expert-comptable, archivage des justificatifs."),
])


def section_regimes(ville_focus: str = "Paris") -> tuple:
    return ("Partir à l'étranger change le statut de votre logement", [
        "Un appartement que vous occupiez devient, le jour de votre départ, une "
        "<strong>résidence secondaire</strong> au sens de la réglementation sur les meublés de "
        "tourisme. À Paris et dans plusieurs grandes villes, cela signifie que la location "
        "touristique n'est plus possible sous le simple régime des 120 nuits : il faut une "
        "autorisation de changement d'usage, souvent assortie d'une compensation. Beaucoup de "
        "propriétaires l'ignorent et découvrent le problème après coup.",
        "Trois voies restent ouvertes, et nous les chiffrons toutes : le "
        "<strong>bail mobilité</strong> (1 à 10 mois, sans dépôt de garantie, idéal pour récupérer "
        "le bien à une date connue), le <strong>meublé longue durée</strong> (bail d'un an, le plus "
        "tranquille à distance), et la <strong>courte durée</strong> là où elle reste autorisée — en "
        "petite couronne, en Essonne et dans la plupart des communes de province, sous réserve de "
        "la déclaration en mairie. Voir notre page sur le "
        "<a href=\"/changement-usage-meuble-tourisme\">changement d'usage</a>.",
        f"Notre rôle est de vous dire, avant votre départ, ce qui est autorisé pour votre bien à "
        f"{ville_focus} ou ailleurs, ce que chaque option rapporte, et de l'exécuter.",
    ])


SECTION_FISCALITE = ("Fiscalité des non-résidents : ce qu'il faut savoir, sans jargon", [
    "Les loyers d'un bien situé en France sont <strong>toujours imposés en France</strong>, quel que "
    "soit votre pays de résidence : c'est le principe de toutes les conventions fiscales signées par "
    "la France. En location meublée, vous relevez du régime <strong>micro-BIC</strong> (abattement "
    "forfaitaire) ou du <strong>régime réel</strong> (déduction des charges et amortissements), le "
    "second étant souvent plus avantageux quand le bien a été acheté récemment ou rénové.",
    "Les non-résidents sont imposés avec un <strong>taux minimum</strong> (20 %, puis 30 % au-delà "
    "d'un certain seuil de revenus), sauf s'ils prouvent que le taux moyen de leur impôt français "
    "serait inférieur. S'y ajoutent les <strong>prélèvements sociaux</strong>, réduits à un "
    "prélèvement de solidarité pour les personnes affiliées à un régime de sécurité sociale "
    "européen, suisse ou britannique. Le détail est dans notre guide sur la "
    "<a href=\"/fiscalite-airbnb-ile-de-france\">fiscalité de la location meublée</a>.",
    "Nous ne sommes pas conseillers fiscaux et ne nous substituons pas à votre expert-comptable. "
    "En revanche, nous lui remettons chaque année un relevé complet des revenus, charges, "
    "commissions et taxe de séjour, et nous répondons à ses questions.",
])


def faq_commune() -> list:
    return [
        ("Dois-je venir en France pour vous confier mon bien ?",
         "Non. Visio, mandat électronique, remise des clés par un proche ou le notaire, états des "
         "lieux photo : tout se fait à distance. Vous venez quand vous le souhaitez, et nous "
         "préparons alors le logement pour vous."),
        ("Comment suis-je payé ?",
         "Les revenus sont versés en euros, chaque mois, sur le compte de votre choix (France ou "
         "zone SEPA de préférence), accompagnés d'un relevé détaillé."),
        ("Que se passe-t-il quand je veux récupérer mon logement ?",
         "En courte durée, nous bloquons le calendrier à la date voulue. En bail mobilité, le bail "
         "est à durée fixe et non renouvelable. En meublé longue durée, les délais légaux de congé "
         "s'appliquent : c'est pourquoi nous choisissons le régime en fonction de vos dates de "
         "retour."),
        ("Quels sont vos honoraires ?",
         "Une commission sur les revenus encaissés en courte et moyenne durée, un pourcentage des "
         "loyers en longue durée. Pas de frais fixes ni d'abonnement : si le bien ne rapporte pas, "
         "nous ne gagnons rien. Le taux exact figure dans la proposition écrite."),
    ]


def hub_spec() -> dict:
    liens = [lien_pays(p) for p in PAYS]
    return dict(
        slug=SLUG_HUB,
        title="Conciergerie Airbnb pour propriétaires expatriés et non-résidents | Label Maison",
        desc="Vous vivez à l'étranger et possédez un bien à Paris ou en France ? Gestion à distance "
             "clé en main : clés, accueil, ménage, fiscalité des non-résidents, reporting mensuel.",
        crumb="Propriétaires expatriés",
        trail=[("Accueil", "/"), ("Propriétaires", "/proprietaires")],
        nav=NAV,
        service_type="Gestion locative à distance pour propriétaires non-résidents",
        area="Paris, Île-de-France et France",
        offers=["Audit et recommandation de régime locatif", "Mandat de gestion électronique",
                "Gestion des clés et des accès", "Accueil et relation voyageurs",
                "Ménage, linge et maintenance", "Reporting mensuel et relevé annuel"],
        badge="🌍 Propriétaires à l'étranger · Gestion à distance",
        h1="Votre bien en France, géré <span class=\"font-serif-italic\">depuis l'étranger</span>",
        sub="Vous vivez à Dubaï, Londres, Casablanca, New York, Berlin, Bali ou Shanghai et vous "
            "possédez un appartement à Paris, en Île-de-France ou ailleurs en France. Nous le "
            "louons, l'entretenons et vous rendons des comptes, chaque mois, par écrit.",
        photo=("real/logement-hero.jpg", "Appartement parisien géré à distance pour un propriétaire expatrié"),
        puces=["Mandat <b>100 % en ligne</b>", "Clés et accès <b>gérés</b>",
               "Reporting <b>mensuel</b>", "Fiscalité non-résident <b>documentée</b>"],
        cta="Confier mon bien à distance",
        intro=[
            "Un appartement à Paris et une vie à huit heures d'avion : la situation est de plus en "
            "plus courante, et presque toujours mal gérée. Soit le bien reste vide et coûte chaque "
            "mois, soit un proche s'en occupe « en attendant », soit il est loué sans que personne "
            "ne vérifie ce que la loi autorise depuis que vous n'y habitez plus.",
            "<strong>Label Maison Conciergerie</strong> gère des biens à Paris, en Île-de-France et "
            "dans ses villes partenaires pour des propriétaires qui vivent à l'étranger. Nous "
            "prenons tout ce qui exige d'être sur place — clés, accueil, ménage, maintenance — et "
            "tout ce qui exige de connaître la réglementation française : statut du bien, régime "
            "locatif, déclarations, fiscalité des non-résidents. Vous gardez les décisions et les "
            "revenus.",
        ],
        cards=CARDS_SERVICES,
        sections=[
            section_regimes(),
            SECTION_FISCALITE,
            ("Un fuseau horaire ne doit pas être un problème", [
                "La plupart des imprévus d'une location se produisent le soir : une arrivée tardive, "
                "un code qui ne fonctionne pas, un voisin qui se plaint. Pour un propriétaire à "
                "Dubaï, il est alors minuit ; à New York, c'est le milieu de l'après-midi de "
                "travail ; à Bali, le petit matin. Dans tous les cas, ce n'est pas à vous de "
                "répondre.",
                "Nos équipes traitent les voyageurs à l'heure de Paris. Vous recevez un compte rendu "
                "écrit, et nous calons les points réguliers sur votre créneau, pas sur le nôtre.",
            ]),
        ],
        gallery=[C.photo(k) for k in range(0, 12, 2)],
        steps=STEPS,
        why=WHY,
        zones=("Où que vous viviez, nous gérons votre bien en France",
               "Chaque pays a ses horaires, ses liaisons, sa convention fiscale et ses habitudes "
               "bancaires. Nous avons détaillé ce qui change selon votre pays de résidence :",
               liens + [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                        ("Essonne et banlieue", "/conciergerie-airbnb-essonne"),
                        ("Toute la France", "/conciergerie-airbnb-france")],
               "Vous achetez depuis l'étranger ? Nous intervenons dès la recherche : voir notre "
               "<a href=\"/investissement-locatif-paris\"><strong>investissement locatif à Paris</strong></a> "
               "et notre <a href=\"/estimation-rentabilite-airbnb\"><strong>estimation de rentabilité</strong></a>."),
        faq_title="Questions fréquentes des propriétaires à l'étranger",
        faq=faq_commune() + [
            ("Gérez-vous aussi des biens situés hors de France ?",
             "Non. Nous gérons des biens situés en France pour des propriétaires qui vivent où ils "
             "veulent. Pour un séjour ou un service à Dubaï et Marrakech, voir notre "
             "<a href=\"/conciergerie-dubai\">conciergerie à Dubaï</a> et notre "
             "<a href=\"/conciergerie-marrakech\">conciergerie à Marrakech</a>."),
            ("Mon bien est en province, pas à Paris : est-ce possible ?",
             "Oui, dans les villes où nous disposons d'équipes ou de partenaires. Consultez notre "
             "<a href=\"/conciergerie-airbnb-france\">couverture ville par ville</a> ou "
             "indiquez-nous l'adresse : nous vous répondons honnêtement."),
        ],
        form=("Vous vivez à l'étranger ? Parlons de votre bien en France",
              "Indiquez votre pays de résidence, l'adresse du bien et vos dates de retour éventuelles : "
              "nous vous répondons avec une recommandation écrite et un créneau de visio à votre heure.",
              "Paris / Île-de-France", "Propriétaire à l'étranger"),
        footer=FOOT,
        tagline="Votre bien en France, géré à distance — "
                "<span class=\"font-serif-italic\">sans y être</span>.",
        lieu="Paris · Île-de-France · France",
        mobcta="Confier mon bien",
    )


def pays_spec(p: dict) -> dict:
    nom, slug = p["nom"], p["slug"]
    page_slug = f"conciergerie-airbnb-expatrie-{slug}"
    autres = [lien_pays(x) for x in PAYS if x["slug"] != slug]
    villes = ", ".join(p["villes"][:-1]) + " ou " + p["villes"][-1]
    idx = PAYS.index(p)
    photo_h = C.photo(idx + 1)
    article = p["depuis"]
    return dict(
        slug=page_slug,
        title=f"Propriétaire {p['vit']} : gérer son appartement à Paris à distance | Label Maison",
        desc=f"Vous vivez {p['vit']} et possédez un bien à Paris ou en France ? Gestion à distance "
             f"clé en main, fiscalité des non-résidents, convention {p['conv']}, reporting mensuel.",
        crumb=f"Propriétaires {p['vit']}",
        trail=[("Accueil", "/"), ("Propriétaires expatriés", HUB)],
        nav=NAV,
        service_type=f"Gestion locative à distance pour propriétaires vivant {p['vit']}",
        area="Paris, Île-de-France et France",
        offers=["Visio et audit à distance", "Mandat de gestion électronique",
                "Gestion des clés et des accès", "Accueil et relation voyageurs",
                "Ménage, linge et maintenance", "Relevé annuel pour la déclaration des non-résidents"],
        badge=f"{p['drapeau']} {nom} · Propriétaires à l'étranger",
        h1=f"Vous vivez {p['vit']} ? Votre bien à Paris, géré <span class=\"font-serif-italic\">{article}</span>",
        sub=f"Vous vivez à {villes} et vous possédez — ou achetez — un appartement à Paris, en "
            f"Île-de-France ou ailleurs en France. Nous le louons, l'entretenons et vous rendons des "
            f"comptes chaque mois, à votre heure.",
        photo=photo_h,
        puces=["Mandat <b>en ligne</b>", "Visio <b>à votre heure</b>",
               "Reporting <b>mensuel</b>", "Relevé <b>annuel</b> pour votre déclaration"],
        cta="Confier mon bien à distance",
        intro=[
            p["profil"],
            p["pourquoi"] + " <strong>Label Maison Conciergerie</strong> gère ces biens à Paris, en "
            "Île-de-France et dans ses villes partenaires, pour des propriétaires qui vivent "
            f"{p['vit']} et n'ont pas l'intention de rentrer pour une fuite d'eau.",
        ],
        cards=CARDS_SERVICES,
        sections=[
            (f"Gérer un bien parisien {article} : horaires, liaisons, habitudes", [
                p["decalage"], p["liaison"],
            ]),
            section_regimes(),
            (f"Fiscalité : {p['resident']} et loyers français", [
                p["convention"],
                "Dans tous les cas, les non-résidents sont imposés en France avec un taux minimum et, "
                "selon leur affiliation sociale, des prélèvements sociaux ou un prélèvement de "
                "solidarité réduit. Micro-BIC ou régime réel : l'arbitrage appartient à votre "
                "expert-comptable, auquel nous remettons chaque année un relevé complet. Pour les "
                "repères généraux, voir notre guide de la "
                "<a href=\"/fiscalite-airbnb-ile-de-france\">fiscalité de la location meublée</a>.",
                p["banque"],
            ]),
        ],
        gallery=[C.photo(k) for k in range(idx, idx + 10, 2)],
        steps=STEPS,
        why=WHY,
        zones=("Propriétaires à l'étranger : les autres pays",
               "Le fonctionnement est le même ; les horaires, les liaisons et la convention fiscale "
               "changent. Retrouvez la page de votre pays, ou la page pilier :",
               [("Tous les propriétaires expatriés", HUB)] + autres +
               [("Conciergerie Airbnb Paris", "/conciergerie-airbnb-paris"),
                ("Essonne et banlieue", "/conciergerie-airbnb-essonne")],
               "Vous achetez à Paris depuis l'étranger ? Voir notre "
               "<a href=\"/investissement-locatif-paris\"><strong>investissement locatif à Paris</strong></a>."),
        faq_title=f"Questions fréquentes — propriétaires {p['adj']}",
        faq=p["faq"] + faq_commune(),
        form=(f"Vous vivez {p['vit']} ? Parlons de votre bien en France",
              "Adresse du bien, situation actuelle (occupé, vide, loué) et dates de retour éventuelles : "
              "nous vous répondons avec une recommandation écrite et un créneau de visio à votre heure.",
              "Paris / Île-de-France", f"Propriétaire à l'étranger — {nom}"),
        footer=FOOT,
        tagline=f"Votre bien en France, géré {article} — "
                "<span class=\"font-serif-italic\">sans y être</span>.",
        lieu="Paris · Île-de-France · France",
        mobcta="Confier mon bien",
    )


# ----------------------------------------------------------------------------- #
#  Maillage depuis les pages existantes
# ----------------------------------------------------------------------------- #
PATCHS = {
    # page existante -> (texte du lien, cible)
    "conciergerie-dubai.html":
        ("Vous vivez à Dubaï et possédez un bien en France ?", "/conciergerie-airbnb-expatrie-dubai"),
    "conciergerie-marrakech.html":
        ("Vous vivez au Maroc et possédez un bien en France ?", "/conciergerie-airbnb-expatrie-maroc"),
    "gestion-locative-paris.html":
        ("Propriétaires à l'étranger", HUB),
    "conciergerie-airbnb-paris.html":
        ("Propriétaires à l'étranger", HUB),
    "investissement-locatif-paris.html":
        ("Acheter et faire gérer depuis l'étranger", HUB),
}


def patch_existantes() -> int:
    """Ajoute un lien vers le silo dans le bloc « zones » des pages liées."""
    n = 0
    for fichier, (label, cible) in PATCHS.items():
        p = C.OUT / fichier
        if not p.exists():
            continue
        s = p.read_text(encoding="utf-8")
        if cible in s:
            continue
        lien = f'<a href="{cible}">{C.esc(label)}</a>'
        s2, k = re.subn(r'(<div class="zones"[^>]*>)(.*?)(</div>)',
                        lambda m: m.group(1) + m.group(2) + lien + m.group(3), s, count=1, flags=re.S)
        if k:
            p.write_text(s2, encoding="utf-8")
            n += 1
    return n


def main() -> list:
    urls = [build(hub_spec())]
    urls += [build(pays_spec(p)) for p in PAYS]
    n = patch_existantes()
    print(f"Expatriés : {len(urls)} pages ({SLUG_HUB} + {len(PAYS)} pays), {n} pages existantes maillées")
    return urls


if __name__ == "__main__":
    main()
