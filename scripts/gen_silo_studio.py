# -*- coding: utf-8 -*-
"""Silo SEO « Label Maison Studio » : idées déco et relooking en version luxe.

Cible : les recherches d'idées de décoration (chambre, salon, style hôtel,
haussmannien, home staging virtuel…). Chaque page apporte des conseils
concrets puis envoie vers /studio, où le visiteur voit SA pièce en version
luxe (aperçu gratuit, rendu HD payant).

Règles maison respectées :
  - aucun avis, note, ni statistique inventés ;
  - uniquement des photos réelles de public/images/real et le vrai
    avant/après de public/images/studio ;
  - même gabarit que les autres silos (/css/seo-silo.css).

Lancer :  python3 scripts/gen_silo_studio.py
Puis   :  python3 scripts/build_seo_index.py   (sitemaps + vercel.json)
"""
from __future__ import annotations

import seo_common as C

STUDIO = "/studio"
AVANT = "studio/exemple-avant.jpg"
APRES = "studio/exemple-apres.jpg"

NAV = [
    ("Le studio", STUDIO),
    ("Propriétaires", "/proprietaires"),
    ("Conciergerie Paris", "/conciergerie-privee-paris"),
    ("Contact", "#contact-form"),
]

FOOTER_COLS = [
    ("Le studio", [
        ("Composer mon rendu", STUDIO),
        ("Idée déco chambre luxe", "/idee-deco-chambre-luxe"),
        ("Chambre style hôtel de luxe", "/chambre-style-hotel-de-luxe"),
        ("Home staging virtuel", "/home-staging-virtuel"),
        ("Avant/après décoration", "/avant-apres-decoration-interieure"),
    ]),
    ("Conciergerie", [
        ("Gestion locative Paris", "/gestion-locative-paris"),
        ("Conciergerie privée Paris", "/conciergerie-privee-paris"),
        ("Estimation de rentabilité", "/estimation-rentabilite-airbnb"),
        ("Devenir propriétaire partenaire", "/proprietaires"),
    ]),
]


def bloc_avant_apres(titre: str, lead: str) -> str:
    """Le vrai avant/après produit par le studio, sur une photo de bien géré."""
    img = ("width:100%;max-width:330px;height:auto;border-radius:16px;"
           "display:block;margin:0 auto")
    cap = "margin-top:10px;text-align:center;font-size:14px"
    alt_avant = ("Séjour avant mise en valeur, photo réelle d&#39;un logement géré par "
                 "Label Maison Conciergerie")
    alt_apres = "Le même séjour en rendu Label Maison Studio, ambiance contemporain chic"
    return f"""<section class="wrap"><h2>{titre}</h2><p class="lead">{lead}</p>
<div class="grid g2" style="margin-top:28px;gap:22px">
<figure style="margin:0"><img src="/images/{AVANT}" alt="{alt_avant}" loading="lazy" decoding="async" width="676" height="1200" style="{img}"><figcaption style="{cap}">Avant — la photo brute du propriétaire.</figcaption></figure>
<figure style="margin:0"><img src="/images/{APRES}" alt="{alt_apres}" loading="lazy" decoding="async" width="900" height="1609" style="{img}"><figcaption style="{cap}">Après — le rendu du studio : mêmes murs, même porte, même point de vue. Rendu à titre indicatif, non contractuel.</figcaption></figure>
</div></section>"""


def bloc_cta(titre: str, texte: str, bouton: str = "Composer mon rendu gratuit") -> str:
    return f"""<section class="wrap" id="studio-cta"><div class="band">
<div class="grid g2" style="gap:26px;align-items:center">
<div>
<h2>{titre}</h2>
<p style="color:rgba(255,255,255,.88)">{texte}</p>
<p style="color:rgba(255,255,255,.72);font-size:14px">Aperçu gratuit · rendu HD et vidéo avant/après à 9,99 € en paiement unique, sans abonnement.</p>
<a class="btn gold" href="{STUDIO}">{C.esc(bouton)}</a>
</div>
<div class="formcard" style="padding:10px">
<img src="/images/{APRES}" alt="Exemple de rendu Label Maison Studio" loading="lazy" decoding="async" width="900" height="1609" style="width:100%;max-width:300px;height:auto;border-radius:12px;display:block;margin:0 auto">
</div>
</div>
</div></section>"""


def mobcta_studio() -> str:
    return (f'<div class="mobcta"><a class="btn ghost" href="tel:{C.TEL_URI}">Appeler</a>'
            f'<a class="btn" href="{STUDIO}">Voir ma pièce en luxe</a></div>')


def liens_silo(slug_courant: str) -> list:
    return [(titre, url) for url, titre in LIENS if url != "/" + slug_courant]


