import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle and ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    // Mock matchMedia for system theme
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it("renders mounted theme toggle with default dark mode", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button).toBeTruthy();
    expect(button.getAttribute("title")).toBe("Theme: dark — click to cycle");
    expect(screen.getByText("dark Mode")).toBeTruthy();
  });

  it("cycles through dark -> light -> system -> dark", () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");

    // Initially dark
    expect(button.getAttribute("title")).toBe("Theme: dark — click to cycle");
    expect(screen.getByText("dark Mode")).toBeTruthy();

    // Click 1: transition to light
    act(() => {
      fireEvent.click(button);
    });
    expect(button.getAttribute("title")).toBe("Theme: light — click to cycle");
    expect(screen.getByText("light Mode")).toBeTruthy();
    expect(localStorage.getItem("centauri-aegis-theme")).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    // Click 2: transition to system
    act(() => {
      fireEvent.click(button);
    });
    expect(button.getAttribute("title")).toBe("Theme: system — click to cycle");
    expect(screen.getByText("system Mode")).toBeTruthy();
    expect(localStorage.getItem("centauri-aegis-theme")).toBe("system");

    // Click 3: transition back to dark
    act(() => {
      fireEvent.click(button);
    });
    expect(button.getAttribute("title")).toBe("Theme: dark — click to cycle");
    expect(screen.getByText("dark Mode")).toBeTruthy();
    expect(localStorage.getItem("centauri-aegis-theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("loads persisted light theme from localStorage", () => {
    localStorage.setItem("centauri-aegis-theme", "light");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("title")).toBe("Theme: light — click to cycle");
    expect(screen.getByText("light Mode")).toBeTruthy();
  });

  it("loads persisted system theme from localStorage", () => {
    localStorage.setItem("centauri-aegis-theme", "system");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("title")).toBe("Theme: system — click to cycle");
    expect(screen.getByText("system Mode")).toBeTruthy();
  });

  it("supports legacy redpincer-theme fallback in localStorage", () => {
    localStorage.setItem("redpincer-theme", "light");

    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>
    );

    const button = screen.getByRole("button");
    expect(button.getAttribute("title")).toBe("Theme: light — click to cycle");
    expect(screen.getByText("light Mode")).toBeTruthy();
  });
});
