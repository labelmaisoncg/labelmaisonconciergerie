# -*- coding: utf-8 -*-
"""Pages « Sourcing immobilier en Chine » : page principale, Paris, Dubaï, Marrakech, anglais.

Pages d'atterrissage pensées pour le référencement : HTML statique servi tel quel
par Vercel (cleanUrls), styles et script en ligne pour un affichage immédiat,
données structurées (Service, FAQ, fil d'Ariane), hreflang entre le français et
l'anglais. Les textes sont dans sourcing_contenu.py.

Tous les boutons ouvrent WhatsApp avec un message pré-rempli adapté à la
section et à la ville (le visiteur n'a plus qu'à compléter).

Le visuel du haut (pièces « avant » qui traversent la clé Label Maison et
ressortent « après ») utilise des visuels d'illustration, signalés comme tels
sous l'animation ; un bouton permet de la mettre en pause, et elle reste figée
pour les visiteurs qui ont demandé à réduire les animations.

Usage : python3 scripts/gen_sourcing_chine.py

Indexation rapide : le fichier public/5d80ec79afb4f08019386c80a22eabfe.txt est la preuve de propriété du
site pour IndexNow (Bing, Yandex, Seznam, Naver). Il est public par principe (le
protocole impose qu'il soit lisible à la racine du site) : ce n'est pas un secret.
"""
from __future__ import annotations

import json
import re
from urllib.parse import quote

import seo_common as C
from sourcing_contenu import LOCALES, PAGES, PRINCIPALE

# --------------------------------------------------------------------------- #
#  Typographie : espace insécable avant ? ! : ; et dans « » (pages françaises),
#  apostrophe typographique partout.
# --------------------------------------------------------------------------- #
NBSP = "\u00a0"
FINE = "\u202f"
LANGUE = "fr"


def fr(s: str) -> str:
    s = s.replace("'", "’")
    if LANGUE != "fr":
        return s
    s = re.sub(r" ([?!;])", FINE + r"\1", s)
    s = re.sub(r" :", NBSP + ":", s)
    return s.replace("« ", "«" + NBSP).replace(" »", NBSP + "»")


def t(s: str) -> str:
    """Texte visible : typographie puis échappement HTML."""
    return C.esc(fr(s))


def t_brut(s: str) -> str:
    """Texte des données structurées (pas d'échappement HTML)."""
    return fr(s)


def t_html(s: str) -> str:
    """Texte qui contient des <em> d'emphase : seul le texte autour est échappé."""
    return "".join(x if x in ("<em>", "</em>") else t(x) for x in re.split(r"(</?em>)", s))


def wa(message: str) -> str:
    return f"{C.WA}?text={quote(message)}"


# --------------------------------------------------------------------------- #
#  Icônes (trait 1,6, couleur héritée)
# --------------------------------------------------------------------------- #
def svg(corps: str, cls: str = "") -> str:
    c = f' class="{cls}"' if cls else ""
    return (f'<svg{c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{corps}</svg>')


ICO_WA = (
    '<svg class="ico-wa" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" '
    'd="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 '
    '1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297'
    '-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149'
    '-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297'
    '-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 '
    '1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124'
    '-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 '
    '9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 '
    '6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 '
    '11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 '
    '11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'
)

