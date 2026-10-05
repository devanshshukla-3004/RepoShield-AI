import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetScanQueryKey, getListScansQueryKey, getGetReportQueryKey,
  useExplainFinding, useUpdateFinding, type Explanation, type Finding,
} from '@workspace/api-client-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Copy, Sparkles, Loader2 } from 'lucide-react';
import { SEV_STYLE, errMsg } from '@/lib/shield';
import { cn } from '@/lib/utils';

export function FindingDrawer({
  scanId, finding, aiAvailable, onClose,
}: { scanId: string; finding: Finding | null; aiAvailable: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [exp, setExp] = useState<Explanation | null>(null);
  useEffect(() => setExp(null), [finding?.id]);

  const update = useUpdateFinding({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetScanQueryKey(scanId) });
        qc.invalidateQueries({ queryKey: getListScansQueryKey() });
        qc.invalidateQueries({ queryKey: getGetReportQueryKey(scanId) });
      },
      onError: (e) => toast({ title: 'Status not updated', description: errMsg(e), variant: 'destructive' }),
    },
  });
  const explain = useExplainFinding({
    mutation: {
      onSuccess: (r) => setExp(r),
      onError: (e) => toast({ title: 'Explanation unavailable', description: errMsg(e), variant: 'destructive' }),
    },
  });

  const copy = async () => {
    if (!finding) return;
    try {
      await navigator.clipboard.writeText(`${finding.title} (${finding.filePath}:${finding.line})\n\nRisk: ${finding.risk}\n\nRemediation: ${finding.remediation}`);
      toast({ title: 'Guidance copied', description: 'Contains no secret value.' });
    } catch {
      toast({ title: 'Copy blocked by browser', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={!!finding} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-card" data-testid="drawer-finding">
        {finding && (
          <>
            <SheetHeader className="text-left">
              <span className={cn('w-fit rounded border px-2 py-0.5 font-mono text-[11px] uppercase', SEV_STYLE[finding.severity])}>
                {finding.severity}
              </span>
              <SheetTitle className="text-xl">{finding.title}</SheetTitle>
              <SheetDescription className="font-mono text-xs break-all">
                {finding.filePath}:{finding.line} · {finding.ruleId}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-5 px-4 pb-6 text-sm">
              <div>
                <Label>Masked evidence</Label>
                <code className="block rounded border bg-background px-3 py-2 font-mono text-xs break-all" data-testid="text-evidence">{finding.evidence}</code>
              </div>
              <Block label="Explanation" text={finding.explanation} />
              <Block label="Risk" text={finding.risk} />
              <Block label="Remediation" text={finding.remediation} />
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={copy} data-testid="button-copy-guidance">
                  <Copy className="size-3.5" /> Copy safe guidance
                </Button>
                <Button
                  size="sm" variant="outline"
                  disabled={explain.isPending}
                  onClick={() => explain.mutate({ id: scanId, findingId: finding.id })}
                  data-testid="button-explain"
                >
                  {explain.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Explain this finding
                </Button>
              </div>
              {!aiAvailable && (
                <p className="text-xs text-muted-foreground">Local AI is not available; explanations use the deterministic fallback.</p>
              )}
              {exp && (
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3 animate-rise" data-testid="panel-explanation">
                  <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-primary">
                    Source: {exp.source}{exp.model ? ` · ${exp.model}` : ''}
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{exp.text}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Reason: {exp.reason}</p>
                </div>
              )}
              <div>
                <Label>Status</Label>
                <div className="inline-flex rounded-md border p-0.5">
                  {(['open', 'resolved', 'ignored'] as const).map((s) => (
                    <button
                      key={s}
                      disabled={update.isPending}
                      data-testid={`button-status-${s}`}
                      onClick={() => update.mutate({ id: scanId, findingId: finding.id, data: { status: s } })}
                      className={cn(
                        'rounded px-3 py-1.5 text-xs capitalize transition-colors text-muted-foreground hover:text-foreground',
                        finding.status === s && 'bg-primary text-primary-foreground hover:text-primary-foreground',
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Label({ children }: { children: string }) {
  return <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{children}</div>;
}
function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
