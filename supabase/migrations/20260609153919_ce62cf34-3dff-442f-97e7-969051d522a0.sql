CREATE TABLE public.advance_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  mobile text NOT NULL,
  event_type text,
  delivery_date date NOT NULL,
  delivery_time time NOT NULL,
  address text,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  sub_total numeric NOT NULL DEFAULT 0,
  advance_amount numeric NOT NULL DEFAULT 0,
  grand_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_orders TO authenticated;
GRANT ALL ON public.advance_orders TO service_role;

ALTER TABLE public.advance_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read advance_orders" ON public.advance_orders FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins insert advance_orders" ON public.advance_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update advance_orders" ON public.advance_orders FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete advance_orders" ON public.advance_orders FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.advance_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.advance_orders(id) ON DELETE CASCADE,
  category text NOT NULL,
  item_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Plate',
  price_per_unit numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.advance_order_items TO authenticated;
GRANT ALL ON public.advance_order_items TO service_role;

ALTER TABLE public.advance_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read advance_order_items" ON public.advance_order_items FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins insert advance_order_items" ON public.advance_order_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins update advance_order_items" ON public.advance_order_items FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete advance_order_items" ON public.advance_order_items FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_advance_orders_date ON public.advance_orders(delivery_date);
CREATE INDEX idx_advance_order_items_order ON public.advance_order_items(order_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER advance_orders_updated_at BEFORE UPDATE ON public.advance_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.advance_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.advance_order_items;
ALTER TABLE public.advance_orders REPLICA IDENTITY FULL;
ALTER TABLE public.advance_order_items REPLICA IDENTITY FULL;