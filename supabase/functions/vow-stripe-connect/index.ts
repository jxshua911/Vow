import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { getStripeClient, json, requireEnv } from "../_shared/stripe.ts";

// This Edge Function owns all Stripe Connect server-side operations.
// The browser only sends small, validated inputs and receives safe results.
//
// Actions:
// - create-account: create a V2 connected account.
// - status: retrieve current onboarding state directly from Stripe.
// - onboarding-link: create a single-use V2 Account Link.
// - create-product: create a platform-level Stripe Product and map it to a seller.
// - list-products: load the public storefront.
// - checkout: create a hosted Checkout Session with a Destination Charge.

type Action =
  | "create-account"
  | "status"
  | "onboarding-link"
  | "create-product"
  | "list-products"
  | "checkout";

async function getUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;

  const supabase = createClient(
    requireEnv("SUPABASE_URL", "Supabase is not configured: set SUPABASE_URL."),
    requireEnv("SUPABASE_ANON_KEY", "Supabase is not configured: set SUPABASE_ANON_KEY."),
    { global: { headers: { Authorization: authorization } } },
  );

  const { data } = await supabase.auth.getUser();
  return data.user || null;
}

async function getServiceDb() {
  return createClient(
    requireEnv("SUPABASE_URL", "Supabase is not configured: set SUPABASE_URL."),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", "Stripe Connect database access is not configured: set SUPABASE_SERVICE_ROLE_KEY."),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

function requireUser(user: Awaited<ReturnType<typeof getUser>>) {
  if (!user) throw new Error("Authentication required.");
  return user;
}

function positiveInteger(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(label + " must be a positive whole number.");
  }
  return parsed;
}

function appUrl(req: Request) {
  return (Deno.env.get("STRIPE_CONNECT_APP_URL") || req.headers.get("origin") || "https://example.com").replace(/\/$/, "");
}

async function accountStatus(stripe: ReturnType<typeof getStripeClient>, accountId: string) {
  // Status is intentionally retrieved from Stripe on every request.
  // The database stores the account ID mapping only, never a stale status.
  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient", "requirements"],
  });

  const readyToReceivePayments =
    account?.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";

  const requirementsStatus = account.requirements?.summary?.minimum_deadline?.status;
  const onboardingComplete =
    requirementsStatus !== "currently_due" && requirementsStatus !== "past_due";

  return {
    accountId,
    displayName: account.display_name || null,
    readyToReceivePayments,
    onboardingComplete,
    requirementsStatus: requirementsStatus || "none",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action as Action;
    const stripe = getStripeClient();
    const db = await getServiceDb();

    // Storefront catalogue reads do not need a signed-in VOW user.
    if (action === "list-products") {
      const { data, error } = await db
        .from("stripe_connect_products")
        .select("id,stripe_product_id,connected_account_id,name,description,price_in_cents,currency,active,created_at")
        .eq("active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Products live on the platform. We separately retrieve each connected
      // account so the storefront can display the seller as well.
      const products = await Promise.all((data || []).map(async (product) => {
        try {
          const account = await stripe.v2.core.accounts.retrieve(product.connected_account_id);
          return { ...product, connected_account_name: account.display_name || product.connected_account_id };
        } catch {
          return { ...product, connected_account_name: product.connected_account_id };
        }
      }));

      return json({ products });
    }

    // Checkout is intentionally available to storefront customers without
    // requiring a VOW account. Seller/account-management actions remain protected.
    if (action === "checkout") {
      const productId = String(body?.productId || "").trim();
      if (!productId) throw new Error("A product ID is required.");

      const { data: product, error } = await db
        .from("stripe_connect_products")
        .select("stripe_product_id,connected_account_id,name,price_in_cents,currency,active")
        .eq("stripe_product_id", productId)
        .eq("active", true)
        .maybeSingle();

      if (error) throw error;
      if (!product) throw new Error("That product is no longer available.");

      const seller = await accountStatus(stripe, product.connected_account_id);
      if (!seller.readyToReceivePayments) {
        throw new Error("This seller is not ready to receive payments yet.");
      }

      const feePercent = Number(Deno.env.get("STRIPE_APPLICATION_FEE_PERCENT") || "10");
      if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent >= 100) {
        throw new Error("Stripe application fee is not configured correctly: set STRIPE_APPLICATION_FEE_PERCENT to a number from 0 to below 100.");
      }

      const applicationFeeAmount = Math.floor(product.price_in_cents * feePercent / 100);
      const base = appUrl(req);

      // Destination Charge:
      // 1. The customer pays through the platform's hosted Checkout.
      // 2. Stripe transfers the charge to the destination account.
      // 3. application_fee_amount remains with the platform.
      const session = await stripe.checkout.sessions.create({
        line_items: [{
          price_data: {
            currency: product.currency,
            product: product.stripe_product_id,
            unit_amount: product.price_in_cents,
          },
          quantity: 1,
        }],
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: { destination: product.connected_account_id },
        },
        mode: "payment",
        success_url: base + "/?stripe=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: base + "/?stripe=cancelled",
        metadata: {
          vow_product_id: product.stripe_product_id,
          vow_connected_account_id: product.connected_account_id,
          vow_application_fee_amount: String(applicationFeeAmount),
        },
      });

      return json({ url: session.url });
    }

    const user = requireUser(await getUser(req));

    if (action === "create-account") {
      const displayName = String(
        body?.displayName || user.user_metadata?.full_name || user.email || "VOW creator",
      ).trim();
      const contactEmail = String(body?.contactEmail || user.email || "").trim();
      const country = String(body?.country || "us").trim().toLowerCase();

      if (!contactEmail) throw new Error("A contact email is required to create a Stripe connected account.");
      if (!/^[a-z]{2}$/.test(country)) throw new Error("Country must be a two-letter ISO country code.");

      const existing = await db
        .from("stripe_connected_accounts")
        .select("stripe_account_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing.data?.stripe_account_id) {
        return json({ accountId: existing.data.stripe_account_id, created: false });
      }

      // V2 account creation uses only the properties specified by this
      // integration. Do NOT add a top-level type: "express", "standard", or
      // "custom"; V2 uses the dashboard/configuration model instead.
      const account = await stripe.v2.core.accounts.create({
        display_name: displayName,
        contact_email: contactEmail,
        identity: {
          country,
        },
        dashboard: "express",
        defaults: {
          responsibilities: {
            fees_collector: "application",
            losses_collector: "application",
          },
        },
        configuration: {
          recipient: {
            capabilities: {
              stripe_balance: {
                stripe_transfers: {
                  requested: true,
                },
              },
            },
          },
        },
      });

      const { error } = await db.from("stripe_connected_accounts").insert({
        user_id: user.id,
        stripe_account_id: account.id,
      });

      if (error) {
        console.error("Stripe account created but mapping failed", account.id, error);
        throw new Error("Stripe account was created, but VOW could not save its mapping. Contact support before creating another account.");
      }

      return json({ accountId: account.id, created: true });
    }

    const mapping = await db
      .from("stripe_connected_accounts")
      .select("stripe_account_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!mapping.data?.stripe_account_id) {
      return json({ error: "Create your Stripe connected account first." }, 409);
    }

    const accountId = mapping.data.stripe_account_id;

    if (action === "status") {
      return json(await accountStatus(stripe, accountId));
    }

    if (action === "onboarding-link") {
      // Account Links are single-use. Always generate a fresh one when the
      // user presses the onboarding button rather than persisting a URL.
      const base = appUrl(req);
      const accountLink = await stripe.v2.core.accountLinks.create({
        account: accountId,
        use_case: {
          type: "account_onboarding",
          account_onboarding: {
            configurations: ["recipient"],
            refresh_url: base + "/?stripe=refresh&accountId=" + encodeURIComponent(accountId),
            return_url: base + "/?stripe=return&accountId=" + encodeURIComponent(accountId),
          },
        },
      });

      return json({ url: accountLink.url });
    }

    if (action === "create-product") {
      const name = String(body?.name || "").trim();
      const description = String(body?.description || "").trim();
      const priceInCents = positiveInteger(body?.priceInCents, "Price");
      const currency = String(body?.currency || "usd").trim().toLowerCase();
      const requestedAccountId = String(body?.connectedAccountId || accountId);

      if (!name || name.length > 120) throw new Error("Product name is required and must be 120 characters or fewer.");
      if (description.length > 500) throw new Error("Product description must be 500 characters or fewer.");
      if (!/^[a-z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO currency code.");
      if (requestedAccountId !== accountId) throw new Error("You can only create products for your own connected account.");

      const seller = await accountStatus(stripe, accountId);
      if (!seller.onboardingComplete || !seller.readyToReceivePayments) {
        throw new Error("Complete Stripe onboarding and make sure payments are enabled before creating a product.");
      }

      const product = await stripe.products.create({
        name,
        description: description || undefined,
        default_price_data: {
          unit_amount: priceInCents,
          currency,
        },
        // The mapping is also stored in Supabase, but Stripe metadata makes
        // the relationship visible when debugging the platform in Dashboard.
        metadata: {
          vow_connected_account_id: accountId,
          vow_created_by: user.id,
        },
      });

      const priceId = typeof product.default_price === "string"
        ? product.default_price
        : product.default_price?.id || null;

      const { error } = await db.from("stripe_connect_products").insert({
        stripe_product_id: product.id,
        stripe_price_id: priceId,
        connected_account_id: accountId,
        created_by: user.id,
        name,
        description: description || null,
        price_in_cents: priceInCents,
        currency,
      });

      if (error) throw error;
      return json({ productId: product.id, priceId });
    }

    return json({ error: "Unknown Stripe Connect action." }, 400);
  } catch (error) {
    console.error("vow-stripe-connect", error);
    const message = error instanceof Error ? error.message : "Stripe Connect request failed.";
    const status =
      /Authentication required/i.test(message) ? 401 :
      /not configured|configuration/i.test(message) ? 503 : 400;
    return json({ error: message }, status);
  }
});
