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

## Accès à la page en ligne

Le registre est publié sur <https://www.labelmaisoncg.fr/linge>, derrière une
page de connexion : **pas d'identifiant, seulement un mot de passe**. Une fois
saisi, un cookie signé garde la session ouverte 30 jours ; le lien
« Se déconnecter » en bas de page la ferme.

Le mot de passe est la variable `LINGE_PASSWORD` du projet Vercel
(Settings → Environment Variables, à définir pour Production **et** Preview).
Après l'avoir ajoutée ou modifiée, **redéployer** : la valeur est injectée au
build, l'enregistrer dans l'interface ne suffit pas. Changer le mot de passe
invalide automatiquement toutes les sessions ouvertes.

La page lit `public/linge/registre.json`, régénéré à chaque build par
`scripts/build-linge.mjs` depuis le `.jsonl` : une nouvelle ligne n'apparaît
en ligne qu'après un commit sur `main` et le déploiement qui suit.