ICO = {
    "cuisine": svg('<path d="M3 10.5h18"/><path d="M4 10.5V20h16v-9.5"/><path d="M12 10.5V20"/>'
                   '<path d="M8.5 14h1M14.5 14h1"/><path d="M15 10.5V6.2a2.2 2.2 0 0 1 4.4 0v.8"/>'),
    "bain": svg('<path d="M3 12h18v1.5A5.5 5.5 0 0 1 15.5 19h-7A5.5 5.5 0 0 1 3 13.5z"/>'
                '<path d="M6 12V6.5a2.5 2.5 0 0 1 5 0"/><path d="M7 19l-1 2M17 19l1 2"/>'),
    "mobilier": svg('<path d="M5.5 11V8.5a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3V11"/>'
                    '<path d="M3 13.5a2 2 0 0 1 4 0V15h10v-1.5a2 2 0 0 1 4 0V18H3z"/><path d="M5 18v2M19 18v2"/>'),
    "complet": svg('<path d="M3 10.5 12 4l9 6.5"/><path d="M5 9v11h14V9"/><path d="M5 14.5h6.5V20"/>'
                   '<path d="M11.5 9.5v2"/>'),
    "budget": svg('<path d="M12 4v16M8 20h8"/><path d="M5 7h14"/><path d="M5 7 2.5 13a2.6 2.6 0 0 0 5 0z"/>'
                  '<path d="M19 7l-2.5 6a2.6 2.6 0 0 0 5 0z"/>'),
    "perso": svg('<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/>'
                 '<circle cx="9" cy="17" r="2"/>'),
    "centraliser": svg('<path d="M12 3.5 20.5 8 12 12.5 3.5 8z"/><path d="m3.5 12 8.5 4.5 8.5-4.5"/>'
                       '<path d="m3.5 16 8.5 4.5 8.5-4.5"/>'),
    "accompagne": svg('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
    "info": svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.1"/>'),
    "immeuble": svg('<path d="M5 21V4h10v17M15 9h4v12M3 21h18"/>'
                    '<path d="M8 8h1M11 8h1M8 12h1M11 12h1M8 16h1M11 16h1"/>'),
    "plusieurs": svg('<path d="M2.5 11 8 6.5l5.5 4.5"/><path d="M4 10v9h8v-9"/><path d="M12.5 9.5 16 6.5l5.5 4.5"/>'
                     '<path d="M20 10v9h-8"/>'),
    "renovation": svg('<rect x="4" y="3.5" width="13" height="5" rx="1.2"/><path d="M17 6h2.5v5.5H11V14"/>'
                      '<path d="M9.8 14h2.4v6.5H9.8z"/>'),
    "fleche": '<span class="fl" aria-hidden="true">→</span>',
}


# --------------------------------------------------------------------------- #
#  Styles
# --------------------------------------------------------------------------- #
CSS = r"""
:root{
  --fond:#F8F4EB;--fond-2:#F1EADB;--carte:#FFFDF8;--encre:#2B2114;--texte-2:#5E4E35;--doux:#8C7B60;
  --or:#A97C30;--or-fonce:#7C561D;--or-clair:#C39A4A;--champagne:#D5C69F;--filet:#E6DCC6;
  --ombre:0 1px 2px rgba(43,33,20,.04),0 18px 40px -22px rgba(43,33,20,.28);
}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:96px}
body{margin:0;background:var(--fond);color:var(--encre);font:400 17px/1.6 'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
img,svg{display:block;max-width:100%}
img{height:auto}
a{color:inherit}
h1,h2,h3,h4{margin:0;font-weight:600;letter-spacing:-.022em;line-height:1.08;color:var(--encre)}
p,ul,ol{margin:0}
em{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;letter-spacing:-.005em;color:var(--or-fonce)}
.env{width:min(1160px,calc(100% - 32px));margin-inline:auto}
.saut{position:absolute;left:16px;top:-60px;z-index:100;background:var(--encre);color:#fff;padding:12px 16px;border-radius:10px;text-decoration:none}
.saut:focus{top:12px}
:focus-visible{outline:2px solid var(--encre);outline-offset:3px;border-radius:10px}
.vh{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}

/* Logo */
.lockup{display:inline-flex;align-items:center;gap:12px;font-family:'Cormorant','Cormorant Garamond',Georgia,serif;line-height:1;color:#403118}
.lk-key{height:auto;filter:drop-shadow(0 2px 8px rgba(120,90,30,.22))}
.lk-div{align-self:stretch;width:1px;min-height:1.5em;background:linear-gradient(180deg,transparent,#c2ab74,transparent)}
.lk-tx{display:flex;flex-direction:column}
.lk-name{font-weight:600;letter-spacing:.06em;white-space:nowrap;color:#403118}
.lk-sub{color:#8a6f34;letter-spacing:.46em;text-indent:.46em;white-space:nowrap;margin-top:.34em}

/* Barre du haut : copie de la navigation du site (src/app/components/Navigation.tsx + BrandLogo) */
.brandlogo{--gold:#8a6f34;--gold-line:#a8813a;--ink:#403118;font-family:'Cormorant','Cormorant Garamond',Georgia,serif;display:inline-flex;align-items:center;line-height:1;color:var(--ink);user-select:none}
.brandlogo .bl-key-wrap{position:relative;display:inline-block;line-height:0}
.brandlogo .bl-key{display:block;width:100%;height:auto;filter:drop-shadow(0 2px 8px rgba(120,90,30,.22))}
.brandlogo .bl-text{display:flex;flex-direction:column}
.brandlogo .bl-name{font-weight:600;font-size:1em;color:var(--ink);white-space:nowrap}
.brandlogo .bl-sub{display:flex;align-items:center;color:var(--gold);white-space:nowrap}
.brandlogo .bl-conc{display:inline-block}
.brandlogo .bl-rule{height:1px;display:inline-block}
.bl-stacked{flex-direction:column}
.bl-stacked .bl-key-wrap{width:5em;margin-bottom:.5em;align-self:center}
.bl-stacked .bl-text{align-items:center}
.bl-stacked .bl-name{letter-spacing:.08em;text-align:center}
.bl-stacked .bl-sub{font-size:.367em;letter-spacing:.5em;text-indent:.5em;margin-top:.5em;gap:.9em}
.bl-stacked .bl-rule{width:2.4em}
.bl-stacked .bl-rule-l{background:linear-gradient(90deg,transparent,var(--gold-line))}
.bl-stacked .bl-rule-r{background:linear-gradient(90deg,var(--gold-line),transparent)}
.site-nav{position:sticky;top:0;z-index:50;background:#fff;transition:box-shadow .2s}
.site-nav.defile{box-shadow:0 4px 24px rgba(64,49,24,.07)}
.sn-bureau{display:none}
.sn-bureau .sn-in{max-width:1152px;margin:0 auto;padding:0 24px;min-height:90px;display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:32px}
.sn-logo{display:flex;align-items:center;text-decoration:none}
.sn-liens{display:flex;align-items:center;justify-content:center;gap:28px;font-size:15px;font-weight:500}
.sn-liens a{color:#404040;text-decoration:none;transition:color .15s}
.sn-liens a:hover{color:#A97C30}
.sn-tel{display:inline-flex;align-items:center;gap:8px;background:#403118;color:#fff;font-weight:700;font-size:14px;padding:12px 20px;border-radius:999px;text-decoration:none;transition:background .15s;white-space:nowrap}
.sn-tel:hover{background:#2C2418}
.sn-tel svg{width:16px;height:16px}
.sn-mobile .sn-in{padding:0 16px;min-height:70px;display:flex;align-items:center;justify-content:space-between}
.sn-actions{display:flex;align-items:center;gap:8px}
.sn-mobile .sn-tel{height:44px;padding:0 14px;font-size:12px;justify-content:center}
.sn-menu{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border:0;border-radius:50%;background:rgba(0,0,0,.05);color:#171717;cursor:pointer}
.sn-menu:hover{background:rgba(0,0,0,.1)}
.sn-menu svg{width:20px;height:20px}
.sn-menu .ico-x{display:none}
.sn-menu[aria-expanded="true"] .ico-x{display:block}
.sn-menu[aria-expanded="true"] .ico-m{display:none}
.sn-tiroir{background:#fff;border-top:1px solid rgba(0,0,0,.05)}
.sn-tiroir[hidden]{display:none}
.sn-tiroir ul{list-style:none;margin:0;padding:16px;display:flex;flex-direction:column}
.sn-tiroir a{display:block;padding:12px 0;font-size:15px;font-weight:500;color:#262626;text-decoration:none}
.sn-tiroir a:hover{color:#A97C30}
@media(min-width:640px){.sn-mobile .sn-tel{font-size:13px;padding:0 16px}}
@media(min-width:768px){.sn-bureau{display:block}.sn-mobile{display:none}}

/* Boutons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:54px;padding:0 28px;border-radius:999px;background:linear-gradient(180deg,#9A6E28,#7C561D);color:#fff;font-weight:600;font-size:16.5px;letter-spacing:-.005em;text-decoration:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 12px 26px -12px rgba(124,86,29,.7);transition:transform .2s ease,box-shadow .2s ease}
.btn:hover{transform:translateY(-1px);box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 16px 32px -12px rgba(124,86,29,.75)}
.btn:active{transform:none}
.btn .ico-wa{width:20px;height:20px;flex:none}
.btn-petit{min-height:44px;padding:0 18px;font-size:15px;box-shadow:inset 0 1px 0 rgba(255,255,255,.22)}
.btn-petit .ico-wa{width:18px;height:18px}
.lien{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:var(--or-fonce);font-weight:600;font-size:16px;text-decoration:none}
.lien .ico-wa{width:18px;height:18px;flex:none}
.lien .fl{transition:transform .2s ease}
.lien:hover .fl{transform:translateX(3px)}
.lien:hover span.txt{text-decoration:underline;text-underline-offset:3px}

/* Héros */
.hero{position:relative;overflow:hidden;padding:48px 0 40px;background:radial-gradient(1100px 560px at 50% -12%,#FFFEFA 0%,rgba(255,254,250,0) 72%),var(--fond)}
.hero-tete{max-width:1120px;margin-inline:auto;text-align:center}
.pastille{display:flex;width:fit-content;align-items:center;gap:10px;margin:0 auto 26px;padding:9px 16px;border:1px solid var(--filet);border-radius:999px;background:rgba(255,255,255,.6);font-size:13px;font-weight:600;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;color:var(--or-fonce)}
.pastille::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--or)}
h1{font-size:clamp(40px,5.6vw,76px);line-height:1.02;letter-spacing:-.038em}
h1 .l{display:block}
.hero-sous{max-width:760px;margin:26px auto 0;font-size:clamp(17px,1.55vw,20px);line-height:1.55;color:var(--texte-2)}
.hero-sous strong{color:var(--encre);font-weight:600}
.hero-cta{display:flex;flex-direction:column;align-items:center;gap:14px;margin-top:34px}
.note{font-size:15px;color:var(--texte-2)}

/* Flux : avant -> clé Label Maison -> après */
.flux{position:relative;width:min(1280px,100%);height:clamp(280px,34vw,460px);margin:36px auto 0;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 8%,#000 92%,transparent 100%)}
.flux svg.lignes{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.flux .lignes path{fill:none;stroke:#D9CBA6;stroke-width:1.5;vector-effect:non-scaling-stroke}
.flux .lignes path.d{stroke:#CDB57E}
.noeud{position:absolute;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:1.5px solid var(--or-clair);background:var(--fond)}
.noeud.p{width:10px;height:10px;margin:-5px 0 0 -5px;border-color:#D9CBA6}
.tuile{position:absolute;left:50%;top:50%;width:clamp(124px,19vw,260px);aspect-ratio:1;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:28%;background:rgba(213,198,159,.16);z-index:3}
.tuile-2{width:84%;aspect-ratio:1;display:grid;place-items:center;border-radius:27%;background:rgba(213,198,159,.24)}
.tuile-3{position:relative;width:78%;aspect-ratio:1;display:grid;place-items:center;align-content:center;gap:10%;border-radius:26%;background:linear-gradient(160deg,#FFFEFA 0%,#F3EAD6 100%);border:1px solid rgba(169,124,48,.26);box-shadow:inset 0 1px 0 #fff,0 22px 50px -22px rgba(124,86,29,.55);transition:box-shadow .6s ease}
.tuile-3 img{width:76%}
.tuile-3 .nom{font-family:'Cormorant',Georgia,serif;font-weight:600;font-size:clamp(9px,1vw,13px);letter-spacing:.2em;text-indent:.2em;color:#403118}
.tuile.recoit .tuile-3{box-shadow:inset 0 1px 0 #fff,0 0 0 8px rgba(195,154,74,.16),0 26px 70px -18px rgba(169,124,48,.75)}
.vignette{position:absolute;left:0;top:0;z-index:2;width:clamp(68px,9.6vw,128px);aspect-ratio:4/5;opacity:0;will-change:transform,opacity;pointer-events:none}
.vignette .cadre{width:100%;height:100%;padding:4px;border-radius:16px;background:#fff;box-shadow:0 14px 30px -14px rgba(43,33,20,.5)}
.vignette img{width:100%;height:100%;object-fit:cover;border-radius:12px}
.vignette.avant img{filter:saturate(.8) contrast(.96)}
.vignette.miroir img{transform:scaleX(-1)}
.etiquette{position:absolute;left:50%;bottom:-13px;transform:translateX(-50%);display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#fff;box-shadow:0 8px 18px -10px rgba(43,33,20,.45);font-size:12px;font-weight:600;line-height:1;white-space:nowrap;color:var(--encre)}
.etiquette::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--or)}
.flux-pied{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px 16px;width:min(1040px,calc(100% - 32px));margin:16px auto 0}
.repere{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--doux)}
.repere.d{text-align:right}
.mention-visuels{text-align:center;font-size:13px;color:var(--doux)}

/* Section propre à la ville */
.local-grille{display:grid;gap:32px}
.local-cartes{display:grid;gap:12px;grid-template-columns:1fr 1fr;align-content:start}
.local-carte{padding:22px 20px;border-radius:22px;background:var(--carte);border:1px solid var(--filet);box-shadow:var(--ombre)}
.local-carte .ico-tuile{width:44px;height:44px;border-radius:14px;margin-bottom:14px}
.local-carte .ico-tuile svg{width:22px;height:22px}
.local-carte h3{font-size:17px;line-height:1.25;letter-spacing:-.012em}
.local-carte p{margin-top:6px;font-size:16px;color:var(--texte-2)}
.local-liens{margin-top:28px;padding-top:20px;border-top:1px solid var(--filet)}
.local-liens h3{margin-bottom:4px;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--or-fonce)}
.local-liens ul{list-style:none;padding:0}
.local-liens a{display:inline-flex;align-items:center;gap:8px;min-height:44px;color:var(--encre);font-weight:500;text-decoration:none}
.local-liens a .fl{color:var(--or-fonce);transition:transform .2s ease}
.local-liens a:hover .txt{text-decoration:underline;text-underline-offset:3px}
.local-liens a:hover .fl{transform:translateX(3px)}
@media(min-width:960px){.local-grille{grid-template-columns:6fr 5fr;gap:72px;align-items:start}}
@media(max-width:520px){.local-cartes{grid-template-columns:1fr}}

/* Destinations */
.villes{display:grid;gap:16px}
.ville{display:flex;flex-direction:column;gap:10px;padding:28px 26px 18px;border-radius:24px;background:var(--carte);border:1px solid var(--filet);box-shadow:var(--ombre);color:inherit;text-decoration:none;transition:transform .2s ease,box-shadow .2s ease}
.ville:hover{transform:translateY(-2px);box-shadow:0 1px 2px rgba(43,33,20,.04),0 24px 48px -24px rgba(43,33,20,.34)}
.ville .nom-ville{font-size:28px;font-weight:600;line-height:1.1;letter-spacing:-.026em}
.ville p{font-size:16px;color:var(--texte-2)}
.ville .lien{margin-top:auto}
.ville:hover .lien .txt{text-decoration:underline;text-underline-offset:3px}
.ville:hover .lien .fl{transform:translateX(3px)}
.autre-langue{margin-top:24px;text-align:center}
@media(min-width:860px){.villes{grid-template-columns:repeat(3,1fr)}}

/* Pause de l'animation */
.flux-centre{display:flex;align-items:center;justify-content:center;gap:12px}
.flux-pause{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;flex:none;border-radius:50%;border:1px solid var(--filet);background:var(--carte);color:var(--or-fonce);cursor:pointer;transition:border-color .2s}
.flux-pause:hover{border-color:var(--champagne)}
.flux-pause svg{width:15px;height:15px}
.flux-pause .ico-lecture{display:none}
.flux-pause[aria-pressed="true"] .ico-lecture{display:block}
.flux-pause[aria-pressed="true"] .ico-pause{display:none}
.flux-pause[hidden]{display:none}

/* Sections */
.section{padding:clamp(72px,10vw,128px) 0}
.section.alt{background:var(--fond-2)}
.tete-section{max-width:780px;margin:0 auto clamp(40px,6vw,64px);text-align:center}
.surtitre{display:block;margin-bottom:16px;font-size:13px;font-weight:600;line-height:1.3;letter-spacing:.16em;text-transform:uppercase;color:var(--or-fonce)}
h2{font-size:clamp(32px,4.6vw,56px);line-height:1.06;letter-spacing:-.032em}
.chapo{margin-top:20px;font-size:clamp(17px,1.5vw,19px);line-height:1.6;color:var(--texte-2)}
.chapo+.chapo{margin-top:12px}

/* Énoncé */
.enonce{max-width:1000px;margin:0 auto;text-align:center;font-size:clamp(26px,3.5vw,44px);font-weight:500;line-height:1.2;letter-spacing:-.026em}
.enonce .doux{color:var(--doux)}
.duo-texte{display:grid;gap:20px;max-width:900px;margin:clamp(36px,5vw,56px) auto 0}
.duo-texte p{font-size:18px;color:var(--texte-2)}
.duo-texte strong{color:var(--encre);font-weight:600}
@media(min-width:860px){.duo-texte{grid-template-columns:1fr 1fr;gap:48px}}

/* Nouvelle dimension */
.duo{display:grid;gap:32px}
.prose p{font-size:18px;color:var(--texte-2)}
.prose p+p{margin-top:18px}
.prose .lead{font-size:clamp(20px,2vw,24px);line-height:1.4;color:var(--encre);font-weight:500;letter-spacing:-.012em}
.citation{margin:32px 0;padding:6px 0 6px 24px;border-left:2px solid var(--or);font-family:'Playfair Display',Georgia,serif;font-style:italic;font-size:clamp(22px,2.3vw,28px);line-height:1.35;color:var(--encre)}
@media(min-width:960px){.duo{grid-template-columns:5fr 6fr;gap:88px;align-items:start}.duo .colle{position:sticky;top:112px}}
.colle h2,.faq-cote h2{font-size:clamp(32px,3.6vw,46px)}

/* Solutions */
.grille-sol{display:grid;gap:20px}
.carte{display:flex;flex-direction:column;padding:32px 28px 20px;border:1px solid var(--filet);border-radius:26px;background:var(--carte);box-shadow:var(--ombre)}
.carte-haut{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px}
.ico-tuile{width:54px;height:54px;display:grid;place-items:center;border-radius:17px;background:linear-gradient(160deg,#FFFEFA,#F1E6CD);border:1px solid rgba(169,124,48,.24);color:var(--or-fonce)}
.ico-tuile svg{width:26px;height:26px}
.num{font-size:13px;font-weight:600;letter-spacing:.14em;color:var(--or-fonce)}
.carte h3{font-size:24px;letter-spacing:-.022em}
.carte p{margin-top:10px;color:var(--texte-2)}
.liste{list-style:none;padding:0;margin:22px 0 18px;border-top:1px solid var(--filet)}
.liste li{display:flex;align-items:baseline;gap:12px;padding:11px 0;border-bottom:1px solid var(--filet);font-size:16px}
.liste li::before{content:"";flex:none;width:5px;height:5px;border-radius:50%;background:var(--or);transform:translateY(-3px)}
.carte .lien{margin-top:auto}
.carte-large{margin-top:20px;display:grid;gap:32px;padding:clamp(32px,5vw,56px);border:1px solid rgba(169,124,48,.3);border-radius:30px;background:radial-gradient(700px 360px at 100% 0%,rgba(195,154,74,.16),transparent 60%),linear-gradient(135deg,#FFFDF8,#F3EBD8);box-shadow:var(--ombre)}
.carte-large h3{font-size:clamp(26px,3vw,34px);letter-spacing:-.026em;max-width:560px}
.carte-large p{margin-top:14px;color:var(--texte-2);max-width:560px}
.carte-large .btn{margin-top:28px}
.compo{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-content:center}
.compo div{display:flex;align-items:center;gap:12px;min-height:64px;padding:12px 16px;border-radius:18px;background:rgba(255,255,255,.75);border:1px solid var(--filet);font-weight:600;font-size:15.5px}
.compo svg{width:24px;height:24px;flex:none;color:var(--or-fonce)}
@media(min-width:980px){.grille-sol{grid-template-columns:repeat(3,1fr)}.carte-large{grid-template-columns:7fr 5fr;align-items:center}}

/* Pourquoi */
.avantages{display:grid;gap:16px;margin-top:8px}
.avantage{padding:28px 24px;border-radius:24px;background:var(--carte);border:1px solid var(--filet)}
.avantage .ico-tuile{margin-bottom:20px}
.avantage h4{font-size:19px;line-height:1.25;letter-spacing:-.015em}
.avantage p{margin-top:8px;font-size:16px;color:var(--texte-2)}
.sous-titre{margin:0 0 24px;text-align:center;font-size:20px;letter-spacing:-.015em}
.note-info{display:flex;gap:14px;align-items:flex-start;max-width:780px;margin:32px auto 0;padding:18px 22px;border-radius:18px;border:1px solid var(--filet);background:rgba(255,255,255,.55);font-size:15.5px;color:var(--texte-2)}
.note-info svg{width:22px;height:22px;flex:none;margin-top:1px;color:var(--or-fonce)}
@media(min-width:700px){.avantages{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1080px){.avantages{grid-template-columns:repeat(4,1fr)}}

/* Méthode */
.etapes{position:relative;list-style:none;padding:0;margin:0;display:grid}
.etape{position:relative;display:grid;grid-template-columns:52px 1fr;gap:0 20px;padding-bottom:36px}
.etape:last-child{padding-bottom:0}
.etape:not(:last-child)::before{content:"";position:absolute;left:26px;top:52px;bottom:0;width:1px;background:linear-gradient(180deg,var(--or-clair),var(--champagne))}
.rond{position:relative;z-index:1;width:52px;height:52px;display:grid;place-items:center;border-radius:50%;background:var(--carte);border:1px solid rgba(169,124,48,.4);box-shadow:0 8px 20px -12px rgba(124,86,29,.5);font-size:17px;font-weight:600;color:var(--or-fonce)}
.etape-txt{padding-top:4px}
.etape .lbl{display:block;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--or-fonce)}
.etape h3{margin:6px 0 8px;font-size:20px;line-height:1.25;letter-spacing:-.016em}
.etape p{font-size:16px;color:var(--texte-2)}
@media(min-width:1000px){
  .etapes{grid-template-columns:repeat(5,1fr);gap:28px}
  .etapes::before{content:"";position:absolute;left:10%;right:10%;top:26px;height:1px;background:linear-gradient(90deg,var(--champagne),var(--or-clair),var(--champagne))}
  .etape{display:block;padding:0;text-align:center}
  .etape:not(:last-child)::before{display:none}
  .rond{margin:0 auto 22px}
}

/* Partenaire */
.questions{display:grid;gap:12px;max-width:1000px;margin:0 auto}
.question{display:flex;align-items:center;gap:16px;padding:20px 22px;border-radius:20px;background:var(--carte);border:1px solid var(--filet);font-weight:600;font-size:17px;line-height:1.35}
.question .ico-tuile{width:46px;height:46px;border-radius:14px;flex:none}
.question .ico-tuile svg{width:22px;height:22px}
@media(min-width:860px){.questions{grid-template-columns:repeat(3,1fr)}}
.vision{max-width:900px;margin:clamp(48px,7vw,80px) auto 0;text-align:center}
.vision .devise{font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:500;font-size:clamp(28px,4vw,48px);line-height:1.2;letter-spacing:-.02em;color:var(--encre)}
.vision .devise span{display:block}
.vision .devise span:nth-child(2){color:var(--or-fonce)}
.vision p{margin-top:20px;font-size:18px;color:var(--texte-2)}
.vision .btn{margin-top:32px}

/* FAQ */
.faq-grille{display:grid;gap:40px}
.faq-cote p{margin-top:18px;color:var(--texte-2)}
.faq-cote .lien{margin-top:12px}
.faq-liste details{border-bottom:1px solid var(--filet)}
.faq-liste details:first-child{border-top:1px solid var(--filet)}
.faq-liste summary{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:44px;padding:22px 0;cursor:pointer;list-style:none}
.faq-liste summary::-webkit-details-marker{display:none}
.faq-liste summary h3{font-size:18px;font-weight:600;line-height:1.35;letter-spacing:-.012em}
.plus{position:relative;flex:none;width:34px;height:34px;border-radius:50%;border:1px solid var(--filet);background:var(--carte);transition:background .25s,border-color .25s}
.plus::before,.plus::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:1.6px;border-radius:2px;background:var(--or-fonce);transform:translate(-50%,-50%)}
.plus::after{transform:translate(-50%,-50%) rotate(90deg);transition:transform .25s ease}
details[open] .plus{border-color:var(--champagne)}
details[open] .plus::after{transform:translate(-50%,-50%) rotate(0deg)}
.faq-liste details p{padding:0 58px 24px 0;color:var(--texte-2)}
summary:hover h3{color:var(--or-fonce)}
@media(min-width:980px){.faq-grille{grid-template-columns:4fr 7fr;gap:88px}.faq-cote{position:sticky;top:112px;align-self:start}}

/* Appel final */
.final{position:relative;overflow:hidden;padding:clamp(56px,8vw,104px) clamp(24px,6vw,88px);border-radius:34px;text-align:center;background:radial-gradient(760px 380px at 50% 0%,rgba(195,154,74,.26),transparent 62%),linear-gradient(180deg,#2F2517,#211910);color:#F3ECDD}
.final .filigrane{position:absolute;right:-70px;bottom:-30px;width:440px;opacity:.07;pointer-events:none}
.final .signature{display:block;margin-bottom:20px;font-size:13px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#D9B66E}
.final h2{color:#F7F0E1}
.final em{color:#D9B66E}
.final p{max-width:640px;margin:18px auto 0;font-size:18px;color:#D4C7A9}
.final .btn{margin-top:36px}
.final .note{margin-top:14px;color:#BFB08F;font-size:15px}
.mention{max-width:780px;margin:28px auto 0;text-align:center;font-size:14px;line-height:1.55;color:var(--texte-2)}

/* Pied de page */
.pied{padding:56px 0 calc(32px + env(safe-area-inset-bottom));background:var(--fond-2);border-top:1px solid var(--filet)}
.pied-grille{display:grid;gap:32px}
.pied .lockup .lk-key{width:104px}.pied .lockup .lk-name{font-size:24px}.pied .lockup .lk-sub{font-size:10px}
.pied-tag{margin-top:16px;max-width:360px;font-size:15.5px;color:var(--texte-2)}
.pied h4{margin-bottom:12px;font-size:13px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--or-fonce)}
.pied ul{list-style:none;padding:0}
.pied li a{display:inline-flex;align-items:center;min-height:40px;font-size:15.5px;color:var(--texte-2);text-decoration:none}
.pied li a:hover{color:var(--encre)}
.pied-bas{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 20px;margin-top:40px;padding-top:20px;border-top:1px solid var(--filet);font-size:14px;color:var(--texte-2)}
.pied-bas a{text-decoration:none}.pied-bas a:hover{color:var(--encre)}
@media(min-width:860px){.pied-grille{grid-template-columns:2fr 1fr 1fr}}

/* Barre WhatsApp (téléphone) */
.barre{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:60;transform:translateY(160%);transition:transform .4s cubic-bezier(.2,.8,.2,1)}
.barre.visible{transform:none}
.barre .btn{width:100%;box-shadow:inset 0 1px 0 rgba(255,255,255,.22),0 18px 40px -14px rgba(43,33,20,.6)}

/* Apparition douce */
.js .revele{opacity:0;transform:translateY(18px);transition:opacity .8s ease,transform .8s cubic-bezier(.2,.8,.2,1)}
.js .revele.vu{opacity:1;transform:none}

@media(max-width:859px){
  .repere{font-size:11px;letter-spacing:.1em}
  .flux-pied{grid-template-columns:1fr 1fr}.flux-centre{grid-column:1/-1;grid-row:2}
  .etiquette{display:none}
  .tuile-3 .nom{display:none}
}
@media(min-width:860px){.barre{display:none}}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .js .revele{opacity:1;transform:none;transition:none}
  .btn,.lien .fl,.barre{transition:none}
}
"""


# --------------------------------------------------------------------------- #
#  Script : en-tête, apparitions, barre WhatsApp, animation du flux
# --------------------------------------------------------------------------- #
JS = r"""
(function () {
  var doc = document.documentElement;
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var tete = document.querySelector('.site-nav');
  var menu = document.querySelector('.sn-menu'), tiroir = document.getElementById('sn-tiroir');
  if (menu && tiroir) {
    var fermer = function () { menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Ouvrir le menu'); tiroir.hidden = true; };
    menu.addEventListener('click', function () {
      if (menu.getAttribute('aria-expanded') === 'true') { fermer(); return; }
      menu.setAttribute('aria-expanded', 'true'); menu.setAttribute('aria-label', 'Fermer le menu'); tiroir.hidden = false;
    });
    tiroir.addEventListener('click', function (e) { if (e.target.closest('a')) fermer(); });
  }
  function surDefilement() { tete.classList.toggle('defile', window.scrollY > 8); }
  window.addEventListener('scroll', surDefilement, { passive: true });
  surDefilement();

  var io = 'IntersectionObserver' in window;
  var aReveler = document.querySelectorAll('.revele');
  if (io && !reduit) {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vu'); obs.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    aReveler.forEach(function (el) { obs.observe(el); });
  } else {
    aReveler.forEach(function (el) { el.classList.add('vu'); });
  }

  // Barre WhatsApp en bas de l'écran du téléphone : visible entre le bouton du haut et l'appel final.
  var barre = document.querySelector('.barre');
  if (barre && io) {
    var hautVu = true, finVu = false;
    var maj = function () {
      var v = !hautVu && !finVu;
      barre.classList.toggle('visible', v);
      barre.inert = !v;
      barre.setAttribute('aria-hidden', v ? 'false' : 'true');
    };
    new IntersectionObserver(function (e) { hautVu = e[0].isIntersecting; maj(); })
      .observe(document.querySelector('.hero-cta'));
    new IntersectionObserver(function (e) { finVu = e[0].isIntersecting; maj(); })
      .observe(document.querySelector('#contact'));
    maj();
  }

  // Flux : les pièces « avant » suivent les lignes de gauche, entrent dans la clé,
  // et ressortent « après » par les lignes de droite.
  var flux = document.querySelector('.flux');
  if (!flux) return;
  var svg = flux.querySelector('svg.lignes');
  var vb = svg.viewBox.baseVal;
  var gauche = [].slice.call(flux.querySelectorAll('path.g'));
  var droite = [].slice.call(flux.querySelectorAll('path.d'));
  var tuile = flux.querySelector('.tuile');
  var paires = JSON.parse(flux.getAttribute('data-paires'));
  var bouton = document.querySelector('.flux-pause'), arret = false;
  var longueurs = new Map();
  [].concat(gauche, droite).forEach(function (p) { longueurs.set(p, p.getTotalLength()); });
  var W = 0, H = 0;
  function mesurer() { W = flux.clientWidth; H = flux.clientHeight; }
  mesurer();
  window.addEventListener('resize', mesurer, { passive: true });

  function vignette(src, sens, etiquette, miroir) {
    var el = document.createElement('div');
    el.className = 'vignette ' + sens + (miroir ? ' miroir' : '');
    var cadre = document.createElement('div'); cadre.className = 'cadre';
    var img = document.createElement('img');
    img.src = '/images/sourcing/' + src + '.webp'; img.alt = ''; img.decoding = 'async';
    img.width = 320; img.height = 400;
    cadre.appendChild(img); el.appendChild(cadre);
    if (etiquette) { var e = document.createElement('span'); e.className = 'etiquette'; e.textContent = etiquette; el.appendChild(e); }
    flux.appendChild(el);
    return el;
  }
  function placer(s, t) {
    var L = longueurs.get(s.chemin);
    var p = s.chemin.getPointAtLength(Math.max(0, Math.min(1, t)) * L);
    var x = (p.x - vb.x) / vb.width * W, y = (p.y - vb.y) / vb.height * H;
    var w = s.el.offsetWidth, h = s.el.offsetHeight, echelle = 1, op = 1;
    if (s.sens === 'avant') {
      if (t < .1) op = t / .1;
      if (t > .78) { var k = (t - .78) / .22; echelle = 1 - .62 * k; op = 1 - k; }
    } else {
      if (t < .22) { var k2 = t / .22; echelle = .38 + .62 * k2; op = k2; }
      if (t > .9) op = (1 - t) / .1;
    }
    s.el.style.opacity = op.toFixed(3);
    s.el.style.transform = 'translate(' + (x - w / 2).toFixed(1) + 'px,' + (y - h / 2).toFixed(1) + 'px) scale(' +
      echelle.toFixed(3) + ') rotate(' + (s.rot * (s.sens === 'avant' ? 1 - Math.max(0, t - .5) * 2 : 0)).toFixed(2) + 'deg)';
  }

  if (reduit) {
    // Composition fixe : deux « avant » à gauche, deux « après » à droite.
    [[0, 'avant', 1, .34], [1, 'avant', 3, .3], [0, 'apres', 0, .7], [1, 'apres', 2, .66]].forEach(function (c) {
      var pr = paires[c[0]];
      var s = { el: vignette(c[1] === 'avant' ? pr[0] : pr[1], c[1], c[1] === 'apres' ? pr[2] : '', c[1] === 'apres' && pr[3]),
        chemin: (c[1] === 'avant' ? gauche : droite)[c[2]], sens: c[1], rot: c[1] === 'avant' ? (c[2] % 2 ? 5 : -6) : 0 };
      requestAnimationFrame(function () { placer(s, c[3]); });
    });
    if (bouton) bouton.hidden = true;
    return;
  }

  var actifs = [], prochain = 0, indice = 0, enPause = false, dernier = null;
  var DUREE = 6200, ECART = 2400, ORDRE_G = [1, 3, 0, 2], ORDRE_D = [0, 2, 3, 1];
  function lancer(now) {
    var pr = paires[indice % paires.length], n = indice;
    actifs.push({ el: vignette(pr[0], 'avant', '', false), chemin: gauche[ORDRE_G[n % 4]], sens: 'avant',
      debut: now, rot: (n % 2 ? 1 : -1) * (4 + (n % 3) * 2), paire: pr, n: n });
    indice++;
  }
  function semer(now) {
    // La scène démarre déjà en mouvement : trois pièces « avant » en route, deux « après » qui sortent.
    [[.62, 'avant'], [.3, 'avant'], [.45, 'apres'], [.8, 'apres']].forEach(function (g, k) {
      var pr = paires[k % paires.length], n = indice++;
      if (g[1] === 'avant') {
        actifs.push({ el: vignette(pr[0], 'avant', '', false), chemin: gauche[ORDRE_G[n % 4]], sens: 'avant',
          debut: now - g[0] * DUREE, rot: (n % 2 ? 1 : -1) * (4 + (n % 3) * 2), paire: pr, n: n });
      } else {
        actifs.push({ el: vignette(pr[1], 'apres', pr[2], pr[3]), chemin: droite[ORDRE_D[n % 4]], sens: 'apres',
          debut: now - g[0] * DUREE, rot: 0 });
      }
    });
  }
  function pas(now) {
    if (enPause) { dernier = null; return; }
    if (dernier !== null && now - dernier > 250) {
      // retour d'un onglet en arrière-plan : on décale tout pour éviter un saut
      var d = now - dernier; actifs.forEach(function (s) { s.debut += d; }); prochain += d;
    }
    dernier = now;
    if (now >= prochain) { lancer(now); prochain = now + ECART; }
    for (var i = actifs.length - 1; i >= 0; i--) {
      var s = actifs[i], t = (now - s.debut) / DUREE;
      if (t >= 1) {
        s.el.remove(); actifs.splice(i, 1);
        if (s.sens === 'avant') {
          tuile.classList.add('recoit');
          setTimeout(function () { tuile.classList.remove('recoit'); }, 650);
          actifs.push({ el: vignette(s.paire[1], 'apres', s.paire[2], s.paire[3]), chemin: droite[ORDRE_D[s.n % 4]],
            sens: 'apres', debut: now, rot: 0 });
        }
        continue;
      }
      placer(s, t);
    }
    requestAnimationFrame(pas);
  }
  function reprendre() { if (enPause && !arret) { enPause = false; requestAnimationFrame(pas); } }
  if (bouton) {
    bouton.addEventListener('click', function () {
      arret = !arret;
      bouton.setAttribute('aria-pressed', arret ? 'true' : 'false');
      bouton.setAttribute('aria-label', bouton.getAttribute(arret ? 'data-lecture' : 'data-pause'));
      if (arret) enPause = true; else if (!document.hidden) reprendre();
    });
  }
  if (io) {
    new IntersectionObserver(function (e) { if (e[0].isIntersecting && !document.hidden) reprendre(); else enPause = true; })
      .observe(flux);
  }
  document.addEventListener('visibilitychange', function () { if (document.hidden) enPause = true; else reprendre(); });
  semer(performance.now());
  prochain = performance.now() + 900;
  requestAnimationFrame(pas);
})();
"""


# --------------------------------------------------------------------------- #
#  Barre du haut (celle du site)
# --------------------------------------------------------------------------- #
FONTS = (
    '<link rel="preconnect" href="https://fonts.googleapis.com">'
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@600'
    '&family=Figtree:wght@400;500;600&family=Playfair+Display:ital,wght@1,400;1,500'
    '&display=swap" rel="stylesheet">'
)



NAV_SITE = [("/#services", "Services"), ("/#faq", "F.A.Q"), ("/#histoire", "Qui sommes-nous ?"),
            ("/#valeurs", "Nos valeurs"), ("/#contact", "Contact")]
ICO_TEL = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
           'stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 '
           '19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 '
           '2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 '
           '2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>')


