# -*- coding: utf-8 -*-
"""Textes des pages « Sourcing immobilier en Chine » (voir gen_sourcing_chine.py).

- FR : page principale (France), texte du propriétaire.
- Pages locales Paris, Dubaï, Marrakech : la page principale + une section propre
  à la ville, une FAQ adaptée et les mentions de lieu ajustées. Chaque page locale
  a un contenu réellement différent (contexte, équipements, liens vers les pages
  du site sur place) : pas de pages copiées-collées.
- EN : version anglaise de la page principale, pour Dubaï et l'international.

Règles : aucune promesse chiffrée, aucun avis, aucune réalisation inventée ; les
formulations conditionnelles du propriétaire (« lorsque cela est prévu »,
« selon le projet ») sont conservées partout.
"""
from __future__ import annotations

import copy

PRINCIPALE = "sourcing-immobilier-chine"
ANGLAISE = "en/china-sourcing-property"
LOCALES = {"paris": "sourcing-chine-paris", "dubai": "sourcing-chine-dubai",
           "marrakech": "sourcing-chine-marrakech"}

# --------------------------------------------------------------------------- #
#  Page principale (France)
# --------------------------------------------------------------------------- #
FR = {
    "langue": "fr",
    "slug": PRINCIPALE,
    "title": "Sourcing immobilier en Chine : cuisines, bains, mobilier",
    "desc": ("Cuisines, salles de bains et mobilier sourcés auprès de fabricants chinois pour "
             "votre bien immobilier. Un seul interlocuteur, échange sans engagement."),
    "og": "og-sourcing-immobilier-chine.jpg",
    "og_pastille": "Sourcing immobilier en Chine",
    "pastille": "Sourcing immobilier en Chine",
    "h1": ["Des aménagements premium.", "Un budget <em>maîtrisé</em>."],
    "og_titre": "Des aménagements premium. Un budget <em>maîtrisé</em>.",
    "sous_fort": "Un seul interlocuteur pour votre projet.",
    "sous": ("LabelMaison vous accompagne dans le sourcing direct auprès de fabricants chinois pour vos "
             "cuisines, salles de bains, meubles et équipements immobiliers."),
    "cta_projet": "Parler de mon projet sur WhatsApp",
    "note": "Premier échange personnalisé, sans engagement.",
    "flux": {"avant": "Aujourd'hui", "apres": "Avec LabelMaison", "mention": "Visuels d'illustration.",
             "pause": "Mettre l'animation en pause", "lecture": "Relancer l'animation"},
    "etiquettes": {"cuisine": "Cuisine sur mesure", "bain": "Salle de bains"},
    "enonce": ("Vous investissez dans l'immobilier et souhaitez aménager, meubler ou rénover votre bien",
               "sans supporter systématiquement les prix élevés du marché français ?"),
    "duo1": ("Nous recherchons des fabricants, comparons les solutions, sélectionnons les produits et "
             "organisons leur approvisionnement jusqu'à votre projet en France."),
    "duo2": ("Votre objectif :", "obtenir un aménagement de qualité, maîtriser votre budget et améliorer "
             "le potentiel de votre investissement immobilier."),
    "dimension": {
        "surtitre": "Notre approche",
        "h2": "Donnez une <em>nouvelle dimension</em> à votre investissement immobilier",
        "lead": "Un investissement immobilier ne s'arrête pas à l'achat du bien.",
        "p1": ("L'aménagement, le mobilier et les équipements représentent une part importante du budget "
               "nécessaire pour préparer un logement à la location ou à la revente."),
        "citation": ("Chez LabelMaison, nous pensons qu'il est possible de concilier esthétique, qualité et "
                     "maîtrise des coûts."),
        "p2": ("C'est pourquoi nous accompagnons les investisseurs dans la recherche de fabricants directement "
               "en Chine, notamment dans les secteurs de la cuisine, de la salle de bains et de l'ameublement."),
        "p3": ("Notre approche : rechercher des solutions adaptées à votre projet, comparer les offres et vous "
               "accompagner dans les différentes étapes de l'approvisionnement."),
    },
    "local": None,
    "solutions": {
        "surtitre": "Cuisine · Salle de bains · Mobilier",
        "h2": "Nos solutions de sourcing",
        "items": [
            ("cuisine", "Cuisines sur mesure",
             "Concevez une cuisine adaptée à votre logement, à son standing et à votre budget.",
             ["Meubles de cuisine et rangements", "Façades et plans de travail", "Îlots centraux",
              "Éviers et robinetterie", "Solutions d'aménagement personnalisées"],
             "Demander un projet cuisine sur WhatsApp", "cuisine"),
            ("bain", "Salles de bains",
             "Valorisez vos espaces avec des équipements et finitions sélectionnés auprès de fabricants.",
             ["Meubles vasques", "Douches et parois", "Baignoires", "Robinetterie", "Miroirs et accessoires",
              "Solutions de rangement"],
             "Demander un projet salle de bains sur WhatsApp", "bain"),
            ("mobilier", "Mobilier et décoration",
             "Équipez vos appartements et villas avec une sélection de mobilier adaptée à votre positionnement "
             "immobilier.",
             ["Canapés et fauteuils", "Lits et chambres", "Tables et chaises", "Luminaires", "Mobilier sur mesure",
              "Accessoires et décoration"],
             "Parler de mon projet mobilier sur WhatsApp", "mobilier"),
        ],
        "large": {
            "titre": "Aménagement complet d'un bien immobilier",
            "paras": [
                "Vous achetez un appartement destiné à la location courte durée ou une résidence haut de gamme à "
                "valoriser ?",
                "LabelMaison peut vous accompagner dans la recherche et la sélection des équipements nécessaires à "
                "votre projet.",
                "De la cuisine au mobilier, nous recherchons des solutions cohérentes pour aménager votre logement "
                "et maîtriser votre enveloppe budgétaire.",
            ],
            "cta": "Étudier mon projet d'aménagement",
            "compo": [("cuisine", "Cuisine"), ("bain", "Salle de bains"), ("mobilier", "Mobilier"),
                      ("complet", "Équipements")],
        },
    },
    "pourquoi": {
        "h2": "Pourquoi sourcer directement en Chine ?",
        "chapo": [
            "La Chine dispose d'un écosystème industriel important dans les domaines du mobilier, de la cuisine, "
            "de la salle de bains et des équipements pour l'habitat.",
            "L'approvisionnement direct auprès de fabricants peut ouvrir l'accès à davantage de choix, de "
            "personnalisation et d'opportunités tarifaires.",
        ],
        "sous_titre": "Les avantages recherchés",
        "avantages": [
            ("budget", "Maîtriser votre budget",
             "Comparer les offres des fabricants et rechercher des alternatives compétitives aux solutions "
             "disponibles en France."),
            ("perso", "Accéder à davantage de personnalisation",
             "Étudier différentes dimensions, finitions, matériaux et configurations."),
            ("centraliser", "Centraliser vos achats",
             "Regrouper plusieurs besoins d'aménagement dans une démarche d'approvisionnement cohérente."),
            ("accompagne", "Être accompagné",
             "Bénéficier d'un interlocuteur pour organiser la recherche, la sélection et le suivi de votre projet."),
        ],
        "note": ("Les économies dépendent des produits, des quantités, du transport, des droits et taxes, des frais "
                 "de conformité et de la pose. Elles sont évaluées au cas par cas."),
    },
    "methode": {
        "surtitre": "Cinq étapes",
        "h2": "Notre accompagnement : de la recherche à votre projet",
        "etiquette": "Étape",
        "etapes": [
            ("Comprendre votre projet",
             "Nous échangeons sur votre bien immobilier, vos besoins, votre budget et le niveau de finition "
             "recherché."),
            ("Rechercher les fabricants",
             "Nous identifions des fabricants et étudions les solutions correspondant à votre cahier des charges."),
            ("Comparer et sélectionner",
             "Nous comparons les propositions, les caractéristiques techniques, les finitions et les conditions "
             "commerciales."),
            ("Organiser le contrôle et l'approvisionnement",
             "Selon le projet et les contrats convenus, nous organisons les vérifications nécessaires, le suivi de "
             "fabrication et la logistique internationale."),
            ("Préparer la livraison et l'installation",
             "Nous accompagnons la coordination de la livraison en France et, lorsque cela est prévu, la mise en "
             "relation avec des professionnels qualifiés pour la pose."),
        ],
    },
    "partenaire": {
        "h2": "Un partenaire pour valoriser votre <em>patrimoine</em> immobilier",
        "chapo": ("LabelMaison ne souhaite pas simplement vous aider à acheter des meubles. Notre ambition est de "
                  "vous accompagner dans les différentes étapes de votre investissement immobilier."),
        "questions": [("immeuble", "Vous recherchez un appartement à aménager ?"),
                      ("plusieurs", "Vous possédez déjà plusieurs logements ?"),
                      ("renovation", "Vous préparez une rénovation avant une mise en location ?")],
        "etude": ("Nous pouvons étudier avec vous les besoins d'approvisionnement et les solutions d'aménagement "
                  "adaptées à votre stratégie."),
        "devise": ["Acheter intelligemment.", "Aménager avec cohérence.", "Préparer son bien à l'exploitation."],
        "vision": "C'est notre vision de l'accompagnement immobilier.",
        "cta": "Échanger avec LabelMaison sur WhatsApp",
    },
    "villes": {
        "surtitre": "Où nous intervenons",
        "h2": "Paris, Dubaï, Marrakech",
        "chapo": ("Le sourcing s'adapte à chaque marché : contraintes du bien, attentes des voyageurs, logistique "
                  "et formalités d'importation."),
        "voir": "Voir la page",
        "cartes": [
            ("paris", "Paris", "Appartements compacts, cuisines ouvertes, accès en étage : du sur-mesure aux cotes "
                               "exactes."),
            ("dubai", "Dubaï", "Villas et appartements à équiper pour la location saisonnière ou la revente."),
            ("marrakech", "Marrakech", "Riads et villas : l'artisanat marocain associé aux équipements sourcés."),
        ],
        "autre_langue": ("Read this page in English", ANGLAISE),
    },
    "faq": {
        "surtitre": "FAQ",
        "h2": "Questions fréquentes sur le sourcing en Chine",
        "cote": "Une autre question ? Écrivez-nous sur WhatsApp.",
        "lien": "Poser ma question sur WhatsApp",
        "items": [
            ("Est-il réellement moins cher de sourcer en Chine ?",
             "Certains produits peuvent être achetés à des conditions compétitives directement auprès de "
             "fabricants. Toutefois, le prix usine ne représente pas le coût final. Le transport, l'assurance, les "
             "formalités douanières, les taxes, les contrôles et la pose doivent être intégrés à la comparaison."),
            ("Quels produits peut-on sourcer en Chine ?",
             "Nous étudions notamment les cuisines, meubles de salle de bains, équipements, mobilier, luminaires et "
             "solutions d'aménagement intérieur, sous réserve de leur conformité aux exigences applicables en "
             "Europe."),
            ("Travaillez-vous uniquement avec des investisseurs immobiliers ?",
             "Nous ciblons prioritairement les investisseurs et propriétaires qui souhaitent aménager ou valoriser "
             "un bien immobilier. Les projets de résidences secondaires et de logements haut de gamme peuvent "
             "également être étudiés."),
            ("Pouvez-vous aménager un appartement entier ?",
             "Oui, nous pouvons étudier un projet global comprenant plusieurs catégories de produits : cuisine, "
             "salle de bains, mobilier et équipements. Le périmètre de notre accompagnement est défini selon chaque "
             "projet."),
            ("Comment se passe la livraison en France ?",
             "Les modalités de transport, d'assurance, de dédouanement et de livraison sont définies en fonction "
             "des produits, des volumes et du montage contractuel retenu."),
            ("Proposez-vous également la pose ?",
             "La pose peut être étudiée avec des professionnels partenaires qualifiés en France. Elle fait l'objet "
             "d'un périmètre et d'un devis distincts selon les travaux concernés."),
            ("Comment obtenir un devis ?",
             "Contactez-nous sur WhatsApp avec une description de votre projet, la localisation du bien, les "
             "produits recherchés et votre budget estimatif. Nous pourrons ainsi étudier votre demande."),
        ],
    },
    "final": {
        "signature": "LabelMaison — Sourcing & Property Improvement",
        "h2": "Parlons de votre <em>prochain investissement</em>",
        "paras": [
            "Vous avez un appartement à aménager, une villa à rénover ou un projet d'investissement immobilier ?",
            "Présentez-nous votre projet. Nous étudierons les possibilités de sourcing auprès de fabricants chinois "
            "et les solutions adaptées à votre budget.",
        ],
        "cta": "Discuter de mon projet sur WhatsApp",
        "mention": ("Chaque projet fait l'objet d'une étude personnalisée. Les prix, délais, économies et conditions "
                    "d'approvisionnement dépendent des produits sélectionnés et des modalités contractuelles."),
    },
    "pied": {
        "tag": ("Sourcing de cuisines, salles de bains et mobilier auprès de fabricants chinois, pour les "
                "investisseurs et propriétaires."),
        "col1": "Sourcing en Chine",
        "liens1": [("Toute la France", "/" + PRINCIPALE), ("Paris", "/" + LOCALES["paris"]),
                   ("Dubaï", "/" + LOCALES["dubai"]), ("Marrakech", "/" + LOCALES["marrakech"]),
                   ("In English", "/" + ANGLAISE)],
        "col2": "Label Maison",
        "liens2": [("Accueil", "/"), ("Conciergerie pour propriétaires", "/proprietaires"),
                   ("Investissement locatif à Paris", "/investissement-locatif-paris"),
                   ("Décoration intérieure : avant, après", "/avant-apres-decoration-interieure")],
        "col3": "Contact",
        "legal": [("Mentions légales", "/mentions-legales"), ("Confidentialité", "/politique-de-confidentialite")],
        "aller": "Aller au contenu",
    },
    "wa": {
        "gabarit": "\n\nLocalisation du bien : \nProduits recherchés : \nBudget estimatif : ",
        "projet": "Bonjour LabelMaison, je souhaite vous présenter mon projet de sourcing en Chine.",
        "question": "Bonjour LabelMaison, j'ai une question sur le sourcing en Chine.",
        "cuisine": ("Bonjour LabelMaison, je souhaite un projet de cuisine sur mesure sourcée en Chine."
                    "\n\nLocalisation du bien : \nDimensions de la pièce : \nBudget estimatif : "),
        "bain": ("Bonjour LabelMaison, je souhaite un projet de salle de bains sourcée en Chine."
                 "\n\nLocalisation du bien : \nÉquipements recherchés : \nBudget estimatif : "),
        "mobilier": ("Bonjour LabelMaison, je souhaite parler de mon projet de mobilier et de décoration."
                     "\n\nType de bien : \nPièces à meubler : \nBudget estimatif : "),
        "complet": "Bonjour LabelMaison, je souhaite faire étudier l'aménagement complet de mon bien.",
    },
    "ld": {
        "nom": "Sourcing immobilier en Chine",
        "type": "Sourcing de cuisines, salles de bains et mobilier en Chine pour l'immobilier",
        "zones": [("Country", "France"), ("City", "Paris"), ("City", "Dubaï"), ("City", "Marrakech")],
        "offres_extra": ["Aménagement complet d'un bien immobilier"],
        "fil": [("Accueil", "/"), ("Sourcing immobilier en Chine", "/" + PRINCIPALE)],
    },
    "hreflang": {"fr": "/" + PRINCIPALE, "en": "/" + ANGLAISE, "x-default": "/" + PRINCIPALE},
    "freres": ["paris", "dubai", "marrakech"],
}


