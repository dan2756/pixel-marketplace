import { z } from "zod";

import { BOARD_HEIGHT, BOARD_WIDTH } from "./constants";
import { selectionConstraintReason } from "./rect";

const hexColorPattern = /^#[0-9A-F]{6}$/;

export function normalizeColor(input: string): string {
  const value = input.trim().toUpperCase();
  if (!hexColorPattern.test(value)) {
    throw new Error("Use a six-digit hex color, for example #6857F5.");
  }
  return value;
}

export function normalizeDestinationUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Enter a destination URL.");
  }
  if (trimmed.length > 2048) {
    throw new Error("Destination URL is too long.");
  }

  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;

  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("Enter a valid web address.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http and https destinations are allowed.");
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error("Destination URL cannot include credentials.");
  }

  parsed.hash = "";
  return parsed.toString();
}

const integer = z.number().int();

export const pixelRectSchema = z
  .object({
    x: integer.min(0).max(BOARD_WIDTH - 1),
    y: integer.min(0).max(BOARD_HEIGHT - 1),
    width: integer.min(1).max(BOARD_WIDTH),
    height: integer.min(1).max(BOARD_HEIGHT),
  })
  .superRefine((value, context) => {
    const reason = selectionConstraintReason(value);
    if (reason) {
      context.addIssue({
        code: "custom",
        message: reason,
      });
    }
  });

export const checkoutRequestSchema = z.object({
  rect: pixelRectSchema,
  color: z.string().transform((value, context) => {
    try {
      return normalizeColor(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid color.",
      });
      return z.NEVER;
    }
  }),
  destinationUrl: z.string().transform((value, context) => {
    try {
      return normalizeDestinationUrl(value);
    } catch (error) {
      context.addIssue({
        code: "custom",
        message: error instanceof Error ? error.message : "Invalid URL.",
      });
      return z.NEVER;
    }
  }),
  idempotencyKey: z.uuid(),
  turnstileToken: z.string().max(4096).optional().default(""),
});

export { calculatePriceCents } from "./pricing";

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
