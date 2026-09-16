import { afterEach, describe, expect, it, vi } from "vitest";

import worker from "./index";

const env = {
  GROQ_API_KEY: "test-key",
  BROWSER: undefined,
  ALLOWED_HOSTS: "example.com",
  RATE_LIMIT_AI_PER_HOUR: "1000",
} as never;

function postAi(body: unknown): Promise<Response> {
  return worker.fetch(
    new Request("https://webhands.test/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  );
}

describe("/ai output length", () => {
  afterEach(() => vi.restoreAllMocks());

  it("never forwards NaN as max_tokens for a non-numeric max", async () => {
    const groqFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    await postAi({ prompt: "what can you do?", max: "lots" });

    expect(groqFetch).toHaveBeenCalled();
    const body = JSON.parse(String(groqFetch.mock.calls[0][1]?.body));
    expect(Number.isFinite(body.max_tokens)).toBe(true);
    expect(body.max_tokens).toBeGreaterThanOrEqual(32);
    expect(body.max_tokens).toBeLessThanOrEqual(220);
  });

  it("clamps max to the 32..220 range", async () => {
    const groqFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    await postAi({ prompt: "what can you do?", max: 999 });

    const body = JSON.parse(String(groqFetch.mock.calls[0][1]?.body));
    expect(body.max_tokens).toBe(220);
  });
});