def _ville(base: dict, cle: str, **modifs) -> dict:
    p = copy.deepcopy(base)
    p.update({k: v for k, v in modifs.items() if k not in ("remplacer",)})
    p["slug"] = LOCALES[cle]
    p["hreflang"] = None
    p["freres"] = [c for c in LOCALES if c != cle]
    # Mentions de lieu à ajuster dans les textes repris de la page principale.
    for ancien, nouveau in modifs.get("remplacer", []):
        _remplacer_partout(p, ancien, nouveau)
    return p


def _remplacer_partout(o, ancien: str, nouveau: str):
    if isinstance(o, dict):
        for k, v in o.items():
            if isinstance(v, str):
                o[k] = v.replace(ancien, nouveau)
            elif isinstance(v, tuple):
                o[k] = tuple(x.replace(ancien, nouveau) if isinstance(x, str) else x for x in v)
            else:
                _remplacer_partout(v, ancien, nouveau)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            if isinstance(v, str):
                o[i] = v.replace(ancien, nouveau)
            elif isinstance(v, tuple):
                o[i] = tuple(x.replace(ancien, nouveau) if isinstance(x, str) else x for x in v)
            else:
                _remplacer_partout(v, ancien, nouveau)


def _villes_pour(cle: str, nom: str) -> dict:
    v = copy.deepcopy(FR["villes"])
    v["surtitre"] = "Nos autres destinations"
    v["h2"] = "Le sourcing en Chine, ailleurs"
    v["chapo"] = f"LabelMaison accompagne aussi des projets ailleurs qu'à {nom}."
    v["cartes"] = [c for c in v["cartes"] if c[0] != cle] + [
        ("france", "Toute la France", "La page principale : nos solutions, notre méthode et la FAQ complète.")]
    v["autre_langue"] = None
    return v


