import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  getGetScanQueryKey,
  useGetScan,
  useListScans,
  type Scan,
} from '@workspace/api-client-react';

export function errMsg(err: unknown): string {
  const e = err as { data?: { error?: string; message?: string; detail?: string } | string; message?: string; status?: number } | null;
  if (!e) return 'Something went wrong.';
  if (typeof e.data === 'string' && e.data) return e.data;
  if (e.data && typeof e.data === 'object') {
    const m = e.data.error ?? e.data.message ?? e.data.detail;
    if (m) return String(m);
  }
  if (e.status === 401 || e.status === 403) return 'Not permitted. Real scans may be disabled on this server.';
  if (e.status && e.status >= 500) return 'The local server hit an error. Try again in a moment.';
  return e.message || 'Could not reach the local RepoShield server.';
}

export const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  medium: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  low: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
};
export const STATUS_STYLE: Record<string, string> = {
  open: 'text-amber-300',
  resolved: 'text-emerald-300',
  ignored: 'text-muted-foreground',
};

export function fmtDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

type Ctx = {
  scans: Scan[];
  listLoading: boolean;
  listError: unknown;
  refetchList: () => void;
  scan: Scan | undefined;
  scanLoading: boolean;
  selectedId: string | null;
  select: (id: string) => void;
};
const ScanCtx = createContext<Ctx | null>(null);

export function ScanProvider({ children }: { children: ReactNode }) {
  const list = useListScans();
  const [picked, setPicked] = useState<string | null>(() => sessionStorage.getItem('rs-scan'));
  const scans = useMemo(
    () => [...(list.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [list.data],
  );
  const selectedId = picked && scans.some((s) => s.id === picked) ? picked : (scans[0]?.id ?? null);
  const id = selectedId ?? '';
  const q = useGetScan(id, {
    query: {
      enabled: !!selectedId,
      queryKey: getGetScanQueryKey(id),
      refetchInterval: (query) => (query.state.data?.status === 'running' ? 1000 : false),
    },
  });
  const status = q.data?.status;
  const { refetch } = list;
  useEffect(() => {
    if (status && status !== 'running') refetch();
  }, [status, refetch]);
  const value: Ctx = {
    scans,
    listLoading: list.isLoading,
    listError: list.error,
    refetchList: () => void list.refetch(),
    scan: selectedId ? q.data : undefined,
    scanLoading: !!selectedId && q.isLoading,
    selectedId,
    select: (s) => {
      sessionStorage.setItem('rs-scan', s);
      setPicked(s);
    },
  };
  return <ScanCtx.Provider value={value}>{children}</ScanCtx.Provider>;
}

export function useActiveScan() {
  const c = useContext(ScanCtx);
  if (!c) throw new Error('ScanProvider missing');
  return c;
}
