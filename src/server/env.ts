import "server-only";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function appUrl(): string {
  if (isProduction() && !process.env.APP_URL) {
    throw new Error("APP_URL is not configured");
  }
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
