"use client";

import { useEffect, useCallback, useState } from "react";
import { useStore } from "./store";
import {
  SHORTCUTS,
  SHORTCUT_VIEW_MAP,
  isInputFocused,
} from "./keyboard-shortcuts";

/**
 * Global keyboard shortcut events dispatched on window.
 * Components can listen for these to handle actions.
 */
export const SHORTCUT_EVENTS = {
  RUN_ATTACKS: "aegis:run-attacks",
  STOP_ATTACKS: "aegis:stop-attacks",
} as const;

/**
 * Hook that registers global keyboard shortcuts.
 * Returns { showHelp, setShowHelp } for the shortcuts help dialog.
 * 
 * Navigation shortcuts directly call setView.
 * Action shortcuts dispatch custom events that other components can listen to.
 */
export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false);
  const setView = useStore((s) => s.setView);
  const isRunning = useStore((s) => s.isRunning);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      // Allow Ctrl+/ even in inputs (help toggle)
      if (e.code !== "Slash" && isInputFocused()) return;

      const matched = SHORTCUTS.find((s) => {
        if (s.key !== e.code) return false;
        if (s.ctrl && !ctrl) return false;
        if (s.shift && !e.shiftKey) return false;
        if (!s.shift && e.shiftKey) return false;
        return true;
      });

      if (!matched) return;

      e.preventDefault();
      e.stopPropagation();

      // Navigation
      const viewTarget = SHORTCUT_VIEW_MAP[matched.id];
      if (viewTarget) {
        setView(viewTarget);
        return;
      }

      // Actions via custom events
      switch (matched.id) {
        case "run-attacks":
          if (!isRunning) {
            window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.RUN_ATTACKS));
          }
          break;
        case "stop-attacks":
          if (isRunning) {
            window.dispatchEvent(new CustomEvent(SHORTCUT_EVENTS.STOP_ATTACKS));
          }
          break;
        case "show-shortcuts":
          setShowHelp((prev) => !prev);
          break;
      }
    },
    [setView, isRunning, setShowHelp]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  return { showHelp, setShowHelp };
}