def logo_site(taille: int) -> str:
    """Le logo empilé du site (BrandLogo layout="stacked")."""
    return (
        f'<span class="brandlogo bl-stacked" style="font-size:{taille}px" role="img" '
        'aria-label="Label Maison Conciergerie"><span class="bl-key-wrap">'
        '<img class="bl-key" src="/images/key-gold-deep.png" alt="" aria-hidden="true" width="586" height="223">'
        '</span><span class="bl-text"><span class="bl-name">LABEL MAISON</span><span class="bl-sub">'
        '<span class="bl-rule bl-rule-l" aria-hidden="true"></span><span class="bl-conc">CONCIERGERIE</span>'
        '<span class="bl-rule bl-rule-r" aria-hidden="true"></span></span></span></span>'
    )


def entete(aller: str = "Aller au contenu") -> str:
    """Barre du haut identique à celle du site (src/app/components/Navigation.tsx)."""
    liens = "".join(f'<a href="{h}">{C.esc(l)}</a>' for h, l in NAV_SITE)
    tiroir = "".join(f'<li><a href="{h}">{C.esc(l)}</a></li>' for h, l in NAV_SITE)
    tel = f'href="tel:{C.TEL_URI}" aria-label="Appeler {C.esc(C.TEL)}"'
    return (
        f'<a class="saut" href="#contenu">{C.esc(aller)}</a>'
        '<header class="site-nav">'
        '<div class="sn-bureau"><div class="sn-in">'
        f'<a href="/" class="sn-logo" aria-label="Label Maison Conciergerie - Accueil">{logo_site(14)}</a>'
        f'<nav class="sn-liens" aria-label="Navigation principale">{liens}</nav>'
        f'<a class="sn-tel" {tel}>{ICO_TEL}{C.esc(C.TEL)}</a>'
        "</div></div>"
        '<div class="sn-mobile"><div class="sn-in">'
        f'<a href="/" class="sn-logo" aria-label="Label Maison Conciergerie - Accueil">{logo_site(11)}</a>'
        f'<div class="sn-actions"><a class="sn-tel" {tel}>{C.esc(C.TEL)}</a>'
        '<button class="sn-menu" type="button" aria-label="Ouvrir le menu" aria-expanded="false" '
        'aria-controls="sn-tiroir">'
        '<svg class="ico-m" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>'
        '<svg class="ico-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
        'stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div></div>'
        f'<nav class="sn-tiroir" id="sn-tiroir" aria-label="Navigation principale" hidden><ul>{tiroir}</ul></nav>'
        "</div></header>"
    )


