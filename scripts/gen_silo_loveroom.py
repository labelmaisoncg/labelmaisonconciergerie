# -*- coding: utf-8 -*-
"""Génère le silo SEO « love room » autour de Ba'cam Spa (Etigny, 89).

Trois pages de conquête, chacune avec son propre angle pour éviter qu'elles se
cannibalisent, toutes pointant vers la page de visite /bacam-spa :

  /love-room-sens                  → intention locale  (Sens, Yonne, 89)
  /love-room-proche-paris          → intention départ  (Paris, Île-de-France)
  /week-end-romantique-bourgogne   → intention séjour  (programme, cadeau)

Gabarit et feuille de style repris des pages silo existantes (/css/seo-silo.css).
Aucun avis ni note chiffrée n'est inventé : seules les citations déjà publiées
par la propriétaire sur la page de visite sont reprises, sans agrégat.
"""
import json, pathlib, html

OUT = pathlib.Path("/Users/kamel/Desktop/labelmaisonconciergerie/public")
SITE = "https://www.labelmaisoncg.fr"
RESA = "https://www.bacam-spa-privatif.com/fr/booking/room"
CADEAU = "https://www.bacam-spa-privatif.com/fr/page/carte-cadeau"
TEL_BC = "+33 6 79 37 85 97"
TEL_BC_URI = "+33679378597"
TEL_LM = "+33 7 49 54 83 55"
P = "/bacam-spa/photos"
# Note publique de la fiche Google (relevée le 3 août 2026) : la seule
# statistique avancée sur ces pages, vérifiable en un clic.
GOOGLE = "https://share.google/heY7J4K1hSallZv9o"
NOTE, AVIS = "5", "44"

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">'
         '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700'
         '&family=Figtree:wght@400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,400;1,600'
         '&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/seo-silo.css">')

ICONS = ('<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">'
         '<link rel="icon" type="image/png" sizes="512x512" href="/images/favicon.png">'
         '<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">')

HEADER = ('<header class="top"><div class="topbar">'
          '<a class="brand" href="/" aria-label="Label Maison Conciergerie - Accueil"><span class="lockup">'
          '<img class="lk-key" src="/images/key-gold-deep.png" alt="Label Maison Conciergerie">'
          '<span class="lk-div" aria-hidden="true"></span><span class="lk-tx">'
          '<span class="lk-name">LABEL MAISON</span><span class="lk-sub">CONCIERGERIE</span></span></span></a>'
          '<nav class="topnav">'
          '<a class="lnk" href="/bacam-spa">La visite</a>'
          '<a class="lnk" href="/love-room-sens">Love room Sens</a>'
          '<a class="lnk" href="/love-room-proche-paris">Depuis Paris</a>'
          '<a class="lnk" href="/week-end-romantique-bourgogne">Week-end</a>'
          f'<a class="phone" href="tel:{TEL_BC_URI}">{TEL_BC}</a>'
          '</nav></div></header>')

FOOTER = ('<footer id="contact"><div class="wrap fcols">'
          '<div class="fbrand"><span class="lockup">'
          '<img class="lk-key" src="/images/key-gold-deep.png" alt="Label Maison Conciergerie">'
          '<span class="lk-div" aria-hidden="true"></span><span class="lk-tx">'
          '<span class="lk-name">LABEL MAISON</span><span class="lk-sub">CONCIERGERIE</span></span></span>'
          '<p class="ftag">Ba\'cam Spa — love room et spa privatif à Etigny (89), '
          '<span class="font-serif-italic">à dix minutes de Sens</span>, présentée par Label Maison Conciergerie.</p>'
          '<ul style="list-style:none;padding:0;margin:14px 0 0">'
          f'<li>📞 <a href="tel:{TEL_BC_URI}">{TEL_BC}</a></li>'
          '<li>✉️ <a href="mailto:bacam.spa@gmail.com">bacam.spa@gmail.com</a></li>'
          '<li>📍 2 rue de la Place, 89510 Etigny (Yonne)</li></ul>'
          '<div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">'
          '<a href="https://instagram.com/bacam.spa" target="_blank" rel="noopener">Instagram @bacam.spa</a></div></div>'
          '<div><h4>La love room</h4><ul>'
          '<li><a href="/bacam-spa">La visite filmée</a></li>'
          '<li><a href="/love-room-sens">Love room à Sens (89)</a></li>'
          '<li><a href="/love-room-proche-paris">Love room près de Paris</a></li>'
          '<li><a href="/week-end-romantique-bourgogne">Week-end romantique en Bourgogne</a></li>'
          f'<li><a href="{CADEAU}" target="_blank" rel="noopener">Carte cadeau</a></li>'
          '</ul></div>'
          '<div><h4>Label Maison dans l\'Yonne</h4><ul>'
          '<li><a href="/conciergerie-airbnb-sens">Conciergerie Airbnb Sens</a></li>'
          '<li><a href="/conciergerie-airbnb-joigny">Joigny</a></li>'
          '<li><a href="/conciergerie-airbnb-villeneuve-sur-yonne">Villeneuve-sur-Yonne</a></li>'
          '<li><a href="/conciergerie-airbnb-paron">Paron</a></li>'
          '<li><a href="/">Accueil labelmaisoncg.fr</a></li>'
          '</ul></div></div>'
          '<div class="wrap fbot"><span>© 2026 Ba\'cam Spa · Page présentée par Label Maison Conciergerie</span>'
          '<span>Etigny · Sens · Yonne (89)</span></div></footer>')

