# ADR-004: Standard React/Vite SPA

Status: implemented; hosted Lovable publishing unverified.

The user selected a Vite SPA while preserving the current interface, features, route URLs, and compiler output. Application logic inspected in the repository operates in the browser; no application server functions were found.

Use React createRoot and TanStack Router file-based routes. Explicit Vite plugins replace the Lovable TanStack Start wrapper. Remove Start/Nitro, unused React Query infrastructure, and server-only error handling. Preserve client retry/home boundaries, route metadata, optional Lovable reporting hooks, bundled fonts, and lazy Konva.

Evidence: [entry point](../../src/main.tsx), [Vite config](../../vite.config.ts), [root route](../../src/routes/__root.tsx), production build, and route/browser tests.

Consequence: output is dist with index.html fallback hosting. Server-rendered HTML is no longer provided. Changing origins requires data export/import. Publishing inside Lovable requires a separate hosting verification; this rewrite does not deploy.