# --------------------------------------------------------------------------- #
#  Blocs HTML (P = textes d'une page, voir sourcing_contenu.py)
# --------------------------------------------------------------------------- #
def url_de(slug: str) -> str:
    return f"{C.SITE}/{slug}"


def wa_de(P: dict, cle: str) -> str:
    w = P["wa"]
    message = w[cle] + (w["gabarit"] if cle in ("projet", "complet") else "")
    return wa(message)


def lien_wa(P: dict, cle: str, texte: str, cls: str = "lien") -> str:
    if cls == "btn":
        return (f'<a class="btn" href="{wa_de(P, cle)}" target="_blank" rel="noopener">{ICO_WA}{t(texte)}</a>')
    return (f'<a class="lien" href="{wa_de(P, cle)}" target="_blank" rel="noopener">{ICO_WA}'
            f'<span class="txt">{t(texte)}</span>{ICO["fleche"]}</a>')


def jsonld(P: dict) -> list:
    url = url_de(P["slug"])
    ld = P["ld"]
    service = {
        "@context": "https://schema.org",
        "@type": "Service",
        "name": t_brut(ld["nom"]),
        "serviceType": t_brut(ld["type"]),
        "description": t_brut(P["desc"]),
        "url": url,
        "inLanguage": P["langue"],
        "provider": {"@type": "Organization", "name": "Label Maison", "url": C.SITE + "/",
                     "logo": C.LOGO, "telephone": C.TEL, "sameAs": [C.INSTA, C.TIKTOK]},
        "areaServed": [{"@type": ty, "name": n} for ty, n in ld["zones"]],
        "hasOfferCatalog": {
            "@type": "OfferCatalog", "name": t_brut(ld["nom"]),
            "itemListElement": [{"@type": "Offer", "itemOffered": {"@type": "Service", "name": t_brut(n)}}
                                for n in [s[1] for s in P["solutions"]["items"]] + ld["offres_extra"]],
        },
    }
    faq = C.ld_faq([(t_brut(q), t_brut(r)) for q, r in P["faq"]["items"]])
    fil = C.ld_breadcrumb([(t_brut(n), u) for n, u in ld["fil"]])
    return [service, faq, fil]


