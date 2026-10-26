-- =============================================================================
-- ERP Label Maison : connexion de Claude au CRM réservée aux gérants.
--
-- À coller dans Supabase → SQL Editor → New query → Run (projet Label Maison).
-- Idempotent : peut être relancé. Même règle que dans erp-installation.sql.
--
-- Effet : les enregistrements de la collection technique « connecteurs »
-- (empreintes des jetons de Claude, date de révocation) ne sont plus lisibles
-- ni modifiables que par un gérant. Sans cette règle, un compte « opérations »
-- pourrait écrire un faux jeton. Rien d'autre ne change.
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

drop policy if exists "connecteurs reserves aux gerants" on erp.enregistrements;
create policy "connecteurs reserves aux gerants" on erp.enregistrements
  as restrictive for all to authenticated
  using (collection <> 'connecteurs' or erp.acces_gerant())
  with check (collection <> 'connecteurs' or erp.acces_gerant());

-- Vérification : doit renvoyer une ligne.
select policyname, permissive from pg_policies
where schemaname = 'erp' and tablename = 'enregistrements' and policyname = 'connecteurs reserves aux gerants';
