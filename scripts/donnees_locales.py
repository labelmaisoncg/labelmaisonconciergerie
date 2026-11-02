# -*- coding: utf-8 -*-
"""Données publiques locales pour les pages communes (scripts/data_locales.json).

Chaque page commune reçoit un bloc de faits vérifiables propres à la commune,
construits à partir de jeux de données ouverts (licence ouverte Etalab) :

  - taxe de séjour : collectivité bénéficiaire, régime, millésime de la
    délibération et tarifs par catégorie (DGFiP, délibérations DELTA, via
    data.gouv.fr « Tarifs taxe de séjour » et « Taxe de séjour : la collectivité
    qui la perçoit, commune par commune ») ;
  - capacités d'hébergement touristique au 1er janvier 2026 : hôtels, chambres,
    campings, résidences de tourisme (INSEE, DS_TOUR_CAP) ;
  - règles locales des meublés de tourisme (numéro d'enregistrement, changement
    d'usage, plafond de nuitées) pour les communes où une délibération a été
    relevée, avec sa source officielle (jeu « Règles locales des meublés de
    tourisme », data.gouv.fr).

Le fichier data_locales.json est produit par scripts/maj_donnees_locales.py.
Aucune valeur n'est inventée : quand une donnée manque, le bloc l'omet.
"""
from __future__ import annotations

import json
import pathlib

import seo_common as C
import variantes_communes as VC

FICHIER = pathlib.Path(__file__).with_name("data_locales.json")
_DATA: dict | None = None


def charger() -> dict:
    global _DATA
    if _DATA is None:
        _DATA = json.loads(FICHIER.read_text(encoding="utf-8")) if FICHIER.exists() else {}
    return _DATA


def pour(insee: str) -> dict:
    return charger().get(insee, {})


def _euro(v: str) -> str:
    try:
        x = float(str(v).replace(",", "."))
    except ValueError:
        return C.esc(str(v)) + " €"
    s = f"{x:.2f}".replace(".", ",")
    return s + " €"


def _pct(v: str) -> str:
    try:
        x = float(str(v).replace(",", "."))
    except ValueError:
        return C.esc(str(v)) + " %"
    return (str(int(x)) if x == int(x) else f"{x:.1f}".replace(".", ",")) + " %"


def _tarif(t: dict) -> str:
    if not t:
        return ""
    if t.get("unite", "").strip() == "%":
        return f"{_pct(t['tarif'])} du prix de la nuitée par personne"
    return f"{_euro(t['tarif'])} par personne et par nuit"


def _v(insee: str) -> int:
    return sum(ord(x) for x in insee) % 3


def taxe_sejour(nom: str, d: dict, insee: str = "") -> str:
    ts = d.get("taxe_sejour")
    tarifs = d.get("tarifs", {})
    if not ts and not tarifs:
        return ""
    phr = []
    if ts:
        qui = ts["collectivite"]
        nature = "la commune" if ts.get("type") == "commune" else "l'intercommunalité"
        phr.append(f"À {C.esc(nom)}, la taxe de séjour est perçue par <strong>{C.esc(qui)}</strong> "
                   f"({nature}), au régime {C.esc(ts.get('regime', '')).lower()}, selon une "
                   f"délibération de {C.esc(ts.get('millesime', ''))}.")
    nc, m3 = tarifs.get("nc"), tarifs.get("m3")
    if nc:
        phr.append(f"Pour un meublé de tourisme <strong>non classé</strong>, le tarif est de "
                   f"<strong>{_tarif(nc)}</strong>, dans la limite du plafond légal.")
    if m3:
        phr.append(f"Pour un meublé <strong>classé 3 étoiles</strong>, il est de "
                   f"<strong>{_tarif(m3)}</strong>.")
    ref = nc or m3
    if ref and str(ref.get("add_dep", "")).strip() not in ("", "0", "0,00", "0.0"):
        phr.append("S'y ajoute la taxe additionnelle départementale de 10 %.")
    if ref:
        phr.append(f"Tarifs en vigueur depuis {C.esc(ref.get('effet', ''))}.")
    phr.append(VC.COLLECTE[_v(insee)])
    return "<strong>Taxe de séjour.</strong> " + " ".join(phr)