def head(P: dict) -> str:
    url = url_de(P["slug"])
    title = C.title_court(P["title"]) if P["langue"] == "fr" else P["title"]
    desc = C.desc_courte(P["desc"]) if P["langue"] == "fr" else P["desc"]
    alternates = ""
    if P.get("hreflang"):
        alternates = "".join(f'<link rel="alternate" hreflang="{hl}" href="{C.SITE}{u}">'
                             for hl, u in P["hreflang"].items())
    locale = "fr_FR" if P["langue"] == "fr" else "en_GB"
    lds = "\n".join(C.ld(o) for o in jsonld(P))
    og = f"{C.SITE}/images/sourcing/{P['og']}"
    return f"""<!doctype html>
<html lang="{P['langue']}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">{C.ICONS}
<title>{t(title)}</title>
<meta name="description" content="{t(desc)}">
<link rel="canonical" href="{url}">{alternates}
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="author" content="Label Maison">
<meta property="og:type" content="website">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="Label Maison">
<meta property="og:title" content="{t(title)}">
<meta property="og:description" content="{t(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#F8F4EB">
{FONTS}
<style>{CSS.strip()}</style>
{lds}
</head>
<body>"""


def flux(P: dict) -> str:
    # Repère : 1200 × 520, tuile centrée en (600, 260).
    gauche = [
        "M0 92 H300 C405 92 405 222 505 222 H530",
        "M0 196 H320 C415 196 415 244 505 244 H530",
        "M0 326 H320 C415 326 415 276 505 276 H530",
        "M0 432 H300 C405 432 405 298 505 298 H530",
    ]
    droite = [
        "M670 222 H695 C795 222 795 92 900 92 H1200",
        "M670 244 H695 C785 244 785 196 880 196 H1200",
        "M670 276 H695 C785 276 785 326 880 326 H1200",
        "M670 298 H695 C795 298 795 432 900 432 H1200",
    ]
    chemins = "".join(f'<path class="g" d="{d}"/>' for d in gauche) + \
        "".join(f'<path class="d" d="{d}"/>' for d in droite)
    noeuds = [(11, 196, ""), (19, 432, " p"), (27, 92, " p"), (73, 326, ""), (82, 92, " p"), (90, 432, "")]
    pts = "".join(f'<span class="noeud{c}" style="left:{x}%;top:{y / 520 * 100:.2f}%"></span>'
                  for x, y, c in noeuds)
    e = P["etiquettes"]
    paires = [("avant-cuisine-2", "apres-cuisine-2", e["cuisine"], False),
              ("avant-bain", "apres-bain", e["bain"], False),
              ("avant-cuisine-1", "apres-cuisine-2", e["cuisine"], True)]
    donnees = C.esc(json.dumps([list(x) for x in paires], ensure_ascii=False))
    f = P["flux"]
    return (
        f'<div class="flux" data-paires="{donnees}" aria-hidden="true">'
        f'<svg class="lignes" viewBox="0 0 1200 520" preserveAspectRatio="none" focusable="false">{chemins}</svg>'
        f"{pts}"
        '<div class="tuile"><div class="tuile-2"><div class="tuile-3">'
        '<img src="/images/key-gold-deep.png" alt="" width="586" height="223">'
        '<span class="nom">LABEL MAISON</span></div></div></div>'
        "</div>"
        '<div class="flux-pied">'
        f'<span class="repere g" aria-hidden="true">{t(f["avant"])}</span>'
        '<span class="flux-centre">'
        f'<span class="mention-visuels">{t(f["mention"])}</span>'
        f'<button class="flux-pause" type="button" aria-pressed="false" aria-label="{t(f["pause"])}" '
        f'data-pause="{t(f["pause"])}" data-lecture="{t(f["lecture"])}">'
        '<svg class="ico-pause" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        '<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/></svg>'
        '<svg class="ico-lecture" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'
        '<path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>'
        "</button></span>"
        f'<span class="repere d" aria-hidden="true">{t(f["apres"])}</span></div>'
    )


