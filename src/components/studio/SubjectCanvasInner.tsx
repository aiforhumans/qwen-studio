import { useImageAssetUrl } from "@/hooks/use-image-asset";
import { projectStore, uid, useProject } from "@/lib/project-store";
import type { Target } from "@/lib/types";
import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Arrow, Circle, Group, Image as KImage, Layer, Rect, Stage, Text } from "react-konva";

export type CanvasMode = "select" | "point" | "box" | "move";

export default function SubjectCanvasInner({
  imageId,
  mode,
  selected,
  onSelect,
}: {
  imageId?: string | undefined;
  mode: CanvasMode;
  selected?: string | undefined;
  onSelect: (id?: string) => void;
}) {
  const p = useProject();
  const img = p.images.find((i) => i.id === imageId);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [el, setEl] = useState<HTMLImageElement | null>(null);
  const [draft, setDraft] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null,
  );

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => e && setW(Math.max(200, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const assetUrl = useImageAssetUrl(img?.assetId, img?.dataUrl, "preview");
  useEffect(() => {
    if (!assetUrl) {
      setEl(null);
      return;
    }
    const i = new window.Image();
    i.onload = () => setEl(i);
    i.src = assetUrl;
  }, [assetUrl]);

  if (!img)
    return (
      <div
        ref={wrap}
        className="flex h-64 items-center justify-center text-[12px] text-muted-foreground"
      >
        Upload or select an image to place targets.
      </div>
    );

  const aspect = img.height / img.width;
  const H = Math.min(520, w * aspect);
  const W = H / aspect;
  const norm = (x: number, y: number) => ({
    x: Math.max(0, Math.min(1, x / W)),
    y: Math.max(0, Math.min(1, y / H)),
  });
  const targets = p.targets.filter((t) => t.imageId === img.id);

  const pos = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) =>
    e.target.getStage()!.getPointerPosition()!;
  const down = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (mode === "select") {
      if (e.target === e.target.getStage() || e.target.name() === "bg") onSelect(undefined);
      return;
    }
    const pt = pos(e);
    if (mode === "point") {
      const n = norm(pt.x, pt.y);
      const t: Target = {
        id: uid(),
        label: `Point ${p.targets.length + 1}`,
        type: "point",
        imageId: img.id,
        point: n,
      };
      projectStore.update((s) => ({ ...s, targets: [...s.targets, t] }));
      onSelect(t.id);
      return;
    }
    setDraft({ x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y });
  };
  const moveEv = (e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!draft) return;
    const pt = pos(e);
    setDraft({ ...draft, x1: pt.x, y1: pt.y });
  };
  const up = () => {
    if (!draft) return;
    const a = norm(draft.x0, draft.y0),
      b = norm(draft.x1, draft.y1);
    setDraft(null);
    if (mode === "box") {
      if (Math.abs(a.x - b.x) < 0.01 || Math.abs(a.y - b.y) < 0.01) return;
      const t: Target = {
        id: uid(),
        label: `Region ${p.targets.length + 1}`,
        type: "box",
        imageId: img.id,
        bbox: {
          x: Math.min(a.x, b.x),
          y: Math.min(a.y, b.y),
          w: Math.abs(a.x - b.x),
          h: Math.abs(a.y - b.y),
        },
      };
      projectStore.update((s) => ({ ...s, targets: [...s.targets, t] }));
      onSelect(t.id);
    } else if (mode === "move") {
      if (Math.hypot(a.x - b.x, a.y - b.y) < 0.02) return;
      projectStore.update((s) => {
        let targetsNext = s.targets;
        let tid =
          selected && s.targets.some((t) => t.id === selected && t.imageId === img.id)
            ? selected
            : undefined;
        if (!tid) {
          const t: Target = {
            id: uid(),
            label: `Object ${s.targets.length + 1}`,
            type: "point",
            imageId: img.id,
            point: a,
          };
          targetsNext = [...s.targets, t];
          tid = t.id;
        }
        const movements = [
          ...s.movements.filter((m) => m.targetId !== tid),
          { id: uid(), targetId: tid, from: a, to: b },
        ];
        let steps = s.editSteps;
        const free = steps.find((st) => st.operation === "MOVE" && !st.targetId);
        if (free) steps = steps.map((st) => (st === free ? { ...st, targetId: tid } : st));
        else if (!steps.some((st) => st.operation === "MOVE" && st.targetId === tid))
          steps = [...steps, { id: uid(), operation: "MOVE", targetId: tid }];
        return { ...s, targets: targetsNext, movements, editSteps: steps };
      });
    }
  };

  return (
    <div ref={wrap} className="flex w-full justify-center">
      <Stage
        width={W}
        height={H}
        onMouseDown={down}
        onTouchStart={down}
        onMouseMove={moveEv}
        onTouchMove={moveEv}
        onMouseUp={up}
        onTouchEnd={up}
        style={{ cursor: mode === "select" ? "default" : "crosshair" }}
      >
        <Layer>
          {el ? (
            <KImage name="bg" image={el} width={W} height={H} />
          ) : (
            <Group>
              <Rect name="bg" width={W} height={H} fill="#1f242b" />
              <Text
                name="bg"
                text={`${img.tag} — no pixels (demo slot)`}
                width={W}
                y={H / 2 - 8}
                align="center"
                fill="#7d8794"
                fontSize={13}
              />
            </Group>
          )}
          {targets.map((t) => {
            const sel = t.id === selected;
            const col = sel ? "#4cc9f0" : "#f4b860";
            const drag = mode === "select";
            const onDragEnd = (e: Konva.KonvaEventObject<DragEvent>) => {
              const n = norm(e.target.x(), e.target.y());
              projectStore.update((s) => ({
                ...s,
                targets: s.targets.map((x) =>
                  x.id !== t.id
                    ? x
                    : x.bbox
                      ? { ...x, bbox: { ...x.bbox, x: n.x, y: n.y } }
                      : { ...x, point: n },
                ),
              }));
            };
            if (t.bbox)
              return (
                <Group
                  key={t.id}
                  x={t.bbox.x * W}
                  y={t.bbox.y * H}
                  draggable={drag}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelect(t.id)}
                  onTap={() => onSelect(t.id)}
                >
                  <Rect
                    width={t.bbox.w * W}
                    height={t.bbox.h * H}
                    stroke={col}
                    strokeWidth={sel ? 2 : 1.5}
                    dash={[6, 4]}
                    fill={sel ? "rgba(76,201,240,0.08)" : "rgba(0,0,0,0)"}
                  />
                  <Text text={t.label} y={-16} fontSize={12} fill={col} />
                </Group>
              );
            if (t.point)
              return (
                <Group
                  key={t.id}
                  x={t.point.x * W}
                  y={t.point.y * H}
                  draggable={drag}
                  onDragEnd={onDragEnd}
                  onClick={() => onSelect(t.id)}
                  onTap={() => onSelect(t.id)}
                >
                  <Circle
                    radius={sel ? 7 : 6}
                    stroke={col}
                    strokeWidth={2}
                    fill="rgba(0,0,0,0.4)"
                  />
                  <Text text={t.label} x={9} y={-6} fontSize={12} fill={col} />
                </Group>
              );
            return null;
          })}
          {p.movements
            .filter((m) => targets.some((t) => t.id === m.targetId))
            .map((m) => (
              <Group key={m.id}>
                <Arrow
                  points={[m.from.x * W, m.from.y * H, m.to.x * W, m.to.y * H]}
                  stroke="#4cc9f0"
                  fill="#4cc9f0"
                  strokeWidth={2.5}
                  pointerLength={10}
                  pointerWidth={10}
                  dash={[8, 4]}
                />
                <Circle x={m.from.x * W} y={m.from.y * H} radius={5} fill="#f07167" />
                <Text
                  x={m.from.x * W + 7}
                  y={m.from.y * H + 4}
                  text="source"
                  fontSize={10}
                  fill="#f07167"
                />
                <Circle x={m.to.x * W} y={m.to.y * H} radius={6} stroke="#4cc9f0" strokeWidth={2} />
                <Text
                  x={m.to.x * W + 8}
                  y={m.to.y * H + 4}
                  text="destination"
                  fontSize={10}
                  fill="#4cc9f0"
                />
              </Group>
            ))}
          {draft && mode === "box" && (
            <Rect
              x={Math.min(draft.x0, draft.x1)}
              y={Math.min(draft.y0, draft.y1)}
              width={Math.abs(draft.x1 - draft.x0)}
              height={Math.abs(draft.y1 - draft.y0)}
              stroke="#4cc9f0"
              dash={[4, 4]}
            />
          )}
          {draft && mode === "move" && (
            <Arrow
              points={[draft.x0, draft.y0, draft.x1, draft.y1]}
              stroke="#4cc9f0"
              fill="#4cc9f0"
              strokeWidth={2}
            />
          )}
        </Layer>
      </Stage>
    </div>
  );
}
