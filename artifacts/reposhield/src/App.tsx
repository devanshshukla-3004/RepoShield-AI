import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, useLocation, Router as WouterRouter, Link } from 'wouter';
import { Activity, ArrowUpRight, CheckCircle2, CircleAlert, FileDown, FolderSearch, Gauge, ShieldCheck, Sparkles } from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Shell, PageTitle, ErrorBox } from '@/components/shell';
import { DemoButton, ScanForm, ScanMeta, ScanProgress } from '@/components/scan-panels';
import { FindingsTable } from '@/components/findings-table';
import { FindingDrawer } from '@/components/finding-drawer';
import { ScanProvider, useActiveScan } from '@/lib/shield';
import { useGetShieldStatus, type Finding, type Scan } from '@workspace/api-client-react';

const queryClient = new QueryClient();

function Stat({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: typeof ShieldCheck }) {
  return <div className="rounded-xl border bg-card p-4 md:p-5"><div className="flex items-center justify-between text-muted-foreground"><span className="text-sm">{label}</span><Icon className="size-4 text-primary" /></div><div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs text-muted-foreground">{note}</div></div>;
}

function Overview() {
  const { scans, listLoading, listError, refetchList, scan } = useActiveScan();
  const { data: runtime } = useGetShieldStatus();
  const findings = scans.flatMap(s => s.findings);
  const critical = findings.filter(f => f.severity === 'critical' && f.status === 'open').length;
  const open = findings.filter(f => f.status === 'open').length;
  const [picked, setPicked] = useState<{ scanId: string; finding: Finding } | null>(null);
  return <>
    <PageTitle title="Security overview" sub="Review potential secret exposures before code is shared." action={<DemoButton size="lg" redirect="/" />} />
    <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div className="flex gap-3"><div className="rounded-lg bg-primary/10 p-2.5"><ShieldCheck className="size-5 text-primary" /></div><div><div className="font-semibold">Repository protection, with evidence redaction by default</div><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Start with a synthetic demo to explore the workflow. Real scans require the local server, Gitleaks, and an explicitly configured scan root.</p></div></div><span className="rounded-full border border-primary/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary">{runtime?.realScanEnabled && runtime?.gitleaksAvailable ? 'Local scan available' : 'Demo mode ready'}</span></div></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Scans in this session" value={scans.length} note="Session-only history" icon={Activity} /><Stat label="Findings" value={findings.length} note="Across completed and active scans" icon={FolderSearch} /><Stat label="Open findings" value={open} note="Require triage" icon={CircleAlert} /><Stat label="Critical · open" value={critical} note="Prioritize review" icon={Gauge} /></div>
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><section className="rounded-xl border bg-card p-4 md:p-5"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">Latest scan</h2><Link href="/scan" className="text-xs text-primary hover:underline">New scan <ArrowUpRight className="inline size-3" /></Link></div>{listLoading ? <p className="text-sm text-muted-foreground">Loading session…</p> : listError ? <ErrorBox message="Could not load scans from the API." onRetry={refetchList} /> : scan ? <><ScanMeta scan={scan} /><div className="mt-3"><ScanProgress scan={scan} /></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-lg bg-muted/50 p-3"><div className="text-xl font-semibold">{scan.findings.length}</div><div className="text-xs text-muted-foreground">Findings</div></div><div className="rounded-lg bg-muted/50 p-3"><div className="text-xl font-semibold">{scan.filesAnalyzed ?? '—'}</div><div className="text-xs text-muted-foreground">Files analyzed</div></div><div className="rounded-lg bg-muted/50 p-3"><div className="text-xl font-semibold">{scan.status}</div><div className="text-xs text-muted-foreground">Status</div></div></div></> : <div className="py-8 text-center"><ShieldCheck className="mx-auto mb-3 size-8 text-primary" /><p className="font-medium">No scans yet</p><p className="mt-1 text-sm text-muted-foreground">Run a demo to explore the review workflow.</p><div className="mt-4"><DemoButton /></div></div>}</section>
      <section className="rounded-xl border bg-card p-4 md:p-5"><h2 className="font-semibold">Runtime status</h2><div className="mt-4 space-y-3 text-sm">{[["Gitleaks CLI", runtime?.gitleaksAvailable], ["Authorized local scanning", runtime?.realScanEnabled], ["Local Gemma / Ollama", runtime?.aiAvailable]].map(([label, value]) => <div key={String(label)} className="flex items-center justify-between gap-3 border-b pb-3 last:border-0"><span className="text-muted-foreground">{label}</span><span className={`inline-flex items-center gap-1.5 ${value ? 'text-emerald-400' : 'text-amber-300'}`}>{value ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}{value ? 'Available' : 'Not available'}</span></div>)}</div><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{runtime?.message ?? 'Checking local runtime capabilities…'}</p></section></div>
    <section className="mt-6 rounded-xl border bg-card p-4 md:p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Recent findings</h2><Link href="/findings" className="text-xs text-primary hover:underline">View all</Link></div>{findings.length ? <FindingsTable findings={findings.slice(0, 5)} onOpen={f => { const owner = scans.find(s => s.findings.some(x => x.id === f.id)); if (owner) setPicked({ scanId: owner.id, finding: f }); }} /> : <p className="py-6 text-center text-sm text-muted-foreground">Findings will appear here after a scan.</p>}</section>
    {picked && <FindingDrawer scanId={picked.scanId} finding={picked.finding} aiAvailable={!!runtime?.aiAvailable} onClose={() => setPicked(null)} />}
  </>;
}

