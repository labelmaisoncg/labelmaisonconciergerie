# -*- coding: utf-8 -*-
"""Simulateur de revenus en location courte durée.

Le calcul se fait entièrement à partir des hypothèses saisies par le visiteur :
aucune donnée de marché n'est préremplie comme une vérité. Les valeurs par
défaut sont volontairement neutres et signalées comme telles — c'est un outil de
raisonnement, pas une promesse de rendement.
"""
from __future__ import annotations

import seo_common as C
import seo_article as ART

SLUG = "simulateur-revenus-airbnb"
PATH = "/" + SLUG
URL = C.SITE + PATH

CALC = """
<section class="wrap" id="simulateur">
<h2>Simulateur de revenus en location courte durée</h2>
<p class="lead">Renseignez vos hypothèses : le calcul se met à jour à chaque modification.
Tout se passe dans votre navigateur, aucune donnée n'est envoyée.</p>
<div class="calc" style="margin-top:24px">
  <h3 style="margin-top:0">1. Vos revenus</h3>
  <div class="row">
    <div class="field"><label for="prix">Prix moyen par nuit (€)</label>
      <input id="prix" type="number" min="0" step="1" value="90"></div>
    <div class="field"><label for="occ">Taux d'occupation moyen (%)</label>
      <input id="occ" type="number" min="0" max="100" step="1" value="55"></div>
    <div class="field"><label for="los">Durée moyenne d'un séjour (nuits)</label>
      <input id="los" type="number" min="1" step="1" value="3"></div>
    <div class="field"><label for="cap">Plafond de nuitées (0 = aucun)</label>
      <input id="cap" type="number" min="0" step="1" value="0"></div>
    <div class="field"><label for="fmenage">Frais de ménage facturés au voyageur (€ / séjour)</label>
      <input id="fmenage" type="number" min="0" step="1" value="45"></div>
  </div>

  <h3>2. Vos frais</h3>
  <div class="row">
    <div class="field"><label for="cmenage">Coût réel du ménage et du linge (€ / séjour)</label>
      <input id="cmenage" type="number" min="0" step="1" value="55"></div>
    <div class="field"><label for="conso">Consommables et accueil (€ / séjour)</label>
      <input id="conso" type="number" min="0" step="1" value="8"></div>
    <div class="field"><label for="plat">Commission des plateformes (%)</label>
      <input id="plat" type="number" min="0" max="30" step="0.5" value="3"></div>
    <div class="field"><label for="gest">Commission de conciergerie (%, 0 si vous gérez seul)</label>
      <input id="gest" type="number" min="0" max="40" step="0.5" value="20"></div>
    <div class="field"><label for="fixe">Charges fixes annuelles en courte durée (€)</label>
      <input id="fixe" type="number" min="0" step="50" value="2500"></div>
  </div>

  <h3>3. Comparaison avec la longue durée</h3>
  <div class="row">
    <div class="field"><label for="loyer">Loyer mensuel en meublé classique (€)</label>
      <input id="loyer" type="number" min="0" step="10" value="800"></div>
    <div class="field"><label for="fixeld">Charges fixes annuelles en longue durée (€)</label>
      <input id="fixeld" type="number" min="0" step="50" value="1500"></div>
  </div>

  <div class="calcout" id="sortie">
    <div><span class="gold">Nuits louées par an</span><div class="big" id="rNuits">—</div>
      <span class="gold" id="rSejours">—</span></div>
    <div><span class="gold">Revenu brut encaissé</span><div class="big" id="rBrut">—</div>
      <span class="gold">frais de ménage refacturés inclus</span></div>
    <div><span class="gold">Total des frais</span><div class="big" id="rFrais">—</div>
      <span class="gold" id="rDetail">—</span></div>
    <div><span class="gold">Revenu net avant impôt</span><div class="big" id="rNet">—</div>
      <span class="gold" id="rMois">—</span></div>
    <div style="grid-column:1/-1;border-top:1px solid rgba(255,255,255,.2);padding-top:12px">
      <span class="gold">Écart avec la location meublée classique</span>
      <div class="big" id="rEcart">—</div>
      <span class="gold" id="rConseil">—</span></div>
  </div>
  <p class="disc">Résultat avant impôt et prélèvements sociaux. Le calcul reprend vos hypothèses :
  il ne vaut que ce qu'elles valent. Les valeurs par défaut sont des repères neutres, pas des
  données de marché — c'est à vous de les remplacer par celles de votre secteur, ou de nous
  demander une <a href="/estimation-rentabilite-airbnb">estimation gratuite</a> fondée sur des
  biens comparables réellement loués autour du vôtre.</p>
</div>
</section>
<script>
(function(){
  var ids=['prix','occ','los','cap','fmenage','cmenage','conso','plat','gest','fixe','loyer','fixeld'];
  var eur=new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:0});
  var num=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:0});
  function v(id){var e=document.getElementById(id);var n=parseFloat(e.value);return isNaN(n)?0:n;}
  function set(id,t){document.getElementById(id).textContent=t;}
  function calc(){
    var nuits=365*v('occ')/100;
    var cap=v('cap');
    if(cap>0&&nuits>cap){nuits=cap;}
    var los=Math.max(1,v('los'));
    var sejours=nuits/los;
    var brut=nuits*v('prix')+sejours*v('fmenage');
    var plateforme=brut*v('plat')/100;
    var gestion=(brut-plateforme)*v('gest')/100;
    var menage=sejours*(v('cmenage')+v('conso'));
    var frais=plateforme+gestion+menage+v('fixe');
    var net=brut-frais;
    var netLD=v('loyer')*12-v('fixeld');
    var ecart=net-netLD;
    set('rNuits',num.format(Math.round(nuits))+' nuits');
    set('rSejours',num.format(Math.round(sejours))+' séjours à servir');
    set('rBrut',eur.format(brut));
    set('rFrais',eur.format(frais));
    set('rDetail','plateformes '+eur.format(plateforme)+' · gestion '+eur.format(gestion)
      +' · ménage '+eur.format(menage)+' · charges '+eur.format(v('fixe')));
    set('rNet',eur.format(net));
    set('rMois',eur.format(net/12)+' par mois en moyenne');
    set('rEcart',(ecart>=0?'+ ':'− ')+eur.format(Math.abs(ecart))+' par an');
    set('rConseil', ecart>0
      ? 'La courte durée est devant — vérifiez que vous avez le droit de la pratiquer.'
      : 'La longue durée est devant avec ces hypothèses : moins de charges, moins de gestion.');
  }
  ids.forEach(function(id){
    var e=document.getElementById(id);
    e.addEventListener('input',calc);
    e.addEventListener('change',calc);
  });
  calc();
})();
</script>
"""