MOBCTA = (f'<div class="mobcta"><a class="btn ghost" href="/bacam-spa">La visite</a>'
          f'<a class="btn" href="{RESA}" target="_blank" rel="noopener">Réserver</a></div>')

# Légendes vérifiées image par image : chaque alt décrit ce qui est réellement
# sur la photo (pas le nom du fichier — dspa-01 était une douche, pas le spa).
GAL = [
    ("spa-03.jpg", "Espace bien-être privatisé de la love room Ba'cam Spa : spa, sauna et table de massage sous charpente, à Etigny près de Sens"),
    ("jacuzzi-01.jpg", "Spa privatif pour deux contre les murs de pierre, love room dans l'Yonne (89)"),
    ("sauna-01.jpg", "Sauna traditionnel vitré de la love room, à dix minutes de Sens"),
    ("massage-01.jpg", "Table de massage installée sous l'escalier, espace bien-être privatisé"),
    ("nv-chambre.jpg", "Chambre au lit king size suspendu par cordes, love room à Etigny en Bourgogne"),
    ("nv-lit.jpg", "Lit préparé avec linge de maison fourni, love room pour deux"),
    ("douche-02.jpg", "Douche à l'italienne à deux pommeaux et éclairage d'ambiance"),
    ("nv-sdb-2.jpg", "Salle de bain à double vasque et miroir rétroéclairé, peignoirs fournis"),
    ("nv-salon.jpg", "Salon avec canapé rond et cheminée, love room près de Sens"),
    ("nv-table.jpg", "Table dressée pour un dîner à deux dans le logement privatisé"),
    ("nv-cuisine.jpg", "Cuisine équipée ouverte sur la table, love room d'Etigny (89510)"),
    ("nv-veranda.jpg", "Véranda avec fauteuils suspendus, ouverte sur le jardin"),
    ("nv-jardin.jpg", "Jardin privatif et pergola de Ba'cam Spa, vallée de l'Yonne"),
    ("terrasse-01.jpg", "Terrasse couverte et fauteuils suspendus de la love room"),
]


def galerie(idg):
    figs = "".join(
        f'<figure><img src="{P}/{f}" alt="{html.escape(a)}" loading="lazy" decoding="async"></figure>'
        for f, a in GAL)
    return (f'<div class="hscroll-wrap"><div class="hscroll" id="{idg}">{figs}</div>'
            f'<div class="hscroll-nav"><button type="button" onclick="gal(\'{idg}\',-1)" aria-label="Photo précédente">&larr;</button>'
            f'<button type="button" class="next" onclick="gal(\'{idg}\',1)" aria-label="Photo suivante">&rarr;</button></div></div>'
            '<script>function gal(i,d){var e=document.getElementById(i);'
            'e.scrollBy({left:d*Math.max(280,e.clientWidth*0.8),behavior:"smooth"});}</script>')


def faq_html(items, titre):
    d = "".join(f'<details><summary>{q}</summary><div class="ans">{r}</div></details>' for q, r in items)
    return f'<section class="wrap" id="faq"><h2>{titre}</h2>\n{d}\n</section>'


def faq_ld(items):
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip(q),
         "acceptedAnswer": {"@type": "Answer", "text": strip(r)}} for q, r in items]}


def strip(s):
    import re
    return html.unescape(re.sub(r"<[^>]+>", "", s).replace(" ", " ")).strip()


def band(titre, texte):
    return ('<section class="wrap"><div class="band"><div class="grid g2" style="gap:26px;align-items:center"><div>'
            f'<h2>{titre}</h2><p style="color:#eef1e6">{texte}</p>'
            f'<p style="color:#eef1e6">📞 <a href="tel:{TEL_BC_URI}" style="color:#fff;font-weight:700">{TEL_BC}</a>'
            '<br>✉️ <a href="mailto:bacam.spa@gmail.com" style="color:#fff">bacam.spa@gmail.com</a></p>'
            f'<a class="btn gold" href="{RESA}" target="_blank" rel="noopener">Réserver la love room</a>'
            f'<p style="color:#eef1e6;margin-top:16px;font-size:14px">★★★★★ '
            f'<a href="{GOOGLE}" target="_blank" rel="noopener" style="color:#fff">'
            f'{NOTE}/5 sur Google · {AVIS} avis</a></p></div>'
            '<div><p style="color:#eef1e6;margin-bottom:14px">Voir avant de réserver&nbsp;: la visite se traverse '
            'en un seul travelling continu, du salon au jardin.</p>'
            '<a class="btn" href="/bacam-spa">Faire la visite</a> '
            f'<a class="btn ghost" href="{CADEAU}" target="_blank" rel="noopener">Offrir une carte cadeau</a></div>'
            '</div></div></section>')


