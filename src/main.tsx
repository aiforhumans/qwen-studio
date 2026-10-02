import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { reportLovableError } from "./lib/lovable-error-reporting";
import { migrateLegacyStorage } from "./lib/project-persistence";
import { getRouter } from "./router";
import "./styles.css";

window.addEventListener("error", (event) => reportLovableError(event.error ?? event.message));
window.addEventListener("unhandledrejection", (event) => reportLovableError(event.reason));

// Move historical embedded images before the store reads or persists projects.
async function bootstrap() {
  await migrateLegacyStorage();
  const root = document.getElementById("root");
  if (!root) throw new Error("Application root is missing.");
  createRoot(root).render(<RouterProvider router={getRouter()} />);
}

void bootstrap();
