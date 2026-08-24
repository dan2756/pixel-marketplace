import "server-only";

import Stripe from "stripe";

import { requireEnv } from "./env";

let stripeClient: Stripe | undefined;

export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(requireEnv("STRIPE_SECRET_KEY"), {
      apiVersion: "2026-07-29.dahlia",
      appInfo: {
        name: "One Million Pixels",
        version: "0.1.0",
        url: "https://github.com/dan2756/pixel-marketplace",
      },
      maxNetworkRetries: 2,
      timeout: 12_000,
    });
  }
  return stripeClient;
}

export function integrationIdentifier(id: string): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const compact = id.replaceAll("-", "");
  let suffix = "";
  for (let index = 0; index < 8; index += 1) {
    const value = Number.parseInt(compact.slice(index * 2, index * 2 + 2), 16);
    suffix += alphabet[value % alphabet.length];
  }
  return `pixelmkt_${suffix}`;
}
