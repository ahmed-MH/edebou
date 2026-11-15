-- Snapshot trusted product names and SKU inside each checkout intent so the
-- back-office always shows the exact product, even if the catalogue changes.
CREATE OR REPLACE FUNCTION public.edebou_upsert_checkout_intent(
  p_token_hash TEXT,
  p_customer_name TEXT,
  p_phone TEXT,
  p_governorate TEXT,
  p_address TEXT,
  p_locale TEXT,
  p_source TEXT,
  p_items JSONB,
  p_expires_at TIMESTAMPTZ
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_items JSONB;
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$'
    OR p_phone !~ '^\+216[234579][0-9]{7}$'
    OR p_locale NOT IN ('ar', 'fr')
    OR p_source NOT IN ('PRODUCT', 'CHECKOUT')
    OR jsonb_typeof(p_items) <> 'array'
    OR jsonb_array_length(p_items) < 1
    OR jsonb_array_length(p_items) > 20
    OR p_expires_at <= clock_timestamp()
    OR p_expires_at > clock_timestamp() + interval '31 days'
  THEN
    RAISE EXCEPTION 'invalid checkout intent payload'
      USING ERRCODE = '22023';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'productSlug', item->>'productSlug',
      'quantity', (item->>'quantity')::integer,
      'productNameFr', product.name_fr,
      'productNameAr', product.name_ar,
      'sku', product.sku
    )
    ORDER BY ordinal
  )
  INTO v_items
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS input(item, ordinal)
  JOIN public.products AS product
    ON product.slug = item->>'productSlug'
  WHERE jsonb_typeof(item) = 'object'
    AND jsonb_typeof(item->'quantity') = 'number'
    AND item->>'productSlug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    AND item->>'quantity' ~ '^[0-9]+$'
    AND (item->>'quantity')::integer BETWEEN 1 AND 100;

  IF v_items IS NULL
    OR jsonb_array_length(v_items) <> jsonb_array_length(p_items)
  THEN
    RAISE EXCEPTION 'invalid checkout intent products'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.checkout_intents (
    token_hash,
    customer_name,
    phone,
    governorate,
    address,
    locale,
    source,
    items,
    expires_at
  ) VALUES (
    p_token_hash,
    p_customer_name,
    p_phone,
    p_governorate,
    p_address,
    p_locale,
    p_source,
    v_items,
    p_expires_at
  )
  ON CONFLICT (token_hash) DO UPDATE
  SET
    customer_name = EXCLUDED.customer_name,
    phone = EXCLUDED.phone,
    governorate = EXCLUDED.governorate,
    address = EXCLUDED.address,
    locale = EXCLUDED.locale,
    source = EXCLUDED.source,
    items = EXCLUDED.items,
    last_seen_at = clock_timestamp(),
    expires_at = EXCLUDED.expires_at,
    updated_at = clock_timestamp()
  WHERE public.checkout_intents.status IN ('ACTIVE', 'CONTACTED');
END;
$$;

REVOKE ALL ON FUNCTION public.edebou_upsert_checkout_intent(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.edebou_upsert_checkout_intent(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) TO edebou_checkout_writer;