def construire(p: dict) -> None:
    slug = p["slug"]
    path = "/" + slug
    trail = [("Accueil", "/"), ("Label Maison Studio", STUDIO), (p["fil"], path)]

    jsonlds = [
        C.ld_breadcrumb(trail),
        C.ld_faq(p["faq"]),
        {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": p["title"],
            "description": p["desc"],
            "url": C.SITE + path,
            "inLanguage": "fr-FR",
            "isPartOf": {"@type": "WebSite", "name": "Label Maison Conciergerie",
                         "url": C.SITE},
            "primaryImageOfPage": {"@type": "ImageObject", "url": f"{C.SITE}/images/{APRES}"},
            "about": {"@type": "Thing", "name": p["about"]},
        },
    ]

    parts = [
        C.head(p["title"], p["desc"], path, jsonlds, image=f"{C.SITE}/images/{APRES}"),
        C.header(NAV),
        # Le bouton principal du hero mène au studio (et non au formulaire de
        # contact, cible par défaut du gabarit des silos).
        C.hero(p["badge"], p["h1"], p["sub"], p["photo"], p["photo_alt"], p["puces"],
               cta1="Voir ma pièce en version luxe", cta2="Nous appeler")
        .replace('href="#contact-form"', f'href="{STUDIO}"', 1),
        ('<p class="wrap disc" style="margin-top:-8px">Image d\u2019illustration : rendu produit '
         'par Label Maison Studio \u00e0 partir de la photo d\u2019un logement que nous g\u00e9rons. '
         'Rendu \u00e0 titre indicatif, non contractuel.</p>' if p.get("photo_rendu") else ""),
        C.crumb(trail),
        C.texte(p["intro"], lead=p["lead"]),
        C.cartes(p["cartes_titre"], p["cartes_lead"], p["cartes"], cols="g3"),
        bloc_cta(p["cta_titre"], p["cta_texte"]),
        bloc_avant_apres(p["ba_titre"], p["ba_lead"]),
        C.etapes("Comment obtenir le rendu de votre pièce", [
            ("1. La photo", "Prenez la pièce en entier, de préférence de jour, depuis un angle "
                            "qui montre les fenêtres. Une photo au téléphone suffit."),
            ("2. L'ambiance", "Contemporain chic, haussmannien, bohème doux ou minimaliste "
                              "lumineux — et un champ libre pour vos envies précises."),
            ("3. L'aperçu", "En une trentaine de secondes, le rendu s'affiche en aperçu gratuit, "
                            "flouté et filigrané."),
            ("4. Le rendu HD", "9,99 € en paiement unique pour l'image haute définition sans "
                               "filigrane et la vidéo avant/après verticale."),
        ]),
        C.texte(p["conseils"], titre=p["conseils_titre"]),
        C.zones("À lire aussi", "D'autres idées dans le même esprit, pièce par pièce et style "
                                "par style.", liens_silo(slug)),
        C.faq("Questions fréquentes", p["faq"]),
        C.formulaire(
            "Ce logement, vous le louez ou vous comptez le louer ?",
            "Au-delà du rendu, notre métier est la gestion locative courte durée : annonce, "
            "photos, tarification, voyageurs, ménage. Dites-nous où se trouve le bien, nous "
            "vous répondons avec une estimation de revenus.",
            p.get("ville", "France"), "Estimation location courte durée", p["title"]),
        C.footer(FOOTER_COLS,
                 "Votre patrimoine, géré comme une maison de confiance.",
                 "Paris · Dubaï · Marrakech"),
        mobcta_studio(),
    ]
    chemin = C.write(slug, parts)
    print(f"  {chemin.relative_to(C.ROOT)}")


# =============================================================================
# Les pages du silo
# =============================================================================
LIENS = [
    ("/idee-deco-chambre-luxe", "Idée déco chambre luxe"),
    ("/relooker-sa-chambre-sans-travaux", "Relooker sa chambre sans travaux"),
    ("/chambre-style-hotel-de-luxe", "Chambre style hôtel de luxe"),
    ("/idee-deco-salon-luxe", "Idée déco salon luxe"),
    ("/decoration-style-haussmannien", "Décoration style haussmannien"),
    ("/home-staging-virtuel", "Home staging virtuel"),
    ("/simulateur-decoration-interieure-ia", "Simulateur de décoration par IA"),
    ("/avant-apres-decoration-interieure", "Avant/après décoration intérieure"),
    ("/ameliorer-photos-annonce-airbnb", "Améliorer les photos d'une annonce"),
]

