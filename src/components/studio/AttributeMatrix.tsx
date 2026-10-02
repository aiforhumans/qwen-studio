import { ATTR_LABEL, ATTR_SHORT, STATE_COLS, stepAttrs } from "@/lib/constants";
import { actions, useProject } from "@/lib/project-store";
import { relationshipEdges } from "@/lib/relationships";
import { ATTRIBUTES, type Attribute, type AttrState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";
import { NSelect, SectionHeader } from "./ui-bits";

const STATE_STYLE: Record<AttrState, string> = {
  LOCK: "bg-lock/20 text-lock border-lock/60",
  REPLACE: "bg-replace/20 text-replace border-replace/60",
  FREE: "bg-free/15 text-free border-free/50",
  IGNORE: "bg-ignore/15 text-ignore border-ignore/50",
};
const COL_LABEL: Record<AttrState, string> = {
  LOCK: "Lock / Keep",
  REPLACE: "Replace",
  FREE: "Free",
  IGNORE: "Ignore",
};

export function AttributeMatrix() {
  const p = useProject();
  const sources = p.images.filter((i) => i.id !== p.selectedBaseImageId);
  const conflictAttrs = new Set(
    p.issues
      .filter((i) => i.severity === "error" && i.focus?.startsWith("attr-"))
      .map((i) => i.focus!.slice(5)),
  );

  const set = (a: Attribute, state: AttrState) => {
    const cur = p.attributeMatrix[a];
    let src = state === "REPLACE" ? cur.sourceImageId : undefined;
    if (state === "REPLACE" && !src) {
      // prefer an image that lists this attribute, else first non-base
      src =
        sources.find((s) => s.uses.includes(a))?.id ??
        p.editSteps.find((e) => stepAttrs(e).includes(a))?.sourceImageId ??
        sources[0]?.id;
    }
    actions.setAttr(a, { state, sourceImageId: src });
  };

  return (
    <section
      id="attr-matrix"
      aria-label="Preservation and attribute matrix"
      className="rounded border bg-panel"
    >
      <SectionHeader title="Preservation / Attribute Matrix">
        <span className="text-[10.5px] text-muted-foreground">
          LOCK = from base · REPLACE = from source
        </span>
      </SectionHeader>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-1.5 text-left font-medium">Attribute</th>
              {STATE_COLS.map((c) => (
                <th key={c} className="px-1 py-1.5 font-medium">
                  {COL_LABEL[c]}
                </th>
              ))}
              <th className="px-2 py-1.5 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {ATTRIBUTES.map((a) => {
              const e = p.attributeMatrix[a];
              const bad = conflictAttrs.has(a);
              return (
                <tr key={a} id={`attr-${a}`} className={cn("border-t", bad && "bg-destructive/10")}>
                  <td className="px-3 py-1 font-medium">
                    {ATTR_LABEL[a]}
                    {bad && (
                      <span className="ml-1 text-destructive" title="Conflict">
                        ●
                      </span>
                    )}
                  </td>
                  {STATE_COLS.map((c) => (
                    <td key={c} className="px-1 py-1 text-center">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={e.state === c}
                        aria-label={`${ATTR_LABEL[a]} ${c}`}
                        onClick={() => set(a, c)}
                        className={cn(
                          "h-5 w-full max-w-16 rounded border text-[10px] font-semibold transition-colors",
                          e.state === c
                            ? STATE_STYLE[c]
                            : "border-transparent text-muted-foreground/40 hover:border-border hover:text-muted-foreground",
                        )}
                      >
                        {e.state === c ? c : "·"}
                      </button>
                    </td>
                  ))}
                  <td className="px-2 py-1">
                    {e.state === "REPLACE" ? (
                      <NSelect
                        aria-label={`${ATTR_LABEL[a]} source image`}
                        className={cn("w-28", !e.sourceImageId && "border-destructive")}
                        value={e.sourceImageId ?? ""}
                        onChange={(ev) =>
                          actions.setAttr(a, {
                            state: "REPLACE",
                            sourceImageId: ev.target.value || undefined,
                          })
                        }
                      >
                        <option value="">— choose —</option>
                        {sources.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.tag} {s.role}
                          </option>
                        ))}
                      </NSelect>
                    ) : e.state === "LOCK" ? (
                      <span className="font-mono text-[11px] text-lock">
                        {p.images.find((i) => i.id === p.selectedBaseImageId)?.tag ?? "no base"}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RelationshipGraph() {
  const p = useProject();
  const edges = relationshipEdges(p);
  const color = {
    LOCK: "text-lock border-lock/50",
    REPLACE: "text-replace border-replace/50",
    EXCLUDE: "text-destructive border-destructive/40",
    FREE: "",
    IGNORE: "",
  };
  const free = ATTRIBUTES.filter((a) => p.attributeMatrix[a].state === "FREE");
  return (
    <section aria-label="Relationship graph" className="rounded border bg-panel">
      <SectionHeader title="Relationship Graph" />
      <div className="space-y-1 p-2.5 font-mono text-[11.5px]">
        {!edges.length && (
          <p className="font-sans text-muted-foreground">
            No relationships yet. Assign roles or set matrix sources.
          </p>
        )}
        {edges.map((e, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <span className="tag-chip">{e.tag}</span>
            <span className={cn("rounded border px-1.5 py-px text-[10.5px]", color[e.kind])}>
              {e.kind === "EXCLUDE" ? "✕ NOT" : e.kind}{" "}
              {e.attrs.map((a) => ATTR_SHORT[a]).join(" / ")}
            </span>
            {e.kind !== "EXCLUDE" && (
              <>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground">output</span>
              </>
            )}
          </div>
        ))}
        {free.length > 0 && (
          <div className="pt-1 font-sans text-[11px] text-free">
            Qwen may adapt: {free.map((a) => ATTR_SHORT[a]).join(", ")}
          </div>
        )}
      </div>
    </section>
  );
}
