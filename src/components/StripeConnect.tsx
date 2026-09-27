import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "./AppShell";
import { ArrowLeft } from "@/lib/ui-icons";

type AccountStatus = {
  accountId: string;
  displayName: string | null;
  readyToReceivePayments: boolean;
  onboardingComplete: boolean;
  requirementsStatus: string;
};

type Product = {
  id: string;
  stripe_product_id: string;
  connected_account_id: string;
  name: string;
  description: string | null;
  price_in_cents: number;
  currency: string;
  connected_account_name?: string;
};

async function invoke(action: string, body: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("vow-stripe-connect", {
    body: { action, ...body },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  } catch {
    return (cents / 100).toFixed(2) + " " + currency.toUpperCase();
  }
}

export function StripeConnectPage({ onBack }: { onBack: () => void }) {
  const [status, setStatus] = useState<AccountStatus | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [sellerName, setSellerName] = useState("");
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("10.00");
  const [currency, setCurrency] = useState("usd");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      // Status is fetched from Stripe's Accounts API every time.
      // We only use our DB mapping to find the Stripe account ID.
      const accountStatus = await invoke("status").catch((err) => {
        if (/Create your Stripe connected account/i.test(err.message)) return null;
        throw err;
      });

      const productResult = await invoke("list-products");
      setStatus(accountStatus);
      setProducts(productResult.products || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Stripe Connect.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createAccount() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const data = await invoke("create-account", {
        displayName: sellerName.trim() || undefined,
      });
      setMessage(data.created ? "Stripe connected account created." : "Your Stripe connected account already exists.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the Stripe account.");
    } finally {
      setWorking(false);
    }
  }

  async function onboard() {
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const data = await invoke("onboarding-link");
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.url });
      } else {
        window.location.assign(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start Stripe onboarding.");
    } finally {
      setWorking(false);
    }
  }

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setWorking(true);
    setError("");
    setMessage("");

    try {
      const priceInCents = Math.round(Number(price) * 100);
      if (!Number.isFinite(priceInCents) || priceInCents <= 0) {
        throw new Error("Enter a valid positive product price.");
      }

      const data = await invoke("create-product", {
        name: productName,
        description,
        priceInCents,
        currency,
      });

      setMessage("Product created: " + data.productId);
      setProductName("");
      setDescription("");
      setPrice("10.00");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the product.");
    } finally {
      setWorking(false);
    }
  }

  async function buy(productId: string) {
    setWorking(true);
    setError("");

    try {
      const data = await invoke("checkout", { productId });
      if (Capacitor.isNativePlatform()) {
        await Browser.open({ url: data.url });
      } else {
        window.location.assign(data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <div>
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-vow-muted hover:text-vow-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </button>

      <PageHeader
        title="Stripe Connect"
        subtitle="Onboard sellers, create products, and test hosted customer checkout."
      />

      {message && (
        <div role="status" className="mb-5 border-l-2 border-vow-ink bg-vow-surface/60 px-4 py-3 text-sm">
          {message}
        </div>
      )}
      {error && (
        <div role="alert" className="mb-5 border-l-2 border-vow-ink bg-vow-surface/60 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <section className="mb-6 border border-vow-border p-5">
        <h2 className="text-sm font-medium text-vow-ink">Seller onboarding</h2>
        <p className="mt-1 text-xs leading-relaxed text-vow-muted">
          VOW uses Stripe Connect to onboard a recipient and collect an application fee from destination charges.
        </p>

        {loading ? (
          <p className="mt-5 text-sm text-vow-muted">Checking Stripe account status…</p>
        ) : !status ? (
          <div className="mt-5">
            <label className="block">
              <span className="vow-label">Display name</span>
              <input
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="vow-input mt-2"
                placeholder="Your seller name"
              />
            </label>
            <button
              onClick={() => void createAccount()}
              disabled={working}
              className="vow-btn-primary mt-4 disabled:opacity-50"
            >
              {working ? "Creating…" : "Create connected account"}
            </button>
          </div>
        ) : (
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-vow-muted">Account</span>
              <span className="font-mono text-xs text-vow-ink">{status.accountId}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-vow-muted">Onboarding</span>
              <span className="text-vow-ink">{status.onboardingComplete ? "Complete" : "Needs information"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-vow-muted">Payments</span>
              <span className="text-vow-ink">{status.readyToReceivePayments ? "Ready" : "Not ready"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-vow-muted">Requirements</span>
              <span className="text-vow-ink">{status.requirementsStatus}</span>
            </div>

            <button
              onClick={() => void onboard()}
              disabled={working || status.readyToReceivePayments}
              className="vow-btn-primary mt-2 disabled:opacity-50"
            >
              {status.readyToReceivePayments
                ? "Payments enabled"
                : working
                  ? "Opening…"
                  : "Onboard to collect payments"}
            </button>
          </div>
        )}
      </section>

      <section className="mb-6 border border-vow-border p-5">
        <h2 className="text-sm font-medium text-vow-ink">Create a product</h2>
        <p className="mb-5 mt-1 text-xs text-vow-muted">
          Products are created on the VOW platform account, then mapped to the connected seller.
        </p>

        <form onSubmit={createProduct} className="space-y-4">
          <label className="block">
            <span className="vow-label">Name</span>
            <input
              required
              maxLength={120}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="vow-input mt-2"
              placeholder="Example product"
            />
          </label>

          <label className="block">
            <span className="vow-label">Description</span>
            <textarea
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="vow-input mt-2"
              rows={3}
              placeholder="What is the customer buying?"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="vow-label">Price</span>
              <input
                required
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="vow-input mt-2"
                placeholder="10.00"
              />
            </label>

            <label className="block">
              <span className="vow-label">Currency</span>
              <input
                required
                maxLength={3}
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toLowerCase())}
                className="vow-input mt-2 uppercase"
                placeholder="usd"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={working || !status?.onboardingComplete}
            className="vow-btn-primary disabled:opacity-50"
          >
            {working ? "Creating…" : "Create product"}
          </button>

          {!status?.onboardingComplete && (
            <p className="text-xs text-vow-muted">
              Complete Stripe onboarding before creating a product.
            </p>
          )}
        </form>
      </section>

      <section className="border border-vow-border p-5">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-medium text-vow-ink">Storefront</h2>
            <p className="mt-1 text-xs text-vow-muted">
              All active platform products and their connected sellers.
            </p>
          </div>
          <button
            onClick={() => void load()}
            className="border border-vow-border px-3 py-2 text-xs text-vow-ink"
          >
            Refresh
          </button>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-vow-muted">No products yet.</p>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <article key={product.id} className="border border-vow-border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-vow-ink">{product.name}</h3>
                    {product.description && (
                      <p className="mt-1 text-xs text-vow-muted">{product.description}</p>
                    )}
                    <p className="mt-3 text-[11px] text-vow-muted">
                      Seller: {product.connected_account_name || product.connected_account_id}
                    </p>
                  </div>
                  <span className="text-sm text-vow-ink">
                    {money(product.price_in_cents, product.currency)}
                  </span>
                </div>

                <button
                  onClick={() => void buy(product.stripe_product_id)}
                  disabled={working}
                  className="vow-btn-primary mt-4 disabled:opacity-50"
                >
                  Buy
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
