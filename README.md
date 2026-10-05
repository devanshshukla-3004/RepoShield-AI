# RepoShield AI

**Local-first repository security review for developers who want to protect a friend before publishing code.**

RepoShield AI scans a local project for common credential patterns and sensitive filenames, redacts evidence, and provides remediation guidance. It can optionally use an installed Gitleaks CLI for additional secret scanning and a local Gemma model served by Ollama to explain findings.

## Features

- **Local scanning:** heuristic checks for common API keys, GitHub tokens, private-key markers, credential assignments, and sensitive filenames.
- **Optional Gitleaks:** invokes the Gitleaks CLI when installed.
- **Redacted evidence:** the interface and exports avoid displaying complete detected values.
- **Local AI explanations:** optional Gemma via Ollama; the model receives finding metadata and redacted evidence rather than raw source lines.
- **Reports:** export findings to sanitized JSON and Markdown.
- **Safety limits:** skips common dependency/build directories, ignores files larger than 1 MB, caps file inspection at 1,500 and findings at 250.

## Quick start (Windows PowerShell)

Install Python 3.11 or newer, then from the project folder:

```powershell
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
```

If PowerShell blocks activation, use the virtual environment's interpreter directly:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m streamlit run app.py
```

## Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
streamlit run app.py
```

## Optional integrations

### Gitleaks

Install Gitleaks using its official installation instructions, then enable the Gitleaks checkbox in the scan page. RepoShield will fall back to heuristic checks if Gitleaks is not installed.

### Local Gemma through Ollama

Install Ollama, start it locally, and pull a small Gemma model that your machine can run (for example, `gemma3:1b`). In Findings & reports, use **Ask local Gemma for an explanation** and keep the endpoint pointed at your own local Ollama instance (default: `http://localhost:11434`).

The model is optional. If it is unavailable, the app provides general remediation guidance instead.

## Responsible use and limitations

- Scan only repositories you own or have explicit permission to assess.
- Run this app locally. Do not expose the dashboard or scan endpoint to the public internet.
- This MVP scans the working tree, not the full Git history.
- Heuristic checks can produce false positives and false negatives. A clean scan is not a security guarantee.
- AI output is advisory and is not the detection engine.
- If a credential was exposed, revoke or rotate it even after removing it from source.
- Never commit real secrets or include them in screenshots, issues, or reports.

## Why open innovation matters

Open source makes the detection logic and redaction behavior inspectable. Developers can audit the code, add rules, challenge false positives, and adapt the workflow to their needs. Local Gemma inference provides an option to explain findings without sending repository source code to a hosted AI API.

## Test

```powershell
python -m unittest discover -s tests
```

## Project status

Hackathon MVP / work in progress. Validate installation, scanner behavior, and local model availability in your own environment before relying on the results.

## License

MIT
