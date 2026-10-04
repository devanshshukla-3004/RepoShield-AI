import { execFile } from "node:child_process";
import { mkdtemp, chmod, readFile, stat, realpath, readdir, lstat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, isAbsolute, parse } from "node:path";
import { sanitizeFinding, withinRoot, type Finding } from "./shield-core";

function run(binary: string, args: string[], timeout: number, cwd?: string): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve, reject) => {
    execFile(binary, args, {
      shell: false, timeout, killSignal: "SIGKILL", maxBuffer: 1024 * 1024, cwd,
      env: { PATH: process.env.PATH, SYSTEMROOT: process.env.SYSTEMROOT, HOME: cwd, TMPDIR: tmpdir(), GITLEAKS_CONFIG: "" },
    }, (error, stdout) => {
      if (error && (!("code" in error) || error.code !== 1)) {
        reject(new Error("Scanner unavailable, timed out, or failed. Check the local CLI installation and configuration.")); return;
      }
      resolve({ stdout, code: error ? 1 : 0 });
    });
  });
}
export async function gitleaksAvailable() {
  try { await run("gitleaks", ["version"], 2000); return true; } catch { return false; }
}
export function realScanEnabled() {
  return !process.env.REPL_ID && process.env.REPOSHIELD_LOCAL_SCAN === "1" && Boolean(process.env.REPOSHIELD_SCAN_ROOT);
}
export async function validatePath(input: string): Promise<string> {
  if (!input || !isAbsolute(input) || input.length > 512 || /[\x00-\x1f]/.test(input)) throw new Error("Use an absolute directory path on the server.");
  let target: string;
  try { target = await realpath(input); if (!(await stat(target)).isDirectory()) throw new Error(); }
  catch { throw new Error("Selected path does not exist or is not a directory."); }
  if (!realScanEnabled()) throw new Error("Real scanning is disabled here. Run the app locally with the documented CLI setup; the hosted browser cannot read your computer's repository.");
  const root = await realpath(process.env.REPOSHIELD_SCAN_ROOT!);
  if (root === parse(root).root || !withinRoot(root, target)) throw new Error("Selected path must be inside a dedicated configured scan root, not a filesystem root.");
  // Reject symlinks, including links nested in a repository, before handing it to the CLI.
  let entries = 0;
  async function check(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (++entries > 20000) throw new Error("Repository exceeds the 20,000-entry safety limit.");
      const full = join(dir, entry.name);
      const info = await lstat(full);
      if (info.isSymbolicLink()) throw new Error("Repositories containing symbolic links are not supported for safety.");
      if (info.isDirectory()) await check(full);
    }
  }
  await check(target);
  return target;
}
export async function scanDirectory(target: string, timeoutSeconds: number): Promise<Finding[]> {
  const temp = await mkdtemp(join(tmpdir(), "reposhield-"));
  await chmod(temp, 0o700);
  try {
    const report = join(temp, "report.json");
    await run("gitleaks", ["dir", target, "--redact=100", "--report-format", "json", "--report-path", report, "--no-banner", "--no-color", "--ignore-gitleaks-allow"], timeoutSeconds * 1000, temp);
    // Report is transient and fully redacted by Gitleaks, never logged or returned verbatim.
    let text: string;
    try {
      if ((await stat(report)).size > 5 * 1024 * 1024) throw new Error();
      text = await readFile(report, "utf8");
    } catch { throw new Error("Scanner did not produce a valid bounded report."); }
    const rows: unknown = JSON.parse(text);
    if (!Array.isArray(rows) || rows.length > 10000) throw new Error("Invalid or oversized scanner report.");
    return rows.filter(row => row && typeof row === "object").map(row => sanitizeFinding(row));
  } finally { await rm(temp, { recursive: true, force: true }); }
}