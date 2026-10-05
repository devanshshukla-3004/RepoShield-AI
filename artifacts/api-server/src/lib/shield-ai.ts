import type { Finding } from "./shield-core";
// Fixed loopback endpoint: clients cannot supply URLs or redirect inference off-host.
const endpoint = "http://127.0.0.1:11434";
const model = "gemma3:1b";
export async function aiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(1500), redirect: "error" });
    if (!response.ok) return false;
    const data = await response.json() as { models?: { name: string }[] };
    return Array.isArray(data.models) && data.models.some(m => m.name === model);
  } catch { return false; }
}
export async function explain(finding: Finding, enabled: boolean) {
  const fallback = (reason: string) => ({ source: "deterministic" as const, model: null, text: `${finding.explanation}\n\n${finding.risk}\n\n${finding.remediation}`, reason });
  if (!enabled) return fallback("Local AI is disabled in Settings. No model was used.");
  if (!(await aiStatus())) return fallback("Ollama or gemma3:1b is unavailable on the server. No model was used.");
  try {
    // Only server-owned generic classification goes into the prompt: no file names,
    // repository paths, raw evidence, code, or scanner-controlled descriptions.
    const response = await fetch(`${endpoint}/api/generate`, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        prompt: [
          "You are RepoShield AI, a defensive secure-coding assistant.",
          "Explain one potential repository secret exposure in plain language.",
          `Finding type: ${finding.title}.`,
          `Category: ${finding.category}.`,
          `Severity: ${finding.severity} (a conservative triage label, not proof of exploitability).`,
          `Detection rule: ${finding.ruleId}.`,
          finding.evidence.includes("synthetic")
            ? "Context: this is a synthetic demo fixture, not a real detection."
            : "Context: this is a potential detection, not confirmation that a credential is valid.",
          "Provide: (1) what this type of exposure can mean, (2) immediate safe response, (3) prevention advice.",
          "Never invent or reproduce credentials, secrets, tokens, private keys, or sensitive commands.",
          "Do not claim the credential is valid, that an attack occurred, or that remediation succeeded.",
          "Only generic server-defined finding metadata is provided; do not ask for source code or raw evidence.",
          "Keep the response concise and clearly label uncertainty."
        ].join("\n"),
        options: { num_predict: 300, temperature: 0.2 }
      }),
    });
    if (!response.ok) return fallback("Local inference failed. Built-in guidance shown; no successful model explanation.");
    const data = await response.json() as { response?: string; done?: boolean };
    if (typeof data.response !== "string" || !data.response.trim() || !data.done) return fallback("Local inference returned no complete explanation.");
    // Reject key-like output rather than risk showing model-generated credential examples.
    if (/[A-Za-z0-9_+/=-]{40,}|-----BEGIN|(?:key|token|password)\s*[:=]\s*[A-Za-z0-9_+/=-]{16,}/i.test(data.response)) return fallback("Model output was withheld by the safety filter. Built-in guidance shown.");
    return { source: "ollama" as const, model, text: data.response.slice(0, 5000), reason: "Verified response from local Ollama. AI guidance may be incorrect; review before applying." };
  } catch { return fallback("Local inference timed out or could not connect. No successful model explanation."); }
}