def hero(P: dict) -> str:
    lignes = "".join(f'<span class="l">{t_html(l)}</span>' for l in P["h1"])
    return (
        '<section class="hero" aria-labelledby="titre">'
        '<div class="env hero-tete">'
        f'<h1 id="titre"><span class="pastille">{t(P["pastille"])}</span>{lignes}</h1>'
        f'<p class="hero-sous"><strong>{t(P["sous_fort"])}</strong> {t(P["sous"])}</p>'
        '<div class="hero-cta">'
        f'{lien_wa(P, "projet", P["cta_projet"], "btn")}'
        f'<p class="note">{t(P["note"])}</p>'
        "</div></div>"
        f"{flux(P)}"
        "</section>"
    )


def enonce(P: dict, alt: str) -> str:
    fort, doux = P["enonce"]
    lbl, suite = P["duo2"]
    return (
        f'<section class="section{alt}" id="contenu" style="padding-top:clamp(56px,8vw,96px)">'
        '<div class="env">'
        f'<p class="enonce revele">{t(fort)} <span class="doux">{t(doux)}</span></p>'
        '<div class="duo-texte revele">'
        f'<p>{t(P["duo1"])}</p>'
        f'<p><strong>{t(lbl)}</strong> {t(suite)}</p>'
        "</div></div></section>"
    )


