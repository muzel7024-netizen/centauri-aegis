import {
  SHORTCUTS,
  SHORTCUT_VIEW_MAP,
  isInputFocused,
  formatShortcut,
  getShortcutsByCategory,
} from "../keyboard-shortcuts";

describe("keyboard-shortcuts", () => {
  describe("SHORTCUTS", () => {
    it("has unique IDs", () => {
      const ids = SHORTCUTS.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("has unique key bindings", () => {
      const bindings = SHORTCUTS.map(
        (s) => `${s.ctrl ? "ctrl+" : ""}${s.shift ? "shift+" : ""}${s.key}`
      );
      expect(new Set(bindings).size).toBe(bindings.length);
    });

    it("all have required fields", () => {
      for (const s of SHORTCUTS) {
        expect(s.id).toBeTruthy();
        expect(s.label).toBeTruthy();
        expect(s.key).toBeTruthy();
        expect(s.keyLabel).toBeTruthy();
        expect(s.category).toBeTruthy();
        expect(s.description).toBeTruthy();
      }
    });

    it("has navigation shortcuts for 10 views", () => {
      const navShortcuts = SHORTCUTS.filter((s) => s.category === "navigation");
      expect(navShortcuts.length).toBe(10);
    });

    it("has action shortcuts for run and stop", () => {
      const actions = SHORTCUTS.filter((s) => s.category === "actions");
      expect(actions.map((a) => a.id)).toContain("run-attacks");
      expect(actions.map((a) => a.id)).toContain("stop-attacks");
    });

    it("has help shortcut", () => {
      const help = SHORTCUTS.find((s) => s.id === "show-shortcuts");
      expect(help).toBeDefined();
      expect(help!.key).toBe("Slash");
      expect(help!.ctrl).toBe(true);
    });
  });

  describe("SHORTCUT_VIEW_MAP", () => {
    it("maps all navigation shortcuts to valid views", () => {
      const navIds = SHORTCUTS.filter((s) => s.category === "navigation").map((s) => s.id);
      for (const id of navIds) {
        expect(SHORTCUT_VIEW_MAP[id]).toBeTruthy();
      }
    });

    it("does not map non-navigation shortcuts", () => {
      const nonNav = SHORTCUTS.filter((s) => s.category !== "navigation").map((s) => s.id);
      for (const id of nonNav) {
        expect(SHORTCUT_VIEW_MAP[id]).toBeUndefined();
      }
    });
  });

  describe("isInputFocused", () => {
    it("returns false when no element is focused", () => {
      // In jsdom, activeElement defaults to body
      expect(isInputFocused()).toBe(false);
    });

    it("returns true when input is focused", () => {
      const input = document.createElement("input");
      document.body.appendChild(input);
      input.focus();
      expect(isInputFocused()).toBe(true);
      document.body.removeChild(input);
    });

    it("returns true when textarea is focused", () => {
      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.focus();
      expect(isInputFocused()).toBe(true);
      document.body.removeChild(textarea);
    });

    it("returns true for select element", () => {
      const select = document.createElement("select");
      document.body.appendChild(select);
      select.focus();
      expect(isInputFocused()).toBe(true);
      document.body.removeChild(select);
    });

    it("returns false for regular div", () => {
      const div = document.createElement("div");
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();
      expect(isInputFocused()).toBe(false);
      document.body.removeChild(div);
    });
  });

  describe("formatShortcut", () => {
    it("formats Ctrl shortcuts", () => {
      const result = formatShortcut({
        id: "test", label: "Test", key: "KeyR", keyLabel: "R",
        ctrl: true, category: "actions", description: "Test"
      });
      // In jsdom, navigator.userAgent contains "jsdom" not "Mac"
      expect(result).toBe("Ctrl+R");
    });

    it("formats Ctrl+Shift shortcuts", () => {
      const result = formatShortcut({
        id: "test", label: "Test", key: "KeyR", keyLabel: "R",
        ctrl: true, shift: true, category: "actions", description: "Test"
      });
      expect(result).toBe("Ctrl+Shift+R");
    });
  });

  describe("getShortcutsByCategory", () => {
    it("groups shortcuts by category", () => {
      const groups = getShortcutsByCategory();
      expect(groups.navigation).toBeDefined();
      expect(groups.actions).toBeDefined();
      expect(groups.general).toBeDefined();
    });

    it("total across groups equals total shortcuts", () => {
      const groups = getShortcutsByCategory();
      const total = Object.values(groups).reduce((sum, arr) => sum + arr.length, 0);
      expect(total).toBe(SHORTCUTS.length);
    });
  });
});