def page(slug, title, desc, h1, sub, badges, hero_img, hero_alt, crumb, corps, faq, faq_titre,
         band_t, band_p, related, extra_ld=()):
    lds = [
        {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement":
            [{"@type": "ListItem", "position": i + 1, "name": n, "item": u}
             for i, (n, u) in enumerate(crumb)]},
        faq_ld(faq),
        {"@context": "https://schema.org", "@type": "WebPage",
         "@id": f"{SITE}/{slug}", "url": f"{SITE}/{slug}", "name": strip(title),
         "description": strip(desc), "inLanguage": "fr-FR",
         "primaryImageOfPage": f"{SITE}{P}/{hero_img}",
         "about": {"@id": f"{SITE}/bacam-spa#lieu"},
         "isPartOf": {"@type": "WebSite", "name": "Label Maison Conciergerie", "url": SITE + "/"}},
        {"@context": "https://schema.org", "@type": ["LodgingBusiness", "VacationRental"],
         "@id": f"{SITE}/bacam-spa#lieu", "name": "Ba'cam Spa",
         "url": f"{SITE}/bacam-spa", "telephone": TEL_BC, "email": "bacam.spa@gmail.com",
         "priceRange": "€€€",
         "address": {"@type": "PostalAddress", "streetAddress": "2 rue de la Place",
                     "addressLocality": "Etigny", "postalCode": "89510",
                     "addressRegion": "Bourgogne-Franche-Comté", "addressCountry": "FR"},
         "geo": {"@type": "GeoCoordinates", "latitude": 48.1447, "longitude": 3.2919},
         "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": n, "value": True}
                            for n in ["Spa à débordement privatif", "Sauna traditionnel (en option)",
                                      "Hammam (inclus)", "Table de massage", "Lit king size suspendu",
                                      "Douche à l'italienne pour deux", "Cuisine équipée", "Cheminée",
                                      "Wi-Fi", "Parking privé", "Jardin privatif"]],
         "aggregateRating": {"@type": "AggregateRating", "ratingValue": NOTE,
                             "bestRating": "5", "worstRating": "1",
                             "reviewCount": AVIS, "ratingCount": AVIS},
         "sameAs": ["https://www.bacam-spa-privatif.com", "https://instagram.com/bacam.spa", GOOGLE]},
    ] + list(extra_ld)
    ld = "\n".join('<script type="application/ld+json">%s</script>'
                   % json.dumps(d, ensure_ascii=False, separators=(",", ":")) for d in lds)
    crumb_nav = ('<div class="wrap"><nav class="crumb">'
                 + " › ".join(f'<a href="{u}">{n}</a>' for n, u in crumb[:-1])
                 + f' › {crumb[-1][0]}</nav></div>')
    badges = list(badges) + [f'<b>{NOTE}/5</b> sur Google · {AVIS} avis']
    bdg = "".join(f'<span class="badge">{b}</span>' for b in badges)
    doc = f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">{ICONS}
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{SITE}/{slug}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Ba'cam Spa · Label Maison Conciergerie">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{SITE}/{slug}">
<meta property="og:image" content="{SITE}{P}/{hero_img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#A97C30">
<meta name="geo.region" content="FR-89">
<meta name="geo.placename" content="Etigny, Yonne, Bourgogne-Franche-Comté">
<meta name="geo.position" content="48.1447;3.2919">
<meta name="ICBM" content="48.1447, 3.2919">
{FONTS}
{ld}
</head>
<body>{HEADER}
<section class="hero"><div class="wrap hero-grid"><div class="hero-copy">
<h1 style="max-width:22ch">{h1}</h1>
<p class="sub">{sub}</p>
<div class="badges">{bdg}</div>
<div class="cta"><a class="btn" href="/bacam-spa">Faire la visite filmée</a>
<a class="btn ghost" href="{RESA}" target="_blank" rel="noopener">Réserver</a></div>
</div><div class="hero-media"><img src="{P}/{hero_img}" alt="{html.escape(hero_alt)}" loading="eager" decoding="async"></div></div></section>
{crumb_nav}
{corps}
{faq_html(faq, faq_titre)}
{band(band_t, band_p)}
<section class="wrap"><div class="related"><h3>À voir aussi</h3>{related}</div></section>
{FOOTER}
{MOBCTA}
</body></html>"""
    (OUT / f"{slug}.html").write_text(doc, encoding="utf-8")
    print(f"✓ {slug}.html  ({len(strip(corps).split())} mots de corps)")


# ══════════════════════════════════════════════════════════════════════════
# PAGE 1 — intention locale : « love room Sens », « love room Yonne », « 89 »
# ══════════════════════════════════════════════════════════════════════════
corps1 = f"""
<section class="wrap" style="padding-top:20px">
<p class="lead">Vous cherchez une <strong>love room à Sens</strong> ou dans l'<strong>Yonne&nbsp;(89)</strong>&nbsp;?
<strong>Ba'cam Spa</strong> est installée à <strong>Etigny</strong>, village de la vallée de l'Yonne à une dizaine de
minutes du centre de Sens. Le lieu est entièrement privatisé&nbsp;: il n'accueille qu'un seul couple à la fois,
avec son <strong>spa à débordement</strong>, son <strong>sauna traditionnel</strong>, son <strong>hammam</strong>, sa table de massage et son
<strong>lit king size suspendu</strong>.</p>
<p>Pas de couloir d'hôtel, pas de créneau à réserver pour le bien-être, personne derrière la cloison&nbsp;:
c'est la différence entre une chambre avec jacuzzi et une véritable love room. À partir de
<strong>249&nbsp;€ la nuit</strong>, pour deux.</p>
</section>

