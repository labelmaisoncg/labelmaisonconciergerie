-- Passage à Repull (https://repull.dev) comme source des annonces,
-- réservations, calendriers et messages voyageurs.
--
-- À exécuter une fois, après 005. Idempotent : sans effet sur une base créée
-- directement avec le schema.sql à jour, rejouable sans dommage.
--
-- Ce que fait la migration :
--  1. logements : l'ancien identifiant de propriété devient `repull_listing_id`.
--     Les valeurs sont EFFACÉES : un identifiant de l'ancien gestionnaire de
--     canaux n'est pas un identifiant Repull. Les logements et leurs fiches
--     (codes, wifi, consignes) sont conservés ; l'annonce Repull s'y rattache
--     quand la conciergerie reconnecte son compte (même nom → même logement).
--  2. Les colonnes propres à l'ancien gestionnaire (groupe, type de chambre,
--     plan tarifaire, canal) sont supprimées : Repull n'a pas ces notions.
--  3. liens_connexion : plus de logement imposé, et de quoi reconnaître le
--     compte connecté au retour de Repull.
--  4. comptes_plateformes : qui possède quel compte Airbnb ou Booking. C'est
--     désormais LE cloisonnement entre conciergeries.
--  5. Les réservations déjà vues sous l'ancien identifiant sont oubliées.

-- 1. Annonce Repull du logement
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'logements' and column_name = 'channex_property_id') then
    alter table logements rename column channex_property_id to repull_listing_id;
    update logements set repull_listing_id = null;
    update logements set airbnb_connecte = false, booking_connecte = false;
  end if;
end $$;
alter table logements add column if not exists repull_listing_id text;
create unique index if not exists logements_repull_listing_idx on logements(repull_listing_id);

-- 2. Colonnes sans équivalent chez Repull
alter table logements drop column if exists channex_room_type_id;
alter table logements drop column if exists channex_rate_plan_id;
alter table conciergeries drop column if exists channex_group_id;

-- 3. Liens de connexion
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name = 'liens_connexion' and column_name = 'channex_canal_id') then
    -- Les liens émis avant la bascule menaient à l'ancien parcours : périmés.
    update liens_connexion set expire_le = now() where expire_le > now();
    alter table liens_connexion drop column channex_canal_id;
  end if;
end $$;
alter table liens_connexion alter column logement_id drop not null;
alter table liens_connexion add column if not exists comptes_avant jsonb;
alter table liens_connexion add column if not exists finalise_le timestamptz;

-- 4. Comptes de plateformes rattachés à chaque conciergerie
create table if not exists comptes_plateformes (
  canal           text not null check (canal in ('airbnb', 'booking')),
  compte_id       text not null,   -- id d'hôte Airbnb, ou id d'établissement Booking
  conciergerie_id uuid not null references conciergeries(id) on delete cascade,
  cree_le         timestamptz not null default now(),
  primary key (canal, compte_id)
);
create index if not exists comptes_plateformes_conciergerie_idx on comptes_plateformes(conciergerie_id);

-- 5. Les clés de réservations sont désormais `<id Repull>@<updatedAt>`.
delete from reservations_acquittees where revision_id not like '%@%' and revision_id not like 'evt:%';
