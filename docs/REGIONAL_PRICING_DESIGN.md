# VOW regional pricing and market eligibility

**Status:** proposal for owner approval; not implemented or active in production.  
**Decision recorded:** Entry $2.99, Accessible $4.99, Moderate $5.99, Standard $6.99 per month (USD-equivalent).

## 1. Pricing objective

VOW should price according to local purchasing power and the value of the product, while remaining commercially sustainable. A single USD price converted mechanically into local currency is not regional purchasing-power pricing.

Keep four global tiers. Do not create a bespoke price for every country at launch. Use a country-to-tier catalogue, then configure local currency price points in each billing provider.

## 2. Competitor benchmark (publicly visible prices, checked 24 November 2026)

Prices are reference points, not direct like-for-like comparisons. Some competitors sell team seats or broader professional suites; storefront prices can differ by country, tax, offer, grandfathered subscription, and billing period.

| Product | Public price reference | Relevant offer / pricing signal |
|---|---:|---|
| Todoist Pro | US$5/month billed annually; US$7/month billed monthly | Tasks, calendar layouts, task duration, custom reminders, deadlines, reporting and AI assistance. The official pricing page includes a country/currency selector. |
| TickTick Premium | US$49.99/year (about US$4.17/month equivalent) | Tasks, calendar views, reminders, task duration, habits, statistics and integrations. |
| Notion Plus / Business | US$10 / US$20 per member/month in USD | Broader workspace and collaboration product. Notion has published local-currency prices (for example EUR and GBP) and says local-currency billing is available only for selected customers, geographies and currencies. |
| Structured Pro | US$6.99/month; US$29.99/year; US$99.99 lifetime in US | Particularly relevant benchmark: Structured explicitly says regional prices vary by country, currency and purchasing power. |
| Habitify Pro | Malaysia App Store listing: RM38.99/month and RM194.90/year; Belgium listing: €7.99/month and €39.99/year | Dedicated habit tracking, reminders and insights. App Store listings can contain multiple in-app purchase products or price points; verify the exact active SKU before treating a listing as a single current offer. |
| Sunsama | US$22/month or US$204/year (US$17/month equivalent) | Premium daily-planning product; public pricing manifesto says price is based on value created and annual commitment is discounted. |
| Motion Pro AI / Business AI | US$19 / US$29 per seat/month on the public pricing page | Much broader AI task, project, calendar and meeting workspace; not a direct consumer-productivity comparison. |

Primary sources:
- Todoist: https://www.todoist.com/pricing
- TickTick: https://ticktick.com/upgrade?language=en_us
- Notion: https://www.notion.com/pricing
- Notion local-currency FAQ: https://notion.notion.site/Local-Currency-FAQs-bb75546f474a440dbb3447382b9db19b
- Notion currency price announcement: https://www.notion.com/releases/2024-06-26
- Structured regional pricing: https://help.structured.app/en/articles/324674
- Habitify Malaysia App Store: https://apps.apple.com/my/app/habitify-habit-tracker/id1111447047
- Habitify Belgium App Store: https://apps.apple.com/be/app/habitify-habit-tracker/id1111447047
- Sunsama: https://www.sunsama.com/pricing
- Sunsama pricing manifesto: https://help.sunsama.com/docs/billing/pricing-manifesto/
- Motion: https://www.usemotion.com/pricing

### What this means for VOW

VOW's differentiator is the goal-to-execution loop: AI-assisted goal planning, scheduled sessions, weekly reviews and progress accountability. It is not yet as broad as Notion, Motion or Todoist in integrations, collaboration and mature reporting.

The proposed US$6.99 Standard tier is close to Todoist's US$7 monthly price and Structured's US$6.99 monthly price. The US$2.99 Entry tier gives VOW a lower starting point for more price-sensitive markets. This is a defensible initial ladder, but it must be validated against VOW's AI costs, retention, conversion, refunds and willingness-to-pay data.

## 3. Confirmed VOW monthly USD-equivalent tier ladder

| Tier | Monthly USD equivalent |
|---|---:|
| Standard | **US$6.99** |
| Moderate | **US$5.99** |
| Accessible | **US$4.99** |
| Entry | **US$2.99** |

