import json
import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import requests
import streamlit as st

st.set_page_config(page_title="RepoShield AI", page_icon="🛡️", layout="wide")
st.markdown("""
<style>
.stApp{background:#0b1117;color:#e6edf3}
section[data-testid="stSidebar"]{background:#101922;border-right:1px solid #263744}
div[data-testid="stMetric"]{background:#111c26;padding:16px;border:1px solid #253744;border-radius:12px}
.hero{padding:1.2rem 1.4rem;border:1px solid #26434a;border-radius:16px;background:linear-gradient(120deg,#11212a,#101720);margin-bottom:1rem}
.muted{color:#9aabb8}
</style>
""", unsafe_allow_html=True)

MAX_FILES, MAX_BYTES = 1500, 1_000_000
SKIP_DIRS = {".git", ".venv", "venv", "node_modules", "__pycache__", ".next", "dist", "build"}
PATTERNS = [
    ("AWS access key", re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "critical"),
    ("Private key material", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"), "critical"),
    ("GitHub token", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{20,}\b"), "high"),
    ("Credential assignment", re.compile(r"(?i)\b(?:api[_-]?key|secret|access[_-]?token|password)\s*[:=]\s*['\"]?[A-Za-z0-9_./+=-]{12,}"), "high"),
]

def redact(value):
    return value[:3] + "…" + value[-3:] if len(value) >= 8 else "[REDACTED]"

def scan(root):
    findings, scanned, notes = [], 0, []
    if not root.is_dir():
        raise ValueError("The selected path is not a directory.")
    for current, dirs, names in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS and not d.startswith(".cache")]
        for name in names:
            path = Path(current) / name
            if scanned >= MAX_FILES:
                notes.append(f"Stopped at the safety limit of {MAX_FILES} files.")
                return findings, scanned, notes
            if path.is_symlink() or not path.is_file():
                continue
            rel = path.relative_to(root).as_posix()
            if name in {".env", ".env.local", "id_rsa", "id_ed25519"}:
                sev = "critical" if name.startswith("id_") else "medium"
                findings.append({"id": f"CFG-{len(findings)+1:04}", "title": f"Sensitive filename: {name}", "severity": sev, "file": rel, "line": 1, "evidence": "[filename only]", "recommendation": "Remove real secrets/private keys from version control. Use environment variables or a secret manager."})
            try:
                if path.stat().st_size > MAX_BYTES:
                    continue
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            scanned += 1
            for line_no, line in enumerate(text.splitlines(), 1):
                for title, pattern, severity in PATTERNS:
                    match = pattern.search(line)
                    if match:
                        findings.append({"id": f"SEC-{len(findings)+1:04}", "title": title, "severity": severity, "file": rel, "line": line_no, "evidence": redact(match.group(0)), "recommendation": "Revoke/rotate the exposed credential, remove it from source, and use environment variables or a secret manager."})
                        break
                if len(findings) >= 250:
                    notes.append("Stopped collecting at the safety limit of 250 findings.")
                    return findings, scanned, notes
    return findings, scanned, notes

def gitleaks_scan(root):
    try:
        check = subprocess.run(["gitleaks", "version"], capture_output=True, text=True, timeout=5)
    except (OSError, subprocess.TimeoutExpired):
        return [], "Gitleaks is not installed; heuristic scan only."
    if check.returncode:
        return [], "Gitleaks is unavailable; heuristic scan only."
    try:
        result = subprocess.run(["gitleaks", "dir", str(root), "--report-format", "json", "--report-path", "-"], capture_output=True, text=True, timeout=90)
    except (OSError, subprocess.TimeoutExpired):
        return [], "Gitleaks timed out or could not run."
    if result.returncode not in (0, 1):
        return [], "Gitleaks returned an error."
    try:
        records = json.loads(result.stdout or "[]")
    except json.JSONDecodeError:
        return [], "Gitleaks output could not be parsed."
    findings = []
    for item in records[:250]:
        secret = str(item.get("Secret", ""))
        findings.append({"id": f"GL-{len(findings)+1:04}", "title": str(item.get("RuleID", "Secret detected")), "severity": "high", "file": str(item.get("File", "")), "line": int(item.get("StartLine", 1) or 1), "evidence": redact(secret), "recommendation": "Rotate the credential, remove it from source, and follow your provider's incident-response guidance."})
    return findings, "Gitleaks scan completed; evidence is redacted."

def explain(finding, endpoint, model):
    prompt = ("Explain the risk, remediation, and verification for this defensive security finding in 3 concise bullets. "
              "Do not request or infer any secret value. Finding: " + finding["title"] +
              "; severity: " + finding["severity"] + "; file: " + finding["file"] + ". Evidence is redacted.")
    try:
        r = requests.post(endpoint.rstrip("/") + "/api/generate", json={"model": model, "prompt": prompt, "stream": False}, timeout=45)
        r.raise_for_status()
        return r.json().get("response", "").strip() or "Local model returned no explanation."
    except requests.RequestException:
        return "Local Gemma is unavailable. Rotate exposed credentials, remove them from source, and use a secret manager."

st.sidebar.markdown("## 🛡️ RepoShield AI")
page = st.sidebar.radio("Workspace", ["Overview", "Scan repository", "Findings & reports", "Open innovation"])
st.sidebar.caption("Local-first security review · Work in progress")
st.markdown('<div class="hero"><p>LOCAL-FIRST SECURITY</p><h1>RepoShield AI</h1><p class="muted">Review your own repository before sharing your code.</p></div>', unsafe_allow_html=True)

if "findings" not in st.session_state:
    st.session_state.findings = []
if "meta" not in st.session_state:
    st.session_state.meta = {"files": 0, "path": "No scan yet", "mode": "Not run", "notes": []}

if page == "Overview":
    f, m = st.session_state.findings, st.session_state.meta
    a,b,c,d = st.columns(4)
    a.metric("Findings", len(f))
    b.metric("Critical", sum(x["severity"] == "critical" for x in f))
    c.metric("High", sum(x["severity"] == "high" for x in f))
    d.metric("Files inspected", m["files"])
    st.subheader("Start a repository review")
    st.write("Choose Scan repository in the sidebar to inspect a local folder.")
    st.info("No demo findings are mixed with real scan results. A clean scan is not a security guarantee.")
    st.markdown("**Inspect** common credential patterns  ·  **Redact** evidence  ·  **Remediate** with practical guidance")
elif page == "Scan repository":
    st.subheader("Scan a local repository")
    st.warning("Only scan directories you own or are authorized to assess. Do not expose this dashboard publicly.")
    target = st.text_input("Absolute path to repository", placeholder=r"C:\Users\you\source\my-project")
    use_gl = st.checkbox("Also run Gitleaks if installed", value=True)
    if st.button("Run security scan", type="primary"):
        try:
            root = Path(target.strip()).expanduser().resolve(strict=True)
            if not target.strip() or not root.is_dir():
                raise ValueError("Enter a valid repository directory.")
            with st.spinner("Scanning files and redacting evidence..."):
                findings, count, notes = scan(root)
                mode = "Local heuristic scan"
                if use_gl:
                    extra, note = gitleaks_scan(root)
                    findings.extend(extra)
                    notes.append(note)
                    mode += " + Gitleaks"
                st.session_state.findings = findings
                st.session_state.meta = {"files": count, "path": str(root), "mode": mode, "notes": notes}
            st.success(f"Scan finished: {len(findings)} finding(s), {count} text file(s) inspected.")
        except (OSError, ValueError, subprocess.TimeoutExpired) as e:
            st.error(f"Scan could not be completed: {e}")
    st.caption("Safety limits: skips dependency/build directories, ignores files over 1 MB, inspects at most 1,500 files.")
    for note in st.session_state.meta["notes"]:
        st.caption(note)
elif page == "Findings & reports":
    findings, meta = st.session_state.findings, st.session_state.meta
    st.subheader("Findings")
    st.caption(f"Target: {meta['path']} · Mode: {meta['mode']}")
    if not findings:
        st.info("No findings yet. Run a local scan first.")
    levels = st.multiselect("Severity", ["critical", "high", "medium", "low"], default=["critical", "high", "medium", "low"])
    for item in findings:
        if item["severity"] in levels:
            with st.expander(f"{item['severity'].upper()} · {item['title']} — {item['file']}:{item['line']}"):
                st.write(item["recommendation"])
                st.code("Evidence (redacted): " + item["evidence"])
                with st.expander("Ask local Gemma for an explanation"):
                    endpoint = st.text_input("Ollama endpoint", "http://localhost:11434", key="ep-"+item["id"])
                    model = st.text_input("Model", "gemma3:1b", key="model-"+item["id"])
                    if st.button("Explain", key="explain-"+item["id"]):
                        with st.spinner("Contacting local Ollama..."):
                            st.write(explain(item, endpoint, model))
    report = {"tool":"RepoShield AI", "generated_at":datetime.now(timezone.utc).isoformat(), "target":meta["path"], "mode":meta["mode"], "notice":"Heuristic indicators are not proof of exploitability. Secret evidence is redacted.", "findings":findings}
    st.download_button("Download sanitized JSON", json.dumps(report, indent=2), "reposhield-report.json", "application/json")
    md = "# RepoShield AI report\n\nTarget: " + meta["path"] + "\n\nMode: " + meta["mode"] + "\n\n"
    for x in findings:
        md += "\n## " + x["severity"].upper() + " — " + x["title"] + "\n\nFile: " + x["file"] + ":" + str(x["line"]) + "\n\nEvidence: " + x["evidence"] + "\n\nRecommendation: " + x["recommendation"] + "\n"
    st.download_button("Download Markdown", md, "reposhield-report.md", "text/markdown")
elif page == "Open innovation":
    st.subheader("Why open innovation matters")
    st.write("Open source lets developers inspect detection logic, challenge false positives, add rules, and verify redaction. Optional Gemma explanations can run through Ollama locally, so this app does not need to send source code to a hosted AI API.")
    st.warning("This is a learning and triage aid, not a replacement for code review, credential rotation, or a professional security assessment.")
