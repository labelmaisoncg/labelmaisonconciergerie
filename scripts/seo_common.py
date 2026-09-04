# -*- coding: utf-8 -*-
"""Briques communes aux générateurs de silos SEO (public/*.html).

Toutes les pages statiques partagent le même gabarit que les silos existants
(/css/seo-silo.css) : même header, même footer, même formulaire branché sur
/api/contact via /js/audit-form.js. Ce module centralise ces briques pour que
les nouveaux silos (Paris, France, services) restent cohérents avec
/conciergerie-privee-paris et /conciergerie-airbnb-massy.

Règles maison respectées ici :
  - aucun avis, note ou statistique inventés (cf. mémoire « no fake reviews ») ;
  - uniquement des photos réelles de public/images/real ;
  - or utilisé avec parcimonie, la mise en forme vient de seo-silo.css.
"""
from __future__ import annotations

import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public"

SITE = "https://www.labelmaisoncg.fr"
TEL = "+33 7 49 54 83 55"
TEL_URI = "+33749548355"
WA = "https://wa.me/33749548355"
MAIL = "labelmaisonconciergerie@gmail.com"
INSTA = "https://www.instagram.com/labelmaisoncg/"
TIKTOK = "https://www.tiktok.com/@labelmaison.cg"
LOGO = f"{SITE}/images/logo-label-maison.jpg"

FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@500;600;700'
    "&family=Figtree:wght@400;500;600;700;800"
    "&family=Playfair+Display:ital,wght@0,600;0,700;1,400;1,600"
    '&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/seo-silo.css">'
)
ICONS = (
    '<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">'
    '<link rel="icon" type="image/png" sizes="512x512" href="/images/favicon.png">'
    '<link rel="apple-touch-icon" href="/images/apple-touch-icon.png">'
)

# Photos réelles réutilisables (rotation par index pour éviter la répétition).
PHOTOS_LOGEMENT = [
    ("real/logement-hero.jpg", "Séjour d'un logement géré par Label Maison Conciergerie"),
    ("real/residence-chambre.jpg", "Chambre préparée pour une arrivée voyageur"),
    ("real/logement-suite.jpg", "Suite meublée gérée en location courte durée"),
    ("real/residence-penthouse.jpg", "Penthouse géré par notre conciergerie"),
    ("real/logement-salon-poster.jpg", "Salon d'un appartement en gestion locative"),
    ("real/residence-villa.jpg", "Villa gérée par Label Maison Conciergerie"),
    ("real/logement-chambre2-poster.jpg", "Chambre dressée avec linge hôtelier"),
    ("real/gestion-villa.jpg", "Préparation d'un bien avant l'arrivée des voyageurs"),
    ("real/logement-sdb-poster.jpg", "Salle de bain préparée avec produits d'accueil"),
    ("real/suite-hotel.jpg", "Intérieur d'exception géré par Label Maison Conciergerie"),
    ("real/proof-logement-poster.jpg", "Logement remis en état après un séjour"),
    ("real/jacuzzi.jpg", "Bien d'exception avec espace bien-être"),
    ("real/hero-logement-exception.jpg", "Logement d'exception en gestion clé en main"),
    ("real/proof-arrivee-poster.jpg", "Arrivée voyageur préparée par la conciergerie"),
]


