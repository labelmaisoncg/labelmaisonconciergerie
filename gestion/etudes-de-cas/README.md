# Études de cas (pages /etude-de-cas-…)

Une étude de cas = un fichier JSON dans ce dossier, généré en page par
`scripts/gen_etudes_de_cas.py`. **Aucune page n'est produite tant que le dossier
ne contient que ce README** : on ne publie que des chiffres réels, validés par
le propriétaire du bien (accord écrit conservé dans gestion/).

Champs attendus (voir `exemple.json.txt`, à copier en `.json` une fois rempli) :

- `slug` : fin de l'adresse, ex. `t2-sainte-genevieve-des-bois`
- `titre`, `ville`, `type_bien` (ex. « T2 de 45 m² »), `depuis` (mois/année de début de gestion)
- `periode` : période mesurée, ex. « juin à septembre 2026 »
- `chiffres` : liste de {"libelle", "valeur"} — uniquement des valeurs mesurées
  (nuits louées, revenu brut, revenu net versé, note moyenne, nombre d'avis)
- `contexte`, `ce_que_nous_avons_fait` (liste), `resultat`, `citation` (facultative,
  avec l'accord du propriétaire, prénom seul)
- `photos` : chemins sous public/images/real/ (photos réelles du bien)
