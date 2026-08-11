# -*- coding: utf-8 -*-
"""Câblage technique du SEO : sitemaps, robots.txt et routage Vercel.

À lancer après les générateurs de pages. Le script :
  1. inventorie toutes les pages de public/ (silos curés + pages auto-générées) ;
  2. écrit un sitemap index + des sitemaps thématiques (limite de 50 000 URL par
     fichier, largement respectée, mais on segmente pour la lisibilité) ;
  3. met à jour robots.txt ;
  4. met à jour vercel.json : `cleanUrls` (les URL sans .html sont servies
     automatiquement, ce qui évite d'écrire un rewrite par page et de heurter la
     limite de routes de Vercel) et les redirections 301 des communes déjà
     couvertes par un silo écrit à la main.

Idempotent : on peut le relancer autant de fois que nécessaire.
"""
from __future__ import annotations

import json
import pathlib

import seo_common as C

DATE = "2026-08-11"
CACHE = pathlib.Path(__file__).with_name(".cache") / "communes_urls.json"

# Pages servies par l'application React (pas de fichier .html dans public/)
SPA = [("/", "1.0", "weekly"), ("/proprietaires", "0.8", "monthly"),
       ("/logement", "0.7", "monthly"), ("/transport", "0.7", "monthly"),
       ("/activites", "0.7", "monthly"), ("/shopping", "0.7", "monthly"),
       ("/billetterie", "0.7", "monthly"), ("/cerclelabelmaison", "0.7", "monthly")]

HUBS = {"/conciergerie-airbnb-france", "/conciergerie-airbnb-paris",
        "/conciergerie-cote-d-azur", "/conciergerie-airbnb-banlieue-parisienne",
        "/conciergerie-airbnb-essonne", "/conciergerie-airbnb-ile-de-france",
        "/conciergerie-privee-paris", "/conciergerie-dubai", "/conciergerie-marrakech",
        "/estimation-rentabilite-airbnb", "/gestion-locative-paris",
        "/achat-vente-montres-de-luxe", "/van-avec-chauffeur-paris", "/bacam-spa"}


def inventaire() -> tuple:
    """Retourne (pages curées, pages auto-générées) sous forme d'URL absolues."""
    cures, autos = [], []
    for p in sorted(C.OUT.rglob("*.html")):
        rel = p.relative_to(C.OUT)
        url = "/" + (str(rel.parent) if rel.name == "index.html" else str(rel)[:-5])
        url = url.replace("/.", "").rstrip("/") or "/"
        auto = C.MARQUEUR_AUTO in p.read_text(encoding="utf-8")[:200]
        (autos if auto else cures).append(url)
    return cures, autos


def priorite(url: str, auto: bool) -> tuple:
    if url in HUBS:
        return "0.9", "weekly"
    if auto:
        # départements et régions servent de hubs au maillage national
        return ("0.6", "monthly") if url.count("-") <= 3 else ("0.5", "monthly")
    return "0.8", "weekly"


def urlset(urls: list, auto: bool) -> str:
    lignes = []
    for u in urls:
        pr, cf = priorite(u, auto)
        lignes.append(f"  <url><loc>{C.SITE}{u}</loc><lastmod>{DATE}</lastmod>"
                      f"<changefreq>{cf}</changefreq><priority>{pr}</priority></url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(lignes) + "\n</urlset>\n")


def ecrire_sitemaps(cures: list, autos: list) -> list:
    fichiers = []
    spa_urls = [u for u, _, _ in SPA]
    principal = ('<?xml version="1.0" encoding="UTF-8"?>\n'
                 '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                 + "\n".join(
                     f"  <url><loc>{C.SITE}{u}</loc><lastmod>{DATE}</lastmod>"
                     f"<changefreq>{cf}</changefreq><priority>{pr}</priority></url>"
                     for u, pr, cf in SPA)
                 + "\n"
                 + "\n".join(
                     f"  <url><loc>{C.SITE}{u}</loc><lastmod>{DATE}</lastmod>"
                     f"<changefreq>{priorite(u, False)[1]}</changefreq>"
                     f"<priority>{priorite(u, False)[0]}</priority></url>"
                     for u in cures if u not in spa_urls)
                 + "\n</urlset>\n")
    (C.OUT / "sitemap-pages.xml").write_text(principal, encoding="utf-8")
    fichiers.append("sitemap-pages.xml")

    # Pages communes/départements/régions, par tranches de 700 pour rester lisible
    lot = 700
    for i in range(0, len(autos), lot):
        nom = f"sitemap-communes-{i // lot + 1}.xml"
        (C.OUT / nom).write_text(urlset(autos[i:i + lot], True), encoding="utf-8")
        fichiers.append(nom)

    index = ('<?xml version="1.0" encoding="UTF-8"?>\n'
             '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
             + "\n".join(f"  <sitemap><loc>{C.SITE}/{f}</loc>"
                         f"<lastmod>{DATE}</lastmod></sitemap>" for f in fichiers)
             + "\n</sitemapindex>\n")
    (C.OUT / "sitemap.xml").write_text(index, encoding="utf-8")
    return fichiers


def ecrire_robots(fichiers: list) -> None:
    txt = ["User-agent: *", "Allow: /", "", "# Pas d'indexation des points d'API",
           "Disallow: /api/", ""]
    txt += [f"Sitemap: {C.SITE}/sitemap.xml"]
    txt += [f"Sitemap: {C.SITE}/{f}" for f in fichiers]
    (C.OUT / "robots.txt").write_text("\n".join(txt) + "\n", encoding="utf-8")


def maj_vercel(redirections: dict) -> tuple:
    p = C.ROOT / "vercel.json"
    cfg = json.loads(p.read_text(encoding="utf-8"))
    # cleanUrls : /ma-page sert public/ma-page.html sans écrire un rewrite par page
    cfg["cleanUrls"] = True
    cfg["trailingSlash"] = False

    existantes = {r["source"] for r in cfg.get("redirects", [])}
    ajouts = 0
    for src, dest in sorted(redirections.items()):
        if src not in existantes and src != dest:
            cfg.setdefault("redirects", []).append(
                {"source": src, "destination": dest, "permanent": True})
            ajouts += 1

    # Le catch-all SPA doit rester en dernier
    rw = cfg.get("rewrites", [])
    catch = [r for r in rw if r["destination"] == "/index.html"]
    cfg["rewrites"] = [r for r in rw if r["destination"] != "/index.html"] + catch

    p.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return ajouts, len(cfg.get("redirects", [])), len(cfg["rewrites"])


def main() -> None:
    cures, autos = inventaire()
    fichiers = ecrire_sitemaps(cures, autos)
    ecrire_robots(fichiers)
    redirections = {}
    if CACHE.exists():
        redirections = json.loads(CACHE.read_text(encoding="utf-8")).get("redirections", {})
    ajouts, total_red, total_rw = maj_vercel(redirections)
    print(f"Sitemaps : {len(fichiers)} fichiers, "
          f"{len(cures) + len(SPA)} pages curées + {len(autos)} pages communes")
    print(f"vercel.json : cleanUrls activé, +{ajouts} redirections "
          f"({total_red} redirections, {total_rw} rewrites au total)")


if __name__ == "__main__":
    main()
