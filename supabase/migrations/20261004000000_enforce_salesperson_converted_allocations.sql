DO $migration$
DECLARE
  v_function_definition text;
  v_old_branch text := $old$
    ELSIF p_role = 'sales' AND v_unit = 'base' THEN
      v_remaining := v_quantity;
$old$;
  v_new_branch text := $new$
    ELSIF p_role = 'sales' THEN
      IF v_unit = 'converted' THEN
        IF v_conversion_rate IS NULL OR v_conversion_rate <= 0 THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_INVALID: Product %s does not support converted-unit sales.', v_product.name);
        END IF;
        v_remaining := v_quantity / v_conversion_rate;
        IF v_remaining <> trunc(v_remaining) THEN
          RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = format('SALE_INVALID: Converted quantity for %s does not map to whole allocated base units.', v_product.name);
        END IF;
      ELSE
        v_remaining := v_quantity;
      END IF;
$new$;
BEGIN
  SELECT pg_catalog.pg_get_functiondef(
    'public.commit_sale_transaction_once(uuid, uuid, text, jsonb, text, text, text, text, boolean, text, text)'::regprocedure
  )
  INTO v_function_definition;

  IF position(v_old_branch IN v_function_definition) = 0 THEN
    RAISE EXCEPTION 'Expected salesperson base-unit allocation branch was not found in commit_sale_transaction_once';
  END IF;

  v_function_definition := replace(v_function_definition, v_old_branch, v_new_branch);
  EXECUTE v_function_definition;
END;
$migration$;
