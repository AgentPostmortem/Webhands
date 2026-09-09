# Webhands

A computer-use agent for the tools that have **no usable API**. Webhands drives
the real dashboard (TikTok Shop seller center, supplier/3PL portals) via
Cloudflare Browser Rendering, returns clean structured data, and refuses any
write action unless you explicitly confirm it.

## Demo

[![Webhands demo](assets/demo-thumb.png)](assets/demo.mp4)

▶ [Watch the demo](assets/demo.mp4) · Live: https://webhands.agentpostmortem.com

"There's no API" becomes "there's an agent."

## How it works

You POST a **recipe**: an entry URL, optional login/navigation steps, and an
extraction spec. Webhands runs it in a headless browser and returns:

- `data`, structured JSON (scraped from CSS selectors, or extracted from the
  page text by Claude when you give a natural-language `extract.prompt`)
- `screenshotBase64`, proof of what it saw
- `steps`, the actions it took

Webhands uses a conservative confirmation gate. Only `waitFor` and a redundant
`goto` to the recipe's canonical entry URL are considered provably read-only.
Typing, every click, and navigation to any other path or query are **refused
unless the request includes `confirm: true`**. The legacy `write` field remains
accepted for recipe compatibility, but `write: false` does not bypass the gate.

## Modes

- **live**, when the `BROWSER` binding is present (Workers plan with Browser
  Rendering enabled).
- **dry**, without the binding, returns the plan it *would* run. Lets you build
  and test recipes without a paid binding.

## Run

```bash
npm install
cp .dev.vars.example .dev.vars   # set WEBHANDS_TOKEN, optional ANTHROPIC_API_KEY
npm run dev
npm test                         # guard + limiter unit tests
npm run test:confirmation       # conservative confirmation behavior
npm run deploy                   # Cloudflare Workers (workers.dev URL)
```

## Safety

- `/run` requires `x-webhands-token`. Every recipe URL (entry + `goto`
  steps) must be http(s); loopback, metadata, and private-range hosts are
  always refused. Set `ALLOWED_HOSTS` to restrict browsing to your portals.
- Per-IP hourly caps: `RATE_LIMIT_RUNS_PER_HOUR` (default 30),
  `RATE_LIMIT_DEMO_PER_HOUR` (20), `RATE_LIMIT_AI_PER_HOUR` (60).
- Writes are refused without `confirm: true`, and secrets never reach the run log.

## Example: pull this week's orders from a no-API dashboard

```bash
curl -s "$URL/run" -H "x-webhands-token: $WEBHANDS_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "confirm": true,
    "recipe": {
      "url": "https://seller.example.com/login",
      "steps": [
        { "action": "type", "selector": "#email", "text": "ops@brand.com" },
        { "action": "type", "selector": "#password", "text": "...", "secret": true },
        { "action": "click", "selector": "#signin" },
        { "action": "waitFor", "selector": ".orders-table" },
        { "action": "goto", "url": "https://seller.example.com/orders?range=7d" }
      ],
      "extract": { "prompt": "Return JSON: [{orderId, total, status, date}] for every order row" }
    }
  }'
```

An interactive recipe returns an error until you resend it with
`"confirm": true`. Recipes containing only waits and redundant entry-URL
navigation can run without confirmation.
