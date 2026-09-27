# Stripe Connect sample setup

This branch adds a small Stripe Connect sample to VOW. It is intentionally separate from VOW Premium's existing Stripe subscription flow.

## SDK

The Edge Functions use stripe@22.6.2, the latest stable stripe-node release verified on 27 September 2026. The SDK pins its own default API version, so this integration does not manually set apiVersion.

## Required server secrets

Set these in the Supabase project environment. Do not put any of them in Vite client variables or source control.

- STRIPE_SECRET_KEY
  - Placeholder: sk_test_REPLACE_WITH_YOUR_STRIPE_SECRET_KEY
  - Helpful error if missing: the Connect function returns a configuration error explaining that STRIPE_SECRET_KEY must be set.
- STRIPE_CONNECT_WEBHOOK_SECRET
  - Placeholder: whsec_REPLACE_WITH_YOUR_CONNECT_THIN_EVENT_WEBHOOK_SECRET
  - Used only by vow-stripe-connect-webhook.
- STRIPE_CONNECT_APP_URL
  - Placeholder: https://YOUR-VOW-APP.example
  - Used for Stripe Account Link return/refresh URLs and hosted Checkout success/cancel URLs.
- STRIPE_APPLICATION_FEE_PERCENT
  - Example: 10
  - Must be a number from 0 to below 100.
  - This sample uses the value to calculate application_fee_amount.

The functions also require the standard Supabase Edge Function secrets:
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

## Stripe Dashboard webhook

Create a V2 Event Destination for connected accounts using thin events:

- v2.account[requirements].updated
- v2.account[.recipient].capability_status_updated

Send the destination to:

https://YOUR_SUPABASE_PROJECT.supabase.co/functions/v1/vow-stripe-connect-webhook

Use the webhook signing secret as STRIPE_CONNECT_WEBHOOK_SECRET.

For local testing, use the Stripe CLI thin-event listener described in the Stripe webhook documentation.

## What the sample does

1. Creates a V2 connected account without a top-level type.
2. Stores the VOW-user-to-Stripe-account mapping in stripe_connected_accounts.
3. Retrieves onboarding status directly from Stripe's Accounts API.
4. Creates single-use V2 Account Links.
5. Creates platform-level Products with products.create.
6. Stores the product-to-connected-account mapping in stripe_connect_products.
7. Lists products and connected sellers in the storefront.
8. Creates hosted Checkout Sessions with a Destination Charge.
9. Applies an application fee to each Destination Charge.
10. Processes V2 thin account requirement/capability events without treating the webhook as the source of current account status.

## Important

This is a sample integration, not a complete marketplace production launch. Before accepting real money, add your production-specific order/fulfilment records, refunds/disputes handling, reconciliation, tax treatment, seller terms, and operational monitoring.
