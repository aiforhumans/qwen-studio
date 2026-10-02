# Git submission guide

Repository: [aiforhumans/qwen-studio](https://github.com/aiforhumans/qwen-studio). The primary branch is `main`; the remote is `origin`.

## Clone and configure identity

```sh
git clone https://github.com/aiforhumans/qwen-studio.git
cd qwen-studio
git config --local user.name "Your name"
git config --local user.email "your-verified-or-GitHub-no-reply-email"
npm ci
```

Identity settings above apply only to this checkout. Authenticate using your Git credential manager or SSH setup; never put a token in a remote URL, source file, or commit. Verify the destination with `git remote -v` before submitting.

## What belongs in a submission

Commit source, tests and compiler characterization snapshots, documentation, public assets, the root AGENT.md and AGENTS.md guidance, configuration, and package-lock.json. The .agents directory contains local tooling and must stay untracked. Keep src/routeTree.gen.ts tracked: typecheck and tests use its declarations before Vite runs. Review route changes after a build.

Keep node_modules, dist, legacy runtime output, caches, coverage, browser reports, credentials, environment files, backups, and browser data exports out of Git. .gitignore excludes common examples. Ignoring a file does not remove it if it was already tracked; inspect the staged list. Do not commit provider API keys, even inside example settings or screenshots.

Use npm as the package manager. Include package-lock.json whenever dependency declarations change. LF line endings are enforced by .gitattributes; .editorconfig supplies editor defaults.

## Prepare a change

Start with a clean checkout and update main without rewriting history:

```sh
git status --short
git switch main
git pull --ff-only origin main
git switch -c feature/describe-the-change
```

Choose a descriptive branch name. If the checkout has unfinished work, commit it on its branch or deliberately stash it before switching. If the fast-forward pull fails, inspect the differing commits instead of resetting or forcing the branch.

Implement a focused change and update relevant docs. For compiler refactors, existing compatibility snapshots must remain identical. Intentional output changes require an explicit specification and reviewer-visible explanation. Storage changes must preserve historical imports and asset references. Changes to React or react-konva must preserve their compatible minor versions.

## Verify before committing

```sh
npm ci
npm run build
npm run typecheck
npm run lint
npm test
git diff --check
```

Lint must pass without warnings. For runtime or UI changes, also run `npm run preview -- --host 127.0.0.1 --port 4173 --strictPort` and exercise affected routes, direct navigation/refresh, browser errors, desktop/mobile layouts, and storage reload. Provider verification can use mocked endpoints; local Qwen deployment is not required. Store temporary browser evidence outside the repository.

Review and stage the intended files:

```sh
git diff --stat
git diff
git add src docs
git diff --cached --stat
git diff --cached
git diff --cached --check
git status --short
git commit -m "Describe the resulting behavior"
```

The `git add src docs` example covers those directories only. Explicitly stage any intended root configuration, public assets, or lockfile changes as well. Check staged contents for credentials and unrelated changes. To remove an accidentally staged path while preserving its working copy, use `git restore --staged <path>`.

## Submit a branch for review

```sh
git push -u origin feature/describe-the-change
```

Open a pull request against main. Describe the problem and resulting behavior, relevant compatibility or migration effects, checks performed, and any unverified limits. Include browser evidence when it helps assess a UI change. GitHub Actions runs the Verify workflow on pushes and pull requests: installation, build, typecheck, lint, and tests. A local pass does not establish a hosted CI pass; inspect the run on GitHub.

After approval, use a merge that preserves existing published commits. Never force-push, rebase, amend, or squash commits already published to a Lovable-connected branch. Confirm which branch is connected before submitting changes intended to sync with Lovable; adding this remote does not create that connection. Hosted publishing compatibility remains unverified.

## Initial or explicitly authorized direct push

The initial local history was created on main with commit `e73da4e` (React SPA, tests, docs, and repository setup). When main is ready and a direct push is authorized:

```sh
git switch main
git status --short
git remote -v
git push -u origin main
git fetch origin
git status -sb
git rev-parse HEAD
git rev-parse origin/main
```

The two hashes should match immediately after a successful push if no other changes reached the remote. `-u` records the upstream; subsequent pushes from that branch can use `git push`. This submits source and triggers the configured CI; it does not deploy the SPA or transfer browser projects, images, settings, or credentials.

## Common submission failures

| Failure                             | Action                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication or permission denied | Check your signed-in Git identity and repository write access; use the credential manager, without embedding tokens in URLs                       |
| Remote branch contains new commits  | Fetch and inspect `git log --oneline --graph --all`; integrate with a normal merge where appropriate, rerun checks, then push without force       |
| Branch protection rejects main push | Submit a feature branch and pull request under the repository's rules                                                                             |
| CI fails after local verification   | Inspect the failed step and runner environment; fix the cause in a new commit and rerun verification                                              |
| Sensitive data was committed        | Stop publishing; revoke exposed credentials and coordinate remediation with the repository owner rather than silently rewriting connected history |
| Wrong file staged                   | Use `git restore --staged <path>` before committing; it preserves the working copy                                                                |

For a published behavior regression, use `git revert <commit>` to create a corrective commit, verify it, and submit normally. Avoid destructive resets of shared history. Export a browser backup with assets before changing hosting origins; Git commits do not back up browser storage.