<section class="wrap"><h2>Une love room privatisée à dix minutes de Sens</h2>
<p>La région sénonaise compte beaucoup d'hébergements de charme, peu de lieux réellement conçus pour deux.
Ba'cam Spa a été pensée dans ce sens&nbsp;: chaque espace du logement sert le séjour d'un couple, du salon avec
cheminée jusqu'au jardin sous pergola.</p>
<div class="cards">
<div class="card"><div class="ico">♨︎</div><h3>Spa à débordement privatif</h3><p>L'eau chaude, à toute heure,
sans partage ni horaire. C'est le cœur de l'espace bien-être, sous charpente et murs de pierre.</p></div>
<div class="card"><div class="ico">🌡️</div><h3>Sauna traditionnel</h3><p>Proposé en option, à quelques pas de
la douche fraîche. La chaleur, puis le contraste&nbsp;: c'est là que la fatigue de la semaine tombe.</p></div>
<div class="card"><div class="ico">💨</div><h3>Hammam compris</h3><p>La chaleur humide, incluse dans la nuit&nbsp;—
pas en supplément. Avec le sauna, deux façons de se réchauffer, aucune à partager.</p></div>
<div class="card"><div class="ico">💆</div><h3>Table de massage</h3><p>Installée contre le mur de pierre,
sous l'escalier. Prendre soin l'un de l'autre fait partie du logement, pas d'un supplément d'hôtel.</p></div>
<div class="card"><div class="ico">🛏️</div><h3>Lit king size suspendu</h3><p>Sous les poutres, éclairage réglable,
rideaux voilés, silence complet. C'est la pièce dont tout le monde reparle ensuite.</p></div>
<div class="card"><div class="ico">🍽️</div><h3>Tout sur place</h3><p>Cuisine équipée avec machine à café, table
pour dîner à deux, salle de bain à double vasque, douche à l'italienne prévue pour deux, linge fourni.</p></div>
<div class="card"><div class="ico">🌿</div><h3>Véranda &amp; jardin</h3><p>La visite s'achève dehors&nbsp;: véranda
ouverte sur le jardin, pergola, campagne bourguignonne autour.</p></div>
<div class="card"><div class="ico">🔥</div><h3>Salon &amp; confort</h3><p>Cheminée, sofa tantra, ambiance lumineuse
et musique, TV, Wi-Fi et parking privé&nbsp;: le quotidien reste dehors, pas le confort.</p></div>
</div></section>

<section class="wrap"><h2>Sens, Etigny et les alentours</h2>
<p><strong>Sens</strong> est à une dizaine de minutes de voiture&nbsp;: la cathédrale Saint-Étienne — première
grande cathédrale gothique de France — les halles couvertes, les musées et les tables du centre historique
permettent de prolonger la soirée sans jamais s'éloigner.</p>
<p>Autour, la Bourgogne du Nord&nbsp;: les vignobles de <strong>Chablis</strong> et <strong>Auxerre</strong> à
environ une heure, <strong>Fontainebleau</strong>, <strong>Provins</strong> et la forêt d'Othe à moins d'une heure,
et les chemins de halage le long de l'Yonne, à pied ou à vélo, au départ même du village.
Depuis Paris, comptez environ 120&nbsp;km, soit <a href="/love-room-proche-paris">une heure trente de route</a>.</p>
{galerie('galSens')}
</section>

<section class="wrap"><h2>Love room, chambre avec jacuzzi ou gîte&nbsp;: quelle différence&nbsp;?</h2>
<table class="cmp">
<tr><th></th><th>Love room privatisée</th><th>Chambre d'hôtel avec accès spa</th><th>Gîte classique</th></tr>
<tr><td>Spa, hammam, sauna</td><td>Dans le logement, pour vous seuls</td><td>Partagé, sur créneau</td><td>Rarement présent</td></tr>
<tr><td>Voisinage</td><td>Aucun&nbsp;: un seul couple à la fois</td><td>Couloirs, étages, restaurant</td><td>Variable</td></tr>
<tr><td>Horaires</td><td>Aucun</td><td>Ouverture / fermeture du spa</td><td>—</td></tr>
<tr><td>Pensé pour</td><td>Deux personnes, du salon au jardin</td><td>Une clientèle générale</td><td>Familles, groupes</td></tr>
</table>
<p style="margin-top:18px">C'est cette privatisation intégrale qui distingue Ba'cam Spa des chambres avec jacuzzi
de la région&nbsp;: l'équipement n'est pas un service de l'établissement, il fait partie du logement.</p>
</section>

