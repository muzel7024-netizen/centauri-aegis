"use client";

import { useState, useEffect, useCallback } from "react";

interface AuthStatus {
  authEnabled: boolean;
  authenticated: boolean;
  username?: string;
  loading: boolean;
}

export function useAuth(): AuthStatus & { logout: () => Promise<void> } {
  const [status, setStatus] = useState<AuthStatus>({
    authEnabled: false,
    authenticated: true,
    loading: true,
  });

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data) => {
        setStatus({
          authEnabled: data.authEnabled,
          authenticated: data.authenticated,
          username: data.username,
          loading: false,
        });
      })
      .catch(() => {
        setStatus((s) => ({ ...s, loading: false }));
      });
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }, []);

  return { ...status, logout };
}