# Photographies de ville sous licence libre (Wikimedia Commons), stockées dans
# public/images/villes/<slug>/. Ce sont de vraies photographies — jamais d'IA ni
# de banque d'images générique — et chaque cliché porte son crédit auteur +
# licence, comme l'exigent les licences Creative Commons.
# Format : (fichier, largeur, hauteur, alt, légende, auteur, licence, url_licence, url_source)
PHOTOS_VILLE = {
    "dijon": [
        ("villes/dijon/place-liberation-nuit.webp", 1600, 800,
         "La place de la Libération et le palais des Ducs de Bourgogne illuminés la nuit, à Dijon",
         "La place de la Libération et le palais des Ducs : le périmètre le plus demandé en courte "
         "durée. La quasi-totalité des voyageurs cherchent un logement à moins de dix minutes à pied "
         "d'ici.",
         "Benjamin Smith", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0",
         "https://commons.wikimedia.org/wiki/File:Dijon_-_Place_de_la_Lib%C3%A9ration_-_Nuit_-_01.jpg"),
        ("villes/dijon/palais-des-ducs.webp", 1000, 500,
         "Le palais des Ducs et des États de Bourgogne, place de la Libération à Dijon",
         "Le palais des Ducs, départ du parcours de la Chouette : les séjours de deux à trois nuits "
         "s'organisent presque tous dans ce rayon.",
         "Benjamin Smith", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0",
         "https://commons.wikimedia.org/wiki/File:Dijon_-_Palais_des_Ducs_et_des_%C3%89tats_de_Bourgogne_-_01.jpg"),
        ("villes/dijon/place-francois-rude.webp", 1000, 618,
         "Maisons à pans de bois et carrousel place François-Rude, dans le centre historique de Dijon",
         "Place François-Rude, ses pans de bois et ses terrasses, à deux pas des Halles : l'argument "
         "qui fait accepter une nuitée plus élevée.",
         "Benjamin Smith", "CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0",
         "https://commons.wikimedia.org/wiki/File:Dijon_-_Place_Fran%C3%A7ois_Rude_-_1.jpg"),
        ("villes/dijon/vieille-ville-notre-dame.webp", 1000, 668,
         "Rue du centre ancien de Dijon menant à l'église Notre-Dame",
         "Le secteur Notre-Dame et ses rues piétonnes : hypercentre, commerces, tout à pied — c'est "
         "ce que filtre en premier un voyageur qui arrive en train.",
         "eugene_o", "CC BY 2.0", "https://creativecommons.org/licenses/by/2.0",
         "https://commons.wikimedia.org/wiki/File:20180628_-_Dijon_-_3_(43797528152).jpg"),
        ("villes/dijon/route-des-grands-crus.webp", 1000, 580,
         "Vignoble de la Côte de Nuits, sur la route des Grands Crus au sud de Dijon",
         "La Côte de Nuits commence à vingt minutes au sud. L'œnotourisme réserve court — deux à "
         "trois nuits — mais toute l'année, et à un budget élevé.",
         "Stefan Bauer", "CC BY-SA 2.5", "https://creativecommons.org/licenses/by-sa/2.5",
         "https://commons.wikimedia.org/wiki/File:Weinberg_Cote_de_Nuits.jpg"),
    ],
}


def esc(s: str) -> str:
    return html.escape(s, quote=True)


def slugify(s: str) -> str:
    s = (
        s.lower()
        .replace("é", "e").replace("è", "e").replace("ê", "e").replace("ë", "e")
        .replace("à", "a").replace("â", "a").replace("ä", "a")
        .replace("î", "i").replace("ï", "i")
        .replace("ô", "o").replace("ö", "o")
        .replace("û", "u").replace("ù", "u").replace("ü", "u")
        .replace("ç", "c").replace("'", "-").replace("’", "-")
    )
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def photo(i: int) -> tuple[str, str]:
    return PHOTOS_LOGEMENT[i % len(PHOTOS_LOGEMENT)]


# --------------------------------------------------------------------------- #
#  Données structurées
# --------------------------------------------------------------------------- #
def ld(obj: dict) -> str:
    return (
        '<script type="application/ld+json">'
        + json.dumps(obj, ensure_ascii=False)
        + "</script>"
    )


def ld_business(name_suffix: str, url: str, desc: str, ville: str, region: str,
                cp: str = "", pays: str = "FR", geo: tuple | None = None,
                area: list | None = None) -> dict:
    o = {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        "name": f"Label Maison Conciergerie{name_suffix}",
        "image": LOGO,
        "url": url,
        "telephone": TEL,
        "email": MAIL,
        "priceRange": "€€€",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": ville,
            "addressRegion": region,
            "addressCountry": pays,
        },
        "areaServed": [{"@type": "City", "name": a} for a in (area or [ville])],
        "sameAs": [INSTA, TIKTOK],
        "description": desc,
        "openingHoursSpecification": [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday",
                          "Friday", "Saturday", "Sunday"],
            "opens": "08:00", "closes": "22:00",
        }],
    }
    if cp:
        o["address"]["postalCode"] = cp
    if geo:
        o["geo"] = {"@type": "GeoCoordinates",
                    "latitude": str(geo[0]), "longitude": str(geo[1])}
    return o


