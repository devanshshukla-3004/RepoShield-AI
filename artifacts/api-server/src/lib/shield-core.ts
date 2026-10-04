import { randomUUID } from "node:crypto";
import { relative, isAbsolute, sep } from "node:path";

export type Finding = {
  id: string; title: string; severity: "critical" | "high" | "medium" | "low";
  category: string; filePath: string; line: number; evidence: string;
  status: "open" | "resolved" | "ignored"; explanation: string; risk: string;
  remediation: string; ruleId: string;
};
export type Scan = {
  id: string; mode: "demo" | "local"; repository: string;
  status: "running" | "completed" | "failed"; progress: number; stage: string;
  createdAt: string; durationMs: number; filesAnalyzed: number | null;
  findings: Finding[]; error: string | null;
};
export const defaultSettings = { useLocalAi: false, timeoutSeconds: 30, redactEvidence: true, retainSource: false };
export const guidance = "Revoke and rotate the credential at its provider. Remove the hardcoded value and load the replacement from a local secret store or environment variable. Add sensitive files to .gitignore. If committed, coordinate a history cleanup with repository owners; deleting a file alone does not remove history. Verify the replacement is not committed and rescan. Triage status is not proof of remediation.";

const rules: Record<string, { title: string; category: string; severity: Finding["severity"] }> = {
  "aws-access-token": { title: "AWS access credential", category: "Cloud credential", severity: "critical" },
  "github-pat": { title: "GitHub personal access token", category: "Access token", severity: "high" },
  "github-fine-grained-pat": { title: "GitHub fine-grained token", category: "Access token", severity: "high" },
  "private-key": { title: "Private key material", category: "Private key", severity: "critical" },
  "generic-api-key": { title: "Potential API credential", category: "API key", severity: "medium" },
  "slack-access-token": { title: "Slack access token", category: "Access token", severity: "high" },
};
export function withinRoot(root: string, target: string): boolean {
  const rel = relative(root, target);
  return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
}
export function safeFilePath(input: unknown): string {
  if (typeof input !== "string") return "[path omitted]";
  const path = input.replaceAll("\\", "/");
  if (isAbsolute(path) || /^[A-Za-z]:/.test(path) || path.split("/").includes("..") || /[\r\n\x00-\x1f]/.test(path)) return "[path omitted]";
  return path.split("/").map(part => /^[a-zA-Z0-9_. -]{1,48}$/.test(part) && !/[a-zA-Z0-9_-]{24,}/.test(part) ? part : "[redacted]").join("/").slice(0, 240);
}
export function sanitizeFinding(raw: Record<string, unknown>): Finding {
  const ruleId = typeof raw.RuleID === "string" && rules[raw.RuleID] ? raw.RuleID : "unclassified-secret";
  const rule = rules[ruleId] ?? { title: "Potential exposed secret", category: "Secret", severity: "high" as const };
  return {
    id: randomUUID(), ...rule, ruleId,
    filePath: safeFilePath(raw.File), line: Number.isSafeInteger(raw.StartLine) && Number(raw.StartLine) > 0 ? Number(raw.StartLine) : 1,
    evidence: "[REDACTED — secret value withheld]", status: "open",
    explanation: `Gitleaks matched a deterministic detection rule for ${rule.category.toLowerCase()}. This is a potential exposure, not confirmation that the credential is valid.`,
    risk: "If valid and accessible to an unauthorized person, this credential could permit unintended access. Severity is RepoShield's conservative triage classification, not a verified exploit.",
    remediation: guidance,
  };
}
export function demoFindings(): Finding[] {
  const fixtures = [
    ["aws-access-token", "config/demo.env", 12],
    ["github-pat", "scripts/demo-deploy.ts", 8],
    ["private-key", "fixtures/dummy-key.pem", 1],
    ["generic-api-key", "src/demo-client.ts", 24],
    ["slack-access-token", "examples/demo-notifications.js", 16],
    ["generic-api-key", "tests/fixtures/demo.env", 5],
  ] as const;
  return fixtures.map(([rule, file, line]) => ({
    ...sanitizeFinding({ RuleID: rule, File: file, StartLine: line }),
    evidence: "[MASKED — synthetic dummy credential]",
    explanation: "Synthetic demo finding only. No repository was inspected and no real credential was detected. " + (rules[rule]?.title ?? "Secret") + " is shown to demonstrate review and remediation.",
    risk: "Illustrative risk only: a real credential of this type could grant unauthorized access if leaked.",
  }));
}
export function makeReport(scan: Scan) {
  const payload = {
    application: "RepoShield AI", version: 1, mode: scan.mode,
    notice: scan.mode === "demo" ? "SYNTHETIC DEMO — no repository scanned, no real credentials." : "Authorized working-tree scan. Not a security guarantee. Git history is not scanned.",
    status: scan.status, createdAt: scan.createdAt, durationMs: scan.durationMs,
    filesAnalyzed: scan.filesAnalyzed, findings: scan.findings,
    limitations: "Potential false positives and false negatives. Triage status is user assigned. Raw evidence and absolute repository paths are excluded. AI explanations are not detection results.",
  };
  const markdown = `# RepoShield AI — sanitized report\n\n**Mode: ${scan.mode.toUpperCase()}**\n\n${payload.notice}\n\nStatus: ${scan.status}\n\n${payload.limitations}\n\n` + scan.findings.map(f =>
    `## ${f.title}\n- Severity: ${f.severity}\n- Category: ${f.category}\n- Location: \`${f.filePath.replaceAll("`", "")}:${f.line}\`\n- Status: ${f.status}\n- Evidence: ${f.evidence}\n\n${f.explanation}\n\n### Remediation\n${f.remediation}\n`
  ).join("\n");
  return { json: JSON.stringify(payload, null, 2), markdown, filename: `reposhield-${scan.mode}-${scan.id.slice(0,8)}` };
}