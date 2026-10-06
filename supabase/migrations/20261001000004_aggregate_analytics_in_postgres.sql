CREATE OR REPLACE FUNCTION public.analytics_jsonb_object(p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  IF p_value IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;
  IF jsonb_typeof(p_value) = 'object' THEN
    RETURN p_value;
  END IF;
  IF jsonb_typeof(p_value) = 'string' THEN
    BEGIN
      RETURN (p_value #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RETURN '{}'::jsonb;
    END;
  END IF;
  RETURN '{}'::jsonb;
END;
$function$;

CREATE OR REPLACE FUNCTION public.analytics_safe_number(p_value text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_value text := btrim(p_value);
BEGIN
  IF v_value IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_value = '' OR lower(v_value) = 'false' THEN
    RETURN 0;
  END IF;
  IF lower(v_value) = 'true' THEN
    RETURN 1;
  END IF;
  IF lower(v_value) IN ('infinity', '+infinity', '-infinity', 'nan') THEN
    RETURN NULL;
  END IF;
  RETURN v_value::numeric;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_sales_analytics(
  p_tenant_id uuid,
  p_start_date timestamptz,
  p_end_date timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  WITH filtered_sales AS (
    SELECT product_name, quantity, total
    FROM public.sales
    WHERE tenant_id = p_tenant_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
  ), totals AS (
    SELECT
      COALESCE(SUM(total), 0) AS total_sales,
      COALESCE(SUM(quantity), 0) AS total_quantity,
      COUNT(*) AS transaction_count
    FROM filtered_sales
  ), top_products AS (
    SELECT product_name AS name, SUM(quantity) AS quantity, SUM(total) AS total
    FROM filtered_sales
    GROUP BY product_name
    ORDER BY SUM(quantity) DESC, product_name ASC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totalSales', totals.total_sales,
    'totalQuantity', totals.total_quantity,
    'transactionCount', totals.transaction_count,
    'averageOrderValue', CASE WHEN totals.transaction_count > 0
      THEN totals.total_sales / totals.transaction_count ELSE 0 END,
    'topProducts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', name, 'quantity', quantity, 'total', total)
        ORDER BY quantity DESC, name ASC)
      FROM top_products
    ), '[]'::jsonb)
  )
  FROM totals;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_analytics(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  WITH tenant_products AS (
    SELECT id, name, price, COALESCE(stock, 0) AS stock
    FROM public.products
    WHERE tenant_id = p_tenant_id
  ), totals AS (
    SELECT
      COUNT(*) AS total_products,
      COALESCE(SUM(price * stock), 0) AS total_value,
      COALESCE(AVG(price), 0) AS average_price,
      COUNT(*) FILTER (WHERE stock > 0 AND stock < 10) AS low_stock_count,
      COUNT(*) FILTER (WHERE stock = 0) AS out_of_stock_count
    FROM tenant_products
  ), most_stocked AS (
    SELECT name, stock FROM tenant_products ORDER BY stock DESC, id ASC LIMIT 1
  ), least_stocked AS (
    SELECT name, stock FROM tenant_products ORDER BY stock ASC, id ASC LIMIT 1
  )
  SELECT jsonb_build_object(
    'totalProducts', totals.total_products,
    'totalValue', totals.total_value,
    'averagePrice', totals.average_price,
    'lowStockCount', totals.low_stock_count,
    'outOfStockCount', totals.out_of_stock_count,
    'mostStockedProduct', (SELECT jsonb_build_object('name', name, 'stock', stock) FROM most_stocked),
    'leastStockedProduct', (SELECT jsonb_build_object('name', name, 'stock', stock) FROM least_stocked)
  )
  FROM totals;
$function$;

CREATE OR REPLACE FUNCTION public.get_product_metrics(
  p_tenant_id uuid,
  p_start_date timestamptz
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  WITH tenant_products AS (
    SELECT id, name, stock, stock_remainder, base_unit, converted_unit, conversion_rate
    FROM public.products
    WHERE tenant_id = p_tenant_id
  ), normalized_logs AS (
    SELECT
      log.id,
      log.created_at,
      log.action,
      public.analytics_jsonb_object(log.details) AS details,
      COALESCE(
        NULLIF(btrim(log.entity_id::text), ''),
        NULLIF(btrim(public.analytics_jsonb_object(log.details)->>'product_id'), ''),
        NULLIF(btrim(public.analytics_jsonb_object(log.details)->>'productId'), ''),
        NULLIF(btrim(public.analytics_jsonb_object(log.details)->>'entity_id'), ''),
        NULLIF(btrim(public.analytics_jsonb_object(log.details)->>'entityId'), '')
      ) AS product_key
    FROM public.activity_logs AS log
    WHERE log.tenant_id = p_tenant_id
      AND log.created_at >= p_start_date
  ), log_values AS (
    SELECT
      normalized_logs.*,
      upper(COALESCE(action, '')) AS normalized_action,
      public.analytics_safe_number(COALESCE(
        details->>'initialStock', details->>'initial_stock', details->>'stock', '0'
      )) AS initial_stock,
      public.analytics_safe_number(COALESCE(details->>'previousStock', details->>'previous_stock', '0')) AS previous_stock,
      public.analytics_safe_number(COALESCE(details->>'newStock', details->>'new_stock', '0')) AS new_stock
    FROM normalized_logs
  ), activity_metrics AS (
    SELECT
      product_key,
      SUM(CASE
        WHEN normalized_action NOT LIKE '%TAKE%'
          AND normalized_action NOT LIKE '%LOAD%'
          AND normalized_action NOT IN ('SELL', 'SALE')
        THEN COALESCE(positive_values.amount, positive_delta.amount, 0)
        ELSE 0
      END) AS stock_loaded,
      (array_agg(initial_stock ORDER BY created_at ASC, id ASC)
        FILTER (WHERE normalized_action IN ('CREATE', 'BULK_CREATE') AND initial_stock IS NOT NULL))[1] AS started
    FROM log_values
    LEFT JOIN LATERAL (
      SELECT candidate.amount
      FROM (VALUES
        (1, public.analytics_safe_number(details->>'amount')),
        (2, public.analytics_safe_number(details->>'quantity')),
        (3, public.analytics_safe_number(details->>'stock_added')),
        (4, public.analytics_safe_number(details->>'stockAdded')),
        (5, public.analytics_safe_number(details->>'delta')),
        (6, public.analytics_safe_number(details->>'adjustment')),
        (7, public.analytics_safe_number(details->>'added')),
        (8, public.analytics_safe_number(details->>'load_amount')),
        (9, public.analytics_safe_number(details->>'loadAmount')),
        (10, public.analytics_safe_number(details->>'units')),
        (11, public.analytics_safe_number(details->>'stockIncrease')),
        (12, public.analytics_safe_number(details->>'stock_increase'))
      ) AS candidate(priority, amount)
      WHERE candidate.amount > 0
      ORDER BY candidate.priority
      LIMIT 1
    ) AS positive_values ON true
    LEFT JOIN LATERAL (
      SELECT log_values.new_stock - log_values.previous_stock AS amount
      WHERE log_values.new_stock > log_values.previous_stock
    ) AS positive_delta ON true
    GROUP BY product_key
  ), sales_source AS (
    SELECT
      sale.product_id,
      sale.quantity,
      lower(COALESCE(NULLIF(btrim(to_jsonb(sale)->>'type'), ''), 'sale')) AS sale_type,
      CASE WHEN lower(COALESCE(NULLIF(btrim(to_jsonb(sale)->>'unit'), ''), 'base')) = 'converted'
        THEN 'converted' ELSE 'base' END AS unit_mode,
      CASE
        WHEN lower(COALESCE(NULLIF(btrim(to_jsonb(sale)->>'unit'), ''), 'base')) = 'converted'
          AND NULLIF(btrim(product.base_unit), '') IS NOT NULL
          AND NULLIF(btrim(product.converted_unit), '') IS NOT NULL
          AND product.conversion_rate IS NOT NULL
          AND product.conversion_rate <> 0
        THEN sale.quantity / product.conversion_rate
        ELSE sale.quantity
      END AS normalized_quantity
    FROM public.sales AS sale
    JOIN tenant_products AS product ON product.id = sale.product_id
    WHERE sale.tenant_id = p_tenant_id
      AND sale.created_at >= p_start_date
  ), sales_metrics AS (
    SELECT
      product_id,
      COALESCE(SUM(normalized_quantity) FILTER (WHERE sale_type = 'return'), 0) AS returned,
      COALESCE(SUM(normalized_quantity) FILTER (WHERE sale_type <> 'return'), 0) AS sold,
      COUNT(DISTINCT unit_mode) FILTER (WHERE sale_type <> 'return') AS unit_mode_count,
      MIN(unit_mode) FILTER (WHERE sale_type <> 'return') AS single_unit_mode
    FROM sales_source
    GROUP BY product_id
  ), result_rows AS (
    SELECT
      product.id,
      product.name AS product_name,
      COALESCE(activity.stock_loaded, 0) AS stock_loaded,
      activity.started,
      COALESCE(sales.sold, 0) AS sold,
      COALESCE(sales.returned, 0) AS returned,
      CASE WHEN product.conversion_rate > 0
        THEN COALESCE(product.stock, 0) + COALESCE(product.stock_remainder, 0) / product.conversion_rate
        ELSE COALESCE(product.stock, 0) END AS remaining,
      product.base_unit,
      product.converted_unit,
      CASE WHEN product.conversion_rate > 0 THEN product.conversion_rate ELSE NULL END AS conversion_rate,
      CASE WHEN COALESCE(sales.unit_mode_count, 0) = 0 THEN 'base'
        WHEN sales.unit_mode_count = 1 THEN sales.single_unit_mode
        ELSE 'mixed' END AS sold_unit_mode
    FROM tenant_products AS product
    LEFT JOIN activity_metrics AS activity ON activity.product_key = product.id::text
    LEFT JOIN sales_metrics AS sales ON sales.product_id = product.id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', id,
    'product_name', COALESCE(product_name, 'Unknown'),
    'stock_loaded', stock_loaded,
    'started', started,
    'sold', sold,
    'returned', returned,
    'remaining', remaining,
    'base_unit', base_unit,
    'converted_unit', converted_unit,
    'conversion_rate', conversion_rate,
    'sold_unit_mode', sold_unit_mode
  ) ORDER BY sold DESC, stock_loaded DESC, product_name ASC), '[]'::jsonb)
  FROM result_rows;
$function$;

REVOKE ALL PRIVILEGES ON FUNCTION public.analytics_jsonb_object(jsonb)
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.analytics_safe_number(text)
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_sales_analytics(uuid, timestamptz, timestamptz)
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_product_analytics(uuid)
FROM PUBLIC, anon, authenticated;
REVOKE ALL PRIVILEGES ON FUNCTION public.get_product_metrics(uuid, timestamptz)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_sales_analytics(uuid, timestamptz, timestamptz),
  public.get_product_analytics(uuid),
  public.get_product_metrics(uuid, timestamptz)
TO service_role;