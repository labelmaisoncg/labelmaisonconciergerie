# Registre du linge — équipe de ménage

Ce dossier contient le registre des interventions de l'équipe de ménage :
pour chaque intervention, la date, l'heure, le logement, **tout le linge
récupéré** (sale, repris pour lavage) et **tout le linge mis en place** (propre).

## Comment ça marche

La conversation Claude sert d'intermédiaire :

1. **Enregistrer** — coller dans Claude le message envoyé par l'équipe de
   ménage (tel quel, même désordonné). Claude extrait les informations,
   affiche un récapitulatif et ajoute une ligne dans `registre.jsonl`.
2. **Rechercher** — demander par exemple « qu'est-ce qui a été récupéré le
   10 septembre ? » ou « combien de housses de couette ce mois-ci ? ».
   Claude lit le registre et répond.

Le skill correspondant est dans `.claude/skills/linge/SKILL.md`
(invocable aussi avec `/linge`).

## Format d'un enregistrement (`registre.jsonl`, 1 ligne JSON par intervention)

```json
{
  "date": "2026-09-13",
  "heure": "14:30",
  "logement": "Nom du logement (ou null si non précisé)",
  "equipe": "Nom / personne qui a envoyé le message (ou null)",
  "linge_recupere": [{"article": "housse de couette", "quantite": 2}],
  "linge_depose": [{"article": "drap plat", "quantite": 2}],
  "notes": "Remarques éventuelles (taches, manquants…)",
  "message_brut": "Le message original de l'équipe, verbatim",
  "enregistre_le": "2026-09-13T18:02:00"
}
```

Règles :
- `linge_recupere` = linge repris (sale) ; `linge_depose` = linge installé (propre).
- Le message original est toujours conservé dans `message_brut` (preuve / audit).
- Aucune quantité n'est inventée : si le message est ambigu, Claude demande.
