# Règles du dépôt Label Maison

- **Design de l'ERP** (`src/erp`) : avant toute mise en ligne d'un changement d'interface, faire relire par l'agent `boss-design-apple` (`.claude/agents/boss-design-apple.md`). On ne fusionne que sur un verdict « VALIDÉ ».
- **Plateformes en lecture seule** : l'ERP lit les données (Repull) et répond aux voyageurs, rien d'autre. Ne jamais ajouter d'écriture de prix, calendrier, disponibilité ou annonce, ni assouplir `ecritureRepullPermise` (`src/erp/data/repull-synchro.ts`) ou le verrou d'`agent-ia/src/repull.ts`.
- **Dépôt public** : aucune clé, aucun secret, aucune donnée personnelle dans le code ou les commits.