These are monthly reference prices. Local-currency amounts must be rounded to familiar local price points and checked for tax treatment, store fees, currency volatility and payment costs. Annual billing is not approved by this document; the current Stripe checkout function is monthly-only.

## 4. Europe: first-wave market coverage proposal

Target **37 European markets** in the first broad rollout: EU-27, the three EFTA countries covered by the Eurostat comparison (Iceland, Norway and Switzerland), the United Kingdom, and six EU candidate markets (Albania, Bosnia and Herzegovina, Montenegro, North Macedonia, Serbia and Türkiye).

This is a commercial coverage proposal, not a statement that all 37 markets have identical legal, merchant, payment or tax readiness. Country availability must be checked separately for Google Play, Stripe and VOW's merchant setup.

### Preliminary Europe-to-tier allocation

| Tier | Initial European markets |
|---|---|
| Standard — $6.99 | Austria, Belgium, Denmark, Finland, France, Germany, Iceland, Ireland, Luxembourg, Netherlands, Norway, Sweden, Switzerland, United Kingdom |
| Moderate — $5.99 | Cyprus, Czechia, Estonia, Greece, Italy, Latvia, Lithuania, Malta, Portugal, Slovakia, Slovenia, Spain |
| Accessible — $4.99 | Bulgaria, Croatia, Hungary, Poland, Romania |
| Entry — $2.99 | Albania, Bosnia and Herzegovina, Montenegro, North Macedonia, Serbia, Türkiye |

The allocation is intentionally provisional. The European Commission/Eurostat 2025 household-consumption price-level data show wide differences: Switzerland and Iceland are very high; Denmark, Ireland and Luxembourg are also high; Bulgaria, Romania and Poland are much lower. Price level is not the same as disposable income or affordability, so final allocations must also consider actual individual consumption (AIC) per capita, household income, inflation/currency volatility, and local subscription benchmarks.

Sources:
- Eurostat comparative price levels (2025 data): https://ec.europa.eu/eurostat/statistics-explained/index.php?title=Comparative_price_levels_of_consumer_goods_and_services
- Eurostat GDP/AIC and price-level analysis: https://ec.europa.eu/eurostat/statistics-explained/index.php?title=GDP_per_capita%2C_consumption_per_capita_and_price_level_indices
- Eurostat price-level dataset: https://ec.europa.eu/eurostat/databrowser/view/tec00120/default/table?lang=en
- EFTA/candidate-country comparison: https://www.ssb.no/en/priser-og-prisindekser/konsumpriser/statistikk/sammenlikning-av-prisniva-i-europa

### Other initially named markets

| Tier | Initial non-European examples |
|---|---|
| Standard — $6.99 | United States, Australia, Canada |
| Moderate — $5.99 | Singapore |
| Accessible — $4.99 | Malaysia, Tanzania, Indonesia, Kenya, Philippines, South Africa |
| Entry — $2.99 | India, Nigeria |

France and the UK are already included in the European allocation. This gives a working list of 49 named markets (37 European + 12 non-European), before further country expansion.

### Phase-two / eligibility review

Microstates and other European markets not in the first 37 (for example Andorra, Liechtenstein, Monaco, San Marino, Kosovo, Moldova and Ukraine) should be assessed individually for storefront availability, merchant/payment support, local currency and compliance. Belarus and Russia require specific sanctions and payment-provider review before any commercial availability decision. Do not infer eligibility from geography alone.

## 5. Recommended pricing architecture

Separate four concepts that must never be conflated:

1. **Distribution eligibility:** whether VOW can legally and operationally sell in the country.
2. **Market assignment:** the verified country/market to which the account is entitled.
3. **Tier assignment:** Standard, Moderate, Accessible or Entry.
4. **Currency presentation:** the local currency and price point presented by the store or payment provider.

### Suggested server-owned data model

- `vow_market_catalog`: ISO country code, market status, tier, local currency, tax/display rules, provider availability, effective dates and approved monthly/annual provider price identifiers.
- `vow_user_market_assignments`: user ID, assigned country, tier, evidence source, verified timestamp, review status and next-review date.
- `vow_market_assignment_events`: append-only audit trail containing old/new market, actor, evidence type, timestamp and decision reason.
- Subscription records: provider, provider product/price/base-plan ID, billing period, verified store country/region, paid-through date and renewal state.

