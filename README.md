# RepoShield AI

**A privacy-first repository secret scanner with optional local Gemma inference.**

RepoShield AI helps a developer review their own repository before sharing it. Gitleaks performs deterministic secret detection; the app redacts evidence and can ask a locally running Gemma model for plain-language explanations. AI output is advisory and never treated as proof that a credential is valid.

## What is implemented

- React + TypeScript dashboard: Overview, Scan Repository, Findings, Reports, Settings, and About.
- Clearly labelled synthetic demo mode; demo findings are fabricated and never represent a real scan.
- Gitleaks CLI integration for authorized working-tree scans.
- Local Ollama integration targeting `gemma3:1b`.
- Settings toggle to enable/disable local AI explanations.
- Secret values are withheld from findings and reports.
- JSON and Markdown report export.
- Explicit local scan authorization and dedicated scan-root validation.
- GitHub Actions typecheck/build workflow.

## Architecture

- **Frontend:** React, TypeScript, Vite, Tailwind CSS.
- **API:** Express, Zod validation, session-scoped in-memory scan history.
- **Secret detection:** Gitleaks CLI.
- **AI:** Ollama `gemma3:1b`, accessed only at `http://127.0.0.1:11434`.
- **Reports:** sanitized JSON and Markdown.

The AI prompt receives only server-defined finding metadata (type, category, severity, and rule identifier). It does not receive source code, raw evidence, or repository paths. If Ollama is unavailable, the API returns deterministic guidance and labels the fallback.

## Quick start — Windows

Requirements: Node.js 24, Git, pnpm 10, Ollama, and Gitleaks for real scans.

1. Install Node.js 24 and Git.
2. Enable pnpm using Corepack from an elevated or regular PowerShell window:
   ```powershell
   corepack enable
   corepack prepare pnpm@10.8.1 --activate
   ```
3. Install Ollama from [ollama.com](https://ollama.com/), then download the model:
   ```powershell
   ollama pull gemma3:1b
   ollama list
   ```
4. Install Gitleaks from its official releases: https://github.com/gitleaks/gitleaks/releases
5. In PowerShell, from the repository root:
   ```powershell
   pnpm install --frozen-lockfile
   pnpm run typecheck
   $env:PORT = "5173"
   $env:BASE_PATH = "/"
   pnpm --filter @workspace/reposhield run build
   pnpm --filter @workspace/api-server run build
   ```
6. Create a dedicated directory for repositories you are authorized to scan, for example `C:\ReposToScan`. Copy a test repository into that directory. Do not point the scan root at a drive root or your entire home directory.
7. Start the local API and built dashboard:
   ```powershell
   $env:PORT = "3000"
   $env:REPOSHIELD_LOCAL_SCAN = "1"
   $env:REPOSHIELD_SCAN_ROOT = "C:\ReposToScan"
   pnpm --filter @workspace/api-server run start
   ```
8. Open http://127.0.0.1:3000. Visit **Settings & runtime** and confirm Ollama/Gemma is detected. Enable **local Gemma explanations**. Visit **Scan repository** to run the synthetic demo, or select a repository inside `C:\ReposToScan` and confirm authorization before a real scan.

If PowerShell blocks Corepack or pnpm, resolve the Node/pnpm installation first; do not work around dependency errors by disabling security checks.

## Quick start — Linux

Install Node.js 24, Git, pnpm 10, Ollama, and Gitleaks using their official installation instructions. Then:

```bash
corepack enable
corepack prepare pnpm@10.8.1 --activate
ollama pull gemma3:1b
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm test
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/reposhield run build
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/api-server run build
mkdir -p "$HOME/ReposToScan"
PORT=3000 REPOSHIELD_LOCAL_SCAN=1 REPOSHIELD_SCAN_ROOT="$HOME/ReposToScan" pnpm --filter @workspace/api-server run start
```

Then open http://127.0.0.1:3000. Only place authorized repositories under the configured scan root.

## Test the local model

With Ollama running and `gemma3:1b` installed, run:

```bash
node scripts/check-ollama.mjs
```

This sends a harmless smoke-test prompt to the loopback Ollama API and confirms that the model returns a completed response. It does not scan a repository.

## Privacy and security boundaries

- Real scans are disabled unless `REPOSHIELD_LOCAL_SCAN=1` and `REPOSHIELD_SCAN_ROOT` are configured.
- Real scanning is intended for the local server, not a public hosted service. Do not expose the local API to an untrusted network.
- Gitleaks checks the working tree; this implementation does not scan the complete Git history.
- Reports exclude raw secret values and absolute repository paths.
- AI explanations are optional, local, and advisory. A model response is not a detection and can be wrong.
- Demo findings are synthetic examples only.
- Only scan repositories you own or have explicit permission to inspect.

## Open innovation

Open source makes the security workflow inspectable: developers can review detection rules, audit redaction, test the local inference boundary, and contribute additional safeguards. Local inference can make AI-assisted explanations more accessible without requiring source code to be sent to a hosted model.

## Known limitations

This is a portfolio and learning project, not a replacement for a professional security audit. Expect false positives and false negatives. Rotate any exposed credential at its provider; deleting a file alone does not invalidate a secret or remove it from Git history.

## License

MIT
