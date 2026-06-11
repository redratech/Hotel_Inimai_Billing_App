DROP POLICY IF EXISTS "Authenticated can manage items" ON public.items;
DROP POLICY IF EXISTS "Authenticated can manage bills" ON public.bills;
DROP POLICY IF EXISTS "Authenticated can manage bill_items" ON public.bill_items;

CREATE POLICY "Admins can read items" ON public.items
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert items" ON public.items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update items" ON public.items
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete items" ON public.items
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can read bills" ON public.bills
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert bills" ON public.bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update bills" ON public.bills
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete bills" ON public.bills
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can read bill_items" ON public.bill_items
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can insert bill_items" ON public.bill_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can update bill_items" ON public.bill_items
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete bill_items" ON public.bill_items
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);