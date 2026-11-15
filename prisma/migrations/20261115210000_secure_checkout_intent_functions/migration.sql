-- Keep customer drafts unreadable to the public checkout role. PostgreSQL
-- requires SELECT rights for columns referenced by an UPSERT/UPDATE predicate,
-- so narrow SECURITY DEFINER functions perform those two writes instead.
CREATE FUNCTION public.edebou_upsert_checkout_intent(
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
    p_items,
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

CREATE FUNCTION public.edebou_convert_checkout_intent(
  p_token_hash TEXT,
  p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_token_hash !~ '^[0-9a-f]{64}$' OR p_order_id IS NULL THEN
    RAISE EXCEPTION 'invalid checkout intent conversion'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.checkout_intents
  SET
    status = 'CONVERTED',
    order_id = p_order_id,
    converted_at = clock_timestamp(),
    last_seen_at = clock_timestamp(),
    updated_at = clock_timestamp()
  WHERE token_hash = p_token_hash
    AND status IN ('ACTIVE', 'CONTACTED');
END;
$$;

REVOKE ALL ON FUNCTION public.edebou_upsert_checkout_intent(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.edebou_convert_checkout_intent(TEXT, UUID)
  FROM PUBLIC;

REVOKE ALL ON TABLE public.checkout_intents FROM edebou_checkout_writer;
GRANT EXECUTE ON FUNCTION public.edebou_upsert_checkout_intent(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ
) TO edebou_checkout_writer;
GRANT EXECUTE ON FUNCTION public.edebou_convert_checkout_intent(TEXT, UUID)
  TO edebou_checkout_writer;