The client may request a country for display or relocation review, but it must never authoritatively choose the tier, price ID, currency, entitlement or billing country.

### Google Play

Use Google Play's verified buyer country and the product's country-specific subscription base-plan price. Verify the purchase token server-side with the Google Play Developer API and persist the returned region code alongside the subscription record. Do not use device locale, SIM country, app language or an editable VOW country field.

Google Play lets developers set country/region availability and local base-plan prices; the buyer's Play country determines which base plans are available:
- https://support.google.com/googleplay/android-developer/answer/140504
- https://support.google.com/googleplay/android-developer/answer/6334373
- https://developers.google.com/android-publisher/api-ref/rest/v3/monetization.subscriptions

### Stripe / web checkout

Use explicit server-configured Stripe Price IDs (or an approved server-side market-price table) for each enabled country/tier and billing period. Require billing-address collection and validate the billing country against the payment-method issuing country or other trusted payment evidence before retaining a discounted assignment. A mismatch must receive the Standard tier or manual review; do not grant an ongoing discounted renewal based only on a typed address.

IP geolocation is a risk signal only. Do not rely on VPN-sensitive IP, browser locale, timezone, SIM or user-selected region as proof. Enforce the final assignment in the signed webhook path before granting/renewing Premium. Preserve existing subscribers' prices and apply approved relocation changes only at renewal.

Stripe Adaptive Pricing is useful for local-currency presentment and conversion, but it is not the same as purchasing-power pricing: it converts a configured price and can add a currency-conversion fee. VOW needs explicit market price differences for the four tiers.
- https://support.stripe.com/questions/adaptive-pricing
- https://stripe.com/resources/more/geographic-pricing-in-practice

### Apple (future iOS)

App Store Connect supports per-storefront auto-renewable subscription prices, many price points per currency, comparable prices across 175 storefronts, and preservation of existing subscriber prices. Use the store's verified transaction/storefront information; do not recreate the store's country decision in the client.
- https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-pricing-for-auto-renewable-subscriptions/
- https://developer.apple.com/documentation/appstoreconnectapi/configuring-subscription-prices-across-territories

## 6. Anti-arbitrage and subscriber fairness

- Never trust a client-supplied country, tier, price, currency or provider price ID.
- Google Play: use verified Play country/region from purchase verification.
- Stripe: require billing address and check it against card/payment country; use IP only as a risk signal.
- Country/card mismatch: Standard tier or manual review; do not silently grant a lower recurring price.
- Genuine relocation: review evidence, then apply the new market at the next renewal.
- Grandfather current subscribers; no silent price increases.
- Record every market assignment and change.
- Rate-limit repeated relocation requests and flag conflicting evidence.
- Recheck local tax, consumer law, refunds, cancellation disclosures and payment-provider availability before opening each market.

## 7. Implementation status in VOW (verified 24 November 2026)

- Regional tier proposal and anti-arbitrage design: documented only.
- Stripe checkout: currently uses one server-configured `STRIPE_PRICE_ID_MONTHLY`; no country/tier selection.
- Stripe checkout currently forces monthly billing and ignores a client-provided billing interval.
- No server-owned country/tier assignment or market audit tables are implemented.
- No regional Stripe Price IDs or country assignments are configured.
- Google Play country-specific prices must be configured in Play Console; verify that the live purchase-verification path persists and enforces `regionCode` before relying on it.
- Stripe account merchant/legal/tax readiness must be confirmed before production activation.

## 8. Release gates

Do not activate regional pricing until:
1. The owner approves the country matrix and exact local-currency prices.
2. Stripe merchant charges/payouts and legal/tax setup are ready.
3. The server-owned market catalogue, assignment and audit trail exist.
4. Google Play purchase verification and Stripe webhook enforcement are tested.
5. VPN, locale, billing/card mismatch, relocation, renewal and grandfathering tests pass.
6. Storefront prices and tax-inclusive/exclusive presentation are checked in real sandbox/test purchases.
