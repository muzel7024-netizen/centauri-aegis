"use client";

import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    const order: Array<"dark" | "light" | "system"> = ["dark", "light", "system"];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycle}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground w-full justify-start"
      title={`Theme: ${theme} — click to cycle`}
    >
      {theme === "dark" && <Moon className="h-3.5 w-3.5" />}
      {theme === "light" && <Sun className="h-3.5 w-3.5" />}
      {theme === "system" && <Monitor className="h-3.5 w-3.5" />}
      <span className="text-sm capitalize">{theme} Mode</span>
    </Button>
  );
}