def main() -> str:
    titre = "Simulateur de revenus Airbnb — calculez votre revenu net réel"
    desc = ("Simulateur gratuit de revenus en location courte durée : nuits louées, frais de "
            "ménage, commissions, charges fixes et comparaison avec la location meublée "
            "classique. Calcul instantané dans votre navigateur.")
    trail = [("Accueil", "/"), ("Blog", "/blog"), ("Simulateur", PATH)]
    faq_items = [
        ("Le simulateur donne-t-il un chiffre fiable ?",
         "Il donne un calcul rigoureux à partir de VOS hypothèses. Sa fiabilité dépend donc "
         "entièrement du réalisme du prix par nuit et du taux d'occupation que vous saisissez. "
         "Pour caler ces deux valeurs sur votre secteur, demandez-nous une estimation gratuite."),
        ("Pourquoi comparer avec la location meublée classique ?",
         "Parce que c'est la vraie alternative. La courte durée ne se juge pas en valeur absolue "
         "mais par rapport à ce que le même logement rapporterait en longue durée, charges et "
         "gestion déduites."),
        ("Les impôts sont-ils pris en compte ?",
         "Non. Le résultat est un revenu net avant impôt et prélèvements sociaux. La fiscalité "
         "dépend de votre régime — voir notre article micro-BIC ou réel."),
        ("Que mettre dans les charges fixes ?",
         "Taxe foncière, charges de copropriété, assurance adaptée à la location saisonnière, "
         "énergie, eau, internet, abonnements et comptabilité. La liste détaillée figure dans "
         "notre article sur les charges d'une location courte durée."),
        ("Mes données sont-elles enregistrées ?",
         "Non. Le calcul s'exécute dans votre navigateur ; rien n'est transmis ni conservé."),
        ("Pourquoi le résultat baisse quand j'augmente le nombre de séjours ?",
         "Parce que chaque séjour supplémentaire coûte un ménage, du linge et des consommables. "
         "À revenu brut égal, un séjour long laisse davantage qu'un enchaînement de séjours "
         "courts — c'est l'un des enseignements les plus utiles du simulateur."),
    ]
    ld_app = {
        "@context": "https://schema.org", "@type": "WebApplication",
        "name": "Simulateur de revenus en location courte durée",
        "url": URL, "applicationCategory": "FinanceApplication",
        "operatingSystem": "Tout navigateur web", "inLanguage": "fr-FR",
        "offers": {"@type": "Offer", "price": "0", "priceCurrency": "EUR"},
        "publisher": {"@type": "Organization", "name": "Label Maison Conciergerie",
                      "url": C.SITE + "/"},
        "description": desc,
    }
    p = C.photo(9)
    parts = [
        C.head(titre, desc, PATH, [ld_app, C.ld_faq(faq_items), C.ld_breadcrumb(trail)],
               image=f"{C.SITE}/images/{p[0]}"),
        C.header(ART.NAV),
        C.crumb(trail),
        C.hero("🧮 Outil gratuit",
               "Simulateur de <span class=\"font-serif-italic\">revenus locatifs</span>",
               "Combien reste-t-il vraiment une fois le ménage, le linge, les commissions et les "
               "charges payés ? Renseignez vos hypothèses, le calcul se fait instantanément.",
               p[0], "Logement en location courte durée géré par Label Maison Conciergerie",
               ["Calcul <b>instantané</b>", "Charges <b>incluses</b>",
                "Comparaison <b>longue durée</b>", "Aucune <b>donnée collectée</b>"],
               cta1="Aller au simulateur"),
        C.texte([
            "La plupart des simulateurs du marché annoncent un revenu brut flatteur en trois "
            "clics. Celui-ci fait l'inverse : il vous demande de poser vos hypothèses, puis il "
            "déduit méthodiquement tout ce qui se glisse entre ce que paie le voyageur et ce qui "
            "reste sur votre compte.",
            "Le résultat n'est pas une promesse : c'est votre propre raisonnement, mis en chiffres. "
            "Si les hypothèses sont optimistes, le résultat le sera aussi — d'où l'intérêt de "
            "caler le prix moyen et le taux d'occupation sur des biens réellement comparables au "
            "vôtre.",
        ], pad=True),
        CALC,
        C.texte([
            "<strong>Le nombre de séjours compte autant que le prix.</strong> Faites varier la "
            "durée moyenne de séjour : à revenu brut identique, passer de trois à six nuits "
            "diminue de moitié les frais de ménage, de linge et de consommables.",
            "<strong>Le plafond de nuitées change tout pour une résidence principale.</strong> "
            "Saisissez 120 — ou le plafond de votre commune — dans le champ dédié : le calcul se "
            "recale automatiquement. Voir notre article sur "
            "<a href=\"/plafond-120-nuits-residence-principale\">le plafond de nuitées</a>.",
            "<strong>La comparaison avec la longue durée est le vrai juge de paix.</strong> Si "
            "l'écart annuel est faible, la courte durée n'en vaut probablement pas la peine : "
            "elle demande plus de travail, plus de trésorerie et supporte un risque "
            "réglementaire supérieur.",
        ], titre="Comment lire le résultat"),
        C.texte([
            "Un simulateur ne connaît ni votre rue, ni votre étage, ni le calendrier des salons "
            "de votre ville, ni ce que votre mairie a délibéré le mois dernier. Il ne sait pas "
            "non plus si votre bien est éligible à la courte durée.",
            "C'est précisément ce que nous regardons dans une estimation : les biens comparables "
            "réellement loués autour du vôtre, la saisonnalité locale mois par mois, les "
            "démarches applicables à votre adresse et le régime le plus rentable sur douze mois. "
            "C'est gratuit et sans engagement.",
        ], titre="Ce que ce simulateur ne peut pas savoir"),
        C.cartes("Pour aller plus loin", "", [
            ("Les charges réelles d'une location",
             "La liste complète de ce qu'il faut déduire — <a href=\"/charges-location-courte-duree\">lire l'article</a>."),
            ("Calculer sa rentabilité",
             "La méthode en quatre étapes et les cinq erreurs de calcul les plus fréquentes — "
             "<a href=\"/calculer-rentabilite-location-courte-duree\">lire l'article</a>."),
            ("Courte, moyenne ou longue durée",
             "Le comparatif complet des trois régimes — <a href=\"/courte-moyenne-longue-duree-comparatif\">lire l'article</a>."),
            ("Micro-BIC ou réel",
             "L'arbitrage fiscal qui suit le calcul de revenus — <a href=\"/micro-bic-ou-reel-location-meublee\">lire l'article</a>."),
            ("Combien coûte une conciergerie",
             "Ce que recouvre réellement une commission — <a href=\"/combien-coute-une-conciergerie-airbnb\">lire l'article</a>."),
            ("Le blog des propriétaires",
             "Tous nos guides, par catégorie — <a href=\"/blog\">accéder au blog</a>."),
        ]),
        C.faq("Questions fréquentes — simulateur de revenus", faq_items),
        C.formulaire("Faites vérifier vos hypothèses par un humain",
                     "Envoyez-nous l'adresse et la surface de votre bien : nous remplaçons vos "
                     "estimations par des chiffres observés sur des logements comparables, et nous "
                     "vous disons franchement si le projet tient.",
                     "", "Estimation de revenus", titre),
        C.footer(ART.FOOTER,
                 "Simulateur de revenus locatifs — vos hypothèses, "
                 "<span class=\"font-serif-italic\">un calcul honnête</span>.",
                 "Paris · Île-de-France · France"),
        C.mobcta("Estimer mes revenus"),
    ]
    C.write(SLUG, parts)
    print("Simulateur : 1 page")
    return PATH


if __name__ == "__main__":
    main()
