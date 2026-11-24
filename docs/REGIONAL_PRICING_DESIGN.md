# VOW regional pricing design (draft — approval required)

## Goal

Offer a lower Premium price in markets where the standard price is materially less affordable, without allowing a user to switch an in-app region selector and obtain a cheaper price.

The current Premium reference price is USD 4.99/month. The values below are a proposal for testing, not approved production prices.

## Evidence and limits

The World Bank's 2025 GDP price-level index uses the United States as 100. Selected values:

| Market | 2025 price-level index |
|---|---:|
| United States | 100.0 |
| United Kingdom | 89.2 |
| Australia | 90.5 |
| Canada | 83.4 |
| France | 76.6 |
| Singapore | 60.5 |
| South Africa | 41.5 |
| Kenya | 33.7 |
| Philippines | 33.2 |
| Malaysia | 31.6 |
| Tanzania | 29.5 |
| Indonesia | 28.7 |
| India | 23.0 |
| Nigeria | 12.8 |

Source: World Bank, Price level index (GDP), indicator PA.NUS.GDP.PLI:
https://data.worldbank.org/indicator/PA.NUS.GDP.PLI

This is a national price-level measure, not a direct measure of a customer's disposable income or willingness to pay. It should guide initial market grouping, not mechanically determine a subscription price.

Google Play documents that a user's Google Play country determines which subscription base plans are available, and supports country-specific prices and local price adjustments:
https://support.google.com/googleplay/android-developer/answer/140504
https://developer.android.com/google/play/billing/price-changes

## Proposed test tiers

| Tier | USD-equivalent monthly price | Initial market grouping |
|---|---:|---|
| A — standard | $4.99 | Higher price-level markets (e.g. US, UK, Australia, Canada, France) |
| B — moderate | $3.99 | Mid-price markets (e.g. Singapore) |
| C — accessible | $2.99 | Malaysia, Tanzania, Indonesia, Kenya, Philippines, South Africa |
| D — entry | $1.99 | India, Nigeria and other substantially lower price-level markets |

These tiers are deliberately coarse. Before launch, review local currency price points, taxes, payment fees, AI delivery costs, refund rates and conversion/retention. Do not simply multiply the USD price by the World Bank index.

## Anti-arbitrage rules

1. Do not accept a country, currency, price ID, discount, or tier supplied by the client as authoritative.
2. Google Play purchases use the verified Google Play billing country and the product's Play Console country price. Do not use device locale, SIM country, or a user-editable VOW region field.
3. Stripe uses server-side market assignment. Require a billing address and verify the billing country against the payment method's issuing country before assigning a discounted market. A mismatch receives the standard tier or manual review.
4. Store the assigned country, tier, verification source, and verification timestamp server-side. The user cannot edit these fields.
5. A country change does not automatically lower the price. Require a verified relocation review; apply an approved new market only at the next renewal.
6. Grandfather existing subscribers. Do not silently increase or decrease their current subscription price.
7. IP geolocation may be used as a fraud/risk signal, never as the sole proof of market eligibility.
8. Log every assignment and change with the actor, old market, new market, evidence type, and timestamp.

## Recommended implementation sequence

1. Approve the country-to-tier matrix and local currency prices.
2. Configure Google Play subscription base-plan prices per country in Play Console.
3. Confirm Stripe account charges and payouts are enabled and the business/tax profile is valid.
4. Add server-owned market assignment and an audit trail in Supabase.
5. Update Stripe checkout to select only server-configured Price IDs; verify billing and card country before granting a discounted market.
6. Validate Google Play purchase regionCode from the verified purchase and store it with the subscription record.
7. Add relocation review and grandfathering tests.
8. Test mismatch cases: VPN, changed device locale, changed app language, billing/card country mismatch, and genuine relocation.

## Release guard

Do not enable regional Stripe pricing until the approved country/price matrix, Stripe account readiness, market verification, and webhook enforcement are all in place. Until then, keep the existing server-configured global price.