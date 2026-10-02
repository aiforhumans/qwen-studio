import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { emptyProject, projectStore } from "@/lib/project-store";

function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  return render(<RouterProvider router={router} />);
}
beforeEach(() => {
  localStorage.clear();
  projectStore.replace(emptyProject());
  projectStore.clearHistory();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
describe("App routing", () => {
  for (const [path, heading] of [
    ["/", "Ready-to-Copy Text Prompt"],
    ["/lab", "Prompt Laboratory"],
    ["/templates", "Prompt Library"],
    ["/history", "Generation History"],
    ["/learning", "Preference Learning"],
    ["/models", "Model / API Configuration"],
    ["/settings", "Application Settings"],
  ] as const) {
    it(`renders meaningful content at ${path}`, async () => {
      renderAt(path);
      expect(await screen.findByRole("heading", { name: heading })).toBeVisible();
      expect(screen.getByRole("navigation", { name: "Main" })).toBeVisible();
    });
  }
  it("renders the not-found route", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderAt("/this-route-does-not-exist");
    expect(await screen.findByRole("heading", { name: "404" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Open Studio" })).toHaveAttribute("href", "/");
  });
});
