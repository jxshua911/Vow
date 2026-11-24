# VOW regional pricing and market eligibility

**Status:** Google Play implementation in progress; Play Console price configuration and billing verification remain outstanding.  
**Decision recorded:** Entry $2.99, Accessible $4.99, Moderate $5.99, Standard $6.99 per month (USD-equivalent).

## 1. Pricing objective

VOW should price according to local purchasing power and the value of the product, while remaining commercially sustainable. A single USD price converted mechanically into local currency is not regional purchasing-power pricing.

Keep four global tiers. Do not create a bespoke price for every country at launch. Use one Google Play subscription product and monthly base plan, with country-specific local prices configured in Google Play Console. Google Play is the only billing provider in the current launch scope. Stripe and Apple billing are deferred.

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

These are monthly USD-equivalent reference prices. Local-currency amounts must be configured as country-specific Google Play base-plan prices and checked for tax treatment, store fees, currency volatility and payment costs. Annual billing is out of scope for this first launch; the Google Play monthly base plan is the only subscription option.

## 4. Europe: first-wave market coverage proposal

Target **37 European markets** in the first broad rollout: EU-27, the three EFTA countries covered by the Eurostat comparison (Iceland, Norway and Switzerland), the United Kingdom, and six EU candidate markets (Albania, Bosnia and Herzegovina, Montenegro, North Macedonia, Serbia and Türkiye).

This is a commercial coverage proposal, not a statement that all 37 markets have identical legal, merchant, payment or tax readiness. Country availability must be checked in Google Play Console and against VOW's merchant/payment profile.

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

- vow_google_play_market_catalog: ISO country code, approved VOW tier, enablement flag and update timestamp. This is server-owned and is not client-editable.
- Subscription records: provider, Google Play product/base-plan, billing period, Google-verified store region, mapped market tier, paid-through date and renewal state.
- Google Play Console remains the source of local currency price points; VOW does not calculate a charge from a client-selected country.

The client may request a country for display or relocation review, but it must never authoritatively choose the tier, price ID, currency, entitlement or billing country.

### Google Play — current launch provider

Use one monthly subscription product/base plan. Google Play controls the actual local-currency charge based on the buyer's Play country and the country-specific price configured for that base plan. Configure only the approved launch markets initially; do not automatically enable future countries until reviewed.

The app must display the product's localized `priceString` returned by Google Play Billing. Never hardcode a USD price as the final customer price or derive a price from device locale, SIM, IP address or a user-editable country selector.

After server-side purchase-token verification through `purchases.subscriptionsv2.get`, persist Google's `regionCode` (ISO alpha-2 billing country at the time the subscription was granted) and map it through the server-owned `vow_google_play_market_catalog`. This is an audit/analytics classification; Google Play remains authoritative for the amount actually charged.

Primary Google documentation:
- Subscription purchase verification and `regionCode`: https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2
- Configure country/region availability and prices for subscriptions: https://support.google.com/googleplay/android-developer/answer/1169947
- Play Billing lifecycle and server-side verification: https://developer.android.com/google/play/billing/lifecycle/subscriptions

**Deferred:** Stripe web checkout and Apple App Store billing are not part of this launch scope. Existing legacy provider records are not deleted by this change.

## 6. Anti-arbitrage and subscriber fairness

- Never trust a client-supplied country, tier, price, currency or provider price ID.
- Google Play: use only the verified `regionCode` from the server-side subscription purchase resource. Do not trust device locale, SIM, IP or an editable in-app country.
- Google Play determines the billing country and applies the country-specific base-plan price configured in Play Console; VOW records the verified country and its approved tier for audit/analytics.
- Genuine relocation is handled through Google Play's own country/account eligibility rules, not by allowing a user to switch a VOW tier manually.
- Grandfather existing subscribers; do not silently change a current subscription's price.
- Record the verified country and tier on every purchase verification and subscription lifecycle update.
- Recheck local tax, consumer law, refunds, cancellation disclosures and payment-provider availability before opening each market.

## 7. Implementation status in VOW (verified 24 November 2026)

- Regional tier proposal and anti-arbitrage design: documented and implemented on the remediation branch.
- A server-owned Google Play market catalogue migration maps 49 proposed launch markets to the approved tier ladder.
- The remediation branch adds store_region_code and market_tier to verified Google Play subscription records.
- Both purchase verification and RTDN read Google's verified regionCode and persist the country/tier against the subscription.
- The Android upgrade screen displays Google Play's localized product price and no longer offers Stripe checkout.
- Per-provider AI token telemetry is migration-backed and records model, provider, request type and token counts for successful provider responses.
- Production migrations and Edge Functions are not deployed. Play Console country availability and exact local-currency prices are not configured or verified yet.
- Play Console pricing, merchant/tax readiness and sandbox billing tests remain the final pricing/billing gates.

## 8. Release gates

Do not activate regional pricing until:
1. The owner approves the country matrix and exact local-currency prices.
2. Configure the approved 49 countries and exact local-currency prices for the Google Play monthly base plan in Play Console.
3. Confirm Play Console merchant/payment profile and tax readiness.
4. Deploy the reconciled market-catalogue migration and Google Play verification/RTDN functions.
5. Verify that purchase-token verification and RTDN persist Google's regionCode and mapped tier.
6. Test purchase, restore, renewal, cancellation, country changes and grandfathered subscriptions with Google Play license testers.
