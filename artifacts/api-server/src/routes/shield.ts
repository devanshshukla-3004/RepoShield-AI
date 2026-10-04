import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import {
  SaveSettingsBody, StartScanBody, UpdateFindingBody, GetShieldStatusResponse,
  GetSettingsResponse, SaveSettingsResponse, ListScansResponse, StartScanResponse,
  GetScanResponse, UpdateFindingResponse, ExplainFindingResponse, GetReportResponse,
} from "@workspace/api-zod";
import { defaultSettings, demoFindings, makeReport, type Scan } from "../lib/shield-core";
import { gitleaksAvailable, realScanEnabled, validatePath, scanDirectory } from "../lib/shield-scanner";
import { aiStatus, explain } from "../lib/shield-ai";

type Session = { expires: number; settings: typeof defaultSettings; scans: Scan[] };
const sessions = new Map<string, Session>();
const router: IRouter = Router();
router.use("/shield", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Same-origin mutations; no cross-site drive-by scanning or settings changes.
  if (!["GET", "HEAD"].includes(req.method)) {
    const origin = req.get("origin");
    if (req.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).host !== req.get("host"))) {
      res.status(403).json({ error: "Cross-origin requests are not permitted." }); return;
    }
  }
  for (const [id, session] of sessions) if (session.expires < Date.now()) sessions.delete(id);
  const cookie = req.headers.cookie?.split(";").map(v => v.trim()).find(v => v.startsWith("rs_session="))?.slice(11);
  let session = cookie ? sessions.get(cookie) : undefined;
  if (!session) {
    if (sessions.size >= 100) { res.status(503).json({ error: "Demo session capacity reached. Try later." }); return; }
    const id = randomUUID();
    session = { expires: Date.now() + 2 * 3600000, settings: { ...defaultSettings }, scans: [] };
    sessions.set(id, session);
    res.setHeader("Set-Cookie", `rs_session=${id}; Path=/api/shield; HttpOnly; SameSite=Strict; Max-Age=7200${req.secure || req.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`);
  }
  res.locals.session = session;
  next();
});
const sessionOf = (res: { locals: Record<string, unknown> }) => res.locals.session as Session;
router.get("/shield/status", async (_req, res): Promise<void> => {
  const [gitleaks, ai] = await Promise.all([gitleaksAvailable(), aiStatus()]);
  res.json(GetShieldStatusResponse.parse({ gitleaksAvailable: gitleaks, realScanEnabled: realScanEnabled(), aiAvailable: ai, aiModel: "gemma3:1b",
    message: "Hosted demo uses synthetic findings. Real scans require an opt-in local CLI server and a dedicated scan root. Hosted processing is not on your computer. Sessions expire after two hours or server restart." }));
});
router.get("/shield/settings", (_req, res) => { res.json(GetSettingsResponse.parse(sessionOf(res).settings)); });
router.put("/shield/settings", (req, res) => {
  const parsed = SaveSettingsBody.safeParse(req.body);
  if (!parsed.success || parsed.data.redactEvidence !== true || parsed.data.retainSource !== false) {
    res.status(400).json({ error: "Invalid settings. Evidence redaction is mandatory and source retention is prohibited." }); return;
  }
  sessionOf(res).settings = parsed.data;
  res.json(SaveSettingsResponse.parse(parsed.data));
});
router.get("/shield/scans", (_req, res) => { res.json(ListScansResponse.parse(sessionOf(res).scans)); });
router.post("/shield/scans", async (req, res): Promise<void> => {
  const parsed = StartScanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid scan request." }); return; }
  const session = sessionOf(res);
  if (session.scans.some(scan => scan.status === "running")) { res.status(409).json({ error: "Wait for your active scan to finish." }); return; }
  let target: string | undefined;
  if (parsed.data.mode === "local") {
    if (!parsed.data.authorized) { res.status(403).json({ error: "Confirm you have permission to scan this repository." }); return; }
    try { target = await validatePath(parsed.data.path ?? ""); }
    catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : "Path validation failed." }); return; }
    if (!(await gitleaksAvailable())) { res.status(503).json({ error: "Install Gitleaks locally first. Demo Scan remains available." }); return; }
  }
  const started = Date.now();
  const scan: Scan = { id: randomUUID(), mode: parsed.data.mode, repository: target ? "Local repository (path withheld)" : "friend-project / synthetic demo",
    status: "running", progress: 0, stage: target ? "Gitleaks scanning working tree" : "Preparing synthetic demo",
    createdAt: new Date().toISOString(), durationMs: 0, filesAnalyzed: null, findings: [], error: null };
  session.scans.unshift(scan);
  if (session.scans.length > 20) session.scans.pop();
  res.status(202).json(StartScanResponse.parse(scan));
  if (!target) {
    setTimeout(() => { scan.progress = 35; scan.stage = "Loading synthetic fixtures (not scanning files)"; }, 600);
    setTimeout(() => { scan.progress = 75; scan.stage = "Preparing sanitized demo findings"; }, 1300);
    setTimeout(() => { scan.findings = demoFindings(); scan.filesAnalyzed = 12; scan.progress = 100; scan.status = "completed"; scan.stage = "Synthetic demo complete — no repository inspected"; scan.durationMs = Date.now() - started; }, 2200);
  } else {
    void scanDirectory(target, session.settings.timeoutSeconds).then(findings => {
      scan.findings = findings; scan.status = "completed"; scan.progress = 100; scan.stage = "Working-tree scan complete (file count unavailable)";
    }).catch(() => { scan.status = "failed"; scan.error = "Gitleaks failed, timed out, or returned an unsupported report. Check the local CLI version (8.24+) and rescan."; scan.stage = "Scan failed"; })
      .finally(() => { scan.durationMs = Date.now() - started; });
  }
});
router.get("/shield/scans/:id", (req, res) => {
  const scan = sessionOf(res).scans.find(s => s.id === req.params.id);
  if (!scan) { res.status(404).json({ error: "Scan not found in this session. Run a new scan." }); return; }
  res.json(GetScanResponse.parse(scan));
});
router.patch("/shield/scans/:id/findings/:findingId", (req, res) => {
  const parsed = UpdateFindingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid triage status." }); return; }
  const finding = sessionOf(res).scans.find(s => s.id === req.params.id)?.findings.find(f => f.id === req.params.findingId);
  if (!finding) { res.status(404).json({ error: "Finding not found." }); return; }
  finding.status = parsed.data.status;
  res.json(UpdateFindingResponse.parse(finding));
});
router.post("/shield/scans/:id/findings/:findingId/explain", async (req, res): Promise<void> => {
  const session = sessionOf(res);
  const finding = session.scans.find(s => s.id === req.params.id)?.findings.find(f => f.id === req.params.findingId);
  if (!finding) { res.status(404).json({ error: "Finding not found." }); return; }
  res.json(ExplainFindingResponse.parse(await explain(finding, session.settings.useLocalAi)));
});
router.get("/shield/scans/:id/report", (req, res) => {
  const scan = sessionOf(res).scans.find(s => s.id === req.params.id);
  if (!scan) { res.status(404).json({ error: "Scan not found." }); return; }
  if (scan.status !== "completed") { res.status(409).json({ error: "A completed scan is required for export." }); return; }
  res.json(GetReportResponse.parse(makeReport(scan)));
});
export default router;