def local(P: dict, alt: str) -> str:
    L = P["local"]
    if not L:
        return ""
    paras = "".join(f"<p>{t(x)}</p>" for x in L["paras"])
    cartes = "".join(
        f'<div class="local-carte"><span class="ico-tuile">{ICO[i]}</span><h3>{t(ti)}</h3><p>{t(tx)}</p></div>'
        for i, ti, tx in L["cartes"])
    liens = "".join(f'<li><a href="{u}"><span class="txt">{t(n)}</span>{ICO["fleche"]}</a></li>'
                    for n, u in L["liens"])
    return (
        f'<section class="section{alt}" aria-labelledby="t-local"><div class="env local-grille">'
        f'<div class="prose revele"><span class="surtitre">{t(L["surtitre"])}</span>'
        f'<h2 id="t-local" style="margin-bottom:24px">{t(L["h2"])}</h2>{paras}'
        f'<nav class="local-liens" aria-label="{t(L["liens_titre"])}"><h3>{t(L["liens_titre"])}</h3>'
        f"<ul>{liens}</ul></nav></div>"
        f'<div class="local-cartes revele">{cartes}</div>'
        "</div></section>"
    )


def dimension(P: dict, alt: str) -> str:
    D = P["dimension"]
    return (
        f'<section class="section{alt}" aria-labelledby="t-dimension"><div class="env duo">'
        f'<div class="colle revele"><span class="surtitre">{t(D["surtitre"])}</span>'
        f'<h2 id="t-dimension">{t_html(D["h2"])}</h2></div>'
        '<div class="prose revele">'
        f'<p class="lead">{t(D["lead"])}</p>'
        f'<p>{t(D["p1"])}</p>'
        f'<blockquote class="citation">{t(D["citation"])}</blockquote>'
        f'<p>{t(D["p2"])}</p>'
        f'<p>{t(D["p3"])}</p>'
        "</div></div></section>"
    )


def solutions(P: dict, alt: str) -> str:
    S = P["solutions"]
    cartes = ""
    for n, (ico, titre, texte, puces, cta, cle) in enumerate(S["items"], 1):
        li = "".join(f"<li>{t(x)}</li>" for x in puces)
        cartes += (
            '<article class="carte revele">'
            f'<div class="carte-haut"><span class="ico-tuile">{ICO[ico]}</span><span class="num">0{n}</span></div>'
            f"<h3>{t(titre)}</h3><p>{t(texte)}</p>"
            f'<ul class="liste">{li}</ul>{lien_wa(P, cle, cta)}'
            "</article>"
        )
    G = S["large"]
    compo = "".join(f"<div>{ICO[i]}{t(n)}</div>" for i, n in G["compo"])
    paras = "".join(f"<p>{t(x)}</p>" for x in G["paras"])
    large = (
        '<article class="carte-large revele"><div>'
        '<span class="num">04</span>'
        f'<h3 style="margin-top:14px">{t(G["titre"])}</h3>{paras}'
        f'{lien_wa(P, "complet", G["cta"], "btn")}'
        f'</div><div class="compo" aria-hidden="true">{compo}</div></article>'
    )
    return (
        f'<section class="section{alt}" id="solutions" aria-labelledby="t-solutions"><div class="env">'
        f'<div class="tete-section revele"><span class="surtitre">{t(S["surtitre"])}</span>'
        f'<h2 id="t-solutions">{t(S["h2"])}</h2></div>'
        f'<div class="grille-sol">{cartes}</div>{large}'
        "</div></section>"
    )