def hebergement(nom: str, d: dict) -> str:
    h = d.get("hebergement")
    if not h:
        return ""
    morceaux = []
    if h["hotels"]:
        morceaux.append(f"<strong>{h['hotels']} hôtel{'s' if h['hotels'] > 1 else ''}</strong> "
                        f"({h['chambres']} chambres)")
    if h["campings"]:
        morceaux.append(f"{h['campings']} camping{'s' if h['campings'] > 1 else ''} "
                        f"({h['emplacements']} emplacements)")
    if h["residences"]:
        morceaux.append(f"{h['residences']} résidence{'s' if h['residences'] > 1 else ''} de tourisme")
    if not morceaux:
        inventaire = (f"L'INSEE ne recense à {C.esc(nom)} <strong>aucun hôtel, camping ni résidence "
                      f"de tourisme</strong> au 1<sup>er</sup> janvier 2026.")
        lecture = ("Les meublés sont donc la seule offre d'hébergement de la commune : un logement "
                   "bien tenu y occupe une place à part pour les déplacements professionnels, les "
                   "visites familiales et les séjours de passage.")
    else:
        inventaire = (f"L'INSEE recense à {C.esc(nom)}, au 1<sup>er</sup> janvier 2026, "
                      + ", ".join(morceaux) + ".")
        if h["chambres"] < 100:
            lecture = ("Une offre hôtelière réduite : les meublés complètent naturellement "
                       "l'hébergement local, en particulier pour les familles et les séjours de "
                       "plus de trois nuits.")
        else:
            lecture = ("Une offre hôtelière fournie : un meublé s'y distingue par l'espace, la "
                       "cuisine et le prix pour les familles et les séjours longs, pas en imitant "
                       "l'hôtel.")
    return "<strong>Offre d'hébergement.</strong> " + inventaire + " " + lecture


def regles(nom: str, d: dict, insee: str = "") -> str:
    r = d.get("regles")
    if not r:
        return "<strong>Règles locales.</strong> " + VC.REGLES_ABSENTES[_v(insee)](C.esc(nom))
    mesures = []
    if r.get("enregistrement_numero") == "oui":
        mesures.append("le <strong>numéro d'enregistrement obligatoire</strong> sur chaque annonce")
    if r.get("changement_usage") == "oui":
        mesures.append("l'<strong>autorisation de changement d'usage</strong> pour louer un logement "
                       "qui n'est pas votre résidence principale"
                       + (" (avec compensation)" if r.get("compensation") == "oui" else ""))
    if r.get("autorisation_temporaire") == "oui":
        mesures.append("l'autorisation temporaire de changement d'usage")
    if r.get("plafond_residence_principale_jours"):
        mesures.append(f"un plafond de <strong>{C.esc(r['plafond_residence_principale_jours'])} "
                       f"nuits par an</strong> pour la résidence principale")
    if r.get("quotas_ou_zonage") == "oui":
        mesures.append("des quotas ou un zonage par quartier")
    src = ""
    if r.get("source_url"):
        src = (f' Source : <a href="{C.esc(r["source_url"])}" target="_blank" rel="noopener nofollow">'
               f'{C.esc(r.get("source_libelle") or r.get("collectivite") or "texte officiel")}</a>'
               + (f" (délibération du {C.esc(r['date_deliberation'])})" if r.get("date_deliberation") else "")
               + ".")
    if not mesures:
        return (f"<strong>Règles locales.</strong> {C.esc(nom)} publie des règles propres aux "
                f"meublés de tourisme.{src}")
    return (f"<strong>Règles locales.</strong> {C.esc(nom)} a instauré "
            + ", ".join(mesures) + f".{src} Un bien non conforme n'est pas mis en ligne : nous "
            f"vous aidons d'abord à régulariser.")


