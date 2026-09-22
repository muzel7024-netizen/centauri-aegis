import { describe, it, expect } from "vitest";
import {
  transformResponse,
  resolveTemplate,
  builtinChains,
  getChainById,
} from "../chains";
import type { AttackChain } from "../chains";

// ── transformResponse ────────────────────────────────────────────────────────

describe("transformResponse", () => {
  const raw = `Here is some text.

\`\`\`json
{"key": "value", "nested": {"a": 1}}
\`\`\`

More text.

\`\`\`python
def hello():
    print("world")
\`\`\`

Final paragraph with a conclusion.`;

  it("returns raw text for 'full' mode", () => {
    expect(transformResponse(raw, "full")).toBe(raw);
  });

  it("returns raw text when mode is undefined", () => {
    expect(transformResponse(raw, undefined)).toBe(raw);
  });

  it("extracts JSON from a code block", () => {
    const result = transformResponse(raw, "extract_json");
    expect(result).toBe('{"key": "value", "nested": {"a": 1}}');
  });

  it("extracts JSON from raw object when no code block", () => {
    const noBlock = 'Some preamble {"data": 42} trailing';
    const result = transformResponse(noBlock, "extract_json");
    expect(result).toBe('{"data": 42}');
  });

  it("returns raw if no JSON found", () => {
    const plain = "No JSON here at all";
    expect(transformResponse(plain, "extract_json")).toBe(plain);
  });

  it("extracts code from a code block", () => {
    const result = transformResponse(raw, "extract_code");
    expect(result).toBe('{"key": "value", "nested": {"a": 1}}');
  });

  it("returns raw if no code block found", () => {
    const plain = "No code blocks here";
    expect(transformResponse(plain, "extract_code")).toBe(plain);
  });

  it("extracts the first non-empty line", () => {
    const multiline = "\n\n  First real line\nSecond line";
    expect(transformResponse(multiline, "first_line")).toBe("  First real line");
  });

  it("extracts first line from single-line input", () => {
    expect(transformResponse("Just one line", "first_line")).toBe("Just one line");
  });

  it("extracts the last paragraph", () => {
    const result = transformResponse(raw, "last_paragraph");
    expect(result).toBe("Final paragraph with a conclusion.");
  });

  it("returns raw if only one paragraph", () => {
    const single = "Just a single paragraph with no breaks.";
    expect(transformResponse(single, "last_paragraph")).toBe(single);
  });

  it("handles empty string gracefully", () => {
    expect(transformResponse("", "first_line")).toBe("");
    expect(transformResponse("", "extract_json")).toBe("");
    expect(transformResponse("", "extract_code")).toBe("");
  });
});

// ── resolveTemplate ──────────────────────────────────────────────────────────

describe("resolveTemplate", () => {
  it("replaces {{previous_response}} placeholder", () => {
    const result = resolveTemplate(
      "Based on: {{previous_response}}, continue.",
      new Map(),
      "the prior answer",
    );
    expect(result).toBe("Based on: the prior answer, continue.");
  });

  it("replaces multiple {{previous_response}} occurrences", () => {
    const result = resolveTemplate(
      "A: {{previous_response}} B: {{previous_response}}",
      new Map(),
      "resp",
    );
    expect(result).toBe("A: resp B: resp");
  });

  it("leaves {{previous_response}} unchanged when no previous response", () => {
    const result = resolveTemplate(
      "Text: {{previous_response}}",
      new Map(),
      undefined,
    );
    expect(result).toBe("Text: {{previous_response}}");
  });

  it("replaces {{step:id}} placeholders from stepResults map", () => {
    const stepResults = new Map([
      ["step-1", "result from step 1"],
      ["step-2", "result from step 2"],
    ]);
    const result = resolveTemplate(
      "Step 1 said: {{step:step-1}}. Step 2 said: {{step:step-2}}.",
      stepResults,
    );
    expect(result).toBe(
      "Step 1 said: result from step 1. Step 2 said: result from step 2.",
    );
  });

  it("leaves unknown {{step:id}} placeholders intact", () => {
    const result = resolveTemplate(
      "Unknown: {{step:nonexistent}}",
      new Map(),
    );
    expect(result).toBe("Unknown: {{step:nonexistent}}");
  });

  it("handles step IDs with leading/trailing spaces", () => {
    const stepResults = new Map([["abc", "found"]]);
    const result = resolveTemplate("{{step: abc }}", stepResults);
    expect(result).toBe("found");
  });

  it("combines previous_response and step references", () => {
    const stepResults = new Map([["s1", "step-one-result"]]);
    const result = resolveTemplate(
      "Prev: {{previous_response}}, S1: {{step:s1}}",
      stepResults,
      "prev-result",
    );
    expect(result).toBe("Prev: prev-result, S1: step-one-result");
  });

  it("handles empty string replacement values", () => {
    const stepResults = new Map([["s1", ""]]);
    const result = resolveTemplate("Before {{step:s1}} After", stepResults);
    expect(result).toBe("Before  After");
  });
});

