// A recipe describes how to operate a dashboard that has no usable API.
// Read recipes pull structured data. Only waits and redundant navigation to the
// entry URL are provably read-only; every other interaction needs confirmation.

export type Step =
  | { action: "goto"; url: string }
  | { action: "type"; selector: string; text: string; secret?: boolean }
  // `write` is retained for recipe compatibility; all clicks are gated.
  | { action: "click"; selector: string; write?: boolean }
  | { action: "waitFor"; selector: string; timeoutMs?: number };

export interface Recipe {
  // Entry URL (a goto is implied if steps don't start with one).
  url: string;
  // Optional login / navigation steps before extraction.
  steps?: Step[];
  // How to turn the final page into structured data:
  //  - prompt: hand the page text to Claude and ask for JSON matching this ask
  //  - fields: scrape these CSS selectors directly (no model needed)
  extract?: {
    prompt?: string;
    fields?: Array<{ name: string; selector: string; attr?: string }>;
  };
}

export interface RunRequest {
  recipe: Recipe;
  // Must be true to allow typing, clicking, or navigation away from recipe.url.
  confirm?: boolean;
}

export function hasWriteStep(recipe: Recipe): boolean {
  return (recipe.steps ?? []).some((step) => {
    switch (step.action) {
      case "waitFor":
        return false;
      case "goto":
        return !isSameUrl(step.url, recipe.url);
      case "type":
      case "click":
        return true;
    }
  });
}

function isSameUrl(candidate: string, entry: string): boolean {
  try {
    return new URL(candidate).href === new URL(entry).href;
  } catch {
    // Invalid URLs cannot reach the browser successfully. Treat only an exact
    // duplicate as redundant; every other value remains confirmation-required.
    return candidate === entry;
  }
}
