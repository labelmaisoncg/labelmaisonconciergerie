-- =============================================================================
-- ERP Label Maison : accès extérieurs et relances réservés aux gérants.
--
-- À coller dans Supabase → SQL Editor → New query → Run (projet Label Maison).
-- Idempotent : peut être relancé. Même règle que dans erp-installation.sql.
--
-- Effet : les enregistrements des collections
--   accesProprietaires   accès à l'espace propriétaire (adresse, empreintes des liens)
--   accesOperations      accès à l'espace opérations
--   relancesPaiement     relances de paiement des propriétaires
--   reglagesRelances     leurs réglages (mode automatique ou non)
-- ne sont plus lisibles ni modifiables que par un gérant (le serveur passe
-- par le compte d'équipe, gérant). Sans cette règle, un compte « opérations »
-- ou « lecture » lirait ces adresses, et un compte « opérations » pourrait
-- écrire un accès avec l'empreinte d'un jeton qu'il connaît, puis entrer dans
-- l'espace d'un propriétaire. Rien d'autre ne change.
--
-- Après supabase/erp-espaces.sql, cette règle y est déjà (par espace) : ce
-- script refuse alors de tourner.
-- =============================================================================

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'erp' and table_name = 'enregistrements' and column_name = 'espace') then
    raise exception 'Base passée aux espaces : la règle est dans supabase/erp-espaces.sql, relancez celui-ci.';
  end if;
end;
$$;

drop policy if exists "acces exterieurs reserves aux gerants" on erp.enregistrements;
create policy "acces exterieurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances') or erp.acces_gerant())
  with check (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances') or erp.acces_gerant());

-- ----------------------------------------------------------------- recette
-- Essai dans une transaction annulée à la fin : rien n'est gardé. Un compte
-- « opérations » lit l'ERP mais pas les accès, et ne peut pas en écrire ; un
-- gérant les lit.
create or replace function erp.recette_acces_gerants() returns text
language plpgsql set search_path = ''
as $$
declare
  resultat text := 'ok';
  n int;
begin
  begin
    insert into erp.membres (email, nom, role) values
      ('recette-ops@exemple.invalid', 'Recette opérations', 'operations'),
      ('recette-gerant@exemple.invalid', 'Recette gérant', 'gerant');
    insert into erp.enregistrements (collection, id, donnees) values
      ('recette', 'recette-acces', '{"id": "recette-acces"}'),
      ('accesProprietaires', 'recette-acces', '{"id": "recette-acces"}');

    perform set_config('role', 'authenticated', true);

    -- 1. Compte « opérations » : l'ERP oui, les accès non.
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-ops@exemple.invalid"}', true);
    select count(*) into n from erp.enregistrements where collection = 'recette' and id = 'recette-acces';
    if n <> 1 then resultat := 'un compte « opérations » ne lit plus l''ERP'; raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 0 then resultat := 'un compte « opérations » lit les accès des propriétaires'; raise exception 'stop'; end if;
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('accesProprietaires', 'recette-intrus', '{}');
      resultat := 'un compte « opérations » écrit un accès propriétaire';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('reglagesRelances', 'recette-intrus', '{}');
      resultat := 'un compte « opérations » écrit les réglages des relances';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;

    -- 2. Gérant : les accès, oui.
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-gerant@exemple.invalid"}', true);
    select count(*) into n from erp.enregistrements where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 1 then resultat := 'un gérant ne lit pas les accès des propriétaires'; raise exception 'stop'; end if;

    raise exception 'recette_terminee';
  exception when others then
    if sqlerrm <> 'recette_terminee' and resultat = 'ok' then
      resultat := 'essai impossible : ' || sqlerrm;
    end if;
  end;
  return resultat;
end;
$$;
revoke all on function erp.recette_acces_gerants() from public, anon, authenticated;

-- Vérification (dernière instruction, affichée dans « Results ») :
-- attendu regle = 1, recette = ok.
select
  (select count(*) from pg_policies
    where schemaname = 'erp' and tablename = 'enregistrements'
      and policyname = 'acces exterieurs reserves aux gerants' and permissive = 'RESTRICTIVE') as regle,
  erp.recette_acces_gerants() as recette;