<section class="wrap"><h2>Combien coûte une nuit&nbsp;?</h2>
<p>La nuit démarre à <strong>249&nbsp;€ pour deux</strong>. Les options s'ajoutent au moment de réserver&nbsp;:
sauna traditionnel, crémant de Bourgogne, plateau repas Terre&nbsp;&amp; Mer dressé sur place, petit-déjeuner
artisanal livré le matin, arrivée anticipée ou départ tardif.</p>
<div class="steps" style="margin-top:34px">
<div class="step"><h3>1 · Cliquez sur Réserver</h3><p>Les disponibilités s'affichent en direct, sans échange préalable.</p></div>
<div class="step"><h3>2 · Ajoutez vos options</h3><p>Sauna, crémant, plateau repas, petit-déjeuner&nbsp;: vous composez la nuit.</p></div>
<div class="step"><h3>3 · Confirmez</h3><p>Vous êtes accueillis sur place. Le reste ne regarde que vous deux.</p></div>
</div>
<p style="margin-top:28px">Une <a href="{CADEAU}" target="_blank" rel="noopener">carte cadeau</a> est également
disponible&nbsp;— anniversaire, Saint-Valentin, demande à faire.</p>
</section>
"""

faq1 = [
    ("Où trouver une love room à Sens&nbsp;?",
     "Ba'cam Spa se trouve au 2 rue de la Place, 89510 Etigny, à une dizaine de minutes de voiture du centre de Sens. C'est une love room entièrement privatisée&nbsp;: spa à débordement, sauna, hammam et table de massage, pour un seul couple à la fois."),
    ("Le spa est-il partagé avec d'autres clients&nbsp;?",
     "Non. Le spa à débordement, le hammam et la table de massage sont compris dans la nuit, et le sauna traditionnel est proposé en option. Tout cet espace bien-être fait partie du logement et sont réservés au couple qui séjourne, sans créneau ni horaire imposé."),
    ("Quel est le prix d'une love room dans l'Yonne&nbsp;?",
     "À Ba'cam Spa, la nuit démarre à 249&nbsp;€ pour deux personnes. Le hammam est compris dans la nuit. Les options — sauna traditionnel, crémant de Bourgogne, plateau repas Terre &amp; Mer, petit-déjeuner artisanal, arrivée anticipée ou départ tardif — s'ajoutent au moment de la réservation."),
    ("Peut-on venir de Sens sans voiture&nbsp;?",
     "Le village est à une dizaine de minutes de Sens, où s'arrêtent les trains venant de Paris. Un transfert privé avec chauffeur peut être organisé sur demande par Label Maison Conciergerie."),
    ("Que comprend le logement&nbsp;?",
     "Salon avec cheminée, cuisine équipée, table pour dîner à deux, salle de bain à double vasque, douche à l'italienne pour deux, chambre avec lit king size suspendu, espace bien-être avec spa à débordement, hammam et table de massage compris, véranda, jardin sous pergola, parking privé. Linge de lit et de toilette fournis."),
    ("Comment réserver&nbsp;?",
     "En ligne, en trois gestes&nbsp;: cliquer sur Réserver, choisir ses dates parmi les disponibilités en direct, ajouter ses options puis confirmer."),
]

page(
    "love-room-sens",
    "Love room à Sens (89) — spa privatif &amp; nuit en amoureux | Ba'cam Spa",
    "Love room avec spa à débordement privatif, sauna, hammam et table de massage à 10 min de Sens (Yonne). Lieu entièrement privatisé pour deux, dès 249 € la nuit. Visite filmée.",
    "Love room avec spa privatif à Sens et dans l'Yonne",
    "À Etigny, à dix minutes du centre de Sens&nbsp;: un logement entier privatisé pour deux, spa à débordement, hammam et table de massage compris, sauna traditionnel en option.",
    ["Un seul <b>couple</b> à la fois", "Spa &amp; <b>hammam</b> compris", "Dès <b>249 €</b> la nuit", "<b>10 min</b> de Sens"],
    "spa-03.jpg",
    "Espace bien-être privatisé de la love room Ba'cam Spa à Etigny : spa, sauna et table de massage",
    [("Accueil", "/"), ("Conciergerie Yonne", "/conciergerie-airbnb-sens"), ("Love room à Sens", f"{SITE}/love-room-sens")],
    corps1, faq1, "Questions fréquentes — love room à Sens et dans l'Yonne",
    "Réservez la love room, à dix minutes de Sens",
    "Un seul couple à la fois, spa à débordement et sauna privatifs, dès 249&nbsp;€ la nuit. Les disponibilités s'affichent en direct.",
    ('<a href="/bacam-spa">La visite filmée de Ba\'cam Spa</a>'
     '<a href="/love-room-proche-paris">Love room près de Paris</a>'
     '<a href="/week-end-romantique-bourgogne">Week-end romantique en Bourgogne</a>'
     '<a href="/conciergerie-airbnb-sens">Conciergerie Airbnb à Sens</a>'),
)

# ══════════════════════════════════════════════════════════════════════════
# PAGE 2 — intention départ : « love room près de Paris », « à côté de Paris »
# ══════════════════════════════════════════════════════════════════════════
corps2 = f"""
<section class="wrap" style="padding-top:20px">
<p class="lead">Une <strong>love room près de Paris</strong>, sans le prix ni le bruit d'une chambre parisienne&nbsp;:
<strong>Ba'cam Spa</strong> est à <strong>environ 120&nbsp;km de Paris</strong>, à Etigny, dans la vallée de l'Yonne.
Une heure trente de route par l'A5 ou l'A6, ou près d'une heure de train jusqu'à Sens puis dix minutes de voiture.</p>
<p>C'est la distance juste&nbsp;: assez loin pour que le décor change complètement — campagne, silence, jardin —
assez près pour partir après le travail et y être pour le dîner.</p>
</section>

