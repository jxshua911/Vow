// Shared Stripe client for VOW's Stripe Connect sample.
// Every Stripe request in this feature uses this client.
// No API version is set here; stripe-node 22.6.2 uses its pinned API version.

import Stripe from "npm:stripe@22.6.2";

export function requireStripeSecret(): string {
  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY to your server-side Stripe secret key.");
  }
  return secret;
}

export function getStripeClient(): Stripe {
  return new Stripe(requireStripeSecret());
}

export function requireEnv(name: string, helpfulMessage: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(helpfulMessage);
  return value;
}

export function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Content-Type": "application/json",
    },
  });
}
