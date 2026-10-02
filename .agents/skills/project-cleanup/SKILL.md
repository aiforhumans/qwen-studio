---
name: project-cleanup
description: Safely identifies obsolete, duplicate, generated, abandoned, and unused project content.
---

# Project Cleanup

Never remove content based on filename alone.

Verify:

- imports
- references
- runtime discovery
- plugin loading
- config loading
- packaging
- build steps
- tests
- scripts

Classify each candidate:
SAFE TO REMOVE
LIKELY REMOVE
REQUIRES REVIEW
KEEP
