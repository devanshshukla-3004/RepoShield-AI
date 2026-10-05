import test from "node:test";
import assert from "node:assert/strict";
import { demoFindings, makeReport, safeFilePath, sanitizeFinding, withinRoot } from "../../artifacts/api-server/src/lib/shield-core";

test("safeFilePath withholds absolute and traversal paths", () => {
  assert.equal(safeFilePath("C:\\Users\\dev\\repo\\.env"), "[path omitted]");
  assert.equal(safeFilePath("/home/dev/repo/.env"), "[path omitted]");
  assert.equal(safeFilePath("../outside/.env"), "[path omitted]");
});

test("withinRoot rejects paths outside the dedicated scan root", () => {
  assert.equal(withinRoot("/srv/repos", "/srv/repos/friend-project"), true);
  assert.equal(withinRoot("/srv/repos", "/srv/other-project"), false);
  assert.equal(withinRoot("/srv/repos", "/srv/repos/../secrets"), false);
});

test("sanitizeFinding never returns raw secret evidence", () => {
  const finding = sanitizeFinding({
    RuleID: "github-pat",
    File: "src/config.ts",
    StartLine: 14,
    Secret: "ghp_FAKE_DO_NOT_USE_12345678901234567890",
    Match: "token=ghp_FAKE_DO_NOT_USE_12345678901234567890",
  });
  assert.equal(finding.evidence, "[REDACTED — secret value withheld]");
  assert.equal(finding.title, "GitHub personal access token");
  assert.equal(JSON.stringify(finding).includes("ghp_FAKE_DO_NOT_USE"), false);
});

test("demo findings and exported reports are explicitly labelled synthetic", () => {
  const findings = demoFindings();
  assert.ok(findings.length > 0);
  assert.ok(findings.every((finding) => finding.explanation.includes("Synthetic demo")));
  const report = makeReport({
    id: "test-report-id",
    mode: "demo",
    repository: "synthetic fixture",
    status: "completed",
    progress: 100,
    stage: "done",
    createdAt: new Date(0).toISOString(),
    durationMs: 1,
    filesAnalyzed: 12,
    findings,
    error: null,
  });
  assert.match(report.json, /SYNTHETIC DEMO/);
  assert.match(report.markdown, /SYNTHETIC DEMO/);
});
