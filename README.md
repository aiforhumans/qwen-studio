# Qwen Prompt Studio

A browser workbench for reproducible image-edit prompts targeting Qwen-Image-2.1. Assign reference roles, select spatial targets, configure transfers and preservation, then copy a prompt, negative prompt, or parameter bundle.

Compilation works locally without a model. Optional providers support image analysis, wording refinement, and direct image editing.

## Development

Use Node.js 20.19+ within the 20.x series, or Node.js 22.12+; npm is the supported package manager.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite (normally http://127.0.0.1:8080).

| Command           | Purpose                                     |
| ----------------- | ------------------------------------------- |
| npm test          | Run regression and compatibility tests      |
| npm run typecheck | Check TypeScript                            |
| npm run lint      | Check code and formatting; warnings fail    |
| npm run build     | Build the static SPA into dist              |
| npm run preview   | Serve the production build locally          |
| npm run format    | Format source, docs, and root configuration |

## Hosting and data

Host the contents of **dist** over HTTP(S). Serve files normally and rewrite application routes to **index.html**. The included **\_redirects** supports hosts that recognize that convention; other hosts need equivalent configuration. Vite preview is a local verification server.

Projects, settings, history, and learning records live in browser localStorage. Image pixels live in IndexedDB. Export a backup with images before changing the hosting origin: browser storage belongs to the origin and is not transferred by deployment.

The former TanStack Start/Nitro runtime has been replaced by Vite and React. Lovable publishing compatibility has not been verified. No deployment or Git history change is part of this rewrite.

## Documentation

- [Documentation index](docs/README.md)
- [Authoritative engineering rules](AGENT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Development and testing](docs/DEVELOPMENT.md)
- [First push to a new repository](docs/DEVELOPMENT.md#first-push-to-a-new-repository)
- [Detailed Git submission guide](docs/GIT_SUBMISSION.md)
- [Storage and contracts](docs/STORAGE.md)
- [Providers and configuration](docs/PROVIDERS.md)
- [Prompting guide](docs/QWEN_2.1_PROMPTING_GUIDE.md)
- [Verified audit and remaining risks](docs/AUDIT.md)