function ScanPage() { return <><PageTitle title="Scan repository" sub="Choose a clearly labelled demo scan or scan an authorized local repository." /><ScanForm /></>; }
function FindingsPage() {
  const { scans } = useActiveScan(); const { data: runtime } = useGetShieldStatus();
  const all = scans.flatMap(s => s.findings.map(f => ({ scanId: s.id, finding: f })));
  const [picked, setPicked] = useState<{ scanId: string; finding: Finding } | null>(null);
  return <><PageTitle title="Findings" sub="Filter, review, and triage masked potential exposures." /><div className="mb-4 flex flex-wrap gap-2 text-xs text-muted-foreground"><span className="rounded border px-2 py-1">{all.length} total</span><span className="rounded border px-2 py-1">Synthetic demo findings are not real detections</span></div><FindingsTable findings={all.map(x => x.finding)} filters onOpen={f => { const row = all.find(x => x.finding.id === f.id); if (row) setPicked(row); }} />{picked && <FindingDrawer scanId={picked.scanId} finding={picked.finding} aiAvailable={!!runtime?.aiAvailable} onClose={() => setPicked(null)} />}</>;
}
function ReportsPage() {
  const { scans } = useActiveScan();
  const download = (scan: Scan, format: 'json' | 'md') => {
    const notice = scan.mode === 'demo' ? 'SYNTHETIC DEMO — no repository scanned, no real credentials.' : 'Authorized working-tree scan. Not a security guarantee. Git history is not scanned.';
    const report = { application: 'RepoShield AI', version: 1, mode: scan.mode, notice, status: scan.status, createdAt: scan.createdAt, durationMs: scan.durationMs, filesAnalyzed: scan.filesAnalyzed, findings: scan.findings, limitations: 'Potential false positives and false negatives. Raw evidence is redacted. AI explanations are not detection results.' };
    const content = format === 'json' ? JSON.stringify(report, null, 2) : `# RepoShield AI — sanitized report\n\n${notice}\n\nStatus: ${scan.status}\n\n${scan.findings.map(f => `## ${f.title}\n- Severity: ${f.severity}\n- Category: ${f.category}\n- Location: ${f.filePath}:${f.line}\n- Status: ${f.status}\n- Evidence: ${f.evidence}\n\n${f.explanation}\n\n### Remediation\n${f.remediation}`).join('\n\n')}`;
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `reposhield-${scan.mode}-${scan.id.slice(0, 8)}.${format}`; a.click(); URL.revokeObjectURL(url);
  };
  return <><PageTitle title="Reports" sub="Export sanitized scan summaries without raw secret values." />{scans.length ? <div className="space-y-3">{scans.map(s => <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4"><div><div className="font-medium">{s.mode === 'demo' ? 'Synthetic demo report' : 'Local repository report'}</div><div className="mt-1 text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()} · {s.findings.length} findings · {s.status}</div><p className="mt-1 text-xs text-muted-foreground">{s.mode === 'demo' ? 'No repository was inspected.' : 'Working-tree scan; Git history is not scanned.'}</p></div><div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent" onClick={() => download(s, 'json')}><FileDown className="size-3.5" /> JSON</button><button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-accent" onClick={() => download(s, 'md')}><FileDown className="size-3.5" /> Markdown</button></div></div>)}</div> : <div className="rounded-xl border bg-card p-10 text-center"><FileDown className="mx-auto mb-3 size-8 text-primary" /><p className="font-medium">No reports yet</p><p className="mt-1 text-sm text-muted-foreground">Run a scan first, then export its sanitized report.</p><Link href="/scan" className="mt-4 inline-block text-sm text-primary hover:underline">Go to Scan Repository</Link></div>}</>;
}
type RuntimeSettings = {
  useLocalAi: boolean;
  timeoutSeconds: number;
  redactEvidence: true;
  retainSource: false;
};

