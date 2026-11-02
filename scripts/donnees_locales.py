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