def ld_service(service_type: str, area: str, url: str, desc: str,
               offers: list | None = None) -> dict:
    o = {
        "@context": "https://schema.org",
        "@type": "Service",
        "serviceType": service_type,
        "provider": {
            "@type": "LocalBusiness",
            "name": "Label Maison Conciergerie",
            "telephone": TEL,
            "url": SITE + "/",
        },
        "areaServed": area,
        "url": url,
        "description": desc,
    }
    if offers:
        o["hasOfferCatalog"] = {
            "@type": "OfferCatalog",
            "name": service_type,
            "itemListElement": [
                {"@type": "Offer", "itemOffered": {"@type": "Service", "name": n}}
                for n in offers
            ],
        }
    return o


def ld_faq(items: list) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {"@type": "Question", "name": q,
             "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}}
            for q, a in items
        ],
    }


def ld_breadcrumb(trail: list) -> dict:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u}
            for i, (n, u) in enumerate(trail)
        ],
    }


def strip_tags(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


# --------------------------------------------------------------------------- #
#  Blocs de page
# --------------------------------------------------------------------------- #
LOCKUP = (
    '<span class="lockup"><img class="lk-key" src="/images/key-gold-deep.png" '
    'alt="Label Maison Conciergerie"><span class="lk-div" aria-hidden="true"></span>'
    '<span class="lk-tx"><span class="lk-name">LABEL MAISON</span>'
    '<span class="lk-sub">CONCIERGERIE</span></span></span>'
)


def head(title: str, desc: str, path: str, jsonlds: list,
         image: str = LOGO) -> str:
    url = SITE + path
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">{ICONS}
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{url}">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="author" content="Label Maison Conciergerie">
<meta name="geo.region" content="FR">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Label Maison Conciergerie">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#A97C30">
{FONTS}
{chr(10).join(ld(o) for o in jsonlds)}
</head>
<body>"""


def header(nav: list) -> str:
    links = "".join(f'<a class="lnk" href="{h}">{esc(l)}</a>' for l, h in nav)
    return (
        '<header class="top"><div class="topbar">'
        f'<a class="brand" href="/" aria-label="Label Maison Conciergerie - Accueil">{LOCKUP}</a>'
        f'<nav class="topnav">{links}'
        f'<a class="phone" href="tel:{TEL_URI}">{TEL}</a></nav></div></header>'
    )


def hero(badge: str, h1: str, sub: str, img: str, alt: str,
         puces: list, cta1: str = "Recevoir mon estimation",
         cta2: str = "Nous appeler") -> str:
    b = "".join(f'<span class="badge">{p}</span>' for p in puces)
    return (
        '<section class="hero"><div class="wrap hero-grid"><div class="hero-copy">'
        f'<span class="hero-badge">{esc(badge)}</span><h1>{h1}</h1>'
        f'<p class="sub">{sub}</p>'
        f'<div class="cta"><a class="btn" href="#contact-form">{esc(cta1)}</a>'
        f'<a class="btn ghost" href="tel:{TEL_URI}">{esc(cta2)}</a></div>'
        f'<div class="badges">{b}</div></div>'
        f'<div class="hero-media"><img src="/images/{img}" alt="{esc(alt)}" '
        'loading="eager" decoding="async" width="1200" height="900"></div>'
        "</div></section>"
    )


def crumb(trail: list) -> str:
    """Fil d'Ariane visible (le JSON-LD est ajouté à part)."""
    parts = []
    for i, (n, u) in enumerate(trail):
        parts.append(f'<a href="{u}">{esc(n)}</a>' if i < len(trail) - 1 else f"<span>{esc(n)}</span>")
    return '<nav class="wrap crumb" aria-label="Fil d\'Ariane">' + " › ".join(parts) + "</nav>"


def texte(paras: list, titre: str = "", lead: str = "", pad: bool = False) -> str:
    st = ' style="padding-top:20px"' if pad else ""
    h = f"<h2>{titre}</h2>" if titre else ""
    l = f'<p class="lead">{lead}</p>' if lead else ""
    p = "".join(f"<p>{x}</p>" for x in paras)
    return f'<section class="wrap"{st}>{h}{l}{p}</section>'


def cartes(titre: str, lead: str, items: list, cols: str = "g3", ident: str = "") -> str:
    c = "".join(f"<div class=\"card\"><h3>{t}</h3><p>{d}</p></div>" for t, d in items)
    i = f' id="{ident}"' if ident else ""
    l = f'<p class="lead">{lead}</p>' if lead else ""
    return (f'<section class="wrap"{i}><h2>{titre}</h2>{l}'
            f'<div class="grid {cols}" style="margin-top:30px">{c}</div></section>')


def etapes(titre: str, items: list) -> str:
    s = "".join(f"<div class=\"step\"><h3>{t}</h3><p>{d}</p></div>" for t, d in items)
    return (f'<section class="wrap"><h2>{titre}</h2>'
            f'<div class="steps" style="margin-top:34px">{s}</div></section>')


def galerie(idg: str, photos: list) -> str:
    figs = "".join(
        f'<figure><img src="/images/{f}" alt="{esc(a)}" loading="lazy" '
        'decoding="async" width="900" height="675"></figure>' for f, a in photos)
    return (f'<section class="wrap"><h2>Nos biens gérés en images</h2>'
            f'<div class="hscroll-wrap"><div class="hscroll" id="{idg}">{figs}</div>'
            f'<div class="hscroll-nav">'
            f'<button type="button" onclick="gal(\'{idg}\',-1)" aria-label="Photo précédente">&larr;</button>'
            f'<button type="button" class="next" onclick="gal(\'{idg}\',1)" aria-label="Photo suivante">&rarr;</button>'
            "</div></div>"
            "<script>function gal(i,d){var e=document.getElementById(i);"
            'e.scrollBy({left:d*Math.max(280,e.clientWidth*0.8),behavior:"smooth"});}</script>'
            "</section>")


def _fig_ville(f, w, h, alt, legende, auteur, lic, licurl, src, eager=False) -> str:
    credit = (f'<span class="vg-credit">© <a href="{src}" rel="nofollow noopener" '
              f'target="_blank">{esc(auteur)}</a> · '
              f'<a href="{licurl}" rel="nofollow noopener license" target="_blank">{esc(lic)}</a>'
              "</span>")
    return (f'<figure class="vg-fig"><img src="/images/{f}" alt="{esc(alt)}" '
            f'loading="{"eager" if eager else "lazy"}" decoding="async" width="{w}" height="{h}">'
            f'<figcaption>{esc(legende)} {credit}</figcaption></figure>')


def galerie_ville(slug: str, nom: str, lead: str = "") -> str:
    """Bande photo de la ville elle-même (photos libres de droits, créditées).

    Rend une section vide si la ville n'a pas encore de photos : la fonction
    peut donc être appelée sur toutes les pages d'un silo sans condition.
    """
    photos = PHOTOS_VILLE.get(slug)
    if not photos:
        return ""
    hero = _fig_ville(*photos[0], eager=False)
    tiles = "".join(_fig_ville(*p) for p in photos[1:])
    l = f'<p class="lead">{lead}</p>' if lead else ""
    return (f'<section class="wrap"><h2>{esc(nom)}, le terrain que nous couvrons</h2>{l}'
            f'<div class="villegal"><div class="vg-hero">{hero}</div>'
            f'<div class="vg-grid">{tiles}</div></div>'
            f'<p class="vg-note">Photographies de {esc(nom)} sous licence Creative Commons, '
            "redimensionnées pour le web. Les photos de logements présentées sur cette page sont "
            "celles de biens réellement gérés par nos équipes.</p></section>")


def zones(titre: str, lead: str, links: list, extra: str = "") -> str:
    z = "".join(f'<a href="{u}">{esc(n)}</a>' for n, u in links)
    l = f'<p class="lead">{lead}</p>' if lead else ""
    e = f'<p style="margin-top:34px">{extra}</p>' if extra else ""
    return (f'<section class="wrap" id="zones"><h2>{titre}</h2>{l}'
            f'<div class="zones" style="margin-top:24px">{z}</div>{e}</section>')


def faq(titre: str, items: list) -> str:
    d = "".join(
        f"<details><summary>{esc(q)}</summary><div class=\"ans\">{a}</div></details>"
        for q, a in items)
    return f'<section class="wrap" id="faq"><h2>{titre}</h2>{d}</section>'


def formulaire(titre: str, texte_intro: str, ville: str, service: str,
               page_title: str) -> str:
    return f"""<section class="wrap" id="contact-form"><div class="band">
<div class="grid g2" style="gap:26px;align-items:center">
<div>
<h2>{titre}</h2>
<p style="color:rgba(255,255,255,.85)">{texte_intro}</p>
<p style="color:rgba(255,255,255,.85)">📞 <a href="tel:{TEL_URI}" style="color:#fff;font-weight:700">{TEL}</a><br>✉️ <a href="mailto:{MAIL}" style="color:#fff">{MAIL}</a></p>
<a class="btn gold" href="{WA}" rel="nofollow">Discuter sur WhatsApp</a>
</div>
<div class="formcard">
<form class="auditform" action="/api/contact" method="POST" novalidate>
<div class="formgrid">
<div><label>Prénom *</label><input name="prenom" required></div>
<div><label>Téléphone *</label><input name="telephone" type="tel" required></div>
<div class="full"><label>E-mail *</label><input name="email" type="email" required></div>
<div><label>Ville / secteur</label><input name="ville" value="{esc(ville)}"></div>
<div><label>Votre besoin</label><input name="type" value="{esc(service)}"></div>
<div class="full"><label>Votre demande</label><textarea name="message" rows="3" placeholder="Type de bien, dates, objectif…"></textarea></div>
<input type="text" name="website" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
<input type="hidden" name="page" value="{esc(page_title)}">
<div class="full"><button class="btn" style="width:100%" type="submit">Envoyer ma demande</button></div>
</div>
<p class="disc" style="margin-top:10px">En envoyant ce formulaire, vous acceptez d'être recontacté par Label Maison Conciergerie. Vos données ne sont jamais revendues.</p>
</form>
</div>
</div>
</div></section>"""


def footer(cols: list, tagline: str, lieu: str) -> str:
    """cols : liste de (titre, [(label, href), …]) — 2 colonnes de liens."""
    c = ""
    for titre, links in cols:
        li = "".join(f'<li><a href="{u}">{esc(n)}</a></li>' for n, u in links)
        c += f"<div><h4>{esc(titre)}</h4><ul>{li}</ul></div>"
    return (
        '<footer id="contact"><div class="wrap fcols">'
        f'<div class="fbrand">{LOCKUP}<p class="ftag">{tagline}</p>'
        '<ul style="list-style:none;padding:0;margin:14px 0 0">'
        f'<li>📧 <a href="mailto:{MAIL}">{MAIL}</a></li>'
        f'<li>📞 <a href="tel:{TEL_URI}">{TEL}</a></li>'
        f"<li>📍 {esc(lieu)}</li></ul>"
        '<div style="margin-top:24px;display:flex;gap:10px;flex-wrap:wrap">'
        f'<a href="{INSTA}" target="_blank" rel="noopener">Instagram @labelmaisoncg</a>'
        f'<a href="{TIKTOK}" target="_blank" rel="noopener">TikTok @labelmaison.cg</a>'
        f"</div></div>{c}</div>"
        '<div class="wrap fbot"><span>© 2026 Label Maison Conciergerie · Tous droits réservés</span>'
        "<span>Paris · France · Marrakech · Dubaï</span></div></footer>"
    )


def mobcta(label: str = "Faire une demande") -> str:
    return (f'<div class="mobcta"><a class="btn ghost" href="tel:{TEL_URI}">Appeler</a>'
            f'<a class="btn" href="#contact-form">{esc(label)}</a></div>')


TAIL = '<script defer src="/js/audit-form.js"></script></body></html>'


# Marqueur des pages produites par le générateur de masse (communes/départements/
# régions). Il permet de les distinguer des silos écrits à la main, notamment pour
# ne pas les prendre pour des pages « déjà couvertes » lors d'une régénération.
MARQUEUR_AUTO = "<!-- lm:auto-commune -->"


def write(slug: str, parts: list, auto: bool = False) -> pathlib.Path:
    p = OUT / f"{slug}.html"
    # Les blocs optionnels (galerie ville…) renvoient "" quand ils n'ont rien à
    # afficher : on les écarte pour ne pas laisser de ligne vide dans le HTML.
    corps = "\n".join(x for x in parts if x) + "\n" + TAIL
    if auto:
        corps = MARQUEUR_AUTO + "\n" + corps
    p.write_text(corps, encoding="utf-8")
    return p
