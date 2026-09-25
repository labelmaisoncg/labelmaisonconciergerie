-- Compteur mensuel des appels à l'API Repull (offre gratuite : 1 000 / mois,
-- partagés avec l'ERP). Idempotent.
create table if not exists quota_repull (
  mois   text primary key,          -- 'AAAA-MM' (UTC)
  appels integer not null default 0
);

-- Repère par fil de messages : date du dernier message déjà examiné. Le
-- rattrapage ne relit un fil que s'il a bougé depuis.
create table if not exists fils_vus (
  fil_id    text primary key,
  vu_jusqua text not null,
  maj_le    timestamptz not null default now()
);
