// A recipe describes how to operate a dashboard that has no usable API.
// Read recipes pull structured data; any step that mutates state (a "write")
// must be explicitly marked and is refused unless the request carries confirm:true.

export type Step =
  | { action: "goto"; url: string }
  | { action: "type"; selector: string; text: string; secret?: boolean }
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
  // Must be true to allow any step marked write:true to execute.
  confirm?: boolean;
}

export function hasWriteStep(recipe: Recipe): boolean {
  return (recipe.steps ?? []).some((s) => {
    // A click is a write only when the author marks it as such.
    if (s.action === "click" && s.write === true) return true;
    // Typing is always a write: it mutates field/page statearena, submits text
    // (including secrets/credentials) into a live page, so it must go through
    // the confirmation gate like any other write step.
    if (s.action === "type") return true;
    return false;
  });
}
