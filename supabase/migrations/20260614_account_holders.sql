CREATE TABLE public.account_holders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.account_bill_number_seq START 1;

CREATE TABLE public.account_holder_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_holder_id UUID NOT NULL REFERENCES public.account_holders(id) ON DELETE CASCADE,
  bill_number TEXT NOT NULL UNIQUE DEFAULT ('ACC-BILL-' || lpad(nextval('public.account_bill_number_seq')::text, 4, '0')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid',
  payment_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.account_holder_bill_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_holder_bill_id UUID NOT NULL REFERENCES public.account_holder_bills(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_holders TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_holder_bills TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_holder_bill_items TO anon, authenticated;
GRANT ALL ON public.account_holders, public.account_holder_bills, public.account_holder_bill_items TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.account_bill_number_seq TO anon, authenticated, service_role;

ALTER TABLE public.account_holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_holder_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_holder_bill_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public full access account_holders" ON public.account_holders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access account_holder_bills" ON public.account_holder_bills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public full access account_holder_bill_items" ON public.account_holder_bill_items FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_account_holder_bills_holder_id ON public.account_holder_bills(account_holder_id);
CREATE INDEX idx_account_holder_bills_status ON public.account_holder_bills(status);
CREATE INDEX idx_account_holder_bill_items_bill_id ON public.account_holder_bill_items(account_holder_bill_id);