<section class="wrap"><h2>Y aller depuis Paris et l'Île-de-France</h2>
<div class="cards">
<div class="card"><div class="ico">🚗</div><h3>En voiture · ~1 h 30</h3><p>Environ 120&nbsp;km par l'A5 ou l'A6
puis la vallée de l'Yonne. Parking privé sur place&nbsp;: la voiture ne bouge plus jusqu'au départ.</p></div>
<div class="card"><div class="ico">🚆</div><h3>En train · ~1 h</h3><p>Paris — gare de Sens, puis une dizaine de
minutes de voiture jusqu'à Etigny.</p></div>
<div class="card"><div class="ico">🤵</div><h3>Transfert privé</h3><p>Sur demande, Label Maison Conciergerie
organise un <a href="/transport">transfert avec chauffeur</a> depuis Paris, un aéroport ou la gare de Sens.</p></div>
</div>
<p style="margin-top:26px">Depuis l'Essonne, la Seine-et-Marne ou le sud de l'Île-de-France, comptez souvent moins
d'une heure&nbsp;: Fontainebleau n'est qu'à une petite heure du village.</p>
</section>

<section class="wrap"><h2>Ce qu'une nuit à Paris ne donne pas</h2>
<p>Un hôtel parisien avec accès spa reste un hôtel&nbsp;: le bassin ferme, il se partage, il faut réserver un
créneau, et les couloirs sont pleins. Ici, le logement entier est à vous&nbsp;— <strong>spa à débordement</strong>,
<strong>sauna traditionnel</strong>, <strong>hammam</strong>, table de massage, chambre au <strong>lit king size suspendu</strong>, salon avec
cheminée, véranda et jardin. Un seul couple à la fois, aucun horaire.</p>
<p>Et le budget n'a rien à voir&nbsp;: la nuit démarre à <strong>249&nbsp;€ pour deux</strong>, options comprises
au choix — crémant de Bourgogne, plateau repas Terre&nbsp;&amp; Mer, petit-déjeuner artisanal livré le matin.</p>
{galerie('galParis')}
</section>

