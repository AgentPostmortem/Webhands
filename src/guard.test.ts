import { describe, expect, it } from "vitest";
import {
  createRateLimiter,
  parseAllowedHosts,
  validateRecipeUrls,
} from "./guard";
import type { Recipe } from "./recipe";

const base: Recipe = { url: "https://seller.example.com/orders" };

describe("validateRecipeUrls", () => {
  it("accepts a plain public recipe with no allowlist", () => {
    expect(validateRecipeUrls(base, null)).toBeNull();
  });

  it("rejects non-http schemes", () => {
    expect(validateRecipeUrls({ url: "file:///etc/passwd" }, null)).toMatch(
      /http or https/,
    );
    expect(validateRecipeUrls({ url: "javascript:alert(1)" }, null)).toMatch(
      /http or https/,
    );
  });

  it("rejects unparseable urls", () => {
    expect(validateRecipeUrls({ url: "not a url" }, null)).toMatch(
      /not a valid URL/,
    );
  });

  it("blocks loopback, metadata, and private ranges", () => {
    for (const host of [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "0.0.0.0",
      "169.254.169.254",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.4.2",
    ]) {
      expect(validateRecipeUrls({ url: `http://${host}/` }, null)).toMatch(
        /blocked host/,
      );
    }
  });

  it("allows public IPs", () => {
    expect(validateRecipeUrls({ url: "http://93.184.216.34/" }, null)).toBeNull();
  });

  it("blocks alternate loopback and IPv4-mapped IPv6 forms", () => {
    for (const host of ["0x7f.0.0.1", "2130706433", "[::ffff:127.0.0.1]"]) {
      expect(validateRecipeUrls({ url: `http://${host}/` }, null)).toEqual(
        expect.stringMatching(/blocked host/),
      );
    }
    expect(
      validateRecipeUrls({ url: "http://[::ffff:5db8:d822]/" }, null),
    ).toBeNull();
  });

  it("enforces the allowlist on entry and goto urls", () => {
    const allow = ["seller.example.com"];
    expect(validateRecipeUrls(base, allow)).toBeNull();
    expect(
      validateRecipeUrls(
        { url: "https://evil.example.net/x", steps: [] },
        allow,
      ),
    ).toMatch(/allowlist/);
    expect(
      validateRecipeUrls(
        {
          url: "https://seller.example.com/",
          steps: [{ action: "goto", url: "https://evil.example.net/" }],
        },
        allow,
      ),
    ).toMatch(/allowlist/);
  });

  it("allows subdomains of allowlisted hosts", () => {
    expect(
      validateRecipeUrls(
        { url: "https://app.seller.example.com/" },
        ["seller.example.com"],
      ),
    ).toBeNull();
    // ...but not suffix lookalikes
    expect(
      validateRecipeUrls(
        { url: "https://seller.example.com.evil.net/" },
        ["seller.example.com"],
      ),
    ).toMatch(/allowlist/);
  });
});

describe("parseAllowedHosts", () => {
  it("returns null when unset and normalizes entries", () => {
    expect(parseAllowedHosts(undefined)).toBeNull();
    expect(parseAllowedHosts("")).toBeNull();
    expect(
      parseAllowedHosts(" Seller.Example.COM , ,supplier.example.com/"),
    ).toEqual(["seller.example.com", "supplier.example.com"]);
  });
});

describe("createRateLimiter", () => {
  it("allows up to the limit then refuses inside the window", () => {
    const limiter = createRateLimiter(2, 60_000);
    expect(limiter.allowed("k", 0)).toBe(true);
    expect(limiter.allowed("k", 1_000)).toBe(true);
    expect(limiter.allowed("k", 2_000)).toBe(false);
    // Window slides: after 60s the first hit expires.
    expect(limiter.allowed("k", 60_001)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter(1, 60_000);
    expect(limiter.allowed("a", 0)).toBe(true);
    expect(limiter.allowed("b", 0)).toBe(true);
    expect(limiter.allowed("a", 0)).toBe(false);
  });
});
