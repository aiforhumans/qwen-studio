import { Button } from "@/components/ui/button";
import { useImageAssetUrl } from "@/hooks/use-image-asset";
import { assetDataUrl, importImageFile } from "@/lib/assets";
import { actions, projectStore, uid, useProject } from "@/lib/project-store";
import { getAnalyzer } from "@/lib/providers";
import type { Importance, RefImage, Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Crown, ScanSearch, Trash2, Upload, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AttrChips, ImageThumb, NSelect, SectionHeader, TInput } from "./ui-bits";

async function readImage(file: File): Promise<Omit<RefImage, "tag">> {
  const stored = await importImageFile(file);
  return {
    id: uid(),
    filename: file.name,
    width: stored.width,
    height: stored.height,
    assetId: stored.assetId,
    mimeType: stored.mimeType,
    role: "Custom",
    importance: "Medium",
    uses: [],
    excludes: [],
    locks: [],
  };
}

export function ImagesPanel() {
  const p = useProject();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const suggestion = actions.suggestMapping(p);

  const onFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = 10 - p.images.length;
    if (!arr.length) {
      toast.error("No image files found.");
      return;
    }
    if (room <= 0) {
      toast.error("Maximum of 10 images.");
      return;
    }
    if (arr.length > room)
      toast.warning(`Only ${room} more image(s) allowed; extra files skipped.`);
    try {
      const imgs = await Promise.all(arr.slice(0, room).map(readImage));
      actions.addImages(imgs);
      toast.success(`Added ${imgs.length} image(s). Original files are stored in IndexedDB.`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <section
      id="images-panel"
      aria-label="Images and references"
      className="flex h-full min-h-0 flex-col"
    >
      <SectionHeader title={`Images · ${p.images.length}/10`}>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={() => input.current?.click()}
        >
          <Upload className="h-3 w-3" /> Add
        </Button>
      </SectionHeader>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        <div
          id="upload-zone"
          role="button"
          tabIndex={0}
          onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1 rounded border border-dashed p-3 text-center text-[11px] text-muted-foreground transition-colors hover:border-primary/60",
            drag && "border-primary bg-primary/5",
          )}
        >
          <Upload className="h-4 w-4" />
          Drop 1–10 images or click to browse
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void onFiles(e.target.files);
            e.target.value = "";
          }}
        />

        {suggestion && (
          <div className="rounded border border-primary/40 bg-primary/5 p-2 text-[11px]">
            <div className="mb-1 flex items-center gap-1 font-medium text-primary">
              <Wand2 className="h-3 w-3" /> Suggested mapping
            </div>
            <div className="text-muted-foreground">
              {suggestion.map((s, i) => `<image${i + 1}> ${s.role}`).join(" · ")}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1.5 h-6 text-[11px]"
              onClick={() => actions.applyMapping(suggestion)}
            >
              Apply suggestion
            </Button>
          </div>
        )}

        {p.images.map((img, i) => (
          <ImageCard
            key={img.id}
            img={img}
            index={i}
            total={p.images.length}
            isBase={img.id === p.selectedBaseImageId}
          />
        ))}

        {p.images.length > 0 && p.images.every((i) => !i.assetId && !i.dataUrl) && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Demo slots have no pixels. Delete them or upload your own references.
          </p>
        )}
      </div>
    </section>
  );
}

