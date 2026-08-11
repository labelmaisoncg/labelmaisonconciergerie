# -*- coding: utf-8 -*-
"""Contrôle qualité des pages statiques : liens internes, JSON-LD, images, balises.

À lancer après les générateurs. Aucun effet de bord : le script se contente de
signaler ce qui casserait le référencement (lien mort, JSON-LD invalide, image
absente, title ou description manquants ou dupliqués).
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
from collections import Counter, defaultdict

import seo_common as C

# Routes servies par l'application React (pas de fichier .html)
SPA = {"/", "/proprietaires", "/logement", "/transport", "/activites", "/shopping",
       "/billetterie", "/cerclelabelmaison", "/mentions-legales",
       "/politique-de-confidentialite"}


def cibles_existantes() -> set:
    ok = set(SPA)
    for p in C.OUT.rglob("*.html"):
        rel = p.relative_to(C.OUT)
        u = "/" + (str(rel.parent) if rel.name == "index.html" else str(rel)[:-5])
        ok.add(u.rstrip("/") or "/")
        ok.add("/" + str(rel))  # lien direct vers le .html
    cfg = json.loads((C.ROOT / "vercel.json").read_text(encoding="utf-8"))
    for r in cfg.get("redirects", []):
        ok.add(r["source"])
    for r in cfg.get("rewrites", []):
        ok.add(r["source"])
    return ok


def main() -> int:
    ok = cibles_existantes()
    pages = sorted(C.OUT.rglob("*.html"))
    liens_morts: dict = defaultdict(set)
    images_absentes: dict = defaultdict(set)
    jsonld_ko, sans_title, sans_desc = [], [], []
    titles, descs = Counter(), Counter()

    for p in pages:
        s = p.read_text(encoding="utf-8")
        rel = str(p.relative_to(C.OUT))

        for m in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
            try:
                json.loads(m)
            except Exception as e:
                jsonld_ko.append((rel, str(e)[:80]))

        t = re.search(r"<title>(.*?)</title>", s, re.S)
        d = re.search(r'<meta name="description" content="(.*?)"', s, re.S)
        (titles if t else sans_title.append(rel) or titles)[t.group(1) if t else ""] += 1
        (descs if d else sans_desc.append(rel) or descs)[d.group(1) if d else ""] += 1

        for href in re.findall(r'href="(/[^"#?]*)"', s):
            h = href.rstrip("/") or "/"
            if h.startswith(("/api/", "/images/", "/css/", "/js/", "/videos/")):
                continue
            ext = pathlib.PurePosixPath(h).suffix
            if ext and ext != ".html":
                continue  # lien direct vers un fichier (photo, PDF…), pas une page
            if h not in ok and href not in ok:
                liens_morts[h].add(rel)

        for src in re.findall(r'src="(/images/[^"]+)"', s):
            if not (C.OUT / src.lstrip("/")).exists():
                images_absentes[src].add(rel)

    print(f"Pages analysées : {len(pages)}")
    dup_t = {k: v for k, v in titles.items() if v > 1 and k}
    dup_d = {k: v for k, v in descs.items() if v > 1 and k}

    def bloc(titre: str, contenu: dict, limite: int = 15) -> None:
        if not contenu:
            print(f"✓ {titre} : aucun problème")
            return
        print(f"✗ {titre} : {len(contenu)}")
        for i, (k, v) in enumerate(sorted(contenu.items(), key=lambda x: -len(x[1])
                                          if isinstance(x[1], (set, list)) else 0)):
            if i >= limite:
                print(f"   … et {len(contenu) - limite} autres")
                break
            n = len(v) if isinstance(v, (set, list)) else v
            exemple = sorted(v)[0] if isinstance(v, set) else ""
            print(f"   {k}  ({n}{' pages, ex. ' + exemple if exemple else ' occurrences'})")

    bloc("Liens internes morts", liens_morts)
    bloc("Images absentes", images_absentes)
    bloc("Titles dupliqués", dup_t)
    bloc("Descriptions dupliquées", dup_d)
    print(f"{'✓' if not jsonld_ko else '✗'} JSON-LD : {len(jsonld_ko)} erreur(s)")
    for f, e in jsonld_ko[:10]:
        print(f"   {f} : {e}")
    print(f"{'✓' if not sans_title else '✗'} Pages sans <title> : {len(sans_title)}")
    print(f"{'✓' if not sans_desc else '✗'} Pages sans meta description : {len(sans_desc)}")
    return 1 if (liens_morts or images_absentes or jsonld_ko or sans_title or sans_desc) else 0


if __name__ == "__main__":
    sys.exit(main())
