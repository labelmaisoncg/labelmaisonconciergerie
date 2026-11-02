# -*- coding: utf-8 -*-
"""Briques partagées par les cinq familles du silo « activités ».

Règles maison : aucun chiffre sur notre activité, aucun avis, aucun tarif
inventé (la seule somme publique est la prime du Cercle, 150 €, déjà affichée
sur /cerclelabelmaison), photos réelles uniquement. Chaque page passe par
gen_seo_services.build, qui place le formulaire de contact (/api/contact) sur
toutes les pages sans exception.
"""
from __future__ import annotations

# --------------------------------------------------------------------------- #
#  Hubs du silo
# --------------------------------------------------------------------------- #
HUB_APPORTEUR = "/apporteur-d-affaires"
HUB_CHINE = "/conciergerie-chine"
HUB_SHOPPING = "/personal-shopper-paris"          # existe déjà
HUB_MONTRES = "/achat-vente-montres-de-luxe"      # existe déjà
HUB_TRANSPORT = "/location-voiture-de-luxe-paris"

NAV_APPORTEUR = [("Apporteur d'affaires", HUB_APPORTEUR), ("Le Cercle", "/cerclelabelmaison"),
                 ("Montres", HUB_MONTRES), ("Personal shopper", HUB_SHOPPING)]
NAV_CHINE = [("Chine", HUB_CHINE), ("Sourcing", "/sourcing-chine"),
             ("Hong Kong", "/montres-de-luxe-hong-kong"), ("Apporteur d'affaires", HUB_APPORTEUR)]
NAV_SHOPPING = [("Personal shopper", HUB_SHOPPING), ("Montres", HUB_MONTRES),
                ("Dubaï", "/personal-shopper-dubai"), ("Conciergerie privée", "/conciergerie-privee-paris")]
NAV_MONTRES = [("Montres de luxe", HUB_MONTRES), ("Vendre sa montre", "/vendre-sa-montre-de-luxe-paris"),
               ("Estimation", "/estimation-montre-de-luxe"), ("Personal shopper", HUB_SHOPPING)]
NAV_TRANSPORT = [("Voitures de luxe", HUB_TRANSPORT), ("Chauffeur privé", "/chauffeur-prive-paris"),
                 ("Vols & jets", "/billets-d-avion-business-class"), ("Conciergerie privée", "/conciergerie-privee-paris")]

FOOT_ACTIVITES = [
    ("Nos services", [("Apporteur d'affaires", HUB_APPORTEUR),
                      ("Personal shopper Paris", HUB_SHOPPING),
                      ("Montres de luxe", HUB_MONTRES),
                      ("Voitures de luxe", HUB_TRANSPORT),
                      ("Chine & Hong Kong", HUB_CHINE)]),
    ("Conciergerie", [("Conciergerie privée Paris", "/conciergerie-privee-paris"),
                      ("Conciergerie Dubaï", "/conciergerie-dubai"),
                      ("Conciergerie Marrakech", "/conciergerie-marrakech"),
                      ("Le Cercle (parrainage)", "/cerclelabelmaison"),
                      ("Accueil", "/")]),
]

# --------------------------------------------------------------------------- #
#  Photos réelles (public/images/real), par univers
# --------------------------------------------------------------------------- #
P_MONTRE = [("real/rolex-coffret.jpg", "Montre de luxe dans son coffret"),
            ("real/rolex-gmt-poignet.jpg", "Rolex GMT-Master portée au poignet"),
            ("real/montre-rolex-gmt.jpeg", "Rolex GMT-Master, cadran et lunette"),
            ("real/montre-rolex-datejust.jpeg", "Rolex Datejust"),
            ("real/shopping-montre2-poster.jpg", "Montre présentée à un client"),
            ("real/proof-montre-client-poster.jpg", "Remise d'une montre à un client")]
P_SHOPPING = [("real/louis-vuitton.jpg", "Boutique Louis Vuitton"),
              ("real/amiri-boutique.jpg", "Boutique Amiri"),
              ("real/pshop-cadeau.jpg", "Cadeau d'exception préparé par la conciergerie"),
              ("real/shopping-bijoux2-poster.jpg", "Pièces de joaillerie présentées à un client"),
              ("real/proof-bijou-poster.jpg", "Bijou remis à un client"),
              ("real/rolex-coffret.jpg", "Montre de luxe dans son coffret")]
