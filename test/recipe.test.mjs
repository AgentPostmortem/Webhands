import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(
  new URL("../src/recipe.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
  fileName: "src/recipe.ts",
  reportDiagnostics: true,
});
assert.equal(compiled.diagnostics?.length ?? 0, 0);

const moduleUrl = `data:text/javascript;base64,${Buffer.from(
  compiled.outputText,
).toString("base64")}`;
const { hasWriteStep } = await import(moduleUrl);

const entryUrl = "https://dashboard.example.com";

test("requires confirmation unless every recipe step is provably read-only", async (t) => {
  const cases = [
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
    await t.test(scenario.name, () => {
      assert.equal(
        hasWriteStep({ url: entryUrl, steps: scenario.steps }),
        scenario.expected,
      );
    });
  }
});