# --------------------------------------------------------------------------- #
#  Paris
# --------------------------------------------------------------------------- #
PARIS = _ville(
    FR, "paris",
    title="Sourcing en Chine à Paris : cuisine, bains, mobilier",
    desc=("Aménagez votre appartement à Paris avec des cuisines, salles de bains et meubles sourcés auprès de "
          "fabricants chinois. Un seul interlocuteur."),
    og="og-sourcing-chine-paris.jpg",
    og_pastille="Sourcing en Chine · Paris",
    pastille="Sourcing en Chine · Paris",
    h1=["Votre bien à Paris,", "aménagé <em>premium</em>."],
    og_titre="Votre bien à Paris, aménagé <em>premium</em>.",
    sous_fort="Un seul interlocuteur, du fabricant à votre appartement.",
    sous=("LabelMaison accompagne les investisseurs et propriétaires parisiens dans le sourcing direct auprès de "
          "fabricants chinois : cuisines sur mesure, salles de bains, mobilier et équipements."),
    local={
        "surtitre": "Aménager à Paris",
        "h2": "Des solutions pensées pour les appartements parisiens",
        "paras": [
            "À Paris, chaque mètre carré compte. Pièces aux dimensions atypiques, cuisines ouvertes sur le séjour, "
            "salles de bains étroites, accès par un escalier ou un petit ascenseur : un aménagement réussi commence "
            "par des cotes précises.",
            "Le sourcing auprès de fabricants permet d'étudier du sur-mesure à vos dimensions, avec un large choix de "
            "finitions, là où les gammes standard imposent souvent leurs formats.",
            "Nous préparons la livraison en tenant compte des accès du bien et, lorsque cela est prévu, nous vous "
            "mettons en relation avec des professionnels qualifiés pour la pose.",
        ],
        "cartes": [
            ("cuisine", "Cuisines compactes sur mesure",
             "Meubles aux cotes exactes, rangements optimisés, façades et plans de travail au choix."),
            ("bain", "Salles de bains optimisées",
             "Meubles vasques, parois et rangements adaptés aux petites surfaces."),
            ("mobilier", "Mobilier à l'échelle", "Canapés, lits et tables dimensionnés pour les volumes parisiens."),
            ("complet", "Prêt à louer", "Un appartement entièrement équipé avant sa mise en location meublée."),
        ],
        "liens_titre": "À Paris, Label Maison, c'est aussi",
        "liens": [("Notre conciergerie Airbnb à Paris", "/conciergerie-airbnb-paris"),
                  ("Investissement locatif à Paris", "/investissement-locatif-paris"),
                  ("Décoration de style haussmannien", "/decoration-style-haussmannien")],
    },
    remplacer=[],
)
PARIS["villes"] = _villes_pour("paris", "Paris")
PARIS["faq"]["items"] = [
    ("Intervenez-vous dans tout Paris et en Île-de-France ?",
     "Nous étudions les projets à Paris et en Île-de-France. La livraison et, lorsque cela est prévu, la pose "
     "sont organisées selon l'adresse et les accès du bien."),
    ("Peut-on faire réaliser une cuisine sur mesure pour un petit appartement parisien ?",
     "Oui. Le sur-mesure est souvent la meilleure réponse aux petites surfaces : les meubles sont étudiés à "
     "partir des cotes exactes de la pièce, avec les finitions et les rangements adaptés à votre projet."),
] + PARIS["faq"]["items"]
PARIS["faq"]["h2"] = "Questions fréquentes sur le sourcing en Chine à Paris"
PARIS["ld"]["nom"] = "Sourcing en Chine à Paris"
PARIS["ld"]["zones"] = [("City", "Paris"), ("AdministrativeArea", "Île-de-France")]
PARIS["ld"]["fil"] = FR["ld"]["fil"] + [("Paris", "/" + LOCALES["paris"])]
for k in ("projet", "cuisine", "bain", "mobilier", "complet"):
    PARIS["wa"][k] = PARIS["wa"][k].replace("Bonjour LabelMaison, ", "Bonjour LabelMaison, pour un bien à Paris, ")