PAGES = [
    {
        "slug": "idee-deco-chambre-luxe",
        "fil": "Idée déco chambre luxe",
        "title": "Idée déco chambre luxe : 12 pistes concrètes (et le rendu de VOTRE chambre)",
        "desc": "Des idées de décoration pour une chambre au style luxe : matières, lumière, "
                "literie, rangements. Et un studio qui vous montre votre propre chambre en "
                "version luxe à partir d'une photo.",
        "badge": "Décoration · Chambre",
        "h1": "Idée déco chambre luxe : <em>ce qui change tout</em>",
        "sub": "Les partis pris qui font basculer une chambre ordinaire dans le haut de gamme — "
               "puis le rendu de votre chambre à vous, à partir d'une simple photo.",
        "photo": "studio/hero-chambre.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : chambre en ambiance contemporain chic",
        "puces": ["Conseils concrets", "Sans travaux lourds", "Rendu de votre pièce en 30 s"],
        "about": "Décoration de chambre haut de gamme",
        "ville": "France",
        "lead": "Le luxe en chambre ne tient presque jamais au budget mobilier. Il tient à trois "
                "choses : la lumière, les matières, et la discipline du rangement.",
        "intro": [
            "Une chambre coûteuse peut paraître banale, et une chambre modeste peut respirer "
            "l'hôtel cinq étoiles. La différence se joue sur des détails reproductibles : une "
            "tête de lit qui occupe toute la largeur du mur, un linge de lit blanc repassé, "
            "deux sources de lumière chaude plutôt qu'un plafonnier, et un sol qui ne renvoie "
            "pas le bruit.",
            "Nous préparons des chambres toute l'année pour des voyageurs exigeants : voici ce "
            "qui produit le plus d'effet, dans l'ordre, quand on ne veut ni casser un mur ni "
            "vider son compte en banque.",
        ],
        "cartes_titre": "Douze idées qui font basculer une chambre dans le luxe",
        "cartes_lead": "Classées par impact visuel, de la plus rentable à la plus fine.",
        "cartes": [
            ("Une tête de lit pleine largeur",
             "C'est le geste le plus spectaculaire. Lin, velours côtelé ou bois cannelé, "
             "montée jusqu'à 120 cm de haut : le lit cesse d'être un meuble posé là, il "
             "devient l'architecture de la pièce."),
            ("Du blanc, mais du vrai blanc",
             "Linge de lit blanc, percale ou satin de coton, repassé. Le blanc net est le "
             "code hôtelier le plus immédiat — et le moins cher à tenir dans le temps."),
            ("Trois sources de lumière, zéro plafonnier",
             "Deux liseuses ou appliques de chaque côté du lit, une lampe d'appoint, "
             "ampoules en 2 700 K. La lumière rasante et chaude sculpte la pièce ; "
             "le plafonnier l'aplatit."),
            ("Des rideaux qui touchent le sol",
             "Posés au ras du plafond et tombant au millimètre du parquet, en lin lourd ou "
             "velours. Ils agrandissent la hauteur sous plafond, étouffent l'écho et cachent "
             "les menuiseries fatiguées."),
            ("Un tapis plus grand que prévu",
             "Il doit passer sous le lit et dépasser d'au moins 60 cm de chaque côté. Un petit "
             "tapis au pied du lit fait toujours l'effet inverse de celui recherché."),
            ("Une palette de trois valeurs",
             "Un fond clair, une matière chaude (noyer, laiton, camel), une touche profonde "
             "(vert sapin, brun tabac). Au-delà de trois, la chambre devient bavarde."),
            ("Des tables de chevet asymétriques mais alignées",
             "Deux chevets différents, à la même hauteur que le matelas : l'effet est plus "
             "décorateur qu'un duo identique sorti du même carton."),
            ("Le dressing fermé",
             "Rien ne casse le haut de gamme comme une penderie ouverte. Portes pleines, "
             "poignées discrètes, et la pièce se calme instantanément."),
            ("Un miroir, bien placé",
             "Face à la fenêtre pour doubler la lumière, jamais face au lit. Grand format, "
             "cadre fin, posé au sol si la hauteur le permet."),
            ("Des matières qui se touchent",
             "Bouclette, lin lavé, laine bouillie : trois textures suffisent pour que l'œil "
             "lise la pièce comme chaleureuse plutôt que froide."),
            ("Zéro câble visible",
             "Chargeurs, multiprises, box : tout disparaît. C'est le détail qui sépare une "
             "chambre publiable d'une chambre habitée."),
            ("Une plante, une seule",
             "Un olivier, un ficus lyrata ou un eucalyptus en pot terre cuite. Le vert vivant "
             "évite l'effet showroom."),
        ],
        "cta_titre": "Et votre chambre, ça donnerait quoi ?",
        "cta_texte": "Photographiez-la telle qu'elle est, choisissez une ambiance, et voyez la "
                     "même pièce en version luxe : mêmes murs, mêmes fenêtres, même point de vue.",
        "ba_titre": "Un vrai avant/après, pas une image de catalogue",
        "ba_lead": "Voici un séjour d'un logement que nous gérons, puis le rendu produit par le "
                   "studio en ambiance contemporain chic.",
        "conseils_titre": "Les erreurs qui trahissent une chambre « déco »",
        "conseils": [
            "<strong>Trop de coussins.</strong> Au-delà de quatre, on ne voit plus le lit, on "
            "voit un empilement. Deux oreillers, deux coussins, un plaid replié en biais.",
            "<strong>Un éclairage froid.</strong> Les ampoules au-delà de 3 000 K donnent un "
            "teint d'hôpital aux boiseries et aux textiles. C'est l'erreur la plus fréquente, "
            "et la moins chère à corriger.",
            "<strong>Des cadres trop petits, trop haut.</strong> Un grand format unique, centré "
            "à hauteur d'œil, vaut mieux qu'une constellation de petits cadres.",
            "<strong>Le mobilier collé aux murs.</strong> Décoller le lit du mur de quelques "
            "centimètres et laisser respirer les angles suffit à donner de l'ampleur.",
        ],
        "faq": [
            ("Combien coûte une chambre au style luxe ?",
             "Les gestes les plus efficaces — linge blanc, ampoules chaudes, rideaux au sol, "
             "grand tapis — coûtent quelques centaines d'euros. La tête de lit sur mesure est "
             "le poste le plus lourd, et le plus rentable visuellement."),
            ("Peut-on obtenir ce style en location ?",
             "Oui : tout ce qui précède est démontable. Tête de lit posée, rideaux sur tringle "
             "amovible, tapis, luminaires à brancher. Rien n'exige l'accord du propriétaire."),
            ("Le rendu du studio est-il réaliste ?",
             "Il conserve l'architecture de votre pièce : mêmes murs, mêmes ouvertures, même "
             "cadrage. Seuls les finitions, le mobilier et la lumière changent. Il est fourni "
             "à titre indicatif et non contractuel."),
            ("Que se passe-t-il après le rendu ?",
             "Rien d'obligatoire. Si le logement est destiné à la location courte durée, nous "
             "pouvons estimer ses revenus et en assurer la gestion complète."),
        ],
    },
    {
        "slug": "relooker-sa-chambre-sans-travaux",
        "fil": "Relooker sa chambre sans travaux",
        "title": "Relooker sa chambre sans travaux : la méthode en un week-end",
        "desc": "Transformer une chambre sans percer ni peindre : ordre des opérations, budget, "
                "pièges. Et un aperçu de votre chambre relookée à partir d'une photo.",
        "badge": "Sans travaux · Un week-end",
        "h1": "Relooker sa chambre <em>sans travaux</em>",
        "sub": "Pas de peinture, pas de perceuse, pas d'autorisation à demander : la méthode que "
               "nous appliquons avant une mise en location.",
        "photo": "studio/hero-chambre-claire.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : chambre relookée en minimaliste lumineux",
        "puces": ["Zéro percement", "Compatible location", "Budget maîtrisé"],
        "about": "Relooking de chambre sans travaux",
        "lead": "Un week-end, trois livraisons et un peu de méthode suffisent pour changer une "
                "chambre du tout au tout — sans toucher au bâti.",
        "intro": [
            "Quand nous reprenons un bien, nous n'avons ni le temps ni le droit d'entamer des "
            "travaux. Tout se joue donc sur le mobilier léger, les textiles et la lumière. "
            "L'ordre des opérations compte autant que les achats.",
            "La règle : on vide, on nettoie la lumière, on habille les fenêtres, puis seulement "
            "on décore. Faire l'inverse revient à poser de jolis objets dans une pièce qui "
            "restera terne.",
        ],
        "cartes_titre": "L'ordre des opérations",
        "cartes_lead": "Chaque étape prépare la suivante ; en sauter une se voit sur la photo.",
        "cartes": [
            ("1. Vider, vraiment",
             "Sortez tout ce qui n'est ni le lit, ni les chevets, ni une lampe. La pièce nue "
             "révèle ses proportions et ses vrais défauts."),
            ("2. Refaire la lumière",
             "Remplacez toutes les ampoules par du 2 700 K, ajoutez deux liseuses de chevet et "
             "coupez le plafonnier. Coût dérisoire, effet immédiat."),
            ("3. Habiller la fenêtre",
             "Tringle posée au plus près du plafond, rideaux tombant au sol. Sur tringle à "
             "pince ou barre de tension si le percement est interdit."),
            ("4. Le grand tapis",
             "Il structure la pièce et absorbe le bruit. Sous le lit, débordant largement."),
            ("5. La tête de lit posée",
             "Modèle autoportant, calé entre le mur et le sommier : pas une vis, et la chambre "
             "change d'échelle."),
            ("6. Le linge",
             "Housse blanche repassée, plaid en laine, deux textures de coussins. C'est ce que "
             "l'œil lit en premier sur une photo."),
        ],
        "cta_titre": "Testez le relooking avant d'acheter quoi que ce soit",
        "cta_texte": "Envoyez la photo de votre chambre : le studio vous montre le résultat "
                     "possible avant que vous ne dépensiez le moindre euro en mobilier.",
        "ba_titre": "Le principe, sur un cas réel",
        "ba_lead": "Même pièce, même cadrage, même lumière naturelle : seuls le mobilier et les "
                   "matières changent.",
        "conseils_titre": "Budget : où mettre l'argent, où ne pas en mettre",
        "conseils": [
            "<strong>Mettez-en</strong> dans le linge de lit, les rideaux et l'éclairage. Ce "
            "sont les trois postes que l'œil — et l'appareil photo — perçoivent en premier.",
            "<strong>N'en mettez pas</strong> dans les petits objets décoratifs. Ils encombrent "
            "la photo et n'apportent rien à la perception d'ensemble.",
            "<strong>Achetez d'occasion</strong> le mobilier en bois massif : un chevet chiné "
            "vaut mieux qu'un neuf en panneau mélaminé, à budget égal.",
            "<strong>Louez le style, pas la marque.</strong> Personne ne reconnaît une "
            "référence de designer sur une photo ; tout le monde voit une pièce bien éclairée.",
        ],
        "faq": [
            ("Combien de temps faut-il vraiment ?",
             "Un samedi pour vider, nettoyer et refaire la lumière ; un dimanche pour poser "
             "rideaux, tapis, tête de lit et linge. Les livraisons sont le vrai facteur "
             "limitant."),
            ("Mon propriétaire peut-il s'y opposer ?",
             "Tant que rien n'est percé ni peint, vous restez dans votre droit de locataire. "
             "Une barre de tension ou une tringle autoportante évite tout litige."),
            ("Faut-il repeindre les murs ?",
             "Rarement. Un mur blanc légèrement fatigué disparaît derrière des rideaux et une "
             "lumière chaude. La peinture n'arrive qu'en dernier recours."),
        ],
    },
    {
        "slug": "chambre-style-hotel-de-luxe",
        "fil": "Chambre style hôtel de luxe",
        "title": "Chambre style hôtel de luxe : les codes, appliqués chez vous",
        "desc": "Literie, lumière, rangement, senteurs : les codes des chambres d'hôtel haut de "
                "gamme, transposables chez soi. Et le rendu de votre chambre en version hôtel.",
        "badge": "Codes hôteliers",
        "h1": "Une chambre <em>digne d'un hôtel</em>",
        "sub": "Ce que les palaces font systématiquement, et que l'on peut refaire chez soi pour "
               "une fraction du budget.",
        "photo": "studio/hero-suite.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : chambre mise en scène comme une suite d'hôtel",
        "puces": ["Literie", "Lumière", "Rangement invisible"],
        "about": "Chambre de style hôtelier",
        "lead": "Une chambre d'hôtel ne cherche pas à être originale : elle cherche à être "
                "impeccable. C'est toute la différence.",
        "intro": [
            "Les palaces ne décorent pas, ils standardisent. Draps blancs, lumière chaude, "
            "surfaces libres, odeur neutre : l'émotion vient de la perfection d'exécution, pas "
            "de l'accumulation d'idées.",
            "Bonne nouvelle pour un particulier : ces codes sont peu coûteux et parfaitement "
            "reproductibles dans une chambre ordinaire.",
        ],
        "cartes_titre": "Les sept codes hôteliers",
        "cartes_lead": "À appliquer à la lettre, ils fonctionnent ensemble.",
        "cartes": [
            ("Un lit sur-dimensionné",
             "L'hôtel met toujours le plus grand lit que la pièce accepte, avec 60 cm de "
             "circulation de chaque côté. Le confort perçu explose."),
            ("Le protège-matelas et le surmatelas",
             "L'épaisseur du couchage est ce que le client retient. C'est aussi ce qui se voit "
             "en photo : un lit haut et plein."),
            ("Le blanc, toujours",
             "Blanc pour les draps, blanc pour les serviettes. Il se lave à haute température, "
             "se remplace à l'unité, et signale l'hygiène."),
            ("Les tables de chevet vides",
             "Une lampe, un plateau, rien d'autre. Le vide est un luxe."),
            ("La lumière pilotée",
             "Un interrupteur au lit, des liseuses orientables, un éclairage indirect. On doit "
             "pouvoir tout éteindre sans se lever."),
            ("Le rangement fermé",
             "Placards à portes pleines, valise rangée, cintres identiques. L'ordre visuel est "
             "la moitié du travail."),
            ("Une odeur discrète",
             "Linge propre, bois de cèdre, figue : une seule note, jamais parfumée à l'excès."),
        ],
        "cta_titre": "Votre chambre en version hôtel, en trente secondes",
        "cta_texte": "Le studio applique ces codes à votre propre chambre et vous montre le "
                     "résultat sur votre photo, pas sur une image de catalogue.",
        "ba_titre": "Ce que produit le studio",
        "ba_lead": "Une pièce réelle, un rendu crédible : l'architecture ne bouge pas.",
        "conseils_titre": "Et pour une chambre louée en courte durée",
        "conseils": [
            "Les codes hôteliers sont aussi une stratégie de rendement : ils rassurent sur "
            "l'hygiène, se photographient bien et réduisent les commentaires négatifs.",
            "Prévoyez trois jeux de linge par lit : un en place, un au lavage, un en réserve. "
            "C'est la condition d'un enchaînement de séjours sans accroc.",
            "Un logement qui respecte ces codes se relouera toujours mieux qu'un logement "
            "décoré mais approximatif. Si vous envisagez la location, nous pouvons estimer les "
            "revenus de votre bien et en assurer la gestion complète.",
        ],
        "faq": [
            ("Faut-il obligatoirement du blanc ?",
             "Pour le linge, oui : c'est le seul textile qui se désinfecte sans se décolorer. "
             "Le reste de la palette peut être chaud et coloré."),
            ("Quelle taille de lit privilégier ?",
             "160 cm dès que la pièce dépasse 11 m², à condition de garder 60 cm de passage "
             "d'au moins un côté."),
            ("Le studio propose-t-il cette ambiance ?",
             "Oui : l'ambiance « Contemporain chic » en reprend les codes, et le champ libre "
             "permet de demander explicitement une chambre de style hôtelier."),
        ],
    },
    {
        "slug": "idee-deco-salon-luxe",
        "fil": "Idée déco salon luxe",
        "title": "Idée déco salon luxe : composer une pièce de réception qui tient debout",
        "desc": "Canapé, tapis, lumière, circulation : les principes d'un salon haut de gamme, "
                "et le rendu de votre propre salon en version luxe à partir d'une photo.",
        "badge": "Décoration · Salon",
        "h1": "Un salon <em>de réception</em>, pas un salon d'appoint",
        "sub": "Les règles de composition qui font qu'une pièce de vie paraît pensée, et non "
               "meublée au fil des achats.",
        "photo": "studio/hero-salon.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : séjour en ambiance contemporain chic",
        "puces": ["Composition", "Circulation", "Matières"],
        "about": "Décoration de salon haut de gamme",
        "lead": "Un salon réussi se lit en une seconde : on voit où s'asseoir, où poser un verre "
                "et où va le regard.",
        "intro": [
            "La plupart des salons échouent sur un point : le mobilier est aligné contre les "
            "murs, et le centre reste vide. On obtient une salle d'attente, pas une pièce de "
            "réception.",
            "Composer un salon, c'est dessiner une conversation : deux assises qui se font face "
            "ou se répondent en L, une table basse à portée de main, un tapis qui tient "
            "l'ensemble, et un point de mire assumé.",
        ],
        "cartes_titre": "Huit principes de composition",
        "cartes_lead": "Valables du studio parisien à la villa.",
        "cartes": [
            ("Décollez le canapé du mur",
             "Même de dix centimètres. L'ombre derrière le dossier crée la profondeur."),
            ("Un tapis qui porte les pieds avant",
             "Les pieds avant de chaque assise doivent reposer dessus, sinon le tapis flotte "
             "et la pièce se fragmente."),
            ("Une table basse à hauteur d'assise",
             "Deux à cinq centimètres sous le coussin, et à quarante centimètres du canapé."),
            ("Un point de mire unique",
             "Cheminée, grande toile, meuble bas en noyer : un seul, sinon le regard hésite."),
            ("Des assises dépareillées",
             "Un canapé, deux fauteuils différents : l'ensemble paraît constitué dans le temps, "
             "jamais acheté en lot."),
            ("De la lumière basse",
             "Lampadaire liseuse, lampe à poser, applique : trois points bas valent mieux qu'un "
             "plafonnier central."),
            ("Des rideaux hauts",
             "Tringle au plafond, tissu au sol : le plafond paraît dix centimètres plus haut."),
            ("Un rangement fermé",
             "Buffet ou meuble bas plein. Les étagères ouvertes demandent une discipline que "
             "personne ne tient."),
        ],
        "cta_titre": "Et votre salon, en version luxe ?",
        "cta_texte": "Une photo depuis l'angle de la pièce, une ambiance, et vous voyez ce que "
                     "votre salon peut devenir sans changer un mur.",
        "ba_titre": "Un salon réel, avant et après",
        "ba_lead": "Le rendu conserve la porte, la climatisation, la cuisine ouverte et le "
                   "cadrage d'origine.",
        "conseils_titre": "Les trois erreurs de salon les plus fréquentes",
        "conseils": [
            "<strong>Le tapis trop petit.</strong> C'est l'erreur numéro un. Mieux vaut pas de "
            "tapis du tout qu'un format qui rétrécit la pièce.",
            "<strong>Le mur d'écran.</strong> Un téléviseur nu sur un mur clair capte tout le "
            "regard. Intégrez-le à un meuble bas ou entourez-le de matière sombre.",
            "<strong>L'éclairage unique.</strong> Un plafonnier central écrase les volumes et "
            "durcit les visages. Multipliez les sources basses et chaudes.",
        ],
        "faq": [
            ("Comment aménager un salon tout en longueur ?",
             "En deux zones : conversation près de la fenêtre, rangement ou bureau au fond, "
             "séparées par un tapis et un changement de luminaire."),
            ("Quel budget pour un salon haut de gamme ?",
             "Le canapé et le tapis concentrent l'essentiel. Le reste peut être chiné : c'est "
             "même préférable, le mélange d'époques évite l'effet showroom."),
            ("Le rendu peut-il changer la disposition ?",
             "Il conserve l'architecture — murs, ouvertures, cadrage — mais propose un autre "
             "mobilier et une autre mise en scène."),
        ],
    },
    {
        "slug": "decoration-style-haussmannien",
        "fil": "Décoration style haussmannien",
        "title": "Décoration style haussmannien : les codes d'un appartement parisien",
        "desc": "Moulures, parquet chevrons, cheminée, hauteur sous plafond : comment jouer le "
                "style haussmannien sans pastiche, et voir votre pièce en version haussmannienne.",
        "badge": "Style · Paris",
        "h1": "Le style <em>haussmannien</em>, sans pastiche",
        "sub": "Ce qui fait l'élégance parisienne : la hauteur, la lumière, le parquet — et "
               "beaucoup de retenue.",
        "photo": "studio/hero-haussmannien.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : chambre en ambiance haussmannienne",
        "puces": ["Moulures", "Parquet chevrons", "Retenue"],
        "about": "Décoration haussmannienne",
        "lead": "L'appartement haussmannien n'a pas besoin qu'on en rajoute : il demande qu'on "
                "le dégage.",
        "intro": [
            "Un haussmannien bien décoré est souvent un haussmannien vidé. Les moulures, la "
            "cheminée et le parquet portent déjà le décor ; le mobilier n'a plus qu'à leur "
            "laisser la place.",
            "Le piège inverse — l'accumulation de dorures et de velours — produit un pastiche "
            "de brasserie. Les meilleurs intérieurs parisiens tranchent : bâti classique, "
            "mobilier contemporain.",
        ],
        "cartes_titre": "Les codes, et comment les tenir",
        "cartes_lead": "Six repères pour rester juste.",
        "cartes": [
            ("Le parquet en point de Hongrie",
             "Chevrons ou point de Hongrie, huilé plutôt que vitrifié. C'est la signature de "
             "la pièce : on le laisse visible, tapis compris."),
            ("Les moulures rehaussées",
             "Même blanc que le mur, en finition légèrement plus satinée. Les peindre d'une "
             "couleur contrastée date instantanément la pièce."),
            ("La cheminée conservée",
             "Même condamnée : tablette marbre, miroir trumeau, rien dessus ou presque."),
            ("Des rideaux jusqu'au plafond",
             "La hauteur sous plafond est l'atout du bâti : la tringle se pose au plus haut, "
             "le tissu tombe au sol."),
            ("Un mobilier contemporain",
             "Une assise de facture moderne dans une pièce classique produit la tension juste. "
             "Le total look ancien, non."),
            ("Le laiton, avec parcimonie",
             "Poignées, applique, pied de lampe. Le laiton se dose comme un bijou : deux ou "
             "trois occurrences par pièce."),
        ],
        "cta_titre": "Votre pièce en version haussmannienne",
        "cta_texte": "L'ambiance « Haussmannien » du studio applique ces codes à votre propre "
                     "pièce, sans déplacer un mur ni une fenêtre.",
        "ba_titre": "Ce que produit le studio",
        "ba_lead": "Même pièce, même point de vue : seules les matières et la mise en scène "
                   "changent.",
        "conseils_titre": "Quand le bâti n'est pas haussmannien",
        "conseils": [
            "Dans un immeuble récent, le style se rejoue par le sol et les textiles : parquet "
            "clair posé à bâtons rompus, rideaux hauts, miroir à cadre fin, assises galbées.",
            "Évitez les fausses moulures collées sous 2,50 m de plafond : elles écrasent la "
            "pièce au lieu de l'anoblir.",
            "Le studio permet justement de tester cette transposition avant d'engager le "
            "moindre achat.",
        ],
        "faq": [
            ("Peut-on mélanger haussmannien et minimalisme ?",
             "C'est même la combinaison la plus sûre : bâti orné, mobilier sobre, palette "
             "restreinte."),
            ("Quelle couleur de mur pour un haussmannien ?",
             "Blanc cassé ou beige pierre pour laisser la lumière circuler ; une pièce sombre "
             "et profonde — bibliothèque, chambre — supporte un vert ou un brun soutenu."),
            ("Le rendu conserve-t-il les moulures existantes ?",
             "Oui, l'architecture de la pièce est préservée : le rendu habille, il ne "
             "reconstruit pas."),
        ],
    },
    {
        "slug": "home-staging-virtuel",
        "fil": "Home staging virtuel",
        "title": "Home staging virtuel : montrer le potentiel d'un bien sans le meubler",
        "desc": "Le home staging virtuel permet de présenter un logement meublé et mis en scène "
                "à partir d'une simple photo. Usages, limites, règles à respecter.",
        "badge": "Home staging",
        "h1": "Le <em>home staging virtuel</em>, mode d'emploi",
        "sub": "Montrer ce qu'une pièce peut devenir, sans louer de mobilier ni bloquer le bien "
               "pendant trois semaines.",
        "photo": "studio/hero-villa.jpg",
        "photo_rendu": False,
        "photo_alt": "Villa gérée par Label Maison Conciergerie",
        "puces": ["Sans mobilier à louer", "En quelques secondes", "Usage encadré"],
        "about": "Home staging virtuel",
        "lead": "Le home staging classique meuble réellement un logement pour le vendre ou le "
                "louer. Le home staging virtuel fait le même travail sur l'image.",
        "intro": [
            "Meubler un bien vide pour le présenter coûte cher et prend du temps : location de "
            "mobilier, manutention, remise en état. Le home staging virtuel produit le même "
            "effet de projection à partir d'une photographie.",
            "Il ne remplace pas une rénovation : il montre un potentiel. Utilisé honnêtement, "
            "c'est un outil de décision — pour un propriétaire qui hésite, pour un investisseur "
            "qui compare, pour un créateur qui veut illustrer un projet.",
        ],
        "cartes_titre": "À quoi ça sert, concrètement",
        "cartes_lead": "Quatre usages qui reviennent le plus souvent.",
        "cartes": [
            ("Se décider avant d'acheter",
             "Voir la pièce meublée dans trois styles différents évite des milliers d'euros "
             "d'erreurs de mobilier."),
            ("Convaincre un conjoint, un associé",
             "Une image vaut mieux qu'une description : la discussion porte enfin sur quelque "
             "chose de visible."),
            ("Illustrer un projet de rénovation",
             "Donner au maître d'œuvre ou à l'architecte une intention claire, pièce par pièce."),
            ("Nourrir ses réseaux",
             "La vidéo avant/après verticale est le format qui circule le mieux sur Instagram "
             "et TikTok."),
        ],
        "cta_titre": "Essayez sur votre bien",
        "cta_texte": "Une photo suffit. L'aperçu est gratuit ; le rendu HD et la vidéo "
                     "avant/après se débloquent en un paiement unique.",
        "ba_titre": "Un exemple produit par le studio",
        "ba_lead": "La photo brute d'un logement que nous gérons, puis son rendu.",
        "conseils_titre": "Les règles à respecter",
        "conseils": [
            "<strong>Ne jamais présenter un rendu comme l'état réel du bien</strong> dans une "
            "annonce de vente ou de location. C'est une pratique trompeuse, et c'est interdit "
            "par nos conditions d'utilisation.",
            "<strong>Toujours mentionner qu'il s'agit d'une projection.</strong> La formule "
            "« rendu à titre indicatif, non contractuel » doit accompagner l'image.",
            "<strong>Rester crédible.</strong> Un rendu qui déplace des murs ou invente une vue "
            "ne convainc personne et dessert le projet. Le studio conserve volontairement "
            "l'architecture existante.",
        ],
        "faq": [
            ("Quelle différence avec le home staging classique ?",
             "Le staging classique meuble réellement le logement ; le staging virtuel meuble "
             "l'image. Le premier sert la visite, le second sert la décision et la projection."),
            ("Puis-je utiliser le rendu dans mon annonce ?",
             "Pas comme photo du bien. Vous pouvez l'utiliser comme projection explicitement "
             "signalée, en complément des photos réelles."),
            ("Combien de temps pour obtenir un rendu ?",
             "Une trentaine de secondes. L'aperçu est gratuit, flouté et filigrané ; le HD est "
             "délivré après paiement."),
        ],
    },
    {
        "slug": "simulateur-decoration-interieure-ia",
        "fil": "Simulateur de décoration par IA",
        "title": "Simulateur de décoration intérieure par IA : comment ça marche vraiment",
        "desc": "Comment une IA transforme la photo d'une pièce en rendu décoré : ce qu'elle "
                "sait faire, ce qu'elle ne sait pas faire, et comment obtenir un résultat juste.",
        "badge": "Outil · IA",
        "h1": "Un <em>simulateur de décoration</em> qui part de votre photo",
        "sub": "Ni plan 3D à dessiner, ni logiciel à installer : une photographie, une ambiance, "
               "un rendu.",
        "photo": "studio/hero-salle-de-bain.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : salle de bain en ambiance minimaliste",
        "puces": ["Aucun logiciel", "Photo au téléphone", "30 secondes"],
        "about": "Simulateur de décoration intérieure",
        "lead": "Les logiciels d'aménagement demandent de redessiner la pièce. Un simulateur par "
                "image part de ce qui existe déjà : votre photo.",
        "intro": [
            "Les outils classiques de décoration 3D exigent de saisir les dimensions, poser les "
            "murs, choisir des meubles dans un catalogue. Comptez plusieurs heures pour un "
            "résultat souvent froid.",
            "Un modèle d'image travaille autrement : il analyse la photographie, comprend la "
            "géométrie de la pièce et la lumière, puis reconstruit la même scène avec d'autres "
            "matières et un autre mobilier.",
        ],
        "cartes_titre": "Ce que l'outil sait faire — et ce qu'il ne sait pas faire",
        "cartes_lead": "Savoir où sont les limites évite les déceptions.",
        "cartes": [
            ("Il sait remplacer le mobilier",
             "Canapé, lit, tables, textiles, luminaires, tapis : tout ce qui est posé dans la "
             "pièce peut changer."),
            ("Il sait retravailler la lumière",
             "Chaleur, direction, douceur des ombres : c'est souvent ce qui fait la différence "
             "la plus visible."),
            ("Il sait changer les finitions",
             "Sol, teinte des murs, menuiseries : les surfaces se réinterprètent sans que la "
             "géométrie bouge."),
            ("Il ne déplace pas les murs",
             "Par choix : un rendu qui invente une ouverture ne sert à rien pour décider."),
            ("Il n'est pas un devis",
             "Aucun chiffrage de travaux n'est attaché au rendu ; c'est une intention visuelle."),
            ("Il n'invente pas une vue",
             "Ce qu'on voit par la fenêtre reste ce que votre fenêtre montre."),
        ],
        "cta_titre": "Faites l'essai maintenant",
        "cta_texte": "Photo, ambiance, champ libre pour vos envies : l'aperçu s'affiche en une "
                     "trentaine de secondes, gratuitement.",
        "ba_titre": "Un rendu produit par le studio",
        "ba_lead": "À gauche la photo d'origine, à droite le rendu : l'architecture est "
                   "conservée.",
        "conseils_titre": "Comment obtenir un bon rendu",
        "conseils": [
            "<strong>Photographiez de jour</strong>, sans flash, en tenant l'appareil droit. "
            "Une photo penchée donne un rendu penché.",
            "<strong>Cadrez large</strong> : montrez deux murs et une fenêtre si possible. Un "
            "gros plan sur un meuble ne laisse rien à transformer.",
            "<strong>Rangez d'abord.</strong> Le modèle reproduit ce qu'il comprend de la "
            "pièce ; une pièce encombrée brouille sa lecture.",
            "<strong>Utilisez le champ libre</strong> pour préciser vos envies : « canapé "
            "beige », « plus de lumière », « touches de laiton ». C'est ce qui personnalise "
            "le résultat.",
        ],
        "faq": [
            ("Faut-il installer un logiciel ?",
             "Non, tout se passe dans le navigateur, y compris sur téléphone."),
            ("Mes photos sont-elles réutilisées ?",
             "Elles servent uniquement à produire votre rendu. Elles ne sont ni revendues, ni "
             "publiées ; le détail figure dans nos conditions."),
            ("Quelle différence avec un décorateur ?",
             "Un décorateur conçoit, sélectionne et suit un chantier. Le simulateur donne une "
             "direction visuelle en trente secondes, pour quelques euros."),
        ],
    },
    {
        "slug": "avant-apres-decoration-interieure",
        "fil": "Avant/après décoration intérieure",
        "title": "Avant/après décoration intérieure : fabriquer le vôtre à partir d'une photo",
        "desc": "Pourquoi l'avant/après convainc, comment le réussir, et comment obtenir le "
                "vôtre — image HD et vidéo verticale — à partir d'une photo de votre pièce.",
        "badge": "Avant / après",
        "h1": "L'<em>avant/après</em> qui rend le potentiel évident",
        "sub": "Le format le plus convaincant en décoration : la même pièce, deux états, un seul "
               "coup d'œil.",
        "photo": "studio/hero-terrasse.jpg",
        "photo_rendu": False,
        "photo_alt": "Terrasse d'un logement géré par Label Maison Conciergerie",
        "puces": ["Image HD", "Vidéo 9:16", "Même cadrage"],
        "about": "Avant/après en décoration intérieure",
        "lead": "Un avant/après ne fonctionne qu'à une condition : que rien d'autre que la "
                "décoration n'ait changé.",
        "intro": [
            "Changez l'angle, l'objectif ou l'heure de la journée, et l'avant/après perd toute "
            "force : on ne compare plus la même chose. Les comparaisons les plus spectaculaires "
            "sont souvent les moins honnêtes.",
            "Un bon avant/après garde le même point de vue, le même cadrage et la même lumière "
            "d'origine. Ce qui bouge, ce sont les matières, le mobilier et la mise en scène.",
        ],
        "cartes_titre": "Les règles d'un avant/après crédible",
        "cartes_lead": "Elles valent pour une photo comme pour une vidéo.",
        "cartes": [
            ("Le même point de vue",
             "Même hauteur, même angle, idéalement le même appareil."),
            ("La même lumière",
             "Même heure, mêmes rideaux ouverts. Une pièce photographiée au soleil couchant "
             "paraîtra toujours meilleure : ce n'est pas la décoration qui a changé."),
            ("Rien de coupé",
             "Ne recadrez pas l'après : le regard perçoit immédiatement la triche."),
            ("Une transition franche",
             "Un balayage latéral net vaut mieux qu'un fondu : il montre que la géométrie "
             "coïncide."),
            ("Une mention honnête",
             "« Rendu à titre indicatif, non contractuel » quand l'après est une projection."),
            ("Un format vertical",
             "9:16 pour Instagram et TikTok : c'est là que ce format circule."),
        ],
        "cta_titre": "Fabriquez votre avant/après",
        "cta_texte": "Le studio produit l'image HD et la vidéo verticale à partir de votre photo "
                     "— prête à poster.",
        "ba_titre": "Un exemple, sur un bien réel",
        "ba_lead": "Photo d'origine à gauche, rendu du studio à droite.",
        "conseils_titre": "Que faire de votre avant/après",
        "conseils": [
            "<strong>Sur les réseaux :</strong> la vidéo 9:16 fonctionne mieux que l'image "
            "fixe, surtout avec le balayage au centre.",
            "<strong>Avec un artisan :</strong> l'image sert de brief visuel. Elle évite les "
            "malentendus sur l'ambiance recherchée.",
            "<strong>Pour un bien loué :</strong> elle aide à arbitrer un budget de mise en "
            "valeur avant la mise en ligne de l'annonce.",
        ],
        "faq": [
            ("La vidéo est-elle vraiment prête à poster ?",
             "Oui : format vertical 9:16, balayage avant/après, signature Label Maison. Elle "
             "se télécharge directement depuis la page du studio."),
            ("Puis-je obtenir plusieurs ambiances ?",
             "Le pack trois rendus permet de comparer trois ambiances sur la même pièce."),
            ("Le rendu est-il utilisable commercialement ?",
             "Pour la promotion de votre propre bien, oui. Il ne doit pas être présenté comme "
             "l'état réel du logement."),
        ],
    },
    {
        "slug": "ameliorer-photos-annonce-airbnb",
        "fil": "Améliorer les photos d'une annonce",
        "title": "Améliorer les photos d'une annonce Airbnb : ce qui fait vraiment cliquer",
        "desc": "Cadrage, lumière, ordre des photos, mise en scène : comment améliorer les "
                "photos d'une annonce de location courte durée, et tester la mise en valeur "
                "avant de meubler.",
        "badge": "Location courte durée",
        "h1": "Des photos d'annonce qui <em>font cliquer</em>",
        "sub": "La photo de couverture décide en une demi-seconde. Le reste de l'annonce ne "
               "rattrape jamais une mauvaise première image.",
        "photo": "studio/hero-riad.jpg",
        "photo_rendu": True,
        "photo_alt": "Rendu Label Maison Studio : pièce en ambiance bohème",
        "puces": ["Cadrage", "Lumière", "Ordre des photos"],
        "about": "Photographie d'annonce de location courte durée",
        "lead": "Sur une plateforme, on ne loue pas un logement : on loue une vignette.",
        "intro": [
            "Nous photographions régulièrement les biens que nous prenons en gestion. Le constat "
            "est constant : deux logements équivalents obtiennent des résultats très différents "
            "selon la qualité et l'ordre de leurs photos.",
            "Rien d'ésotérique là-dedans. De la lumière naturelle, un trépied, un rangement "
            "impeccable et une séquence de photos qui raconte la visite dans l'ordre.",
        ],
        "cartes_titre": "Les fondamentaux, dans l'ordre",
        "cartes_lead": "Applicables avec un téléphone récent.",
        "cartes": [
            ("Photographier de jour, rideaux ouverts",
             "La lumière naturelle reste la plus flatteuse. Évitez le flash, qui écrase les "
             "volumes et jaunit les murs."),
            ("Tenir l'appareil droit, à hauteur de poitrine",
             "Les verticales doivent rester verticales. C'est le détail qui sépare une photo "
             "d'agence d'une photo de particulier."),
            ("Montrer deux murs",
             "Photographier depuis un angle de la pièce donne la profondeur et la surface "
             "réelle."),
            ("Ranger, vraiment",
             "Plans de travail vides, câbles cachés, poubelle hors champ, lit fait au carré."),
            ("Soigner la couverture",
             "La pièce la plus généreuse, de jour, avec une vue ou une belle lumière. C'est "
             "elle qui décide du clic."),
            ("Ordonner la séquence",
             "Séjour, cuisine, chambres, salle de bain, extérieur : la visite doit se dérouler "
             "comme une vraie visite."),
        ],
        "cta_titre": "Tester la mise en valeur avant de dépenser",
        "cta_texte": "Avant d'acheter du mobilier pour votre location, voyez ce que la pièce "
                     "peut devenir. Le rendu sert de brief ; les photos réelles restent celles "
                     "de l'annonce.",
        "ba_titre": "Ce que le studio produit",
        "ba_lead": "Une projection de mise en valeur, à ne jamais publier comme photo réelle du "
                   "bien.",
        "conseils_titre": "Et si vous préférez déléguer",
        "conseils": [
            "La photographie fait partie de notre prestation de gestion : nous préparons le "
            "logement, nous le photographions et nous rédigeons l'annonce.",
            "Le reste suit : tarification dynamique, réponses aux voyageurs, ménage piloté et "
            "reporting mensuel. Un seul bien géré en décembre 2025 a rapporté 6 359,32 € nets "
            "à son propriétaire — la capture d'écran figure sur notre page propriétaires.",
            "Décrivez-nous votre bien dans le formulaire ci-dessous : nous revenons vers vous "
            "avec une estimation de revenus.",
        ],
        "faq": [
            ("Faut-il un photographe professionnel ?",
             "Pas systématiquement. Un téléphone récent, de la lumière naturelle et un "
             "rangement irréprochable suffisent pour la plupart des biens."),
            ("Puis-je publier un rendu du studio dans mon annonce ?",
             "Non, pas comme photo du bien. Les plateformes exigent des photos fidèles à la "
             "réalité, et nos conditions l'interdisent également."),
            ("Combien de photos pour une annonce ?",
             "Entre quinze et vingt-cinq, dans l'ordre de la visite, sans doublon d'angle."),
        ],
    },
]


def main() -> None:
    print("Silo Label Maison Studio :")
    for p in PAGES:
        construire(p)
    print(f"{len(PAGES)} pages écrites dans public/ — "
          "lancer ensuite : python3 scripts/build_seo_index.py")


if __name__ == "__main__":
    main()