function ImageCard({
  img,
  index,
  total,
  isBase,
}: {
  img: RefImage;
  index: number;
  total: number;
  isBase: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const previewUrl = useImageAssetUrl(img.assetId, img.dataUrl, "preview");

  const analyze = async () => {
    const a = getAnalyzer();
    if (!a) {
      toast.error(
        "No vision analyzer configured. Choose a provider and Vision model on the Models page.",
      );
      return;
    }
    const dataUrl = img.assetId ? await assetDataUrl(img.assetId, "preview") : img.dataUrl;
    if (!dataUrl) {
      toast.error("This slot has no image data.");
      return;
    }
    setBusy(true);
    try {
      const res = await a.analyze(dataUrl);
      actions.updateImage(img.id, { analysis: res });
      const props = (res.suggestedTargets ?? []).map((label) => ({
        id: uid(),
        label,
        type: "vision_proposal" as const,
        imageId: img.id,
      }));
      if (props.length) projectStore.update((p) => ({ ...p, targets: [...p.targets, ...props] }));
      toast.success(
        `Analyzed ${img.tag}: ${res.subjects.length} subject(s), ${res.suggestedTargets?.length ?? 0} suggested targets`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      id={`img-${img.id}`}
      className={cn("rounded border bg-card p-2", isBase && "border-lock/60")}
    >
      <div className="flex gap-2">
        <ImageThumb src={previewUrl} tag={img.tag} className="h-16 w-16 shrink-0 rounded border" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="tag-chip">{img.tag}</span>
            {isBase && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-lock">
                <Crown className="h-3 w-3" />
                BASE
              </span>
            )}
            <div className="ml-auto flex">
              <button
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => actions.moveImage(img.id, -1)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                aria-label="Move down"
                disabled={index === total - 1}
                onClick={() => actions.moveImage(img.id, 1)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
              <button
                aria-label="Analyze image"
                onClick={() => void analyze()}
                disabled={busy}
                className="rounded p-0.5 text-muted-foreground hover:text-primary disabled:animate-pulse"
              >
                <ScanSearch className="h-3 w-3" />
              </button>
              <button
                aria-label={`Delete ${img.tag}`}
                onClick={() => actions.removeImage(img.id)}
                className="rounded p-0.5 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
          <div className="truncate text-[11px]" title={img.filename}>
            {img.filename}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground">
            {img.width}×{img.height} · {img.assetId ? "original preserved" : "no local asset"}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <NSelect
          aria-label={`Role for ${img.tag}`}
          value={img.role}
          onChange={(e) => actions.setRole(img.id, e.target.value as Role)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </NSelect>
        <NSelect
          aria-label={`Importance for ${img.tag}`}
          value={img.importance}
          onChange={(e) =>
            actions.updateImage(img.id, { importance: e.target.value as Importance })
          }
        >
          {["Low", "Medium", "High", "Critical"].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </NSelect>
        {img.role === "Custom" && (
          <TInput
            className="col-span-2"
            placeholder="Custom role name"
            aria-label="Custom role"
            value={img.customRole ?? ""}
            onChange={(e) => actions.updateImage(img.id, { customRole: e.target.value })}
          />
        )}
        <TInput
          className="col-span-2"
          placeholder="Short description (optional)"
          aria-label="Description"
          value={img.description ?? ""}
          onChange={(e) => actions.updateImage(img.id, { description: e.target.value })}
        />
      </div>
      <div className="mt-1.5 space-y-1">
        <AttrChips
          label="Use for"
          tone="use"
          value={img.uses}
          onChange={(v) => actions.setImageUses(img.id, v)}
        />
        <AttrChips
          label="NOT for"
          tone="ex"
          value={img.excludes}
          onChange={(v) => actions.updateImage(img.id, { excludes: v })}
        />
        <AttrChips
          label="Exact lock"
          tone="use"
          value={img.locks}
          onChange={(v) => actions.setImageLocks(img.id, v)}
        />
      </div>
      {img.analysis && (
        <details className="mt-1.5 text-[11px]">
          <summary className="cursor-pointer text-muted-foreground">AI analysis</summary>
          <div className="mt-1 space-y-0.5 text-muted-foreground">
            {img.analysis.camera?.shot && (
              <div>
                Camera: {img.analysis.camera.shot} / {img.analysis.camera.angle}
              </div>
            )}
            {img.analysis.environment && <div>Env: {img.analysis.environment}</div>}
            {img.analysis.lighting && <div>Light: {img.analysis.lighting}</div>}
            {!!img.analysis.suggestedTargets?.length && (
              <div>Targets: {img.analysis.suggestedTargets.join(", ")}</div>
            )}
          </div>
        </details>
      )}
    </article>
  );
}
