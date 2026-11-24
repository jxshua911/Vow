BEGIN;

-- Google Play is the only regional subscription-pricing provider in the current launch scope.
-- Google Play itself determines the buyer's local price; this table maps its verified
-- billing country to VOW's approved commercial tier for audit and analytics.
ALTER TABLE public.vow_subscription_records
  ADD COLUMN IF NOT EXISTS store_region_code text,
  ADD COLUMN IF NOT EXISTS market_tier text;

DO $constraints$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vow_subscription_records_store_region_code_check'
       AND conrelid = 'public.vow_subscription_records'::regclass
  ) THEN
    ALTER TABLE public.vow_subscription_records
      ADD CONSTRAINT vow_subscription_records_store_region_code_check
      CHECK (store_region_code IS NULL OR store_region_code ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'vow_subscription_records_market_tier_check'
       AND conrelid = 'public.vow_subscription_records'::regclass
  ) THEN
    ALTER TABLE public.vow_subscription_records
      ADD CONSTRAINT vow_subscription_records_market_tier_check
      CHECK (market_tier IS NULL OR market_tier IN ('standard','moderate','accessible','entry'));
  END IF;
END;
$constraints$;

CREATE INDEX IF NOT EXISTS vow_subscription_records_store_region_idx
  ON public.vow_subscription_records (store_region_code, market_tier)
  WHERE provider = 'google_play';

CREATE TABLE IF NOT EXISTS public.vow_google_play_market_catalog (
  country_code text PRIMARY KEY CHECK (country_code ~ '^[A-Z]{2}$'),
  market_tier text NOT NULL CHECK (market_tier IN ('standard','moderate','accessible','entry')),
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vow_google_play_market_catalog ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.vow_google_play_market_catalog FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vow_google_play_market_catalog TO service_role;

INSERT INTO public.vow_google_play_market_catalog (country_code, market_tier, is_enabled) VALUES
  -- Standard: 14 European markets plus US, Australia and Canada.
  ('AT','standard',true),('BE','standard',true),('DK','standard',true),('FI','standard',true),
  ('FR','standard',true),('DE','standard',true),('IS','standard',true),('IE','standard',true),
  ('LU','standard',true),('NL','standard',true),('NO','standard',true),('SE','standard',true),
  ('CH','standard',true),('GB','standard',true),('US','standard',true),('AU','standard',true),('CA','standard',true),
  -- Moderate: 12 European markets plus Singapore.
  ('CY','moderate',true),('CZ','moderate',true),('EE','moderate',true),('GR','moderate',true),
  ('IT','moderate',true),('LV','moderate',true),('LT','moderate',true),('MT','moderate',true),
  ('PT','moderate',true),('SK','moderate',true),('SI','moderate',true),('ES','moderate',true),('SG','moderate',true),
  -- Accessible: five European markets plus Malaysia, Tanzania, Indonesia, Kenya, Philippines and South Africa.
  ('BG','accessible',true),('HR','accessible',true),('HU','accessible',true),('PL','accessible',true),('RO','accessible',true),
  ('MY','accessible',true),('TZ','accessible',true),('ID','accessible',true),('KE','accessible',true),('PH','accessible',true),('ZA','accessible',true),
  -- Entry: six European candidate markets plus India and Nigeria.
  ('AL','entry',true),('BA','entry',true),('ME','entry',true),('MK','entry',true),('RS','entry',true),('TR','entry',true),
  ('IN','entry',true),('NG','entry',true)
ON CONFLICT (country_code) DO UPDATE
  SET market_tier = EXCLUDED.market_tier,
      is_enabled = EXCLUDED.is_enabled,
      updated_at = now();

COMMIT;