# --------------------------------------------------------------------------- #
#  Dubaï
# --------------------------------------------------------------------------- #
_HORS_FRANCE = [
    ("prix élevés du marché français ?", "prix élevés du marché local ?"),
    ("aux solutions disponibles en France.", "aux solutions disponibles localement."),
    ("La pose peut être étudiée avec des professionnels partenaires qualifiés en France.",
     "La pose peut être étudiée avec des professionnels qualifiés."),
]
DUBAI = _ville(
    FR, "dubai",
    title="Sourcing en Chine à Dubaï : cuisine, bains, mobilier",
    desc=("Équipez votre villa ou votre appartement à Dubaï avec des cuisines, salles de bains et meubles sourcés "
          "auprès de fabricants chinois. Un seul interlocuteur."),
    og="og-sourcing-chine-dubai.jpg",
    og_pastille="Sourcing en Chine · Dubaï",
    pastille="Sourcing en Chine · Dubaï",
    h1=["Votre bien à Dubaï,", "équipé <em>premium</em>."],
    og_titre="Votre bien à Dubaï, équipé <em>premium</em>.",
    sous_fort="Un seul interlocuteur, du fabricant à votre bien.",
    sous=("LabelMaison accompagne les investisseurs à Dubaï dans le sourcing direct auprès de fabricants chinois : "
          "cuisines, salles de bains, mobilier et équipements pour villas et appartements."),
    local={
        "surtitre": "Aménager à Dubaï",
        "h2": "Villas et appartements à équiper, de la cuisine au mobilier",
        "paras": [
            "À Dubaï, un bien destiné à la location ou à la revente doit être à la hauteur d'une clientèle "
            "exigeante. Qu'il soit livré nu, partiellement équipé ou à rénover, l'aménagement pèse lourd dans le "
            "budget.",
            "Le sourcing direct auprès de fabricants chinois permet de comparer les offres et d'étudier des "
            "équipements sur mesure, en cohérence avec le standing du bien.",
            "Les modalités de transport, de dédouanement et de livraison aux Émirats sont définies selon les "
            "produits, les volumes et le montage contractuel retenu.",
        ],
        "cartes": [
            ("complet", "Villas à équiper", "Cuisine, salles de bains, chambres et séjours, dans une démarche "
                                            "cohérente."),
            ("cuisine", "Cuisines haut de gamme", "Îlots, façades, plans de travail et rangements sur mesure."),
            ("bain", "Salles de bains", "Vasques, douches, robinetterie et miroirs sélectionnés auprès de "
                                        "fabricants."),
            ("mobilier", "Location saisonnière", "Un mobilier pensé pour la location courte durée (holiday "
                                                 "homes)."),
        ],
        "liens_titre": "À Dubaï, Label Maison, c'est aussi",
        "liens": [("Investissement immobilier à Dubaï", "/investissement-immobilier-dubai"),
                  ("Notre conciergerie à Dubaï", "/conciergerie-dubai"),
                  ("Location de villas à Dubaï", "/location-villa-dubai")],
    },
    remplacer=_HORS_FRANCE + [
        ("jusqu'à votre projet en France.", "jusqu'à votre projet à Dubaï."),
        ("la coordination de la livraison en France", "la coordination de la livraison à Dubaï"),
        ("Comment se passe la livraison en France ?", "Comment se passe la livraison à Dubaï ?"),
        ("exigences applicables en Europe.", "exigences applicables aux Émirats arabes unis."),
    ],
)
DUBAI["villes"] = _villes_pour("dubai", "Dubaï")
DUBAI["villes"]["autre_langue"] = ("Read this page in English", ANGLAISE)
DUBAI["faq"]["items"] = [
    ("Accompagnez-vous les investisseurs qui ne vivent pas à Dubaï ?",
     "Oui. Les échanges se font à distance, sur WhatsApp : vous nous présentez votre bien, vos besoins et votre "
     "budget, et nous étudions les solutions de sourcing adaptées."),
] + DUBAI["faq"]["items"]
DUBAI["faq"]["h2"] = "Questions fréquentes sur le sourcing en Chine pour Dubaï"
DUBAI["ld"]["nom"] = "Sourcing en Chine à Dubaï"
DUBAI["ld"]["zones"] = [("City", "Dubaï"), ("Country", "Émirats arabes unis")]
DUBAI["ld"]["fil"] = FR["ld"]["fil"] + [("Dubaï", "/" + LOCALES["dubai"])]
for k in ("projet", "cuisine", "bain", "mobilier", "complet"):
    DUBAI["wa"][k] = DUBAI["wa"][k].replace("Bonjour LabelMaison, ", "Bonjour LabelMaison, pour un bien à Dubaï, ")