<section class="wrap"><h2>Une seule nuit suffit</h2>
<div class="steps" style="margin-top:10px">
<div class="step"><h3>18 h · vous partez</h3><p>Sortie de Paris, A5 ou A6, la campagne arrive vite.</p></div>
<div class="step"><h3>19 h 30 · vous arrivez</h3><p>La porte se referme. Le plateau repas est déjà dressé si vous
l'avez choisi.</p></div>
<div class="step"><h3>Le lendemain</h3><p>Petit-déjeuner artisanal, véranda, jardin. Sens et sa cathédrale à dix
minutes, Chablis et Fontainebleau à moins d'une heure&nbsp;— ou rien du tout, c'est permis aussi.</p></div>
</div>
<p style="margin-top:28px">Pour prolonger&nbsp;: <a href="/week-end-romantique-bourgogne">le week-end romantique
en Bourgogne</a>, et le détail du lieu sur la page <a href="/love-room-sens">love room à Sens</a>.</p>
</section>
"""

faq2 = [
    ("À quelle distance de Paris se trouve la love room&nbsp;?",
     "Environ 120&nbsp;km, soit une heure trente de route par l'A5 ou l'A6. En train, comptez près d'une heure jusqu'à la gare de Sens, puis une dizaine de minutes de voiture jusqu'à Etigny."),
    ("Peut-on y aller sans voiture depuis Paris&nbsp;?",
     "Oui&nbsp;: train jusqu'à Sens, puis un transfert privé avec chauffeur, que Label Maison Conciergerie peut organiser sur demande."),
    ("Est-ce jouable pour une seule nuit&nbsp;?",
     "Oui. C'est même l'usage le plus fréquent&nbsp;: on part en fin de journée, on dîne sur place, on repart le lendemain après le petit-déjeuner. L'arrivée anticipée et le départ tardif sont proposés en option."),
    ("Quelle différence avec un hôtel spa parisien&nbsp;?",
     "À Ba'cam Spa, l'espace bien-être n'est pas un service de l'établissement&nbsp;: il fait partie du logement. Spa à débordement, hammam, sauna et table de massage sont réservés au couple qui séjourne, sans créneau, sans partage et sans voisinage."),
    ("Combien coûte la nuit&nbsp;?",
     "À partir de 249&nbsp;€ pour deux personnes, options en supplément&nbsp;: sauna traditionnel, crémant de Bourgogne, plateau repas Terre &amp; Mer, petit-déjeuner artisanal, arrivée anticipée ou départ tardif."),
]

page(
    "love-room-proche-paris",
    "Love room près de Paris — spa privatif à 1 h 30, en Bourgogne | Ba'cam Spa",
    "Love room avec spa privatif à 1 h 30 de Paris : logement entier privatisé pour deux, spa à débordement, sauna, hammam, table de massage. Dès 249 € la nuit, dans l'Yonne (89).",
    "Love room avec spa privatif près de Paris",
    "À 120&nbsp;km de Paris, dans la vallée de l'Yonne&nbsp;: un logement entier privatisé pour deux, spa à débordement et hammam compris, sauna en option. Une heure trente de route, une nuit suffit.",
    ["<b>1 h 30</b> de Paris", "<b>1 h</b> de train", "Spa &amp; <b>hammam</b> compris", "Dès <b>249 €</b> la nuit"],
    "jacuzzi-01.jpg",
    "Jacuzzi privatif de la love room Ba'cam Spa, à 1 h 30 de Paris dans l'Yonne",
    [("Accueil", "/"), ("Love room à Sens", "/love-room-sens"), ("Love room près de Paris", f"{SITE}/love-room-proche-paris")],
    corps2, faq2, "Questions fréquentes — venir de Paris",
    "Partez ce soir, vous y serez pour le dîner",
    "120&nbsp;km de Paris, un logement entier pour deux, spa à débordement et sauna privatifs. Disponibilités en direct.",
    ('<a href="/bacam-spa">La visite filmée de Ba\'cam Spa</a>'
     '<a href="/love-room-sens">Love room à Sens (89)</a>'
     '<a href="/week-end-romantique-bourgogne">Week-end romantique en Bourgogne</a>'
     '<a href="/transport">Transfert privé avec chauffeur</a>'),
)

# ══════════════════════════════════════════════════════════════════════════
# PAGE 3 — intention séjour : « week-end romantique Bourgogne », cadeau
# ══════════════════════════════════════════════════════════════════════════
corps3 = f"""
<section class="wrap" style="padding-top:20px">
<p class="lead">Un <strong>week-end romantique en Bourgogne</strong> qui commence par un spa à débordement et
finit dans un jardin sous pergola&nbsp;: <strong>Ba'cam Spa</strong>, à Etigny (89), est une love room entièrement
privatisée, à dix minutes de Sens et à une heure trente de Paris.</p>
<p>Le logement entier est à vous&nbsp;: <strong>spa à débordement</strong>, <strong>sauna traditionnel</strong>, <strong>hammam</strong>,
table de massage, lit king size suspendu, salon avec cheminée, véranda et jardin. Un seul couple à la fois,
à partir de <strong>249&nbsp;€ la nuit</strong>.</p>
</section>

<section class="wrap"><h2>Le programme d'un week-end à deux</h2>
<div class="steps" style="margin-top:10px">
<div class="step"><h3>Vendredi soir</h3><p>Arrivée, porte refermée, cheminée. Plateau repas Terre&nbsp;&amp; Mer
dressé pour deux si vous l'avez choisi, crémant de Bourgogne au frais. Puis le spa, sans horaire.</p></div>
<div class="step"><h3>Samedi</h3><p>Petit-déjeuner artisanal livré le matin. Sens et son centre historique à dix
minutes, ou les vignobles de Chablis à une heure. Retour pour le sauna en fin de journée.</p></div>
<div class="step"><h3>Dimanche</h3><p>Véranda, jardin, chemins de halage le long de l'Yonne au départ du village.
Départ tardif possible en option.</p></div>
</div>
</section>

<section class="wrap"><h2>Autour&nbsp;: la Bourgogne du Nord</h2>
<p><strong>Sens</strong>, à dix minutes&nbsp;: la cathédrale Saint-Étienne, première grande cathédrale gothique de
France, les halles couvertes, les musées, les tables du centre. <strong>Chablis</strong> et
<strong>Auxerre</strong> à environ une heure pour les vignobles et les bords de l'Yonne.
<strong>Fontainebleau</strong>, <strong>Provins</strong> et la forêt d'Othe à moins d'une heure.</p>
<p>Et si vous ne voulez rien voir du tout, c'est prévu aussi&nbsp;: la cuisine est équipée, la table est dressée
pour deux, et le jardin est privatif.</p>
{galerie('galWe')}
</section>

