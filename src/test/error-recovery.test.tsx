import {
  createRootRoute,
  createRoute,
  createRouter,
  createMemoryHistory,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/__root";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete window.__lovableEvents;
});

it("reports route errors to an available Lovable hook and retries successfully", async () => {
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  const captureException = vi.fn();
  window.__lovableEvents = { captureException };
  let fail = true;
  const root = createRootRoute({
    component: () => <Outlet />,
    errorComponent: Route.options.errorComponent,
  });
  const broken = createRoute({
    getParentRoute: () => root,
    path: "/failure",
    component: () => {
      if (fail) throw new Error("Route fixture failed");
      return <h1>Recovered route</h1>;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([broken]),
    history: createMemoryHistory({ initialEntries: ["/failure"] }),
  });
  render(<RouterProvider router={router} />);
  expect(await screen.findByRole("heading", { name: "This page didn't load" })).toBeVisible();
  await waitFor(() => expect(captureException).toHaveBeenCalled());
  fail = false;
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("heading", { name: "Recovered route" })).toBeVisible();
});
