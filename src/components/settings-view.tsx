"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import {
  STORAGE_KEY,
  SESSION_VERSION,
  getStorageSizeBytes,
  formatBytes,
  clearStorage,
} from "@/lib/persistence";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Lock,
  Database,
  Sliders,
  Server,
  Trash2,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

export function SettingsView() {
  const { concurrency, setConcurrency } = useStore();
  const [storageBytes, setStorageBytes] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return getStorageSizeBytes();
  });
  const [confirmClear, setConfirmClear] = useState(false);

  const handleClearData = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    clearStorage();
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("centauri-aegis-rubrics");
    localStorage.removeItem("centauri-aegis-custom-payloads");
    toast.success("All local storage state has been reset.");
    setStorageBytes(0);
    setConfirmClear(false);
    setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="flex-1 space-y-6 p-8 max-w-5xl">
      {/* Header */}
      <div className="border-b border-border/60 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-foreground font-mono">
          SYSTEM <span className="text-aegis">SETTINGS</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure security guards, execution parameters, storage namespaces, and environment policies.
        </p>
      </div>

      <div className="grid gap-6">
        {/* Security & SSRF Protection */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Network & Endpoint Security Guard (SSRF Protection)
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Hardened transport controls protecting against Server-Side Request Forgery and unauthorized internal network pivot.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Cloud Metadata (IMDS)</span>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                    BLOCKED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Requests targeting <code className="text-primary font-mono">169.254.169.254</code> and link-local metadata endpoints are unconditionally forbidden.
                </p>
              </div>

              <div className="rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">Local & Private Subnets</span>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
                    POLICY CONTROLLED
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Localhost and RFC 1918 subnets are restricted in production unless enabled via <code className="text-primary font-mono">AEGIS_ALLOW_PRIVATE_TARGETS=true</code>.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-background/50 p-3.5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <Lock className="h-3.5 w-3.5 text-primary" />
                In-Memory Server-Side Key Vault
              </div>
              <p className="text-xs text-muted-foreground">
                Target API credentials are never written to client-side localStorage in plaintext. Only ephemeral cryptographic handles are transmitted to the browser. Ephemeral process-bound entropy secures stored credentials on the server.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Execution & Concurrency */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Execution & Concurrency Controls
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Calibrate attack dispatcher throughput and connection pools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/50 p-4">
              <div className="space-y-0.5">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Default Attack Dispatch Concurrency
                </label>
                <p className="text-xs text-muted-foreground">
                  Number of simultaneous LLM payload requests sent to the target endpoint (1–10).
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value, 10))}
                  className="h-2 w-32 cursor-pointer accent-aegis bg-secondary rounded-lg"
                />
                <span className="w-8 text-center font-mono text-sm font-bold text-foreground">
                  {concurrency}x
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Storage & State Namespace */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Client State & Storage Namespace
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Manage client-side cache, persistence keys, and offline state.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Canonical Storage Key</span>
                <div className="font-mono text-xs font-semibold text-primary mt-1">
                  {STORAGE_KEY}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Session Schema</span>
                <div className="font-mono text-xs font-semibold text-foreground mt-1">
                  v{SESSION_VERSION}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/50 p-3">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Storage Consumed</span>
                <div className="font-mono text-xs font-semibold text-foreground mt-1">
                  {formatBytes(storageBytes)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <p className="text-xs text-muted-foreground">
                  Automatic migration is active for backwards compatibility with legacy session namespaces.
                </p>
              </div>
              <Button
                variant={confirmClear ? "destructive" : "outline"}
                size="sm"
                onClick={handleClearData}
                className="gap-2 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmClear ? "Confirm Permanent Reset" : "Reset Local Storage"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Environment Variable Directory */}
        <Card className="border-border/60 bg-card/60">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Environment Configuration Reference
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              Primary configuration variables recognized by the Centauri Aegis engine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Variable</th>
                    <th className="pb-2 font-medium">Description</th>
                    <th className="pb-2 font-medium">Default</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  <tr>
                    <td className="py-2 text-primary">AEGIS_AUTH_ENABLED</td>
                    <td className="py-2 font-sans text-muted-foreground">Enforces password authentication on console</td>
                    <td className="py-2">false</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-primary">AEGIS_PASSWORD_HASH</td>
                    <td className="py-2 font-sans text-muted-foreground">SHA-256 hash of administrator console password</td>
                    <td className="py-2">None</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-primary">AEGIS_ALLOW_PRIVATE_TARGETS</td>
                    <td className="py-2 font-sans text-muted-foreground">Allows targeting localhost / RFC 1918 addresses in production</td>
                    <td className="py-2">false</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-primary">AEGIS_TRUSTED_PROXY</td>
                    <td className="py-2 font-sans text-muted-foreground">Trusts X-Forwarded-For headers behind reverse proxies</td>
                    <td className="py-2">false</td>
                  </tr>
                  <tr>
                    <td className="py-2 text-primary">AEGIS_KEY_SECRET</td>
                    <td className="py-2 font-sans text-muted-foreground">Static encryption key for persistent key vault instances</td>
                    <td className="py-2">Random byte entropy</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