def pourquoi(P: dict, alt: str) -> str:
    W = P["pourquoi"]
    av = "".join(
        f'<div class="avantage revele"><span class="ico-tuile">{ICO[i]}</span><h4>{t(ti)}</h4><p>{t(tx)}</p></div>'
        for i, ti, tx in W["avantages"])
    chapo = "".join(f'<p class="chapo">{t(x)}</p>' for x in W["chapo"])
    return (
        f'<section class="section{alt}" id="pourquoi" aria-labelledby="t-pourquoi"><div class="env">'
        f'<div class="tete-section revele"><h2 id="t-pourquoi">{t(W["h2"])}</h2>{chapo}</div>'
        f'<h3 class="sous-titre revele">{t(W["sous_titre"])}</h3>'
        f'<div class="avantages">{av}</div>'
        f'<p class="note-info revele">{ICO["info"]}<span>{t(W["note"])}</span></p>'
        "</div></section>"
    )


def methode(P: dict, alt: str) -> str:
    M = P["methode"]
    li = "".join(
        f'<li class="etape revele"><span class="rond" aria-hidden="true">{i}</span><div class="etape-txt">'
        f'<span class="lbl">{t(M["etiquette"])} {i}</span><h3>{t(ti)}</h3><p>{t(tx)}</p></div></li>'
        for i, (ti, tx) in enumerate(M["etapes"], 1))
    return (
        f'<section class="section{alt}" id="methode" aria-labelledby="t-methode"><div class="env">'
        f'<div class="tete-section revele"><span class="surtitre">{t(M["surtitre"])}</span>'
        f'<h2 id="t-methode">{t(M["h2"])}</h2></div>'
        f'<ol class="etapes">{li}</ol>'
        "</div></section>"
    )


def partenaire(P: dict, alt: str) -> str:
    A = P["partenaire"]
    q = "".join(f'<div class="question revele"><span class="ico-tuile">{ICO[i]}</span>{t(x)}</div>'
                for i, x in A["questions"])
    devise = "".join(f"<span>{t(x)}</span>" for x in A["devise"])
    return (
        f'<section class="section{alt}" aria-labelledby="t-partenaire"><div class="env">'
        f'<div class="tete-section revele"><h2 id="t-partenaire">{t_html(A["h2"])}</h2>'
        f'<p class="chapo">{t(A["chapo"])}</p></div>'
        f'<div class="questions">{q}</div>'
        '<div class="vision revele">'
        f'<p style="margin:0 0 32px">{t(A["etude"])}</p>'
        f'<p class="devise">{devise}</p>'
        f'<p>{t(A["vision"])}</p>'
        f'{lien_wa(P, "projet", A["cta"], "btn")}'
        "</div></div></section>"
    )


def villes(P: dict, alt: str) -> str:
    V = P["villes"]
    cartes = ""
    for cle, nom, texte in V["cartes"]:
        cible = "/" + (LOCALES[cle] if cle in LOCALES else PRINCIPALE)
        cartes += (
            f'<a class="ville revele" href="{cible}">'
            f'<span class="nom-ville">{t(nom)}</span><p>{t(texte)}</p>'
            f'<span class="lien"><span class="txt">{t(V["voir"])}</span>{ICO["fleche"]}</span></a>'
        )
    autre = ""
    if V.get("autre_langue"):
        texte, slug = V["autre_langue"]
        hl = "en" if slug.startswith("en/") else "fr"
        autre = (f'<p class="autre-langue"><a class="lien" href="/{slug}" hreflang="{hl}" lang="{hl}">'
                 f'<span class="txt">{C.esc(texte)}</span>{ICO["fleche"]}</a></p>')
    return (
        f'<section class="section{alt}" id="destinations" aria-labelledby="t-villes"><div class="env">'
        f'<div class="tete-section revele"><span class="surtitre">{t(V["surtitre"])}</span>'
        f'<h2 id="t-villes">{t(V["h2"])}</h2><p class="chapo">{t(V["chapo"])}</p></div>'
        f'<div class="villes">{cartes}</div>{autre}'
        "</div></section>"
    )


def faq(P: dict, alt: str) -> str:
    F = P["faq"]
    items = "".join(
        f'<details><summary><h3>{t(q)}</h3><span class="plus" aria-hidden="true"></span></summary>'
        f"<p>{t(r)}</p></details>"
        for q, r in F["items"])
    return (
        f'<section class="section{alt}" id="questions" aria-labelledby="t-faq"><div class="env faq-grille">'
        f'<div class="faq-cote revele"><span class="surtitre">{t(F["surtitre"])}</span>'
        f'<h2 id="t-faq">{t(F["h2"])}</h2><p>{t(F["cote"])}</p>{lien_wa(P, "question", F["lien"])}</div>'
        f'<div class="faq-liste revele">{items}</div>'
        "</div></section>"
    )


def appel_final(P: dict) -> str:
    Z = P["final"]
    paras = "".join(f"<p>{t(x)}</p>" for x in Z["paras"])
    return (
        '<section class="section" id="contact" aria-labelledby="t-final" style="padding-top:0"><div class="env">'
        '<div class="final revele">'
        '<img class="filigrane" src="/images/key-gold.png" alt="" width="586" height="223" loading="lazy">'
        f'<span class="signature">{t(Z["signature"])}</span>'
        f'<h2 id="t-final">{t_html(Z["h2"])}</h2>{paras}'
        f'{lien_wa(P, "projet", Z["cta"], "btn")}'
        f'<p class="note">{t(P["note"])}</p>'
        "</div>"
        f'<p class="mention">{t(Z["mention"])}</p>'
        "</div></section>"
    )


def pied(P: dict) -> str:
    Q = P["pied"]
    l1 = "".join(f'<li><a href="{u}">{t(n)}</a></li>' for n, u in Q["liens1"])
    l2 = "".join(f'<li><a href="{u}">{t(n)}</a></li>' for n, u in Q["liens2"])
    legal = " · ".join(f'<a href="{u}">{t(n)}</a>' for n, u in Q["legal"])
    return (
        '<footer class="pied"><div class="env">'
        '<div class="pied-grille">'
        f'<div>{C.LOCKUP}<p class="pied-tag">{t(Q["tag"])}</p></div>'
        f'<div><h4>{t(Q["col1"])}</h4><ul>{l1}</ul></div>'
        f'<div><h4>{t(Q["col2"])}</h4><ul>{l2}</ul>'
        f'<h4 style="margin-top:24px">{t(Q["col3"])}</h4><ul>'
        f'<li><a href="{wa_de(P, "question")}" target="_blank" rel="noopener">WhatsApp</a></li>'
        f'<li><a href="tel:{C.TEL_URI}">{C.esc(C.TEL)}</a></li>'
        f'<li><a href="{C.INSTA}" target="_blank" rel="noopener">Instagram @labelmaisoncg</a></li>'
        "</ul></div></div>"
        f'<div class="pied-bas"><span>© 2026 Label Maison Conciergerie</span><span>{legal}</span></div>'
        "</div></footer>"
        '<div class="barre" aria-hidden="true" inert>'
        f'{lien_wa(P, "projet", P["cta_projet"], "btn")}</div>'
    )


def page(P: dict) -> str:
    global LANGUE
    LANGUE = P["langue"]
    blocs = [enonce, local, dimension, solutions, pourquoi, methode, partenaire, villes, faq]
    sections, n = [], 0
    for b in blocs:
        if b is local and not P["local"]:
            continue
        sections.append(b(P, " alt" if n % 2 else ""))
        n += 1
    corps = "\n".join([
        head(P),
        "<script>document.documentElement.classList.add('js')</script>",
        entete(P["pied"]["aller"]),
        "<main>",
        hero(P), *sections, appel_final(P),
        "</main>",
        pied(P),
        f"<script>{JS.strip()}</script>",
        "</body></html>",
    ])
    return corps + "\n"


def main() -> list:
    ecrites = []
    for P in PAGES:
        sortie = C.OUT / f"{P['slug']}.html"
        sortie.parent.mkdir(parents=True, exist_ok=True)
        sortie.write_text(page(P), encoding="utf-8")
        ecrites.append(sortie)
        print(f"Écrit : {sortie.relative_to(C.ROOT)}")
    return ecrites


if __name__ == "__main__":
    main()
