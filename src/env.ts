import type { BrowserWorker } from "@cloudflare/puppeteer";

export interface Env {
  BROWSER?: BrowserWorker; // Cloudflare Browser Rendering binding
  WEBHANDS_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  GROQ_API_KEY?: string;
  // Optional: comma-separated hostnames recipes may browse
  // (e.g. "seller.example.com,supplier.example.com"). Unset = any
  // public http(s) host, with loopback/metadata ranges always blocked.
  ALLOWED_HOSTS?: string;
  // Optional per-IP hourly caps (in-memory sliding window, per isolate).
  RATE_LIMIT_RUNS_PER_HOUR?: string;
  RATE_LIMIT_DEMO_PER_HOUR?: string;
  RATE_LIMIT_AI_PER_HOUR?: string;
}
