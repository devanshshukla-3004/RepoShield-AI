import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getListScansQueryKey, useGetShieldStatus, useStartScan } from '@workspace/api-client-react';
import type { Scan } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { FlaskConical, FolderSearch, Loader2 } from 'lucide-react';
import { errMsg, fmtDuration, useActiveScan } from '@/lib/shield';
import { ErrorBox } from '@/components/shell';

export function useLaunch(redirect?: string) {
  const qc = useQueryClient();
  const { select } = useActiveScan();
  const { toast } = useToast();
  const [, nav] = useLocation();
  return useStartScan({
    mutation: {
      onSuccess: (s) => {
        select(s.id);
        qc.setQueryData(['/api/shield/scans/' + s.id], s);
        qc.invalidateQueries({ queryKey: getListScansQueryKey() });
        if (redirect) nav(redirect);
      },
      onError: (e) => toast({ title: 'Scan not started', description: errMsg(e), variant: 'destructive' }),
    },
  });
}

export function DemoButton({ redirect, size }: { redirect?: string; size?: 'lg' | 'default' }) {
  const m = useLaunch(redirect);
  return (
    <Button size={size} disabled={m.isPending} onClick={() => m.mutate({ data: { mode: 'demo', authorized: false } })} data-testid="button-demo-scan">
      {m.isPending ? <Loader2 className="size-4 animate-spin" /> : <FlaskConical className="size-4" />}
      Run Demo Scan
    </Button>
  );
}

export function ScanForm() {
  const { data: status } = useGetShieldStatus();
  const m = useLaunch('/');
  const [path, setPath] = useState('');
  const [ok, setOk] = useState(false);
  const enabled = status?.realScanEnabled && status?.gitleaksAvailable;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-lg border bg-card p-5">
        <FlaskConical className="size-5 text-primary mb-3" />
        <h2 className="font-semibold">Demo Scan</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Runs against bundled synthetic sample data. Every finding is fabricated for illustration and is not from your code.
        </p>
        <DemoButton redirect="/" />
      </section>
      <section className="rounded-lg border bg-card p-5">
        <FolderSearch className="size-5 text-primary mb-3" />
        <h2 className="font-semibold">Local server path</h2>
        <p className="mt-1 mb-3 text-sm text-muted-foreground">A directory on the machine running the RepoShield server. Nothing is uploaded.</p>
        {status && !enabled && (
          <p className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200" data-testid="text-real-scan-disabled">
            Real scanning is unavailable: {!status.realScanEnabled ? 'it is disabled on this server by default' : 'Gitleaks was not found'}. {status.message}
          </p>
        )}
        <Input
          placeholder="/home/dev/projects/my-repo" maxLength={512} value={path}
          onChange={(e) => setPath(e.target.value)} className="font-mono text-xs" data-testid="input-path"
        />
        <label className="mt-3 flex items-start gap-2.5 text-sm cursor-pointer">
          <Checkbox checked={ok} onCheckedChange={(v) => setOk(v === true)} className="mt-0.5" data-testid="checkbox-authorized" />
          <span>I own this repository or have explicit authorization to scan it.</span>
        </label>
        <Button
          className="mt-4" disabled={!enabled || !ok || !path.trim() || m.isPending}
          onClick={() => m.mutate({ data: { mode: 'local', path: path.trim(), authorized: true } })}
          data-testid="button-start-local"
        >
          {m.isPending && <Loader2 className="size-4 animate-spin" />} Start local scan
        </Button>
      </section>
    </div>
  );
}

export function ScanProgress({ scan }: { scan: Scan }) {
  const { refetchList } = useActiveScan();
  if (scan.status === 'failed') {
    return <ErrorBox message={`Scan failed: ${scan.error ?? 'unknown error'}`} onRetry={refetchList} />;
  }
  if (scan.status !== 'running') return null;
  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4" data-testid="panel-progress">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Scanning {scan.repository}</span>
        <span className="font-mono text-xs text-primary">Working</span>
      </div>
      <div className="relative mt-3 h-1.5 overflow-hidden rounded bg-muted">
        <div className="animate-sweep absolute inset-y-0 w-1/4 rounded bg-primary" />
      </div>
      <p className="mt-2 font-mono text-xs text-muted-foreground" data-testid="text-stage">Stage: {scan.stage}</p>
    </div>
  );
}

export function ScanMeta({ scan }: { scan: Scan }) {
  return (
    <p className="text-xs text-muted-foreground font-mono">
      {scan.mode === 'demo' ? 'Synthetic demo' : 'Local scan'} · {scan.repository} · {new Date(scan.createdAt).toLocaleString()}
    </p>
  );
}

export function GoScan() {
  return <Link href="/scan" className="text-sm text-primary hover:underline">Open Scan Repository</Link>;
}