function SettingsPage() {
  const { data: runtime, isLoading, error } = useGetShieldStatus();
  const [settings, setSettings] = useState<RuntimeSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/shield/settings', { credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Could not load settings from the local API.');
        return response.json() as Promise<RuntimeSettings>;
      })
      .then((value) => { if (active) setSettings(value); })
      .catch((err: unknown) => {
        if (active) setSettingsError(err instanceof Error ? err.message : 'Settings could not be loaded.');
      })
      .finally(() => { if (active) setLoadingSettings(false); });
    return () => { active = false; };
  }, []);

  async function saveLocalAi(enabled: boolean) {
    if (!settings) return;
    setSaving(true);
    setSettingsError(null);
    setSaved(false);
    try {
      const response = await fetch('/api/shield/settings', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settings, useLocalAi: enabled, redactEvidence: true, retainSource: false }),
      });
      if (!response.ok) throw new Error('Settings were rejected by the API. Restart the local app and try again.');
      const value = await response.json() as RuntimeSettings;
      setSettings(value);
      setSaved(true);
    } catch (err) {
      setSettingsError(err instanceof Error ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <PageTitle title="Settings & runtime" sub="Privacy-preserving defaults and local integrations." />
    {(error || settingsError) && <ErrorBox message={settingsError ?? 'Could not retrieve runtime status.'} />}
    <div className="grid gap-4 md:grid-cols-2">
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Privacy controls</h2>
        <div className="mt-4 space-y-3 text-sm">{['Evidence redaction is mandatory','Raw repository source is not retained','Absolute paths are withheld from scan results','Session data expires after two hours or server restart'].map(t => <div key={t} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" /><span>{t}</span></div>)}</div>
      </section>
      <section className="rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Integrations</h2>
        <div className="mt-4 space-y-4 text-sm">
          {[["Gitleaks", runtime?.gitleaksAvailable, 'Deterministic secret detection'], ["Ollama · gemma3:1b", runtime?.aiAvailable, 'Optional local explanations']].map(([name, ok, detail]) => <div key={String(name)} className="flex items-start justify-between gap-3"><div><div className="font-medium">{name}</div><div className="text-xs text-muted-foreground">{detail}</div></div><span className={`text-xs ${ok ? 'text-emerald-400' : 'text-amber-300'}`}>{isLoading ? 'Checking…' : ok ? 'Connected' : 'Not detected'}</span></div>)}
        </div>
        <div className="mt-5 rounded-lg border bg-background/50 p-3">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-primary"
              checked={settings?.useLocalAi ?? false}
              disabled={loadingSettings || saving || !settings}
              onChange={(event) => void saveLocalAi(event.target.checked)}
              aria-label="Enable local Gemma AI explanations"
            />
            <span>
              <span className="block font-medium">Enable local Gemma explanations</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Uses Ollama on this same machine. Only server-defined finding type, category, severity, and rule metadata are sent to the local model—never source code, raw evidence, or repository paths.</span>
            </span>
          </label>
          {loadingSettings && <p className="mt-2 text-xs text-muted-foreground">Loading saved settings…</p>}
          {saving && <p className="mt-2 text-xs text-muted-foreground">Saving setting…</p>}
          {saved && <p className="mt-2 text-xs text-emerald-400">Local AI preference saved.</p>}
          {settingsError && <p className="mt-2 text-xs text-amber-300">{settingsError}</p>}
          {!runtime?.aiAvailable && <p className="mt-2 text-xs text-amber-300">Gemma is not detected yet. Install Ollama, run `ollama pull gemma3:1b`, and refresh this page.</p>}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{runtime?.message}</p>
      </section>
    </div>
    <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm"><strong>Safety note:</strong> Run real scans only against repositories you own or have explicit permission to inspect. Demo findings are synthetic and must never be presented as real detections.</div>
  </>;
}
function AboutPage() { return <><PageTitle title="About RepoShield AI" sub="A local-first security review helper built for a friend before sharing code." /><div className="space-y-5 rounded-xl border bg-card p-5 md:p-7"><div className="flex items-start gap-3"><div className="rounded-lg bg-primary/10 p-3"><Sparkles className="size-5 text-primary" /></div><div><h2 className="text-lg font-semibold">Why open innovation matters</h2><p className="mt-2 leading-relaxed text-muted-foreground">Open tools make security review more transparent and adaptable: developers can inspect the scanner, verify how evidence is redacted, contribute new rules, and run the workflow on their own machines. Local inference can reduce the need to send sensitive repository context to a hosted AI service.</p></div></div><div><h2 className="font-semibold">How it works</h2><ol className="mt-2 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground"><li>Gitleaks performs deterministic secret detection when configured for local use.</li><li>RepoShield sanitizes findings and withholds secret values.</li><li>Optional Ollama/Gemma explanations use generic finding categories rather than raw source code or evidence.</li><li>Reports are labelled by scan mode and include limitations.</li></ol></div><div><h2 className="font-semibold">Important limitations</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">A clean scan is not a guarantee of security. The scanner may produce false positives or miss secrets; the local scanner covers the working tree, not the full Git history. AI guidance is advisory and must be reviewed.</p></div></div></>; }
function NotFound() { return <PageTitle title="Page not found" sub="Use the navigation to return to RepoShield AI." />; }
function RoutedErrorBoundary({ children }: { children: React.ReactNode }) { const [location] = useLocation(); return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>; }
function AppRoutes() { return <ScanProvider><Shell><RoutedErrorBoundary><Switch><Route path="/" component={Overview} /><Route path="/scan" component={ScanPage} /><Route path="/findings" component={FindingsPage} /><Route path="/reports" component={ReportsPage} /><Route path="/settings" component={SettingsPage} /><Route path="/about" component={AboutPage} /><Route component={NotFound} /></Switch></RoutedErrorBoundary></Shell></ScanProvider>; }
function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AppRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
export default App;