# --------------------------------------------------------------------------- #
#  Marrakech
# --------------------------------------------------------------------------- #
MARRAKECH = _ville(
    FR, "marrakech",
    title="Sourcing en Chine à Marrakech : cuisine, bains, mobilier",
    desc=("Aménagez votre riad, votre villa ou votre appartement à Marrakech avec des cuisines, salles de bains et "
          "meubles sourcés auprès de fabricants chinois."),
    og="og-sourcing-chine-marrakech.jpg",
    og_pastille="Sourcing en Chine · Marrakech",
    pastille="Sourcing en Chine · Marrakech",
    h1=["Votre bien à Marrakech,", "aménagé <em>premium</em>."],
    og_titre="Votre bien à Marrakech, aménagé <em>premium</em>.",
    sous_fort="Un seul interlocuteur, du fabricant à votre bien.",
    sous=("LabelMaison accompagne les investisseurs à Marrakech dans le sourcing direct auprès de fabricants "
          "chinois : cuisines, salles de bains, mobilier et équipements pour riads, villas et appartements."),
    local={
        "surtitre": "Aménager à Marrakech",
        "h2": "Riads, villas et appartements : l'artisanat et le sur-mesure",
        "paras": [
            "À Marrakech, chaque bien a son caractère : riads organisés autour d'un patio, villas de la Palmeraie, "
            "appartements de Guéliz ou de l'Hivernage. L'aménagement doit respecter ce caractère tout en offrant le "
            "confort attendu par les voyageurs.",
            "Le sourcing en Chine peut compléter l'artisanat marocain : zellige, tadelakt et bois travaillé d'un "
            "côté, cuisines, sanitaires, robinetterie et mobilier contemporain de l'autre.",
            "Les modalités de transport, de dédouanement et de livraison au Maroc sont définies selon les produits, "
            "les volumes et le montage contractuel retenu.",
        ],
        "cartes": [
            ("renovation", "Riads à rénover", "Des équipements adaptés aux pièces organisées autour du patio."),
            ("cuisine", "Cuisines et sanitaires", "Cuisines, vasques, douches et robinetterie sélectionnées "
                                                  "auprès de fabricants."),
            ("mobilier", "Mobilier contemporain", "Un mobilier qui dialogue avec l'artisanat local."),
            ("complet", "Villas à équiper", "Un aménagement complet pour la location ou la revente."),
        ],
        "liens_titre": "À Marrakech, Label Maison, c'est aussi",
        "liens": [("Investissement locatif à Marrakech", "/investissement-locatif-marrakech"),
                  ("Notre conciergerie à Marrakech", "/conciergerie-marrakech"),
                  ("Riads privés à Marrakech", "/riad-prive-marrakech")],
    },
    remplacer=_HORS_FRANCE + [
        ("jusqu'à votre projet en France.", "jusqu'à votre projet à Marrakech."),
        ("la coordination de la livraison en France", "la coordination de la livraison au Maroc"),
        ("Comment se passe la livraison en France ?", "Comment se passe la livraison au Maroc ?"),
        ("exigences applicables en Europe.", "exigences applicables au Maroc."),
    ],
)
MARRAKECH["villes"] = _villes_pour("marrakech", "Marrakech")
MARRAKECH["faq"]["items"] = [
    ("Peut-on associer artisanat marocain et sourcing en Chine ?",
     "Oui, c'est souvent la combinaison la plus juste : l'artisanat local pour le caractère du bien (zellige, "
     "tadelakt, bois), le sourcing pour les cuisines, les sanitaires, les équipements et le mobilier contemporain. "
     "Nous étudions avec vous le bon équilibre pour votre projet."),
] + MARRAKECH["faq"]["items"]
MARRAKECH["faq"]["h2"] = "Questions fréquentes sur le sourcing en Chine pour Marrakech"
MARRAKECH["ld"]["nom"] = "Sourcing en Chine à Marrakech"
MARRAKECH["ld"]["zones"] = [("City", "Marrakech"), ("Country", "Maroc")]
MARRAKECH["ld"]["fil"] = FR["ld"]["fil"] + [("Marrakech", "/" + LOCALES["marrakech"])]
for k in ("projet", "cuisine", "bain", "mobilier", "complet"):
    MARRAKECH["wa"][k] = MARRAKECH["wa"][k].replace("Bonjour LabelMaison, ",
                                                    "Bonjour LabelMaison, pour un bien à Marrakech, ")

