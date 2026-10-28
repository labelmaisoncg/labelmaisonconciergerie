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
--   checkinsEnLigne      check-ins en ligne des voyageurs (fiches de police),
--                        jamais archivés : la purge à 6 mois les efface vraiment
-- ne sont plus lisibles ni modifiables que par un gérant (le serveur passe
-- par le compte d'équipe, gérant), pas plus que leurs anciennes versions
-- dans erp.historique (ni celles de la collection « connecteurs »). Sans cette règle, un compte « opérations »
-- ou « lecture » lirait ces adresses, et un compte « opérations » pourrait
-- écrire un accès avec l'empreinte d'un jeton qu'il connaît, puis entrer dans
-- l'espace d'un propriétaire.
--
-- Écritures réservées aux gérants (la lecture ne change pas) : ce que seul le
-- serveur écrit (envoisProgrammes, programmes, agent, repull,
-- passagesFacturesMensuelles, conseilsPrix/etat, reglages/alerte-controle-agent)
-- et ce que seul un gérant change (factures, conseilsPrix/reglages,
-- reglages : messages-programmes, societe, numerotation-factures, supplements) ; dans les
-- réglages de l'agent (reglages/agent), la marche, le niveau d'autonomie, les
-- horaires, ce qu'il confie et le délai : un gérant seulement ; une facture
-- numérotée ne change plus, sauf son paiement et son partage, et ne se
-- supprime pas (LMF01) ; son numéro n'est jamais écrit par l'API (LMF02), et
-- deux factures ne partagent pas un numéro.
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
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances', 'checkinsEnLigne') or erp.acces_gerant())
  with check (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances', 'checkinsEnLigne') or erp.acces_gerant());

-- Archive des anciennes versions : la même que dans erp-installation.sql
-- (base d'avant les espaces), sans les check-ins en ligne.
create or replace function erp.archiver_version() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Check-ins en ligne (fiches de police des voyageurs étrangers, cahier B2) :
  -- jamais archivés, pour que la purge à 6 mois les efface vraiment
  -- (src/erp/data/sejour.ts, api/_sejour.ts).
  if old.collection = 'checkinsEnLigne' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    insert into erp.historique (collection, id, operation, donnees, maj_par)
    values (old.collection, old.id, 'suppression', old.donnees, old.maj_par);
    return old;
  end if;
  if new.donnees is distinct from old.donnees then
    insert into erp.historique (collection, id, operation, donnees, maj_par)
    values (old.collection, old.id, 'modification', old.donnees, old.maj_par);
  end if;
  return new;
end;
$$;
revoke all on function erp.archiver_version() from public, anon, authenticated;

-- Check-in en ligne (livret du séjour, cahier B2) : la collection
-- « checkinsEnLigne » (heure d'arrivée, nombre de voyageurs, fiches de police
-- des voyageurs étrangers) est lue et écrite par les gérants seulement, dont
-- le compte d'équipe qui sert au serveur (règle ci-dessus) ; elle n'est
-- jamais archivée (erp.archiver_version) et ses anciennes versions
-- éventuelles sont effacées ici. Le serveur n'enregistre aucun check-in tant
-- que cette fonction n'existe pas (api/_sejour.ts, checkinPret) : jamais de
-- fiche de police sans ces règles.
create or replace function erp.checkin_en_ligne_pret() returns boolean
language sql immutable set search_path = ''
as $$ select true $$;
revoke all on function erp.checkin_en_ligne_pret() from public, anon;
grant execute on function erp.checkin_en_ligne_pret() to authenticated;
delete from erp.historique where collection = 'checkinsEnLigne';

-- Écritures réservées aux gérants (le serveur passe par le compte d'équipe,
-- gérant) ; la lecture ne change pas. Ce que seul le serveur écrit (envois
-- et état des messages automatiques, état de l'agent et de la
-- synchronisation, passages des factures mensuelles, état des prix) et ce
-- que seul un gérant change (factures, réglages des prix, modèles des
-- messages automatiques, identité de la société, numérotation des factures,
-- suppléments proposés aux voyageurs).
-- Même règle que dans erp-espaces.sql (par espace).
create or replace function erp.ecriture_gerant_seulement(p_collection text, p_id text) returns boolean
language sql immutable set search_path = ''
as $$
  select p_collection in ('envoisProgrammes', 'programmes', 'agent', 'repull', 'factures', 'passagesFacturesMensuelles', 'annoncesEquipe')
      or (p_collection = 'conseilsPrix' and p_id in ('reglages', 'etat'))
      or (p_collection = 'reglages' and p_id in ('messages-programmes', 'societe', 'numerotation-factures', 'alerte-controle-agent', 'supplements'))
$$;
revoke all on function erp.ecriture_gerant_seulement(text, text) from public, anon;
grant execute on function erp.ecriture_gerant_seulement(text, text) to authenticated;
drop policy if exists "ecritures reservees aux gerants (ajout)" on erp.enregistrements;
drop policy if exists "ecritures reservees aux gerants (modification)" on erp.enregistrements;
drop policy if exists "ecritures reservees aux gerants (suppression)" on erp.enregistrements;
create policy "ecritures reservees aux gerants (ajout)" on erp.enregistrements
  as restrictive for insert to authenticated
  with check (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant());
create policy "ecritures reservees aux gerants (modification)" on erp.enregistrements
  as restrictive for update to authenticated
  using (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant())
  with check (not erp.ecriture_gerant_seulement(collection, id) or erp.acces_gerant());
create policy "ecritures reservees aux gerants (suppression)" on erp.enregistrements
  as restrictive for delete to authenticated
  using ((not erp.ecriture_gerant_seulement(collection, id) and not (collection = 'reglages' and id = 'agent')) or erp.acces_gerant());

-- Réglages de l'agent réservés au gérant (reglages / agent) : marche ou pause,
-- niveau d'autonomie, horaires, ce qu'il vous confie, délai avant de vous
-- prévenir (REGLAGES_AGENT_GERANT, src/erp/data/messagerie-ia.ts) ; ton,
-- signature, langues et Telegram restent à l'équipe. Déclencheur (une règle
-- RLS ne compare pas l'avant et l'après) ; ajout sans ligne enregistrée :
-- aucune de ces clés. Même déclencheur que dans erp-espaces.sql.
create or replace function erp.garder_autonomie_agent() returns trigger
language plpgsql set search_path = ''
as $$
declare
  cles constant text[] := array['actif', 'autonomie', 'horaires', 'transmettre', 'delaiAlerteMinutes'];
  avant jsonb;
  k text;
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.collection = 'reglages' and old.id = 'agent'
     and (new.collection <> 'reglages' or new.id <> 'agent') and not erp.acces_gerant() then
    raise exception 'Seul un gérant change ces réglages de l''agent.' using errcode = '42501';
  end if;
  if new.collection <> 'reglages' or new.id <> 'agent' or erp.acces_gerant() then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.collection = 'reglages' and old.id = 'agent' then
    avant := old.donnees;
  else
    select e.donnees into avant from erp.enregistrements e where e.collection = 'reglages' and e.id = 'agent';
  end if;
  avant := coalesce(avant, '{}'::jsonb);
  foreach k in array cles loop
    if (new.donnees -> k) is distinct from (avant -> k) then
      raise exception 'Seul un gérant change ces réglages de l''agent.' using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function erp.garder_autonomie_agent() from public, anon;
drop trigger if exists garder_autonomie_agent on erp.enregistrements;
create trigger garder_autonomie_agent before insert or update on erp.enregistrements
  for each row execute function erp.garder_autonomie_agent();

-- Numéro de facture comparable : sans blancs autour (espaces, tabulations,
-- retours à la ligne, espaces insécables ou invisibles). Même fonction que
-- dans erp-espaces.sql.
create or replace function erp.numero_normalise(p text) returns text
language sql immutable parallel safe set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''),
    '^[[:space:]' || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+|[[:space:]'
      || chr(160) || chr(8199) || chr(8203) || chr(8239) || chr(65279) || ']+$', '', 'g')
$$;
revoke all on function erp.numero_normalise(text) from public, anon;
grant execute on function erp.numero_normalise(text) to authenticated;

-- Facture numérotée : plus rien ne change, sauf le paiement (statut émise,
-- payée ou en retard, date de paiement) et le partage ; elle ne se supprime
-- pas. Même déclencheur que dans erp-espaces.sql.
create or replace function erp.figer_facture_numerotee() returns trigger
language plpgsql set search_path = ''
as $$
declare
  libres constant text[] := array['statut', 'payeeLe', 'partageeLe'];
begin
  if current_user <> 'authenticated' or old.collection <> 'factures'
     or erp.numero_normalise(old.donnees ->> 'numero') = '' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'DELETE' then
    raise exception 'Facture numérotée : elle ne se supprime pas (faites un avoir).' using errcode = 'LMF01';
  end if;
  if (to_jsonb(new) - 'donnees' - 'maj_le' - 'maj_par') is distinct from (to_jsonb(old) - 'donnees' - 'maj_le' - 'maj_par')
     or (new.donnees - libres) is distinct from (old.donnees - libres)
     or (coalesce(new.donnees ->> 'statut', '') not in ('emise', 'payee', 'en_retard')
         and (new.donnees -> 'statut') is distinct from (old.donnees -> 'statut')) then
    raise exception 'Facture numérotée : seuls le paiement et le partage changent encore.' using errcode = 'LMF01';
  end if;
  return new;
end;
$$;
revoke all on function erp.figer_facture_numerotee() from public, anon;
drop trigger if exists figer_facture_numerotee on erp.enregistrements;
create trigger figer_facture_numerotee before update or delete on erp.enregistrements
  for each row execute function erp.figer_facture_numerotee();

-- Numéro d'une facture : jamais écrit par l'API, gérant compris (LMF02) ; il
-- est attribué par la base (erp.numeroter_facture, après erp-espaces.sql).
-- Deux factures ne partagent pas un numéro (index créé seulement sans
-- doublons ; sinon un avertissement les liste). Même déclencheur que dans
-- erp-espaces.sql.
create or replace function erp.reserver_numero_facture() returns trigger
language plpgsql set search_path = ''
as $$
declare
  avant text := '';
begin
  if current_user <> 'authenticated' or new.collection <> 'factures'
     or coalesce(current_setting('erp.numerotation', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    if old.collection = 'factures' and old.id = new.id then
      avant := erp.numero_normalise(old.donnees ->> 'numero');
    end if;
  else
    -- Déjà enregistrée (verrouillée le temps de l'ajout) : « on conflict do nothing » reste silencieux,
    -- « do update » est vérifié par la branche de modification.
    perform 1 from erp.enregistrements e where e.collection = 'factures' and e.id = new.id for key share;
    if found then
      return new;
    end if;
  end if;
  if erp.numero_normalise(new.donnees ->> 'numero') is distinct from avant then
    raise exception 'Facture : son numéro est attribué par la base à la validation (erp.numeroter_facture), jamais écrit directement.'
      using errcode = 'LMF02';
  end if;
  return new;
end;
$$;
revoke all on function erp.reserver_numero_facture() from public, anon;
drop trigger if exists reserver_numero_facture on erp.enregistrements;
create trigger reserver_numero_facture before insert or update on erp.enregistrements
  for each row execute function erp.reserver_numero_facture();
do $$
declare
  v_doublons text;
begin
  if coalesce(pg_get_indexdef(to_regclass('erp.enregistrements_numero_facture')), '') like '%numero_normalise%' then
    return;
  end if;
  -- Doublons d'abord : s'il en reste, l'index d'une version précédente (btrim
  -- seul) reste en place.
  select string_agg(format('%s (%s fois)', d.numero, d.n), ', ' order by d.numero) into v_doublons
    from (select erp.numero_normalise(e.donnees ->> 'numero') as numero, count(*) as n from erp.enregistrements e
          where e.collection = 'factures' and erp.numero_normalise(e.donnees ->> 'numero') <> ''
          group by erp.numero_normalise(e.donnees ->> 'numero') having count(*) > 1) d;
  if v_doublons is not null then
    raise warning 'Factures : numéros en double (%) ; index d''unicité pas créé. Corrigez-les, puis relancez ce fichier.', v_doublons;
    return;
  end if;
  -- Créé sous un autre nom, puis il remplace l'ancien : la table n'est jamais
  -- sans index d'unicité.
  create unique index enregistrements_numero_facture_neuf on erp.enregistrements ((erp.numero_normalise(donnees ->> 'numero')))
    where collection = 'factures' and erp.numero_normalise(donnees ->> 'numero') <> '';
  drop index if exists erp.enregistrements_numero_facture;
  alter index erp.enregistrements_numero_facture_neuf rename to enregistrements_numero_facture;
end;
$$;

-- Leurs anciennes versions (copiées par erp.archiver_version) : gérants seulement.
drop policy if exists "versions reservees aux gerants" on erp.historique;
create policy "versions reservees aux gerants" on erp.historique
  as restrictive for select to authenticated
  using (collection not in ('accesProprietaires', 'accesOperations', 'relancesPaiement', 'reglagesRelances', 'connecteurs', 'checkinsEnLigne') or erp.acces_gerant());

-- ----------------------------------------------------------------- recette
-- Essai dans une transaction annulée à la fin : rien n'est gardé. Un compte
-- « opérations » lit l'ERP et son historique, mais ni les accès ni leurs
-- anciennes versions, et ne peut pas en écrire ; un gérant lit tout.
create or replace function erp.recette_acces_gerants() returns text
language plpgsql set search_path = ''
as $$
declare
  resultat text := 'ok';
  n int;
  k text;
begin
  begin
    insert into erp.membres (email, nom, role) values
      ('recette-ops@exemple.invalid', 'Recette opérations', 'operations'),
      ('recette-gerant@exemple.invalid', 'Recette gérant', 'gerant');
    insert into erp.enregistrements (collection, id, donnees) values
      ('recette', 'recette-acces', '{"id": "recette-acces"}'),
      ('accesProprietaires', 'recette-acces', '{"id": "recette-acces"}');
    -- Une ancienne version de chacun (erp.archiver_version).
    update erp.enregistrements set donnees = donnees || '{"v": 2}'
      where id = 'recette-acces' and collection in ('recette', 'accesProprietaires');
    -- Check-in en ligne : jamais archivé, ni modifié ni effacé.
    insert into erp.enregistrements (collection, id, donnees) values ('checkinsEnLigne', 'recette-checkin', '{"id": "recette-checkin"}');
    update erp.enregistrements set donnees = donnees || '{"v": 2}' where collection = 'checkinsEnLigne' and id = 'recette-checkin';
    select count(*) into n from erp.historique where collection = 'checkinsEnLigne';
    if n <> 0 then resultat := 'un check-in en ligne est archivé (la purge à 6 mois ne l''effacerait pas)'; raise exception 'stop'; end if;
    -- Écritures réservées aux gérants : vrais ids des réglages (une ligne déjà là
    -- est gardée telle quelle), facture d'essai numérotée en 2099.
    insert into erp.enregistrements (collection, id, donnees) values
      ('reglages', 'messages-programmes', '{"id": "messages-programmes"}'),
      ('reglages', 'supplements', '{"id": "supplements"}'),
      ('reglages', 'agent', '{"id": "agent"}'),
      ('envoisProgrammes', 'recette-acces', '{"id": "recette-acces"}'),
      ('factures', 'recette-acces', '{"id": "recette-acces", "numero": "2099-0001", "statut": "emise", "montantHtCentimes": 100}')
    on conflict do nothing;

    perform set_config('role', 'authenticated', true);

    -- 1. Compte « opérations » : l'ERP oui, les accès non.
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-ops@exemple.invalid"}', true);
    select count(*) into n from erp.enregistrements where collection = 'recette' and id = 'recette-acces';
    if n <> 1 then resultat := 'un compte « opérations » ne lit plus l''ERP'; raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 0 then resultat := 'un compte « opérations » lit les accès des propriétaires'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'recette' and id = 'recette-acces';
    if n <> 1 then resultat := 'un compte « opérations » ne lit plus l''historique de l''ERP'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 0 then resultat := 'un compte « opérations » lit les anciennes versions des accès'; raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where collection = 'checkinsEnLigne';
    if n <> 0 then resultat := 'un compte « opérations » lit les check-ins en ligne'; raise exception 'stop'; end if;
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('checkinsEnLigne', 'recette-intrus', '{}');
      resultat := 'un compte « opérations » écrit un check-in en ligne';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
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
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('envoisProgrammes', 'recette-intrus', '{"statut": "en_cours"}');
      resultat := 'un compte « opérations » glisse un message automatique à envoyer';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    update erp.enregistrements set donnees = donnees || '{"recette": 1}'
      where (collection = 'reglages' and id in ('messages-programmes', 'supplements')) or (collection = 'envoisProgrammes' and id = 'recette-acces');
    get diagnostics n = row_count;
    if n <> 0 then resultat := 'un compte « opérations » modifie un modèle de message automatique ou les suppléments'; raise exception 'stop'; end if;
    begin
      update erp.enregistrements set donnees = donnees || '{"autonomie": "recette"}' where collection = 'reglages' and id = 'agent';
      resultat := 'un compte « opérations » change le niveau d''autonomie de l''agent';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    -- Les autres réglages de l'agent réservés au gérant : marche, horaires, ce qu'il confie, délai.
    foreach k in array array['actif', 'horaires', 'transmettre', 'delaiAlerteMinutes'] loop
      begin
        update erp.enregistrements set donnees = donnees || jsonb_build_object(k, 'recette') where collection = 'reglages' and id = 'agent';
        resultat := format('un compte « opérations » change le réglage « %s » de l''agent', k);
        raise exception 'stop';
      exception when insufficient_privilege then null;
      end;
    end loop;
    update erp.enregistrements set donnees = donnees || '{"recette": 1, "ton": "recette", "signature": "Recette"}' where collection = 'reglages' and id = 'agent';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un compte « opérations » ne modifie plus le ton ou la signature de l''agent'; raise exception 'stop'; end if;
    -- Pas encore de réglages de l'agent : l'équipe les crée avec le ton et la signature, jamais avec la marche.
    perform set_config('role', 'none', true);
    delete from erp.enregistrements where collection = 'reglages' and id = 'agent';
    perform set_config('role', 'authenticated', true);
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('reglages', 'agent', '{"id": "agent", "actif": true}');
      resultat := 'un compte « opérations » crée les réglages de l''agent en le mettant en marche';
      raise exception 'stop';
    exception when insufficient_privilege then null;
    end;
    insert into erp.enregistrements (collection, id, donnees) values ('reglages', 'agent', '{"id": "agent", "ton": "recette", "signature": "Recette"}');
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un compte « opérations » ne crée plus les réglages de l''agent (ton, signature)'; raise exception 'stop'; end if;
    insert into erp.enregistrements (collection, id, donnees) values ('avisADeposer', 'recette-acces', '{"statut": "fait"}');

    -- 2. Gérant : les accès, oui.
    perform set_config('request.jwt.claims', '{"role": "authenticated", "email": "recette-gerant@exemple.invalid"}', true);
    select count(*) into n from erp.enregistrements where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 1 then resultat := 'un gérant ne lit pas les accès des propriétaires'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'accesProprietaires' and id = 'recette-acces';
    if n <> 1 then resultat := 'un gérant ne lit pas les anciennes versions des accès'; raise exception 'stop'; end if;
    select count(*) into n from erp.enregistrements where collection = 'checkinsEnLigne' and id = 'recette-checkin';
    if n <> 1 then resultat := 'un gérant (le serveur) ne lit pas les check-ins en ligne'; raise exception 'stop'; end if;
    delete from erp.enregistrements where collection = 'checkinsEnLigne' and id = 'recette-checkin';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un gérant (le serveur) n''efface pas un check-in en ligne'; raise exception 'stop'; end if;
    select count(*) into n from erp.historique where collection = 'checkinsEnLigne';
    if n <> 0 or not erp.checkin_en_ligne_pret() then resultat := 'un check-in en ligne effacé reste dans l''historique'; raise exception 'stop'; end if;
    update erp.enregistrements set donnees = donnees || '{"recette": 2, "autonomie": "recette"}'
      where (collection = 'reglages' and id in ('messages-programmes', 'agent', 'supplements')) or (collection = 'envoisProgrammes' and id = 'recette-acces');
    get diagnostics n = row_count;
    if n <> 4 then resultat := format('un gérant modifie %s des 4 lignes réservées aux gérants', n); raise exception 'stop'; end if;
    update erp.enregistrements
      set donnees = donnees || '{"actif": false, "horaires": {"mode": "toujours"}, "transmettre": {"horsFiche": true}, "delaiAlerteMinutes": 7}'
      where collection = 'reglages' and id = 'agent';
    get diagnostics n = row_count;
    if n <> 1 then resultat := 'un gérant ne change plus la marche, les horaires ou le délai de l''agent'; raise exception 'stop'; end if;
    begin
      update erp.enregistrements set donnees = donnees || '{"montantHtCentimes": 1}' where collection = 'factures' and id = 'recette-acces';
      resultat := 'une facture numérotée change de montant';
      raise exception 'stop';
    exception when sqlstate 'LMF01' then null;
    end;
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('factures', 'recette-numero', '{"id": "recette-numero", "numero": "2099-0002"}');
      resultat := 'un gérant écrit lui-même le numéro d''une facture';
      raise exception 'stop';
    exception when sqlstate 'LMF02' then null;
    end;
    -- Envoi du navigateur (ajout qui devient modification) : même numéro, paiement seulement.
    begin
      insert into erp.enregistrements (collection, id, donnees)
        select collection, id, donnees || '{"statut": "payee", "payeeLe": "2099-02-01"}' from erp.enregistrements
        where collection = 'factures' and id = 'recette-acces'
      on conflict (collection, id) do update set donnees = excluded.donnees;
      get diagnostics n = row_count;
    exception when sqlstate 'LMF01' or sqlstate 'LMF02' then n := -1;
    end;
    if n <> 1 then resultat := 'le paiement d''une facture numérotée (même numéro) ne s''écrit plus'; raise exception 'stop'; end if;
    -- Ajout si absente (« on conflict do nothing ») sur une facture déjà numérotée : silencieux.
    begin
      insert into erp.enregistrements (collection, id, donnees) values ('factures', 'recette-acces', '{"id": "recette-acces", "numero": ""}')
      on conflict do nothing;
      get diagnostics n = row_count;
    exception when sqlstate 'LMF01' or sqlstate 'LMF02' then n := -1;
    end;
    if n <> 0 then resultat := 'l''ajout d''une facture déjà là n''est plus silencieux'; raise exception 'stop'; end if;
    -- Deux factures ne partagent pas un numéro (index unique), même écrit par le propriétaire de la base.
    perform set_config('role', 'none', true);
    if to_regclass('erp.enregistrements_numero_facture') is not null then
      begin
        insert into erp.enregistrements (collection, id, donnees) values ('factures', 'recette-doublon', '{"id": "recette-doublon", "numero": " 2099-0001"}');
        resultat := 'deux factures partagent un numéro';
        raise exception 'stop';
      exception when unique_violation then null;
      end;
    end if;

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
-- attendu regles = 5, recette = ok.
select
  (select count(*) from pg_policies
    where schemaname = 'erp' and permissive = 'RESTRICTIVE'
      and ((tablename = 'enregistrements' and policyname in ('acces exterieurs reserves aux gerants',
             'ecritures reservees aux gerants (ajout)', 'ecritures reservees aux gerants (modification)',
             'ecritures reservees aux gerants (suppression)'))
        or (tablename = 'historique' and policyname = 'versions reservees aux gerants'))) as regles,
  erp.recette_acces_gerants() as recette;
