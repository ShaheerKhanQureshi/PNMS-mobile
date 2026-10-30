import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  user: { id: 1 } as { id: number } | undefined,
}));
vi.mock("../auth/session", () => ({ useAuth: () => ({ user: mocks.user }) }));

import {
  ThemeProvider,
  useTheme,
  themeStorageKey,
  readStoredPreference,
  THEME_HINT_KEY,
} from "../lib/theme";

function Probe() {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="state">
        {preference}:{resolved}
      </span>
      <button onClick={() => setPreference("dark")}>dark</button>
      <button onClick={() => setPreference("light")}>light</button>
      <button onClick={() => setPreference("system")}>system</button>
    </div>
  );
}
const tree = () => (
  <ThemeProvider>
    <Probe />
  </ThemeProvider>
);

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.style.colorScheme = "";
  mocks.user = { id: 1 };
});

describe("theme preference", () => {
  it("namespaces the storage key by the authenticated user's id", () => {
    expect(themeStorageKey(7)).toBe("pnms.theme.v1.user.7");
    expect(themeStorageKey(7)).not.toBe(themeStorageKey(8));
  });

  it("defaults to the system setting and ignores unknown stored values", () => {
    expect(readStoredPreference(1)).toBe("system");
    window.localStorage.setItem(themeStorageKey(1), "neon");
    expect(readStoredPreference(1)).toBe("system");
  });

  it("applies a chosen theme immediately and persists it for that user only", () => {
    render(tree());
    fireEvent.click(screen.getByText("dark"));
    expect(screen.getByTestId("state")).toHaveTextContent("dark:dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(themeStorageKey(1))).toBe("dark");
    expect(window.localStorage.getItem(themeStorageKey(2))).toBeNull();
  });

  it("keeps preferences independent between accounts and survives a remount", () => {
    const view = render(tree());
    fireEvent.click(screen.getByText("dark"));
    // A different user signs in on the same device: their own (unset) preference applies.
    mocks.user = { id: 2 };
    view.rerender(tree());
    expect(screen.getByTestId("state")).toHaveTextContent("system:");
    fireEvent.click(screen.getByText("light"));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    // Back to the first user: their dark choice is restored.
    mocks.user = { id: 1 };
    view.rerender(tree());
    expect(screen.getByTestId("state")).toHaveTextContent("dark:dark");
    // A refresh (new mount) reads the stored value.
    view.unmount();
    render(tree());
    expect(screen.getByTestId("state")).toHaveTextContent("dark:dark");
  });

  it("remembers the last choice as a non-sensitive hint for the next page load", () => {
    render(tree());
    fireEvent.click(screen.getByText("dark"));
    expect(window.localStorage.getItem(THEME_HINT_KEY)).toBe("dark");
  });
});
