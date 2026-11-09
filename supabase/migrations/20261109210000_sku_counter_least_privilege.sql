BEGIN;

-- SKU counters are written only through the staff-gated reservation flow.
-- RLS remains the row-level authorization layer; table ACLs are narrowed so
-- the public role cannot issue direct counter operations and staff can only
-- perform the operations required by nb_next_sku() (SELECT/INSERT/UPDATE).
REVOKE ALL PRIVILEGES ON TABLE public.nb_sku_counters FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.nb_sku_counters FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.nb_sku_counters TO authenticated;

DO $sku_acl_assert$
BEGIN
  IF has_table_privilege('anon','public.nb_sku_counters','SELECT')
    OR has_table_privilege('anon','public.nb_sku_counters','INSERT')
    OR has_table_privilege('anon','public.nb_sku_counters','UPDATE')
    OR has_table_privilege('anon','public.nb_sku_counters','DELETE')
    OR has_table_privilege('anon','public.nb_sku_counters','TRUNCATE')
    OR has_table_privilege('anon','public.nb_sku_counters','REFERENCES')
    OR has_table_privilege('anon','public.nb_sku_counters','TRIGGER')
  THEN
    RAISE EXCEPTION 'Anonymous SKU counter privileges must be revoked';
  END IF;

  IF NOT (
    has_table_privilege('authenticated','public.nb_sku_counters','SELECT')
    AND has_table_privilege('authenticated','public.nb_sku_counters','INSERT')
    AND has_table_privilege('authenticated','public.nb_sku_counters','UPDATE')
  ) OR has_table_privilege('authenticated','public.nb_sku_counters','DELETE')
    OR has_table_privilege('authenticated','public.nb_sku_counters','TRUNCATE')
    OR has_table_privilege('authenticated','public.nb_sku_counters','REFERENCES')
    OR has_table_privilege('authenticated','public.nb_sku_counters','TRIGGER')
  THEN
    RAISE EXCEPTION 'Authenticated SKU counter privileges are not least-privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='nb_sku_counters'
      AND policyname='nb_sku_counter_staff'
      AND cmd='ALL'
      AND roles @> ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Staff-only SKU counter RLS policy is missing';
  END IF;
END
$sku_acl_assert$;

COMMIT;
