import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AssessmentRunner } from "@/components/assessment-runner";
import { useStore } from "@/lib/store";
import type { Assessment, TargetConfig } from "@/lib/types";
import { toast } from "sonner";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

describe("AssessmentRunner HTTP Error and State Handling", () => {
  const mockTarget: TargetConfig = {
    id: "target-1",
    name: "Test Target",
    endpoint: "https://api.example.com/v1/chat/completions",
    apiKey: "test-key",
    model: "gpt-4o",
    provider: "openai",
    connected: true,
  };

  const createTestAssessment = (id = "assess-1"): Assessment => ({
    id,
    name: "Test Assessment",
    targetId: "target-1",
    targetName: "Test Target",
    status: "ready",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    configuration: {
      categories: ["injection"],
      payloadSelection: "all",
      includeVariants: false,
      adaptiveEnabled: false,
      evolveEnabled: false,
      concurrency: 1,
    },
    runIds: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
    useStore.setState({
      targets: [mockTarget],
      assessments: [createTestAssessment()],
      runs: [],
      findings: [],
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("handles HTTP 401: marks assessment as failed and does not mark completed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-401");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-401");
      expect(current?.status).toBe("failed");
    });

    expect(toast.error).toHaveBeenCalledWith("Authentication required");
    expect(toast.success).not.toHaveBeenCalled();

    // Verify assessment is NOT completed
    const finalAssessment = useStore.getState().assessments.find((a) => a.id === "assess-401");
    expect(finalAssessment?.status).not.toBe("completed");
  });

  it("handles HTTP 429: shows rate limit toast and marks assessment as failed", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-429");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-429");
      expect(current?.status).toBe("failed");
    });

    expect(toast.error).toHaveBeenCalledWith("Too many requests");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("handles HTTP 403: marks assessment as failed with forbidden toast", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Access forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-403");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-403");
      expect(current?.status).toBe("failed");
    });

    expect(toast.error).toHaveBeenCalledWith("Access forbidden");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("handles HTTP 500 with non-JSON response: marks assessment as failed safely", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response("Internal Server Crash Stack Dump", {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-500");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-500");
      expect(current?.status).toBe("failed");
    });

    expect(toast.error).toHaveBeenCalledWith("Internal server error occurred during assessment (HTTP 500)");
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("handles successful stream: transitions to completed and shows success toast", async () => {
    const metaLine = JSON.stringify({ type: "meta", totalPayloads: 1 }) + "\n";
    const resultLine =
      JSON.stringify({
        id: "probe-1",
        payloadId: "inj-1",
        payloadName: "Prompt Injection Probe",
        category: "injection",
        severity: "high",
        status: "success",
        prompt: "attack prompt",
        response: "attack response",
        timestamp: Date.now(),
        durationMs: 150,
        success: true,
        analysis: {
          classification: "full_jailbreak",
          severityScore: 8,
          confidence: 0.9,
          leakedData: [],
          reasoning: "bypassed",
          indicators: [],
        },
      }) + "\n";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(metaLine));
        controller.enqueue(encoder.encode(resultLine));
        controller.close();
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-success");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-success");
      expect(current?.status).toBe("completed");
    });

    expect(toast.success).toHaveBeenCalledWith("Assessment execution completed");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("handles cancellation gracefully: transitions assessment to stopped", async () => {
    let streamReaderCancelResolve: () => void;
    const cancelPromise = new Promise<void>((resolve) => {
      streamReaderCancelResolve = resolve;
    });

    const stream = new ReadableStream({
      async pull() {
        await cancelPromise;
      },
      cancel() {
        streamReaderCancelResolve();
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const assessment = createTestAssessment("assess-cancel");
    useStore.setState({
      assessments: [assessment],
    });

    render(<AssessmentRunner assessment={assessment} onBack={vi.fn()} autoStart={true} />);

    // Wait until runner starts and displays the Stop button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /stop run/i })).toBeTruthy();
    });

    const stopButton = screen.getByRole("button", { name: /stop run/i });
    act(() => {
      stopButton.click();
    });

    await waitFor(() => {
      const current = useStore.getState().assessments.find((a) => a.id === "assess-cancel");
      expect(current?.status).toBe("stopped");
    });

    expect(toast.info).toHaveBeenCalledWith("Assessment execution stopped");
    expect(toast.success).not.toHaveBeenCalled();
  });
});
