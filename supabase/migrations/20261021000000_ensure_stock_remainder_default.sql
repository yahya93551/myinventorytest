UPDATE public.products
SET stock_remainder = 0
WHERE stock_remainder IS NULL;

ALTER TABLE public.products
  ALTER COLUMN stock_remainder SET DEFAULT 0,
  ALTER COLUMN stock_remainder SET NOT NULL;
