# -*- coding: utf-8 -*-
"""Page « Qui sommes-nous » (/qui-sommes-nous).

Page d'autorité (E-E-A-T) : qui est derrière Label Maison, où nous intervenons,
nos règles. Uniquement des faits déjà publiés sur le site ou vérifiables ; aucun
chiffre de performance, aucun avis. Le récit reprend celui de la page d'accueil
(src/app/pages/Home.tsx, StorySection).

Lancer : python3 scripts/gen_a_propos.py  puis  python3 scripts/build_seo_index.py
"""
from __future__ import annotations

import seo_article as ART
import seo_common as C

PATH = "/qui-sommes-nous"
TITLE = "Qui sommes-nous · Label Maison Conciergerie"
DESC = ("Label Maison Conciergerie : une conciergerie Airbnb fondée par Abdel, basée en "
        "Essonne, qui gère des logements en location courte durée à Paris et en Île-de-France. "
        "Notre histoire, notre équipe, nos règles.")


def main() -> str:
    url = C.SITE + PATH
    trail = [("Accueil", "/"), ("Qui sommes-nous", PATH)]
    ld_org = {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "url": url,
        "name": "Qui sommes-nous — Label Maison Conciergerie",
        "inLanguage": "fr-FR",
        "mainEntity": {
            "@type": "Organization",
            "name": "Label Maison Conciergerie",
            "url": C.SITE + "/",
            "logo": C.LOGO,
            "email": C.MAIL,
            "telephone": C.TEL,
            "founder": {"@type": "Person", "name": "Abdel", "jobTitle": "Fondateur"},
            "areaServed": ["Essonne", "Paris", "Île-de-France"],
            "sameAs": [C.INSTA, C.TIKTOK],
        },
    }
    parts = [
        C.head(TITLE, DESC, PATH, [ld_org, C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/real/portrait-abdel.jpg"),
        C.header(ART.NAV),
        C.crumb(trail),
        C.hero(
            "Qui sommes-nous",
            "Une conciergerie qui traite votre bien "
            "<span class=\"font-serif-italic\">comme le sien</span>.",
            "Label Maison Conciergerie gère des logements en location courte durée à Paris, en "
            "Essonne et en Île-de-France. Fondée par Abdel, basée en Essonne, l'équipe est sur le "
            "terrain : arrivées, ménages, linge, incidents, et un interlocuteur qui répond.",
            "real/portrait-abdel.jpg", "Abdel, fondateur de Label Maison Conciergerie",
            ["Fondée par Abdel", "Basée en Essonne", "Paris · Essonne · Île-de-France"],
            cta1="Estimer mes revenus", cta2="Nous appeler",
        ),
        C.texte(
            [
                "Trop de propriétaires vivent la même chose : un logement laissé à des prestataires "
                "qui ne se coordonnent pas, des séjours gérés à distance, un patrimoine qui perd de "
                "la valeur faute d'un vrai interlocuteur.",
                "Label Maison est née de cette conviction : <strong>un bien confié mérite le même "
                "soin qu'un bien habité</strong>. Nous avons bâti une conciergerie qui prend "
                "réellement en charge : présence sur le terrain, exigence à chaque détail, "
                "transparence sur les résultats. Pas de promesses, des preuves, mois après mois.",
                "« J'ai créé Label Maison pour offrir aux propriétaires ce que je cherchais "
                "moi-même : quelqu'un qui traite leur bien comme le sien, sans jamais rogner sur "
                "l'exigence. » — Abdel, fondateur.",
            ],
            titre="Notre histoire",
        ),
        C.cartes(
            "L'équipe",
            "Deux personnes joignables, une équipe de ménage et des artisans partenaires sur le secteur.",
            [
                ("Abdel — fondateur",
                 "Il a créé Label Maison et pilote la gestion des biens : mise en service, "
                 "tarification, relation avec les propriétaires et les voyageurs."),
                ("Kamel — développement et partenariats",
                 "Il développe l'activité, le réseau de partenaires locaux et les outils internes "
                 "qui font tourner la conciergerie (planning, linge, espace propriétaire)."),
                ("Ménage, linge, maintenance",
                 "Nos équipes de ménage et nos artisans partenaires interviennent sur l'ensemble du "
                 "secteur, avec un linge hôtelier géré en interne."),
            ],
        ),
        C.cartes(
            "Où nous intervenons",
            "Nous ne prenons un logement que là où nous pouvons être présents.",
            [
                ("Essonne (91)",
                 "Notre base. Évry-Courcouronnes, Corbeil-Essonnes, Massy, Palaiseau, "
                 "Sainte-Geneviève-des-Bois, Savigny-sur-Orge, Draveil, Brunoy et les communes "
                 "voisines. <a href=\"/conciergerie-airbnb-essonne\">Conciergerie Airbnb en Essonne</a>."),
                ("Paris et petite couronne",
                 "Les arrondissements de Paris et les communes limitrophes des Hauts-de-Seine, du "
                 "Val-de-Marne et de la Seine-Saint-Denis. "
                 "<a href=\"/conciergerie-airbnb-paris\">Conciergerie Airbnb à Paris</a>."),
                ("Ailleurs en France",
                 "Par notre réseau de partenaires locaux, à commencer par Sens (89). Si nous ne "
                 "pouvons pas être présents, nous vous le disons et nous vous orientons."),
            ],
        ),
        C.etapes(
            "Nos règles",
            [
                ("Jamais de bien non conforme",
                 "Déclaration en mairie, numéro d'enregistrement, plafond de nuitées, DPE : nous ne "
                 "mettons en ligne que des logements en règle, et nous vous aidons à le devenir."),
                ("Vous gardez la main",
                 "Vous ouvrez les périodes que vous voulez louer ; nous ne gérons que celles-là. "
                 "Vos dates restent vos dates."),
                ("Des preuves, pas des promesses",
                 "Nous ne donnons jamais de rendement au hasard : une estimation se fonde sur des "
                 "biens comparables réellement loués autour du vôtre. Aucun avis inventé, aucune "
                 "photo de banque d'images : ce que vous voyez sur ce site est réel."),
                ("Un interlocuteur qui répond",
                 "Un numéro, une adresse, des personnes. Les voyageurs ont une réponse rapide, les "
                 "propriétaires un relevé mensuel et un espace en ligne."),
            ],
        ),
        C.texte(
            [
                f"Téléphone : <a href=\"tel:{C.TEL_URI}\">{C.TEL}</a> · "
                f"E-mail : <a href=\"mailto:{C.MAIL}\">{C.MAIL}</a> · "
                f"<a href=\"{C.INSTA}\" rel=\"noopener\" target=\"_blank\">Instagram</a> · "
                f"<a href=\"{C.TIKTOK}\" rel=\"noopener\" target=\"_blank\">TikTok</a>.",
                "Mentions légales et informations sur l'éditeur : "
                "<a href=\"/mentions-legales\">mentions légales</a>. Vos données : "
                "<a href=\"/politique-de-confidentialite\">politique de confidentialité</a>.",
            ],
            titre="Nous joindre",
        ),
        C.formulaire(
            "Parlons de votre logement",
            "Décrivez-nous votre bien en trois lignes : nous vous rappelons pour un premier échange "
            "et, si le secteur s'y prête, une estimation fondée sur des biens comparables.",
            "", "Conciergerie Airbnb", TITLE,
        ),
        C.footer(ART.FOOTER,
                 "Conciergerie Airbnb à Paris et en Essonne — "
                 "<span class=\"font-serif-italic\">votre bien, géré comme une maison de confiance</span>.",
                 "Essonne · Paris · Île-de-France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write("qui-sommes-nous", parts)
    print(f"Qui sommes-nous : {PATH}")
    return PATH


if __name__ == "__main__":
    main()
