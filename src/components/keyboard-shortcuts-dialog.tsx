"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getShortcutsByCategory,
  formatShortcut,
} from "@/lib/keyboard-shortcuts";
import { Keyboard, Navigation, Zap, Info } from "lucide-react";

const CATEGORY_META: Record<string, { label: string; icon: React.ReactNode }> = {
  navigation: { label: "Navigation", icon: <Navigation className="h-4 w-4" /> },
  actions: { label: "Actions", icon: <Zap className="h-4 w-4" /> },
  general: { label: "General", icon: <Info className="h-4 w-4" /> },
};

const CATEGORY_ORDER = ["navigation", "actions", "general"];

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const groups = getShortcutsByCategory();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {CATEGORY_ORDER.map((cat) => {
            const shortcuts = groups[cat];
            if (!shortcuts?.length) return null;
            const meta = CATEGORY_META[cat] ?? { label: cat, icon: null };
            return (
              <div key={cat}>
                <h3 className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mb-2">
                  {meta.icon}
                  {meta.label}
                </h3>
                <div className="space-y-1">
                  {shortcuts.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50"
                    >
                      <span className="text-sm">{s.description}</span>
                      <kbd className="ml-4 inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
                        {formatShortcut(s)}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground text-center pt-2 border-t">
          Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-xs font-mono">Ctrl+/</kbd> to toggle this dialog
        </p>
      </DialogContent>
    </Dialog>
  );
}