// ── Built-in Chains ──────────────────────────────────────────────────────────

describe("builtinChains", () => {
  it("has at least 3 built-in chains", () => {
    expect(builtinChains.length).toBeGreaterThanOrEqual(3);
  });

  it("each chain has a unique id", () => {
    const ids = builtinChains.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each chain has non-empty name and description", () => {
    for (const chain of builtinChains) {
      expect(chain.name.length).toBeGreaterThan(0);
      expect(chain.description.length).toBeGreaterThan(0);
    }
  });

  it("each chain has steps in sequential order", () => {
    for (const chain of builtinChains) {
      expect(chain.steps.length).toBeGreaterThanOrEqual(2);
      for (let i = 0; i < chain.steps.length; i++) {
        expect(chain.steps[i].order).toBe(i + 1);
      }
    }
  });

  it("each step has a unique id within its chain", () => {
    for (const chain of builtinChains) {
      const stepIds = chain.steps.map((s) => s.id);
      expect(new Set(stepIds).size).toBe(stepIds.length);
    }
  });

  it("useResponseFrom references valid step IDs within the same chain", () => {
    for (const chain of builtinChains) {
      const stepIds = new Set(chain.steps.map((s) => s.id));
      for (const step of chain.steps) {
        if (step.useResponseFrom) {
          expect(stepIds.has(step.useResponseFrom)).toBe(true);
        }
      }
    }
  });

  it("useResponseFrom only references earlier steps", () => {
    for (const chain of builtinChains) {
      const stepOrder = new Map(chain.steps.map((s) => [s.id, s.order]));
      for (const step of chain.steps) {
        if (step.useResponseFrom) {
          const refOrder = stepOrder.get(step.useResponseFrom)!;
          expect(refOrder).toBeLessThan(step.order);
        }
      }
    }
  });

  it("all chains have valid category", () => {
    const validCategories = ["injection", "jailbreak", "extraction", "bypass", "tool_abuse", "multi_turn", "encoding"];
    for (const chain of builtinChains) {
      expect(validCategories).toContain(chain.category);
    }
  });

  it("all chains have valid severity", () => {
    const validSeverities = ["critical", "high", "medium", "low"];
    for (const chain of builtinChains) {
      expect(validSeverities).toContain(chain.severity);
    }
  });
});

// ── getChainById ─────────────────────────────────────────────────────────────

describe("getChainById", () => {
  it("returns a chain when it exists", () => {
    const chain = getChainById("chain-ctx-poison");
    expect(chain).toBeDefined();
    expect(chain!.name).toContain("Context Poisoning");
  });

  it("returns undefined for non-existent id", () => {
    expect(getChainById("chain-nonexistent")).toBeUndefined();
  });

  it("can find all built-in chains by their id", () => {
    for (const chain of builtinChains) {
      const found = getChainById(chain.id);
      expect(found).toBe(chain);
    }
  });
});