P_VOITURE = [("real/ferrari.jpg", "Ferrari mise à disposition par la conciergerie"),
             ("real/lamborghini.jpg", "Lamborghini Urus"),
             ("real/g-wagon.jpg", "Mercedes Classe G"),
             ("real/voiture-sport.jpg", "Voiture de sport"),
             ("real/voiture-vip-interieur.jpeg", "Intérieur VIP d'une berline avec chauffeur"),
             ("real/mercedes-van.jpg", "Van Mercedes avec chauffeur")]
P_VOYAGE = [("real/billetterie-avion.jpg", "Cabine d'un vol long-courrier"),
            ("real/proof-avion-poster.jpg", "Vue depuis le hublot d'un vol"),
            ("real/dubai-skyline.jpg", "Skyline de Dubaï"),
            ("real/dubai-downtown-nuit.jpg", "Downtown Dubaï de nuit"),
            ("real/dining.jpg", "Table réservée par la conciergerie"),
            ("real/yacht-82.jpg", "Yacht privatisé")]
P_DUBAI = [("real/dubai-downtown-nuit.jpg", "Downtown Dubaï de nuit"),
           ("real/dubai-marina.jpg", "Dubaï Marina"),
           ("real/dubai-palace.jpg", "Hôtel de luxe à Dubaï"),
           ("real/golf-dubai.jpg", "Golf à Dubaï"),
           ("real/yacht-55.jpg", "Yacht à Dubaï"),
           ("real/louis-vuitton.jpg", "Boutique de luxe")]
P_MARRAKECH = [("real/desert-pool.jpg", "Piscine dans le désert d'Agafay"),
               ("real/marrakech-menara.jpg", "Aéroport de Marrakech-Menara"),
               ("real/dining.jpg", "Table réservée à Marrakech"),
               ("real/pshop-cadeau.jpg", "Cadeau préparé par la conciergerie"),
               ("real/mercedes-van.jpg", "Van avec chauffeur"),
               ("real/rolex-coffret.jpg", "Montre de luxe dans son coffret")]

# --------------------------------------------------------------------------- #
#  Blocs « pourquoi nous »
# --------------------------------------------------------------------------- #
WHY_APPORTEUR = ("Pourquoi apporter des affaires à Label Maison", [
    ("Une prime écrite avant la mise en relation",
     "Le montant ou le pourcentage est convenu par écrit avant que vous ne nous présentiez qui que "
     "ce soit. Vous savez ce que vous gagnez, et quand."),
    ("Vous n'avez rien à vendre",
     "Vous présentez, nous faisons le reste : rendez-vous, proposition, exécution. Votre relation "
     "avec la personne recommandée reste la vôtre."),
    ("Des services qui se recommandent",
     "Gestion de biens, horlogerie, personal shopping, voyages : nous ne demandons une "
     "recommandation que sur des prestations que nous savons tenir."),
    ("Un seul interlocuteur",
     "Vous traitez avec la même personne pour toutes vos recommandations, quel que soit le service "
     "concerné, et vous suivez l'avancement de chacune."),
])

WHY_CHINE = ("Pourquoi passer par nous pour la Chine", [
    ("Un interlocuteur francophone, avant et pendant",
     "Vous préparez le déplacement avec nous en français, et vous gardez le même interlocuteur sur "
     "place. Pas de plateforme, pas de ticket."),
    ("Des partenaires locaux que nous connaissons",
     "Interprètes, chauffeurs, agents de sourcing, hôtels : nous travaillons avec des partenaires "
     "identifiés, pas avec le premier annuaire venu."),
    ("Le calcul complet, pas la promesse",
     "Droits de douane, TVA à l'importation, transport, contrôle qualité : nous chiffrons l'ensemble "
     "avant que vous décidiez, et nous vous disons quand cela ne vaut pas le déplacement."),
    ("La même exigence qu'à Paris et Dubaï",
     "Discrétion, ponctualité, compte rendu écrit : nos règles ne changent pas avec le fuseau horaire."),
])

