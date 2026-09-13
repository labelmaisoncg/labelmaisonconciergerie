---
name: linge
description: >
  Registre du linge de l'équipe de ménage. À utiliser dès que l'utilisateur
  colle un message de l'équipe de ménage (inventaire, linge récupéré, linge
  mis en place, ménage fait) pour l'enregistrer, OU quand il pose une question
  sur le linge (« qu'est-ce qui a été récupéré le… », « combien de draps… »,
  « historique du linge »). Données dans gestion/linge/registre.jsonl.
---

# Registre du linge — mode d'emploi pour Claude

Fichier de données : `gestion/linge/registre.jsonl` (à la racine du dépôt).
Une ligne JSON par intervention. Ne jamais réécrire le fichier entier :
**toujours ajouter à la fin** (append), sauf correction explicitement demandée.

## Mode 1 — Enregistrer un message de l'équipe de ménage

Déclencheur : l'utilisateur colle un message de l'équipe de ménage (souvent
transféré de WhatsApp/SMS, format libre, parfois mal orthographié), ou tape
`/linge` suivi du message.

1. **Extraire** du message :
   - `date` (format ISO `AAAA-MM-JJ`). Si absente → utiliser la date du jour
     et le signaler dans le récapitulatif.
   - `heure` (`HH:MM`, ou null).
   - `logement` (nom du bien, ou null si non précisé).
   - `equipe` (prénom/nom de la personne, ou null).
   - `linge_recupere` : liste `[{"article": "...", "quantite": N}]` — le linge
     SALE repris pour lavage.
   - `linge_depose` : même format — le linge PROPRE mis en place.
   - `notes` : taches, articles manquants ou abîmés, remarques.
   - Attention au sens : « récupéré / repris / enlevé / sale » → `linge_recupere` ;
     « mis / installé / posé / propre / déposé » → `linge_depose`.
2. **Ne jamais inventer** une quantité ni un article. Si le message est
   ambigu (on ne sait pas si un article est repris ou déposé), demander à
   l'utilisateur plutôt que de deviner.
3. **Ajouter une ligne** au fichier avec un JSON compact sur une seule ligne,
   incluant aussi `message_brut` (le message original verbatim) et
   `enregistre_le` (horodatage ISO courant). Utiliser un append shell :
   `printf '%s\n' '<json>' >> gestion/linge/registre.jsonl` (échapper les
   apostrophes) ou lire puis réécrire avec la ligne ajoutée si le message
   contient des caractères compliqués.
4. **Répondre** avec un récapitulatif court et lisible : date, heure,
   logement, tableau récupéré / mis en place, notes. Signaler toute
   information déduite (ex. date du jour par défaut).

Si plusieurs interventions dans un même message (plusieurs logements ou
plusieurs dates) → une ligne JSON par intervention.

Option : si l'utilisateur demande de lire le message directement dans ses
SMS/iMessage (« enregistre le dernier message de [contact] »), utiliser les
outils iMessage (Read_and_Send_iMessages) pour récupérer le texte, montrer le
message trouvé, puis suivre les étapes ci-dessus. Ne jamais envoyer de message
sans demande explicite.

## Mode 2 — Rechercher / interroger le registre

Déclencheur : question sur l'historique (« qu'est-ce qui a été récupéré le
10 septembre ? », « combien de housses de couette en septembre ? »,
`/linge recherche …`).

1. Lire `gestion/linge/registre.jsonl` (ou filtrer avec `grep` sur la date si
   le fichier est gros).
2. Répondre en français, clairement : date(s), logement(s), quantités
   totalisées si la question porte sur un total. Citer la date de chaque
   intervention utilisée pour la réponse.
3. Si aucune intervention ne correspond, le dire simplement (ne rien inventer).

## Corrections

Si l'utilisateur signale une erreur (« en fait c'était 3 draps »), retrouver
la ligne concernée, la corriger (en conservant `message_brut` intact) et
confirmer la modification.

## Après chaque enregistrement

Proposer de committer si l'utilisateur est en fin de session, pour que le
registre soit sauvegardé dans git (le fichier est versionné exprès : chaque
modification reste traçable).
