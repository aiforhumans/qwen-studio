<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

# Agent instructions

Read [AGENT.md](AGENT.md) before changes; it is the authoritative architecture manual.

- Keep ProjectState authoritative and prompts deterministically derived through the compiler.
- Keep validation in the validator and role/operation semantics in canonical policies.
- Keep image bytes in IndexedDB and metadata in localStorage; support historical imports.
- Preserve source locks separately from global base-canvas locks and protect ordered image references during refinement.
- Keep React and react-konva minor versions aligned, canvas lazy-loaded, and fonts bundled.
- Development and tests must not require local Qwen deployment.
- Run tests, typecheck, lint without warnings, and production build. Never update compatibility snapshots merely to accommodate a refactor.
