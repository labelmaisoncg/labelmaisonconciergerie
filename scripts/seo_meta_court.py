# -*- coding: utf-8 -*-
"""Raccourcit title et description des pages de public/ qui dépassent encore les
limites d'affichage de Google (60 / 155 caractères) : pages écrites à la main ou
produites hors des générateurs (silo Sens, Ba'cam Spa, love room…).

Mêmes règles que seo_common.title_court / desc_courte, appliquées aux balises
<title>, og:title, description et og:description. Idempotent, sans autre effet.
À lancer après les générateurs, avant build_seo_index.py.
"""
from __future__ import annotations

import html
import re

import seo_common as C


def main() -> int:
    modifiees = 0
    for p in sorted(C.OUT.rglob("*.html")):
        s = p.read_text(encoding="utf-8")
        orig = s
        m = re.search(r"<title>(.*?)</title>", s, re.S)
        if m:
            t = html.unescape(m.group(1).strip())
            tc = C.title_court(t)
            if tc != t:
                s = s.replace(m.group(0), f"<title>{C.esc(tc)}</title>", 1)
                s = re.sub(r'(<meta property="og:title" content=")[^"]*(")',
                           lambda mm: mm.group(1) + C.esc(tc) + mm.group(2), s, count=1)
        md = re.search(r'<meta name="description" content="([^"]*)"', s)
        if md:
            d = html.unescape(md.group(1))
            dc = C.desc_courte(d)
            if dc != d:
                s = s.replace(md.group(0), f'<meta name="description" content="{C.esc(dc)}"', 1)
                s = re.sub(r'(<meta property="og:description" content=")[^"]*(")',
                           lambda mm: mm.group(1) + C.esc(dc) + mm.group(2), s, count=1)
        # Ligne des régions dans le pied de page des pages écrites à la main (les pages
        # générées la reçoivent par seo_common.footer) : maillage vers les hubs nationaux.
        if "Conciergerie en France :" not in s and '<div class="wrap fbot">' in s:
            ligne = ('<div class="wrap" style="margin-top:28px;font-size:13px;color:var(--muted)">'
                     "<strong>Conciergerie en France :</strong> "
                     + " · ".join(f'<a href="{h}">{C.esc(n)}</a>' for n, h in C.REGIONS) + "</div>")
            s = s.replace('<div class="wrap fbot">', ligne + '<div class="wrap fbot">', 1)
        # Mesure d'audience (Google Analytics après consentement) sur toutes les pages.
        if "/js/mesure.js" not in s and "</body>" in s and "noindex" not in s[:1500]:
            s = s.replace("</body>", '<script defer src="/js/mesure.js"></script></body>', 1)
        if s != orig:
            p.write_text(s, encoding="utf-8")
            modifiees += 1
    print(f"Balises raccourcies : {modifiees} pages")
    return modifiees


if __name__ == "__main__":
    main()
