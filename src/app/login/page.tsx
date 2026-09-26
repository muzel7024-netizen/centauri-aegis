"use client";

import { useState, Suspense, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { CentauriAegisLogo } from "@/components/ui/logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        router.push(redirect);
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error — could not reach server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-[3px] border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive font-mono">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="username"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
        >
          Operator Identifier
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          autoFocus
          className="flex h-9 w-full rounded-[3px] border border-input bg-card px-3 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
          placeholder="username"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="text-xs font-mono uppercase tracking-wider text-muted-foreground"
        >
          Security Passphrase
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="flex h-9 w-full rounded-[3px] border border-input bg-card px-3 py-1 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none transition-colors"
          placeholder="••••••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !username || !password}
        className="inline-flex h-9 w-full items-center justify-center rounded-[3px] bg-primary px-4 py-2 text-xs font-sans font-medium text-primary-foreground tracking-wide transition-colors hover:bg-[#2A2D2B] dark:hover:bg-[#D0D1D3] disabled:pointer-events-none disabled:opacity-40 shadow-none mt-2"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
            Authenticating...
          </>
        ) : (
          "Authenticate to Console"
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-5">
        {/* Header */}
        <div className="text-center space-y-2.5">
          <div className="flex justify-center">
            <CentauriAegisLogo size={36} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wider text-foreground font-mono uppercase">
              Centauri Aegis
            </h1>
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
              AI Security Testing Console
            </p>
          </div>
        </div>

        {/* Form wrapped in Suspense for useSearchParams */}
        <div className="rounded-[4px] border border-border bg-card p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
          <Suspense
            fallback={
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="text-center text-[11px] font-mono text-muted-foreground">
          Console credentials configured via <code className="text-[10px] font-mono text-foreground">AEGIS_USERNAME</code>{" "}
          and <code className="text-[10px] font-mono text-foreground">AEGIS_PASSWORD</code>.
        </p>
      </div>
    </div>
  );
}
