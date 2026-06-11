
CREATE TABLE public.items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.bill_number_seq START 1;

CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_number TEXT NOT NULL UNIQUE DEFAULT ('BILL-' || lpad(nextval('public.bill_number_seq')::text, 4, '0')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_items TO anon, authenticated;
GRANT ALL ON public.items, public.bills, public.bill_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.bill_number_seq TO anon, authenticated, service_role;

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access items" ON public.items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access bills" ON public.bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access bill_items" ON public.bill_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_bills_created_at ON public.bills(created_at DESC);
CREATE INDEX idx_bill_items_bill_id ON public.bill_items(bill_id);
CREATE INDEX idx_items_category ON public.items(category);

INSERT INTO public.items (name, category, price, image_url) VALUES
('Idli','Breakfast',10,'https://images.unsplash.com/photo-1589301760014-d929f3979dbc'),
('Dosa','Breakfast',40,'https://images.unsplash.com/photo-1668236543090-82eba5ee5976'),
('Pongal','Breakfast',50,'https://images.unsplash.com/photo-1601050690597-df0568f70950'),
('Meals','Lunch',120,'https://images.unsplash.com/photo-1546833999-b9f581a1996d'),
('Chicken Biryani','Lunch',180,'https://images.unsplash.com/photo-1563379091339-03246963d29a'),
('Parotta','Dinner',15,'https://images.unsplash.com/photo-1631452180519-c014fe946bc7'),
('Kothu Parotta','Dinner',90,'https://images.unsplash.com/photo-1606491956689-2ea866880c84'),
('Tea','Beverages',15,'https://images.unsplash.com/photo-1597481499750-3e6b22637e12'),
('Coffee','Beverages',20,'https://images.unsplash.com/photo-1509042239860-f550ce710b93'),
('Fresh Juice','Beverages',50,'https://images.unsplash.com/photo-1622597467836-f3e6707e1191'),
('Samosa','Snacks',15,'https://images.unsplash.com/photo-1601050690597-df0568f70950'),
('Bajji','Snacks',10,'https://images.unsplash.com/photo-1626777553635-3f54a4c66f60'),
('Vadai','Snacks',10,'https://images.unsplash.com/photo-1606491956689-2ea866880c84');
