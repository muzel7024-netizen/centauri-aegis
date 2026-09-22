import { describe, expect, it } from "vitest";

import { PROVIDER_PRESETS } from "../types";

describe("provider presets", () => {
  it("includes xAI, Kimi, and Nous providers with default endpoints", () => {
    expect(PROVIDER_PRESETS.xai).toEqual({
      endpoint: "https://api.x.ai/v1/chat/completions",
      placeholder: "xai-...",
    });

    expect(PROVIDER_PRESETS.kimi).toEqual({
      endpoint: "https://api.kimi.com/coding/v1/chat/completions",
      placeholder: "sk-...",
    });

    expect(PROVIDER_PRESETS.nous).toEqual({
      endpoint: "https://inference-api.nousresearch.com/v1/chat/completions",
      placeholder: "sk-...",
    });
  });
});
