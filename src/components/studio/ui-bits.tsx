import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ATTR_LABEL } from "@/lib/constants";
import type { Attribute } from "@/lib/types";
import { ATTRIBUTES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import { forwardRef, type ReactNode, type SelectHTMLAttributes } from "react";

export const NSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function NSelect({ className, ...p }, ref) {
    return (
      <select
        ref={ref}
        {...p}
        className={cn(
          "h-7 min-w-0 rounded border border-input bg-panel-2 px-1.5 text-[12px] text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50",
          className,
        )}
      />
    );
  },
);

export function Field({
  label,
  children,
  className,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export const TInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function TInput({ className, ...p }, ref) {
    return (
      <input
        ref={ref}
        {...p}
        className={cn(
          "h-7 min-w-0 rounded border border-input bg-panel-2 px-2 text-[12px] placeholder:text-muted-foreground/60",
          className,
        )}
      />
    );
  },
);

export function SectionHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b px-3">
      <h2 className="panel-title">{title}</h2>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

export function AttrChips({
  value,
  onChange,
  tone,
  label,
}: {
  value: Attribute[];
  onChange: (v: Attribute[]) => void;
  tone: "use" | "ex";
  label: string;
}) {
  const cls =
    tone === "use"
      ? "border-free/40 bg-free/10 text-free"
      : "border-destructive/40 bg-destructive/10 text-destructive";
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-14 shrink-0 text-[10.5px] text-muted-foreground">{label}</span>
      {value.map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => onChange(value.filter((x) => x !== a))}
          aria-label={`Remove ${ATTR_LABEL[a]}`}
          className={cn(
            "inline-flex items-center gap-0.5 rounded border px-1.5 py-px text-[10.5px]",
            cls,
          )}
        >
          {ATTR_LABEL[a]}
          <X className="h-2.5 w-2.5" />
        </button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Add ${label} attribute`}
            className="inline-flex h-4 w-4 items-center justify-center rounded border border-dashed text-muted-foreground hover:text-foreground"
          >
            <Plus className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-1.5" align="start">
          <div className="grid grid-cols-2 gap-0.5">
            {ATTRIBUTES.map((a) => {
              const on = value.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => onChange(on ? value.filter((x) => x !== a) : [...value, a])}
                  className={cn(
                    "rounded px-1.5 py-1 text-left text-[11px] hover:bg-secondary",
                    on && cls,
                  )}
                >
                  {ATTR_LABEL[a]}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function ImageThumb({
  src,
  tag,
  className,
}: {
  src?: string | undefined;
  tag: string;
  className?: string;
}) {
  return src ? (
    <img src={src} alt={`${tag} thumbnail`} className={cn("object-cover", className)} />
  ) : (
    <div
      className={cn(
        "flex items-center justify-center bg-[repeating-linear-gradient(45deg,var(--color-panel-2),var(--color-panel-2)_6px,var(--color-panel)_6px,var(--color-panel)_12px)] font-mono text-[10px] text-muted-foreground",
        className,
      )}
    >
      {tag}
    </div>
  );
}
