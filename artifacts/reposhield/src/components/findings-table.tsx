import { useMemo, useState } from 'react';
import type { Finding } from '@workspace/api-client-react';
import { SEV_STYLE, STATUS_STYLE } from '@/lib/shield';
import { cn } from '@/lib/utils';

const ORDER = { critical: 0, high: 1, medium: 2, low: 3 } as const;

export function FindingsTable({
  findings, onOpen, filters = false,
}: { findings: Finding[]; onOpen: (f: Finding) => void; filters?: boolean }) {
  const [sev, setSev] = useState('all');
  const [st, setSt] = useState('all');
  const rows = useMemo(
    () =>
      findings
        .filter((f) => (sev === 'all' || f.severity === sev) && (st === 'all' || f.status === st))
        .sort((a, b) => ORDER[a.severity] - ORDER[b.severity]),
    [findings, sev, st],
  );
  const sel = 'rounded-md border bg-card px-2 py-1.5 text-xs';
  return (
    <div>
      {filters && (
        <div className="mb-3 flex gap-2">
          <select aria-label="Severity" className={sel} value={sev} onChange={(e) => setSev(e.target.value)} data-testid="select-severity">
            <option value="all">All severities</option>
            {Object.keys(ORDER).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select aria-label="Status" className={sel} value={st} onChange={(e) => setSt(e.target.value)} data-testid="select-status">
            <option value="all">All statuses</option>
            <option value="open">open</option>
            <option value="resolved">resolved</option>
            <option value="ignored">ignored</option>
          </select>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {['Severity', 'Category', 'File', 'Line', 'Evidence', 'Status'].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr
                key={f.id}
                tabIndex={0}
                onClick={() => onOpen(f)}
                onKeyDown={(e) => e.key === 'Enter' && onOpen(f)}
                data-testid={`row-finding-${f.id}`}
                className="cursor-pointer border-b last:border-0 transition-colors hover:bg-accent/40 focus:bg-accent/40 focus:outline-none"
              >
                <td className="px-3 py-2.5">
                  <span className={cn('rounded border px-2 py-0.5 font-mono text-[11px] uppercase', SEV_STYLE[f.severity])}>{f.severity}</span>
                </td>
                <td className="px-3 py-2.5">{f.category}</td>
                <td className="px-3 py-2.5 font-mono text-xs max-w-[240px] truncate" title={f.filePath}>{f.filePath}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{f.line}</td>
                <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground max-w-[200px] truncate">{f.evidence}</td>
                <td className={cn('px-3 py-2.5 capitalize', STATUS_STYLE[f.status])}>{f.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No findings match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
