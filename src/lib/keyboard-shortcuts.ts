/**
 * Keyboard shortcut definitions and utilities for Centauri Aegis.
 * 
 * Convention: All shortcuts use Ctrl/Cmd modifier to avoid conflicts
 * with text input fields. Shortcuts are disabled when focus is inside
 * an input, textarea, or contentEditable element.
 */

import type { ViewName } from "./store";

export interface KeyboardShortcut {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Key code (e.g., "KeyR", "Digit1") */
  key: string;
  /** Display key label (e.g., "R", "1") */
  keyLabel: string;
  /** Requires Ctrl/Cmd modifier */
  ctrl?: boolean;
  /** Requires Shift modifier */
  shift?: boolean;
  /** Category for grouping in help dialog */
  category: "navigation" | "actions" | "general";
  /** Description shown in help dialog */
  description: string;
}

// Navigation shortcuts: Ctrl+1..9 for views, Ctrl+Shift for less common ones
export const SHORTCUTS: KeyboardShortcut[] = [
  // Navigation (Ctrl+Number)
  { id: "nav-config", label: "Config", key: "Digit1", keyLabel: "1", ctrl: true, category: "navigation", description: "Go to Target Config" },
  { id: "nav-attacks", label: "Attacks", key: "Digit2", keyLabel: "2", ctrl: true, category: "navigation", description: "Go to Attack Modules" },
  { id: "nav-results", label: "Results", key: "Digit3", keyLabel: "3", ctrl: true, category: "navigation", description: "Go to Results Dashboard" },
  { id: "nav-reports", label: "Reports", key: "Digit4", keyLabel: "4", ctrl: true, category: "navigation", description: "Go to Report Generator" },
  { id: "nav-chains", label: "Chains", key: "Digit5", keyLabel: "5", ctrl: true, category: "navigation", description: "Go to Chain Builder" },
  { id: "nav-session", label: "Session", key: "Digit6", keyLabel: "6", ctrl: true, category: "navigation", description: "Go to Session Manager" },
  { id: "nav-editor", label: "Editor", key: "Digit7", keyLabel: "7", ctrl: true, category: "navigation", description: "Go to Payload Editor" },
  { id: "nav-comparison", label: "Compare", key: "Digit8", keyLabel: "8", ctrl: true, category: "navigation", description: "Go to Run Comparison" },
  { id: "nav-adaptive", label: "Adaptive", key: "Digit9", keyLabel: "9", ctrl: true, category: "navigation", description: "Go to Adaptive Runner" },
  { id: "nav-heatmap", label: "Heatmap", key: "Digit0", keyLabel: "0", ctrl: true, category: "navigation", description: "Go to Vulnerability Heatmap" },

  // Actions
  { id: "run-attacks", label: "Run", key: "Enter", keyLabel: "Enter", ctrl: true, category: "actions", description: "Start attack run" },
  { id: "stop-attacks", label: "Stop", key: "Period", keyLabel: ".", ctrl: true, category: "actions", description: "Stop current run" },

  // General
  { id: "show-shortcuts", label: "Shortcuts", key: "Slash", keyLabel: "/", ctrl: true, category: "general", description: "Show keyboard shortcuts" },
];

/** Map shortcut IDs to view names for navigation shortcuts */
export const SHORTCUT_VIEW_MAP: Record<string, ViewName> = {
  "nav-config": "config",
  "nav-attacks": "attacks",
  "nav-results": "results",
  "nav-reports": "reports",
  "nav-chains": "chains",
  "nav-session": "session",
  "nav-editor": "editor",
  "nav-comparison": "comparison",
  "nav-adaptive": "adaptive",
  "nav-heatmap": "heatmap",
};

/** Returns true if the active element is a text input (shortcuts should be suppressed) */
export function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

/** Format a shortcut for display (e.g., "Ctrl+1", "⌘+Enter") */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const isMac = typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  parts.push(shortcut.keyLabel);
  return parts.join(isMac ? "" : "+");
}

/** Group shortcuts by category */
export function getShortcutsByCategory(): Record<string, KeyboardShortcut[]> {
  const groups: Record<string, KeyboardShortcut[]> = {};
  for (const s of SHORTCUTS) {
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category].push(s);
  }
  return groups;
}
