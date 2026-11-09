BEGIN;

-- Preserve the existing OR semantics while avoiding multiple permissive
-- UPDATE/SELECT policies for the same authenticated role.
DROP POLICY IF EXISTS nb_media_editor_update_pending ON public.nb_media;
DROP POLICY IF EXISTS nb_media_publisher_update ON public.nb_media;
DROP POLICY IF EXISTS nb_media_staff_update ON public.nb_media;

CREATE POLICY nb_media_staff_update ON public.nb_media
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.nb_can_publish())
    OR (
      NOT approved
      AND uploaded_by=(SELECT auth.uid())
      AND (SELECT public.nb_can_edit())
    )
  )
  WITH CHECK (
    (SELECT public.nb_can_publish())
    OR (
      NOT approved
      AND uploaded_by=(SELECT auth.uid())
      AND split_part(storage_path,'/',1)=((SELECT auth.uid())::text)
      AND (SELECT public.nb_can_edit())
    )
  );

DROP POLICY IF EXISTS nb_reviews_public_read ON public.nb_reviews;
DROP POLICY IF EXISTS nb_reviews_staff_read ON public.nb_reviews;
DROP POLICY IF EXISTS nb_reviews_authenticated_read ON public.nb_reviews;

-- Keep the public policy free of staff-only function dependencies.
-- Authenticated users get one policy that grants the union of public-approved
-- rows and the additional staff-visible rows.
CREATE POLICY nb_reviews_public_read ON public.nb_reviews
  FOR SELECT TO anon
  USING (status='approved');

CREATE POLICY nb_reviews_authenticated_read ON public.nb_reviews
  FOR SELECT TO authenticated
  USING (
    status='approved'
    OR (SELECT public.nb_can_edit())
  );

DO $policy_assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_media'
      AND policyname IN ('nb_media_editor_update_pending','nb_media_publisher_update')
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_media'
      AND policyname='nb_media_staff_update' AND cmd='UPDATE'
  ) THEN
    RAISE EXCEPTION 'Media update policy consolidation failed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_staff_read'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_public_read' AND cmd='SELECT'
      AND roles=ARRAY['anon']::name[]
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='nb_reviews'
      AND policyname='nb_reviews_authenticated_read' AND cmd='SELECT'
      AND roles=ARRAY['authenticated']::name[]
  ) THEN
    RAISE EXCEPTION 'Reviews read policy consolidation failed';
  END IF;
END
$policy_assert$;

COMMIT;