<section class="wrap"><h2>Offrir le week-end</h2>
<p>Anniversaire, Saint-Valentin, demande à faire, dix ans de mariage&nbsp;: une
<a href="{CADEAU}" target="_blank" rel="noopener">carte cadeau</a> permet d'offrir la nuit sans figer la date.
Les options — sauna, crémant, plateau repas, petit-déjeuner artisanal — s'ajoutent ensuite au moment de réserver.</p>
<div class="cards" style="margin-top:26px">
<div class="card"><div class="ico">🎁</div><h3>Carte cadeau</h3><p>La nuit s'offre&nbsp;; la date se choisit plus tard,
selon les disponibilités.</p></div>
<div class="card"><div class="ico">🥂</div><h3>Les attentions</h3><p>Crémant de Bourgogne, plateau repas
Terre&nbsp;&amp; Mer, petit-déjeuner artisanal livré le matin.</p></div>
<div class="card"><div class="ico">✨</div><h3>Sur mesure</h3><p>Label Maison Conciergerie peut préparer
<a href="/shopping">attentions et achats</a> avant l'arrivée, ou <a href="/billetterie">billetterie</a> et
<a href="/activites">activités</a> pour prolonger l'escapade.</p></div>
</div>
</section>
"""

faq3 = [
    ("Où passer un week-end romantique en Bourgogne&nbsp;?",
     "Ba'cam Spa, à Etigny (89510) dans la vallée de l'Yonne, est une love room entièrement privatisée avec spa à débordement, sauna traditionnel, hammam et table de massage, à dix minutes de Sens et environ une heure trente de Paris."),
    ("Que faire autour pendant le week-end&nbsp;?",
     "Sens et son centre historique à dix minutes, les vignobles de Chablis et Auxerre à environ une heure, Fontainebleau, Provins et la forêt d'Othe à moins d'une heure, et les chemins de halage le long de l'Yonne à pied ou à vélo au départ du village."),
    ("Peut-on offrir le séjour&nbsp;?",
     "Oui, une carte cadeau est disponible&nbsp;: elle permet d'offrir la nuit sans fixer la date, que les bénéficiaires choisissent ensuite selon les disponibilités."),
    ("Le petit-déjeuner est-il compris&nbsp;?",
     "Le petit-déjeuner artisanal — pain frais, croissant, beurre, confiture, jus d'orange, lait, café ou thé — est proposé en option, comme le plateau repas Terre &amp; Mer et le crémant de Bourgogne."),
    ("Combien de personnes le lieu accueille-t-il&nbsp;?",
     "Le lieu est conçu pour deux personnes et n'accueille qu'un seul couple à la fois&nbsp;: rien n'est partagé."),
    ("Peut-on rester plusieurs nuits&nbsp;?",
     "Oui&nbsp;: les disponibilités s'affichent en direct au moment de la réservation, nuit par nuit. L'arrivée anticipée et le départ tardif sont proposés en option."),
]

page(
    "week-end-romantique-bourgogne",
    "Week-end romantique en Bourgogne — love room &amp; spa privatif (89)",
    "Week-end romantique en Bourgogne dans une love room privatisée : spa à débordement, sauna, hammam, table de massage. À 10 min de Sens, 1 h 30 de Paris. Dès 249 € la nuit.",
    "Week-end romantique en Bourgogne, en love room avec spa privatif",
    "À Etigny, dans la vallée de l'Yonne&nbsp;: le logement entier pour vous deux, spa à débordement, sauna traditionnel, hammam et jardin privatif. Sens à dix minutes, Chablis à une heure.",
    ["Logement <b>entier</b>", "Spa &amp; <b>hammam</b> compris", "<b>Carte cadeau</b>", "Dès <b>249 €</b> la nuit"],
    "nv-jardin.jpg",
    "Jardin privatif sous pergola de la love room Ba'cam Spa, week-end romantique en Bourgogne",
    [("Accueil", "/"), ("Love room à Sens", "/love-room-sens"), ("Week-end romantique en Bourgogne", f"{SITE}/week-end-romantique-bourgogne")],
    corps3, faq3, "Questions fréquentes — week-end romantique en Bourgogne",
    "Réservez votre week-end à deux",
    "Le logement entier pour vous seuls, spa à débordement et sauna privatifs, dès 249&nbsp;€ la nuit. Carte cadeau disponible.",
    ('<a href="/bacam-spa">La visite filmée de Ba\'cam Spa</a>'
     '<a href="/love-room-sens">Love room à Sens (89)</a>'
     '<a href="/love-room-proche-paris">Love room près de Paris</a>'
     '<a href="/conciergerie-airbnb-sens">Conciergerie Airbnb dans l\'Yonne</a>'),
)
print("Terminé.")
