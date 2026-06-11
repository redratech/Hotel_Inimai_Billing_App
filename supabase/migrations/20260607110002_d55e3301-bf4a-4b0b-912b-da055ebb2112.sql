-- Drop overly permissive public policies
DROP POLICY IF EXISTS "Public full access items" ON public.items;
DROP POLICY IF EXISTS "Public full access bills" ON public.bills;
DROP POLICY IF EXISTS "Public full access bill_items" ON public.bill_items;

-- Revoke anon access, keep authenticated + service_role
REVOKE ALL ON public.items FROM anon;
REVOKE ALL ON public.bills FROM anon;
REVOKE ALL ON public.bill_items FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_items TO authenticated;
GRANT ALL ON public.items TO service_role;
GRANT ALL ON public.bills TO service_role;
GRANT ALL ON public.bill_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bill_number_seq TO authenticated;

-- Authenticated-only policies
CREATE POLICY "Authenticated can manage items" ON public.items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage bills" ON public.bills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can manage bill_items" ON public.bill_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);