WHY_SHOPPING = ("Pourquoi passer par notre personal shopper", [
    ("Accès, pas seulement conseil",
     "Un personal shopper utile est celui qui obtient la pièce : relations en boutique, marché "
     "secondaire vérifié, réseau à l'étranger."),
    ("Prix réel, sans surprise",
     "Nous annonçons le prix de la pièce et nos honoraires séparément, avant l'achat. Jamais de "
     "marge cachée sur la pièce."),
    ("Authenticité vérifiée",
     "Toute pièce venue du marché secondaire est contrôlée avant paiement : facture d'origine, "
     "numéro de série, expertise indépendante quand elle s'impose."),
    ("Discrétion absolue",
     "Vos achats, vos goûts et votre identité ne sortent pas de la conversation. C'est non "
     "négociable, pour vous comme pour nous."),
])

WHY_MONTRE = ("Pourquoi passer par nous", [
    ("Nous cherchons, vous décidez",
     "Nous ne vendons pas notre stock : nous cherchons la pièce que vous voulez, au meilleur prix "
     "disponible, et nous vous présentons les options avec leurs défauts."),
    ("Transaction encadrée",
     "Vérification du vendeur, authentification par un horloger indépendant, paiement sécurisé, "
     "facture et documents : chaque étape est tracée."),
    ("Discrétion",
     "Aucun nom, aucune pièce, aucune transaction n'est communiquée. C'est la première exigence "
     "de nos clients, et la nôtre."),
    ("Un réseau, pas une vitrine",
     "Détaillants, courtiers, collectionneurs, maisons de vente : nous activons plusieurs canaux en "
     "parallèle, en France comme à l'étranger."),
])

WHY_TRANSPORT = ("Pourquoi réserver avec nous", [
    ("Le bon véhicule, pas le plus cher",
     "Nous demandons l'usage avant la marque : trajet, passagers, bagages, image à donner. Puis "
     "nous proposons."),
    ("Un prix convenu à l'avance",
     "Devis ferme selon la durée et le trajet, dépôt de garantie annoncé, assurance précisée. "
     "Aucune majoration surprise à la remise des clés."),
    ("Une logistique complète",
     "Livraison du véhicule, chauffeur si vous le souhaitez, coordination avec vos vols, hôtels et "
     "réservations : tout est calé ensemble."),
    ("Partenaires vérifiés",
     "Loueurs et compagnies avec lesquels nous travaillons régulièrement, véhicules récents et "
     "entretenus, contrats lisibles."),
])

# --------------------------------------------------------------------------- #
#  Étapes génériques
# --------------------------------------------------------------------------- #
STEPS_DEMANDE = ("Comment ça se passe", [
    ("1. Votre demande", "Un message ou un appel : vous décrivez le besoin, le délai et le budget "
     "si vous en avez un."),
    ("2. Proposition écrite", "Options, prix de la prestation et honoraires séparés, délais. "
     "Vous validez ou vous ajustez."),
    ("3. Exécution", "Nous réservons, cherchons, négocions ou organisons. Vous êtes tenu informé "
     "à chaque étape utile."),
    ("4. Livraison et suivi", "Remise en main propre, livraison assurée ou accueil sur place, puis "
     "nous restons joignables."),
])

STEPS_APPORTEUR = ("Comment devenir apporteur d'affaires", [
    ("1. Vous nous contactez", "Vous nous dites qui vous pouvez recommander et pour quel "
     "service. Un échange de quinze minutes suffit."),
    ("2. Accord écrit", "Nous fixons par écrit la prime ou le pourcentage, les conditions de "
     "déclenchement et le délai de paiement."),
    ("3. Vous présentez", "Un message d'introduction, un nom et un numéro : la suite nous "
     "appartient. Vous n'avez rien à vendre."),
    ("4. Vous êtes payé", "Dès que la condition convenue est remplie (mandat signé, première "
     "réservation, transaction conclue), la prime est versée."),
])


def faq_contact() -> list:
    """Deux questions communes à toutes les pages du silo."""
    return [
        ("Comment vous contacter pour cette demande ?",
         "Par le formulaire en bas de cette page, par téléphone ou sur WhatsApp. Nous répondons "
         "le jour même en semaine, et nous proposons un créneau d'échange si la demande le mérite."),
        ("Travaillez-vous avec des particuliers et des entreprises ?",
         "Les deux. Les entreprises reçoivent une facture et peuvent ouvrir un compte pour des "
         "demandes récurrentes ; les particuliers paient à la prestation."),
    ]
