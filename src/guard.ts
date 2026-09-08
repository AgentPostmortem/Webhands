import type { Recipe } from "./recipe";

// Hosts that must never be browsed, even without an allowlist: loopback,
// link-local metadata, and non-routable ranges an attacker could use to make
// the worker's browser probe internal infrastructure (SSRF).
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
]);

function isBlockedIp(hostname: string): boolean {
  if (hostname === "127.0.0.1" || hostname === "::1" || hostname === "[::1]") return true;
  const mapped = hostname.match(/^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/i);
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    return isBlockedIpv4(
      high >> 8,
      high & 0xff,
      low >> 8,
      low & 0xff,
    );
  }
  const v4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!v4) return false;
  return isBlockedIpv4(
    Number(v4[1]),
    Number(v4[2]),
    Number(v4[3]),
    Number(v4[4]),
  );
}

function isBlockedIpv4(a: number, b: number, c: number, d: number): boolean {
  if (a === 127 && b === 0 && c === 0 && d === 1) return true;
  if (a === 169 && b === 254 && c === 169 && d === 254) return true;
  if (a === 0 && b === 0 && c === 0 && d === 0) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function checkUrl(raw: string, allowedHosts: string[] | null, where: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return `${where} is not a valid URL`;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return `${where} must use http or https`;
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith(".localhost") || isBlockedIp(host)) {
    return `${where} targets a blocked host`;
  }
  if (allowedHosts && allowedHosts.length > 0) {
    const ok = allowedHosts.some(
      (entry) => host === entry || host.endsWith(`.${entry}`),
    );
    if (!ok) return `${where} host is not on the allowlist`;
  }
  return null;
}

/**
 * Validate every URL a recipe touches. Returns an error message, or null
 * when the recipe is safe to run. Pure function, fully unit-testable.
 */
export function validateRecipeUrls(
  recipe: Recipe,
  allowedHosts: string[] | null,
): string | null {
  const entry = checkUrl(recipe.url, allowedHosts, "recipe.url");
  if (entry) return entry;
  for (const step of recipe.steps ?? []) {
    if (step.action === "goto") {
      const err = checkUrl(step.url, allowedHosts, "recipe step goto url");
      if (err) return err;
    }
  }
  return null;
}

/** Parse ALLOWED_HOSTS="a.com, b.com" into a normalized list, or null when unset. */
export function parseAllowedHosts(raw: string | undefined): string[] | null {
  if (!raw) return null;
  const list = raw
    .split(",")
    .map((s) => {
      const value = s.trim().toLowerCase().replace(/\/+$/, "");
      try {
        return new URL(value.includes("://") ? value : `http://${value}`).hostname;
      } catch {
        return value;
      }
    })
    .filter(Boolean);
  return list.length > 0 ? list : null;
}

/**
 * In-memory sliding-window limiter (per Worker isolate; a determined caller
 * spread across isolates gets roughly isolates x limit, which is acceptable
 * abuse-throttling at pilot scale, not a billing guarantee).
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    allowed(key: string, now: number = Date.now()): boolean {
      const cutoff = now - windowMs;
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}
