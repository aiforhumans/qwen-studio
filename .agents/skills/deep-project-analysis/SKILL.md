---
name: deep-project-analysis
description: Systematic full-project discovery and repository analysis before implementation or major refactoring.
---

# Deep Project Analysis

Before making major changes:

1. Identify repository root.
2. Inspect directory structure.
3. Identify application entry points.
4. Identify dependency manifests.
5. Identify build configuration.
6. Identify runtime configuration.
7. Identify major modules.
8. Trace dependencies between modules.
9. Trace major data flows.
10. Inspect tests.
11. Inspect scripts.
12. Inspect documentation.

Do not assume filenames accurately represent implementation.

## Required output

- Project Overview
- Architecture Map
- Runtime Flow
- Risks
- Improvements

Classify risks as Critical, High, Medium, or Low.
