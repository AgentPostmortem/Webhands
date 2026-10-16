import { describe, expect, it } from "vitest";
import { hasWriteStep } from "./recipe";
import type { Step } from "./recipe";

const entryUrl = "https://dashboard.example.com";

describe("hasWriteStep gate (only provably read-only recipes skip confirmation)", () => {
  const cases: Array<{ name: string; steps: Step[]; expected: boolean }> = [
    { name: "no steps", steps: [], expected: false },
    {
      name: "wait for content",
      steps: [{ action: "waitFor", selector: ".orders" }],
      expected: false,
    },
    {
      name: "canonical entry URL",
      steps: [{ action: "goto", url: `${entryUrl}/` }],
      expected: false,
    },
    {
      name: "different path",
      steps: [{ action: "goto", url: `${entryUrl}/orders/123/cancel` }],
      expected: true,
    },
    {
      name: "different query",
      steps: [{ action: "goto", url: `${entryUrl}/?confirm=1` }],
      expected: true,
    },
    {
      name: "typing",
      steps: [{ action: "type", selector: "#search", text: "order 123" }],
      expected: true,
    },
    {
      name: "unlabelled click",
      steps: [{ action: "click", selector: "#cancel" }],
      expected: true,
    },
    {
      name: "click labelled read-only",
      steps: [{ action: "click", selector: "#details", write: false }],
      expected: true,
    },
    {
      name: "click labelled write",
      steps: [{ action: "click", selector: "#confirm", write: true }],
      expected: true,
    },
  ];

  for (const scenario of cases) {
    it(scenario.name, () => {
      expect(hasWriteStep({ url: entryUrl, steps: scenario.steps })).toBe(
        scenario.expected,
      );
    });
  }
});
