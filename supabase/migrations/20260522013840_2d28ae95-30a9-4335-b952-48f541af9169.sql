DROP POLICY IF EXISTS "Admins can modify nina_settings" ON public.nina_settings;
DROP POLICY IF EXISTS "Admins can read nina_settings"   ON public.nina_settings;

CREATE POLICY "Authenticated users can access all nina_settings"
ON public.nina_settings
FOR ALL
TO authenticated
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');