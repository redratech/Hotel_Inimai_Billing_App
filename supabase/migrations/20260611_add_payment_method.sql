-- Add payment_method column to bills table
ALTER TABLE public.bills ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'cash';

-- Create index for payment_method queries
CREATE INDEX idx_bills_payment_method ON public.bills(payment_method);

-- Add payment method columns to advance_orders table
ALTER TABLE public.advance_orders ADD COLUMN advance_payment_method TEXT;
ALTER TABLE public.advance_orders ADD COLUMN balance_payment_method TEXT;

-- Create indexes for advance orders payment method queries
CREATE INDEX idx_advance_orders_advance_payment_method ON public.advance_orders(advance_payment_method);
CREATE INDEX idx_advance_orders_balance_payment_method ON public.advance_orders(balance_payment_method);
