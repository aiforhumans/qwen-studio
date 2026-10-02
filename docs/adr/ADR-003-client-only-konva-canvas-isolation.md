# ADR-003: Lazy browser canvas

Status: retained; SSR rationale superseded by ADR-004.

Keep SubjectCanvasInner behind React.lazy in SubjectCanvas. Konva is a browser dependency, and its substantial production chunk should load only when needed. The existing mount guard remains compatible with the preserved interface. Keep React and react-konva minor versions aligned.

Evidence: [canvas wrapper](../../src/components/studio/SubjectCanvas.tsx), [inner canvas](../../src/components/studio/SubjectCanvasInner.tsx), and package.json.

Consequence: the canvas has a brief loading state. The application now has no SSR runtime; the older SSR isolation requirement no longer describes deployment.
