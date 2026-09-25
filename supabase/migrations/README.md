# Migrations normalisées : cible future, non appliquée

Les fichiers de ce dossier décrivent un schéma **normalisé** de l’ERP (une
table par entité : `erp.logements`, `erp.reservations`, `erp.missions`...).
C’est une **cible future, non appliquée**.

**Ne pas les lancer sur le projet Supabase de Label Maison** (ni par
`supabase db push`, ni en les collant dans le SQL Editor) : l’ERP en
production utilise aujourd’hui le modèle « un document par élément » installé
par [`../erp-installation.sql`](../erp-installation.sql) (tables
`erp.enregistrements`, `erp.etat_automatisations`, `erp.membres`,
`erp.historique`). Plusieurs fonctions portent des noms proches : les appliquer
par-dessus casserait les règles d’accès.

Le passage éventuel au schéma normalisé se fera par une migration de données
dédiée (lecture de `erp.enregistrements`, écriture dans les tables typées),
le jour où des requêtes SQL directes ou des rapports côté base le justifieront.