def bloc(nom: str, insee: str) -> str:
    """Section « Ce que disent les chiffres officiels » ; vide si aucune donnée."""
    d = pour(insee)
    paras = [p for p in (taxe_sejour(nom, d, insee), hebergement(nom, d), regles(nom, d, insee)) if p]
    if not d:
        return ""
    sources = ["DGFiP, délibérations de taxe de séjour (données DELTA, data.gouv.fr)"]
    if d.get("hebergement"):
        sources.append("INSEE, capacités d'hébergement touristique au 1er janvier 2026")
    if d.get("regles"):
        sources.append("règles locales des meublés de tourisme (data.gouv.fr), source officielle citée")
    paras.append('<span style="font-size:13px;color:#6b6257">Sources : ' + " ; ".join(sources)
                 + " (licence ouverte).</span>")
    return C.texte(paras, titre=f"Ce que disent les chiffres officiels à {C.esc(nom)}")


def faq(nom: str, insee: str) -> list:
    d = pour(insee)
    items = []
    nc = d.get("tarifs", {}).get("nc")
    ts = d.get("taxe_sejour")
    if nc and ts:
        items.append((f"Quelle est la taxe de séjour à {nom} ?",
                      f"Elle est perçue par {C.esc(ts['collectivite'])}. Pour un meublé non classé, "
                      f"{_tarif(nc)} ; pour un meublé classé, un montant fixe selon le nombre "
                      f"d'étoiles. Les plateformes la collectent pour vous."))
    r = d.get("regles")
    if r and r.get("enregistrement_numero") == "oui":
        items.append((f"Faut-il un numéro d'enregistrement à {nom} ?",
                      f"Oui : {C.esc(nom)} impose un numéro d'enregistrement, à afficher sur "
                      f"l'annonce, résidence principale comprise. Nous l'obtenons avec vous avant "
                      f"la mise en ligne."))
    return items


def presence_idf(dept: str) -> bool:
    return dept in {"75", "77", "78", "91", "92", "93", "94", "95"}


# --------------------------------------------------------------------------- #
#  Hubs département et région : tableau des données officielles
# --------------------------------------------------------------------------- #
_TBL = ('<table style="width:100%;border-collapse:collapse;margin-top:18px;font-size:15px">'
        '<thead><tr style="text-align:left;color:#6b6257;font-size:13px">{th}</tr></thead>'
        '<tbody>{tr}</tbody></table>')
_TD = 'style="padding:9px 8px;border-bottom:1px solid rgba(44,36,24,.1);vertical-align:top"'


def _ligne(cells: list) -> str:
    return "<tr>" + "".join(f"<td {_TD}>{x}</td>" for x in cells) + "</tr>"


def _nc(d: dict) -> str:
    t = d.get("tarifs", {}).get("nc")
    return _tarif(t).replace(" du prix de la nuitée par personne", " de la nuitée") \
        .replace(" par personne et par nuit", " / pers. / nuit") if t else "—"


