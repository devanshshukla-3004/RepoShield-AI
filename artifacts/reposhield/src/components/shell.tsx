import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  FileText, LayoutDashboard, ScanSearch, Settings as Cog, ShieldCheck, ListChecks, BookOpenText, HardDrive,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/scan', label: 'Scan Repository', icon: ScanSearch },
  { href: '/findings', label: 'Findings', icon: ListChecks },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Cog },
  { href: '/about', label: 'About / Open Innovation', icon: BookOpenText },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid size-8 place-items-center rounded-md bg-primary/15 ring-1 ring-primary/40">
        <ShieldCheck className="size-4.5 text-primary" />
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight">RepoShield <span className="text-primary">AI</span></div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">secret review</div>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const active = (h: string) => (h === '/' ? loc === '/' : loc.startsWith(h));
  return (
    <div className="min-h-[100dvh] md:flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-[100dvh]">
        <div className="px-5 py-5"><Brand /></div>
        <nav className="flex flex-col gap-0.5 px-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              data-testid={`link-nav-${n.label.split(' ')[0].toLowerCase()}`}
              className={cn(
                'group flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60',
                active(n.href) && 'bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_2px_0_0_hsl(var(--primary))]',
              )}
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto m-3 rounded-md border border-sidebar-border p-3 text-xs text-muted-foreground leading-relaxed">
          Session lives in server memory only. It expires after 2 hours or on restart.
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/85 backdrop-blur px-4 md:px-8 h-14">
          <div className="md:hidden"><Brand /></div>
          <div className="hidden md:block font-mono text-xs text-muted-foreground">
            {NAV.find((n) => active(n.href))?.label ?? 'Not found'}
          </div>
          <span
            data-testid="badge-local-first"
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 font-mono text-[11px] text-primary"
          >
            <HardDrive className="size-3" /> Local-first
          </span>
        </header>
        <nav className="md:hidden flex gap-1 overflow-x-auto border-b border-border px-3 py-2">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                'shrink-0 rounded-md px-3 py-1.5 text-xs text-muted-foreground',
                active(n.href) && 'bg-accent text-accent-foreground',
              )}
            >
              {n.label.replace(' / Open Innovation', '')}
            </Link>
          ))}
        </nav>
        <main className="px-4 md:px-8 py-6 md:py-8 max-w-6xl animate-rise">{children}</main>
      </div>
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm flex items-center justify-between gap-3" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded border border-destructive/50 px-3 py-1 text-xs hover:bg-destructive/20" data-testid="button-retry">
          Retry
        </button>
      )}
    </div>
  );
}
