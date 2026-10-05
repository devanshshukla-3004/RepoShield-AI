# RepoShield AI

**A privacy-minded repository security review tool for developers.**

RepoShield AI helps a developer review their own repository before sharing or publishing it. The interface separates clearly labelled demonstration findings from actual local scan results and is designed to avoid exposing complete secrets in reports.

## Project goals

- Detect accidentally committed credentials with Gitleaks in an explicitly configured local scan environment.
- Run basic repository configuration checks.
- Explain findings with an optional local Gemma model through Ollama.
- Export sanitized JSON and Markdown reports.
- Keep repository contents local rather than sending source code to a hosted AI service.

## Status and limitations

This repository is being assembled from the project export. Treat the app as **work in progress** until the install, build, API, scanner, and AI integration have all been tested.

- Demo findings are synthetic examples, not detections from a real repository.
- Only scan repositories you own or have explicit permission to assess.
- Real filesystem scans should only be enabled on a trusted local server with an explicitly configured scan root.
- The scanner may inspect the working tree but not the full Git history. A clean result is not a security guarantee.
- AI explanations are advisory; they do not determine whether a finding is real.
- Never publish raw secrets in screenshots, logs, issues, or reports.

## Planned stack

- React, TypeScript, Vite, Tailwind CSS
- Express API with input validation
- Gitleaks CLI for secret scanning
- Optional local Ollama inference using Gemma

## Development

The original project export uses a pnpm workspace intended for Node.js 24. After the full source tree is uploaded, install dependencies and run the available scripts from the repository root:

```bash
pnpm install
pnpm run typecheck
pnpm run build
```

See the workspace package scripts and configuration before starting the frontend and API server. The API may require local configuration; do not expose a scan endpoint to the public internet.

## Why open innovation matters

Open source lets developers inspect how findings are classified, audit redaction behavior, add detection rules, and run supported components locally. RepoShield AI is a learning and review aid, not a replacement for a professional security audit.

## License

MIT
