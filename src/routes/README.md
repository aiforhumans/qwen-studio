# Routes

TanStack Router retains file-based routing in this browser SPA. Each route .tsx file declares a route; __root.tsx owns Outlet, metadata, notifications, and fallback components. index.html owns the document shell.

Vite's TanStack Router plugin regenerates src/routeTree.gen.ts. Do not edit it manually. Existing paths are /, /lab, /templates, /history, /learning, /models, and /settings.

Keep route modules focused on orchestration and rendering. Put reusable project commands and side effects in the domain/application services. Do not add TanStack Start server functions or a server entry.
