"use client";
import { generateId } from "@/lib/uuid";

import { useState } from "react";
import { useStore } from "@/lib/store";
import type { TargetConfig } from "@/lib/types";
import { PROVIDER_PRESETS } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  Settings,
  Wifi,
  WifiOff,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Pencil,
  X,
  Download,
  Brain,
} from "lucide-react";

type Provider = TargetConfig["provider"];

export function TargetConfig() {
  const { targets, addTarget, removeTarget, updateTarget, setActiveTarget, setView, redTeamConfig, setRedTeamConfig, updateRedTeamConfig } =
    useStore();

  const [name, setName] = useState("");
  const [provider, setProvider] = useState<Provider>("openai");
  const [endpoint, setEndpoint] = useState(PROVIDER_PRESETS.openai.endpoint);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latency?: number;
    error?: string;
  } | null>(null);

  // Model fetching state
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [modelInputMode, setModelInputMode] = useState<"select" | "manual">("select");

  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [forceApiKeyInput, setForceApiKeyInput] = useState(false);

  // Red Team LLM form state
  const [rtProvider, setRtProvider] = useState<Provider>(redTeamConfig?.provider || "openai");
  const [rtEndpoint, setRtEndpoint] = useState(redTeamConfig?.endpoint || PROVIDER_PRESETS.openai.endpoint);
  const [rtApiKey, setRtApiKey] = useState("");
  const [rtModel, setRtModel] = useState(redTeamConfig?.model || "");
  const [rtTesting, setRtTesting] = useState(false);
  const [rtTestResult, setRtTestResult] = useState<{ success: boolean; latency?: number; error?: string } | null>(null);
  const [rtFetchedModels, setRtFetchedModels] = useState<string[]>([]);
  const [rtFetchingModels, setRtFetchingModels] = useState(false);
  const [rtFetchError, setRtFetchError] = useState<string | null>(null);
  const [rtModelInputMode, setRtModelInputMode] = useState<"select" | "manual">("select");
  const [rtEditing, setRtEditing] = useState(false);
  const [forceRtApiKeyInput, setForceRtApiKeyInput] = useState(false);

  const handleProviderChange = (value: string) => {
    const p = value as Provider;
    setProvider(p);
    setEndpoint(PROVIDER_PRESETS[p].endpoint);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setModel("");
    setModelInputMode("select");
  };

  const fetchModels = async () => {
    // Need either a typed key or an existing vault key
    const editTarget = editingId ? targets.find(t => t.id === editingId) : null;
    const hasVaultKey = editTarget?.apiKeyId;
    if (!apiKey.trim() && !hasVaultKey) return;

    setIsFetchingModels(true);
    setFetchError(null);

    try {
      const keyFields = apiKey.trim()
        ? { apiKey }
        : hasVaultKey ? { apiKeyId: editTarget.apiKeyId } : { apiKey };
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, ...keyFields, provider }),
      });

      const data = await res.json();

      if (data.error) {
        setFetchError(data.error);
        setFetchedModels([]);
        setModelInputMode("manual");
      } else if (data.models.length === 0) {
        setModelInputMode("manual");
        setFetchedModels([]);
      } else {
        setFetchedModels(data.models);
        setModelInputMode("select");
      }
    } catch {
      setFetchError("Failed to fetch models");
      setModelInputMode("manual");
    } finally {
      setIsFetchingModels(false);
    }
  };

  const testConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const editTarget = editingId ? targets.find(t => t.id === editingId) : null;
      const hasVaultKey = editTarget?.apiKeyId;
      const keyFields = apiKey.trim()
        ? { apiKey }
        : hasVaultKey
          ? { apiKeyId: editTarget.apiKeyId }
          : provider === "custom"
            ? {}
            : { apiKey };
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint, ...keyFields, model, provider }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, error: "Network error" });
    } finally {
      setIsTesting(false);
    }
  };

  const resetForm = () => {
    setName("");
    setApiKey("");
    setModel("");
    setProvider("openai");
    setEndpoint(PROVIDER_PRESETS.openai.endpoint);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setEditingId(null);
    setForceApiKeyInput(false);
    setModelInputMode("select");
  };

  const saveTarget = async () => {
    if (!name.trim() || !endpoint.trim() || !model.trim()) return;
    if (provider !== "custom" && !apiKey.trim() && !hasExistingVaultKey) return;

    // Store key in server-side vault (only if a new key was entered)
    let apiKeyId: string | undefined;
    let apiKeyLabel: string | undefined;
    if (apiKey.trim()) {
      try {
        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: apiKey.trim() }),
        });
        const data = await res.json();
        if (data.keyId) {
          apiKeyId = data.keyId;
          apiKeyLabel = data.label;
        }
      } catch {
        // Vault unavailable — fall back to legacy storage (apiKey in memory only)
      }
    } else if (hasExistingVaultKey) {
      // Keep existing vault key
      apiKeyId = editTarget!.apiKeyId;
      apiKeyLabel = editTarget!.apiKeyLabel;
    }

    if (editingId) {
      updateTarget(editingId, {
        name: name.trim(),
        endpoint: endpoint.trim(),
        apiKeyId,
        apiKeyLabel,
        apiKey: apiKey.trim() || editTarget?.apiKey, // keep plaintext in-memory fallback for volatile vault/dev restarts
        model: model.trim(),
        provider,
        connected: testResult?.success ?? false,
      });
      resetForm();
    } else {
      const target: TargetConfig = {
        id: generateId(),
        name: name.trim(),
        endpoint: endpoint.trim(),
        apiKeyId,
        apiKeyLabel,
        apiKey: apiKey.trim(),
        model: model.trim(),
        provider,
        connected: testResult?.success ?? false,
      };

      addTarget(target);
      setActiveTarget(target.id);
      resetForm();
    }
  };

  const startEditing = (target: TargetConfig) => {
    setEditingId(target.id);
    setName(target.name);
    setProvider(target.provider);
    setEndpoint(target.endpoint);
    setApiKey(target.apiKey || ""); // Will be empty if vault-stored
    setModel(target.model);
    setTestResult(null);
    setFetchedModels([]);
    setFetchError(null);
    setModelInputMode("manual");
    setForceApiKeyInput(false);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const editTarget = editingId ? targets.find(t => t.id === editingId) : null;
  const hasExistingVaultKey = !!(editTarget?.apiKeyId);
  const canSave =
    !!name.trim() &&
    !!endpoint.trim() &&
    !!model.trim() &&
    (provider === "custom" || !!apiKey.trim() || hasExistingVaultKey);

  // Red Team helpers
  const rtHasVaultKey = !!(redTeamConfig?.apiKeyId);
  const rtCanSave =
    !!rtEndpoint.trim() &&
    !!rtModel.trim() &&
    (rtProvider === "custom" || !!rtApiKey.trim() || rtHasVaultKey);

  const handleRtProviderChange = (value: string) => {
    const p = value as Provider;
    setRtProvider(p);
    setRtEndpoint(PROVIDER_PRESETS[p].endpoint);
    setRtTestResult(null);
    setRtFetchedModels([]);
    setRtFetchError(null);
    setRtModel("");
    setRtModelInputMode("select");
  };

  const fetchRtModels = async () => {
    if (!rtApiKey.trim() && !rtHasVaultKey) return;
    setRtFetchingModels(true);
    setRtFetchError(null);
    try {
      const keyFields = rtApiKey.trim()
        ? { apiKey: rtApiKey }
        : rtHasVaultKey
          ? { apiKeyId: redTeamConfig!.apiKeyId }
          : rtProvider === "custom"
            ? {}
            : { apiKey: rtApiKey };
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: rtEndpoint, ...keyFields, provider: rtProvider }),
      });
      const data = await res.json();
      if (data.error) {
        setRtFetchError(data.error);
        setRtFetchedModels([]);
        setRtModelInputMode("manual");
      } else if (data.models.length === 0) {
        setRtModelInputMode("manual");
        setRtFetchedModels([]);
      } else {
        setRtFetchedModels(data.models);
        setRtModelInputMode("select");
      }
    } catch {
      setRtFetchError("Failed to fetch models");
      setRtModelInputMode("manual");
    } finally {
      setRtFetchingModels(false);
    }
  };

  const testRtConnection = async () => {
    setRtTesting(true);
    setRtTestResult(null);
    try {
      const keyFields = rtApiKey.trim()
        ? { apiKey: rtApiKey }
        : rtHasVaultKey
          ? { apiKeyId: redTeamConfig!.apiKeyId }
          : rtProvider === "custom"
            ? {}
            : { apiKey: rtApiKey };
      const res = await fetch("/api/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: rtEndpoint, ...keyFields, model: rtModel, provider: rtProvider }),
      });
      const data = await res.json();
      setRtTestResult(data);
    } catch {
      setRtTestResult({ success: false, error: "Network error" });
    } finally {
      setRtTesting(false);
    }
  };

  const saveRedTeam = async () => {
    if (!rtCanSave) return;
    let apiKeyId: string | undefined;
    let apiKeyLabel: string | undefined;
    if (rtApiKey.trim()) {
      try {
        const res = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apiKey: rtApiKey.trim() }),
        });
        const data = await res.json();
        if (data.keyId) {
          apiKeyId = data.keyId;
          apiKeyLabel = data.label;
        }
      } catch {
        // Vault unavailable — fall back to legacy
      }
    } else if (rtHasVaultKey) {
      apiKeyId = redTeamConfig!.apiKeyId;
      apiKeyLabel = redTeamConfig!.apiKeyLabel;
    }

    const config: TargetConfig = {
      id: redTeamConfig?.id || generateId(),
      name: "Red Team LLM",
      endpoint: rtEndpoint.trim(),
      apiKeyId,
      apiKeyLabel,
      apiKey: rtApiKey.trim() || redTeamConfig?.apiKey,
      model: rtModel.trim(),
      provider: rtProvider,
      connected: rtTestResult?.success ?? false,
    };
    setRedTeamConfig(config);
    setRtEditing(false);
    setForceRtApiKeyInput(false);
    setRtApiKey("");
  };

  const startEditingRedTeam = () => {
    if (redTeamConfig) {
      setRtProvider(redTeamConfig.provider);
      setRtEndpoint(redTeamConfig.endpoint);
      setRtApiKey("");
      setRtModel(redTeamConfig.model);
      setRtTestResult(null);
      setRtFetchedModels([]);
      setRtFetchError(null);
      setRtModelInputMode("manual");
      setForceRtApiKeyInput(false);
    }
    setRtEditing(true);
  };

  const removeRedTeam = () => {
    setRedTeamConfig(null);
    setRtProvider("openai");
    setRtEndpoint(PROVIDER_PRESETS.openai.endpoint);
    setRtApiKey("");
    setRtModel("");
    setRtTestResult(null);
    setForceRtApiKeyInput(false);
    setRtEditing(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Settings className="h-6 w-6 text-redpincer" />
          Target Configuration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure an AI/LLM endpoint to test against.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {editingId ? "Edit Target" : "New Target"}
          </CardTitle>
          <CardDescription>
            {editingId
              ? "Update connection details for this target."
              : "Set up connection details for the target LLM endpoint."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Target Name */}
          <div className="space-y-2">
            <Label htmlFor="target-name">Target Name</Label>
            <Input
              id="target-name"
              placeholder="e.g., Production GPT-4o"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background"
            />
          </div>

          {/* Provider */}
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={handleProviderChange}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="openrouter">OpenRouter</SelectItem>
                <SelectItem value="xai">xAI</SelectItem>
                <SelectItem value="kimi">Kimi Code</SelectItem>
                <SelectItem value="nous">Nous</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endpoint */}
          <div className="space-y-2">
            <Label htmlFor="endpoint">API Endpoint</Label>
            <Input
              id="endpoint"
              placeholder="https://api.example.com/v1/chat/completions"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="bg-background font-mono text-sm"
            />
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            {editingId && targets.find(t => t.id === editingId)?.apiKeyId && !apiKey.trim() && !forceApiKeyInput ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-muted-foreground">
                  🔒 {targets.find(t => t.id === editingId)?.apiKeyLabel || "Stored securely"}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setForceApiKeyInput(true);
                    setApiKey("");
                  }}
                  className="h-9 px-3 text-xs"
                >
                  Change
                </Button>
              </div>
            ) : (
              <Input
                id="api-key"
                type="password"
                placeholder={editingId && targets.find(t => t.id === editingId)?.apiKeyId
                  ? "Enter new key to replace stored key"
                  : PROVIDER_PRESETS[provider].placeholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-background font-mono text-sm"
              />
            )}
          </div>

          {/* Model */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="model">Model</Label>
              <div className="flex items-center gap-2">
                {provider !== "custom" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchModels}
                    disabled={(!apiKey.trim() && !hasExistingVaultKey) || isFetchingModels}
                    className="h-7 gap-1.5 px-2 text-xs"
                  >
                    {isFetchingModels ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="h-3 w-3" />
                        Fetch Models
                      </>
                    )}
                  </Button>
                )}
                {fetchedModels.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setModelInputMode(
                        modelInputMode === "select" ? "manual" : "select"
                      )
                    }
                    className="h-7 px-2 text-xs text-muted-foreground"
                  >
                    {modelInputMode === "select"
                      ? "Type manually"
                      : "Use dropdown"}
                  </Button>
                )}
              </div>
            </div>

            {fetchError && (
              <p className="text-xs text-redpincer">{fetchError}</p>
            )}

            {modelInputMode === "select" && fetchedModels.length > 0 ? (
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="w-full bg-background font-mono text-sm">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {fetchedModels.map((m) => (
                    <SelectItem key={m} value={m} className="font-mono text-sm">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="model"
                placeholder="e.g., gpt-4o, claude-sonnet-4-20250514, etc."
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="bg-background font-mono text-sm"
              />
            )}
          </div>

          <Separator />

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={testConnection}
              disabled={
                !endpoint.trim() ||
                !model.trim() ||
                (provider !== "custom" && !apiKey.trim() && !hasExistingVaultKey) ||
                isTesting
              }
              className="gap-2"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Wifi className="h-4 w-4" />
                  Test Connection
                </>
              )}
            </Button>

            {testResult && (
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span className="text-sm text-success">
                      Connected ({testResult.latency}ms)
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-redpincer" />
                    <span className="text-sm text-redpincer">
                      {testResult.error || "Connection failed"}
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          <Separator />

          {/* Save / Update / Cancel */}
          <div className="flex gap-2">
            <Button
              onClick={saveTarget}
              disabled={!canSave}
              className="flex-1 gap-2 bg-redpincer font-semibold text-redpincer-foreground hover:bg-redpincer/90"
            >
              <Target className="h-4 w-4" />
              {editingId ? "Update Target" : "Save Target"}
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={cancelEdit}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Saved Targets List */}
      {targets.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-lg">Saved Targets</CardTitle>
            <CardDescription>
              {targets.length} target{targets.length !== 1 ? "s" : ""} configured
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {targets.map((target) => (
                <div
                  key={target.id}
                  className={`flex items-center justify-between rounded-lg border p-3 ${
                    editingId === target.id
                      ? "border-redpincer bg-redpincer/5"
                      : "border-border bg-background"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-block h-2.5 w-2.5 rounded-full ${
                        target.connected ? "bg-success" : "bg-muted-foreground"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium">{target.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {target.model} &middot; {target.provider}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={target.connected ? "default" : "secondary"}
                      className={
                        target.connected
                          ? "bg-success/20 text-success"
                          : "bg-muted text-muted-foreground"
                      }
                    >
                      {target.connected ? "Connected" : "Untested"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(target)}
                      disabled={editingId === target.id}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeTarget(target.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-redpincer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Red Team LLM Config */}
      <Card className="border-lobster/30 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-lobster" />
            Red Team LLM
          </CardTitle>
          <CardDescription>
            AI model used for payload generation, adaptive attacks, explanations, and summaries.
            This is separate from the target being tested.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {redTeamConfig && !rtEditing ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${redTeamConfig.connected ? "bg-success" : "bg-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">{redTeamConfig.model}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {redTeamConfig.provider} &middot; {redTeamConfig.apiKeyLabel || "key set"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={redTeamConfig.connected ? "default" : "secondary"} className={redTeamConfig.connected ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}>
                    {redTeamConfig.connected ? "Connected" : "Untested"}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={startEditingRedTeam} className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={removeRedTeam} className="h-8 w-8 p-0 text-muted-foreground hover:text-redpincer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Provider */}
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={rtProvider} onValueChange={handleRtProviderChange}>
                  <SelectTrigger className="w-full bg-background">
                    <SelectValue placeholder="Select a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="openrouter">OpenRouter</SelectItem>
                    <SelectItem value="xai">xAI</SelectItem>
                    <SelectItem value="kimi">Kimi Code</SelectItem>
                    <SelectItem value="nous">Nous</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Endpoint */}
              <div className="space-y-2">
                <Label htmlFor="rt-endpoint">API Endpoint</Label>
                <Input
                  id="rt-endpoint"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={rtEndpoint}
                  onChange={(e) => setRtEndpoint(e.target.value)}
                  className="bg-background font-mono text-sm"
                />
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <Label htmlFor="rt-api-key">API Key</Label>
                {rtEditing && redTeamConfig?.apiKeyId && !rtApiKey.trim() && !forceRtApiKeyInput ? (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-md border border-border bg-background px-3 py-2 font-mono text-sm text-muted-foreground">
                      🔒 {redTeamConfig.apiKeyLabel || "Stored securely"}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setForceRtApiKeyInput(true);
                        setRtApiKey("");
                      }}
                      className="h-9 px-3 text-xs"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <Input
                    id="rt-api-key"
                    type="password"
                    placeholder={rtEditing && redTeamConfig?.apiKeyId ? "Enter new key to replace stored key" : PROVIDER_PRESETS[rtProvider].placeholder}
                    value={rtApiKey}
                    onChange={(e) => setRtApiKey(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                )}
              </div>

              {/* Model */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rt-model">Model</Label>
                  <div className="flex items-center gap-2">
                    {rtProvider !== "custom" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchRtModels}
                        disabled={(!rtApiKey.trim() && !rtHasVaultKey) || rtFetchingModels}
                        className="h-7 gap-1.5 px-2 text-xs"
                      >
                        {rtFetchingModels ? (
                          <><Loader2 className="h-3 w-3 animate-spin" />Fetching...</>
                        ) : (
                          <><Download className="h-3 w-3" />Fetch Models</>
                        )}
                      </Button>
                    )}
                    {rtFetchedModels.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRtModelInputMode(rtModelInputMode === "select" ? "manual" : "select")}
                        className="h-7 px-2 text-xs text-muted-foreground"
                      >
                        {rtModelInputMode === "select" ? "Type manually" : "Use dropdown"}
                      </Button>
                    )}
                  </div>
                </div>

                {rtFetchError && <p className="text-xs text-redpincer">{rtFetchError}</p>}

                {rtModelInputMode === "select" && rtFetchedModels.length > 0 ? (
                  <Select value={rtModel} onValueChange={setRtModel}>
                    <SelectTrigger className="w-full bg-background font-mono text-sm">
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {rtFetchedModels.map((m) => (
                        <SelectItem key={m} value={m} className="font-mono text-sm">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="rt-model"
                    placeholder="e.g., gpt-4o, claude-sonnet-4-20250514"
                    value={rtModel}
                    onChange={(e) => setRtModel(e.target.value)}
                    className="bg-background font-mono text-sm"
                  />
                )}
              </div>

              <Separator />

              {/* Test Connection */}
              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={testRtConnection} disabled={!rtEndpoint.trim() || !rtModel.trim() || (rtProvider !== "custom" && !rtApiKey.trim() && !rtHasVaultKey) || rtTesting} className="gap-2">
                  {rtTesting ? (<><Loader2 className="h-4 w-4 animate-spin" />Testing...</>) : (<><Wifi className="h-4 w-4" />Test Connection</>)}
                </Button>
                {rtTestResult && (
                  <div className="flex items-center gap-2">
                    {rtTestResult.success ? (
                      <><CheckCircle className="h-4 w-4 text-success" /><span className="text-sm text-success">Connected ({rtTestResult.latency}ms)</span></>
                    ) : (
                      <><XCircle className="h-4 w-4 text-redpincer" /><span className="text-sm text-redpincer">{rtTestResult.error || "Connection failed"}</span></>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <Button
                  onClick={saveRedTeam}
                  disabled={!rtCanSave}
                  className="flex-1 gap-2 bg-lobster font-semibold text-white hover:bg-lobster/90"
                >
                  <Brain className="h-4 w-4" />
                  {rtEditing ? "Update Red Team LLM" : "Save Red Team LLM"}
                </Button>
                {rtEditing && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForceRtApiKeyInput(false);
                      setRtEditing(false);
                    }}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