def bloc_dept(nom: str, communes: list, dl: str, url_commune) -> str:
    """Tableau des principales communes : taxe de séjour, tarif non classé, hôtels, règles."""
    lignes, collecs, ncs, regl, hotels, chambres = [], set(), [], 0, 0, 0
    top = sorted(communes, key=lambda x: -x.pop)
    for c in top:
        d = pour(c.insee)
        if not d:
            continue
        ts = d.get("taxe_sejour") or {}
        if ts.get("collectivite"):
            collecs.add(ts["collectivite"])
        t = d.get("tarifs", {}).get("nc")
        if t and t.get("unite", "").strip() == "%":
            try:
                ncs.append(float(str(t["tarif"]).replace(",", ".")))
            except ValueError:
                pass
        h = d.get("hebergement") or {}
        hotels += h.get("hotels", 0)
        chambres += h.get("chambres", 0)
        r = d.get("regles") or {}
        if r:
            regl += 1
        if len(lignes) < 14:
            regles_txt = []
            if r.get("enregistrement_numero") == "oui":
                regles_txt.append("numéro d'enregistrement")
            if r.get("changement_usage") == "oui":
                regles_txt.append("changement d'usage")
            if r.get("plafond_residence_principale_jours"):
                regles_txt.append(f"{C.esc(r['plafond_residence_principale_jours'])} nuits")
            lignes.append(_ligne([
                f'<a href="{url_commune(c)}">{C.esc(c.nom)}</a>',
                C.esc(ts.get("collectivite", "—")),
                _nc(d),
                (f"{h['hotels']} ({h['chambres']} ch.)" if h.get("hotels") else ("0" if h else "—")),
                ", ".join(regles_txt) if regles_txt else ("droit commun" if d else "—"),
            ]))
    if not lignes:
        return ""
    lead = (f"Les communes de plus de 10 000 habitants {dl} dépendent de "
            f"<strong>{len(collecs)} collectivité{'s' if len(collecs) > 1 else ''}</strong> pour la "
            f"taxe de séjour"
            + (f", avec un tarif pour meublé non classé compris entre <strong>{_pct(min(ncs))}</strong> "
               f"et <strong>{_pct(max(ncs))}</strong> du prix de la nuitée" if ncs else "")
            + f". L'INSEE y recense <strong>{hotels} hôtels</strong> ({chambres} chambres) au "
            f"1<sup>er</sup> janvier 2026"
            + (f" ; {regl} commune{'s' if regl > 1 else ''} appliquent des règles locales relevées "
               f"(numéro d'enregistrement, changement d'usage ou plafond)." if regl else "."))
    th = "".join(f"<th {_TD}>{x}</th>" for x in
                 ("Commune", "Taxe de séjour perçue par", "Meublé non classé", "Hôtels", "Règles locales"))
    return (f'<section class="wrap"><h2>Les chiffres officiels {C.esc(dl)}</h2><p class="lead">{lead}</p>'
            + _TBL.format(th=th, tr="".join(lignes))
            + '<p style="font-size:13px;color:#6b6257;margin-top:10px">Sources : DGFiP (délibérations '
            'de taxe de séjour), INSEE (capacités d\'hébergement 2026), règles locales des meublés de '
            'tourisme (data.gouv.fr). Le détail et les sources figurent sur la page de chaque commune.</p>'
            '</section>')


def bloc_region(nom: str, depts: set, communes: list, dept_urls: dict) -> str:
    """Tableau par département : communes couvertes, hôtels, règles locales relevées."""
    par = {}
    for c in communes:
        par.setdefault(c.dept_nom, []).append(c)
    lignes, tot_h, tot_c, tot_r = [], 0, 0, 0
    for dn in sorted(par):
        liste = par[dn]
        h = ch = r = n = 0
        for c in liste:
            d = pour(c.insee)
            if not d:
                continue
            n += 1
            hb = d.get("hebergement") or {}
            h += hb.get("hotels", 0)
            ch += hb.get("chambres", 0)
            r += 1 if d.get("regles") else 0
        tot_h += h
        tot_c += ch
        tot_r += r
        lignes.append(_ligne([
            f'<a href="{dept_urls.get(dn, "#")}">{C.esc(dn)}</a>',
            str(len(liste)),
            f"{h} ({ch} ch.)" if n else "—",
            str(r) if n else "—",
        ]))
    if not lignes:
        return ""
    lead = (f"{len(par)} département{'s' if len(par) > 1 else ''}, {len(communes)} communes de plus "
            f"de 10 000 habitants, <strong>{tot_h} hôtels</strong> ({tot_c} chambres) recensés par "
            f"l'INSEE au 1<sup>er</sup> janvier 2026, et <strong>{tot_r} commune{'s' if tot_r > 1 else ''}</strong> "
            f"où une règle locale sur les meublés de tourisme a été relevée.")
    th = "".join(f"<th {_TD}>{x}</th>" for x in
                 ("Département", "Communes couvertes", "Hôtels (chambres)", "Règles locales relevées"))
    return (f'<section class="wrap"><h2>Les chiffres officiels en {C.esc(nom)}</h2><p class="lead">{lead}</p>'
            + _TBL.format(th=th, tr="".join(lignes))
            + '<p style="font-size:13px;color:#6b6257;margin-top:10px">Sources : INSEE (capacités '
            'd\'hébergement 2026), DGFiP, règles locales des meublés de tourisme (data.gouv.fr).</p></section>')