# --------------------------------------------------------------------------- #
#  English (Dubai and international)
# --------------------------------------------------------------------------- #
EN = {
    "langue": "en",
    "slug": ANGLAISE,
    "title": "China Sourcing for Property Investors in Dubai & Paris",
    "desc": ("Kitchens, bathrooms and furniture sourced directly from Chinese manufacturers for your property in "
             "Dubai, Paris or Marrakech. One point of contact."),
    "og": "og-china-sourcing-property.jpg",
    "og_pastille": "China sourcing for property",
    "pastille": "China sourcing for property",
    "h1": ["Premium interiors.", "A <em>controlled</em> budget."],
    "og_titre": "Premium interiors. A <em>controlled</em> budget.",
    "sous_fort": "One point of contact for your project.",
    "sous": ("LabelMaison helps you source kitchens, bathrooms, furniture and fittings directly from Chinese "
             "manufacturers, for your property in Dubai, Paris or Marrakech."),
    "cta_projet": "Discuss my project on WhatsApp",
    "note": "A first personal conversation, with no commitment.",
    "flux": {"avant": "Today", "apres": "With LabelMaison", "mention": "Illustrative visuals.",
             "pause": "Pause the animation", "lecture": "Play the animation"},
    "etiquettes": {"cuisine": "Bespoke kitchen", "bain": "Bathroom"},
    "enonce": ("Investing in property and looking to fit out, furnish or renovate it",
               "without always paying high local prices?"),
    "duo1": ("We find manufacturers, compare solutions, select products and organise the supply all the way to "
             "your property."),
    "duo2": ("Your goal:", "a quality fit-out, a controlled budget and a stronger property investment."),
    "dimension": {
        "surtitre": "Our approach",
        "h2": "Take your property investment to a <em>new level</em>",
        "lead": "A property investment doesn't end with the purchase.",
        "p1": ("Fit-out, furniture and equipment account for a large share of the budget needed to prepare a "
               "property for rental or resale."),
        "citation": "At LabelMaison, we believe you can combine aesthetics, quality and cost control.",
        "p2": ("That is why we help investors find manufacturers directly in China, particularly for kitchens, "
               "bathrooms and furniture."),
        "p3": ("Our approach: find solutions suited to your project, compare offers and support you through each "
               "stage of the supply process."),
    },
    "local": {
        "surtitre": "Dubai and international",
        "h2": "Investing from abroad? We work remotely",
        "paras": [
            "Many of our clients invest in a property they do not live next to: a villa or an apartment in Dubai, "
            "a flat in Paris, a riad in Marrakech.",
            "Everything starts on WhatsApp: you present your property, your needs and your budget, and we review "
            "the sourcing options with Chinese manufacturers.",
            "Shipping, customs clearance and delivery terms are defined for each destination according to the "
            "products, volumes and contractual arrangements.",
        ],
        "cartes": [
            ("complet", "Villas in Dubai", "Kitchen, bathrooms, bedrooms and living areas in one consistent "
                                           "process."),
            ("cuisine", "Apartments in Paris", "Bespoke kitchens and storage built to exact measurements."),
            ("renovation", "Riads in Marrakech", "Local craftsmanship combined with sourced fittings."),
            ("mobilier", "Holiday homes", "Furniture designed for short-term rental."),
        ],
        "liens_titre": "Label Maison in Dubai (pages in French)",
        "liens": [("Property investment in Dubai", "/investissement-immobilier-dubai"),
                  ("Our concierge service in Dubai", "/conciergerie-dubai"),
                  ("China sourcing in Dubai", "/" + LOCALES["dubai"])],
    },
    "solutions": {
        "surtitre": "Kitchen · Bathroom · Furniture",
        "h2": "Our sourcing solutions",
        "items": [
            ("cuisine", "Bespoke kitchens", "Design a kitchen suited to your property, its standing and your budget.",
             ["Kitchen units and storage", "Doors and worktops", "Kitchen islands", "Sinks and taps",
              "Custom layout solutions"],
             "Request a kitchen project on WhatsApp", "cuisine"),
            ("bain", "Bathrooms", "Enhance your spaces with fittings and finishes selected from manufacturers.",
             ["Vanity units", "Showers and screens", "Bathtubs", "Taps", "Mirrors and accessories",
              "Storage solutions"],
             "Request a bathroom project on WhatsApp", "bain"),
            ("mobilier", "Furniture and decor",
             "Furnish your apartments and villas with furniture suited to your property's positioning.",
             ["Sofas and armchairs", "Beds and bedrooms", "Tables and chairs", "Lighting", "Bespoke furniture",
              "Accessories and decor"],
             "Discuss my furniture project on WhatsApp", "mobilier"),
        ],
        "large": {
            "titre": "Complete fit-out of a property",
            "paras": [
                "Buying an apartment for short-term rental, or a high-end residence you want to enhance?",
                "LabelMaison can help you find and select the equipment your project needs.",
                "From the kitchen to the furniture, we look for consistent solutions to fit out your property and "
                "keep your budget under control.",
            ],
            "cta": "Discuss my fit-out project",
            "compo": [("cuisine", "Kitchen"), ("bain", "Bathroom"), ("mobilier", "Furniture"),
                      ("complet", "Fittings")],
        },
    },
    "pourquoi": {
        "h2": "Why source directly from China?",
        "chapo": [
            "China has a major industrial ecosystem for furniture, kitchens, bathrooms and home equipment.",
            "Sourcing directly from manufacturers can open up more choice, more customisation and pricing "
            "opportunities.",
        ],
        "sous_titre": "The benefits we look for",
        "avantages": [
            ("budget", "Control your budget",
             "Compare manufacturers' offers and look for competitive alternatives to locally available solutions."),
            ("perso", "More customisation", "Explore different dimensions, finishes, materials and configurations."),
            ("centraliser", "Centralise your purchasing",
             "Group several fit-out needs into one consistent supply process."),
            ("accompagne", "Be supported",
             "One point of contact to organise the search, selection and follow-up of your project."),
        ],
        "note": ("Savings depend on the products, quantities, shipping, duties and taxes, compliance costs and "
                 "installation. They are assessed case by case."),
    },
    "methode": {
        "surtitre": "Five steps",
        "h2": "Our support: from research to your project",
        "etiquette": "Step",
        "etapes": [
            ("Understand your project",
             "We discuss your property, your needs, your budget and the level of finish you are looking for."),
            ("Find manufacturers",
             "We identify manufacturers and study the solutions that match your specifications."),
            ("Compare and select",
             "We compare proposals, technical specifications, finishes and commercial terms."),
            ("Organise inspection and supply",
             "Depending on the project and the agreed contracts, we organise the necessary checks, production "
             "follow-up and international logistics."),
            ("Prepare delivery and installation",
             "We help coordinate delivery to your property and, where agreed, put you in touch with qualified "
             "professionals for installation."),
        ],
    },
    "partenaire": {
        "h2": "A partner to grow your property <em>portfolio</em>",
        "chapo": ("LabelMaison is not simply here to help you buy furniture. Our ambition is to support you through "
                  "the different stages of your property investment."),
        "questions": [("immeuble", "Looking for an apartment to fit out?"),
                      ("plusieurs", "Already own several properties?"),
                      ("renovation", "Preparing a renovation before letting?")],
        "etude": "We can review your supply needs and the fit-out solutions suited to your strategy.",
        "devise": ["Buy smart.", "Fit out consistently.", "Get your property ready to operate."],
        "vision": "That is our vision of property support.",
        "cta": "Talk to LabelMaison on WhatsApp",
    },
    "villes": {
        "surtitre": "Where we work",
        "h2": "Paris, Dubai, Marrakech",
        "chapo": ("Sourcing adapts to each market: the property's constraints, guest expectations, logistics and "
                  "import formalities."),
        "voir": "Read the page in French",
        "cartes": [
            ("dubai", "Dubai", "Villas and apartments to equip for holiday rental or resale."),
            ("paris", "Paris", "Compact apartments and open kitchens: bespoke pieces built to exact measurements."),
            ("marrakech", "Marrakech", "Riads and villas: Moroccan craftsmanship combined with sourced fittings."),
        ],
        "autre_langue": ("Lire cette page en français", PRINCIPALE),
    },
    "faq": {
        "surtitre": "FAQ",
        "h2": "Frequently asked questions about sourcing from China",
        "cote": "Another question? Message us on WhatsApp.",
        "lien": "Ask my question on WhatsApp",
        "items": [
            ("Do you work with investors based abroad?",
             "Yes. We work remotely over WhatsApp: you present your property, your needs and your budget, and we "
             "review the sourcing options suited to your project."),
            ("Is it really cheaper to source from China?",
             "Some products can be bought on competitive terms directly from manufacturers. However, the factory "
             "price is not the final cost. Shipping, insurance, customs formalities, taxes, inspections and "
             "installation must be included in the comparison."),
            ("Which products can be sourced from China?",
             "We mainly look at kitchens, bathroom furniture, fittings, furniture, lighting and interior fit-out "
             "solutions, subject to their compliance with the requirements of the destination country."),
            ("Do you only work with property investors?",
             "We mainly work with investors and owners who want to fit out or enhance a property. Second homes and "
             "high-end residences can also be considered."),
            ("Can you fit out an entire apartment?",
             "Yes, we can review a complete project covering several product categories: kitchen, bathroom, "
             "furniture and fittings. The scope of our support is defined for each project."),
            ("How does delivery work?",
             "Shipping, insurance, customs clearance and delivery terms are defined according to the products, "
             "volumes and contractual arrangements."),
            ("Do you also offer installation?",
             "Installation can be arranged with qualified professionals. It is subject to a separate scope and "
             "quote depending on the work involved."),
            ("How do I get a quote?",
             "Contact us on WhatsApp with a description of your project, the property's location, the products you "
             "need and your estimated budget. We will then review your request."),
        ],
    },
    "final": {
        "signature": "LabelMaison — Sourcing & Property Improvement",
        "h2": "Let's talk about your <em>next investment</em>",
        "paras": [
            "Have an apartment to fit out, a villa to renovate or a property investment project?",
            "Tell us about your project. We will review the sourcing options with Chinese manufacturers and the "
            "solutions suited to your budget.",
        ],
        "cta": "Discuss my project on WhatsApp",
        "mention": ("Each project is studied individually. Prices, lead times, savings and supply terms depend on "
                    "the selected products and the contractual arrangements."),
    },
    "pied": {
        "tag": ("Kitchens, bathrooms and furniture sourced from Chinese manufacturers, for property investors and "
                "owners."),
        "col1": "China sourcing",
        "liens1": [("Version française", "/" + PRINCIPALE), ("Paris (in French)", "/" + LOCALES["paris"]),
                   ("Dubai (in French)", "/" + LOCALES["dubai"]),
                   ("Marrakech (in French)", "/" + LOCALES["marrakech"])],
        "col2": "Label Maison",
        "liens2": [("Home (in French)", "/"), ("Concierge service in Dubai", "/conciergerie-dubai"),
                   ("Concierge service in Marrakech", "/conciergerie-marrakech")],
        "col3": "Contact",
        "legal": [("Legal notice", "/mentions-legales"), ("Privacy", "/politique-de-confidentialite")],
        "aller": "Skip to content",
    },
    "wa": {
        "gabarit": "\n\nProperty location: \nProducts needed: \nEstimated budget: ",
        "projet": "Hello LabelMaison, I would like to present my China sourcing project.",
        "question": "Hello LabelMaison, I have a question about sourcing from China.",
        "cuisine": ("Hello LabelMaison, I am interested in a bespoke kitchen sourced from China."
                    "\n\nProperty location: \nRoom dimensions: \nEstimated budget: "),
        "bain": ("Hello LabelMaison, I am interested in a bathroom project sourced from China."
                 "\n\nProperty location: \nFittings needed: \nEstimated budget: "),
        "mobilier": ("Hello LabelMaison, I would like to discuss my furniture and decor project."
                     "\n\nType of property: \nRooms to furnish: \nEstimated budget: "),
        "complet": "Hello LabelMaison, I would like you to review the complete fit-out of my property.",
    },
    "ld": {
        "nom": "China sourcing for property investors",
        "type": "Sourcing of kitchens, bathrooms and furniture from China for property investors",
        "zones": [("City", "Dubai"), ("Country", "United Arab Emirates"), ("City", "Paris"), ("Country", "France"),
                  ("City", "Marrakech"), ("Country", "Morocco")],
        "offres_extra": ["Complete fit-out of a property"],
        "fil": [("Home", "/"), ("China sourcing for property", "/" + ANGLAISE)],
    },
    "hreflang": FR["hreflang"],
    "freres": ["dubai", "paris", "marrakech"],
}

PAGES = [FR, PARIS, DUBAI, MARRAKECH, EN]
