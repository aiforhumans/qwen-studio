import { useApplySettings } from "@/hooks/use-apply-settings";
import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";
import { type ReactNode } from "react";

const NAV = [
  { to: "/", label: "Studio" },
  { to: "/lab", label: "Lab" },
  { to: "/templates", label: "Templates" },
  { to: "/history", label: "History" },
  { to: "/learning", label: "Learning" },
  { to: "/models", label: "Models" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppShell({ children, right }: { children: ReactNode; right?: ReactNode }) {
  useApplySettings();
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-11 shrink-0 items-center gap-4 border-b bg-panel px-3">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Layers className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-[13px] font-semibold">Qwen Image 2.1</span>
          <span className="hidden text-[12px] text-muted-foreground md:inline">
            Advanced Prompt Studio
          </span>
        </div>
        <nav aria-label="Main" className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: true }}
              className="rounded px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "bg-secondary !text-foreground" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        {right}
      </header>
      <main className="min-h-0 flex-1">{children}</main>
    </div>
  );
}

export function PageFrame({
  title,
  desc,
  children,
  actions,
}: {
  title: string;
  desc?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <AppShell>
      <div className="h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
            <div>
              <h1 className="text-lg font-semibold">{title}</h1>
              {desc && <p className="mt-1 text-muted-foreground">{desc}</p>}
            </div>
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
          {children}
        </div>
      </div>
    </AppShell>
  );
}
